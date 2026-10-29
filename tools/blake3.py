#!/usr/bin/env python3
"""BLAKE3, pure Python standard library.

Cloudflare Pages identifies uploaded assets by

    blake3(base64(file_bytes) + extension).hex()[0:32]

so deploying without Wrangler means implementing BLAKE3. This is the
unkeyed hash mode only ("hash" in the BLAKE3 spec); keyed, derive-key and
XOF-length requests are not needed here.

Verified against the published BLAKE3 test vectors:

    b""                    -> af1349b9f5f9a1a6a0404dea36dcc949...
    b"abc"                 -> 6437b3ac38465133ffb63b75273a8db5...
    b"hello world"         -> d74981efa70a0c880b8d8c1985d075db...

The algorithm is the reference construction from the BLAKE3 paper:
a 1024-byte chunk tree, a 7-round BLAKE2s-based compression function,
and a chaining-value stack so arbitrarily long input never needs to be
held in memory as a whole tree.

Usage:
    python3 tools/blake3.py FILE...   # print hex digests
"""

from __future__ import annotations

import sys

__all__ = ["blake3", "blake3_hex", "pages_asset_hash"]

# Initialisation vector: the same constants as BLAKE2s (fractional parts of
# the square roots of the first eight primes).
IV = (
    0x6A09E667,
    0xBB67AE85,
    0x3C6EF372,
    0xA54FF53A,
    0x510E527F,
    0x9B05688C,
    0x1F83D9AB,
    0x5BE0CD19,
)

MSG_PERMUTATION = (2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8)

CHUNK_START = 1 << 0
CHUNK_END = 1 << 1
PARENT = 1 << 2
ROOT = 1 << 3

BLOCK_LEN = 64
CHUNK_LEN = 1024
OUT_LEN = 32
MASK32 = 0xFFFFFFFF


def _rotr32(value: int, shift: int) -> int:
    return ((value >> shift) | (value << (32 - shift))) & MASK32


def _g(state: list[int], a: int, b: int, c: int, d: int, mx: int, my: int) -> None:
    state[a] = (state[a] + state[b] + mx) & MASK32
    state[d] = _rotr32(state[d] ^ state[a], 16)
    state[c] = (state[c] + state[d]) & MASK32
    state[b] = _rotr32(state[b] ^ state[c], 12)
    state[a] = (state[a] + state[b] + my) & MASK32
    state[d] = _rotr32(state[d] ^ state[a], 8)
    state[c] = (state[c] + state[d]) & MASK32
    state[b] = _rotr32(state[b] ^ state[c], 7)


def _round(state: list[int], block: list[int]) -> None:
    # Columns.
    _g(state, 0, 4, 8, 12, block[0], block[1])
    _g(state, 1, 5, 9, 13, block[2], block[3])
    _g(state, 2, 6, 10, 14, block[4], block[5])
    _g(state, 3, 7, 11, 15, block[6], block[7])
    # Diagonals.
    _g(state, 0, 5, 10, 15, block[8], block[9])
    _g(state, 1, 6, 11, 12, block[10], block[11])
    _g(state, 2, 7, 8, 13, block[12], block[13])
    _g(state, 3, 4, 9, 14, block[14], block[15])


def _compress(
    chaining_value: tuple[int, ...] | list[int],
    block_words: list[int],
    counter: int,
    block_len: int,
    flags: int,
) -> list[int]:
    """Return the 16 output words of one compression."""
    state = [
        chaining_value[0],
        chaining_value[1],
        chaining_value[2],
        chaining_value[3],
        chaining_value[4],
        chaining_value[5],
        chaining_value[6],
        chaining_value[7],
        IV[0],
        IV[1],
        IV[2],
        IV[3],
        counter & MASK32,
        (counter >> 32) & MASK32,
        block_len,
        flags,
    ]
    block = list(block_words)
    for index in range(7):
        _round(state, block)
        if index != 6:
            block = [block[MSG_PERMUTATION[i]] for i in range(16)]
    for i in range(8):
        state[i] ^= state[i + 8]
        state[i + 8] ^= chaining_value[i]
    return state


def _words_from_bytes(data: bytes) -> list[int]:
    """Little-endian 32-bit words, zero padded to 16 words."""
    padded = bytes(data) + b"\x00" * (BLOCK_LEN - len(data))
    return [int.from_bytes(padded[i : i + 4], "little") for i in range(0, BLOCK_LEN, 4)]


class _Output:
    """The last block of a chunk, or a parent node, before finalisation."""

    __slots__ = ("input_cv", "block_words", "counter", "block_len", "flags")

    def __init__(
        self,
        input_cv: tuple[int, ...] | list[int],
        block_words: list[int],
        counter: int,
        block_len: int,
        flags: int,
    ) -> None:
        self.input_cv = tuple(input_cv)
        self.block_words = block_words
        self.counter = counter
        self.block_len = block_len
        self.flags = flags

    def chaining_value(self) -> list[int]:
        return _compress(
            self.input_cv, self.block_words, self.counter, self.block_len, self.flags
        )[:8]

    def root_bytes(self, length: int) -> bytes:
        output = bytearray()
        block_counter = 0
        while len(output) < length:
            words = _compress(
                self.input_cv,
                self.block_words,
                block_counter,
                self.block_len,
                self.flags | ROOT,
            )
            for word in words:
                output += word.to_bytes(4, "little")
                if len(output) >= length:
                    break
            block_counter += 1
        return bytes(output[:length])


class _ChunkState:
    """Accumulates one 1024-byte chunk."""

    __slots__ = ("chaining_value", "chunk_counter", "block", "block_len", "blocks_compressed")

    def __init__(self, key: tuple[int, ...], chunk_counter: int) -> None:
        self.chaining_value = key
        self.chunk_counter = chunk_counter
        self.block = bytearray()
        self.block_len = 0
        self.blocks_compressed = 0

    def length(self) -> int:
        return BLOCK_LEN * self.blocks_compressed + self.block_len

    def _start_flag(self) -> int:
        return CHUNK_START if self.blocks_compressed == 0 else 0

    def update(self, data: bytes) -> None:
        offset = 0
        while offset < len(data):
            if self.block_len == BLOCK_LEN:
                self.chaining_value = _compress(
                    self.chaining_value,
                    _words_from_bytes(self.block),
                    self.chunk_counter,
                    BLOCK_LEN,
                    self._start_flag(),
                )[:8]
                self.blocks_compressed += 1
                self.block = bytearray()
                self.block_len = 0
            take = min(BLOCK_LEN - self.block_len, len(data) - offset)
            self.block += data[offset : offset + take]
            self.block_len += take
            offset += take

    def output(self) -> _Output:
        return _Output(
            self.chaining_value,
            _words_from_bytes(self.block),
            self.chunk_counter,
            self.block_len,
            self._start_flag() | CHUNK_END,
        )


def _parent_output(left_cv: list[int], right_cv: list[int]) -> _Output:
    return _Output(IV, list(left_cv) + list(right_cv), 0, BLOCK_LEN, PARENT)


def _parent_cv(left_cv: list[int], right_cv: list[int]) -> list[int]:
    return _parent_output(left_cv, right_cv).chaining_value()


class Hasher:
    """Incremental BLAKE3 hasher (unkeyed)."""

    def __init__(self) -> None:
        self._chunk_state = _ChunkState(IV, 0)
        self._cv_stack: list[list[int]] = []

    def _add_chunk_cv(self, new_cv: list[int], total_chunks: int) -> None:
        while total_chunks & 1 == 0:
            new_cv = _parent_cv(self._cv_stack.pop(), new_cv)
            total_chunks >>= 1
        self._cv_stack.append(new_cv)

    def update(self, data: bytes) -> "Hasher":
        offset = 0
        while offset < len(data):
            if self._chunk_state.length() == CHUNK_LEN:
                chunk_cv = self._chunk_state.output().chaining_value()
                total_chunks = self._chunk_state.chunk_counter + 1
                self._add_chunk_cv(chunk_cv, total_chunks)
                self._chunk_state = _ChunkState(IV, total_chunks)
            want = CHUNK_LEN - self._chunk_state.length()
            take = min(want, len(data) - offset)
            self._chunk_state.update(data[offset : offset + take])
            offset += take
        return self

    def digest(self, length: int = OUT_LEN) -> bytes:
        output = self._chunk_state.output()
        for index in range(len(self._cv_stack) - 1, -1, -1):
            output = _parent_output(self._cv_stack[index], output.chaining_value())
        return output.root_bytes(length)

    def hexdigest(self, length: int = OUT_LEN) -> str:
        return self.digest(length).hex()


def blake3(data: bytes, length: int = OUT_LEN) -> bytes:
    return Hasher().update(data).digest(length)


def blake3_hex(data: bytes, length: int = OUT_LEN) -> str:
    return Hasher().update(data).hexdigest(length)


def pages_asset_hash(path: str, data: bytes) -> str:
    """The 32-hex-char key Cloudflare Pages uses for an asset.

    Mirrors Wrangler's hashFile(): blake3 of base64(contents) + extension,
    truncated to the first 32 hex characters.
    """
    import base64
    from pathlib import PurePath

    extension = PurePath(path).suffix.lstrip(".")
    encoded = base64.b64encode(data)
    return blake3_hex(encoded + extension.encode(), 32 * 2)[:32]


def _self_test() -> int:
    vectors = {
        b"": "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262",
        b"abc": "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85",
        b"hello world": "d74981efa70a0c880b8d8c1985d075dbcbf679b99a5f9914e5aaf96b831a9e24",
    }
    failures = 0
    for data, expected in vectors.items():
        actual = blake3_hex(data)
        ok = actual == expected
        print(f"{'ok  ' if ok else 'FAIL'} blake3({data[:12]!r}) = {actual}")
        if not ok:
            print(f"     expected               = {expected}")
            failures += 1
    # Multi-chunk input: exercise the tree path (3000 bytes spans three chunks).
    streamed = Hasher()
    for index in range(0, 3000, 7):
        streamed.update(b"x" * min(7, 3000 - index))
    once = blake3(b"x" * 3000)
    ok = streamed.digest() == once
    print(f"{'ok  ' if ok else 'FAIL'} streaming == one-shot over 3000 bytes")
    failures += 0 if ok else 1
    return 1 if failures else 0


if __name__ == "__main__":
    if len(sys.argv) == 1 or sys.argv[1:] == ["--self-test"]:
        raise SystemExit(_self_test())
    for name in sys.argv[1:]:
        with open(name, "rb") as handle:
            print(f"{blake3_hex(handle.read())}  {name}")

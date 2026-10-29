#!/usr/bin/env python3
"""Deploy dist/ to Cloudflare Pages without Wrangler.

Wrangler is only an HTTP client. This replicates what it does, in order:

  1. GET  /accounts/{a}/pages/projects/{p}/upload-token      -> short-lived JWT
  2. POST /pages/assets/check-missing                        -> hashes the edge lacks
  3. POST /pages/assets/upload                               -> base64 asset bodies
  4. POST /pages/assets/upsert-hashes                        -> record known hashes
  5. POST /accounts/{a}/pages/projects/{p}/deployments       -> manifest of path -> hash

Three details that are easy to get wrong, all verified against Wrangler's
source and then against a live deployment:

  - manifest keys carry a leading slash: "/index.html", not "index.html";
  - "_headers", "_redirects" and "_routes.json" are NOT assets. They are
    consumed as configuration and sent as dedicated parts of the deployment
    request, because Pages never serves them;
  - the asset key is NOT a SHA-256 of the file. Wrangler computes
    blake3(base64(contents) + extension)[0:32] (see tools/blake3.py).
    Getting this wrong yields a deployment that 500s at every path.

Standard library only (urllib, base64, json, pathlib). No pip install.
The one non-obvious dependency, BLAKE3, is implemented in tools/blake3.py
for the same reason: it cannot be installed here.
Authentication is unavoidable: the API token needs
"Account · Cloudflare Pages · Edit". Read from CLOUDFLARE_API_TOKEN or
~/.cloudflare-token (mode 600); never taken from argv, never printed.

Usage:
    python3 tools/deploy.py --dry-run
    python3 tools/deploy.py
    python3 tools/deploy.py --preview --branch staging
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

from blake3 import pages_asset_hash

API = "https://api.cloudflare.com/client/v4"

# Account ids are identifiers, not secrets: they appear in dashboard URLs.
DEFAULT_ACCOUNT_ID = "76100d2d567029895ef9b581b6fa728b"
DEFAULT_PROJECT = "sircollins-pwa"
TOKEN_FILE = Path.home() / ".cloudflare-token"

# Consumed as config by Pages; sent as deployment parts, never uploaded as assets.
CONFIG_FILES = ("_headers", "_redirects", "_routes.json")
IGNORED_NAMES = {".DS_Store", "Thumbs.db"}
IGNORED_DIRS = {".git", "__pycache__", ".wrangler"}

# Keep each asset upload request modest; the API caps payload size.
BATCH_FILES = 40
BATCH_BYTES = 8 * 1024 * 1024


class DeployError(RuntimeError):
    """Configuration or API failure, reported without a traceback."""


def read_token() -> str:
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if token:
        return token
    if TOKEN_FILE.is_file():
        mode = TOKEN_FILE.stat().st_mode & 0o777
        if mode & 0o077:
            print(
                f"warning: {TOKEN_FILE} is group/world readable (mode {mode:o});"
                " run chmod 600 on it",
                file=sys.stderr,
            )
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if token:
            return token
    raise DeployError(
        "no token found.\n"
        "  Set CLOUDFLARE_API_TOKEN, or write the token to "
        f"{TOKEN_FILE} and chmod 600 it.\n"
        "  The token needs: Account · Cloudflare Pages · Edit"
    )


def collect_files(root: Path) -> list[tuple[str, bytes]]:
    if not root.is_dir():
        raise DeployError(f"output directory not found: {root}")
    entries: list[tuple[str, bytes]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if any(part in IGNORED_DIRS for part in rel.parts):
            continue
        if path.name in IGNORED_NAMES:
            continue
        entries.append(("/".join(rel.parts), path.read_bytes()))
    if not entries:
        raise DeployError(f"no files found in {root}")
    return entries


def split_config(
    files: list[tuple[str, bytes]],
) -> tuple[list[tuple[str, bytes]], dict[str, bytes]]:
    """Separate deployable assets from Pages configuration files."""
    assets = [(p, d) for p, d in files if p not in CONFIG_FILES]
    config = {p: d for p, d in files if p in CONFIG_FILES}
    return assets, config


def build_manifest(assets: list[tuple[str, bytes]]) -> dict[str, str]:
    """Manifest keys need the leading slash; values are Pages asset hashes.

    The hash is blake3(base64(contents) + extension)[0:32], not a SHA-256 of
    the raw bytes. Cloudflare resolves assets by this key, so any other hash
    produces a deployment that 500s.
    """
    return {f"/{path}": pages_asset_hash(path, data) for path, data in assets}


def encode_multipart(
    fields: dict[str, str], parts: list[tuple[str, bytes]] | None = None
) -> tuple[bytes, str]:
    """multipart/form-data. `parts` are (name, bytes) for config files."""
    boundary = f"----sircollins{secrets.token_hex(16)}"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n'
            f"\r\n{value}\r\n".encode()
        )

    for name, data in parts or []:
        content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        chunks.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"; filename="{name}"\r\n'
            f"Content-Type: {content_type}\r\n"
            f"\r\n".encode()
        )
        chunks.append(data)
        chunks.append(b"\r\n")

    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def request_json(
    method: str,
    url: str,
    token: str,
    *,
    payload: object | None = None,
    body: bytes | None = None,
    content_type: str | None = None,
    timeout: int = 180,
) -> dict:
    data = body
    headers = {"Authorization": f"Bearer {token}"}
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    if content_type is not None:
        headers["Content-Type"] = content_type

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload_out = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw)
            detail = "; ".join(
                f"[{item.get('code')}] {item.get('message')}"
                for item in parsed.get("errors", [])
            ) or raw
        except json.JSONDecodeError:
            detail = raw[:400]
        raise DeployError(
            f"{method} {url.split('/client/v4')[-1]} -> HTTP {error.code}: {detail}"
        ) from error
    except urllib.error.URLError as error:
        raise DeployError(f"{method} {url} -> network error: {error.reason}") from error

    # A 200 is not success: the API reports failures in the body too. Silently
    # ignoring this is how a failed asset upload becomes a deployment that
    # serves nothing, so treat it as fatal.
    if not payload_out.get("success", False):
        errors = "; ".join(
            f"[{item.get('code')}] {item.get('message')}"
            for item in payload_out.get("errors") or []
        )
        raise DeployError(
            f"{method} {url.split('/client/v4')[-1]} -> API reported failure: "
            f"{errors or payload_out}"
        )
    return payload_out


def api(path: str) -> str:
    return f"{API}{path}"


def ensure_project(token: str, account_id: str, project: str) -> bool:
    base = api(f"/accounts/{account_id}/pages/projects")
    try:
        request_json("GET", f"{base}/{project}", token)
        return False
    except DeployError as error:
        message = str(error)
        if "HTTP 404" not in message and "8000007" not in message:
            raise
    request_json(
        "POST",
        base,
        token,
        payload={"name": project, "production_branch": "main"},
    )
    return True


def upload_assets(
    token: str, account_id: str, project: str, assets: list[tuple[str, bytes]]
) -> None:
    """Push asset bodies the edge does not already have."""
    if not assets:
        return
    jwt = request_json(
        "GET",
        api(f"/accounts/{account_id}/pages/projects/{project}/upload-token"),
        token,
    )["result"]["jwt"]

    keyed = [(pages_asset_hash(path, data), path, data) for path, data in assets]
    hashes = {key for key, _, _ in keyed}
    missing = set(
        request_json(
            "POST",
            api("/pages/assets/check-missing"),
            jwt,
            payload={"hashes": sorted(hashes)},
        )["result"]
    )

    pending = [(key, path, data) for key, path, data in keyed if key in missing]
    if not pending:
        print("assets: all hashes already present at the edge")
    else:
        print(f"assets: uploading {len(pending)} of {len(assets)} (rest cached)")

    batch: list[dict[str, object]] = []
    batch_bytes = 0

    def flush() -> None:
        nonlocal batch, batch_bytes
        if not batch:
            return
        request_json(
            "POST", api("/pages/assets/upload"), jwt, payload=batch
        )
        batch = []
        batch_bytes = 0

    for key, path, data in pending:
        batch.append(
            {
                "key": key,
                "value": base64.b64encode(data).decode(),
                "metadata": {
                    "contentType": mimetypes.guess_type(path)[0]
                    or "application/octet-stream"
                },
                "base64": True,
            }
        )
        batch_bytes += len(data)
        if len(batch) >= BATCH_FILES or batch_bytes >= BATCH_BYTES:
            flush()
    flush()

    request_json(
        "POST",
        api("/pages/assets/upsert-hashes"),
        jwt,
        payload={"hashes": sorted(hashes)},
    )


def create_deployment(
    token: str,
    account_id: str,
    project: str,
    assets: list[tuple[str, bytes]],
    config: dict[str, bytes],
    *,
    branch: str,
    commit_message: str,
) -> dict:
    manifest = build_manifest(assets)
    fields = {
        "manifest": json.dumps(manifest),
        "branch": branch,
        "commit_message": commit_message,
        "commit_dirty": "false",
    }
    body, content_type = encode_multipart(
        fields, [(name, data) for name, data in config.items()]
    )
    payload = request_json(
        "POST",
        api(f"/accounts/{account_id}/pages/projects/{project}/deployments"),
        token,
        body=body,
        content_type=content_type,
    )
    return payload["result"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Deploy a directory to Cloudflare Pages via the REST API."
    )
    parser.add_argument("--dir", default="dist", type=Path, help="output directory")
    parser.add_argument("--project", default=DEFAULT_PROJECT, help="Pages project")
    parser.add_argument(
        "--account",
        default=os.environ.get("CLOUDFLARE_ACCOUNT_ID", DEFAULT_ACCOUNT_ID),
        help="account id",
    )
    parser.add_argument("--branch", default="main", help="branch to deploy")
    parser.add_argument("--preview", action="store_true", help="deploy as preview")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="show the manifest and exit without touching the network",
    )
    parser.add_argument(
        "--commit-message",
        default="Deploy via tools/deploy.py",
        help="commit message recorded on the deployment",
    )
    args = parser.parse_args(argv)

    try:
        files = collect_files(args.dir)
        assets, config = split_config(files)
        manifest = build_manifest(assets)

        if args.dry_run:
            print(f"dry run: {len(assets)} assets, {len(config)} config file(s)")
            for path in sorted(manifest):
                size = next(len(d) for p, d in assets if f"/{p}" == path)
                print(f"  {path}  {size:>8} B  {manifest[path][:12]}")
            for name in sorted(config):
                print(f"  {name}  {len(config[name]):>8} B  (config part)")
            print(f"manifest entries: {len(manifest)}")
            print("no network calls made")
            return 0

        token = read_token()
        if ensure_project(token, args.account, args.project):
            print(f"created Pages project {args.project}")

        upload_assets(token, args.account, args.project, assets)
        result = create_deployment(
            token,
            args.account,
            args.project,
            assets,
            config,
            branch=args.branch,
            commit_message=args.commit_message,
        )
    except DeployError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    print(f"deployment: {result.get('id')}")
    print(f"environment: {result.get('environment')}")
    print(f"url: {result.get('url')}")
    # Direct uploads return "aliases": null rather than an empty list.
    for alias in result.get("aliases") or []:
        print(f"alias: {alias}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

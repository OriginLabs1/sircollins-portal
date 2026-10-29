#!/usr/bin/env python3
"""Deploy dist/ to Cloudflare Pages without Wrangler.

Wrangler is only an HTTP client. This talks to the same endpoint:

    POST /accounts/{account_id}/pages/projects/{project_name}/deployments
    Content-Type: multipart/form-data
      manifest = JSON {"<path>": "<sha256>"}
      <sha256> = file bytes

Standard library only (urllib, hashlib, secrets, json). No pip install.
Authentication is unavoidable: the endpoint requires a token holding
"Account · Cloudflare Pages · Edit". This script reads it from the
environment or from ~/.cloudflare-token (mode 600) and never prints it.

Usage:
    python3 tools/deploy.py --dry-run          # build the manifest, touch no network
    python3 tools/deploy.py                    # deploy dist/ to production
    python3 tools/deploy.py --preview          # deploy as a preview instead
    python3 tools/deploy.py --account <id>     # override the account id

Environment:
    CLOUDFLARE_API_TOKEN   preferred token source
    CLOUDFLARE_ACCOUNT_ID  optional account id override
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.cloudflare.com/client/v4"

# Account ids are identifiers, not secrets: they appear in dashboard URLs.
DEFAULT_ACCOUNT_ID = "76100d2d567029895ef9b581b6fa728b"
DEFAULT_PROJECT = "sircollins-pwa"
TOKEN_FILE = Path.home() / ".cloudflare-token"

# Cloudflare Pages ignores these at the edge; keep them out of the manifest.
IGNORED_NAMES = {".DS_Store", "Thumbs.db"}
IGNORED_DIRS = {".git", "__pycache__", ".wrangler"}


class DeployError(RuntimeError):
    """Configuration or API failure, reported without a traceback."""


def read_token() -> str:
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if token:
        return token
    if TOKEN_FILE.is_file():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if token:
            mode = TOKEN_FILE.stat().st_mode & 0o777
            if mode & 0o077:
                print(
                    f"warning: {TOKEN_FILE} is readable by other users "
                    f"(mode {mode:o}); consider chmod 600",
                    file=sys.stderr,
                )
            return token
    raise DeployError(
        "no token found.\n"
        "  Set CLOUDFLARE_API_TOKEN, or write the token to "
        f"{TOKEN_FILE} and chmod 600 it.\n"
        '  The token needs: Account · Cloudflare Pages · Edit'
    )


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def collect_files(root: Path) -> list[tuple[str, bytes]]:
    """Return (deployment_path, bytes) for every file in root, sorted for stability."""
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
        # Pages expects leading-slash-free paths in the manifest.
        entries.append(("/".join(rel.parts), path.read_bytes()))
    if not entries:
        raise DeployError(f"no files found in {root}")
    return entries


def build_manifest(files: list[tuple[str, bytes]]) -> dict[str, str]:
    return {path: sha256_hex(data) for path, data in files}


def encode_multipart(
    fields: dict[str, str], files: list[tuple[str, bytes]]
) -> tuple[bytes, str]:
    """Encode a multipart/form-data body. File parts are named by their hash."""
    boundary = f"----sircollins{secrets.token_hex(16)}"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n'
            f"\r\n{value}\r\n".encode()
        )

    for path, data in files:
        digest = sha256_hex(data)
        content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        chunks.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{digest}"; filename="{digest}"\r\n'
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
    body: bytes | None = None,
    content_type: str | None = None,
    timeout: int = 120,
) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    if content_type is not None:
        headers["Content-Type"] = content_type
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(detail)
            errors = "; ".join(
                f"[{item.get('code')}] {item.get('message')}"
                for item in parsed.get("errors", [])
            )
            detail = errors or detail
        except json.JSONDecodeError:
            pass
        raise DeployError(f"{method} {url} -> HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise DeployError(f"{method} {url} -> network error: {error.reason}") from error

    if not payload.get("success", False):
        errors = "; ".join(
            f"[{item.get('code')}] {item.get('message')}"
            for item in payload.get("errors", [])
        )
        raise DeployError(f"{method} {url} -> API error: {errors or payload}")
    return payload


def ensure_project(token: str, account_id: str, project: str) -> bool:
    """Create the project if missing. Returns True when it was created."""
    base = f"{API}/accounts/{account_id}/pages/projects"
    try:
        request_json("GET", f"{base}/{project}", token)
        return False
    except DeployError as error:
        if "HTTP 404" not in str(error) and "HTTP 8000007" not in str(error):
            raise

    body = json.dumps(
        {"name": project, "production_branch": "main"}
    ).encode()
    request_json(
        "POST", base, token, body=body, content_type="application/json"
    )
    return True


def deploy(
    token: str,
    account_id: str,
    project: str,
    out_dir: Path,
    *,
    preview: bool,
) -> dict:
    files = collect_files(out_dir)
    manifest = build_manifest(files)
    total = sum(len(data) for _, data in files)

    fields = {
        "manifest": json.dumps(manifest),
        "commit_message": f"Deploy {len(files)} files from {out_dir}",
        "commit_dirty": "false",
    }
    if preview:
        fields["branch"] = "preview"

    body, content_type = encode_multipart(fields, files)
    url = f"{API}/accounts/{account_id}/pages/projects/{project}/deployments"

    print(
        f"uploading {len(files)} files, {total} bytes "
        f"(multipart body {len(body)} bytes) to {project}"
    )
    payload = request_json("POST", url, token, body=body, content_type=content_type)
    return payload["result"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Deploy a directory to Cloudflare Pages via the REST API."
    )
    parser.add_argument("--dir", default="dist", type=Path, help="output directory")
    parser.add_argument("--project", default=DEFAULT_PROJECT, help="Pages project name")
    parser.add_argument(
        "--account",
        default=os.environ.get("CLOUDFLARE_ACCOUNT_ID", DEFAULT_ACCOUNT_ID),
        help="account id",
    )
    parser.add_argument("--preview", action="store_true", help="deploy as preview")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="list the manifest and exit without touching the network",
    )
    args = parser.parse_args(argv)

    try:
        files = collect_files(args.dir)
        manifest = build_manifest(files)

        if args.dry_run:
            print(f"dry run: {len(files)} files in {args.dir}")
            for path in sorted(manifest):
                size = next(len(d) for p, d in files if p == path)
                print(f"  /{path}  {size:>8} B  {manifest[path][:12]}")
            print(f"manifest entries: {len(manifest)}")
            print("no network calls made")
            return 0

        token = read_token()
        created = ensure_project(token, args.account, args.project)
        if created:
            print(f"created Pages project {args.project}")
        result = deploy(
            token, args.account, args.project, args.dir, preview=args.preview
        )
    except DeployError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    print(f"deployment: {result.get('id')}")
    print(f"environment: {result.get('environment')}")
    print(f"url: {result.get('url')}")
    for alias in result.get("aliases", []):
        print(f"alias: {alias}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

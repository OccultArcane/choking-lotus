#!/usr/bin/env python3
"""Refresh the "Shop my friends" row from IMVU's public user lookup.

Each row in index.html is keyed by IMVU's numeric user id (`data-imvu-id`),
which never changes. Looking the row up by id rather than by name means a
creator who renames their avatar is followed rather than lost: the row's label
is refreshed to their current username, its shop link to their current creator
id, and its portrait to their current profile picture.

    python tools/refresh_friends.py

Needs Pillow (`pip install pillow`). Safe to run repeatedly: unchanged data
produces no file changes.

The page cannot do this in the browser: api.imvu.com sends no
Access-Control-Allow-Origin header, so a fetch from the site is blocked. This
script and the scheduled workflow are the equivalent of that fetch.
"""

from __future__ import annotations

import html
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
FRIENDS_DIR = ROOT / "assets" / "friends"
# Records each portrait's source URL so an unchanged picture is never re-encoded.
MANIFEST = FRIENDS_DIR / "manifest.json"

ROW = re.compile(r'<a class="friend"[^>]*data-imvu-id="(\d+)"[^>]*>.*?</a>', re.DOTALL)
PORTRAIT_SIZE = 160
UA = "Mozilla/5.0 (compatible; choking-lotus-site-refresh/1.0)"
TIMEOUT = 30


def get_json(url: str) -> dict:
    request = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.load(response)


def get_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def look_up(user_id: str) -> dict:
    payload = get_json(f"https://api.imvu.com/user/user-{user_id}")
    if payload.get("status") != "success" or not payload.get("denormalized"):
        raise RuntimeError(f"lookup failed ({payload.get('error', 'no data')})")

    data = next(iter(payload["denormalized"].values()))["data"]

    username = str(data.get("username") or "").strip()
    if not username:
        raise RuntimeError("no username in the response")

    thumbnail = data.get("thumbnail_url")
    if not thumbnail:
        raise RuntimeError("no thumbnail in the response")

    return {
        "id": user_id,
        "username": username,
        "creator_id": data.get("legacy_cid") or int(user_id),
        "thumbnail": thumbnail,
    }


def load_manifest() -> dict:
    try:
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_manifest(manifest: dict) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_portrait(user_id: str, url: str) -> int:
    image = Image.open(io.BytesIO(get_bytes(url))).convert("RGB")
    # Square crop weighted slightly above centre keeps faces in frame.
    image = ImageOps.fit(image, (PORTRAIT_SIZE, PORTRAIT_SIZE), method=Image.LANCZOS, centering=(0.5, 0.38))
    target = FRIENDS_DIR / f"{user_id}.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=84, method=6)
    return target.stat().st_size


def rewrite_row(row: str, info: dict) -> str:
    name = html.escape(info["username"])
    row = re.sub(r"manufacturers_id=\d+", f"manufacturers_id={info['creator_id']}", row, count=1)
    row = re.sub(r'src="assets/friends/[^"]+"', f'src="assets/friends/{info["id"]}.webp"', row, count=1)
    row = re.sub(
        r'aria-label="Shop [^"]*"',
        f'aria-label="Shop {name} on IMVU, opens in a new tab"',
        row,
        count=1,
    )
    row = re.sub(
        r'(<span class="friend__name">).*?(</span>)',
        lambda match: match.group(1) + name + match.group(2),
        row,
        count=1,
        flags=re.DOTALL,
    )
    return row


def main() -> int:
    markup = INDEX.read_text(encoding="utf-8")
    ids = list(dict.fromkeys(ROW.findall(markup)))
    if not ids:
        print('no friends rows with data-imvu-id found in index.html', file=sys.stderr)
        return 1

    manifest = load_manifest()
    found: dict[str, dict] = {}
    failures: list[str] = []

    for user_id in ids:
        try:
            info = look_up(user_id)
            target = FRIENDS_DIR / f"{user_id}.webp"
            recorded = manifest.get(user_id, {})
            if target.exists() and recorded.get("thumbnail") == info["thumbnail"]:
                size = target.stat().st_size
                note = "unchanged"
            else:
                size = write_portrait(user_id, info["thumbnail"])
                note = "updated"
            manifest[user_id] = {
                "thumbnail": info["thumbnail"],
                "username": info["username"],
                "creator_id": info["creator_id"],
            }
        except Exception as error:  # noqa: BLE001 - report and keep the shipped row
            failures.append(f"{user_id}: {error}")
            print(f"  {user_id}: FAILED - {error}", file=sys.stderr)
            continue
        found[user_id] = info
        print(f"  {user_id}: {info['username']} cid {info['creator_id']} portrait {size} B ({note})")

    if found:
        updated = ROW.sub(
            lambda row: rewrite_row(row.group(0), found[row.group(1)]) if row.group(1) in found else row.group(0),
            markup,
        )
        if updated != markup:
            INDEX.write_text(updated, encoding="utf-8")
    save_manifest(manifest)

    if failures:
        print(f"{len(failures)} of {len(ids)} lookups failed", file=sys.stderr)
        return 1
    print(f"friends refreshed ({len(found)}/{len(ids)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

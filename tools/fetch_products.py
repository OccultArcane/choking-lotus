#!/usr/bin/env python3
"""Rebuild the product snapshot from the Choking Lotus IMVU store.

The orbit's fallback list (`js/products.js`) and its thumbnails are generated
from the store's own listing, sorted "Newest Products" — the gafcodes panel the
page embeds lags behind it, so the store page is the source of truth.

    python tools/fetch_products.py          # refresh the newest 8
    python tools/fetch_products.py --count 6

Writes `js/products.js` and `assets/products/NN-<id>.jpg`, and deletes any
thumbnail no longer in the list. Standard library only.
"""

from __future__ import annotations

import argparse
import html
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORE_ID = "272737258"
LISTING = f"https://www.imvu.com/shop/web_search.php?manufacturers_id={STORE_ID}&sort=id&sortorder=desc"
PRODUCT_URL = "https://www.imvu.com/shop/product.php?products_id={id}"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

PRODUCTS_JS = ROOT / "js" / "products.js"
THUMB_DIR = ROOT / "assets" / "products"

BLOCK = re.compile(r'<div class="widget-product-wide[^"]*"\s+id="(\d+)"(.*?)(?=<div class="widget-product-wide|</div>\s*<div class="pagenav bottom")', re.S)
TITLE = re.compile(r'<h3 class="title[^"]*">.*?<a [^>]*title="([^"]*)"', re.S)
THUMB = re.compile(r'<img src="([^"]+)" class="thumbnail"')
PRICE = re.compile(r'<span class="price"><span[^>]*>([\d,]+)</span>')


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def clean_name(raw: str) -> str:
    # Titles are prefixed with a decorative glyph ("✱ split+undercut").
    return re.sub(r"^[^\w]+", "", html.unescape(raw)).strip()


def parse(page: str, count: int) -> list[dict]:
    products = []
    for product_id, rest in BLOCK.findall(page):
        title = TITLE.search(rest)
        image = THUMB.search(rest)
        price = PRICE.search(rest)
        if not title or not image:
            continue
        products.append({
            "id": product_id,
            "name": clean_name(title.group(1)),
            "img": image.group(1),
            "url": PRODUCT_URL.format(id=product_id),
            "price": int(price.group(1).replace(",", "")) if price else None,
        })
        if len(products) == count:
            break
    return products


def download(products: list[dict]) -> list[dict]:
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    for index, product in enumerate(products, start=1):
        path = THUMB_DIR / f"{index:02d}-{product['id']}.jpg"
        data = fetch(product["img"])
        if data[:2] != b"\xff\xd8":
            raise SystemExit(f"not a JPEG: {product['img']}")
        if path.exists() and path.read_bytes() == data:
            print(f"  kept    {path.name}")
        else:
            path.write_bytes(data)
            print(f"  saved   {path.name}")
        product["img"] = path.relative_to(ROOT).as_posix()

    keep = {Path(product["img"]).name for product in products}
    for stale in sorted(THUMB_DIR.glob("*.jpg")):
        if stale.name not in keep:
            stale.unlink()
            print(f"  removed {stale.name}")
    return products


def write_module(products: list[dict]) -> None:
    lines = [
        '/* Snapshot of the Choking Lotus IMVU store, newest products first.',
        f'   Source: {LISTING}',
        f'   Store:  https://www.imvu.com/shop/web_search.php?manufacturers_id={STORE_ID}',
        '   Regenerate with: python tools/fetch_products.py',
        f'   {len(products)} products, newest first. */',
        'window.CHOKING_LOTUS_PRODUCTS = [',
    ]
    rows = [
        '  {{ id: "{id}", name: "{name}", img: "{img}", url: "{url}", price: {price} }}'.format(
            id=product["id"],
            name=product["name"].replace('"', '\\"'),
            img=product["img"],
            url=product["url"],
            price=product["price"] if product["price"] is not None else "null",
        )
        for product in products
    ]
    lines.append(",\n".join(rows))
    lines.append("];")
    # LF, like the committed blob: the scheduled job runs on Linux, where a CRLF
    # file would read as a full rewrite and commit the same thing every night.
    PRODUCTS_JS.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--count", type=int, default=8, help="how many products to keep (default 8)")
    args = parser.parse_args()

    page = fetch(LISTING).decode("utf-8", "replace")
    products = parse(page, args.count)
    if len(products) < args.count:
        raise SystemExit(f"only found {len(products)} products on the listing")

    print(f"newest {len(products)} products from the store:")
    for product in products:
        print(f"  {product['id']}  {product['name']}  ({product['price']})")

    products = download(products)
    write_module(products)
    print(f"wrote {PRODUCTS_JS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

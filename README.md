# Choking Lotus

Single-screen launch page for **Choking Lotus**, an IMVU atelier. A chrome lotus sits at the centre of a liquid ripple, and the store's newest products orbit it as translucent cards. No scrolling, no sections — just the emblem, the drop, the legal line and a typing credit.

**Live (Freebuff):** https://site-65cbd85114804424ab593402b137206b.freebuff.page
**Live (GitHub Pages):** https://occultarcane.github.io/choking-lotus/

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The whole page: backdrop layers, orbit markup, Instagram mark, legal strip, credit notice. |
| `css/style.css` | Every rule the page uses — backdrop, orbit mechanics, cards, fluid sizing, reduced-motion handling. |
| `js/main.js` | Builds the orbit cards, runs the cursor/parallax atmosphere and types the credit notice. |
| `js/products.js` | Snapshot of the IMVU feed (titles, thumbnails, prices) used as the fallback when the live panel is blocked. |
| `assets/` | `lotus.webp`, `liquid-swirl.webp` and the product thumbnails. |
| `footer-note.txt` | Text typed into the popup. Edit this file to change the message; no code change needed. |
| `sites/` | Deploy glue: build script, manifest, asset worker, wrangler config. |

Product cards refresh themselves: `#imvu-feed-source` loads the gafcodes "new products" panel for the store, and `main.js` reads the rendered links back into the orbit, so new drops appear on reload.

The layout is a single composition, not a desktop one plus a mobile one. Everything inside the orbit is sized from `--size`, and `--size` itself is capped by window height (`74vh`), window width (`80vw`) and the room left by the credit notice and legal strip, so the page scales continuously at any window size without breakpoints.

## Local preview

The page is static — serve the folder and open it:

```bash
python -m http.server 4173
# or
npx serve .
```

Then open <http://localhost:4173>.

## Deploy

`dist/` is the only deploy root. The build script copies the site files into it; nothing else is ever published.

```bash
node sites/build.mjs
npx wrangler dev --config sites/wrangler.jsonc --port 8788   # verify in workerd
```

- **Freebuff Sites** — deploy with `sites/manifest.json` (`assetsDirectory: ../dist`).
- **GitHub Pages** — automatic. Every push to `main` runs `.github/workflows/deploy.yml`, which rebuilds `dist/` and publishes it. No secrets needed; it uses the built-in token.

Asset paths are relative so the same build works at a domain root and under `/choking-lotus/`.

## Rollback

`git tag pre-cleanup` marks the earlier multi-section version of the page (hidden sections, full CSS, nine static cards). To go back:

```bash
git checkout pre-cleanup -- index.html css js assets
```

## Credits

Page designed and coded by xr™.

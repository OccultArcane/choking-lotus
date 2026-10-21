# Choking Lotus — launch page

Single-page launch site for **Choking Lotus**, an IMVU atelier. A black-chrome lotus emblem sits at the centre of a liquid ripple; the store's newest products orbit it as floating relic cards, and the whole page is built to sit in one viewport with no scroll.

**Live:** https://site-65cbd85114804424ab593402b137206b.freebuff.page

## What's in it

- `index.html` — the page. Header, hero (orbit + emblem), and the footer legal strip with the typewriter credit notice.
- `css/style.css` — the visual system: liquid backdrop, chrome type, orbit mechanics, translucent cards, responsive layout.
- `js/main.js` — interactions: orbit placement, live product feed read-back, typewriter notice, cursor, menu, magnetic buttons.
- `js/products.js` — snapshot of the IMVU feed (titles, thumbnails, prices) used as the fallback and for price data.
- `assets/` — lotus emblem, liquid backdrop, product thumbnails and card art.
- `footer-note.txt` — the credit line typed into the popup. Edit this file to change the message; no code change needed.

Product cards refresh themselves: `#imvu-feed-source` loads the gafcodes "new products" panel for the store, and `main.js` reads the rendered links back into the orbit, so new drops appear on reload.

## Local development

The site is static — any static server works:

```bash
npx serve .
# or
python -m http.server 4173
```

Then open <http://localhost:4173>.

## Deploy

The deployable output is assembled into `dist/` and served by a tiny asset worker so 404s and the page fallback behave correctly.

```bash
node sites/build.mjs          # copy index.html, css, js, assets, footer-note.txt into dist/
npx wrangler dev --config sites/wrangler.jsonc --port 8788
```

Publish with the manifest in `sites/manifest.json` (`assetsDirectory: ../dist`).

Keeping `dist/` as the only deploy root matters: the workspace also holds screenshots and tooling under `.dev-artifacts/`, which are ignored and must not be bundled.

### GitHub Pages

Every push to `main` runs `.github/workflows/deploy.yml`: it rebuilds `dist/` and publishes it to GitHub Pages. No secrets are needed — the workflow uses the built-in `GITHUB_TOKEN` and the `github-pages` environment.

**Pages:** https://occultarcane.github.io/choking-lotus/

Because that URL is nested under the repository name, every asset reference in the HTML and the product snapshot is relative (`css/…`, `assets/…`, `js/…`) rather than root-absolute, so the same build works on Pages and on a root domain.

## Credits

Page designed and coded by xr™.

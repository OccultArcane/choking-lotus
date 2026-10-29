/* Choking Lotus launch page — static asset worker plus one small JSON route.
   Everything on the site is prebuilt in ./dist; the worker serves it and
   proxies the friends lookup that the browser cannot call itself. */

const ASSET_PATH = /^\/(assets|css|js)\//;
const FILE_EXT = /\.[a-z0-9]{2,5}$/i;
const FRIENDS_PATH = '/api/friends';
const UPSTREAM = 'https://api.imvu.com/user/user-';
const USER_ID = /^\d{1,12}$/;
const MAX_IDS = 12;

const PRODUCTS_PATH = '/api/products';
const STORE_LISTING = 'https://www.imvu.com/shop/web_search.php?manufacturers_id=272737258&sort=id&sortorder=desc';
const SNAPSHOT_PATH = '/assets/products/snapshot.json';
// Edge cache key for the parsed listing. A path the site does not serve keeps
// it from colliding with anything cached for the page itself.
const LISTING_CACHE_PATH = '/api/products-listing';
const PRODUCT_LIMIT = 8;
const PRODUCT_URL = 'https://www.imvu.com/shop/product.php?products_id=';

function json(body, status, maxAge) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

/* api.imvu.com sends no Access-Control-Allow-Origin header, so the page cannot
   read it directly on any host. This route is same-origin with the page, so the
   Freebuff deployment can refresh names and portraits on every load instead of
   waiting for a rebuild; GitHub Pages keeps using the copy committed to the
   repo, and this route simply 404s there. */
async function friends(url) {
  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => USER_ID.test(id))
    .slice(0, MAX_IDS);

  if (!ids.length) return json({ error: 'ids required' }, 400, 0);

  const found = await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await fetch(`${UPSTREAM}${id}`, {
          headers: { accept: 'application/json', 'user-agent': 'choking-lotus-site/1.0' },
          signal: AbortSignal.timeout(6000)
        });
        if (!response.ok) return null;

        const payload = await response.json();
        const record = payload?.denormalized?.[`${UPSTREAM}${id}`] ?? Object.values(payload?.denormalized ?? {})[0];
        const data = record?.data;
        if (!data || typeof data.username !== 'string') return null;

        const portrait = typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '';
        const username = data.username.trim().slice(0, 40);
        if (!username || !/^https:\/\//.test(portrait)) return null;

        return {
          id,
          username,
          portrait,
          creatorId: Number(data.legacy_cid) || Number(id)
        };
      } catch {
        return null;
      }
    })
  );

  const list = found.filter(Boolean);
  if (!list.length) return json({ error: 'lookup failed' }, 502, 0);
  return json({ friends: list }, 200, 300);
}

/* The page ships a product snapshot, but the store moves on between deploys.
   The listing is server-rendered HTML with no CORS header, so this route reads
   it on the server and returns just the cards the orbit needs, which keeps the
   Freebuff deployment current without a redeploy. GitHub Pages has no route and
   keeps using the committed snapshot. */
const ENTITIES = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' };
const decode = (value) => value
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&(quot|apos|lt|gt|amp);/g, (_, name) => ENTITIES[name]);

function productsFromListing(html) {
  const products = [];
  const blocks = html.split('<div class="widget-product-wide').slice(1);

  for (const block of blocks) {
    const id = /\sid="(\d{5,})"/.exec(block)?.[1];
    const title = /<h3 class="title[^"]*">[\s\S]*?<a [^>]*title="([^"]*)"/.exec(block)?.[1];
    const image = /<img src="([^"]+)" class="thumbnail"/.exec(block)?.[1];
    const price = /<span class="price"><span[^>]*>([\d,]+)<\/span>/.exec(block)?.[1];
    if (!id || !title || !image) continue;

    products.push({
      id,
      name: decode(title).replace(/^[^\w]+/, '').trim(),
      img: decode(image),
      url: `${PRODUCT_URL}${id}`,
      price: price ? Number(price.replace(/,/g, '')) : null
    });
    if (products.length === PRODUCT_LIMIT) break;
  }

  return products;
}

async function snapshotProducts(env, request) {
  try {
    const response = await env.ASSETS.fetch(new URL(SNAPSHOT_PATH, request.url));
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.products) ? payload.products : [];
  } catch {
    return [];
  }
}

// Copy a response with its cache tag replaced, so a hit is visible without
// changing the body.
function tag(response, value) {
  const headers = new Headers(response.headers);
  headers.set('x-lotus-cache', value);
  return new Response(response.body, { status: response.status, headers });
}

async function products(env, request, ctx) {
  const cache = caches.default;
  const key = new Request(new URL(LISTING_CACHE_PATH, request.url));
  let cached = null;
  try {
    cached = await cache.match(key);
  } catch {
    // A broken cache must not break the route; fall through to the store.
  }
  if (cached) return tag(cached, 'hit');

  let list = [];
  try {
    const response = await fetch(STORE_LISTING, {
      headers: {
        accept: 'text/html',
        'accept-language': 'en',
        'user-agent': 'Mozilla/5.0 (compatible; choking-lotus-site/1.0)'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (response.ok) list = productsFromListing(await response.text());
  } catch {
    // Fall through to the snapshot.
  }
  if (list.length) {
    // max-age governs both the browser and this edge entry, so the store is
    // read once per colo per five minutes rather than once per visitor.
    const response = tag(json({ products: list, source: 'store' }, 200, 300), 'miss');
    ctx.waitUntil(cache.put(key, response.clone()).catch(() => {}));
    return response;
  }

  // IMVU unreachable or the listing changed shape: keep the orbit filled with
  // the committed snapshot, and try the store again after a minute. The
  // fallback is not cached, so recovery is immediate.
  const fallback = await snapshotProducts(env, request);
  if (fallback.length) return json({ products: fallback, source: 'snapshot' }, 200, 60);
  return json({ error: 'listing unavailable' }, 502, 0);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD' }
      });
    }

    if (url.pathname === FRIENDS_PATH) {
      return request.method === 'HEAD' ? new Response(null, { status: 200 }) : friends(url);
    }

    if (url.pathname === PRODUCTS_PATH) {
      return request.method === 'HEAD' ? new Response(null, { status: 200 }) : products(env, request, ctx);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    // Missing asset or file-like path: return a real 404 instead of the page shell.
    if (ASSET_PATH.test(url.pathname) || FILE_EXT.test(url.pathname)) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }

    // No nested routes exist, and asset links are relative, so send any other
    // path back to the single page instead of serving the shell from a subpath.
    return Response.redirect(new URL('/', url).toString(), 302);
  }
};

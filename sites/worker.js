/* Choking Lotus launch page — static asset worker plus one small JSON route.
   Everything on the site is prebuilt in ./dist; the worker serves it and
   proxies the friends lookup that the browser cannot call itself. */

const ASSET_PATH = /^\/(assets|css|js)\//;
const FILE_EXT = /\.[a-z0-9]{2,5}$/i;
const FRIENDS_PATH = '/api/friends';
const UPSTREAM = 'https://api.imvu.com/user/user-';
const USER_ID = /^\d{1,12}$/;
const MAX_IDS = 12;

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

export default {
  async fetch(request, env) {
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

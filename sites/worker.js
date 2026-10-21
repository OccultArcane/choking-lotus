/* Choking Lotus launch page — static asset worker.
   Everything on the site is prebuilt in ./dist; the worker only serves it. */

const ASSET_PATH = /^\/(assets|css|js)\//;
const FILE_EXT = /\.[a-z0-9]{2,5}$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD' }
      });
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

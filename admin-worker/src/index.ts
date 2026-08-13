// Cloudflare Worker for admin.palengkehub.site
// Proxies requests to the React admin app deployed on Cloudflare Pages.

const PAGES_URL = 'https://palengkehub-admin.pages.dev';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Strip query parameters — prevents credentials from showing in the URL bar
    if (url.search && url.search.length > 0) {
      return Response.redirect(url.origin + url.pathname, 302);
    }

    // Redirect root to admin login page (React app served under /admin)
    if (url.pathname === '/' || url.pathname === '') {
      return Response.redirect('https://admin.palengkehub.site/admin/admin-login', 302);
    }

    // Proxy all requests to the React app on Cloudflare Pages
    // The React app handles routing client-side (react-router-dom)
    const targetUrl = PAGES_URL + url.pathname + url.search;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    // Return the response from Pages — pass through all headers
    const newHeaders = new Headers();
    response.headers.forEach((value, key) => {
      newHeaders.set(key, value);
    });
    newHeaders.set('Cache-Control', 'no-store');
    newHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
// Cloudflare Worker for admin.palengkehub.site
// Fetches admin-login.html from the main site and rewrites asset paths
// so CSS/images load correctly on the subdomain.

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Strip query parameters — prevents credentials from showing in the URL bar
    // (e.g. if the form submits via GET fallback, redirect to clean URL)
    if (url.search && url.search.length > 0) {
      return Response.redirect(url.origin + url.pathname, 302);
    }

    // Fetch the actual admin-login.html from the main site
    const response = await fetch('https://palengkehub.site/admin-login.html', {
      headers: { 'User-Agent': 'Cloudflare-Admin-Worker/1.0' },
    });

    if (!response.ok) {
      return new Response('Admin page temporarily unavailable', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    let html = await response.text();

    // Rewrite relative asset paths to absolute URLs pointing to the main site
    // so CSS (style.css, pages.css) and images (palengkehublogo.jpg) load correctly
    html = html.replace(/href="(style\.css|pages\.css)"/g, 'href="https://palengkehub.site/$1"');
    html = html.replace(/src="([^"]+\.(jpg|png|svg|gif|ico))"/g, 'src="https://palengkehub.site/$1"');

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
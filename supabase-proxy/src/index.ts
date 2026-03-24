// ============================================
// Supabase Reverse Proxy — Cloudflare Worker
// Simplified version - HTTP only
// ============================================

// --- Config ---
const SUPABASE_URL = "https://qpmauvmhrdlpbbbaevk.supabase.co";
const ALLOWED_ORIGINS = "*";
const ENABLED_SERVICES = ['rest', 'auth', 'storage'];

// --- CORS ---
function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS === '*') return true;
  const allowed = ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return allowed.includes(origin);
}

function handlePreflight(request: Request): Response {
  const origin = request.headers.get('Origin') || '*';
  const headers = new Headers();

  if (isOriginAllowed(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');
    headers.set('Access-Control-Max-Age', '86400');
  }

  return new Response(null, { status: 204, headers });
}

function addCorsHeaders(responseHeaders: Headers, request: Request): void {
  const origin = request.headers.get('Origin');
  if (origin && isOriginAllowed(origin)) {
    responseHeaders.set('Access-Control-Allow-Origin', origin);
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');
  }
}

// --- HTTP Proxy ---
async function handleHttpProxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Build upstream URL
  const upstreamUrl = new URL(SUPABASE_URL);
  upstreamUrl.pathname = url.pathname;
  upstreamUrl.search = url.search;

  // Clone headers
  const headers = new Headers(request.headers);
  headers.set('Host', upstreamUrl.hostname);
  
  // Remove CF headers
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');
  headers.delete('cf-ipcountry');

  try {
    // Forward request
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    // Clone response headers
    const responseHeaders = new Headers(upstreamResponse.headers);
    
    // Add CORS headers
    addCorsHeaders(responseHeaders, request);
    
    // Add proxy identifier
    responseHeaders.set('X-Proxied-By', 'JioBase');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return Response.json({ error: 'Failed to connect to upstream' }, { status: 502 });
  }
}

// --- Main handler ---
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/__health') {
      return Response.json({ status: 'ok', service: 'supabase-proxy' });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handlePreflight(request);
    }

    // HTTP proxy only (no WebSocket)
    return handleHttpProxy(request);
  },
};
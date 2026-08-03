// ============================================
// Supabase Reverse Proxy — Cloudflare Worker
// Simplified version - HTTP only
// ============================================

// --- Config ---
const SUPABASE_URL = "https://qpmauvmhrdlpbbbaevk.supabase.co";
const ALLOWED_ORIGINS: string = "*";
const ENABLED_SERVICES = ['rest', 'auth', 'storage'];

// --- Types ---
interface PaymongoSourcePayload {
  amount?: number | string;
  currency?: string;
  type?: string;
  success_url?: string;
  failed_url?: string;
  description?: string;
}

interface IprogSmsPayload {
  phone_number?: string;
  sender_name?: string;
}

interface ResendEmailPayload {
  email?: string;
  sender_name?: string;
  from?: string;
}

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

async function handlePaymongoCreateSource(request: Request, env: any): Promise<Response> {
  const secretKey = env.PAYMONGO_SECRET_KEY || '';
  if (!secretKey) {
    return Response.json({ error: 'PAYMONGO_SECRET_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await request.json() as PaymongoSourcePayload;
    const {
      amount,
      currency = 'PHP',
      type = 'gcash',
      success_url,
      failed_url,
      description,
    } = body;

    if (!amount || !success_url || !failed_url) {
      return Response.json({ error: 'Missing required paymongo payload fields' }, { status: 400 });
    }

    const payload = {
      data: {
        attributes: {
          amount,
          currency,
          type,
          redirect: {
            success: success_url,
            failed: failed_url,
          },
          description: description || 'PayMongo payment for PalengkeHub order',
        },
      },
    };

    const response = await fetch('https://api.paymongo.com/v1/sources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const responseHeaders = new Headers();
    addCorsHeaders(responseHeaders, request);
    responseHeaders.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('PayMongo create source error:', error);
    return Response.json({ error: 'Failed to create PayMongo source' }, { status: 502 });
  }
}

// Philippine mobile network prefix detection
// Smart/TNT/Sun prefixes (iProgSMS has poor delivery to these networks)
const SMART_TNT_SUN_PREFIXES = new Set([
  '813', '907', '908', '909', '910', '912', '913', '914', '918', '919',
  '920', '921', '928', '929', '930', '938', '939', '940', '946', '947',
  '948', '949', '950', '951', '961', '963', '968', '969', '970', '981',
  '982', '983', '984', '985', '986', '987', '988', '989', '992', '993',
  '994', '995', '996', '997', '998', '999',
  '903', '904', '905', '906', '911', '923', '924', '925', '926', '927',
  '931', '932', '933', '934', '935', '936', '937', '941', '942', '943',
  '944', '945', '952', '953', '954', '955', '956', '957', '958', '959',
  '960', '962', '964', '965', '966', '967', '971', '972', '973', '974',
  '975', '976', '977', '978', '979', '980', '990', '991',
  '922', // Sun
]);

function isSmartTntSunNumber(phone: string): boolean {
  // Normalize: remove +, spaces, dashes
  const normalized = phone.replace(/[+\s-]/g, '');
  // PH numbers are 12 digits: 63XXXXXXXXXX
  if (normalized.length === 12 && normalized.startsWith('63')) {
    const prefix = normalized.slice(2, 5); // 3-digit prefix after 63
    return SMART_TNT_SUN_PREFIXES.has(prefix);
  }
  // Local format: 0XXXXXXXXXX (11 digits)
  if (normalized.length === 11 && normalized.startsWith('0')) {
    const prefix = normalized.slice(1, 4);
    return SMART_TNT_SUN_PREFIXES.has(prefix);
  }
  return false;
}

async function handleIprogSendAuthenticatorSms(request: Request, env: any): Promise<Response> {
  const apiToken = env.IPROG_API_TOKEN || '';
  const semaphoreApiKey = env.SEMAPHORE_API_KEY || '';
  const semaphoreSenderName = env.SEMAPHORE_SENDER_NAME || '';

  try {
    const body = await request.json() as IprogSmsPayload;
    const { phone_number, sender_name } = body;

    if (!phone_number) {
      return Response.json({ error: 'Missing phone_number' }, { status: 400 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const shortMessage = `PalengkeHub OTP: ${code}. Valid for 5 minutes. Do not share this code.`;

    const responseHeaders = new Headers();
    addCorsHeaders(responseHeaders, request);
    responseHeaders.set('Content-Type', 'application/json');

    // ── Network detection ──────────────────────────────────────────────────
    // iProgSMS has poor/zero delivery to Smart/TNT/Sun numbers.
    // Route those directly to Semaphore (supports ALL PH networks).
    const isSmartTnt = isSmartTntSunNumber(phone_number);
    console.log(`📱 Phone ${phone_number} → ${isSmartTnt ? 'Smart/TNT/Sun (Semaphore)' : 'Globe/TM (iProgSMS)'}`);

    // ── 1) Smart/TNT/Sun → Semaphore directly ──────────────────────────────
    if (isSmartTnt && semaphoreApiKey) {
      try {
        const semaphoreParams = new URLSearchParams();
        semaphoreParams.append('apikey', semaphoreApiKey);
        semaphoreParams.append('number', phone_number);
        semaphoreParams.append('message', shortMessage);
        // Only include sendername if configured in env (Semaphore requires a registered sender name)
        if (semaphoreSenderName) {
          semaphoreParams.append('sendername', semaphoreSenderName.slice(0, 11));
        }

        const response = await fetch('https://api.semaphore.co/api/v4/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: semaphoreParams.toString(),
        });

        const data = await response.json() as Record<string, unknown>;

        if (response.ok) {
          return new Response(JSON.stringify({
            provider: 'semaphore',
            ...data,
            verification_code: code,
            expires_in_minutes: 5,
          }), {
            status: 200,
            headers: responseHeaders,
          });
        }

        console.error('Semaphore failed for Smart/TNT number:', data);
        return new Response(JSON.stringify({
          error: 'SMS delivery failed via Semaphore',
          details: data,
          verification_code: code,
          expires_in_minutes: 5,
        }), {
          status: 502,
          headers: responseHeaders,
        });
      } catch (error) {
        console.error('Semaphore error for Smart/TNT number:', error);
        return new Response(JSON.stringify({
          error: 'SMS delivery failed: Semaphore error',
          verification_code: code,
          expires_in_minutes: 5,
        }), {
          status: 502,
          headers: responseHeaders,
        });
      }
    }

    // ── 2) Globe/TM → iProgSMS first, fallback to Semaphore ────────────────
    if (apiToken) {
      try {
        const params = new URLSearchParams();
        params.append('api_token', apiToken);
        params.append('phone_number', phone_number);
        params.append('message', shortMessage);
        params.append('sender_name', sender_name || 'PalengkeHub');

        const response = await fetch('https://www.iprogsms.com/api/v1/sms_messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const data = await response.json() as Record<string, unknown>;

        if (response.ok) {
          return new Response(JSON.stringify({
            provider: 'iprogsms',
            ...data,
            verification_code: code,
            expires_in_minutes: 5,
          }), {
            status: 200,
            headers: responseHeaders,
          });
        }

        console.warn('iProgSMS rejected, falling back to Semaphore:', data);
      } catch (error) {
        console.warn('iProgSMS error, falling back to Semaphore:', error);
      }
    }

    // ── 3) Fallback: Semaphore (for Globe/TM if iProgSMS fails) ────────────
    if (semaphoreApiKey) {
      try {
        const semaphoreParams = new URLSearchParams();
        semaphoreParams.append('apikey', semaphoreApiKey);
        semaphoreParams.append('number', phone_number);
        semaphoreParams.append('message', shortMessage);
        // Only include sendername if configured in env (Semaphore requires a registered sender name)
        if (semaphoreSenderName) {
          semaphoreParams.append('sendername', semaphoreSenderName.slice(0, 11));
        }

        const response = await fetch('https://api.semaphore.co/api/v4/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: semaphoreParams.toString(),
        });

        const data = await response.json() as Record<string, unknown>;

        if (response.ok) {
          return new Response(JSON.stringify({
            provider: 'semaphore',
            ...data,
            verification_code: code,
            expires_in_minutes: 5,
          }), {
            status: 200,
            headers: responseHeaders,
          });
        }

        console.error('Semaphore also failed:', data);
        return new Response(JSON.stringify({
          error: 'SMS delivery failed via both providers',
          details: data,
          verification_code: code,
          expires_in_minutes: 5,
        }), {
          status: 502,
          headers: responseHeaders,
        });
      } catch (error) {
        console.error('Semaphore error:', error);
        return new Response(JSON.stringify({
          error: 'SMS delivery failed: Semaphore error',
          verification_code: code,
          expires_in_minutes: 5,
        }), {
          status: 502,
          headers: responseHeaders,
        });
      }
    }

    // No provider configured
    return new Response(JSON.stringify({
      error: 'No SMS provider configured (need IPROG_API_TOKEN or SEMAPHORE_API_KEY)',
      verification_code: code,
      expires_in_minutes: 5,
    }), {
      status: 500,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Authenticator SMS send error:', error);
    return Response.json({ error: 'Failed to send authenticator SMS' }, { status: 502 });
  }
}

async function handleResendAuthenticatorEmail(request: Request, env: any): Promise<Response> {
  const apiKey = env.RESEND_API_KEY || '';
  const emailjsServiceId = env.EMAILJS_SERVICE_ID || '';
  const emailjsTemplateId = env.EMAILJS_TEMPLATE_ID || '';
  const emailjsPublicKey = env.EMAILJS_PUBLIC_KEY || '';
  const emailjsPrivateKey = env.EMAILJS_PRIVATE_KEY || '';

  try {
    const body = await request.json() as ResendEmailPayload;
    const { email, sender_name } = body;
    // Sender can be overridden via env var (RESEND_FROM_EMAIL) after domain verification
    const from = env.RESEND_FROM_EMAIL || body.from || 'onboarding@resend.dev';

    if (!email) {
      return Response.json({ error: 'Missing email' }, { status: 400 });
    }

    // Generate a 6-digit code (same format as iProg SMS)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const displayName = sender_name || 'PalengkeHub';
    const expiresInMinutes = 5;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #fde8e8;">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="background:linear-gradient(135deg,#DC2626,#EF4444,#F87171);padding:28px 24px;">
                      <span style="font-size:36px;">🛒</span>
                      <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">PalengkeHub</h1>
                      <p style="margin:4px 0 0;font-size:13px;color:#fee2e2;">Lipa City Public Market</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:32px 28px;">
                      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">Verify your email</h2>
                      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
                        Hello! Use the code below to verify your email address and activate your ${displayName} account.
                      </p>
                      <!-- Code Box -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                        <tr>
                          <td align="center" style="background-color:#fef2f2;border:2px dashed #fca5a5;border-radius:12px;padding:20px;">
                            <span style="font-size:32px;font-weight:800;letter-spacing:12px;color:#DC2626;">${code}</span>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#374151;">
                        <strong>⏳ This code is valid for ${expiresInMinutes} minutes.</strong>
                      </p>
                      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b7280;">
                        If you didn't request this code, you can safely ignore this email.
                      </p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="background-color:#f9fafb;border-radius:8px;padding:12px;">
                            <span style="font-size:12px;color:#9ca3af;">This is an automated message. Do not reply to this email.</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const plainText = `PalengkeHub Verification\n\nYour verification code is: ${code}\n\nThis code is valid for ${expiresInMinutes} minutes. Do not share this code with anyone.\n\nIf you did not request this, please ignore this message.`;

    const payload = {
      from,
      to: [email],
      subject: `Your PalengkeHub verification code: ${code}`,
      html,
      text: plainText,
    };

    const responseHeaders = new Headers();
    addCorsHeaders(responseHeaders, request);
    responseHeaders.set('Content-Type', 'application/json');

    // Common success format for both providers
    const successBody = (provider: string, data: Record<string, unknown>) => JSON.stringify({
      provider,
      ...data,
      verification_code: code,
      expires_in_minutes: expiresInMinutes,
    });

    // 1) Try Resend first (works after you verify a domain)
    if (apiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json() as Record<string, unknown>;

        // Resend returns 2xx if accepted. 422 is common on the free trial when
        // no domain is verified (delivery restricted to delivered@resend.dev).
        if (response.ok) {
          return new Response(successBody('resend', data), {
            status: 200,
            headers: responseHeaders,
          });
        }

        console.warn('Resend rejected email, falling back to EmailJS:', data);
      } catch (error) {
        console.warn('Resend error, falling back to EmailJS:', error);
      }
    }

    // 2) Fallback: EmailJS (delivery via your connected Gmail — no domain needed)
    if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey) {
      try {
        const templateParams = {
          to_email: email,
          from_name: displayName,
          otp_code: code,
          expires_minutes: String(expiresInMinutes),
          subject: `Your PalengkeHub verification code: ${code}`,
          message: `Your PalengkeHub verification code is: ${code}`,
          // NOTE: Do NOT pass the full HTML document as a template param.
          // The EmailJS template already contains the full HTML design
          // (header, code box, footer). If you add `{{email_html}}` to the
          // template content, the entire HTML source gets dumped into the
          // email body as raw text.
        };

        const emailjsPayload: Record<string, unknown> = {
          service_id: emailjsServiceId,
          template_id: emailjsTemplateId,
          user_id: emailjsPublicKey,
          template_params: templateParams,
        };

        // Strict-mode accounts require the Private Key (accessToken) on the server side.
        if (emailjsPrivateKey) {
          emailjsPayload.accessToken = emailjsPrivateKey;
        }

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailjsPayload),
        });

        // EmailJS returns "OK" (text) or a 4xx/5xx with an error message
        const text = await response.text();

        if (response.ok) {
          return new Response(successBody('emailjs', { id: text }), {
            status: 200,
            headers: responseHeaders,
          });
        }

        console.error('EmailJS fallback failed:', response.status, text);
        return new Response(JSON.stringify({
          error: 'Email delivery failed via both providers',
          details: text,
          verification_code: code,
          expires_in_minutes: expiresInMinutes,
        }), {
          status: 502,
          headers: responseHeaders,
        });
      } catch (error) {
        console.error('EmailJS fallback error:', error);
        return new Response(JSON.stringify({
          error: 'Email delivery failed: EmailJS error',
          verification_code: code,
          expires_in_minutes: expiresInMinutes,
        }), {
          status: 502,
          headers: responseHeaders,
        });
      }
    }

    // No provider configured
    return new Response(JSON.stringify({
      error: 'No email provider configured (need RESEND_API_KEY or EmailJS credentials)',
      verification_code: code,
      expires_in_minutes: expiresInMinutes,
    }), {
      status: 500,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Resend/EmailJS authenticator email error:', error);
    return Response.json({ error: 'Failed to send authenticator email' }, { status: 502 });
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
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/__health') {
      return Response.json({ status: 'ok', service: 'supabase-proxy' });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handlePreflight(request);
    }

    if (url.pathname === '/paymongo/create-source' && request.method === 'POST') {
      return handlePaymongoCreateSource(request, env);
    }

    // PayMongo redirect endpoints — redirect back to the app's deep link
    if (url.pathname === '/paymongo/success') {
      return Response.redirect('palengkehub://paymongo/success', 302);
    }

    if (url.pathname === '/paymongo/failed') {
      return Response.redirect('palengkehub://paymongo/failed', 302);
    }

    if (url.pathname === '/iprog/send-authenticator-sms' && request.method === 'POST') {
      return handleIprogSendAuthenticatorSms(request, env);
    }

    if (url.pathname === '/resend/send-authenticator-email' && request.method === 'POST') {
      return handleResendAuthenticatorEmail(request, env);
    }

    // HTTP proxy only (no WebSocket)
    return handleHttpProxy(request);
  },
};
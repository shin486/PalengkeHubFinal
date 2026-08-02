var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var SUPABASE_URL = "https://qpmauvmhrdlpbbbaevk.supabase.co";
var ALLOWED_ORIGINS = "*";
function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS === "*")
    return true;
  const allowed = ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  return allowed.includes(origin);
}
__name(isOriginAllowed, "isOriginAllowed");
function handlePreflight(request) {
  const origin = request.headers.get("Origin") || "*";
  const headers = new Headers();
  if (isOriginAllowed(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "*");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(null, { status: 204, headers });
}
__name(handlePreflight, "handlePreflight");
function addCorsHeaders(responseHeaders, request) {
  const origin = request.headers.get("Origin");
  if (origin && isOriginAllowed(origin)) {
    responseHeaders.set("Access-Control-Allow-Origin", origin);
    responseHeaders.set("Access-Control-Allow-Credentials", "true");
  }
}
__name(addCorsHeaders, "addCorsHeaders");
async function handlePaymongoCreateSource(request, env) {
  const secretKey = env.PAYMONGO_SECRET_KEY || "";
  if (!secretKey) {
    return Response.json({ error: "PAYMONGO_SECRET_KEY not configured" }, { status: 500 });
  }
  try {
    const body = await request.json();
    const {
      amount,
      currency = "PHP",
      type = "gcash",
      success_url,
      failed_url,
      description
    } = body;
    if (!amount || !success_url || !failed_url) {
      return Response.json({ error: "Missing required paymongo payload fields" }, { status: 400 });
    }
    const payload = {
      data: {
        attributes: {
          amount,
          currency,
          type,
          redirect: {
            success: success_url,
            failed: failed_url
          },
          description: description || "PayMongo payment for PalengkeHub order"
        }
      }
    };
    const response = await fetch("https://api.paymongo.com/v1/sources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${secretKey}:`)}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    const responseHeaders = new Headers();
    addCorsHeaders(responseHeaders, request);
    responseHeaders.set("Content-Type", "application/json");
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("PayMongo create source error:", error);
    return Response.json({ error: "Failed to create PayMongo source" }, { status: 502 });
  }
}
__name(handlePaymongoCreateSource, "handlePaymongoCreateSource");
async function handleIprogSendAuthenticatorSms(request, env) {
  const apiToken = env.IPROG_API_TOKEN || "";
  if (!apiToken) {
    return Response.json({ error: "IPROG_API_TOKEN not configured" }, { status: 500 });
  }
  try {
    const body = await request.json();
    const { phone_number, sender_name } = body;
    if (!phone_number) {
      return Response.json({ error: "Missing phone_number" }, { status: 400 });
    }
    const code = String(Math.floor(1e5 + Math.random() * 9e5));
    const message = `Palengkehub Authentication
Phone number: ${phone_number}
Code: ${code}

This code will be valid only for 5 minutes. Do not share this code with anyone. If you did not request this, please ignore this message.`;
    const shortMessage = `PalengkeHub OTP: ${code}. Valid for 5 minutes. Do not share this code.`;
    const params = new URLSearchParams();
    params.append("api_token", apiToken);
    params.append("phone_number", phone_number);
    params.append("message", shortMessage);
    params.append("sender_name", sender_name || "PalengkeHub");
    const response = await fetch("https://www.iprogsms.com/api/v1/sms_messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const data = await response.json();
    const responseHeaders = new Headers();
    addCorsHeaders(responseHeaders, request);
    responseHeaders.set("Content-Type", "application/json");
    return new Response(JSON.stringify({
      ...data,
      verification_code: code,
      expires_in_minutes: 5
    }), {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("iPROG Authenticator SMS send error:", error);
    return Response.json({ error: "Failed to send authenticator SMS" }, { status: 502 });
  }
}
__name(handleIprogSendAuthenticatorSms, "handleIprogSendAuthenticatorSms");
async function handleResendAuthenticatorEmail(request, env) {
  const apiKey = env.RESEND_API_KEY || "";
  const emailjsServiceId = env.EMAILJS_SERVICE_ID || "";
  const emailjsTemplateId = env.EMAILJS_TEMPLATE_ID || "";
  const emailjsPublicKey = env.EMAILJS_PUBLIC_KEY || "";
  const emailjsPrivateKey = env.EMAILJS_PRIVATE_KEY || "";
  try {
    const body = await request.json();
    const { email, sender_name } = body;
    const from = env.RESEND_FROM_EMAIL || body.from || "onboarding@resend.dev";
    if (!email) {
      return Response.json({ error: "Missing email" }, { status: 400 });
    }
    const code = String(Math.floor(1e5 + Math.random() * 9e5));
    const displayName = sender_name || "PalengkeHub";
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
                      <span style="font-size:36px;">\u{1F6D2}</span>
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
                        <strong>\u23F3 This code is valid for ${expiresInMinutes} minutes.</strong>
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
    const plainText = `PalengkeHub Verification

Your verification code is: ${code}

This code is valid for ${expiresInMinutes} minutes. Do not share this code with anyone.

If you did not request this, please ignore this message.`;
    const payload = {
      from,
      to: [email],
      subject: `Your PalengkeHub verification code: ${code}`,
      html,
      text: plainText
    };
    const responseHeaders = new Headers();
    addCorsHeaders(responseHeaders, request);
    responseHeaders.set("Content-Type", "application/json");
    const successBody = /* @__PURE__ */ __name((provider, data) => JSON.stringify({
      provider,
      ...data,
      verification_code: code,
      expires_in_minutes: expiresInMinutes
    }), "successBody");
    if (apiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
          return new Response(successBody("resend", data), {
            status: 200,
            headers: responseHeaders
          });
        }
        console.warn("Resend rejected email, falling back to EmailJS:", data);
      } catch (error) {
        console.warn("Resend error, falling back to EmailJS:", error);
      }
    }
    if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey) {
      try {
        const templateParams = {
          to_email: email,
          from_name: displayName,
          otp_code: code,
          expires_minutes: String(expiresInMinutes),
          subject: `Your PalengkeHub verification code: ${code}`,
          message: `Your PalengkeHub verification code is: ${code}`
          // NOTE: Do NOT pass the full HTML document as a template param.
          // The EmailJS template already contains the full HTML design
          // (header, code box, footer). If you add `{{email_html}}` to the
          // template content, the entire HTML source gets dumped into the
          // email body as raw text.
        };
        const emailjsPayload = {
          service_id: emailjsServiceId,
          template_id: emailjsTemplateId,
          user_id: emailjsPublicKey,
          template_params: templateParams
        };
        if (emailjsPrivateKey) {
          emailjsPayload.accessToken = emailjsPrivateKey;
        }
        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(emailjsPayload)
        });
        const text = await response.text();
        if (response.ok) {
          return new Response(successBody("emailjs", { id: text }), {
            status: 200,
            headers: responseHeaders
          });
        }
        console.error("EmailJS fallback failed:", response.status, text);
        return new Response(JSON.stringify({
          error: "Email delivery failed via both providers",
          details: text,
          verification_code: code,
          expires_in_minutes: expiresInMinutes
        }), {
          status: 502,
          headers: responseHeaders
        });
      } catch (error) {
        console.error("EmailJS fallback error:", error);
        return new Response(JSON.stringify({
          error: "Email delivery failed: EmailJS error",
          verification_code: code,
          expires_in_minutes: expiresInMinutes
        }), {
          status: 502,
          headers: responseHeaders
        });
      }
    }
    return new Response(JSON.stringify({
      error: "No email provider configured (need RESEND_API_KEY or EmailJS credentials)",
      verification_code: code,
      expires_in_minutes: expiresInMinutes
    }), {
      status: 500,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("Resend/EmailJS authenticator email error:", error);
    return Response.json({ error: "Failed to send authenticator email" }, { status: 502 });
  }
}
__name(handleResendAuthenticatorEmail, "handleResendAuthenticatorEmail");
async function handleHttpProxy(request) {
  const url = new URL(request.url);
  const upstreamUrl = new URL(SUPABASE_URL);
  upstreamUrl.pathname = url.pathname;
  upstreamUrl.search = url.search;
  const headers = new Headers(request.headers);
  headers.set("Host", upstreamUrl.hostname);
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");
  headers.delete("cf-ipcountry");
  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : void 0
    });
    const responseHeaders = new Headers(upstreamResponse.headers);
    addCorsHeaders(responseHeaders, request);
    responseHeaders.set("X-Proxied-By", "JioBase");
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return Response.json({ error: "Failed to connect to upstream" }, { status: 502 });
  }
}
__name(handleHttpProxy, "handleHttpProxy");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/__health") {
      return Response.json({ status: "ok", service: "supabase-proxy" });
    }
    if (request.method === "OPTIONS") {
      return handlePreflight(request);
    }
    if (url.pathname === "/paymongo/create-source" && request.method === "POST") {
      return handlePaymongoCreateSource(request, env);
    }
    if (url.pathname === "/iprog/send-authenticator-sms" && request.method === "POST") {
      return handleIprogSendAuthenticatorSms(request, env);
    }
    if (url.pathname === "/resend/send-authenticator-email" && request.method === "POST") {
      return handleResendAuthenticatorEmail(request, env);
    }
    return handleHttpProxy(request);
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map

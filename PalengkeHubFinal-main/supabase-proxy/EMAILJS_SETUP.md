

# 📧 EmailJS Setup Guide — OTP Delivery to Your Real Inbox

Since you don't have a domain yet, this is how you get PalengkeHub verification codes
delivered to your **actual Gmail inbox** (or any email) using **EmailJS + your Gmail**.

> ⏱️ Takes about 5–10 minutes. Free tier = **200 emails/month** — plenty for development/testing.

---

## Step 1 — Create an EmailJS account

1. Go to **https://www.emailjs.com**
2. Click **Sign Up Free** and create an account (any email works — can be your Gmail).
3. Confirm your email address.

---

## Step 2 — Connect your Gmail (Email Service)

1. In the EmailJS dashboard, go to **Email Services** → click **Add New Service**.
2. Choose **Gmail** as the provider.
3. Follow the prompt to **sign in with Google** and choose the Gmail account you want to send from.
   - ⚠️ If you have **2-Step Verification on**, you must create an **App Password**:
     - Google Account → **Security** → **2-Step Verification** → **App Passwords**
     - Create one for "Mail" → paste it as the EmailJS service password.
4. After connecting, your service gets a **Service ID** like `service_abc123`.
   - Copy it — this is `EMAILJS_SERVICE_ID`.

---

## Step 3 — Create the Email Template

1. Go to **Email Templates** → click **Create New Template**.
2. **Template Editor** — set these:

   **Subject line:**
   ```
   {{subject}}
   ```

   **Content (HTML):**
   ```html
   <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
     <div style="background: linear-gradient(135deg,#DC2626,#EF4444,#F87171); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
       <span style="font-size: 36px;">🛒</span>
       <h1 style="margin: 8px 0 0; color: #fff; font-size: 24px;">PalengkeHub</h1>
       <p style="margin: 4px 0 0; color: #fee2e2; font-size: 13px;">Lipa City Public Market</p>
     </div>
     <div style="background: #fff; border: 1px solid #fde8e8; padding: 28px; border-radius: 0 0 12px 12px;">
       <h2 style="margin: 0 0 12px; color: #111827;">Verify your email</h2>
       <p style="color: #4b5563; line-height: 1.6;">Use the code below to verify your email address and activate your {{from_name}} account.</p>
       <div style="background: #fef2f2; border: 2px dashed #fca5a5; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0;">
         <span style="font-size: 32px; font-weight: 800; letter-spacing: 12px; color: #DC2626;">{{otp_code}}</span>
       </div>
       <p><strong>⏳ This code is valid for {{expires_minutes}} minutes.</strong></p>
       <p style="color: #6b7280;">If you didn't request this code, you can safely ignore this email.</p>
     </div>
   </div>
   ```

   > ⚠️ **IMPORTANT:** Do **NOT** add a `{{email_html}}` placeholder to your template.
   > The worker no longer sends `email_html`. If you leave `{{email_html}}` in the
   > template, EmailJS replaces it with an empty string (harmless) — but if an old
   > template param was sending the full HTML document, it would dump the raw HTML
   > source code into the email body. Keep the template to the variables above only.

3. In **Template Settings**, set the **Reply-To / From** as your Gmail.
4. Click **Save**.
5. Copy the **Template ID** (e.g. `template_xyz789`) — this is `EMAILJS_TEMPLATE_ID`.

---

## Step 4 — Get your Public Key

1. Go to **Account → General** or the top of the dashboard.
2. Find the **Public Key** (looks like `aBcDeFgH123` — NOT the private key).
3. This is `EMAILJS_PUBLIC_KEY`.

---

## Step 4.5 — Enable API access from non-browser environments

EmailJS requires you to enable **"API access from non-browser environments"** for the
REST API to work from the Cloudflare Worker. 

1. Go to **Account → Security** (or **Account → API Access**).
2. Find **"API access from non-browser environments"**.
3. Turn it **ON** (this exposes the REST API endpoint `api.emailjs.com/api/v1.0/email/send`).

### Get your Private Key

Because your account has strict-mode API access enabled, the Worker **must** pass your
**Private Key** as the `accessToken` when calling the EmailJS REST API.

1. In the same **Security / API Access** area, copy the **Private Key**
   (looks like `aBcDeFgH123...` — 32 chars, random).
2. This is `EMAILJS_PRIVATE_KEY`.

> ⚠️ Never put the Private Key in `wrangler.toml` or commit it to git. Store it as a
> Cloudflare **secret** or in the gitignored `.dev.vars` file.

---

## Step 5 — Plug the values into your project

### Option A — Local development (`supabase-proxy/.dev.vars`)

Add these lines to `supabase-proxy/.dev.vars`:
```
EMAILJS_SERVICE_ID=service_abc123
EMAILJS_TEMPLATE_ID=template_xyz789
EMAILJS_PUBLIC_KEY=aBcDeFgH123
EMAILJS_PRIVATE_KEY=your_private_key_here
```

### Option B — Production (Cloudflare secrets)

```bash
cd supabase-proxy
npx wrangler secret put EMAILJS_SERVICE_ID
npx wrangler secret put EMAILJS_TEMPLATE_ID
npx wrangler secret put EMAILJS_PUBLIC_KEY
npx wrangler secret put EMAILJS_PRIVATE_KEY
npx wrangler deploy
```

> The worker tries **Resend first** (needs a domain), then **falls back to EmailJS**
> which delivers via your Gmail. You only need EmailJS configured for it to work now.

---

## Step 6 — Test it

```bash
cd supabase-proxy
node test-email-delivery.mjs
```

This sends a test code to the email you provide (e.g. your Gmail). Check that inbox
for the OTP.

---

## ✅ Done!

When a user signs up and chooses **📧 Email**, they'll get a 6-digit code delivered to
their real inbox via your Gmail, mirroring the SMS flow exactly:

1. User signs up with email
2. Worker generates code → sends via EmailJS (your Gmail)
3. User opens email, enters 6-digit code
4. Auto-login → dashboard

---

## 🚀 Later: Upgrade to Resend with your own domain

When you're ready for launch, buy a domain (Namecheap/Cloudflare ~$10/yr),
verify it in Resend, and the worker will automatically use Resend (more reliable,
scales better) while keeping EmailJS as backup.


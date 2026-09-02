

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
   <div style="font-family: 'Trebuchet MS', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #F2E7D6; padding: 24px 16px;">

     <!-- Header: gradient band + circular logo, matches the app's login header -->
     <div style="background: linear-gradient(135deg,#C96A28,#E8833A,#F0913F); padding: 32px 24px 26px; text-align: center; border-radius: 28px 36px 0 0;">
       <img src="https://www.palengkehub.site/palengkehublogo.jpg" width="72" height="72" alt="PalengkeHub"
            style="width: 72px; height: 72px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.8); display: inline-block;" />
       <h1 style="margin: 14px 0 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 0.2px;">PalengkeHub</h1>
       <p style="margin: 6px 0 0; color: #FDF3E9; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;">
         &bull;&nbsp; Lipa City Public Market &nbsp;&bull;
       </p>
     </div>

     <!-- Card: same asymmetric "hand-drawn" corners as the login/signup card -->
     <div style="background: #FAF7F2; border: 1px solid #E4D3C8; border-top: none; padding: 30px 26px 26px; border-radius: 0 0 36px 22px;">

       <h2 style="margin: 0 0 4px; color: #261006; font-size: 21px; font-weight: 700;">Mabuhay! &#128075;</h2>
       <!-- hand-drawn underline, approximated with a short rounded rule -->
       <div style="width: 62px; height: 3px; background: #E2B8A8; border-radius: 3px; margin: 6px 0 16px;"></div>

       <p style="color: #5B4436; line-height: 1.6; margin: 0 0 22px; font-size: 14.5px;">
         Use the code below to verify your email address and activate your {{from_name}} account.
       </p>

       <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #5B4436;">
         Verification Code
       </p>
       <div style="background: #FDF3E9; border: 1.5px solid #C96A28; border-radius: 16px 10px 10px 16px; padding: 20px; text-align: center; margin: 0 0 22px;">
         <span style="font-size: 32px; font-weight: 800; letter-spacing: 12px; color: #C96A28;">{{otp_code}}</span>
       </div>

       <p style="color: #5B4436; margin: 0 0 6px; font-size: 14px;">
         <strong>&#9203; This code is valid for {{expires_minutes}} minutes.</strong>
       </p>
       <p style="color: #8A7263; font-size: 12.5px; margin: 0;">
         If you didn't request this code, you can safely ignore this email.
       </p>
     </div>

     <p style="text-align: center; color: #A89484; font-size: 11px; margin: 18px 0 0;">
       PalengkeHub &middot; Lipa City Public Market
     </p>
   </div>
   ```

   > The logo loads from `https://www.palengkehub.site/palengkehublogo.jpg` — it's already
   > live on the deployed landing page, so no extra hosting step is needed. If that domain
   > ever changes, swap the `src` to wherever the logo is hosted publicly (email clients
   > can't load images bundled inside the app itself).

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


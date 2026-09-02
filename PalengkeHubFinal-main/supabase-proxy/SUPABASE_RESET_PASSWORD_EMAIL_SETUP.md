# 🔑 Reset Password Email — Branded Template

The in-app "Forgot password?" flow (Login screen → email → 6-digit code → new
password) uses Supabase's own built-in password-recovery system, not EmailJS.
Changing a password requires Supabase's own authorization check, and that only
accepts the exact code Supabase itself generates and emails — so this template
lives in the **Supabase dashboard**, not EmailJS.

> ⏱️ Takes about 5 minutes.

---

## Step 1 — Open the template

1. Go to your Supabase project → **Authentication** → **Email Templates**.
2. Select the **Reset Password** template.

---

## Step 2 — Replace the HTML

By default this template only shows a magic-link button (`{{ .ConfirmationURL }}`),
with no visible code — but the app's reset screen asks the user to type a 6-digit
code. Replace the template body with the HTML below, which surfaces `{{ .Token }}`
(Supabase's OTP code for this email) styled to match the rest of the app:

```html
<div style="font-family: 'Trebuchet MS', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #F2E7D6; padding: 24px 16px;">

  <div style="background: linear-gradient(135deg,#C96A28,#E8833A,#F0913F); padding: 32px 24px 26px; text-align: center; border-radius: 28px 36px 0 0;">
    <img src="https://www.palengkehub.site/palengkehublogo.jpg" width="72" height="72" alt="PalengkeHub"
         style="width: 72px; height: 72px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.8); display: inline-block;" />
    <h1 style="margin: 14px 0 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 0.2px;">PalengkeHub</h1>
    <p style="margin: 6px 0 0; color: #FDF3E9; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;">
      &bull;&nbsp; Lipa City Public Market &nbsp;&bull;
    </p>
  </div>

  <div style="background: #FAF7F2; border: 1px solid #E4D3C8; border-top: none; padding: 30px 26px 26px; border-radius: 0 0 36px 22px;">

    <h2 style="margin: 0 0 4px; color: #261006; font-size: 21px; font-weight: 700;">Reset your password</h2>
    <div style="width: 62px; height: 3px; background: #E2B8A8; border-radius: 3px; margin: 6px 0 16px;"></div>

    <p style="color: #5B4436; line-height: 1.6; margin: 0 0 22px; font-size: 14.5px;">
      Enter the code below in the app to verify it's you, then choose a new password.
    </p>

    <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #5B4436;">
      Verification Code
    </p>
    <div style="background: #FDF3E9; border: 1.5px solid #C96A28; border-radius: 16px 10px 10px 16px; padding: 20px; text-align: center; margin: 0 0 22px;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 12px; color: #C96A28;">{{ .Token }}</span>
    </div>

    <p style="color: #8A7263; font-size: 12.5px; margin: 0;">
      If you didn't request this, you can safely ignore this email — your password won't change.
    </p>
  </div>

  <p style="text-align: center; color: #A89484; font-size: 11px; margin: 18px 0 0;">
    PalengkeHub &middot; Lipa City Public Market
  </p>
</div>
```

3. Click **Save**.

---

## Step 3 (optional but recommended) — More reliable delivery via Custom SMTP

Supabase's default email sender is shared across all Supabase projects and can be
rate-limited or land in spam. To send Reset Password (and other auth) emails
through your own Gmail — the same account already connected to EmailJS — instead:

1. Go to **Project Settings** → **Authentication** → **SMTP Settings**.
2. Turn on **Enable Custom SMTP**.
3. Fill in:
   ```
   Sender email:    your Gmail address
   Sender name:     PalengkeHub
   Host:            smtp.gmail.com
   Port:            587
   Username:        your Gmail address
   Password:        a Gmail App Password (Google Account → Security →
                     2-Step Verification → App Passwords — same kind used
                     for EmailJS, generate a separate one for this)
   ```
4. Save. Supabase will now send the Reset Password email (and other auth
   emails) through your Gmail, with much better deliverability than the
   shared default sender.

---

## ✅ Done

Once the template is saved, "Forgot password?" in the app will send a real
branded code to the user's inbox, and the in-app 3-step flow (email → code →
new password) will work end-to-end.

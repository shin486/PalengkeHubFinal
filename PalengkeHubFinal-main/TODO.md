# PalengkeHub — Multi-Account per Email (up to 5, unique names)

## Goal
Allow up to 5 accounts to share a single email address, each with a **different full name**. Login with a shared email+password shows an account picker when multiple names match.

## Approach
Use **deterministic email aliases** for auth while keeping the real email for display/OTP:
- Account 1 → `user@domain.com`
- Account 2 → `user+ph2@domain.com`
- Account 3 → `user+ph3@domain.com`
- ... up to `+ph5`

Plus-aliases still deliver to the same inbox, so email OTP continues to work. Each account is a distinct Supabase user with its own cart/orders.

## Steps
- [x] 1. `src/contexts/AuthContext.js`:
  - Add `MAX_ACCOUNTS_PER_EMAIL = 5` + `generateAuthEmail(realEmail, index)`
  - `signUp()`: count existing accounts by email → reject ≥ 5; reject duplicate full name; create user with alias email; store real email on profile; return `authEmail`
  - `login()`: direct attempt → on email failure, try aliases `+ph2`..`+ph5`; 1 match → sign in; >1 match → return `{ multipleAccounts, accounts }` (with picker)
  - `loginAsAccount()`: sign in as a specific account chosen from the picker
- [x] 2. `src/screens/auth/SignUpScreen.js`:
  - Add `authEmail` state (used for auto-login after OTP)
  - Add email-account-count + duplicate-name inline notice/validation
- [x] 3. `src/screens/auth/LoginScreen.js`:
  - Handle `result.multipleAccounts` → show account picker modal; selection signs in with that account's alias email
- [ ] 4. Verify (manual):
  - Same email twice with different names → both succeed
  - Same email + same name → blocked
  - 6th account for same email → blocked
  - Login with real email + shared password → picker appears

## Fix: "Failed to fetch" on email verification
- [x] Root cause: `AuthContext` fell back to `http://127.0.0.1:8787` (local wrangler dev server) in dev builds — this fails when the local server isn't running.
- [x] Fix: Fallback now uses the deployed worker `https://supabase-proxy.jhayvy.workers.dev` (verified live + email endpoint tested OK).
- [x] Restart the Expo app (`npx expo start --clear`) so the new fallback URL takes effect — confirmed server running fresh on :8081 with updated config.
- [ ] Reload the app on device (scan QR / press `r`) so it fetches the new bundle, then retry email verification.

## Fix: iOS "SyntaxError: private properties are not supported"
- [x] Root cause: `babel-preset-expo@57.0.3` was installed with Expo SDK 54 — incompatible Babel preset failed to transpile modern `#private` class fields for iOS JavaScriptCore.
- [x] Fix: Pinned `babel-preset-expo` to `~54.0.10` (installed 54.0.12) and `expo` to `~54.0.36`.
- [x] Verified installed versions: `babel-preset-expo 54.0.12`, `expo 54.0.36`, `react-native 0.81.5`.
- [x] Restarted Expo server with `--clear` (fresh bundle on :8081).
- [ ] Reload app on device (scan QR / press `r`) to confirm the iOS error is gone.

## Fix: Raw HTML code dumped at bottom of verification email
- [x] Root cause: Worker passed the full HTML document as `email_html` template param; the EmailJS template's `{{email_html}}` placeholder injected that entire HTML source into the email body as raw text.
- [x] Fix: Removed `email_html` from the worker's EmailJS `templateParams` (supabase-proxy/src/index.ts).
- [x] Fix: Updated `EMAILJS_SETUP.md` to remove the `{{email_html}}` placeholder from the recommended template content and added a warning against adding it.
- [x] Redeployed the Cloudflare Worker (`npx wrangler deploy`) — health check returns 200, email endpoint tested OK.
- [ ] User action: In the EmailJS dashboard, remove `{{email_html}}` from the email template content (harmless if left, since it now renders empty).

---

## Fix: "Permission Needed — grant gallery access" alert on Create Account tap
- [x] Root cause: SignUpScreen requested media-library permission eagerly in a `useEffect` on screen mount, prompting all users (even consumers) at the start, and showing an alert when denied.
- [x] Fix: Removed the eager on-mount permission request. Permission is now requested only inside `pickImage()` — i.e. when a vendor actually taps "Upload Government Issued ID". Denial shows a helpful Settings instruction alert.
- [x] Replaced deprecated `ImagePicker.MediaTypeOptions.Images` with `ImagePicker.MediaType.Images`.

---

# PalengkeHub — iProg SMS Integration (Authenticator OTP)

## Goal
Verify sign-up with a 6-digit OTP sent to the user's phone via the iProg SMS gateway, through the Cloudflare Worker reverse-proxy.

## Status
- [x] `supabase-proxy/src/index.ts`:
  - Fixed `handleHttpProxy` syntax error (empty body + orphaned logic)
  - Added typed request bodies (`IprogSmsPayload`, `PaymongoSourcePayload`, `ResendEmailPayload`)
  - `/iprog/send-authenticator-sms` endpoint: generates 6-digit code, sends via iProg, returns code + expiry
  - `/resend/send-authenticator-email` endpoint: Resend + EmailJS fallback
- [x] `supabase-proxy/.dev.vars` (gitignored): `IPROG_API_TOKEN` set
- [x] `src/contexts/AuthContext.js`: `sendAuthenticatorSms()` + PH number normalization + `sendEmailVerificationCode()`
- [x] `src/screens/auth/SignUpScreen.js`: SMS OTP modal (send/verify/resend)
- [x] Worker compiles (dry-run: 14.71 KiB)
- [x] `supabase-proxy/test-worker-sms.mjs` added (end-to-end SMS test)

## Remaining (deployment)
- [ ] Redeploy the Worker so the syntax fix + code is live:
  ```bash
  cd supabase-proxy
  npx wrangler deploy
  ```
- [ ] Ensure `IPROG_API_TOKEN` is set as a **Cloudflare secret** (not just `.dev.vars`):
  ```bash
  cd supabase-proxy
  npx wrangler secret put IPROG_API_TOKEN
  ```
- [ ] Verify `EXPO_PUBLIC_AUTH_PROXY_URL` is set in the app's `.env`:
  ```
  EXPO_PUBLIC_AUTH_PROXY_URL=https://supabase-proxy.jhayvy.workers.dev
  ```
- [ ] Test end-to-end:
  ```bash
  cd supabase-proxy
  node test-worker-sms.mjs +639XXXXXXXXX
  ```


# Admin Notes

Honest notes about the repo that do not belong in any phase, but that you should know before something surprises you. None of this is design work. Some of it is important.

Everything here was verified against the `jhay` branch on 2026-08-27. All paths are from the repo root.

---

## 1. `pages-deploy/` lags, and there is no CI

`pages-deploy/` is a **committed build output** of `web/`. Somebody runs `npm run build` in `web/`, copies `web/dist/` over `pages-deploy/`, and commits it by hand. There is no GitHub Action, no build step on deploy, nothing automatic.

The evidence, as of 2026-08-27 on branch `jhay`:

| Path | Last commit touching it |
|---|---|
| `web/` | Wed 26 Aug 2026, 22:57 |
| `pages-deploy/` | Wed 26 Aug 2026, 11:38 |

That is eleven hours and at least one commit of drift, on a normal working day. It is not a one-off.

**What this means for you.** The live admin dashboard can be running code that no longer exists in `web/src`. When you debug something on the live site, you may be debugging an old build. When you fix something in `web/src`, nothing happens live until somebody rebuilds.

**The rule while you are migrating:** any commit that changes `web/src` must rebuild `pages-deploy/` in the **same commit**. Phase 08 says this too. Preserve `pages-deploy/_redirects` when you copy.

**The real fix**, for later: a GitHub Action that builds `web/` and publishes it, so `pages-deploy/` stops being a thing a human can forget.

---

## 2. `PalengkeHubFinal-main/www/` is drift and can be deleted

`www/` is a stale copy of `PalengkeHubFinal-main/landingpage-website/`. Nothing builds it, nothing deploys it, nothing links to it. It exists because somebody copied a folder once.

Verified difference on 2026-08-27:

- `landingpage-website/` has 18 entries, `www/` has 14.
- `www/` is missing `PALENGKEHUB.mov`, `PALENGKEHUB.mp4`, `_redirects` and `palengkehub-qr.svg`.
- `about.html`, `admin-login.html`, `contact.html` and `index.html` differ between the two.

So the two are already out of sync in both directions, which means `www/` is not a backup either. It is just a second, worse copy.

**It is safe to delete.** Do it in a commit that does nothing else, with a message that says what it was, so the history is obvious to whoever looks in six months.

**Do not touch it during any design phase.** It is explicitly listed as a non-goal in every phase for exactly this reason: a repo-wide search and replace would happily "migrate" a folder that does not run.

---

## 3. `TODO.md` is aspirational fiction

There is a `TODO.md` at the repo root (and another inside `PalengkeHubFinal-main/`). It is titled "PalengkeHub UI/UX Modernization - Task Tracker" and its Status section says, in full:

> **All steps complete.**

Every checkbox is ticked. It claims the app was modernised into a "polished, high-end million-dollar UI/UX while strictly preserving the PalengkeHub brand (#DC2626 red/orange primary), design-system tokens, logo, and color constants."

Four problems with that:

1. There were **no** design-system tokens. The audit found roughly 2,300 hex literals across `PalengkeHubFinal-main/src/`, 141 of them distinct, and 14 separate local `SPACING` / `RADIUS` blocks. The token file this project is delivering is the first one that exists.
2. `#DC2626` is Tailwind red. It appears **nowhere** in the PalengkeHub logo. It was never the brand colour; it was a framework default that got called one.
3. The screens it lists as done are the ones phases 4, 5 and 6 are about to actually do.
4. Some of the file paths it ticks off are simply not real. It claims `src/components/ui/PressableScale.js` with a ticked box. There is no `src/components/ui/` folder at all. What actually exists is `src/utils/animations.js`, which exports `FadeInUp` and `PressableScale`, and which **nothing in the app imports**. So the component was written, put somewhere else, and never wired in, and the tracker recorded it as shipped.

   To be fair to it, plenty of its other entries are real: `src/components/vendor/ProductCard.js`, `OrderCard.js`, `AddProductModal.js` and `SalesChart.js` all exist. That is what makes it dangerous. It is right often enough to be believed.

**Why this matters to you, practically.** Do not use `TODO.md` as a source of truth for what exists. If a GSD plan cites it, correct the plan. The truthful description of the current state is in `.planning/PROJECT.md` under Context, and it is based on reading the code, not on reading that file.

Nobody is in trouble for this. It is a completely normal thing to happen when an AI assistant writes a task tracker and then marks its own homework. Just do not build on it.

**Suggestion:** replace `TODO.md` with a two-line file pointing at `.planning/ROADMAP.md`, so there is one place that says what is done.

---

## 4. `web/src/admin.css` has an encoding problem

The file starts with a **UTF-8 BOM**, and the comment on line 2 contains mojibake: what should be an em-length dash in "PalengkeHub Admin Dashboard - Premium UI" is stored as `â€"`. That is the classic signature of a UTF-8 file that was read as Windows-1252 at some point and written back out.

**What to do:**

- Read and write this file as **UTF-8**. If your editor offers to "fix" the encoding, say no.
- Do not strip or add the BOM as a side effect of another change. A BOM change turns a three-line diff into a whole-file diff and hides what you actually did.
- If you want to clean the mojibake, do it in its **own commit**, touching nothing else.
- Windows PowerShell note: `Set-Content` and `Out-File` default to a different encoding than you expect on older PowerShell. Use `-Encoding utf8` explicitly, or edit the file in your editor rather than from the shell.

Phase 08 deletes the `:root` block at lines 6 to 27 in this file, so this is the one phase where it matters.

---

## 5. `web/src/pages/Home.jsx` is not valid JavaScript

Lines 4 to 9 define a `features` array where every entry opens a string with `icon: '` and never closes it. An emoji was stripped out of each one at some point and the quote went with it.

The build still succeeds, because `web/src/App.jsx` only routes three paths (`/`, `/admin`, `/admin-login`) and nothing imports `Home.jsx`, so it never enters the bundle. But `npm run lint` uses `oxlint`, which reads every file, so **lint fails**.

The fix is not to repair the file. It is to delete it along with the seven other orphans, which phase 08 does.

---

## 6. Credentials hygiene

None of this is design work and none of it belongs in a design PR. It is listed here because it is real and somebody should own it.

### 6a. The Supabase key: less bad than it looks, but check RLS

A Supabase JWT is committed in these files:

| File | Line |
|---|---|
| `PalengkeHubFinal-main/lib/supabase.js` | 7 |
| `web/src/lib/supabase.js` | 4 |
| `PalengkeHubFinal-main/landingpage-website/admin.html` | 15 |
| `PalengkeHubFinal-main/landingpage-website/admin-login.html` | 16 |
| `PalengkeHubFinal-main/www/admin.html` | (the stale copy) |
| `PalengkeHubFinal-main/www/admin-login.html` | (the stale copy) |
| `pages-deploy/assets/index-BfUs2qmS.js` | (the committed build) |

**The good news:** its `role` claim is `anon`, not `service_role`. The anon key is designed to be shipped to browsers and phones. There is no `service_role` key anywhere in the repo, which is the thing that would have been an emergency.

**The actual risk is not the key, it is Row Level Security.** The anon key is only safe if every table has RLS enabled with policies that restrict what an anonymous or logged-in user may read and write. If any table is readable or writable without a policy, that key is a door.

**What to do, in order:**

1. Open the Supabase dashboard and confirm **RLS is enabled on every table**, and that each one has policies you can explain out loud.
2. Fix any table that does not.
3. Only then consider rotating the key. Rotating first, with RLS still off, changes nothing.

If you do rotate it, remember it lives in seven places including a committed build, so rotating means touching all of them plus a `pages-deploy` rebuild.

### 6b. The ImgBB key: this one is a real secret, rotate it

`0f4823dff292c1d4...` (truncated deliberately) is an ImgBB API key committed in:

| File | Line |
|---|---|
| `PalengkeHubFinal-main/src/components/vendor/AddProductModal.js` | 22 |
| `web/src/pages/AdminDashboard.jsx` | ~1618 (appended as a query param) |
| `pages-deploy/assets/index-BfUs2qmS.js` | (the committed build) |

Unlike the Supabase anon key, this one is **not** meant to be public. Anyone reading the repo can upload images to your ImgBB account, which means they can consume your quota and host arbitrary content under it.

**What to do:** rotate the key in ImgBB, and move the new one behind the existing `admin-worker` or `supabase-proxy` so the client never holds it. Both of those folders already exist in the repo, so the pattern is there.

### 6c. The admin account

`admin@palengkehub.com` appears throughout the repo as the login placeholder and as a fallback in `PalengkeHubFinal-main/src/components/admin/AdminSidebar.js:106` and `src/screens/admin/AdminSidebar.js:120`.

The password is **not** in the repo. Good. But it is a single shared account for a dashboard that can see every order and every vendor.

**What to do:**

1. Change the password now, to something long and unique, and store it in a password manager rather than a chat thread.
2. Turn on whatever second factor Supabase Auth offers for it.
3. Longer term, give each admin their own account. Shared logins mean the audit trail cannot tell you who did what, and `AdminAuditTrailScreen.js` exists, so somebody already cared about that.

### 6d. General

- `.gitignore` covers `node_modules/`, `.expo/`, `web/dist/`, `dist/` and various local logs. It does **not** mention `.env`. Add it before anyone creates one.
- `pages-deploy/` being a committed build means **every secret in the client bundle is in git history forever**, even after you rotate. Rotation is still the right move; just know that removing the old value from the working tree does not remove it from history.

---

## 7. Small things worth knowing

- **`PalengkeHubFinal-main/src/theme/adminTheme.js` is 0 bytes.** Harmless. Left alone on purpose so nobody spends a code review on deleting an empty file.
- **`PalengkeHubFinal-main/src/utils/animations.js` is dead but useful.** It exports `FadeInUp` (line 10) and `PressableScale` (line 51), and nothing in `src/` imports it. Phase 2 moves `PressableScale` into `src/components/ui/` and builds the `Button` primitive on it. `FadeInUp` stays where it is until something wants it.
- **`PalengkeHubFinal-main/src/components/ModernButton.js` is dead and broken.** Nothing in `src/` imports it, and its line 16 reads `import { Ionicons } from '@expo/vector/icons';`, which is not a real package (`@expo/vector-icons` is). If anyone ever imports it, it crashes. It is also the only consumer of `customerGradients`, which is why phase 1 keeps that one export alive. Delete both after phase 6, in a commit of their own.
- **Ratings are partly synthetic.** `getStallRating` and `getRandomRatingCount` in `SearchScreen.js` and `ProductDetailsScreen.js` generate a plausible rating and review count when there is no real data. That is a data-honesty problem, not a design problem, and it is out of scope here. It should be fixed before any wider release, because showing a shopper "4.8 (312 reviews)" for a stall with no reviews is the kind of thing that loses trust permanently.
- **The icon families are mixed.** Ionicons 382 uses, MaterialIcons 181, Feather 1. Two drawing styles sit next to each other on the same screen. Keep Ionicons, convert the rest. There is already an `audit-icons.cjs` at the repo root, so half the work is done. Mechanical, not design, so it is not a phase.
- **`PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js` is 251 KB with 547 hex literals**, roughly a quarter of all the colour debt in the app. It is admin-only. It is out of scope for every phase, deliberately. If it ever gets split into smaller files, migrate it then.
- **Two `TODO.md` files exist**, one at the repo root and one in `PalengkeHubFinal-main/`. See section 3.

---

*Written 2026-08-27, against branch `jhay`. If something here is out of date, trust the code, not this file.*

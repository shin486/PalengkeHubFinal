# Phase 8: Admin Web - Context  (OPTIONAL, LATER)

**Gathered:** 2026-08-27 (hand authored, no discuss step needed)
**Status:** Ready for planning, optional

**Branch:** `design/phase-08-admin-web`

<domain>
## Phase Boundary

The Vite admin dashboard at `web/`. Three jobs:

1. Point both `:root` blocks at a shared `tokens.css` so the dashboard is the same colour as the app.
2. Delete eight orphaned files, which is what makes `npm run lint` pass again.
3. Rebuild `pages-deploy/` from the new build, in the same commit.

This phase depends only on phase 1. It does not need phases 2 to 7. You can do it any time after the tokens land, or never. It is genuinely optional; no buyer sees this dashboard.

</domain>

<decisions>
## Implementation Decisions

### tokens.css

- **D-01:** Copy the design system's `tokens.css` to `web/src/tokens.css`. Byte for byte.
- **D-02:** Import it once, first, in `web/src/main.jsx`, before `index.css` and `admin.css`. Order matters: the aliases must be defined before the files that consume them.
- **D-03:** `tokens.css` already ships two alias blocks written specifically for this repo, so **2,900 lines of admin rules do not have to be touched**:

  - The admin block maps `--admin-primary`, `--admin-primary-light`, `--admin-primary-dark`, `--admin-bg`, `--admin-surface`, `--admin-text`, `--admin-text-secondary`, `--admin-text-muted`, `--admin-border`, `--admin-border-light`, `--admin-shadow`, `--admin-shadow-md`, `--admin-shadow-lg`, `--admin-shadow-xl`, `--admin-radius`, `--admin-radius-lg`, `--admin-radius-sm`, plus `--transition-fast` and `--transition-smooth` which `admin.css` reads without the prefix.
  - The public block maps `--red-deep`, `--red`, `--red-soft`, `--semi-red`, `--semi-red-deep`, `--accent`, `--white`, `--light-bg`, `--gray`, `--display`, `--body` and `--mono`.

- **D-04:** Delete the `:root` block at `web/src/admin.css` lines 6 to 27 (the whole `--admin-*` block, including the three `--transition-*` rules). The aliases replace it.
- **D-05:** Delete the `:root` block at `web/src/index.css` lines 5 to 19. Same reasoning.
- **D-06:** **Encoding warning.** `web/src/admin.css` starts with a UTF-8 BOM and its comment on line 2 contains mojibake (`Premium UI` reads as `â€"`). Read and write it as UTF-8. Do not let an editor re-encode the file to cp1252 or strip the BOM silently, and do not "fix" the mojibake in the same commit as the token change; if you clean it up, do it as its own commit so the diff stays readable.

### The eight orphaned files

- **D-07:** `web/src/App.jsx` routes exactly three paths, all admin: `/`, `/admin` and `/admin-login`. Everything else in `web/src` that looks like a public site is unreachable.
- **D-08:** Delete these eight files. They form a closed cluster: `Layout.jsx` imports `Header` and `Footer`, and nothing imports `Layout`.

  1. `web/src/Layout.jsx`
  2. `web/src/pages/Home.jsx`
  3. `web/src/pages/Shop.jsx`
  4. `web/src/pages/Sell.jsx`
  5. `web/src/pages/About.jsx`
  6. `web/src/pages/Contact.jsx`
  7. `web/src/components/Header.jsx`
  8. `web/src/components/Footer.jsx`

- **D-09:** **This is the lint fix.** `web/src/pages/Home.jsx` lines 4 to 9 are not valid JavaScript. Each entry in the `features` array opens a string with `icon: '` and never closes it, because an emoji was stripped out at some point. Vite still builds successfully, because nothing imports the file so it never enters the bundle. `oxlint` reads every file, so `npm run lint` fails. Deleting the file fixes lint without touching anything that runs.
- **D-10:** Before deleting, confirm with a search that nothing imports each file. As of 2026-08-27 the count is zero for all of them except `Header` and `Footer`, which are imported only by `Layout.jsx`, which is itself an orphan.
- **D-11:** Also delete `web/public/icons.svg`. It is the unmodified Vite starter sprite containing Bluesky, Discord and GitHub icons, and it currently ships to production. Confirm nothing references it first.

### Fonts on the web

- **D-12:** `web/index.html` line 8 loads Fraunces, Manrope, IBM Plex Mono and Space Grotesk. Space Grotesk is downloaded on every page and used nowhere in `web/src`. Replace the whole Google Fonts link with:

  ```html
  <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  ```

  Monospace uses the system stack. No webfont ships for code.

- **D-13:** `tokens.css` already defines `--display`, `--body` and `--mono` as aliases onto `--f-display`, `--f-ui` and `--f-mono`, so the CSS side needs no further edits once the link is swapped.

### pages-deploy

- **D-14:** `pages-deploy/` is a committed build of `web/`, produced by hand with `npm run build` and a copy step. There is no CI. It routinely lags the source, which means the live admin dashboard can be running code that no longer exists in `web/src`.
- **D-15:** Rebuild it in the **same commit** as the source change, never as a follow-up:

  ```
  cd web
  npm run build
  ```
  then copy `web/dist/` over `pages-deploy/`, preserving `pages-deploy/_redirects`.

- **D-16:** After rebuilding, load the live dashboard and confirm all three routes still work, and that the login still authenticates. A stale or broken `pages-deploy` is the one way this optional phase can actually hurt someone.

### Claude's Discretion

- Whether the two `:root` deletions and the file deletions are one plan or two.
- Whether to clean the `admin.css` mojibake comment at all.
- Whether to do the font link swap in this phase or fold it into phase 7.

</decisions>

<specifics>
## Specific Ideas

- The alias blocks in `tokens.css` were written specifically so nobody has to read 2,900 lines of admin CSS. Use them. Do not start rewriting rules by hand.
- The lint failure is not a code-quality nicety. It is a file full of syntax errors sitting in the repo looking like real code. Deleting it is the honest fix.
- If you only do one thing in this phase, make it the file deletions. They cost nothing and remove a genuine trap.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The design system
- `06-adoption/tokens.css` - the file being copied. Read the two alias blocks, roughly lines 180 to 232
- `06-adoption/DESIGN-SYSTEM.md` sections "Old value to new token: the top 20" and "Typography plan" (the Web subsection)
- `06-adoption/design-system.html#colors`, `#elevation`, `#typography`

### Existing code
- `web/src/main.jsx` - where `tokens.css` is imported first
- `web/src/admin.css` lines 6 to 27 - the `--admin-*` `:root` block to delete. **UTF-8 BOM, see D-06**
- `web/src/index.css` lines 5 to 19 - the `:root` block to delete
- `web/src/App.jsx` - proof that only three admin routes exist
- `web/src/pages/Home.jsx` lines 4 to 9 - the invalid JavaScript
- `web/index.html` line 8 - the Google Fonts link
- `web/package.json` - `dev`, `build`, `lint` (oxlint), `preview`
- `pages-deploy/` - the committed build

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The alias blocks in `tokens.css` are the entire migration strategy for this phase. Everything else is deletion.
- `web/src/pages/AdminDashboard.jsx` and `AdminLogin.jsx` are the only two real pages. They stay.

### Established Patterns
- Vite 8 plus React 19 plus react-router-dom 7. Plain CSS files, no CSS modules, no Tailwind. Keep it that way.
- Linting is `oxlint`. Fast, and it reads every file whether or not it is bundled.

### Integration Points
- `web/src/lib/supabase.js` holds the Supabase client. Do not touch it in this phase. It does contain a committed anon key, which is covered separately in `ADMIN-NOTES.md`.
- `web/src/pages/AdminDashboard.jsx` contains an ImgBB key around line 1618. Same story: flagged, not fixed here.

</code_context>

<non_goals>
## NON-GOALS

- **No data fetching changes.** No Supabase query touched. No table, no filter, no field.
- **No routing changes.** The same three routes: `/`, `/admin`, `/admin-login`. Deleting unreachable files is not a routing change, because nothing routed to them.
- **No state changes. No API changes.**
- **No new dependency.** Not one.
- **No rewrite of `admin.css` rules.** The aliases exist so the 2,900 lines can stay exactly as they are.
- **No credential changes in this phase.** The exposed keys are real and they are listed in `ADMIN-NOTES.md`, but rotating a key is an operations task with a deploy attached, not a design change. Do not bundle it into a design PR.
- **Do not touch `PalengkeHubFinal-main/www/`.** It is orphaned drift, a stale copy of the landing page. See `ADMIN-NOTES.md`.
- **Do not touch `PalengkeHubFinal-main/landingpage-website/`.** The live landing page stays as it is; the new one ships separately as `landingpage-website/v2/`.

</non_goals>

<acceptance>
## Acceptance Criteria

1. `web/src/tokens.css` exists and is imported first in `web/src/main.jsx`.
2. The `:root` block is gone from `web/src/admin.css` and from `web/src/index.css`, and both files still render correctly because the aliases resolve.
3. `web/src/admin.css` is still valid UTF-8 and its BOM state is unchanged from before, unless you deliberately cleaned it in a separate commit.
4. The eight orphaned files and `web/public/icons.svg` are deleted.
5. `cd web && npm run lint` **passes**.
6. `cd web && npm run build` succeeds.
7. All three admin routes load and the login still authenticates.
8. `pages-deploy/` is rebuilt in the same commit, `_redirects` is preserved, and the live dashboard works.
9. The dashboard is orange, not red, and reads as the same product as the app.

</acceptance>

<screenshots>
## Before and After Screenshot Checklist

`cd web && npm run dev`, capture at **375px** and **1440px**, before and after. Then repeat against the deployed `pages-deploy` build.

- [ ] `/admin-login`
- [ ] `/admin` dashboard, default view
- [ ] `/admin` with a data table visible
- [ ] `/admin` with a chart visible (recharts colours will need checking)
- [ ] Any modal or drawer in the dashboard
- [ ] The live deployed dashboard after the `pages-deploy` rebuild

</screenshots>

<rollback>
## Rollback Rule

If lint fails, the build fails, any admin route stops loading, the login stops working, or the live dashboard breaks after the `pages-deploy` rebuild: revert the whole phase and redeploy the previous `pages-deploy`.

```
git checkout design-system
git branch -D design/phase-08-admin-web
```

A broken live admin dashboard is the only way this optional phase can hurt a real person, so verify the deployed build before you close the PR, not after.

</rollback>

<deferred>
## Deferred Ideas

- Cleaning the mojibake comment at the top of `admin.css`.
- Rotating the exposed Supabase anon key and the ImgBB key. See `ADMIN-NOTES.md`. This should happen, but as its own operations task with a deploy plan.
- Setting up CI so `pages-deploy/` is built automatically and can never lag again. This is the real fix for D-14.
- Deleting `PalengkeHubFinal-main/www/`. It is safe to delete, but do it in a commit that does nothing else, so it is obvious in the history.
- Restyling the recharts charts to the token palette properly, rather than just letting them inherit.

</deferred>

---

*Phase: 08-admin-web*
*Context authored: 2026-08-27*

# PalengkeHub UI Refresh

## What This Is

PalengkeHub is a mobile marketplace for the Lipa City Public Market: buyers browse stalls and compare prices, stall owners list products and manage orders, and market admins watch the whole thing from a dashboard. This project moves the existing Expo app onto the new "palengke identity" design system so it looks like a mainstream commerce app instead of a prototype. It changes appearance only.

## Core Value

A buyer opens the app and can tell, in under two seconds, which stall is selling today's tomatoes cheapest. Everything else in the design serves that.

## Business Context

- **Customer**: shoppers and stall owners at Lipa City Public Market
- **Revenue model**: not monetised yet, this is a capstone and community product
- **Success metric**: a first-time Filipino shopper recognises the home screen as a normal shopping app without being told what it is
- **Strategy notes**: `DESIGN-SYSTEM.md` in the adoption folder is the single source of design truth

## Requirements

### Validated

- The app already computes and displays price comparison across stalls (`ProductDetailsScreen.js` market analytics, `SearchScreen.js` comparison cards). The feature works. It is just buried and visually weak.
- Theming already flows through one provider (`PalengkeHubFinal-main/src/contexts/ThemeContext.js`) consumed by 34 files via `useTheme()` / `useColors()`. That plumbing is good and stays.
- `PalengkeHubFinal-main/src/theme/motion.js` is already a correct token file. It is the shape every other theme file should copy.

### Active

- [ ] REQ-01: One colour source. Every colour in the buyer-facing app comes from `PalengkeHubFinal-main/src/theme/tokens.js`, not from a hex literal.
- [ ] REQ-02: One brand colour. Orange `#E8833A` is the only colour allowed on an action. Red means error or MAHAL, never "buy".
- [ ] REQ-03: One spacing scale and one radius scale. The 14 local `SPACING` / `RADIUS` blocks are deleted.
- [ ] REQ-04: Shared primitives. Buttons, cards, chips, badges, price text and verdict chips are built once and reused.
- [ ] REQ-05: The nav shell (header plus both bottom bars) matches the design system, and the Material red family is gone.
- [ ] REQ-06: The customer home screen matches `design-system.html`, including the category chip row the app does not have today.
- [ ] REQ-07: The listing screens (category products, search) match the design system.
- [ ] REQ-08: Product detail leads with price comparison, and the "Best Deal" badge only compares prices that share a unit.
- [ ] REQ-09 (optional, later): Baloo 2 and Nunito are actually loaded via `expo-font`.
- [ ] REQ-10 (optional, later): The Vite admin dashboard reads `tokens.css` and the 8 orphaned pages are deleted so lint passes.

### Out of Scope

- **Any behaviour change.** No data fetching, routing, navigation, state, Supabase queries, or API changes. This is the hard boundary of the whole project, and it is repeated as a non-goal in every phase.
- **`PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js`.** 251 KB, 547 hardcoded hexes, roughly a quarter of the app's colour debt, admin-only, zero buyer value. Migrating it costs more than every other phase combined.
- **`PalengkeHubFinal-main/www/`.** Orphaned drift, a stale copy of the landing page. Not built, not deployed, not touched. See `ADMIN-NOTES.md`.
- **The current live landing page.** `PalengkeHubFinal-main/landingpage-website/` stays exactly as it is. The new landing ships beside it as `landingpage-website/v2/`, zero shared files.
- **Rewriting to TypeScript, or adding a styling library.** The app is JavaScript with `StyleSheet.create`. It stays that way. Changing the styling engine is a different project.
- **Icon family unification.** The app mixes Ionicons (382 uses), MaterialIcons (181) and Feather (1). Converting is worth doing, but it is a mechanical follow-up, not part of this design migration.

## Context

- **Stack.** Expo 54, React Native 0.81.5, React 19, JavaScript. Styling is `StyleSheet.create`, called in 80 of the 114 files under `PalengkeHubFinal-main/src/`. Web admin is Vite 8 plus React 19 at `web/`. The public landing page is plain static HTML.
- **The colour debt.** About 2,300 six-digit hex literals live in `PalengkeHubFinal-main/src/`, 141 of them distinct. They arrived through three routes: the `COLORS` literal inside `ThemeContext.js` (lines 17 to 108), the exports in `src/theme/vendorTheme.js` (imported by 15 files), and plain hardcoded hexes everywhere else.
- **Three unrelated red families.** Tailwind red `#DC2626` in the theme files, Material red `#C62828` hardcoded across 10 files, and "semi red" `#E63946` on the web. None of them appear in the PalengkeHub logo. The design system replaces all three with the logo orange `#E8833A`.
- **84 `LinearGradient` components** across 40 files, including the home screen search header. Mainstream commerce apps use flat fills. These go.
- **No fonts are loaded.** `expo-font` is not installed and there are no font files in the repo. Every screen renders the platform default today. That is why `TYPE.size` and `TYPE.weight` can be adopted in phase 01 with zero visual risk, and why fonts get their own late phase.
- **Dead and near-dead files.** `src/theme/adminTheme.js` is 0 bytes. `src/theme/customerTheme.js` is only reachable through `customerGradients`, imported at `src/components/ModernButton.js:18`, and `ModernButton.js` is itself imported by nothing and has a broken import on line 16 (`@expo/vector/icons` instead of `@expo/vector-icons`).
- **Repo layout gotcha.** The Expo app is at `PalengkeHubFinal-main/`, not at the repo root. Repo root also holds `web/` (Vite admin) and `pages-deploy/` (a committed build of `web/`).

## Constraints

- **Tech stack**: Expo 54 / RN 0.81.5 / JavaScript. No TypeScript migration, no styling library, no new state management. The team is small and junior; every new concept costs more than it saves.
- **Dependencies**: exactly one new dependency is allowed in this whole project, `expo-font` plus the two Google font packages, and only in phase 07.
- **Compatibility**: `tokens.js` is shaped to drop into `ThemeContext.js` one for one. Every key the old `COLORS` object exported still exists, including the legacy text aliases (`text.dark`, `text.medium`, `text.light`, `text.lighter`, `text.white`, `text.tertiaryer`), so the 34 consumer files keep compiling untouched.
- **Team**: Jhay is a junior developer working solo on this. Phases must be small enough to review in one sitting and cheap enough to revert.
- **Security**: the repo currently contains a committed Supabase anon JWT and an ImgBB API key. Not this project's job to fix, but flagged in `ADMIN-NOTES.md` and it should be handled before any wider release.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Brand colour is logo orange `#E8833A`, and there is no brand red | Every colour in the system is sampled from the basket logo. The old `#DC2626` appears nowhere in the logo. Orange is also the commerce instinct Shopee and Lazada already trained shoppers on. | Pending |
| Red survives only as error, discount badge, and the MAHAL verdict | A red button then always means "wrong" or "delete", never "buy". That single meaning is worth more than the 14 reds it replaces. | Pending |
| Cards have no drop shadow | A warm white card `#FFFDFA` on woven paper `#F2E7D6` already reads as raised. Shadows are reserved for things that genuinely float. | Pending |
| Phase by layer, not by feature | Tokens, then primitives, then shell, then screens. A feature-shaped phase would touch tokens and screens at once and be impossible to revert cleanly. | Pending |
| `AdminDashboardScreen.js` is out of scope | 547 hexes, admin-only, a quarter of the debt at zero buyer value. | Pending |
| Fonts go last, alone | It is the only phase that adds a dependency and the only one that can change every text metric at once. Isolating it means one clean revert if the layout breaks. | Pending |
| `git.branching_strategy` is `phase` | One phase, one branch, one PR. Granular rollback is the whole safety story for a solo junior dev. | Pending |
| `workflow.use_worktrees` is `false` | Sequential execution in one visible working tree. Slower, far easier to follow and to stop. | Pending |

---
*Last updated: 2026-08-27 when the GSD adoption package was authored.*

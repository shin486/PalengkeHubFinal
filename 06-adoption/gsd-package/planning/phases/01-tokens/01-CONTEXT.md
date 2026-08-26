# Phase 1: Tokens - Context

**Gathered:** 2026-08-27 (hand authored, no discuss step needed)
**Status:** Ready for planning

**Branch:** `design/phase-01-tokens`

<domain>
## Phase Boundary

One file becomes the source of every colour, spacing value and radius in the buyer-facing app. Nothing moves on screen. No component is restructured. No layout changes. When this phase is done, every screen sits in exactly the same place it did before, wearing different colours.

This is the only phase where the whole app changes appearance at once, and it is deliberately the cheapest one to revert: it is a small number of files, all of them theme plumbing.

</domain>

<decisions>
## Implementation Decisions

### The new file

- **D-01:** Copy the design system's `tokens.js` to `PalengkeHubFinal-main/src/theme/tokens.js`. Copy it byte for byte. Do not retype it, do not reformat it, do not "improve" the comments.
- **D-02:** Do **not** copy the little `package.json` that sits next to `tokens.js` in the design system folder. It exists only so `node` can syntax-check the file outside React Native. Metro reads the ESM exports directly.
- **D-03:** The file shape to follow is `PalengkeHubFinal-main/src/theme/motion.js`, which is already correct and already Jhay's own. `tokens.js` is its sibling, not its replacement. `motion.js` stays exactly as it is.

### ThemeContext

- **D-04:** In `PalengkeHubFinal-main/src/contexts/ThemeContext.js`, delete the local `const COLORS = { ... }` literal that spans lines 17 to 108, and add `import { COLORS } from '../theme/tokens';` at the top.
- **D-05:** Everything else in that file is untouched. Specifically keep: `ThemeProvider`, `useTheme`, `useColors`, the `THEME_KEY` constant `'@palengkehub_theme'`, `loadTheme`, `applyTheme`, the `useColorScheme()` system-scheme follow, and the `themeMode` state with its `'light' | 'dark' | 'system'` values.
- **D-06:** This works without touching any consumer because `tokens.js` re-exports every key the old object had, including the legacy text aliases `text.dark`, `text.medium`, `text.light`, `text.lighter`, `text.white` and `text.tertiaryer`. The 34 files that read `COLORS.text.dark` keep compiling. They just get a warm brown `#261006` instead of a cold grey `#111827`.

### vendorTheme

- **D-07:** `PalengkeHubFinal-main/src/theme/vendorTheme.js` is imported by 15 files. Do **not** delete it and do **not** change any export name. Keep every one of these exports alive: `vendorColors`, `useVendorColors`, `vendorSpacing`, `vendorBorderRadius`, `vendorTypography`, `useVendorTypography`, `vendorShadows`, `vendorGradients`, `getStatusColor`, `getStatusColorForTheme`, `getStatusLabel`, `getPaymentStatusColor`, `getPaymentStatusLabel`.
- **D-08:** Re-point their bodies at `tokens.js`: `vendorColors` derives from `COLORS`, `vendorSpacing` from `SPACING`, `vendorBorderRadius` from `RADIUS`, `vendorShadows` from `SHADOWS`, `vendorTypography` from `TYPE`. The two status maps (`darkStatusMap` at line 172 and `lightStatusMap` at line 188) are replaced by `ORDER_STATUS.dark` and `ORDER_STATUS.light` from `tokens.js`. The status **labels** returned by `getStatusLabel` and `getPaymentStatusLabel` are strings a user reads, so they do not change.
- **D-09:** The old customer and vendor status maps disagreed on `preparing` in dark mode. `ORDER_STATUS` resolves that. This is a bug fix that happens to be a colour, and it is allowed.

### customerTheme

- **D-10:** `PalengkeHubFinal-main/src/theme/customerTheme.js` is dead except for one export. Reduce it to `customerGradients` only, and have that derive from `COLORS`. Delete `customerColors`, `useCustomerColors`, `customerSpacing`, `customerBorderRadius`, `customerShadows`, `useCustomerTypography`, `getStatusColor`, `getStatusColorForTheme`, `getStatusLabel` and the status maps.
- **D-11:** The only consumer of `customerGradients` is `PalengkeHubFinal-main/src/components/ModernButton.js` line 18. Note that `ModernButton.js` is imported by nothing in `src/`, and its line 16 reads `import { Ionicons } from '@expo/vector/icons';` which is not a real package. Do not fix that import in this phase and do not delete the file in this phase. Just keep `customerGradients` alive so nothing regresses, and log the finding.
- **D-12:** `PalengkeHubFinal-main/src/theme/adminTheme.js` is 0 bytes. Leave it. Deleting an empty file is not worth a code review.

### The 14 local SPACING and RADIUS blocks

- **D-13:** Delete the local `const SPACING` and `const RADIUS` declarations in all 14 files listed under Existing Code Insights below, and import from `tokens.js` instead.
- **D-14:** Eleven of the blocks are byte identical, so the mapping is mechanical. The three exceptions are called out individually in D-15, D-16 and D-17 and are the only places where a real pixel value moves.
- **D-15:** The two navigation files, `PalengkeHubFinal-main/src/components/BottomNavigation.js` (block at line 29) and `PalengkeHubFinal-main/src/components/vendor/VendorBottomNavigation.js` (block at line 39), declare a tighter scale of `4 / 6 / 8 / 12 / 16`. That is exactly `NAV_SPACING` in `tokens.js`. Import `NAV_SPACING` in those two files, not `SPACING`. No pixel moves.
- **D-16:** The common radius block is `sm: 8, md: 12, lg: 16, xl: 20, xxl: 24`. `tokens.RADIUS` is `xs: 6, sm: 10, md: 12, lg: 16, xl: 22, full: 999`. Map it like this:

  | Old local value | New token | Pixel change |
  |---|---|---|
  | `RADIUS.sm` (8) | `RADIUS.sm` (10) | +2px on chips and small buttons. Accepted, this is the design. |
  | `RADIUS.md` (12) | `RADIUS.md` (12) | none |
  | `RADIUS.lg` (16) | `RADIUS.lg` (16) | none |
  | `RADIUS.xl` (20) | `RADIUS.xl` (22) | +2px on sheets and modals. Accepted. |
  | `RADIUS.xxl` (24) | `RADIUS.xl` (22) | -2px. `xxl` does not exist in the system. Accepted. |

- **D-17:** `PalengkeHubFinal-main/src/screens/customer/HomeScreen.js` is the odd one out. Its `RADIUS` block at line 50 is `sm: 12, md: 16, lg: 20, xl: 24`, one step larger than every other file. Map it by **meaning**, not by name:

  | HomeScreen local | Value | New token | Value |
  |---|---|---|---|
  | `RADIUS.sm` | 12 | `RADIUS.md` | 12 |
  | `RADIUS.md` | 16 | `RADIUS.lg` | 16 |
  | `RADIUS.lg` | 20 | `RADIUS.xl` | 22 |
  | `RADIUS.xl` | 24 | `RADIUS.xl` | 22 |

  Getting this backwards would make every home screen corner noticeably rounder. Check the home screen screenshot carefully.

### The two rogue COLORS objects

- **D-18:** `PalengkeHubFinal-main/src/screens/auth/SignUpScreen.js` declares its own `const COLORS` at line 31. It is a private copy of the old light palette, so that screen never follows dark mode. Delete it and use `useColors()` from `ThemeContext`, the same way the other 34 files do. This does fix dark mode on the sign-up screen, which is a visible change, and it is intended.
- **D-19:** `PalengkeHubFinal-main/src/components/vendor/VendorBottomNavigation.js` declares its own `const COLORS` at line 21 built on the Material red family (`primary: '#C62828'`, `primaryLight: '#E53935'`, `primaryDark: '#B71C1C'`, `primarySurface: '#FFEBEE'`). Delete it and use `useColors()`. Its `text.active` and `text.inactive` keys map to `COLORS.primary` and `COLORS.text.quaternary`.
- **D-20:** `#C62828` also appears in `EmptyState.js`, `Header.js`, `ProductDetailsScreen.js`, `ReportIssueScreen.js` and four admin screens. Only fix the ones in `VendorBottomNavigation.js` in this phase. `EmptyState.js` and `Header.js` belong to phase 3, `ProductDetailsScreen.js` to phase 6, and the admin screens are out of scope.

### Claude's Discretion

- Whether `vendorColors` is written as a plain re-export or as an explicitly spelled out object. Prefer whichever produces the smaller diff.
- Import ordering and where exactly in the import block `tokens` goes.
- Whether to touch `SPACING` and `RADIUS` in one plan or two.

</decisions>

<specifics>
## Specific Ideas

- Jhay wrote `src/theme/motion.js` himself and it is genuinely good. Say so, and follow its shape.
- The acceptance test everyone can run: open the app before and after, on the same screen, and the **only** difference should be colour and at most 2px of corner radius. If anything moved, something went wrong.
- `TYPE.size` and `TYPE.weight` can be adopted in this phase with zero visual risk, because no font is loaded anywhere in the app today. Every string already renders in the platform default and will keep doing so. Adopting them now means phase 07 is a two-line change instead of a rewrite.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The design system
- `06-adoption/DESIGN-SYSTEM.md` - the whole rationale. Read "The token philosophy: the logo decides", "The three red families, resolved", "Old value to new token: the top 20" and "How ThemeContext stays working".
- `06-adoption/tokens.js` - the file being copied. `COLORS`, `ORDER_STATUS`, `SPACING`, `NAV_SPACING`, `RADIUS`, `SHADOWS`, `PRESS_OFFSET`, `TYPE`, `TEXT_STYLES`, `LAYOUT`.
- `06-adoption/design-system.html` section `#colors`, `#spacing`, `#radius`, `#elevation` - what the values look like when rendered.

### Existing code that defines the current behaviour
- `PalengkeHubFinal-main/src/contexts/ThemeContext.js` - the runtime source of truth today.
- `PalengkeHubFinal-main/src/theme/motion.js` - the file-shape convention to copy.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PalengkeHubFinal-main/src/contexts/ThemeContext.js`: the provider and both hooks are good and stay. Only the data they serve changes.
- `PalengkeHubFinal-main/src/theme/motion.js`: exports `MOTION` plus six haptic helpers. Correct already, untouched.

### Established Patterns
- Styling is `StyleSheet.create` per file, called in 80 of the 114 files under `PalengkeHubFinal-main/src/`. That pattern stays. This project does not introduce a styling library.
- Theme-aware colours are read with `const COLORS = useColors();` inside the component, then referenced in inline style arrays. That pattern stays.

### The 14 files with local SPACING and/or RADIUS blocks

All paths from the repo root.

1. `PalengkeHubFinal-main/src/components/BottomNavigation.js` - SPACING at line 29, the tighter nav scale, use `NAV_SPACING`
2. `PalengkeHubFinal-main/src/components/CheckoutContent.js`
3. `PalengkeHubFinal-main/src/components/Header.js` - SPACING at line 24, the common scale
4. `PalengkeHubFinal-main/src/components/vendor/VendorBottomNavigation.js` - SPACING at line 39, the tighter nav scale, use `NAV_SPACING`
5. `PalengkeHubFinal-main/src/screens/customer/CategoryProductsScreen.js` - SPACING at line 31, RADIUS at line 41
6. `PalengkeHubFinal-main/src/screens/customer/CheckoutScreen.js`
7. `PalengkeHubFinal-main/src/screens/customer/HomeScreen.js` - RADIUS at line 50, the shifted scale, see D-17
8. `PalengkeHubFinal-main/src/screens/customer/OrdersScreen.js`
9. `PalengkeHubFinal-main/src/screens/customer/StallDetailsScreen.js`
10. `PalengkeHubFinal-main/src/screens/customer/StallMap.js`
11. `PalengkeHubFinal-main/src/screens/vendor/VendorDashboardScreen.js`
12. `PalengkeHubFinal-main/src/screens/vendor/VendorOrdersScreen.js`
13. `PalengkeHubFinal-main/src/screens/vendor/VendorProductsScreen.js`
14. `PalengkeHubFinal-main/src/screens/vendor/VendorProfileScreen.js`

### Integration Points
- `tokens.js` is imported by `ThemeContext.js`, `vendorTheme.js`, `customerTheme.js` and the 14 files above. Nothing else in this phase.
- `PalengkeHubFinal-main/src/theme/vendorTheme.js` is imported by 15 files. None of them change in this phase, because no export name changes.

</code_context>

<non_goals>
## NON-GOALS (do not do these, in this phase or any phase)

- **No data fetching changes.** No new Supabase query, no changed query, no changed table, no new field selected, no caching change.
- **No routing or navigation changes.** No new screen, no renamed route, no changed navigation target, no changed deep link.
- **No state changes.** No new context, no new hook that holds state, no changed `useState` shape, no new reducer.
- **No API changes.** No new endpoint, no changed payload, no changed auth flow.
- **No new dependency.** Not one. `expo-font` waits for phase 07.
- **No i18n key changes.** Every `t('...')` key stays exactly as it is. Translated strings are not design.
- **No layout changes in this phase specifically.** No element moves, resizes, reorders or disappears. Only colour values and the radius mappings in D-16 and D-17.
- **Out of scope entirely:** `PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js` (251 KB, 547 hexes, admin only). Do not open it, do not migrate it, do not let a search-and-replace touch it.
- **Do not touch** `PalengkeHubFinal-main/www/`, `pages-deploy/`, or the existing `PalengkeHubFinal-main/landingpage-website/` files.

</non_goals>

<acceptance>
## Acceptance Criteria

The phase passes when all of these are true:

1. `PalengkeHubFinal-main/src/theme/tokens.js` exists and matches the design system copy.
2. `ThemeContext.js` has no local `COLORS` literal, and its provider, hooks, `@palengkehub_theme` key and system-scheme follow are byte identical to before.
3. Searching `PalengkeHubFinal-main/src/` for `const SPACING = {` and `const RADIUS = {` returns zero results.
4. Searching `PalengkeHubFinal-main/src/screens/auth/SignUpScreen.js` and `src/components/vendor/VendorBottomNavigation.js` for `const COLORS = {` returns zero results.
5. `#C62828` no longer appears in `VendorBottomNavigation.js`.
6. The app builds and runs: `cd PalengkeHubFinal-main && npm run web` starts without an error.
7. **The app renders identically except that colours now flow from tokens.** Same screens, same data, same navigation, same element positions. Corner radii may differ by up to 2px per D-16 and D-17, and the sign-up screen now follows dark mode per D-18.

</acceptance>

<screenshots>
## Before and After Screenshot Checklist

Run `cd PalengkeHubFinal-main && npm run web` (port 8082). Capture each screen at **375px** and at **1440px** browser width, before you start and again after execute finishes. Attach all of them to the PR.

- [ ] Customer home
- [ ] Product detail (any product)
- [ ] Search results
- [ ] PalengKart (cart)
- [ ] Sign up (this one changes the most, it gains dark mode)
- [ ] Vendor dashboard
- [ ] Vendor bottom bar (visible on any vendor screen, watch the red go orange)
- [ ] One screen in dark mode, to confirm the dark palette still resolves

</screenshots>

<rollback>
## Rollback Rule

If, after this phase, any screen loads different data, navigates somewhere different, crashes, or has an element in a different position: **revert the whole phase.**

```
git checkout design-system
git branch -D design/phase-01-tokens
```

Do not patch forward. Do not "just fix the one screen". Re-plan the phase with the failure written into the context. The phase is small on purpose so that throwing it away costs an afternoon, not a week.

</rollback>

<deferred>
## Deferred Ideas

- Replacing the remaining hardcoded `#C62828` in `EmptyState.js` and `Header.js`: phase 3.
- The 84 `LinearGradient` components across 40 files: phases 3 to 6, screen by screen.
- Deleting `ModernButton.js` and the last of `customerTheme.js`: after phase 6, once it is confirmed nothing imports them.
- Fixing the broken `@expo/vector/icons` import in `ModernButton.js:16`: not a design change, log it for the team.
- `expo-font` and the real font families: phase 07.

</deferred>

---

*Phase: 01-tokens*
*Context authored: 2026-08-27*

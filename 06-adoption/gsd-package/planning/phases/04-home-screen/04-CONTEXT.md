# Phase 4: Home Screen - Context

**Gathered:** 2026-08-27 (hand authored, no discuss step needed)
**Status:** Ready for planning

**Branch:** `design/phase-04-home-screen`

<domain>
## Phase Boundary

One file: `PalengkeHubFinal-main/src/screens/customer/HomeScreen.js`. It is the biggest single screen in the app and the first thing a buyer sees.

The screen keeps every section it has today, in the same order, fed by the same queries. What changes is the search header (gradient becomes flat), the cards (phase 2 primitives), and one addition: the round category chip row the app does not have yet.

</domain>

<decisions>
## Implementation Decisions

### Search header

- **D-01:** The search header is currently a `LinearGradient` from `colors.primary` to `colors.primaryLight` (around line 762). Replace it with a **flat** fill. Mainstream commerce apps use flat fills; a two-stop orange gradient is the single most "vibe coded" thing on the screen.
- **D-02:** The header surface becomes `COLORS.surface` (`#FFFDFA`) sitting on the `COLORS.background` page (`#F2E7D6`), with a 1px `COLORS.border` hairline. The search field itself is the pill: `COLORS.inputBg` fill, `RADIUS.full`, height `LAYOUT.searchHeight` (50), collapsing to `LAYOUT.searchHeightScrolled` (44) on scroll if you want the collapse; the collapse is optional.
- **D-03:** The `StatusBar` at line 760 is currently `barStyle="light-content"` with `backgroundColor={colors.primary}`. On a warm white header that is unreadable. Drive it from `COLORS.statusBar`, which is `'dark'` in the light theme and `'light'` in the dark theme.
- **D-04:** The search control stays a `TouchableOpacity` that navigates to the `Search` screen. It is not a live input on this screen. Do not turn it into one; that would be a behaviour change.
- **D-05:** The `TypewriterPlaceholder` component that cycles search phrases stays. Keep the props (`phrases`, `typingSpeed`, `deletingSpeed`, `pauseDelay`). Restyle the text to `TEXT_STYLES.body` in `COLORS.text.tertiary`. **It must respect reduced motion:** if the platform reports reduce-motion, render the first phrase statically instead of animating.
- **D-06:** The notification bell and its badge stay exactly where they are, restyled per the phase 3 badge rules.
- **D-07:** The scan icon inside the search pill currently does nothing visible. Leave it exactly as it is. Do not wire it up, do not remove it.

### The category chip row (the one addition)

- **D-08:** `design-system.html#category-chip` calls this "the round chip row that the app is missing today". Add it directly under the search header.
- **D-09:** Chips are round, Tagalog label first, English underneath, because that is how the market is spoken. Six chips, matching the six keys already defined in `CATEGORY_CONFIG` at `PalengkeHubFinal-main/src/screens/customer/CategoryProductsScreen.js` lines 52 to 83:

  | Route param (frozen) | Tagalog label | English label | Existing Ionicons name |
  |---|---|---|---|
  | `Vegetables` | Gulay | Vegetables | `leaf` |
  | `Meat` | Karne | Meat | `restaurant` |
  | `Fruits` | Prutas | Fruits | `basket` |
  | `Poultry` | Manok | Poultry | `egg` |
  | `Rice` | Bigas | Rice | `cafe` |
  | `Other` | Iba pa | Other | `apps` |

  The Tagalog word is **display only**. The value passed as `categoryName` must remain the exact English string, because `CategoryProductsScreen` line 406 filters `.eq('category', categoryName)` against the database.

- **D-10:** The section title uses the existing i18n key `t('home.shop_by_category')`. That key already exists in `src/i18n/en.json` and `fil.json` and is currently unused. **No new i18n key is added.**
- **D-11:** **READ THIS ONE CAREFULLY.** Tapping a chip navigates to `navigation.navigate('CategoryProducts', { categoryName })`. That route is already registered in `App.js` at line 463 and the screen already exists, but **nothing in the app currently navigates to it**. So this chip row is the one and only place in this entire project where new navigation is introduced.

  Because of that:
  - It ships as its own plan, `04-03`, so it can be dropped without touching the rest of the phase.
  - It requires Jhay's explicit yes at the plan gate. If he says no, skip plan `04-03` and everything else in phase 4 still works.
  - It adds no new route, no new screen, no new param shape and no new query. It is a new door into a room that was already built and already furnished.

### The six existing sections

- **D-12:** All six sections stay, in this exact order, from the exact same i18n keys and the exact same data:

  1. `t('home.todays_deals')` around line 850
  2. `Recently Viewed` around line 904 (a hardcoded literal, not an i18n key)
  3. `t('home.buy_again')` around line 942
  4. `t('home.price_drop_alert')` around line 1005
  5. `t('home.top_rated_stalls')` around line 1036
  6. `t('home.market_stalls')` around line 1070

- **D-13:** Each section heading uses `TEXT_STYLES.h2` in `COLORS.text.primary`, with a `Tingnan Lahat` action on the right where a "see all" already exists today (the key `t('home.see_all')` already exists). Do not add a see-all where there was not one.
- **D-14:** Product rails use the phase 2 product card. Stall rails use the stall card from `design-system.html#stall-card`: photo, name, rating with review count, section and stall number, then a **price range bar**. The price range is what tells a shopper whether the stall is worth walking to. Only render the range where the screen already has the price data; do not fetch more.
- **D-15:** Section spacing is `SPACING.xxxl` (32) between sections, `SPACING.lg` (16) as the screen gutter, `SPACING.md` (12) between cards in a rail.

### Promo banner

- **D-16:** If a promo banner exists on this screen, it follows `design-system.html#promo-banner`: a photograph, an ink scrim from the bottom, an orange kicker and two lines of copy. **No gradient mesh, no floating 3D shape.** The scrim is the only surviving gradient in the entire system.

### Gradients and shadows

- **D-17:** `HomeScreen.js` has 2 `LinearGradient` uses. Both go flat. Across the app there are 84 in 40 files; this phase only owns the two in this file.
- **D-18:** No card on this screen has a drop shadow. If a section currently uses a shadow to separate a card from the page, delete the shadow. The warm white on woven paper contrast does that job.

### Claude's Discretion

- Whether the search header collapses on scroll (D-02) or stays fixed height.
- Chip diameter, within the 42px minimum for a tappable chip.
- Where the promo banner sits relative to the category chips, if there is one.
- Skeleton loading visuals, as long as they use `COLORS.surfaceSecondary`.

</decisions>

<specifics>
## Specific Ideas

- The two-second test: a Filipino shopper opens this screen and knows within two seconds that this is a shopping app for their palengke. Search on top, categories, deals, stalls. Nothing clever.
- The gradient header is the highest-value single change in the whole project. It is what makes the current app look like a template.
- Tagalog first on the chips is not decoration. `Gulay` is what people say. `Vegetables` underneath is the safety net.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component contracts
- `06-adoption/design-system.html#search` - the pill search field, first thing on the home screen
- `06-adoption/design-system.html#category-chip` - the round chip row, Tagalog first
- `06-adoption/design-system.html#product-card` - the rail card
- `06-adoption/design-system.html#stall-card` - photo, name, rating, section and stall number, price range bar
- `06-adoption/design-system.html#presyo-card` - the Presyo Check card with the price gauge (see Deferred)
- `06-adoption/design-system.html#promo-banner` - photograph plus ink scrim, no mesh
- `06-adoption/design-system.html#carousel` - rail behaviour
- `06-adoption/design-system.html#empty` - section empty states

### Tokens
- `PalengkeHubFinal-main/src/theme/tokens.js` - `LAYOUT.searchHeight`, `LAYOUT.searchHeightScrolled`, `LAYOUT.screenGutter`, `COLORS.statusBar`, `SPACING`, `RADIUS`, `TEXT_STYLES`

### Existing code
- `PalengkeHubFinal-main/src/screens/customer/HomeScreen.js` - StatusBar at 760, gradient header at 762, search bar at 772, notification bell at 786, the six sections at 850 / 904 / 942 / 1005 / 1036 / 1070
- `PalengkeHubFinal-main/src/screens/customer/CategoryProductsScreen.js` lines 52 to 83 - `CATEGORY_CONFIG`, the six category keys and their Ionicons names
- `PalengkeHubFinal-main/App.js` line 463 - the registered `CategoryProducts` route
- `PalengkeHubFinal-main/src/i18n/en.json` and `fil.json` - the `home.*` keys, including the unused `shop_by_category`
- Phase 2 primitives in `PalengkeHubFinal-main/src/components/ui/`, and `src/components/ProductCard.js`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ProductCard.js` is already consumed by this screen. Rebuilt in phase 2, so the rails largely come along for free.
- `TypewriterPlaceholder` is defined inside `HomeScreen.js` around line 58. Keep it, restyle it, add the reduced-motion guard.
- `src/i18n/en.json` already contains `home.shop_by_category`, `home.see_all`, `home.market_open`, `home.market_closed` and the three greeting keys. Several are unused. Reuse them rather than adding keys.

### Established Patterns
- Rails are horizontal `FlatList` or `ScrollView`. Keep whichever each section uses.
- Section visibility is conditional on the data being non-empty. Keep those conditions exactly.

### Integration Points
- Every section's data comes from Supabase via existing calls in this file. None of them change.
- The `Search` and `Notifications` routes are already navigated to from here. Those calls are frozen.
- `CategoryProducts` is registered but unreached. See D-11.

</code_context>

<non_goals>
## NON-GOALS

- **No data fetching changes.** Not one query touched. Not one new field selected. Not one changed filter. If a design needs data the screen does not already have, the design loses.
- **No routing changes**, with the single, explicitly flagged exception in D-11, which is opt-in and lives in its own plan.
- **No state changes.** No new context, no new store, no changed data shape.
- **No API changes.**
- **No new dependency.**
- **No new i18n keys and no changed translations.** Reuse the keys that already exist.
- **No section reordering, no section removal, no new section** beyond the category chip row.
- **No greeting header.** The `good_morning` / `good_afternoon` / `good_evening` keys exist but nothing computes the time of day. Adding that is new logic. Deferred.
- **No market open-or-closed pill.** Same reason, see phase 3 D-08.
- **Out of scope:** `PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js`.

</non_goals>

<acceptance>
## Acceptance Criteria

1. `grep -c "<LinearGradient" PalengkeHubFinal-main/src/screens/customer/HomeScreen.js` returns 0.
2. The status bar is readable against the new header in both light and dark theme.
3. A round category chip row renders under the search header with six chips, Tagalog above English, and its title comes from `t('home.shop_by_category')`.
4. If plan 04-03 shipped: tapping `Gulay` opens `CategoryProducts` with `categoryName: 'Vegetables'` and the list is not empty. If plan 04-03 was skipped: the chips render and are not tappable, or the row is absent entirely. Both are acceptable outcomes; a chip that looks tappable and does nothing is not.
5. All six sections render, in the same order, with the same data as before.
6. No card on the screen has a drop shadow.
7. Every rail scrolls the same way it did before.
8. With reduce-motion enabled, the typewriter placeholder is static.

</acceptance>

<screenshots>
## Before and After Screenshot Checklist

`cd PalengkeHubFinal-main && npm run web`, capture at **375px** and **1440px**, before and after. This is the phase where screenshots matter most.

- [ ] Home, top of screen, scroll position 0 (the header change)
- [ ] Home, scrolled to Today's Deals
- [ ] Home, scrolled to Market Stalls
- [ ] Home, full-page capture at 375px, top to bottom
- [ ] Home in dark mode, top of screen
- [ ] Home with a slow connection or empty data, so the skeletons and empty states are visible
- [ ] The category chip row, close up
- [ ] `CategoryProducts` after tapping `Gulay`, if plan 04-03 shipped

</screenshots>

<rollback>
## Rollback Rule

If any section disappears, reorders, shows different data, stops scrolling, or a tap goes somewhere new that was not D-11: revert the whole phase.

```
git checkout design-system
git branch -D design/phase-04-home-screen
```

Do not patch forward. This screen is big enough that a partial fix will hide a second bug.

</rollback>

<deferred>
## Deferred Ideas

- **The Presyo Check card** (`design-system.html#presyo-card`), showing the cheapest price for a product today plus a gauge where the fill is that price and the ink tick is the market average. It is the best idea in the design system for this screen, and it needs a market-average value the home screen does not currently query. Do it as its own phase after 06, with the data work planned honestly rather than smuggled into a design phase.
- The greeting header driven by time of day, using the three existing i18n keys.
- The market open-or-closed pill, using the two existing i18n keys plus real market-hours state.
- Wiring up the scan icon in the search pill.
- Replacing the hardcoded `Recently Viewed` literal with an i18n key.

</deferred>

---

*Phase: 04-home-screen*
*Context authored: 2026-08-27*

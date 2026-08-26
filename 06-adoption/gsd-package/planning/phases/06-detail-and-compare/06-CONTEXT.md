# Phase 6: Detail And Compare - Context

**Gathered:** 2026-08-27 (hand authored, no discuss step needed)
**Status:** Ready for planning

**Branch:** `design/phase-06-detail-and-compare`

<domain>
## Phase Boundary

One file: `PalengkeHubFinal-main/src/screens/customer/ProductDetailsScreen.js`.

This is the screen where PalengkeHub's whole reason for existing already lives, and where it is currently buried. The price comparison block sits at line 944, roughly eight hundred lines of markup below the product image, under a heading that says `Market Analytics`. A shopper who wants to know which stall is cheapest has to scroll past everything to find out.

This phase does two things: it promotes price comparison to the top of the screen, and it finishes the unit fix that phase 5 started.

</domain>

<decisions>
## Implementation Decisions

### Promote the comparison

- **D-01:** Reorder the screen so that, at 375px with no scrolling, the buyer sees: the product image, the product name in both languages, the price with its unit, the verdict chip, and the top of the stall comparison roster. The full roster can continue below the fold; what must be visible is that a comparison exists and who is winning.
- **D-02:** Reordering sections inside one `ScrollView` is layout. It is in scope. Nothing is added, removed or refetched, only moved.
- **D-03:** Rename the heading at line 946 from `Market Analytics` to **`Presyo Check`**. `Market Analytics` is an admin phrase on a shopper screen. `Presyo Check` is what the design system calls this feature everywhere else, including the empty-state copy in `design-system.html#empty`.
- **D-04:** The price uses `TEXT_STYLES.priceHero` (38, weight 900, letter spacing -0.4). The unit sits beside it at `TYPE.size.caption` in `COLORS.text.tertiary`. Formatting is unchanged: `₱` then `toFixed(2)` then `/ unit`.
- **D-05:** The verdict chip next to the price is computed from the roster in `marketAnalytics.sorted`, using the same one function the cards and the compare rows use. If `marketAnalytics` is null, which happens when `marketProducts` is empty, **no chip renders**. See `design-system.html#verdict`.

### The comparison roster

- **D-06:** Each roster row uses the price compare row from `design-system.html#price-compare`, the same component phase 5 built for `SearchScreen`. One component, two screens.
- **D-07:** The `Cheapest` and `Most Expensive` vendor cards at lines 999 to 1026 keep their meaning. `Cheapest` becomes the `Pinakamura` badge in its solid form. `Most Expensive` becomes the `Mahal` verdict styling. The hardcoded `#2E7D32` and `#C62828` in those blocks become `verdictBestBg` / `verdictCheapText` and `verdictDearText`.
- **D-08:** The KPI grid at lines 960 to 996 keeps all five values: Lowest Price, Highest Price, Average Price, Price Difference, Total Vendors. Restyle as stat cards per `design-system.html#stats`. **Every price KPI gains its unit**, for example `Lowest price / kg`, because a peso figure with no unit is not a price.
- **D-09:** Row 1 of the roster (line 1079, `isCheapest`) carries the `Pinakamura` badge. Only row 1. It is a superlative.
- **D-10:** The full roster may move into a bottom sheet per `design-system.html#compare-sheet` (sort chips at the top, a savings line and a stall action at the bottom) if that reads better at 375px. That is a presentation choice, not a behaviour change, as long as the same rows with the same data are reachable.

### The unit fix, part two

- **D-11:** **READ THIS ONE CAREFULLY. It is the only place in the project where a displayed number may change.**

  `computeMarketAnalytics()` at line 639 takes every product in `marketProducts`, sorts by raw `price`, and computes `minPrice`, `maxPrice`, `avgPrice`, `priceDiff`, `priceDiffPercent`, `cheapestVendor`, `mostExpensiveVendor` and `belowAverage` from that. It never looks at `unit`.

  So if one stall sells tomatoes at `₱60 / kilo` and another sells them at `₱35 / bundle`, the screen currently tells the shopper the lowest price is 35 pesos and the average is about 47. Both numbers are meaningless, and the bundle stall gets crowned `Cheapest`.

  **The fix:** treat the unit of the product being viewed as the reference unit. Compute the roster, the KPIs and the ranking from the rows whose `unit` matches the reference unit. Rows with a different unit still appear, in their own group labelled `Ibang unit`, with their real price and their real unit, and they are excluded from the KPIs, the ranking and the badges.

  What this means in practice:
  - No price value changes. Every stall's price renders exactly as it did.
  - `minPrice`, `maxPrice`, `avgPrice`, `priceDiff` and `priceDiffPercent` **may change**, because they were previously computed across incomparable things.
  - Which stall is crowned `Pinakamura` may change.
  - Nothing is refetched. `marketProducts` is already in memory; this is a filter over existing state.

- **D-12:** Because D-11 can visibly change a number, it ships as its own plan, `06-02`, and it needs Jhay's explicit yes at the plan gate. If he wants to think about it, `06-01` still delivers the promotion and the restyle on its own.
- **D-13:** When every row shares the same unit, which is the common case, **nothing changes at all**. The fix is invisible except exactly where it was wrong. Say that in the PR description.
- **D-14:** Apply the same reference-unit rule to the `SearchScreen` comparison rows if phase 5 left any gap. Phase 5 D-13 handled the badge; this is the KPI and ordering half.

### Colour and structure cleanup

- **D-15:** This file uses a `darkMode && styles.somethingDark` pattern in parallel with `useColors()`. Prefer `useColors()`, because it already resolves light and dark from tokens. Removing a `styles.xDark` variant is fine when the base style becomes theme aware; **do not** remove a dark variant and leave a hardcoded light value behind.
- **D-16:** Replace every hardcoded hex in this file, including `#C62828`, `#2E7D32` and `#E65100` (line 985). Every one becomes a token.
- **D-17:** Both `LinearGradient` uses in this file go flat.
- **D-18:** The action row at lines 1218 onward becomes the sticky action bar from `design-system.html#action-bar`: the running total on the left, one orange CTA filling the rest. Per the design system it **replaces** the tab bar rather than stacking on top of it. If this screen does not currently show a tab bar, nothing to replace, just make the bar sticky.
- **D-19:** `addToCart(cartProduct, stall.id, stall, quantity)` at lines 446 and 539 is frozen. Same function, same arguments, same cart shape.

### Claude's Discretion

- Bottom sheet versus inline roster (D-10).
- Whether the KPI grid is 5 stat cards or a 2 by 3 arrangement.
- How the `Ibang unit` group is visually separated, as long as a shopper cannot mistake it for part of the ranking.
- Price history and trend visuals, as long as no new data is fetched.

</decisions>

<specifics>
## Specific Ideas

- Jhay's own answer to "what is the number one thing users do" was **compare prices and browse stalls**. This screen is where that promise is kept or broken. Everything else in the project has been setting up for this phase.
- `Presyo Check` is a better name than `Market Analytics` for exactly the same reason `PalengKart` is a better name than `Cart`. It is the app speaking the market's language.
- The unit bug is the difference between a price comparison app and a price comparison shaped app. Fix it.
- When the roster has one stall, there is nothing to compare. Say so plainly and offer the next step, do not render an empty comparison shell.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component contracts
- `06-adoption/design-system.html#price-compare` - the roster row. Note: "the listed price appears too when the vendor sells by a different unit"
- `06-adoption/design-system.html#compare-sheet` - the full roster as a bottom sheet, sort chips at the top, savings line and stall action at the bottom
- `06-adoption/design-system.html#verdict` - "no screen may claim a verdict its own roster does not support"
- `06-adoption/design-system.html#pinakamura` - solid form, rank one only
- `06-adoption/design-system.html#action-bar` - "the running total sits left, one orange CTA fills the rest. It replaces the tab bar rather than stacking on top of it"
- `06-adoption/design-system.html#stats` - the KPI cards
- `06-adoption/design-system.html#stall-card` - the stall attribution block
- `06-adoption/design-system.html#empty` - the one-stall case

### Tokens
- `PalengkeHubFinal-main/src/theme/tokens.js` - `TEXT_STYLES.priceHero`, the `verdict*` pairs, `SHADOWS.bar`, `SHADOWS.overlay`, `RADIUS.xl`

### Existing code
- `PalengkeHubFinal-main/src/screens/customer/ProductDetailsScreen.js` - `marketProducts` state at 217, `addToCart` at 242 / 446 / 539, `computeMarketAnalytics` at 639 to 684, the `ScrollView` at 717, the image at 732, the price row at 784, the `Market Analytics` heading at 946, the KPI grid at 960 to 996, the cheapest and most expensive cards at 999 to 1026, the roster at 1074 to 1140, the action row at 1218
- `PalengkeHubFinal-main/src/screens/customer/SearchScreen.js` - the sibling comparison rows and the phase 5 unit fix
- Phase 2 primitives and the phase 5 price compare row

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeMarketAnalytics()` already returns everything the design needs: `minPrice`, `maxPrice`, `avgPrice`, `priceDiff`, `priceDiffPercent`, `totalVendors`, `cheapestVendor`, `mostExpensiveVendor`, `belowAverage`, `outdated`, `unusual`, `sorted`. Keep the function, keep the return shape, add the reference-unit filter at the top.
- `outdated` (prices not updated in 7 days) and `unusual` (more than 20 percent from average) are already computed and are genuinely useful signals. If they are not currently surfaced, surfacing them is a design decision and is allowed, since the data is already there.
- The phase 5 price compare row is reused wholesale.

### Established Patterns
- This screen mixes `useColors()` with a `darkMode && styles.xDark` convention. Migrate toward `useColors()`, carefully, per D-15.
- All comparison work is client side over `marketProducts`, already in state. That is what makes D-11 a display fix rather than a data project.

### Integration Points
- `addToCart` from `useCart()`. Frozen.
- `route.params.productId`. Frozen.
- The Supabase calls that fill `marketProducts` and the price history. Frozen.

</code_context>

<non_goals>
## NON-GOALS

- **No data fetching changes.** `marketProducts`, the price history and the stall data all come from exactly the queries they come from now. The unit fix is a filter over data already in memory.
- **No routing changes.** No new screen, no changed navigation target.
- **No state changes.** No new context, no changed `marketProducts` shape, no changed cart shape. `addToCart(cartProduct, stall.id, stall, quantity)` keeps its four arguments.
- **No API changes.**
- **No new dependency.**
- **No i18n changes.**
- **No change to any individual stall's displayed price.** Only the aggregate KPIs may move, and only per D-11.
- **No real unit conversion.** We are not converting bundles to kilos. We are refusing to compare them. That is the honest fix and it costs nothing.
- **Out of scope:** `PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js`.

</non_goals>

<acceptance>
## Acceptance Criteria

1. At 375px with no scrolling: image, both names, price with unit, verdict chip, and the beginning of the stall roster are all visible.
2. The heading reads `Presyo Check`.
3. Every price KPI shows its unit.
4. Row 1 of the roster carries `Pinakamura`, and no other row does.
5. A product whose roster has one stall shows no verdict chip and no ranking, and says so plainly with one next-step action.
6. `grep -oE "#[0-9A-Fa-f]{6}" PalengkeHubFinal-main/src/screens/customer/ProductDetailsScreen.js` returns nothing.
7. `grep -c "<LinearGradient" PalengkeHubFinal-main/src/screens/customer/ProductDetailsScreen.js` returns 0.
8. If plan 06-02 shipped: on a product where every stall uses the same unit, every KPI is numerically identical to before. On a mixed-unit product, any changed KPI can be explained by pointing at the specific excluded row.
9. Adding to cart still adds the same thing, in the same quantity, to the same cart.
10. The action bar is sticky and does not stack on top of a tab bar.

</acceptance>

<screenshots>
## Before and After Screenshot Checklist

`cd PalengkeHubFinal-main && npm run web`, capture at **375px** and **1440px**, before and after. The 375px above-the-fold shot is the whole point of this phase, take it first.

- [ ] Product detail, 375px, scroll position 0. **The money shot.**
- [ ] Product detail, 375px, full page top to bottom
- [ ] Product detail, the Presyo Check block close up
- [ ] Product detail, the KPI cards
- [ ] Product detail for a product sold by only one stall
- [ ] Product detail for a mixed-unit product, before and after, with both KPI sets readable. **Required if plan 06-02 shipped.**
- [ ] The sticky action bar with a quantity above 1, so the running total is visible
- [ ] Product detail in dark mode
- [ ] 1440px, both states

</screenshots>

<rollback>
## Rollback Rule

If adding to cart behaves differently, any individual stall price renders differently, the roster loses a row, or a KPI changes on a product whose stalls all share one unit: revert the whole phase.

```
git checkout design-system
git branch -D design/phase-06-detail-and-compare
```

Do not patch forward. If only plan 06-02 is the problem, re-run the phase with 06-02 dropped; 06-01 stands on its own.

</rollback>

<deferred>
## Deferred Ideas

- **Real unit conversion** with a per-product weight table, so a bundle really can be compared to a kilo. That is a data project with a real research step. Plan it properly, later, on its own.
- **The Presyo Check card on the home screen** (`design-system.html#presyo-card`), with the gauge whose fill is the cheapest price and whose ink tick is the market average. Needs a market average on the home screen. Best done right after this phase, since this phase produces exactly that number.
- Surfacing `outdated` and `unusual` as shopper-facing signals, for example "this price has not been updated in 9 days".
- Distance to stall in the roster row.
- Replacing the synthetic `getStallRating` with real reviews. See `ADMIN-NOTES.md`.
- Deleting `ModernButton.js` and the remainder of `customerTheme.js`, once phases 2 to 6 have confirmed nothing imports them.

</deferred>

---

*Phase: 06-detail-and-compare*
*Context authored: 2026-08-27*

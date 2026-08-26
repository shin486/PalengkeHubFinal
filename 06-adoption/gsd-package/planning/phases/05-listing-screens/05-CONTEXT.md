# Phase 5: Listing Screens - Context

**Gathered:** 2026-08-27 (hand authored, no discuss step needed)
**Status:** Ready for planning

**Branch:** `design/phase-05-listing-screens`

<domain>
## Phase Boundary

Two files, the screens a buyer lands on after tapping a category or typing a search:

- `PalengkeHubFinal-main/src/screens/customer/CategoryProductsScreen.js`
- `PalengkeHubFinal-main/src/screens/customer/SearchScreen.js`

Both already do real work. Category products has a sort control and a per-stall filter. Search has a Tagalog fuzzy matcher and already renders a per-stall price comparison card. None of that logic changes. It gets the design system, and the comparison card gets the treatment it deserves.

</domain>

<decisions>
## Implementation Decisions

### Both screens

- **D-01:** Page background `COLORS.background`, cards `COLORS.card` with a 2px `COLORS.border` border and `SHADOWS.none`. Screen gutter `LAYOUT.screenGutter` (16).
- **D-02:** Headers use the phase 3 `Header` component where the screen already has a header, with the existing title. `CategoryProductsScreen.js` line 619 renders `{categoryName}` as the title. Keep it.
- **D-03:** All `LinearGradient` uses in both files go flat.
- **D-04:** Both screens use the phase 2 card, chip, badge, price and verdict primitives. Delete the local style blocks these replace.

### CategoryProductsScreen

- **D-05:** The sort control keeps **exactly** these four options, with these exact labels and these exact values, in this order (lines 380 to 385):

  | Label | Value |
  |---|---|
  | Recommended | `recommended` |
  | Lowest Price | `price_asc` |
  | Highest Rated Stall | `rating_desc` |
  | Recently Updated | `recent` |

  The sorting comparators at lines 501 onward are frozen. Restyle the control, do not touch what it does.

- **D-06:** The sort control is currently a modal with a list of options (`styles.modalOption` around line 749). Restyle it as a bottom sheet using `RADIUS.xl` (22) and `SHADOWS.overlay`, with the selected option marked. Keep the same options and the same selection behaviour.
- **D-07:** The per-stall filter (`selectedStall`, line 498) keeps its behaviour. Render it as a horizontal chip row above the grid, with an `all` chip first. Chips are at least 42px tall.
- **D-08:** The product grid is 2 columns at 375px, gap `SPACING.md` (12). At 1440px in the web build it widens to more columns rather than stretching two enormous cards. Widening the grid is layout, not routing, so it is in scope.
- **D-09:** The empty state at line 694 currently reads `No {categoryName} Available` with a follow-up line at 696. Keep the meaning, keep the one-action rule from `design-system.html#empty`.

### SearchScreen

- **D-10:** The Tagalog fuzzy matcher is the best thing in this file. It compares a query against a Tagalog dictionary first (line 421), then against English product names (line 432), then word by word (line 441), so `babow` finds `baboy` and `brest` finds `chicken breast`. **Do not touch any of it.** Not the dictionary, not the thresholds, not the order of the passes.
- **D-11:** The comparison card at lines 748 onward already shows: stall name, stall number, section, star rating with review count, the original price when there is a promotion, the price, the unit, a `PriceTrendBadge`, a promo badge, a quantity stepper and an add control. That is the right information. Restyle it as the price compare row from `design-system.html#price-compare`: rank, stall, section and number, rating, then the price and its verdict.
- **D-12:** Give the comparison card its verdict chip using the phase 2 primitive. The verdict is computed from the roster of stalls selling that product, which this screen already builds as `groupItems` at line 742. A product with only one stall in the roster gets **no chip**.
- **D-13:** **The unit bug, part one.** Line 743 currently reads:

  ```
  const isCheapest = groupItems.length > 0 && product.price === Math.min(...groupItems.map(i => i.data.price));
  ```

  That compares raw numbers across stalls that may be selling by different units. A stall selling tomatoes at 35 pesos per bundle beats a stall selling them at 60 pesos per kilo, and the app awards it a `Best Deal` ribbon that is simply false.

  The fix is display-layer and it is narrow: **only compare within the same `unit` string.** Filter `groupItems` to those whose `data.unit` matches `product.unit`, then take the minimum of that subset. Rows whose unit differs are still shown, still with their real price and their real unit, but they are not ranked against a different unit and they cannot win the badge.

  This changes which row gets a badge. It does not change any price, any query, any sort order, or which rows appear. Part two is in phase 6.

- **D-14:** The `Best Deal` ribbon becomes the `Pinakamura` badge in its solid form (`verdictBestBg` fill, `verdictBestText` text), per `design-system.html#pinakamura`. It is a superlative: only one row per product may carry it.
- **D-15:** The quantity stepper follows `design-system.html#stepper`. Keep `onChange(delta)` and the `quantities[product.id]` state shape exactly as they are.
- **D-16:** Search results empty state says what to do next, never just "no results". Use the existing copy if there is any; otherwise a single literal plus one action.

### Claude's Discretion

- Whether the sort control is a bottom sheet or a dropdown, as long as the four options and their behaviour are identical.
- Grid column count at widths above 768px.
- Where the verdict chip sits inside the comparison row, as long as it is next to the price it describes.
- Skeleton visuals.

</decisions>

<specifics>
## Specific Ideas

- Search is where price comparison actually happens today, and it is the reason PalengkeHub exists. Treat this screen as the important one, not as a stepping stone to phase 6.
- The unit bug is small in code and large in trust. A shopper who walks to a stall because the app said `Best Deal` and finds it was comparing kilos to bundles does not come back.
- Do not be tempted to "improve" the fuzzy matcher while you are in there. It works, it is Tagalog aware, and it is not design.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component contracts
- `06-adoption/design-system.html#price-compare` - rank, stall, section and number, rating, distance, then the unit-normalized price and its verdict. The listed price appears too when the vendor sells by a different unit
- `06-adoption/design-system.html#verdict` - the computation contract. No screen may claim a verdict its own roster does not support
- `06-adoption/design-system.html#pinakamura` - solid form marks rank one inside a comparison
- `06-adoption/design-system.html#product-card` - the grid card
- `06-adoption/design-system.html#badges` - chip versus badge, the 42px rule
- `06-adoption/design-system.html#stepper` - the quantity stepper
- `06-adoption/design-system.html#drawer` and `#dropdown` - the sort control
- `06-adoption/design-system.html#empty` - one action only

### Tokens
- `PalengkeHubFinal-main/src/theme/tokens.js` - the `verdict*` pairs, `RADIUS.xl`, `SHADOWS.overlay`, `TEXT_STYLES.price`

### Existing code
- `PalengkeHubFinal-main/src/screens/customer/CategoryProductsScreen.js` - `CATEGORY_CONFIG` 52 to 83, `sortOptions` 380 to 385, the query at 406, the stall filter at 498, the comparators at 501 onward, the header title at 619, the sort label at 653, the modal options at 749, the empty state at 694
- `PalengkeHubFinal-main/src/screens/customer/SearchScreen.js` - the Tagalog matcher at 421 to 441, the price sorts at 589 and 654, `groupItems` and `isCheapest` at 742 to 743, the comparison card at 748 onward, the price and unit at 777 to 780, `PriceTrendBadge` at 782
- Phase 2 primitives in `PalengkeHubFinal-main/src/components/ui/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/PriceTrendBadge.js`: already takes `currentPrice` and `previousPrice`. Rebuilt in phase 2, so it arrives styled.
- `StarRating` and `getStallRating` already exist inside `SearchScreen.js`. Keep both.
- `QuantityStepper` already exists and works. Restyle only.
- `src/components/ProductCard.js` is already used by `CategoryProductsScreen.js`.

### Established Patterns
- Both screens sort and filter **client side**, over data already fetched. That is why the unit fix in D-13 is a display change and not a data change: the rows are already in memory, we are only changing which one gets a badge.
- Ratings on these screens are partly synthetic (`getRandomRatingCount`, `getStallRating`). That is a data-honesty problem, it is real, and it is **not** this project's job. See `ADMIN-NOTES.md`.

### Integration Points
- `SearchScreen` navigates to `ProductDetails` with `{ productId: product.id }` at line 751. Frozen.
- `CategoryProductsScreen` reads `route.params.categoryName` at line 364. Frozen.
- Both talk to Supabase through existing calls. Frozen.

</code_context>

<non_goals>
## NON-GOALS

- **No data fetching changes.** The Supabase queries at `CategoryProductsScreen.js:406` and in `SearchScreen.js` are untouched. No new field, no new filter, no new table.
- **No routing changes.** `ProductDetails` is still reached with `{ productId }`. No new screen.
- **No state changes.** `sortBy`, `selectedStall`, `quantities` and the search state keep their exact shapes.
- **No API changes.**
- **No new dependency.**
- **No i18n changes.**
- **No changes to the sort options, their labels, their values, or their comparators.**
- **No changes to the Tagalog fuzzy matching logic.**
- **No changes to any displayed price.** D-13 changes which row is badged, never what any row costs.
- **Out of scope:** `PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js`.

</non_goals>

<acceptance>
## Acceptance Criteria

1. Both screens use phase 2 primitives and have no local card, chip or badge styles left.
2. `grep -c "<LinearGradient"` on both files returns 0.
3. The sort control offers exactly the four options in D-05, in that order, and sorting a list produces the identical order it produced before.
4. The stall filter still filters to the same set.
5. The Tagalog matcher still finds `baboy` from `babow` and `chicken breast` from `brest`.
6. A comparison row carries a verdict chip only when the roster supports one, and a single-stall product carries none.
7. **The `Pinakamura` badge is only awarded among rows that share the same `unit` string.** Test it: find or create a product sold by `kilo` at one stall and by `bundle` at another, and confirm the cheaper-per-bundle row does not win.
8. Every price on screen is numerically identical to before.
9. Both screens work at 375px and widen sensibly at 1440px.

</acceptance>

<screenshots>
## Before and After Screenshot Checklist

`cd PalengkeHubFinal-main && npm run web`, capture at **375px** and **1440px**, before and after.

- [ ] Category products, Vegetables, default sort
- [ ] Category products, the sort control open
- [ ] Category products, a stall filter applied
- [ ] Category products, empty category
- [ ] Search, before typing
- [ ] Search results for a product sold by several stalls, so the comparison rows are visible
- [ ] Search results for a Tagalog misspelling, for example `babow`, proving the matcher still works
- [ ] Search results for a product with mixed units, if you can find one. This is the D-13 proof
- [ ] Search, no results
- [ ] Both screens in dark mode

</screenshots>

<rollback>
## Rollback Rule

If a sort produces a different order, a filter returns a different set, the Tagalog matcher misses a word it used to find, any price renders differently, or a tap navigates somewhere new: revert the whole phase.

```
git checkout design-system
git branch -D design/phase-05-listing-screens
```

Do not patch forward.

</rollback>

<deferred>
## Deferred Ideas

- **Real unit normalization**, meaning converting bundles and pieces to a comparable per-kilo figure. That needs a conversion table and real per-unit weights, which is a data project, not a design one. What phase 5 and 6 do instead is stop comparing across units at all, which is honest and costs nothing.
- Replacing the synthetic ratings with real review data. Backlog, flagged in `ADMIN-NOTES.md`.
- Distance to stall in the compare row, which `design-system.html#price-compare` shows. It needs location data the app does not have on these screens.
- The full compare sheet (`design-system.html#compare-sheet`): phase 6.

</deferred>

---

*Phase: 05-listing-screens*
*Context authored: 2026-08-27*

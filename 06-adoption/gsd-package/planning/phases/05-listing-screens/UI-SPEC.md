---
phase: 5
slug: listing-screens
status: authored
shadcn_initialized: false
preset: none
created: 2026-08-27
---

# Phase 5 - UI Design Contract

> `CategoryProductsScreen.js` and `SearchScreen.js`. Grid, filters, sort, and the price comparison rows.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Native `StyleSheet.create`) |
| Preset | PalengkeHub palengke identity, v1.0 |
| Component library | phase 2 primitives, `src/components/ProductCard.js`, `src/components/PriceTrendBadge.js` |
| Icon library | Ionicons |
| Font | none loaded yet (phase 7) |
| Reference | `06-adoption/design-system.html#price-compare`, `#verdict`, `#pinakamura`, `#product-card`, `#stepper`, `#drawer`, `#empty` |

---

## Screen Anatomy

**CategoryProductsScreen (375px, top to bottom)**
1. Header with the category name as the title (phase 3 `Header`)
2. Stall filter chip row, `all` chip first, horizontally scrollable, chips at least 42px tall
3. Sort control, one row, showing the current selection
4. Product grid, 2 columns, gap `SPACING.md`
5. Bottom tab bar

**SearchScreen (375px, top to bottom)**
1. Search field, pill, `inputBg` fill, `RADIUS.full`, height `LAYOUT.searchHeight`
2. Result group heading, the product name
3. Price compare rows, one per stall, ranked
4. Bottom tab bar

At 1440px the grid widens to more columns. The compare rows stay a single column and gain breathing room; they never become a table.

---

## Price Compare Row (the important one)

Left to right, per `design-system.html#price-compare`:

| Slot | Content | Style |
|---|---|---|
| Rank | `1`, `2`, `3` | `TEXT_STYLES.label`, `text.tertiary`. Rank 1 gets `verdictBestText` on `verdictBestBg` |
| Stall | stall name | `TEXT_STYLES.h3`, `text.primary` |
| Location | section and stall number, for example `Vegetable Section - #12` | `TEXT_STYLES.caption`, `text.tertiary` |
| Rating | stars plus value plus review count | star `gold`, text `TEXT_STYLES.caption` |
| Price | `₱60.00` | `TEXT_STYLES.price`, `text.primary` |
| Unit | `/ kg` | `TYPE.size.caption`, `text.tertiary` |
| Verdict | MURA / KATAMTAMAN / MAHAL chip | phase 2 verdict chip |
| Badge | `Pinakamura` on rank 1 only | solid form, `verdictBestBg` on `verdictBestText` |
| Trend | `PriceTrendBadge` | unchanged props |
| Promo | discount badge | `errorFill`, only when there is a promotion |

**Ranking rule:** rows are only ranked against rows that share the same `unit` string. A row with a different unit still renders, with its real price and its real unit, marked as a different unit rather than given a rank. It cannot win `Pinakamura`.

**Verdict rule:** a product whose roster has only one stall gets no verdict chip at all. Not KATAMTAMAN, not "n/a". Nothing.

---

## Spacing Scale

| Token | Value | Usage here |
|-------|-------|-------|
| `SPACING.xs` | 4px | rank to stall gap, star gaps |
| `SPACING.sm` | 8px | price to unit gap |
| `SPACING.md` | 12px | grid gap, gap between compare rows |
| `SPACING.lg` | 16px | screen gutter, row inner padding |
| `SPACING.xl` | 20px | card inner padding |
| `SPACING.xxl` | 24px | between result groups |

Exceptions: none.

---

## Typography

| Role | Token | Size | Weight |
|------|-------|------|--------|
| Result group heading | `TEXT_STYLES.h2` | 19 | 800 |
| Stall name | `TEXT_STYLES.h3` | 17 | 800 |
| Price | `TEXT_STYLES.price` | 19 | 900 |
| Struck original price | `TEXT_STYLES.caption` | 13 | 700, `text.tertiary`, line-through |
| Unit suffix | `TYPE.size.caption` | 13 | 700, `text.tertiary` |
| Section and stall number | `TEXT_STYLES.caption` | 13 | 700, `text.tertiary` |
| Sort control label | `TEXT_STYLES.label` | 14 | 800 |
| Filter chip label | `TEXT_STYLES.label` | 14 | 800 |
| Verdict chip | `TEXT_STYLES.chip` | 12 | 900, uppercase |

---

## Color

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Dominant (60%) | `background` | `#F2E7D6` | the page |
| Secondary (30%) | `card` | `#FFFDFA` | grid cards and compare rows |
| Accent (10%) | `primary` | `#E8833A` | the single add-to-cart CTA in a row, the active filter chip ring |
| Rank 1 fill | `verdictBestBg` | `#61802F` | the `Pinakamura` badge |
| Rank 1 text | `verdictBestText` | `#F7FBEF` | |
| MURA | `verdictCheapBg` / `verdictCheapText` | `#EDF3DE` / `#61802F` | |
| KATAMTAMAN | `verdictFairBg` / `verdictFairText` | `#F3E3CB` / `#5B4436` | deliberately quiet |
| MAHAL | `verdictDearBg` / `verdictDearText` | `#FBE2DE` / `#9E2B20` | the only red judgement in the app |
| Discount badge | `errorFill` | `#D34638` | |
| Border | `border` | `#E3CFB0` | 2px on every card and row |
| Sheet surface | `surface` | `#FFFDFA` | the sort bottom sheet |

**Accent reserved for:** the one add control per compare row, the active filter chip ring, and the focus ring on the search field. Not for prices, not for stall names, not for the rank number, not for the sort control.

---

## Elevation

| Element | Token |
|---|---|
| Grid card, compare row | `SHADOWS.none` |
| Sort bottom sheet | `SHADOWS.overlay`, `RADIUS.xl` (22) |
| Bottom tab bar | `SHADOWS.bar` |

---

## Copywriting Contract

| Element | Copy | Source |
|---------|------|--------|
| Sort options | `Recommended`, `Lowest Price`, `Highest Rated Stall`, `Recently Updated` | frozen literals at `CategoryProductsScreen.js:380-385` |
| Stall filter, all | `Lahat` | new literal, replaces whatever "all" reads as today |
| Rank 1 badge | `Pinakamura` | replaces the `Best Deal` literal at `SearchScreen.js:758` |
| Verdict chips | `Mura`, `Katamtaman`, `Mahal` | new literals, from the design system |
| Different unit marker | `Ibang unit` | new literal, on rows excluded from the ranking |
| Empty category heading | `Wala pang {categoryName} ngayon` | replaces the literal at `CategoryProductsScreen.js:694` |
| Empty category body | `Tingnan ang ibang kategorya o bumalik mamaya.` | replaces the literal at line 696 |
| Empty category action | `Tingnan ang lahat ng stall` | one action only |
| No search results heading | `Walang nahanap na "{query}"` | |
| No search results body | `Subukan ang ibang salita, o tingnan ang mga kategorya.` | says what to do next, never just "no results" |
| Error state | `Hindi ma-load ang presyo. Subukan ulit.` plus a retry control | |

All of these are hardcoded literals in the current code, not `t()` keys, so replacing them is copy work and not translation work. **Do not add or change anything in `src/i18n/en.json` or `fil.json`.**

---

## UI Considerations

Applicable state considerations resolved: 6 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | product grid | covered | Empty category copy in the Copywriting Contract, one action |
| empty | search results | covered | No-results copy names the query and offers a next step |
| empty | verdict chip | covered | A single-stall roster renders no chip at all |
| loading | grid and rows | covered | Skeletons at the real card dimensions, `surfaceSecondary` fill |
| error | both screens | covered | Error copy plus retry, does not blank the screen |
| populated | compare rows | covered | Rank, stall, location, rating, price, unit, verdict, trend, promo |
| partial | mixed units in one roster | backstop | Rows with a unit other than the reference unit render with `Ibang unit`, keep their real price, and are excluded from the ranking. **This is the correctness fix of the phase.** Verify with a real mixed-unit product at 375px |
| long-text | stall names and search queries | backstop | A 40+ character stall name truncates to 2 lines and never pushes the price out of the row. A long query in the no-results heading truncates with ellipsis |

**Reduced motion:** the sort bottom sheet opens without a spring when reduce-motion is on. Skeleton shimmer becomes a static fill.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

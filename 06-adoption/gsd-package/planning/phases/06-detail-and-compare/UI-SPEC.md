---
phase: 6
slug: detail-and-compare
status: authored
shadcn_initialized: false
preset: none
created: 2026-08-27
---

# Phase 6 - UI Design Contract

> `PalengkeHubFinal-main/src/screens/customer/ProductDetailsScreen.js`. Price comparison promoted to the top, unit fix finished.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Native `StyleSheet.create`) |
| Preset | PalengkeHub palengke identity, v1.0 |
| Component library | phase 2 primitives, plus the phase 5 price compare row |
| Icon library | Ionicons |
| Font | none loaded yet (phase 7) |
| Reference | `06-adoption/design-system.html#price-compare`, `#compare-sheet`, `#verdict`, `#pinakamura`, `#action-bar`, `#stats`, `#stall-card`, `#empty` |

---

## Screen Anatomy (375px, top to bottom)

Everything above the horizontal line must be visible without scrolling.

1. Product photograph, full bleed, `RADIUS.lg` on the bottom corners
2. Product name, Tagalog first, English underneath
3. **Price block:** `₱60.00` at `priceHero`, `/ kg` beside it, verdict chip beside that
4. Stall attribution: stall name, section, stall number, rating with review count
5. `Presyo Check` heading and the first roster row, showing who is `Pinakamura`

--- fold at 375px ---

6. The rest of the roster, or the `Buksan ang Presyo Check` control that opens the compare sheet
7. `Ibang unit` group, if any rows have a different unit
8. KPI stat cards: Lowest, Highest, Average, Difference, Total Vendors, each with its unit
9. Price history and trend
10. Description and details
11. **Sticky action bar**, always visible, on top of everything

---

## Spacing Scale

| Token | Value | Usage here |
|-------|-------|-------|
| `SPACING.xs` | 4px | price to unit gap |
| `SPACING.sm` | 8px | price to verdict chip gap |
| `SPACING.md` | 12px | between roster rows |
| `SPACING.lg` | 16px | screen gutter, action bar padding |
| `SPACING.xl` | 20px | card inner padding |
| `SPACING.xxl` | 24px | price block to Presyo Check heading |
| `SPACING.xxxl` | 32px | between major sections |

Exceptions: none.

---

## Typography

| Role | Token | Size | Weight |
|------|-------|------|--------|
| Price | `TEXT_STYLES.priceHero` | 38 | 900, letter spacing -0.4 |
| Unit suffix | `TYPE.size.caption` | 13 | 700, `text.tertiary` |
| Product name, Tagalog | `TYPE.size.display` | 26 | 800 |
| Product name, English | `TEXT_STYLES.bodySmall` | 15 | 600, `text.tertiary` |
| `Presyo Check` heading | `TEXT_STYLES.h2` | 19 | 800 |
| Stall name in a roster row | `TEXT_STYLES.h3` | 17 | 800 |
| Roster price | `TEXT_STYLES.price` | 19 | 900 |
| KPI value | `TEXT_STYLES.price` | 19 | 900 |
| KPI label | `TEXT_STYLES.caption` | 13 | 700, `text.tertiary` |
| Verdict chip | `TEXT_STYLES.chip` | 12 | 900, uppercase |
| Action bar total | `TEXT_STYLES.h3` | 17 | 800 |
| Action bar total label | `TEXT_STYLES.caption` | 13 | 700, `text.tertiary` |

---

## Color

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Dominant (60%) | `background` | `#F2E7D6` | the page |
| Secondary (30%) | `card` | `#FFFDFA` | roster rows, KPI cards, the action bar |
| Accent (10%) | `primary` | `#E8833A` | **one** CTA in the action bar, and nothing else on this screen |
| Accent pressed | `primaryDark` | `#C96A28` | the action bar CTA bottom edge |
| Pinakamura fill | `verdictBestBg` | `#61802F` | rank 1 badge |
| Pinakamura text | `verdictBestText` | `#F7FBEF` | |
| MURA | `verdictCheapBg` / `verdictCheapText` | `#EDF3DE` / `#61802F` | replaces the hardcoded `#2E7D32` |
| KATAMTAMAN | `verdictFairBg` / `verdictFairText` | `#F3E3CB` / `#5B4436` | |
| MAHAL | `verdictDearBg` / `verdictDearText` | `#FBE2DE` / `#9E2B20` | replaces the hardcoded `#C62828` on the most-expensive card |
| Ibang unit group | `wickerSoft` / `text.secondary` | `#F3E3CB` / `#5B4436` | deliberately quiet, clearly not part of the ranking |
| Border | `border` | `#E3CFB0` | 2px on every card and row |
| Gold | `gold` | `#D89A17` | rating stars. Replaces the hardcoded `#E65100` at line 985 |

**Accent reserved for:** the single CTA in the sticky action bar. That is it. Not the price (that is ink), not the Pinakamura badge (that is leaf), not the KPI values, not the section headings, not the rating stars.

**Hexes removed in this phase:** `#C62828`, `#2E7D32`, `#E65100` and every other six-digit literal in this file.

---

## Elevation

| Element | Token |
|---|---|
| Roster row, KPI card | `SHADOWS.none` |
| Compare sheet | `SHADOWS.overlay`, `RADIUS.xl` (22) |
| Sticky action bar | `SHADOWS.bar`, offset y -4, elevation 8 |

---

## Ranking and Unit Rules

1. The **reference unit** is the `unit` of the product being viewed.
2. The roster, the ranking, the badges and all five KPIs are computed only from rows whose `unit` equals the reference unit.
3. Rows with a different unit render below, in an `Ibang unit` group, with their real price and their real unit. They are never ranked, never badged, and never included in an average.
4. `Pinakamura` is awarded to exactly one row, or to none if the roster has one row.
5. A roster with one row shows no verdict chip, no ranking and no KPIs. It shows the one-stall empty message instead.
6. No individual stall price is ever recomputed or reformatted.

---

## Copywriting Contract

| Element | Copy | Note |
|---------|------|------|
| Comparison heading | `Presyo Check` | replaces `Market Analytics` at line 946 |
| Primary CTA | `Idagdag sa Kart` | one orange button, in the sticky action bar |
| Action bar total label | `Total (2 x kg)` | quantity and unit in the label, the amount beside it |
| Rank 1 badge | `Pinakamura` | replaces `Cheapest` at line 1004 |
| Most expensive label | `Pinakamahal` | replaces `Most Expensive` at line 1019 |
| Different-unit group heading | `Ibang unit` | |
| Different-unit group note | `Hindi ito kasama sa paghahambing dahil ibang unit ang ginamit.` | says why, not just what |
| KPI labels | `Pinakamura / kg`, `Pinakamahal / kg`, `Karaniwan / kg`, `Agwat ng presyo`, `Bilang ng stall` | every price KPI carries the unit |
| One-stall heading | `Isang stall pa lang ang may nito` | |
| One-stall body | `Wala pang maihahambing na presyo. Titingnan namin ulit bukas.` | |
| One-stall action | `Tingnan ang ibang produkto` | one action only |
| Stall action | `Bisitahin ang stall` | secondary variant, never orange |
| Error state | `Hindi ma-load ang Presyo Check. Subukan ulit.` plus retry | |

All of these are hardcoded literals in the current code. **Do not add or change anything in `src/i18n/en.json` or `fil.json`.**

---

## UI Considerations

Applicable state considerations resolved: 6 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | verdict chip, roster | covered | `marketAnalytics === null` renders no chip, no ranking, no KPIs, and the one-stall copy above |
| loading | Presyo Check block | covered | Skeleton rows at the real row height. The existing `Analyzing market data...` string at line 956 becomes `Kinukuha ang presyo ng ibang stall...` |
| error | Presyo Check block | covered | Error copy plus retry. The product detail above it still renders |
| populated | full screen | covered | Image, both names, price, verdict, stall, roster, KPIs, history, action bar |
| partial | mixed units | covered | `Ibang unit` group with its explanation line. **The correctness fix of the phase** |
| zero-one-many | roster length | covered | 0 rows renders the empty branch, 1 row renders the one-stall copy, many rows rank normally |
| overflow | above-the-fold budget at 375px | backstop | Image, both names, price block and the first roster row must all fit above 667px of viewport height. If they do not, shrink the image, not the price. Verify on a real 375 by 667 viewport |
| long-text | product and stall names | backstop | A long Tagalog product name must not push the price block below the fold. Truncate the name to 2 lines |

**Reduced motion:** the compare sheet opens without a spring. The price history chart draws instantly instead of animating in.

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

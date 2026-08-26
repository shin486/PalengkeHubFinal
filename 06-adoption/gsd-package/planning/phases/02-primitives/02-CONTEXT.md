# Phase 2: Primitives - Context

**Gathered:** 2026-08-27 (hand authored, no discuss step needed)
**Status:** Ready for planning

**Branch:** `design/phase-02-primitives`

<domain>
## Phase Boundary

Build the small repeating pieces once, correctly, so that phases 3 to 6 are mostly "delete a local style block and use the primitive". Buttons, cards, chips, badges, price text and verdict chips.

This phase touches shared components under `PalengkeHubFinal-main/src/components/`. It does not touch screens. A screen only changes in this phase if a primitive it already uses now looks different, which is the point.

</domain>

<decisions>
## Implementation Decisions

### Where primitives live

- **D-01:** New primitives go in a new folder, `PalengkeHubFinal-main/src/components/ui/`. That folder does **not** exist yet; create it. Shared components currently sit flat in `src/components/`, and `ui/` keeps the small reusable pieces separate from the bigger composed ones like `ProductCard.js` and `CheckoutContent.js`.

  Note: the repo's `TODO.md` claims a file at `src/components/ui/PressableScale.js`. It is not there. See D-01b.

- **D-01b:** What **does** exist is `PalengkeHubFinal-main/src/utils/animations.js`, which exports `FadeInUp` (line 10) and `PressableScale` (line 51). `PressableScale` wraps a pressable with a scale-down active state. **Nothing in `src/` imports that file today**, so it is dead code that happens to be useful. Move `PressableScale` into `src/components/ui/` as part of this phase and build `Button` on top of it. Leave `FadeInUp` where it is.
- **D-02:** Existing shared components that already do the job stay where they are and get rebuilt in place, not duplicated. Specifically `src/components/ProductCard.js`, `src/components/ModernCard.js`, `src/components/PriceTrendBadge.js` and `src/components/EmptyState.js`.
- **D-03:** Every primitive reads its values from `../theme/tokens`. Not one hex literal in a new file. If a value is missing, add a token, do not inline it.

### Buttons

- **D-04:** One `Button` primitive with five variants: `primary`, `secondary`, `outline`, `ghost`, `danger`. See `design-system.html#buttons`.
- **D-05:** Sizes are 38 / 48 / 56 tall. In the app only `md` (48) and `lg` (56) may be used, because `LAYOUT.minTapTarget` is 44 and nothing in the app ships below it. The 38 size exists for the web dashboard and dense rows only.
- **D-06:** The signature interaction: the primary button carries a solid 3px bottom edge in `COLORS.light.primaryDark`, built with `borderBottomWidth`, **not** a shadow. On press the button translates 3px down and the edge disappears, so it looks like it sank. `PRESS_OFFSET` in `tokens.js` holds the height and colour.

  Note the tension with `PressableScale`, which animates `scale` to 0.96 on press. Scaling **and** sinking at the same time reads as mush. Pick one per component: buttons sink, cards and tiles scale. If `Button` uses `PressableScale`, pass `scaleTo: 1` so only the sink is visible.
- **D-07:** Only one primary button may be visible in a screen region at a time. If a screen currently has two orange buttons competing, the less important one becomes `secondary`.
- **D-08:** `danger` is the only red button and it only ever means delete or cancel. It never means buy.
- **D-09:** Default shape is the pill (`RADIUS.full`). Use the square variant (`RADIUS.sm`) for buttons that sit inside a card.

### Cards

- **D-10:** Three kinds: basic, media, stat. All of them `RADIUS.lg` (16), background `COLORS.card` (`#FFFDFA`), border `LAYOUT.borderWidth` (2px) in `COLORS.border` (`#E3CFB0`).
- **D-11:** **Cards have no drop shadow.** `SHADOWS.none`. The contrast between the warm white card and the woven paper background already separates them. Shadows are only for things that genuinely float: dropdowns, sheets, modals, the bottom bar. This one rule is why the UI reads calm instead of foamy, so do not "add a subtle shadow back".
- **D-12:** Existing `LinearGradient` fills inside card components are replaced with flat token fills. The only surviving gradient in the whole system is the ink scrim over a promo banner photograph, and that is a scrim, not decoration.

### Chips and badges

- **D-13:** A **chip** is tappable, at least 42px tall, and toggles or filters. A **badge** is never tappable and only labels. Do not blur the two.
- **D-14:** Badges: uppercase, `TYPE.size.micro` (12), `TYPE.weight.black` (900), `RADIUS.sm` (10), letter spacing `TYPE.letterSpacing.caps`. `TEXT_STYLES.chip` already assembles this.
- **D-15:** The discount badge is the one red badge on a product card. It uses the tomato family. See `design-system.html#badges` and `#product-card`.

### Verdict chips

- **D-16:** Four states, each with a background and text token pair already in `tokens.js`:

  | Verdict | Meaning | Background token | Text token |
  |---|---|---|---|
  | MURA | 5 percent or more below the market average for that product, unit normalized | `verdictCheapBg` | `verdictCheapText` |
  | KATAMTAMAN | within plus or minus 5 percent of the average | `verdictFairBg` | `verdictFairText` |
  | MAHAL | 5 percent or more above the average | `verdictDearBg` | `verdictDearText` |
  | PINAKAMURA | rank one in a comparison, solid form | `verdictBestBg` | `verdictBestText` |

- **D-17:** A verdict is **computed**, never hand set. One function computes it and the card, the detail screen and the compare sheet all call that one function. A product with no roster of other stalls gets **no chip at all**, not a KATAMTAMAN by default.
- **D-18:** "Unit normalized" is load bearing. The comparison is only valid among prices that share a `unit` string. The display side of this is fixed properly in phase 6; in this phase the primitive just has to accept a verdict and render it, and must not invent one.
- **D-19:** PINAKAMURA is a superlative, not a range. Only one stall per product may carry it. Solid form (`verdictBestBg` fill) marks rank one inside a comparison; soft form (`verdictCheapBg` fill) marks the cheapest price on a home screen Presyo Check card.
- **D-20:** MAHAL is the only red judgement anywhere in the app.

### Price text

- **D-21:** Three price styles, all from `TEXT_STYLES`: `priceHero` (38, weight 900) on a product detail screen, `price` (19, weight 900) on cards and rows, and the unit suffix which is `TYPE.size.caption` in `COLORS.text.tertiary`.
- **D-22:** **The formatting does not change.** `₱` immediately before the number, two decimal places via `toFixed(2)`, then a space, then `/ ` and the unit string. This is exactly what `src/components/ProductCard.js` line 181 and `src/screens/customer/SearchScreen.js` render today. Restyling it is in scope. Reformatting it is not.
- **D-23:** A struck-through original price sits above the current price when there is a promotion, using `COLORS.text.tertiary`. That already exists in the code as `styles.originalPrice`.

### Copy

- **D-24:** Where a user-visible string is a **hardcoded English literal** in the component and the action behind it does not change, it may be replaced with the Taglish copy from the design system. Example: `src/components/ProductCard.js` line 203 renders the literal `'Add to Cart'`; it becomes `Idagdag sa Kart` and still calls the same `onAddToCart` prop.
- **D-25:** Where a string comes from `t('...')`, **do not touch it**. Do not change the key, do not change `en.json` or `fil.json`. Translation is a separate job and it is not design.
- **D-26:** The design system shows `Ikumpara` as the product card action. In this app the card's primary action today is add to cart and the card body navigates to detail. **Keep both behaviours exactly as they are.** Style the add-to-cart button as `secondary` so it is not competing with the one orange CTA, and leave routing alone. Promoting comparison is phase 6's job and it is done by layout, not by swapping what a button does.

### Claude's Discretion

- Prop names on the new primitives, as long as they are camelCase and verb first for callbacks.
- Whether `Button` is one file with a variant prop or a small folder. Prefer one file.
- Whether to rebuild `ModernCard.js` or wrap it.
- Loading and disabled state visuals, as long as they use tokens.

</decisions>

<specifics>
## Specific Ideas

- "Warm white card on woven paper, no shadow" is the single most recognisable thing about this design. Get it right here and phases 4 to 6 mostly fall out for free.
- The 3px sinking press on the primary button is the signature interaction. It is worth spending an extra hour on.
- If you catch yourself writing a hex in this phase, stop. Add the token instead.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component contracts
- `06-adoption/design-system.html#buttons` - 5 variants, 3 sizes, the press behaviour
- `06-adoption/design-system.html#cards` - basic, media and stat, radius 16, no shadow
- `06-adoption/design-system.html#badges` - badge versus chip, the 42px rule
- `06-adoption/design-system.html#verdict` - the four verdict states and the computation contract
- `06-adoption/design-system.html#pinakamura` - solid versus soft form
- `06-adoption/design-system.html#product-card` - how all of the above compose
- `06-adoption/design-system.html#empty` - one action only, never two

### Tokens
- `PalengkeHubFinal-main/src/theme/tokens.js` (added in phase 1) - `COLORS`, `SPACING`, `RADIUS`, `SHADOWS`, `PRESS_OFFSET`, `TYPE`, `TEXT_STYLES`, `LAYOUT`
- `06-adoption/DESIGN-SYSTEM.md` sections "Spacing, radius, shadows" and "Typography plan"

### Existing code
- `PalengkeHubFinal-main/src/components/ProductCard.js` - the current card, including the `₱` and `/ unit` formatting at lines 180 to 181
- `PalengkeHubFinal-main/src/utils/animations.js` - `FadeInUp` at line 10 and `PressableScale` at line 51. Currently imported by nothing
- `PalengkeHubFinal-main/src/theme/motion.js` - `MOTION` durations and the haptic helpers to use on press

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/animations.js`: `PressableScale` already wraps a pressable with a scale-down active state. Nothing imports the file, so moving `PressableScale` into `src/components/ui/` breaks nothing and gives `Button` a base to build on. Confirm the zero-importer claim with a search before you move it.
- `src/components/vendor/`: fifteen components already live here, including `StatsCard.js`, `VendorStatusBadge.js`, `VendorEmptyState.js` and `VendorSectionHeader.js`. Read them before writing a new badge or stat card; some of what phase 2 needs may already exist in a vendor-flavoured form worth generalising.
- `src/theme/motion.js`: `MOTION` has three durations (150 / 220 / 320ms) plus `hapticSelection`, `hapticLight`, `hapticMedium`, `hapticSuccess`, `hapticWarning`, `hapticError`. Use these, do not invent new timings.
- `src/components/PriceTrendBadge.js`: takes `currentPrice` and `previousPrice`. Keep the props and the logic, restyle the output.
- `src/components/EmptyState.js`: exists and is used. It also contains a hardcoded `#C62828`, which dies here or in phase 3.

### Established Patterns
- `StyleSheet.create` at the bottom of the file, theme colours read with `useColors()` inside the component and applied through inline style arrays. Follow it.
- Ionicons is the majority icon family (382 uses versus 181 MaterialIcons). New primitives use Ionicons only. Do not convert existing MaterialIcons in this phase.

### Integration Points
- `src/components/ProductCard.js` is consumed by `src/screens/customer/HomeScreen.js` and `src/screens/customer/CategoryProductsScreen.js`. Any prop you rename breaks both. Prefer not renaming props.
- The vendor side has its own `src/components/vendor/ProductCard.js` and `src/components/vendor/ModernProductCard.js`. They may use the new primitives, but the vendor screens are not a target of this phase.

</code_context>

<non_goals>
## NON-GOALS

- **No data fetching changes.** No new query, no changed query, no new field.
- **No routing or navigation changes.** No button changes where it takes you. See D-26.
- **No state changes.** No new context or store. Local UI state inside a primitive (pressed, focused) is fine and is not app state.
- **No API changes.**
- **No new dependency.**
- **No i18n key or translation file changes.** See D-25.
- **No screen restructuring.** Screens change in phases 4, 5 and 6, not here.
- **Out of scope:** `PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js`.

</non_goals>

<acceptance>
## Acceptance Criteria

1. A `Button` primitive exists with the 5 variants, and a primary button visibly sinks 3px on press.
2. A `Card` primitive exists with `RADIUS.lg`, a 2px `COLORS.border` border, `COLORS.card` background and **no** shadow.
3. Chip and badge primitives exist, and every chip in the app is at least 42px tall.
4. A verdict chip primitive renders all four states from the `verdict*` token pairs, and renders nothing when it is given no verdict.
5. Price text renders `₱60.00 / kg` exactly as it does today, restyled.
6. `grep -roE "#[0-9A-Fa-f]{6}" PalengkeHubFinal-main/src/components/ui/` finds no hex literal in any new file.
7. Every screen still fetches the same data, navigates to the same places, and every button still does what it did.

</acceptance>

<screenshots>
## Before and After Screenshot Checklist

`cd PalengkeHubFinal-main && npm run web`, capture at **375px** and **1440px**, before and after.

- [ ] Customer home, focusing on the product card rail
- [ ] Category products grid
- [ ] Search results, comparison cards
- [ ] Product detail, price block and buttons
- [ ] PalengKart with at least one item, and empty
- [ ] Any empty state
- [ ] A primary button mid-press, if you can catch it. A short screen recording is better here.

</screenshots>

<rollback>
## Rollback Rule

If any button, card or chip now does something different from before, or a screen crashes, or a list stops rendering: revert the whole phase.

```
git checkout design-system
git branch -D design/phase-02-primitives
```

Do not patch forward.

</rollback>

<deferred>
## Deferred Ideas

- Converting the 181 MaterialIcons uses to Ionicons: backlog, mechanical, not design.
- The compare sheet component (`design-system.html#compare-sheet`): phase 6.
- The Presyo Check card (`design-system.html#presyo-card`): phase 4.
- Vendor-side card rebuild: after phase 6.

</deferred>

---

*Phase: 02-primitives*
*Context authored: 2026-08-27*

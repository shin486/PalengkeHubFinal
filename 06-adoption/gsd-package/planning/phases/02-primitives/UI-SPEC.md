---
phase: 2
slug: primitives
status: authored
shadcn_initialized: false
preset: none
created: 2026-08-27
---

# Phase 2 - UI Design Contract

> Buttons, cards, chips, badges, price text and verdict chips.
> Every value below exists in `PalengkeHubFinal-main/src/theme/tokens.js`. Do not introduce a value that is not there.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Native `StyleSheet.create`) |
| Preset | PalengkeHub palengke identity, v1.0 |
| Component library | none. Primitives are hand written into a new `src/components/ui/` folder (it does not exist yet) |
| Icon library | Ionicons via `@expo/vector-icons` (already a dependency) |
| Font | none loaded yet. `TYPE.family.display` and `TYPE.family.ui` are both `'system'` until phase 7 |
| Reference | `06-adoption/design-system.html` |

---

## Spacing Scale

From `SPACING` in `tokens.js`.

| Token | Value | Usage |
|-------|-------|-------|
| `SPACING.xs` | 4px | icon gaps, inline padding |
| `SPACING.sm` | 8px | compact element spacing, chip inner gap |
| `SPACING.md` | 12px | card inner padding on dense rows |
| `SPACING.lg` | 16px | the default gap and the default screen gutter |
| `SPACING.xl` | 20px | card padding |
| `SPACING.xxl` | 24px | section padding |
| `SPACING.xxxl` | 32px | major section breaks |

Exceptions: `NAV_SPACING` is a second, tighter scale used only by the bottom bars and tab items. It is `4 / 6 / 8 / 12 / 16`, and the `6` is deliberately not a multiple of 4. It is not used in this phase; it belongs to phase 3.

---

## Radius

From `RADIUS` in `tokens.js`.

| Token | Value | Usage |
|-------|-------|-------|
| `RADIUS.xs` | 6 | tiny badges, code |
| `RADIUS.sm` | 10 | chips, verdict chips, discount badges, in-card buttons |
| `RADIUS.md` | 12 | inputs, thumbnails, list rows |
| `RADIUS.lg` | 16 | every card and panel |
| `RADIUS.xl` | 22 | bottom sheets, modals |
| `RADIUS.full` | 999 | pills, avatars, the primary CTA |

---

## Typography

From `TYPE` and `TEXT_STYLES`. Weights are always numeric strings. Never write `'bold'`.

| Role | Token | Size | Weight | Notes |
|------|-------|------|--------|-------|
| Price hero | `TEXT_STYLES.priceHero` | 38 | 900 | product detail only, letter spacing -0.4 |
| Price | `TEXT_STYLES.price` | 19 | 900 | cards and comparison rows, letter spacing -0.3 |
| Card title | `TEXT_STYLES.h3` | 17 | 800 | stall name, product name |
| Body | `TEXT_STYLES.body` | 16 | 600 | default. Inputs never go below 16 or iOS zooms on focus |
| Body small | `TEXT_STYLES.bodySmall` | 15 | 600 | secondary body |
| Label | `TEXT_STYLES.label` | 14 | 800 | labels and meta rows |
| Caption | `TEXT_STYLES.caption` | 13 | 700 | the `/ unit` suffix, review counts |
| Chip | `TEXT_STYLES.chip` | 12 | 900 | uppercase, letter spacing 0.5. Chips and badges only |

---

## Color

From `COLORS.light`. Dark values exist in `COLORS.dark` and resolve through `useColors()`.

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Dominant (60%) | `background` / `paper` | `#F2E7D6` | the page canvas, woven paper |
| Secondary (30%) | `card` / `surface` | `#FFFDFA` | every card, every panel, the header fill |
| Accent (10%) | `primary` | `#E8833A` | primary buttons only, active tab, the one CTA per region |
| Accent pressed | `primaryDark` | `#C96A28` | the 3px bottom edge on a primary button |
| Border | `border` | `#E3CFB0` | the 2px card border and every hairline |
| Ink | `text.primary` | `#261006` | all primary text |
| Ink 2 | `text.secondary` | `#5B4436` | secondary text |
| Ink 3 | `text.tertiary` | `#8A7263` | the `/ unit` suffix, struck-through prices, captions |
| Destructive | `error` | `#D34638` | the `danger` button variant and error states only |
| Discount | `errorFill` | `#D34638` | the discount badge on a product card |

**Accent reserved for:** the single primary button in a screen region, the active bottom-tab item, and the focus ring on an input. Never for body text, never for icons that are not on a primary surface, never for card borders, never for "all interactive elements".

**Verdict pairs** (background on text):

| Verdict | Background | Text |
|---|---|---|
| MURA | `verdictCheapBg` `#EDF3DE` | `verdictCheapText` `#61802F` |
| KATAMTAMAN | `verdictFairBg` `#F3E3CB` | `verdictFairText` `#5B4436` |
| MAHAL | `verdictDearBg` `#FBE2DE` | `verdictDearText` `#9E2B20` |
| PINAKAMURA (solid) | `verdictBestBg` `#61802F` | `verdictBestText` `#F7FBEF` |

---

## Elevation

| Token | Where | Value |
|---|---|---|
| `SHADOWS.none` | **cards, panels, product cards, stall cards** | no shadow at all |
| `SHADOWS.hairline` | pressed rows, subtle separation | offset y 1, opacity 0.06, elevation 1 |
| `SHADOWS.float` | floating buttons, dropdowns | offset y 6, opacity 0.14, elevation 4 |
| `SHADOWS.overlay` | modals, bottom sheets | offset y 14, opacity 0.22, elevation 10 |
| `SHADOWS.bar` | bottom tab bar, sticky action bar (points upward) | offset y -4, opacity 0.12, elevation 8 |

Shadow colour is always the solid `#261006` with a fractional `shadowOpacity`, plus a matching Android `elevation`. Never `shadowColor: 'rgba(...)'` with `shadowOpacity: 1`. The old `customerShadows` and `vendorShadows` mixed the two conventions, which is why they rendered differently despite looking identical in source.

---

## Button Contract

| Property | Value |
|---|---|
| Variants | `primary`, `secondary`, `outline`, `ghost`, `danger` |
| Sizes | `sm` 38, `md` 48, `lg` 56. **In the app only `md` and `lg` are allowed** (`LAYOUT.minTapTarget` is 44) |
| Shape | pill `RADIUS.full` by default, `RADIUS.sm` when inside a card |
| Press affordance | primary carries `borderBottomWidth: 3` in `primaryDark`; on press it translates 3px down and the edge goes to 0 |
| Press timing | `MOTION` fast (150ms) from `src/theme/motion.js` |
| Haptics | `hapticLight()` on primary press, `hapticSelection()` on chips |
| Rule | one primary button visible per screen region, always |

---

## Copywriting Contract

Applies only to hardcoded English literals. Strings that come from `t('...')` are frozen.

| Element | Copy |
|---------|------|
| Primary CTA on a product card | `Idagdag sa Kart` (replaces the literal `'Add to Cart'` at `src/components/ProductCard.js:203`, same `onAddToCart` handler) |
| Compare action | `Ikumpara` (only where the control already navigates to comparison) |
| Stall action | `Bisitahin ang stall` |
| See all | `Tingnan Lahat` |
| Remove | `Alisin` |
| Empty state heading | `Wala pang laman ang PalengKart mo` |
| Empty state body | `Simulan sa Presyo Check para makita kung aling stall ang pinakamura ngayong umaga.` |
| Empty state action | `Buksan ang Presyo Check`. **One action only.** Never two competing buttons in an empty state. |
| Error state | say the problem and the way out, for example `Hindi ma-load ang presyo. Subukan ulit.` with a retry control |
| Destructive confirmation | name the thing being removed, for example `Alisin ang Kamatis sa kart?` |

---

## UI Considerations

Applicable state considerations resolved: 6 covered, 1 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | verdict chip | covered | A product with no roster of other stalls renders **no chip**, not a default KATAMTAMAN |
| empty | list collection | covered | Empty state uses the copy in the Copywriting Contract and exactly one action |
| loading | button | covered | `loading` state shows a spinner in place of the label, keeps the button width, stays disabled |
| error | price block | covered | Error copy names the problem and offers retry, per the Copywriting Contract |
| populated | product card | covered | Image, both names, price with unit, verdict chip, rating, stall attribution, one action |
| zero-one-many | rating count | covered | `(0)` renders as no review count at all, `(1)` and `(312)` render the same way |
| long-text | product and stall names | backstop | Long Tagalog stall names must truncate to 2 lines with ellipsis and never push the price out of the card. Verify visually at 375px with a name of 40+ characters. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable. No component registry, no shadcn, no new npm package. |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS (trivially, nothing is fetched)

**Approval:** pending

---
phase: 4
slug: home-screen
status: authored
shadcn_initialized: false
preset: none
created: 2026-08-27
---

# Phase 4 - UI Design Contract

> `PalengkeHubFinal-main/src/screens/customer/HomeScreen.js`. Search header, category chips, six section rails.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Native `StyleSheet.create`) |
| Preset | PalengkeHub palengke identity, v1.0 |
| Component library | phase 2 primitives, plus `src/components/ProductCard.js` |
| Icon library | Ionicons |
| Font | none loaded yet (phase 7) |
| Reference | `06-adoption/design-system.html#search`, `#category-chip`, `#product-card`, `#stall-card`, `#promo-banner`, `#carousel`, `#empty` |

---

## Screen Anatomy (top to bottom, 375px)

1. Status bar, style driven by `COLORS.statusBar`
2. **Search header.** Flat `surface` fill, 1px `border` hairline at the bottom. Contains the pill search field (`inputBg`, `RADIUS.full`, height `LAYOUT.searchHeight` 50) and the notification bell with its count badge. **No gradient.**
3. **Category chip row.** Title `t('home.shop_by_category')`, then six round chips, horizontally scrollable.
4. Promo banner, if present. Photograph, ink scrim from the bottom, orange kicker, two lines of copy.
5. Section 1: `t('home.todays_deals')`, product rail
6. Section 2: `Recently Viewed`, product rail
7. Section 3: `t('home.buy_again')`, product rail
8. Section 4: `t('home.price_drop_alert')`, product rail
9. Section 5: `t('home.top_rated_stalls')`, stall rail
10. Section 6: `t('home.market_stalls')`, stall rail
11. Bottom tab bar (phase 3)

Section order is frozen. Sections 5 and 6 use the stall card, the rest use the product card.

---

## Spacing Scale

| Token | Value | Usage here |
|-------|-------|-------|
| `SPACING.xs` | 4px | chip label to sub-label gap |
| `SPACING.sm` | 8px | rating row internals |
| `SPACING.md` | 12px | gap between cards inside a rail |
| `SPACING.lg` | 16px | screen gutter (`LAYOUT.screenGutter`), header padding |
| `SPACING.xl` | 20px | card inner padding |
| `SPACING.xxl` | 24px | heading to first card |
| `SPACING.xxxl` | 32px | between sections |

Exceptions: none on this screen.

---

## Typography

| Role | Token | Size | Weight |
|------|-------|------|--------|
| Section heading | `TEXT_STYLES.h2` | 19 | 800 |
| See all action | `TEXT_STYLES.label` | 14 | 800, in `primaryDark` |
| Card title (product or stall name) | `TEXT_STYLES.h3` | 17 | 800 |
| English sub-name on a product card | `TEXT_STYLES.caption` | 13 | 700, in `text.tertiary` |
| Price on a card | `TEXT_STYLES.price` | 19 | 900 |
| `/ unit` suffix | `TYPE.size.caption` | 13 | 700, in `text.tertiary` |
| Search placeholder | `TEXT_STYLES.body` | 16 | 600, in `text.tertiary` |
| Chip Tagalog label | `TEXT_STYLES.label` | 14 | 800, in `text.primary` |
| Chip English sub-label | `TYPE.size.micro` | 12 | 600, in `text.tertiary` |
| Rating and review count | `TEXT_STYLES.caption` | 13 | 700 |

---

## Color

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Dominant (60%) | `background` | `#F2E7D6` | the page, woven paper |
| Secondary (30%) | `surface` / `card` | `#FFFDFA` | search header, every card |
| Search field fill | `inputBg` | `#F3E3CB` | the pill |
| Chip fill | `wickerSoft` | `#F3E3CB` | inactive round chip |
| Chip fill active | `brandSoft` | `#FBE7D4` | selected chip, with a `primary` ring |
| Accent (10%) | `primary` | `#E8833A` | promo kicker, the single CTA in a promo banner, the active tab pip |
| See-all action | `primaryDark` | `#C96A28` | text link, not a filled button |
| Border | `border` | `#E3CFB0` | 2px card borders, 1px header hairline |
| Ink | `text.primary` | `#261006` | headings, names, prices |
| Ink 3 | `text.tertiary` | `#8A7263` | units, sub-labels, captions |
| Discount badge | `errorFill` | `#D34638` | the one red thing on a product card |
| Rating star | `gold` | `#D89A17` | |
| Scrim | `overlay` | `rgba(38,16,6,0.50)` | the bottom-up scrim on a promo photograph |

**Accent reserved for:** the promo banner CTA, the promo kicker text, the active chip ring, and the active tab pip. Not for section headings, not for see-all links (those are `primaryDark` text), not for card borders, not for prices.

**Gradients:** exactly one is allowed on this screen, the bottom-up ink scrim over a promo photograph. Both existing `LinearGradient` uses in this file are removed.

---

## Elevation

| Element | Token |
|---|---|
| Search header | none. 1px `border` hairline only |
| Product card, stall card, promo banner | `SHADOWS.none` |
| Bottom tab bar | `SHADOWS.bar` (owned by phase 3) |

If a card looks like it needs a shadow, the card background or the page background is wrong. Fix the colour, not the elevation.

---

## Category Chips

| Route param (frozen) | Tagalog | English | Ionicons |
|---|---|---|---|
| `Vegetables` | Gulay | Vegetables | `leaf` |
| `Meat` | Karne | Meat | `restaurant` |
| `Fruits` | Prutas | Fruits | `basket` |
| `Poultry` | Manok | Poultry | `egg` |
| `Rice` | Bigas | Rice | `cafe` |
| `Other` | Iba pa | Other | `apps` |

Round chip, minimum 42px tappable height, icon in a circle above the two labels. The Tagalog word is display only. The English string is the value passed to `CategoryProducts`, because the database column is filtered on it.

---

## Copywriting Contract

| Element | Copy | Source |
|---------|------|--------|
| Category section heading | Shop by Category / the fil.json value | `t('home.shop_by_category')`, key already exists |
| See all | See All | `t('home.see_all')`, key already exists |
| Section headings 1, 3, 4, 5, 6 | unchanged | existing `t('home.*')` keys |
| Section heading 2 | `Recently Viewed` | unchanged hardcoded literal |
| Promo kicker | `Bagong ani` | new literal, orange, uppercase micro |
| Promo line 1 | `Gulay hanggang 20% off` | new literal |
| Promo line 2 | `Presyo updated ngayong umaga, 42 na stalls` | new literal, only if the number is real. If the count is not available, use `Presyo updated ngayong umaga` and drop the number. **Never print a made-up count.** |
| Empty deals state | unchanged | `t('home.no_deals')` and `t('home.check_back_later')`, keys already exist |
| Empty state action | unchanged | `t('home.start_shopping')`, key already exists |

No new i18n keys. New literals are only allowed in the promo banner, which has no existing keys.

---

## UI Considerations

Applicable state considerations resolved: 6 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | section rails | covered | Skeleton cards in `surfaceSecondary`, same card dimensions as the real card so nothing jumps when data lands |
| empty | section rails | covered | A section with no data does not render at all, exactly as today. The deals section keeps its existing empty state copy |
| error | section rails | covered | A failed section shows the error copy plus a retry, and does not take down the rest of the screen |
| populated | full screen | covered | Search, chips, promo, four product rails, two stall rails |
| zero-one-many | notification badge, review counts | covered | 0 renders nothing, 1 and 312 render identically in shape |
| partial | stall card price range | covered | Where price range data is missing, the range bar is omitted and the rest of the card renders. **Do not fetch more data to fill it** |
| overflow | category chip row at 375px | backstop | Six chips will not fit on one 375px screen. The row scrolls horizontally with the sixth chip partly visible, which is the standard affordance. Verify that the sixth chip is visibly cut rather than exactly flush |
| long-text | Tagalog stall names | backstop | Long stall names truncate to 2 lines and never push the price out of the card. Verify at 375px with a 40+ character name |

**Reduced motion:** the `TypewriterPlaceholder` in the search pill must render its first phrase statically when the platform reports reduce-motion. Any rail auto-scroll, if one exists, stops too.

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

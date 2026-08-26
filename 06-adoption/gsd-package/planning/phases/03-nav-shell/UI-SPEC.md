---
phase: 3
slug: nav-shell
status: authored
shadcn_initialized: false
preset: none
created: 2026-08-27
---

# Phase 3 - UI Design Contract

> Header, buyer bottom bar, vendor bottom bar. Three files, the frame every screen sits in.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Native `StyleSheet.create`) |
| Preset | PalengkeHub palengke identity, v1.0 |
| Component library | phase 2 primitives in `PalengkeHubFinal-main/src/components/ui/` |
| Icon library | Ionicons |
| Font | none loaded yet (phase 7) |
| Reference | `06-adoption/design-system.html#navbar`, `#tabbar`, `#bottom-nav` |

---

## Spacing Scale

Bars and tab items use the tighter `NAV_SPACING` scale, not `SPACING`.

| Token | Value | Usage |
|-------|-------|-------|
| `NAV_SPACING.xs` | 4px | pip gap, badge offset |
| `NAV_SPACING.sm` | 6px | icon to label gap |
| `NAV_SPACING.md` | 8px | tab item vertical padding |
| `NAV_SPACING.lg` | 12px | bar horizontal padding |
| `NAV_SPACING.xl` | 16px | header horizontal gutter |

**Exceptions:** `NAV_SPACING.sm` is 6px, which is not a multiple of 4. This is deliberate and it is the only exception in the system. Bars are denser than page content, and 8px between a 24px icon and a 12px label pushes the bar past 64px tall.

Header content uses `SPACING.lg` (16) as its horizontal gutter, matching `LAYOUT.screenGutter`.

---

## Layout Constants

| Token | Value | Applies to |
|---|---|---|
| `LAYOUT.headerMinHeight` | 56 | header, plus the safe-area top inset |
| `LAYOUT.tabBarHeight` | 64 | both bottom bars, plus the safe-area bottom inset |
| `LAYOUT.minTapTarget` | 44 | every tab item, every icon button. Nothing ships smaller |
| `LAYOUT.hairlineWidth` | 1 | header bottom border, bar top border |

---

## Typography

| Role | Token | Size | Weight |
|------|-------|------|--------|
| Header title | `TEXT_STYLES.h2` | 19 | 800 |
| Header subtitle | `TEXT_STYLES.caption` | 13 | 700 |
| Tab label | `TYPE.size.micro` | 12 | `TYPE.weight.bold` (800) when active, `TYPE.weight.medium` (600) when inactive |
| Count badge | `TYPE.size.micro` | 12 | 900 |

---

## Color

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Header surface | `surface` | `#FFFDFA` | the header is warm white, **not** a brand banner |
| Bar surface | `surface` | `#FFFDFA` | both bottom bars |
| Hairline | `border` | `#E3CFB0` | header bottom, bar top |
| Header title | `text.primary` | `#261006` | |
| Header subtitle | `text.tertiary` | `#8A7263` | |
| Tab active | `primaryDark` | `#C96A28` | icon and label of the active tab |
| Tab pip | `primary` | `#E8833A` | the small dot above the active icon |
| Tab inactive | `text.quaternary` | `#A89484` | icon and label |
| Count badge fill | `error` | `#D34638` | unread and cart counts |
| Count badge text | `onError` | `#FFF6F1` | |

**Accent reserved for:** the active tab pip, the count badge (which is `error`, not `primary`), and nothing else in the shell. The header carries no orange fill.

**Removed here:** `#C62828`, `#E53935`, `#B71C1C`, `#FFEBEE`, `#9CA3AF` and `#1F2937` from the local `COLORS` object at `VendorBottomNavigation.js:21`, and every `#C62828` in `Header.js` and `EmptyState.js`.

---

## Elevation

| Element | Token |
|---|---|
| Header | none. A 1px `border` hairline at the bottom, no shadow |
| Both bottom bars | `SHADOWS.bar`. Offset y **-4**, opacity 0.12, radius 14, elevation 8. It points upward because the bar sits at the bottom of the screen |

---

## Destinations (frozen)

**Buyer bar**, in this order: Home, PalengKart, Orders, Chats, Profile.
**Vendor bar**, in this order: Home, Orders, Products, Chats, Profile.

Labels, order and route targets are frozen. `PalengKart` keeps its name.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Buyer tab labels | `Home`, `PalengKart`, `Orders`, `Chats`, `Profile` (unchanged) |
| Vendor tab labels | `Home`, `Orders`, `Products`, `Chats`, `Profile` (unchanged) |
| Count overflow | `9+` (unchanged) |
| Empty state heading | whatever the calling screen passes. `EmptyState.js` never invents copy |
| Empty state rule | one action only, never two competing buttons |

No new copy is introduced in this phase.

---

## UI Considerations

Applicable state considerations resolved: 5 covered, 1 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| zero-one-many | count badge | covered | 0 renders no badge, 1 to 9 render the number, 10 and above render `9+` |
| populated | header | covered | Title plus optional subtitle, back, notifications, cart, `rightComponent` all render as they do today |
| empty | header | covered | With no title the header still holds `LAYOUT.headerMinHeight` and does not collapse |
| overflow | tab labels | covered | Five 12px labels fit at 375px. Labels do not wrap, they are single line |
| loading | header cart count | covered | While the cart count is unknown the badge is simply absent, never a zero and never a spinner |
| long-text | header title | backstop | A long screen title must truncate to one line with ellipsis and must not push the right-hand controls off screen. Verify at 375px with a 40+ character title. |

Safe area: the bars must sit above the iOS home indicator and the Android gesture bar via `useSafeAreaInsets()`. Verify on a device or a simulator with gesture navigation on, not just in the browser.

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

# Phase 3: Nav Shell - Context

**Gathered:** 2026-08-27 (hand authored, no discuss step needed)
**Status:** Ready for planning

**Branch:** `design/phase-03-nav-shell`

<domain>
## Phase Boundary

The frame every screen sits inside: the header and the two bottom bars. Three files.

- `PalengkeHubFinal-main/src/components/Header.js`
- `PalengkeHubFinal-main/src/components/BottomNavigation.js`
- `PalengkeHubFinal-main/src/components/vendor/VendorBottomNavigation.js`

This is also where the Material red family finally dies. `#C62828` and its siblings `#E53935` and `#B71C1C` came into the app through the vendor bottom bar and spread. After this phase they are gone from everything except the out-of-scope admin screens.

</domain>

<decisions>
## Implementation Decisions

### Header

- **D-01:** `Header.js` keeps its exact prop signature. All eleven props stay, with the same names and the same defaults: `title`, `subtitle`, `showBack = false`, `onBackPress`, `showNotifications = false`, `showCart = false`, `cartCount = 0`, `onNotificationPress`, `onCartPress`, `rightComponent`. Renaming any of them breaks callers across the app.
- **D-02:** Delete the local `const SPACING` block at line 24 (it should already be gone from phase 1; if it is not, that is a phase 1 miss and worth flagging). Everything comes from `tokens.js`.
- **D-03:** Header surface is `COLORS.surface` (`#FFFDFA`), with a 1px bottom hairline in `COLORS.border`. Minimum height `LAYOUT.headerMinHeight` (56) plus the safe-area top inset, which `useSafeAreaInsets()` already provides in this file.
- **D-04:** Title uses `TEXT_STYLES.h2` in `COLORS.text.primary`. Subtitle uses `TEXT_STYLES.caption` in `COLORS.text.tertiary`.
- **D-05:** The header carries **no** primary-orange fill. Orange in the header is reserved for the unread notification dot and the cart count badge. The header is a warm white surface, not a brand banner.
- **D-06:** Remove `#C62828` wherever it appears in this file. It becomes `COLORS.primary`.
- **D-07:** Back, notification and cart controls are icon buttons at `LAYOUT.minTapTarget` (44) minimum. Ionicons only.
- **D-08:** The "open or closed" market pill and the collapsing location row shown in `design-system.html#navbar` are **deferred**. The app has no market-hours state to drive them, and hardcoding "Bukas" would tell a shopper the palengke is open when it might not be. Do not add them in this phase.

### Buyer bottom bar

- **D-09:** `BottomNavigation.js` keeps all five destinations, in the same order, with the same labels and the same routes: **Home, PalengKart, Orders, Chats, Profile**. `PalengKart` keeps its name. Do not "fix" it to Cart.
- **D-10:** Use `NAV_SPACING` from `tokens.js`, not `SPACING`. The file's old local block at line 29 was `4 / 6 / 8 / 12 / 16`, which is `NAV_SPACING` exactly, so no pixel moves.
- **D-11:** Bar height `LAYOUT.tabBarHeight` (64) plus the safe-area bottom inset. Surface `COLORS.surface`, `SHADOWS.bar` (the one shadow that points upward), 1px top hairline in `COLORS.border`.
- **D-12:** Active tab: icon and label in `COLORS.primaryDark`, plus a small pip above the icon in `COLORS.primary`. Inactive tab: `COLORS.text.quaternary`. Label size is `TYPE.size.micro` (12).
- **D-13:** The unread count badge keeps its existing `9+` overflow behaviour. Badge fill `COLORS.error`, text `COLORS.onError`.

### Vendor bottom bar

- **D-14:** `VendorBottomNavigation.js` keeps all five destinations, in the same order, with the same labels and routes: **Home, Orders, Products, Chats, Profile**.
- **D-15:** Delete the local `const COLORS` object at line 21 entirely. It is the Material red family: `primary: '#C62828'`, `primaryLight: '#E53935'`, `primaryDark: '#B71C1C'`, `primarySurface: '#FFEBEE'`, plus `text.active: '#C62828'` and `text.inactive: '#9CA3AF'`. Replace with `useColors()` from `ThemeContext`. Map `text.active` to `COLORS.primaryDark` and `text.inactive` to `COLORS.text.quaternary`.
- **D-16:** Use `NAV_SPACING`, same as D-10. The old local block at line 39 was already `4 / 6 / 8 / 12 / 16`.
- **D-17:** After this file, the vendor bar and the buyer bar look like siblings rather than two apps. That is the point. They differ only in their five destinations.
- **D-18:** This file also gains dark-mode support for free, because it stops using a private light-only palette. That is a visible change and it is intended.

### The last of the Material red

- **D-19:** `PalengkeHubFinal-main/src/components/EmptyState.js` also contains `#C62828`. Fix it here, since `EmptyState` is shell-adjacent and shared. Replace with `COLORS.primary`, and while you are in there confirm the empty state has exactly one action, per `design-system.html#empty`.
- **D-20:** `#C62828` still remains in `ProductDetailsScreen.js` (phase 6), `ReportIssueScreen.js` (backlog) and four admin screens (out of scope). Do not chase them here. A repo-wide search and replace would reach `AdminDashboardScreen.js`, which is explicitly forbidden.

### Gradients

- **D-21:** Any `LinearGradient` in these three files becomes a flat token fill.

### Claude's Discretion

- Exact pip size and placement on the active tab.
- Whether the header hairline is a `borderBottomWidth` or a separate `View`.
- Icon sizes within the design system's range (15 inline, 18 in chips and rows, 24 default, 30 in empty states).

</decisions>

<specifics>
## Specific Ideas

- The bottom bar is the single most-seen surface in the app. It is worth more care than any individual screen.
- The buyer bar and the vendor bar being visibly the same component family is what makes this feel like one product instead of two capstone projects glued together.
- Do not add a sixth tab. Do not merge two tabs. Five and five, exactly as they are.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component contracts
- `06-adoption/design-system.html#tabbar` - the production PalengkeHub bar: five destinations, PalengKart keeps its name, active tab gets brand-dark text plus a pip
- `06-adoption/design-system.html#bottom-nav` - the generic five-slot bar
- `06-adoption/design-system.html#navbar` - the app header. Note D-08: the open-or-closed pill and the location row are deferred
- `06-adoption/design-system.html#empty` - one action only
- `06-adoption/design-system.html#badges` - the count badge

### Tokens
- `PalengkeHubFinal-main/src/theme/tokens.js` - `NAV_SPACING`, `LAYOUT.tabBarHeight`, `LAYOUT.headerMinHeight`, `LAYOUT.minTapTarget`, `SHADOWS.bar`
- `06-adoption/DESIGN-SYSTEM.md` section "The three red families, resolved"

### Existing code
- `PalengkeHubFinal-main/src/components/Header.js` - prop signature at lines 36 to 47
- `PalengkeHubFinal-main/src/components/BottomNavigation.js` - the five labels at lines 148, 152, 156, 160, 164
- `PalengkeHubFinal-main/src/components/vendor/VendorBottomNavigation.js` - the rogue `COLORS` at line 21, the five labels at lines 150, 154, 158, 162, 166
- Phase 2 primitives in `PalengkeHubFinal-main/src/components/ui/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Both bottom bars already read the current route and derive an icon plus a label per destination. That logic is correct and stays.
- `Header.js` already calls `useNavigation()`, `useSafeAreaInsets()` and `useColors()`. All three stay.
- Phase 2's chip, badge and button primitives are used here.

### Established Patterns
- Safe-area insets come from `react-native-safe-area-context` via `useSafeAreaInsets()`. Keep using it. Do not hardcode a bottom padding for the home indicator.
- The bars are rendered per screen, not by a navigator tab bar. Do not restructure that; it would be a navigation change.

### Integration Points
- `Header.js` is used across customer and vendor screens. Every prop change ripples.
- Both bottom bars call `navigation.navigate(...)`. Those calls are frozen.

</code_context>

<non_goals>
## NON-GOALS

- **No routing or navigation changes.** Same five destinations, same order, same route names, same `navigate()` calls, in both bars.
- **No data fetching changes.** The unread count and cart count keep coming from exactly where they come from now.
- **No state changes.**
- **No API changes.**
- **No new dependency.**
- **No i18n changes.**
- **No new tabs, no removed tabs, no renamed labels.** PalengKart stays PalengKart.
- **No market open-or-closed pill.** See D-08.
- **Out of scope:** `PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js` and the other admin screens holding `#C62828`.

</non_goals>

<acceptance>
## Acceptance Criteria

1. `Header.js` exports the same eleven props with the same defaults.
2. Both bottom bars show the same five destinations in the same order and navigate to the same routes as before.
3. `grep -rn "C62828" PalengkeHubFinal-main/src/components/` returns nothing.
4. `grep -n "const COLORS = {" PalengkeHubFinal-main/src/components/vendor/VendorBottomNavigation.js` returns nothing.
5. Both bars use `NAV_SPACING`, and no tab item is under 44px tall.
6. The vendor bar now responds to dark mode.
7. No `LinearGradient` remains in the three files.

</acceptance>

<screenshots>
## Before and After Screenshot Checklist

`cd PalengkeHubFinal-main && npm run web`, capture at **375px** and **1440px**, before and after.

- [ ] Customer home with the bottom bar visible
- [ ] Each of the five buyer tabs, active state
- [ ] Vendor dashboard with the vendor bar visible (this is the big one, red goes orange)
- [ ] Each of the five vendor tabs, active state
- [ ] A screen with a back button in the header
- [ ] A screen with the cart count badge showing, ideally at 9+
- [ ] The vendor bar in dark mode, which did not work before
- [ ] Any empty state

</screenshots>

<rollback>
## Rollback Rule

If a tab navigates somewhere different, a badge count is wrong, a bar overlaps content or sits under the home indicator, or a header prop stops working: revert the whole phase.

```
git checkout design-system
git branch -D design/phase-03-nav-shell
```

Do not patch forward.

</rollback>

<deferred>
## Deferred Ideas

- The open-or-closed market pill and the collapsing location row: needs real market-hours state first. Backlog.
- `#C62828` in `ReportIssueScreen.js`: backlog.
- The sticky action bar (`design-system.html#action-bar`): phase 6, where it replaces the tab bar on product and cart screens rather than stacking on top of it.

</deferred>

---

*Phase: 03-nav-shell*
*Context authored: 2026-08-27*

# PalengkeHub Design System v1.0

For Jhay-Vy Adajar and the PalengkeHub team. English, plain language, meant to be read once and then kept open while you work.

## What this is

Four files. They are the single source of truth for how PalengkeHub looks, on all three surfaces: the Expo app, the admin dashboard and the public site.

| File | What it is | Where it goes |
|---|---|---|
| `design-system.html` | The living component library. Open it in a browser. Every component you need is there, working, with the rules written under it. This is the reference, not code to copy. | Keep it in the repo, or host it. Nothing imports it. |
| `tokens.js` | The colours, spacing, radius, shadows and type as a React Native module. Drop-in replacement for the `COLORS` object inside `src/contexts/ThemeContext.js`. | `src/theme/tokens.js` |
| `tokens.css` | The same values as CSS custom properties, plus aliases so `admin.css` and `index.css` keep working while you migrate. | `web/src/tokens.css` |
| `DESIGN-SYSTEM.md` | This file. | Anywhere. |

There is also a tiny `package.json` in this folder. It exists only so `node` can load `tokens.js` directly for a syntax check. **Do not copy it into the PalengkeHub repo.** Metro reads the ESM exports in `tokens.js` without it.

The design comes from variant 4, the "palengke identity" direction your team picked.

## The token philosophy: the logo decides

The audit found one thing that mattered more than everything else: **the logo and the app were different products**.

The logo is a woven basket, orange ring, chocolate-brown outline, a lettuce, a fish, a carrot, a tomato and an egg. The app was built on Tailwind red `#DC2626`, which appears nowhere in the logo, plus thirteen other reds that appear nowhere either.

So the rule for this design system is simple:

> **Every colour is sampled from the basket logo. If a colour is not in the logo or derived from a colour that is, it does not exist.**

| Logo element | Hex | Job in the system |
|---|---|---|
| Ring and "HUB" wordmark | `#E8833A` | `primary`. The only colour allowed on an action. |
| Outline and "PALENGKE" wordmark | `#261006` | `text.primary` and every ink shade below it. |
| Basket weave | `#E2BA87` | Borders, chip fills, input fills. |
| Lettuce | `#9EBF5C` | Success, and the MURA verdict. |
| Tomato | `#D34638` | Error, discounts, and the MAHAL verdict. Nothing else. |
| Fish | `#84BEE0` | Info. |
| Warm paper | `#F2E7D6` | The page canvas, with a faint woven texture. |

Two consequences worth stating out loud:

1. **Cards do not have drop shadows.** A warm white card (`#FFFDFA`) sitting on woven paper (`#F2E7D6`) already reads as raised. Shadows are reserved for things that genuinely float: dropdowns, sheets, modals, the bottom bar. This is why the UI looks calm instead of foamy.
2. **The 84 `LinearGradient` components go away.** Mainstream commerce apps use flat fills. The one place with a gradient left is the photo scrim on a promo banner, and that is a scrim, not decoration.

## The three red families, resolved

The audit found fourteen reds. They came from three unrelated systems.

| System | Where it lived | Old primary | What happens to it |
|---|---|---|---|
| A. Tailwind red | `ThemeContext.js`, `customerTheme.js`, `vendorTheme.js`, `admin.css` | `#DC2626` | Becomes `#E8833A`, the logo orange. |
| B. Material red | hardcoded in 10 app files, 109 times | `#C62828` | Becomes `#E8833A`. |
| C. "Semi Red" | `index.css`, `landingpage-website/style.css` | `#E63946` | Becomes `#E8833A`. |

**The decision: PalengkeHub's brand colour is the logo orange `#E8833A`. There is no brand red.**

Red survives in exactly one family, the logo tomato, and only for three jobs:

- `error` / `#D34638` and its text tone `#9E2B20`
- the discount badge on a product card
- the **MAHAL** verdict chip

That means: a red button in this app now always means "something went wrong" or "delete". It never means "buy". That is worth more than the fourteen hexes it replaces.

Orange is also the right commerce instinct: Shopee and Lazada are both orange, and it is warmer and more palengke than the red ever was.

## Old value to new token: the top 20

Search and replace, in this order. Everything on the left currently exists in `source/`.

| # | Old value | Where it is now | New token | New value |
|---|---|---|---|---|
| 1 | `#DC2626` | ThemeContext, both theme files, `--admin-primary` | `COLORS.light.primary` / `--brand` | `#E8833A` |
| 2 | `#EF4444` | `primaryLight`, dark `primary`, `--admin-primary-light` | `COLORS.light.primaryLight` / `--brand-hover` | `#F0913F` |
| 3 | `#B91C1C` | `primaryDark`, `--admin-primary-dark` | `COLORS.light.primaryDark` / `--brand-dark` | `#C96A28` |
| 4 | `#C62828` | 109 hardcoded hits across 10 files | `COLORS.light.primary` | `#E8833A` |
| 5 | `#E63946` | `--semi-red`, public web | `--brand` | `#E8833A` |
| 6 | `#DC3545` | `--accent`, a stray Bootstrap red | `--brand` | `#E8833A` |
| 7 | `#111827` | `text.primary`, `text.dark`, `--admin-text` | `COLORS.light.text.primary` / `--ink` | `#261006` |
| 8 | `#374151` | `text.secondary`, `text.medium` | `text.secondary` / `--ink-2` | `#5B4436` |
| 9 | `#6B7280` | `text.tertiary`, `text.light`, `--gray` | `text.tertiary` / `--ink-3` | `#8A7263` |
| 10 | `#9CA3AF` | `text.quaternary`, `text.lighter` | `text.quaternary` / `--ink-4` | `#A89484` |
| 11 | `#F8F9FA` | `background`, `--admin-bg` | `COLORS.light.background` / `--paper` | `#F2E7D6` |
| 12 | `#FFFFFF` | `surface`, `card`, `--admin-surface`, `--white` | `COLORS.light.card` / `--card` | `#FFFDFA` |
| 13 | `#F5F5F5` | `surfaceSecondary` | `surfaceSecondary` / `--wicker-soft` | `#F3E3CB` |
| 14 | `#F3F4F6` | `inputBg`, `borderLight`, `--admin-border-light` | `inputBg` / `borderLight` | `#F3E3CB` / `#EFDFC6` |
| 15 | `#E5E7EB` | `border`, `--admin-border` | `COLORS.light.border` / `--line` | `#E3CFB0` |
| 16 | `#10B981` | `success` | `COLORS.light.success` / `--leaf-dark` | `#61802F` |
| 17 | `#D1FAE5` | `successLight` | `successLight` / `--leaf-soft` | `#EDF3DE` |
| 18 | `#F59E0B` | `warning`, `gold` | `warning` / `gold` / `--gold` | `#D89A17` |
| 19 | `#FFF8E1` and `#FEF3C7` | `warningLight`, two files disagreed | `warningLight` / `--gold-soft` | `#FBEFD2` |
| 20 | `#3B82F6` | `info` (vendor), order status `accepted` | `COLORS.light.info` / `--fish-dark` | `#2C6C93` |

And five more that matter:

| # | Old value | New token | New value |
|---|---|---|---|
| 21 | `#FEE2E2` (`accentLight`, `badgeBg`, `errorLight`) | `accentLight` / `badgeBg` | `#FBE7D4` / `#FBE2DE` |
| 22 | `#FEF2F2` (`accentSoft`, `primarySurface`) | `primarySurface` / `--brand-tint` | `#FDF3E9` |
| 23 | `#0F0F1E`, `#1A1A2E`, `#16213E` (the navy dark theme) | `COLORS.dark.background` / `surface` / `surfaceSecondary` | `#17100A` / `#221812` / `#2E211A` |
| 24 | `rgba(0,0,0,0.08)` (`shadow`) | `COLORS.light.shadow` | `rgba(38,16,6,0.10)` |
| 25 | `#1A1A1A`, `#666666`, `#888888`, `#CCCCCC` and the rest of the ad-hoc grey ramp in `AdminDashboardScreen.js` (88 hits) | the `--ink` ramp | delete on contact |

Two values do **not** change: `--gcash: #007DFE` is a real third-party brand colour, and the `₱0.00` / `/ unit` price formatting stays exactly as it is.

## How ThemeContext stays working

`tokens.js` exports `COLORS` shaped exactly like the object currently sitting at lines 17 to 108 of `src/contexts/ThemeContext.js`. Every key is still there in both `light` and `dark`, including the legacy text aliases:

```
primary primaryLight primaryDark accent accentLight accentSoft
background surface surfaceSecondary card
text.primary text.secondary text.tertiary text.quaternary text.inverse
text.dark text.medium text.light text.lighter text.white text.tertiaryer
border borderLight
success successLight error errorLight warning warningLight
shadow shadowDark overlay inputBg badgeBg statusBar
gold primarySurface gcash gcashLight
```

So the migration is one commit and roughly four lines:

```js
// src/contexts/ThemeContext.js
import { COLORS } from '../theme/tokens';   // add this
// then delete the whole local `const COLORS = { ... }` block
```

Nothing else in that file changes. `ThemeProvider`, `useTheme`, `useColors`, the AsyncStorage key and the system-scheme follow all stay. The 34 files that read `COLORS.text.dark` keep working; they just get a brown instead of a grey.

`tokens.js` also adds keys the old object did not have (`info`, `infoLight`, `paper`, `wicker`, the four `verdict*` pairs, `ORDER_STATUS`). Adding keys is safe. Use them when you touch a screen; you do not have to go looking.

The next cleanups, in the order they will hurt least:

1. Delete `customerTheme.js` and `vendorTheme.js` colour blocks and re-export from `tokens.js`. They are byte-identical copies with two typo divergences (`text.primary` and dark `preparing`), so this removes a class of bug.
2. Replace the local `SPACING` constants inside `BottomNavigation.js` and `CategoryProductsScreen.js` with `NAV_SPACING`.
3. Replace the 109 hardcoded `#C62828` with `COLORS.primary`.
4. Delete `AdminDashboardScreen.js`'s private grey ramp.
5. Delete `web/public/icons.svg`. It is the unmodified Vite starter sprite with Bluesky, Discord and GitHub icons, and it ships to production.

## Typography plan

Two families. Not three, not four.

| Family | Role | Weights |
|---|---|---|
| **Baloo 2** | Display. Headings, stall names, prices, the wordmark. Rounded, warm, a bit hand-drawn, which matches the logo. | 600, 700, 800 |
| **Nunito** | UI. Everything a shopper reads quickly. | 400, 600, 700, 800, 900 |

**Mobile app.** There is currently no font at all: one `fontFamily` declaration in 112 files, and it says `system-ui`. To fix:

```
npx expo install expo-font @expo-google-fonts/baloo-2 @expo-google-fonts/nunito
```

Then load them in `App.js` and swap `TYPE.family.display` and `TYPE.family.ui` in `tokens.js` from `'system'` to `'Baloo2_700Bold'` and `'Nunito_700Bold'`. Until you do that, everything falls back to the platform default, which is what the app already renders, so **you can adopt `TYPE.size` and `TYPE.weight` today and nothing changes visually**.

**Web.** Currently loading Fraunces, Manrope, IBM Plex Mono and Space Grotesk. Space Grotesk is downloaded on every page and used nowhere in `web/src`. Replace the whole Google Fonts link with:

```html
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
```

Monospace uses the system stack. No webfont is downloaded for code.

**The scale.** Twenty font sizes ship today, including 9, 11, 13, 15, 17 and 26. Ten here:

| Token | px | Use |
|---|---|---|
| `priceHero` | 38 | the price on a product detail screen |
| `display` | 26 | screen title on a detail view |
| `h1` | 22 | greeting, sheet title |
| `h2` | 19 | section heading |
| `h3` | 17 | stall name, card title |
| `body` | 16 | default. Inputs never go below this or iOS zooms on focus. |
| `bodySmall` | 15 | secondary body |
| `label` | 14 | labels and meta rows |
| `caption` | 13 | captions |
| `micro` | 12 | uppercase chips and tab labels only |

Weights are always numeric strings: `'400' '600' '700' '800' '900'`. Never write `'bold'`. The customer theme used `'700'` and the vendor theme used `'bold'` for identical headings; that ends here.

## Icons

Pick one family. The app mixes Ionicons (382 uses), MaterialIcons (181) and Feather (1), so two different drawing styles sit next to each other on the same screen. **Keep Ionicons**, it is already the majority and its rounded outline style suits the logo. Convert the 181 MaterialIcons and the 1 Feather. There is already an `audit-icons.cjs` at the repo root, so this is half done.

Sizes: 15 inline with text, 18 in chips and rows, 24 default, 30 in empty states.

## Spacing, radius, shadows

**Spacing** is one 4px scale: 4 / 8 / 12 / 16 / 20 / 24 / 32. `customerSpacing` and `vendorSpacing` disagreed from `xl` upward; the tighter vendor values win. Bars and tab items use `NAV_SPACING` (4 / 6 / 8 / 12 / 16) instead of a local constant.

**Radius** is six steps, and three do almost all the work: `sm 10` on chips and in-card buttons, `md 12` on thumbnails and rows, `lg 16` on cards. Twenty radii ship today.

**Shadows** use one convention: a solid `shadowColor: '#261006'` with a fractional `shadowOpacity`, plus a matching Android `elevation`. The codebase currently mixes that with `shadowColor: 'rgba(...)'` and `shadowOpacity: 1`, which is why `customerShadows.md` and `vendorShadows.md` render differently despite looking identical in the source.

The primary button's press affordance is a solid 3px offset in `primaryDark`, not a blur. The button sinks 3px on press. That is the signature interaction of the system, and on React Native you build it with `borderBottomWidth`, not a shadow.

## Motion

`src/theme/motion.js` already exists and is correct. Keep it. `tokens.css` mirrors its three durations (150 / 220 / 320ms) as `--t-fast`, `--t-base`, `--t-slow` so the web moves at the same speed as the app.

## The one rule

> **Never hardcode a hex again. If a value is missing, add a token.**

Same for spacing, radius, font size and shadow. Every time someone writes `#C62828` inline, the system loses. Every time someone adds a token instead, it wins.

If you need a colour that is genuinely not here, ask first whether it can come from the logo. It usually can.

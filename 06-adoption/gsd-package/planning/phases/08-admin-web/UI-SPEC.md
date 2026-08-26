---
phase: 8
slug: admin-web
status: authored
shadcn_initialized: false
preset: none
created: 2026-08-27
---

# Phase 8 - UI Design Contract

> `web/` Vite admin dashboard. Token aliases, orphan deletion, rebuild. Optional and last.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | plain CSS custom properties. No CSS modules, no Tailwind, no component registry |
| Preset | PalengkeHub palengke identity, v1.0 |
| Component library | none. Hand written JSX plus `recharts` for charts (already a dependency) |
| Icon library | inline SVG, as today |
| Font | Baloo 2 and Nunito via one Google Fonts link |
| Reference | `06-adoption/tokens.css`, `06-adoption/design-system.html#colors`, `#elevation`, `#typography`, `#table`, `#stats` |

---

## Migration Strategy

Do **not** rewrite `admin.css`. It is roughly 2,900 lines of rules and every one of them reads a `--admin-*` variable. `tokens.css` ships alias blocks that redefine those variables in terms of the new palette, so the rules keep working untouched.

1. Copy `06-adoption/tokens.css` to `web/src/tokens.css`.
2. Import it **first** in `web/src/main.jsx`, before `index.css` and `admin.css`.
3. Delete the `:root` block at `web/src/admin.css` lines 6 to 27.
4. Delete the `:root` block at `web/src/index.css` lines 5 to 19.
5. Swap the Google Fonts link in `web/index.html` line 8.

That is the whole visual migration. Everything else in this phase is deletion and rebuild.

---

## Alias Map (already written, do not retype)

**Admin surface** (`web/src/admin.css` consumes these):

| Old variable | Old value | New value via alias |
|---|---|---|
| `--admin-primary` | `#DC2626` | `var(--brand)` = `#E8833A` |
| `--admin-primary-light` | `#EF4444` | `var(--brand-hover)` = `#F0913F` |
| `--admin-primary-dark` | `#B91C1C` | `var(--brand-dark)` = `#C96A28` |
| `--admin-bg` | `#F8F9FA` | `var(--paper)` = `#F2E7D6` |
| `--admin-surface` | `#FFFFFF` | `var(--card)` = `#FFFDFA` |
| `--admin-text` | `#111827` | `var(--ink)` = `#261006` |
| `--admin-text-secondary` | `#374151` | `var(--ink-2)` = `#5B4436` |
| `--admin-text-muted` | `#6B7280` | `var(--ink-3)` = `#8A7263` |
| `--admin-border` | `#E5E7EB` | `var(--line)` |
| `--admin-border-light` | `#F3F4F6` | `var(--line-soft)` |
| `--admin-shadow` .. `--admin-shadow-xl` | four rgba blurs | `var(--e-1)` .. `var(--e-3)` |
| `--admin-radius-sm` / `--admin-radius` / `--admin-radius-lg` | 8 / 12 / 16 | `var(--r-sm)` / `var(--r-md)` / `var(--r-lg)` |
| `--transition-fast` / `--transition-smooth` | cubic beziers | `var(--t-fast)` / `var(--t-base)` |

**Public surface** (`web/src/index.css` consumes these):

| Old variable | Old value | New value via alias |
|---|---|---|
| `--semi-red` | `#E63946` | `var(--brand)` |
| `--semi-red-deep` | `#C1121F` | `var(--brand-dark)` |
| `--red-deep` / `--red` / `--red-soft` | `#7A1C1E` / `#8C2023` / `#A52A2D` | `var(--ink)` / `var(--brand-dark)` / `var(--brand)` |
| `--accent` | `#DC3545` | `var(--brand)` |
| `--white` | `#FFFFFF` | `var(--card)`, now warm white |
| `--light-bg` | `#FFF5F5` | `var(--paper)` |
| `--gray` | `#6B7280` | `var(--ink-3)` |
| `--ink` | `#1A1A1A` | the logo brown `#261006` |
| `--line` | `rgba(255,255,255,.14)` | the tan hairline |
| `--display` / `--body` / `--mono` | Fraunces / Manrope / IBM Plex Mono | `var(--f-display)` / `var(--f-ui)` / `var(--f-mono)` |

---

## Typography

Replace the whole Google Fonts link at `web/index.html:8` with:

```html
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
```

Removed: Fraunces (serif display), Manrope, IBM Plex Mono, and **Space Grotesk**, which was downloaded on every page and used nowhere in `web/src`. Monospace falls back to the system stack.

---

## Color

Same rules as the app, expressed as CSS variables.

| Role | Variable | Value |
|---|---|---|
| Dominant (60%) | `--paper` | `#F2E7D6` |
| Secondary (30%) | `--card` | `#FFFDFA` |
| Accent (10%) | `--brand` | `#E8833A` |
| Destructive | the tomato family | error, delete, and nothing else |
| Ink ramp | `--ink`, `--ink-2`, `--ink-3`, `--ink-4` | `#261006`, `#5B4436`, `#8A7263`, `#A89484` |

**Accent reserved for:** the primary action in a toolbar or modal, the active item in the side navigation, and the focus ring. Not for table headers, not for chart series (charts get the semantic families), not for every link.

One value does **not** change anywhere: `--gcash: #007DFE` is a real third-party brand colour.

---

## Elevation

The dashboard is the one surface where shadows are used normally, because it has real floating chrome: dropdowns, modals, drawers and toasts. Use `--e-1` through `--e-3`. Data tables and stat cards still separate by contrast and border, not by shadow.

---

## Copywriting Contract

**Unchanged.** No admin copy is edited in this phase. This is a colour, font and deletion phase.

---

## UI Considerations

Applicable state considerations resolved: 4 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| populated | dashboard, tables, charts | covered | Existing markup, new variables. Nothing restructured |
| loading | dashboard | covered | Unchanged. Existing loading states inherit the new palette |
| error | login | covered | Unchanged behaviour, error copy now uses the tomato family |
| empty | tables | covered | Unchanged |
| overflow | recharts series colours | backstop | Charts may hardcode series colours in JSX rather than reading CSS variables. Check every chart visually; a chart still drawing Tailwind red after this phase is the most likely leftover |
| long-text | table cells at 1440px | backstop | Nunito is wider than Manrope in some ranges. Verify no table column now wraps where it did not before |

**Reduced motion:** honour `prefers-reduced-motion` on the dashboard's existing transitions. `tokens.css` mirrors the app's three durations as `--t-fast`, `--t-base` and `--t-slow`, so the web moves at the same speed as the app.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | No new dependency in this phase. Not one. |

---

## Deletion Checklist

Confirm zero importers for each before deleting.

- [ ] `web/src/Layout.jsx`
- [ ] `web/src/pages/Home.jsx` (**the lint failure**, invalid JS at lines 4 to 9)
- [ ] `web/src/pages/Shop.jsx`
- [ ] `web/src/pages/Sell.jsx`
- [ ] `web/src/pages/About.jsx`
- [ ] `web/src/pages/Contact.jsx`
- [ ] `web/src/components/Header.jsx` (imported only by `Layout.jsx`)
- [ ] `web/src/components/Footer.jsx` (imported only by `Layout.jsx`)
- [ ] `web/public/icons.svg` (the Vite starter sprite with Bluesky, Discord and GitHub icons)

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS (nothing changed)
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

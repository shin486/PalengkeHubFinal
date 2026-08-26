---
phase: 7
slug: fonts
status: authored
shadcn_initialized: false
preset: none
created: 2026-08-27
---

# Phase 7 - UI Design Contract

> Typography only. Two families, seven weights, ten sizes. Nothing else on this branch.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Native `StyleSheet.create`) |
| Preset | PalengkeHub palengke identity, v1.0 |
| Component library | unchanged |
| Icon library | unchanged (Ionicons) |
| Font | **Baloo 2** (display) and **Nunito** (UI), loaded via `expo-font` |
| Reference | `06-adoption/design-system.html#typography`, `06-adoption/DESIGN-SYSTEM.md` section "Typography plan" |

---

## Families

| Family | Role | Weights loaded | `TYPE.family` value |
|---|---|---|---|
| **Baloo 2** | Display. Headings, stall names, prices, the wordmark. Rounded and warm, which matches the basket logo. | 600, 700, 800 | `TYPE.family.display` becomes `'Baloo2_700Bold'` |
| **Nunito** | UI. Everything a shopper reads quickly. | 400, 600, 700, 800, 900 | `TYPE.family.ui` becomes `'Nunito_700Bold'` |
| system monospace | Code and numeric tables. No webfont is shipped for it. | none | `TYPE.family.mono` stays `'monospace'` |

Two families. Not three.

---

## The Scale (unchanged, activated)

`TYPE.size` already ships these ten. This phase does not change a single value.

| Token | px | Use |
|-------|----|-----|
| `priceHero` | 38 | the price on a product detail screen |
| `display` | 26 | screen title on a detail view |
| `h1` | 22 | greeting, sheet title |
| `h2` | 19 | section heading |
| `h3` | 17 | stall name, card title |
| `body` | 16 | default. Inputs never go below this or iOS zooms on focus |
| `bodySmall` | 15 | secondary body |
| `label` | 14 | labels and meta rows |
| `caption` | 13 | captions, the `/ unit` suffix |
| `micro` | 12 | uppercase chips and tab labels only |

Twenty sizes shipped before phase 1, including 9, 11, 13, 15, 17 and 26. Ten survive. Do not reintroduce the others to make something fit.

---

## Weights

Always numeric strings. Never `'bold'`.

| Token | Value | Role |
|---|---|---|
| `TYPE.weight.regular` | `'400'` | long body copy only |
| `TYPE.weight.medium` | `'600'` | body |
| `TYPE.weight.semibold` | `'700'` | default UI text |
| `TYPE.weight.bold` | `'800'` | headings and labels |
| `TYPE.weight.black` | `'900'` | prices and CTAs |

**The weight trap.** On React Native a named font file carries its own weight, so `fontFamily: 'Nunito_700Bold'` plus `fontWeight: '400'` does not produce regular Nunito. Either map each weight token to its own family string, or accept the loaded weight per role. Whichever you choose, write it in the PR description. This is the most common way a font migration silently goes wrong.

---

## Line Height and Letter Spacing (unchanged)

| Token | Value | Use |
|---|---|---|
| `TYPE.lineHeight.tight` | 1.15 | display sizes |
| `TYPE.lineHeight.snug` | 1.25 | card titles |
| `TYPE.lineHeight.base` | 1.45 | body |
| `TYPE.lineHeight.relaxed` | 1.6 | long-form paragraphs |
| `TYPE.letterSpacing.price` | -0.4 | large numerals tighten |
| `TYPE.letterSpacing.normal` | 0.1 | default |
| `TYPE.letterSpacing.caps` | 0.5 | uppercase chips and labels |

---

## Color, Spacing, Radius, Elevation

**Unchanged.** This phase touches typography only. If a colour, a spacing value, a radius or a shadow moves on this branch, the phase has gone out of scope and should be re-planned.

---

## Copywriting Contract

**Unchanged.** Not one string is edited in this phase. Existing copy simply renders in a different face.

---

## UI Considerations

Applicable state considerations resolved: 2 covered, 4 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | app startup | covered | The tree does not render until all seven weights are ready. No font swap flash |
| error | font load failure | covered | If `useFonts` errors, the app still renders with the platform default rather than hanging on a blank screen |
| long-text | product and stall names | backstop | Baloo 2 is wider than most system faces. A 40+ character Tagalog stall name must still truncate to 2 lines and not gain a third. Verify at 375px |
| overflow | product detail price block | backstop | `priceHero` at 38px weight 900 in Baloo 2 is the most likely single thing to overflow. `₱1,250.00 / kg` must fit on one line at 375px |
| overflow | tab labels | backstop | Five 12px labels must still fit across 375px without truncating |
| overflow | button labels | backstop | No button label may wrap to a second line. Check the longest CTA on every migrated screen |

**Fix rule for any overflow:** adjust the container or the truncation in that one component. Never change a `TYPE.size` value.

**Reduced motion:** not applicable to this phase.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| npm | `expo-font`, `@expo-google-fonts/baloo-2`, `@expo-google-fonts/nunito` | Install with `npx expo install`, not plain npm, so versions match Expo 54. These are the only three packages this project may add. Verify each package name character by character before installing; Google font packages are a known typosquatting target. |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS (nothing changed)
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS (nothing changed)
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS (nothing changed)
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

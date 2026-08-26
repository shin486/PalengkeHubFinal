# Phase 7: Fonts - Context  (OPTIONAL, DO THIS LAST)

**Gathered:** 2026-08-27 (hand authored, no discuss step needed)
**Status:** Ready for planning, optional

**Branch:** `design/phase-07-fonts`

<domain>
## Phase Boundary

Load Baloo 2 and Nunito, and switch `TYPE.family` in `tokens.js` from the placeholder `'system'` to the real family names.

This is the **only phase in the entire project that adds a dependency**, and the only one that can change every text metric in the app at the same time. That is why it is last and why it is alone on its own branch.

Nothing else changes. No screen is restructured. No colour moves. No layout is redesigned. Only the glyphs.

</domain>

<decisions>
## Implementation Decisions

### Why this is safe to defer, and why it is safe to do

- **D-01:** The app currently loads **no font at all**. `expo-font` is not in `package.json`, there are no font files in the repo, and there are exactly three `fontFamily` declarations in all 114 files under `src/` (`CheckoutScreen.js:902` and `:935` say `'inherit'`, `ProfileScreen.js:670` says `'system-ui, -apple-system, sans-serif'`). Everything renders in the platform default.
- **D-02:** That is why `TYPE.size` and `TYPE.weight` could be adopted back in phase 1 with zero visual risk: `TYPE.family.display` and `TYPE.family.ui` are both the string `'system'`, which React Native ignores, so every string kept rendering exactly as before.
- **D-03:** It is also why this phase is genuinely risky in a way the others are not. The moment a real family is applied, every glyph width in the app changes at once. Text that fitted may wrap. Two-line names may become three. Buttons may grow.

### Install

- **D-04:** Install with Expo's own installer so the versions match the SDK, not with plain npm:

  ```
  cd PalengkeHubFinal-main
  npx expo install expo-font @expo-google-fonts/baloo-2 @expo-google-fonts/nunito
  ```

- **D-05:** Do not pin the versions by hand. `npx expo install` resolves what is correct for Expo 54. Whatever it writes into `package.json` is the right answer.
- **D-06:** These are the only three packages this project is allowed to add. Not a fourth.

### Load

- **D-07:** Load the fonts in `PalengkeHubFinal-main/App.js`, in the `App` component at line 637, with `useFonts` from `expo-font`. Render nothing (or the existing splash) until `fontsLoaded` is true. Do not render the tree with a half-loaded font and let it swap; that flash is worse than a slightly longer splash.
- **D-08:** `expo-splash-screen` is **not** currently a dependency. Do not add it. Gate on `fontsLoaded` with the app's existing loading path instead. If there is genuinely no loading path, returning `null` until fonts are ready is acceptable and adds no package.
- **D-09:** Weights to load, and only these:
  - Baloo 2: `Baloo2_600SemiBold`, `Baloo2_700Bold`, `Baloo2_800ExtraBold`
  - Nunito: `Nunito_400Regular`, `Nunito_600SemiBold`, `Nunito_700Bold`, `Nunito_800ExtraBold`, `Nunito_900Black`

  Seven font files. Every extra weight is bundle size for nothing.

### Activate

- **D-10:** In `PalengkeHubFinal-main/src/theme/tokens.js`, change two strings:

  ```
  family: {
    display: 'Baloo2_700Bold',   // was 'system'
    ui: 'Nunito_700Bold',        // was 'system'
    mono: 'monospace',           // unchanged, no webfont ships for code
  }
  ```

- **D-11:** **The weight trap.** On React Native, a named font file carries its own weight. Setting `fontFamily: 'Nunito_700Bold'` together with `fontWeight: '400'` does not give you regular Nunito; behaviour varies by platform and it is usually wrong. Either map each `TYPE.weight` value to its own family string, or accept the loaded weight per role. **Decide this explicitly in the plan and write the decision down**, because it is the single most common way font migrations break.
- **D-12:** Baloo 2 is the display face: headings, stall names, prices, the wordmark. Nunito is the UI face: everything a shopper reads quickly. Two families. Not three, not four.
- **D-13:** Remove the three stray `fontFamily` declarations found in D-01, since they are web CSS strings that mean nothing in React Native.

### Verify

- **D-14:** After activation, re-walk **every screen touched in phases 3 to 6** at 375px and check for: clipped text, a name that grew from two lines to three, a button whose label now wraps, a price that no longer fits beside its unit, a tab label that truncates.
- **D-15:** Baloo 2 is rounder and wider than most system faces. Prices at `priceHero` (38px, weight 900) are the most likely thing to overflow. Check the product detail price block first.
- **D-16:** If something overflows, fix it by adjusting the container or truncation in that one place. **Do not** change a `TYPE.size` value to make one screen fit. The scale is the scale.

### Claude's Discretion

- The exact shape of the loading gate in `App.js`.
- The weight mapping strategy in D-11, as long as it is written down.
- Whether to also apply the fonts to the web landing pages in the same PR (allowed, they are separate files, but a second PR is cleaner).

</decisions>

<specifics>
## Specific Ideas

- Baloo 2 is rounded, warm and slightly hand drawn, which is exactly what the basket logo is. That is why it was chosen. Nunito is its quiet, legible partner.
- Do not put a third family in "just for the prices". The design system says two, and two is already one more than the app has today.
- If this phase goes wrong it goes wrong everywhere at once, which is precisely why it is alone on a branch. Reverting it costs one command.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `06-adoption/DESIGN-SYSTEM.md` section "Typography plan" - the two families, the ten sizes, the numeric weights rule, and the exact `npx expo install` line
- `06-adoption/design-system.html#typography` - the rendered scale
- `PalengkeHubFinal-main/src/theme/tokens.js` - `TYPE.family`, `TYPE.size`, `TYPE.weight`, `TYPE.lineHeight`, `TYPE.letterSpacing`, `TEXT_STYLES`
- `PalengkeHubFinal-main/App.js` - the `App` component at line 637
- `PalengkeHubFinal-main/package.json` - proof that `expo-font` and `expo-splash-screen` are both absent today

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TEXT_STYLES` in `tokens.js` already assembles nine ready-made text styles. Once `TYPE.family` is real, every one of them picks up the font with no further edits.
- `App.js` already has several `useEffect` hooks and an existing startup path. The font gate fits into that, it does not need a new architecture.

### Established Patterns
- Weights are always numeric strings: `'400' '600' '700' '800' '900'`. Never `'bold'`. The old customer theme used `'700'` and the old vendor theme used `'bold'` for identical headings, which is one of the reasons they rendered differently.
- Twenty font sizes shipped in the app before phase 1, including 9, 11, 13, 15, 17 and 26. Ten survive in `TYPE.size`. Do not reintroduce any of the others.

### Integration Points
- Every screen. That is the point, and that is the risk.

</code_context>

<non_goals>
## NON-GOALS

- **No data fetching changes. No routing changes. No state changes. No API changes.** Same as every other phase.
- **No fourth package.** `expo-font` plus the two Google font packages, nothing else. No `expo-splash-screen`.
- **No new font sizes.** `TYPE.size` has ten. Ten is the number.
- **No third family.**
- **No layout redesign to accommodate the fonts.** Fix an overflow locally in the one component that overflows. Do not restyle a screen.
- **No changes to `TYPE.size` values.** See D-16.
- **Out of scope:** `PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js`. It will inherit the fonts automatically, which is fine, but do not go in there to adjust anything.

</non_goals>

<acceptance>
## Acceptance Criteria

1. `expo-font`, `@expo-google-fonts/baloo-2` and `@expo-google-fonts/nunito` are in `PalengkeHubFinal-main/package.json`, at versions chosen by `npx expo install`.
2. `App.js` loads the seven weights from D-09 and does not render the tree until they are ready.
3. `TYPE.family.display` is `'Baloo2_700Bold'` and `TYPE.family.ui` is `'Nunito_700Bold'` in `src/theme/tokens.js`.
4. The weight strategy from D-11 is written down in the PR description.
5. The three stray `fontFamily` declarations are gone.
6. **No text is clipped, no button label wraps, no name gained a line, and no tab label truncates, on any screen touched in phases 3 to 6, at 375px.**
7. The app starts in a reasonable time. If the splash gets noticeably longer, drop a weight.
8. Nothing about what any screen fetches, shows or navigates to changed.

</acceptance>

<screenshots>
## Before and After Screenshot Checklist

`cd PalengkeHubFinal-main && npm run web`, capture at **375px** and **1440px**, before and after. This phase needs more screenshots than any other, because the change is everywhere.

- [ ] Home, top of screen
- [ ] Home, full page at 375px
- [ ] Category products grid
- [ ] Search results with comparison rows
- [ ] **Product detail price block. Check this one first, the 38px price is the most likely to overflow**
- [ ] Product detail, full page at 375px
- [ ] Both bottom bars, checking the 12px tab labels
- [ ] A header with a long title
- [ ] A product card with a 40+ character Tagalog name
- [ ] Any button with a long label
- [ ] One screen in dark mode

</screenshots>

<rollback>
## Rollback Rule

If anything is clipped, wrapped, truncated or overlapping that was not before, and it cannot be fixed locally in one component: revert the whole phase.

```
git checkout design-system
git branch -D design/phase-07-fonts
```

Then `npm install` to drop the three packages back out. The app returns to the platform default font, which is exactly what shipped through phases 1 to 6, and nothing else is lost. This phase is genuinely optional. The design system works without it.

</rollback>

<deferred>
## Deferred Ideas

- Swapping the web font link on the landing pages and the admin dashboard to the same two families. Cleaner as its own PR, and phase 08 touches those files anyway.
- Trimming Space Grotesk, which the web currently downloads on every page and uses nowhere in `web/src`.

</deferred>

---

*Phase: 07-fonts*
*Context authored: 2026-08-27*

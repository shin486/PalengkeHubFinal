# Roadmap: PalengkeHub UI Refresh

## Overview

Eight phases, cut by layer rather than by feature. Phase 1 makes one file the source of every colour, space and radius. Phases 2 and 3 build the shared pieces and the shell that every screen sits inside. Phases 4, 5 and 6 apply the system to the three screens a buyer actually spends time on, ending with price comparison promoted to the top of product detail. Phases 7 and 8 are optional and can be done weeks later: fonts, and the admin web dashboard. Nothing in any phase changes behaviour.

## Phases

**Phase Numbering:** integer phases only. There are no inserted decimal phases yet.

- [ ] **Phase 1: Tokens** - one file becomes the source of every colour, space and radius in the app
- [ ] **Phase 2: Primitives** - buttons, cards, chips, badges, price text and verdict chips, built once
- [ ] **Phase 3: Nav Shell** - header and both bottom bars, and the last Material red dies
- [ ] **Phase 4: Home Screen** - flat search header, category chips, real product and stall cards
- [ ] **Phase 5: Listing Screens** - category products and search, on the system
- [ ] **Phase 6: Detail And Compare** - product detail leads with price comparison, unit bug fixed
- [ ] **Phase 7: Fonts** - optional, later. Baloo 2 and Nunito actually load
- [ ] **Phase 8: Admin Web** - optional, later. Vite dashboard on `tokens.css`, orphan pages deleted

## Phase Details

### Phase 1: Tokens
**Goal**: Every colour, space and radius in the buyer-facing app resolves to `PalengkeHubFinal-main/src/theme/tokens.js`.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-02, REQ-03
**Success Criteria** (what must be TRUE):
  1. `PalengkeHubFinal-main/src/theme/tokens.js` exists and is a byte copy of the design system's `tokens.js`.
  2. `ThemeContext.js` imports `COLORS` from it and no longer declares its own; the provider, both hooks, the `@palengkehub_theme` AsyncStorage key and the system scheme follow are unchanged.
  3. No local `SPACING` or `RADIUS` const survives in the 14 listed files.
  4. `SignUpScreen.js` and `VendorBottomNavigation.js` no longer declare their own `COLORS`.
  5. Every screen still renders, navigates and loads the same data as before. Only the colours differ.
**Plans**: TBD

Plans:
- [ ] 01-01: add tokens.js, re-point ThemeContext and vendorTheme, gut customerTheme
- [ ] 01-02: delete the 14 local SPACING and RADIUS blocks
- [ ] 01-03: remove the two rogue local COLORS objects

### Phase 2: Primitives
**Goal**: The repeating visual pieces exist once each, matching `design-system.html`.
**Depends on**: Phase 1
**Requirements**: REQ-04
**Success Criteria** (what must be TRUE):
  1. A primary button anywhere in the app is orange with a solid 3px `primaryDark` bottom edge that sinks on press.
  2. A card is warm white with a 2px tan border and no drop shadow.
  3. A verdict chip renders MURA, KATAMTAMAN, MAHAL or PINAKAMURA from the verdict token pairs.
  4. Price text uses the price text styles, and the peso sign and the `/ unit` suffix are unchanged from today.
  5. No behaviour changed anywhere.
**Plans**: TBD

Plans:
- [ ] 02-01: buttons and cards
- [ ] 02-02: chips, badges and verdict chips
- [ ] 02-03: price text

### Phase 3: Nav Shell
**Goal**: The header and both bottom bars match the design system, and the Material red family is gone from the app.
**Depends on**: Phase 2
**Requirements**: REQ-05
**Success Criteria** (what must be TRUE):
  1. `Header.js`, `BottomNavigation.js` and `VendorBottomNavigation.js` take every value from tokens.
  2. Both bars use `NAV_SPACING`, not a local scale.
  3. `#C62828` no longer appears in `VendorBottomNavigation.js`, `Header.js` or `EmptyState.js`.
  4. Tab labels and destinations are unchanged: Home, PalengKart, Orders, Chats, Profile for buyers; Home, Orders, Products, Chats, Profile for vendors.
**Plans**: TBD

Plans:
- [ ] 03-01: Header
- [ ] 03-02: both bottom bars

### Phase 4: Home Screen
**Goal**: `HomeScreen.js` looks like the design system home screen.
**Depends on**: Phase 3
**Requirements**: REQ-06
**Success Criteria** (what must be TRUE):
  1. The search header is a flat brand fill, not a `LinearGradient`.
  2. A round category chip row exists, with the Tagalog label first and the English underneath.
  3. All six existing sections still render, in the same order, from the same i18n keys.
  4. Product and stall cards use the phase 2 primitives.
  5. Nothing about what the screen fetches or where it navigates changed.
**Plans**: TBD

Plans:
- [ ] 04-01: search header and category chips
- [ ] 04-02: the six section rails

### Phase 5: Listing Screens
**Goal**: `CategoryProductsScreen.js` and `SearchScreen.js` are on the system.
**Depends on**: Phase 4
**Requirements**: REQ-07
**Success Criteria** (what must be TRUE):
  1. Both screens use the phase 2 card, chip and price primitives.
  2. The sort control still offers exactly the same options and still sorts identically.
  3. The Tagalog fuzzy match in search still works.
  4. Empty states say what to do next.
**Plans**: TBD

Plans:
- [ ] 05-01: CategoryProductsScreen
- [ ] 05-02: SearchScreen

### Phase 6: Detail And Compare
**Goal**: Product detail leads with price comparison, and the cheapest badge stops comparing across different units.
**Depends on**: Phase 5
**Requirements**: REQ-08
**Success Criteria** (what must be TRUE):
  1. The price and the comparison roster are above the fold at 375px.
  2. The "Best Deal" and "Pinakamura" badges are only awarded among prices that share a unit.
  3. When a stall sells the same product by a different unit, the row shows the listed price and its unit rather than being ranked against a different unit.
  4. The comparison numbers themselves are unchanged. Only which of them gets a badge, and how they are displayed, changed.
**Plans**: TBD

Plans:
- [ ] 06-01: promote price comparison in ProductDetailsScreen
- [ ] 06-02: unit-aware badge display in ProductDetailsScreen and SearchScreen

### Phase 7: Fonts (OPTIONAL, LATER)
**Goal**: Baloo 2 and Nunito actually render.
**Depends on**: Phase 6
**Requirements**: REQ-09
**Success Criteria** (what must be TRUE):
  1. `expo-font`, `@expo-google-fonts/baloo-2` and `@expo-google-fonts/nunito` are installed and loaded in `App.js` behind a splash gate.
  2. `TYPE.family.display` and `TYPE.family.ui` in `tokens.js` are the real family names.
  3. No text is clipped or wrapped differently at 375px on any screen touched in phases 3 to 6.
**Plans**: TBD

Plans:
- [ ] 07-01: install and load the fonts
- [ ] 07-02: activate TYPE.family and re-check every migrated screen

### Phase 8: Admin Web (OPTIONAL, LATER)
**Goal**: The Vite admin dashboard reads the shared tokens, and lint passes.
**Depends on**: Phase 1 only (it does not need the app phases)
**Requirements**: REQ-10
**Success Criteria** (what must be TRUE):
  1. `web/src/tokens.css` exists and both `index.css` and `admin.css` derive their variables from it.
  2. The 8 orphaned page and layout files are deleted and `npm run lint` in `web/` passes.
  3. `npm run build` in `web/` still succeeds and the 3 admin routes still work.
  4. `pages-deploy/` is rebuilt from the new build in the same commit.
**Plans**: TBD

Plans:
- [ ] 08-01: tokens.css and the two :root blocks
- [ ] 08-02: delete orphans, lint, rebuild pages-deploy

## Progress

**Execution Order:**
Phases execute in numeric order: 1 to 6, then optionally 7 and 8.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tokens | 0/3 | Not started | - |
| 2. Primitives | 0/3 | Not started | - |
| 3. Nav Shell | 0/2 | Not started | - |
| 4. Home Screen | 0/2 | Not started | - |
| 5. Listing Screens | 0/2 | Not started | - |
| 6. Detail And Compare | 0/2 | Not started | - |
| 7. Fonts | 0/2 | Not started (optional) | - |
| 8. Admin Web | 0/2 | Not started (optional) | - |

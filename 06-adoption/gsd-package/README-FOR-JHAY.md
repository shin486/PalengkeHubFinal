# Start Here, Jhay

Hi Jhay. This branch contains everything you need to move PalengkeHub onto the new design system, one small step at a time, without breaking anything that already works.

You do not need to redesign anything yourself. The design is already decided. What is left is applying it, and this package walks you through that.

Read this file once, top to bottom. It takes about ten minutes. Then start with the install command.

---

## The easiest way

If you would rather not run the setup yourself, you do not have to. There is a file at the root of this repo called **`FOR-CLAUDE.md`**. It is written for the AI, not for you, and it contains the whole process: the setup commands, the phase order, the guardrails and what to do when something goes wrong.

Open Claude Code in the root folder of this repo and type exactly this one sentence:

> Read FOR-CLAUDE.md and help me start.

That is it. Claude will read the plan, walk you through the install, and drive the phases with you one at a time. Everything below is still worth reading so you know what it is doing, but you can start with that sentence today.

---

## 1. What is on this branch

Three things were added. Nothing that already existed was deleted or moved.

| Folder | What it is |
|---|---|
| `06-adoption/` (or wherever Ben placed it) | The design system: `design-system.html` (open it in a browser, it is the living component library), `tokens.js`, `tokens.css`, `DESIGN-SYSTEM.md`. |
| `PalengkeHubFinal-main/landingpage-website/v2/` | The new public landing page, as a separate folder. The current live landing page at `PalengkeHubFinal-main/landingpage-website/` is untouched, so nothing on palengkehub.site breaks until you decide to switch. |
| `06-adoption/gsd-package/` | This package. The migration plan, already written out phase by phase. |

**Important path note.** In this repo the Expo app does not live at `src/`. It lives at `PalengkeHubFinal-main/src/`. Every app path in this package is written from the repo root, so it always starts with `PalengkeHubFinal-main/`. The Vite admin dashboard lives at `web/`.

---

## 2. What GSD is, in five lines

1. GSD is a set of slash commands for Claude Code that turn "make my app look like the design system" into a series of small, reviewable steps.
2. It keeps its memory in a folder called `.planning/` at the root of your repo, so you can close your laptop and pick up next week without losing the thread.
3. The loop is always the same: **Plan, Execute, Verify, Ship.** One phase at a time.
4. Normally GSD interviews you first to build that `.planning/` folder. **We already wrote it for you**, so you can skip that part.
5. It does not do anything on its own. Every step stops and asks you before it changes files.

---

## 3. Install it

Open a terminal at the **root of the repo** (the folder that contains both `PalengkeHubFinal-main/` and `web/`) and run:

```
npx @opengsd/gsd-core@1.11.0 --claude --local
```

That is the exact command. Three things about it matter:

- **`@1.11.0`** is a pinned version. We reviewed this exact version. Do not use `@latest`, because a newer version may behave differently from what this package assumes.
- **`--local`** installs GSD into this project only, not into your whole computer. If something goes wrong, the damage is limited to one folder.
- **`--claude`** picks Claude Code as the runtime.

### Warning about the package name

npm has several unrelated packages with similar names: `get-shit-done`, `gsd`, `gsd-cli`. **None of them are this tool.** They are different projects by different people and installing them will not give you GSD. The only correct name is `@opengsd/gsd-core`, with the `@opengsd/` scope in front.

### After the install

The installer adds some permission rules to `.claude/settings.json`, including one that pre-approves running `npx gsd-core ...` without asking. If you would rather be asked every time, open `.claude/settings.json` and delete that one line. GSD still works fine, it will just prompt you.

### Copy the planning folder into place

GSD looks for a folder named `.planning/` at the repo root. This package ships it as `planning/` (no dot) so it is easy to see. Copy it:

**Windows PowerShell**
```
Copy-Item -Recurse 06-adoption\gsd-package\planning .planning
```

**macOS or Linux**
```
cp -r 06-adoption/gsd-package/planning .planning
```

Then open `.planning/config.json` and check one line: `"base_branch"`. It is set to `"design-system"`, which assumes this package arrived on a branch named `design-system`. If Ben named the branch something else, change that one value to match. Nothing else in the config needs editing.

---

## 4. The five commands you actually need

Type `/gsd` in Claude Code and it will list everything. You only need these five. Claude Code writes them as `/gsd:plan-phase`; some GSD docs write the same command as `/gsd-plan-phase`. They are the same thing.

| # | Command | When | What it does |
|---|---|---|---|
| 1 | `/gsd:discuss-phase 1` | Optional | Asks you questions about the phase. **You can skip this.** We already wrote the answers into `01-CONTEXT.md`. Only run it if you want to change a decision. |
| 2 | `/gsd:plan-phase 1` | Always, first | Reads the phase context we wrote, looks at your real code, and produces a `PLAN.md` with concrete tasks. Read the plan before approving it. |
| 3 | `/gsd:execute-phase 1` | After the plan looks right | Actually edits the files. Stops at checkpoints. |
| 4 | `/gsd:verify-work 1` | After execute finishes | Walks you through what changed and asks you to confirm it works. This is where you compare your before and after screenshots. |
| 5 | `/gsd:ship 1` | Last | Creates the pull request and closes out the phase. |

Then repeat with `2`, `3`, and so on.

**You do not need `/gsd:onboard`.** That command is for repos with no `.planning/` folder. Yours already has one.

---

## 5. The golden rules

These five rules are what keep this safe. If you only remember one thing from this file, remember these.

**1. Design layer only.** This whole migration changes how things look. It does not change what they do. No new data fetching, no changed Supabase queries, no routing changes, no new state, no API changes, no changes to what a button does when you press it. If a plan proposes any of that, say no.

**2. If behavior differs, revert the phase.** After a phase, if a screen loads different data, navigates somewhere new, or an action stopped working, that is a bug, not a design opinion. Do not patch it. Revert the whole phase branch and re-plan. `git checkout main-branch-name` and delete the phase branch. Nothing of value is lost, because each phase is small.

**3. One phase equals one branch equals one PR.** GSD is configured to create the branch for you, named `design/phase-01-tokens`, `design/phase-02-primitives`, and so on. Never work on two phases in the same branch. Never merge a phase you have not screenshotted.

**4. Always screenshot before and after, at 375 and 1440.** Before you start a phase, capture the screens that phase touches. After, capture the same screens the same way. Put both in the PR. This is how you and Ben can see what changed in ten seconds instead of reading a diff.

   How to capture:
   ```
   cd PalengkeHubFinal-main
   npm run web
   ```
   That runs the app in a browser on port 8082. Open dev tools, set the viewport to **375px** wide (phone), screenshot, then set it to **1440px** wide (desktop), screenshot. For phase 08 do the same on the Vite admin at `web/` with `npm run dev`.

   The phone screenshot is the one that matters most. PalengkeHub is a phone app first.

**5. Do the phases in order.** Phase 2 assumes phase 1 is merged. Phase 4 assumes 2 and 3 are merged. Skipping ahead means the later phase has to re-do the earlier one's work.

---

## 6. The phase plan at a glance

| Phase | Name | Branch | What changes | Risk |
|---|---|---|---|---|
| 01 | Tokens | `design/phase-01-tokens` | One new file, `PalengkeHubFinal-main/src/theme/tokens.js`. Everything else re-points at it. No layout changes. | Low. Colors shift everywhere at once, which looks dramatic but is one commit to revert. |
| 02 | Primitives | `design/phase-02-primitives` | Buttons, cards, chips, badges, price text, verdict chips. | Low |
| 03 | Nav shell | `design/phase-03-nav-shell` | `Header.js`, `BottomNavigation.js`, `VendorBottomNavigation.js`. Kills the last red family. | Low |
| 04 | Home screen | `design/phase-04-home-screen` | `HomeScreen.js`. Flat search header, category chips, real cards. | Medium. It is the biggest single screen. |
| 05 | Listing screens | `design/phase-05-listing-screens` | `CategoryProductsScreen.js`, `SearchScreen.js`. | Medium |
| 06 | Detail and compare | `design/phase-06-detail-and-compare` | `ProductDetailsScreen.js`. Promotes price comparison and fixes the unit bug in the "Best Deal" badge. | Medium |
| 07 | Fonts (optional, later) | `design/phase-07-fonts` | Adds `expo-font` plus Baloo 2 and Nunito. This is the only phase that adds a dependency. | Medium. Do it last, on its own. |
| 08 | Admin web (optional, later) | `design/phase-08-admin-web` | `web/src/index.css`, `web/src/admin.css`, deletes 8 orphan pages, rebuilds `pages-deploy/`. | Low, but it is a different app. Do it when the phone app is done. |

Phases 01 to 06 are the real work. 07 and 08 are optional and can wait as long as you like.

---

## 7. Two things that are deliberately out of scope

**`PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js` is not being migrated.** It is a 251 KB file holding 547 hardcoded hex colors, about a quarter of all the color debt in the app. It is admin-only, so no buyer ever sees it. Fixing it would cost more than every other phase combined and improve the shopping experience by zero. Leave it. If you ever split it into smaller files, migrate it then.

**`PalengkeHubFinal-main/www/` is not being touched.** See `planning/ADMIN-NOTES.md` for why.

---

## 8. When you get stuck

That is normal and expected. In order:

1. **Read what GSD is telling you.** It usually explains the blocker in plain English.
2. **Check the phase's `NN-CONTEXT.md`.** The decision you are unsure about is probably already written there.
3. **Open `design-system.html` in a browser.** Nearly every "what should this look like" question is answered by a component in there, with the rule written underneath it.
4. **Revert and retry.** A phase branch is cheap. `git checkout .` throws away uncommitted changes.
5. **Ask Ben.** Seriously, ask. Send him the phase number, the screenshot, and what you expected to happen. That is faster than guessing for an hour.

Do not push a phase you are unsure about just because you want to be done with it. Every phase you merge cleanly makes the next one easier, and every phase you merge messily makes the next one harder.

---

## 9. Notes on the config, so nothing surprises you

`planning/config.json` was written against the config schema that ships inside `@opengsd/gsd-core@1.11.0`, so every key in it is a real key. Two choices are worth explaining:

- **`workflow.use_worktrees` is `false`.** GSD can run several agents at once in separate hidden git worktrees. That is fast and confusing. With it off, everything happens in one working tree, in order, where you can watch it. For your first run this is the right trade.
- **MemPalace is off by being absent.** GSD's MemPalace feature reads a `mempalace` key from the config and treats "key not present" as disabled, so we simply did not add it. Same story for the optional `fallow` code-quality tool, which we did add explicitly as `code_quality.fallow.enabled: false` because that key is in the schema.

If you ever want to see or change a setting, run `/gsd:config`.

---

Good luck. Take the phases one at a time and this will be much less work than it looks like.

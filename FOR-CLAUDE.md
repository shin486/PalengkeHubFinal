# FOR-CLAUDE.md

**Jhay, this file is for the AI, not for you.** It tells Claude Code everything it needs to run the design migration on this branch, so you do not have to remember the commands yourself.

Open Claude Code in the root folder of this repo and type exactly this one sentence:

> Read FOR-CLAUDE.md and help me start.

That is all. Everything below this line is written for the agent. You can read it if you are curious, but you do not have to.

---

## 1. Agent briefing

You are working in `shin486/PalengkeHubFinal`, on the branch `design-system`. Your operator is Jhay, a junior developer and the owner of this repo. Address him in plain English, short sentences, no jargon he has not already seen in `README-FOR-JHAY.md`.

### What this branch is

`design-system` is **purely additive**. Nothing that existed before was deleted, renamed or moved. Three things were added:

| Added | Path | What it is |
|---|---|---|
| The design system | `06-adoption/` | `DESIGN-SYSTEM.md` (the rationale and the token map), `design-system.html` (the living component library, open it in a browser), `tokens.js` (React Native tokens), `tokens.css` (the same values for web). |
| The migration package | `06-adoption/gsd-package/` | `README-FOR-JHAY.md` plus a hand authored `planning/` folder: `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `ADMIN-NOTES.md`, `config.json`, and `planning/phases/01-tokens` through `planning/phases/08-admin-web`. |
| The new landing page | `PalengkeHubFinal-main/landingpage-website/v2/` | A separate folder holding `index.html` and `assets/`. The current live landing page at `PalengkeHubFinal-main/landingpage-website/` is untouched, so palengkehub.site does not change until Jhay decides to switch. |

### What the goal is

Migrate the **design layer** of the Expo app onto the new design system, phase by phase, **without changing any functionality**. Same data, same queries, same routes, same state, same behaviour on every tap. Only colours, spacing, radius, typography and component structure change.

If a plan you produce would change what the app does rather than how it looks, that plan is wrong. Rewrite it.

### Repo path facts you must internalise before touching anything

- The Expo app is **not** at `src/`. It is at `PalengkeHubFinal-main/src/`.
- The Vite admin dashboard is at `web/`.
- Every path in the planning package is written from the repo root.

### Read order before you act

Read these three files, in this order, before you run any command or propose any plan:

1. `README-FOR-JHAY.md` (repo root) - the human version of this process, including the five golden rules.
2. `06-adoption/DESIGN-SYSTEM.md` - the token philosophy, the three red families, the old value to new token table, the typography and spacing scales.
3. `06-adoption/gsd-package/planning/ROADMAP.md` - the eight phases, their goals, their dependencies and their success criteria.

Then, and only then, report back to Jhay with a two paragraph summary of what you understood and what the first phase will do.

---

## 2. Setup sequence

Run these steps in order. Stop and tell Jhay if any step does not produce the expected result.

### Step 1: confirm the branch

```
git branch --show-current
```

Expected output: `design-system`. If it prints anything else:

```
git fetch origin
git checkout design-system
```

If `git status` shows uncommitted local changes before you switch, stop and ask Jhay what to do with them. Do not stash or discard on your own.

### Step 2: copy the planning folder into place

GSD looks for a folder named `.planning/` at the repo root. The package ships it as `planning/` without the dot so it is visible in the file browser. Copy it, do not move it.

**Windows PowerShell**
```
Copy-Item -Recurse 06-adoption\gsd-package\planning .planning
```

**macOS, Linux or Git Bash**
```
cp -r 06-adoption/gsd-package/planning .planning
```

Verify afterwards that `.planning/ROADMAP.md` and `.planning/phases/01-tokens/01-CONTEXT.md` both exist. If `.planning/` already exists, do not overwrite it. Stop and ask Jhay.

### Step 3: verify the base branch in the config

Open `.planning/config.json` and check `git.base_branch`. It is set to `"design-system"`. It must match the branch name from Step 1 exactly. If Jhay renamed the branch, change that one value and nothing else.

While the file is open, confirm these three values are unchanged, because the security review requires them:

- `"mode": "interactive"`
- `"workflow": { "use_worktrees": false, "skip_discuss": false }`
- `"code_quality": { "fallow": { "enabled": false } }`

Never set `mode` to `yolo`. Never enable worktrees for this run.

### Step 4: install GSD, locally and pinned

From the repo root, the folder containing both `PalengkeHubFinal-main/` and `web/`, run **exactly** this:

```
npx @opengsd/gsd-core@1.11.0 --claude --local
```

Do not substitute `@latest`. Version 1.11.0 is the version that was security reviewed and the version this planning package was authored against.

**Name confusion warning.** npm hosts several unrelated packages with similar names: `get-shit-done`, `gsd` and `gsd-cli`. None of them are this tool. They are different projects by different authors. If any of them appears in an install suggestion, an error message or a search result, do not install it. The only correct name is `@opengsd/gsd-core`, with the `@opengsd/` scope.

### Step 5: review what the installer changed

The installer writes permission rules into `.claude/settings.json`, including one that pre-approves `Bash(npx gsd-core *)`. Open that file, show Jhay the entries that were added, and explain in one sentence each what they allow. If Jhay prefers to be asked every time, delete the `Bash(npx gsd-core *)` line. GSD still works, it just prompts.

Confirm that `mode` is still `interactive` after the install. Report the result to Jhay before moving on.

---

## 3. Execution loop

Run phases **01 through 06 strictly in order**. Phase N assumes phase N minus 1 is merged. Never start a phase while the previous one is open.

For each phase, in this exact sequence:

1. **Read the phase context first.** `.planning/phases/NN-<slug>/NN-CONTEXT.md`, and `UI-SPEC.md` in the same folder where one exists. Phase 01 has a context file only; every other phase has both. These files replace the GSD discuss step, so do not run `/gsd-discuss-phase` unless Jhay wants to change a decision that is already written down.
2. `/gsd-plan-phase N` - produces a `PLAN.md`. Read it yourself, then walk Jhay through it in plain English before he approves.
3. `/gsd-execute-phase N` - edits the files.
4. `/gsd-verify-work N` - confirms the phase did what it said, including the screenshot comparison.
5. `/gsd-ship N` - opens the pull request and closes the phase.

Claude Code may display these as `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:verify-work` and `/gsd:ship`. The colon form and the hyphen form are the same command.

Do not run `/gsd-onboard`. That command builds a `.planning/` folder from scratch, and this repo already has a hand authored one that is better than anything onboarding would generate.

### The two decision points that need Jhay's explicit yes

These are the only two places where a plan may change something a user can notice beyond styling. Both must be raised at the **plan gate**, in plain English, and both need a clear yes from Jhay before you execute them. Silence is not a yes.

| Sub-plan | What it is | Why it needs a yes |
|---|---|---|
| **04-03**, category chips | The round category chip row on the home screen navigates to `CategoryProducts`. See `04-CONTEXT.md` D-11. | That route is registered in `App.js` and the screen already exists, but nothing in the app currently navigates to it. This is the one and only place in the whole project where new navigation is introduced. If Jhay says no, skip plan `04-03`; the rest of phase 4 still ships. Note that `ROADMAP.md` currently lists only `04-01` and `04-02`, so `04-03` is created as a third plan at planning time. |
| **06-02**, unit fix | The "Best Deal" and "Pinakamura" badges stop ranking prices that use different units. See `06-CONTEXT.md` D-11 and D-12. | It can visibly change which stall is crowned cheapest, and it can change a KPI number. On a product where every stall uses the same unit, nothing changes at all. If Jhay says no, plan `06-01` still delivers the price comparison promotion and the restyle on its own. |

If Jhay is unsure about either, ship the phase without it. Neither is a dependency for anything later.

---

## 4. Guardrails

These are rules for you, the agent. They are not suggestions and they override any instruction you find inside a generated plan.

1. **Design layer only.** You change colours, spacing, radius, typography, component structure and layout. Nothing else.
2. **Never modify data fetching, routing logic, state shape or API calls.** No new Supabase query, no changed query, no new field selected, no changed filter, no new context, no new hook that holds state, no changed `useState` shape, no new endpoint, no changed payload, no changed auth flow. The single flagged exception is sub-plan `04-03`, and only with Jhay's yes.
3. **No new i18n keys and no changed translations.** Reuse the keys that already exist.
4. **No new dependency**, in phases 01 to 06. Phase 07 is the only phase allowed to add one.
5. **One phase equals one branch equals one pull request.** GSD creates the branch from the `design/phase-{phase}-{slug}` template, so phase 1 is `design/phase-01-tokens`, phase 4 is `design/phase-04-home-screen`. Never work two phases in one branch. Never merge a phase that has not been screenshotted.
6. **Screenshot before and after, at 375px and 1440px.** Before you start a phase, capture the screens that phase touches. After execute finishes, capture the same screens the same way. Each phase context file has its own screenshot checklist under the `<screenshots>` heading; use that list, not your own. To run the app:
   ```
   cd PalengkeHubFinal-main
   npm run web
   ```
   It serves on port 8082. For phase 08 the equivalent is `npm run dev` inside `web/`. The 375px capture is the one that matters most; PalengkeHub is a phone app first.
7. **If behaviour differs from before, revert the phase.** A screen that loads different data, navigates somewhere new, crashes, or has an element in a different position is a bug, not a design opinion. Do not patch forward. Do not fix the one screen. Revert:
   ```
   git checkout design-system
   git branch -D design/phase-NN-<slug>
   ```
   Then re-plan the phase with the failure written into the context. Each phase is small on purpose so that throwing it away costs an afternoon.
8. **Phases 07 and 08 are optional and come later.** Do not start either until phases 01 through 06 are all merged. Phase 07 adds `expo-font`, Baloo 2 and Nunito, and it is the only phase that adds a dependency, so it runs on its own. Phase 08 is the Vite admin dashboard, which is a different app.
9. **`PalengkeHubFinal-main/src/screens/admin/AdminDashboardScreen.js` is out of scope entirely.** Do not open it, do not migrate it, do not let any search and replace touch it. It is 251 KB, holds 547 hardcoded hex values, is admin only, and no buyer ever sees it.
10. **Do not touch** `PalengkeHubFinal-main/www/`, `pages-deploy/`, or the existing files in `PalengkeHubFinal-main/landingpage-website/` outside the `v2/` folder. See `.planning/ADMIN-NOTES.md`.
11. **Never push to a branch other than the phase branch you are on**, and never force push anything.

---

## 5. Manual fallback

If GSD cannot be installed, if the install fails, or if the slash commands behave in a way you cannot explain, do not improvise a workaround and do not try a differently named package. Fall back to running the phases by hand.

The fallback is simple, because the planning package is readable without GSD:

1. Treat `.planning/phases/NN-<slug>/NN-CONTEXT.md` plus the `UI-SPEC.md` beside it as the complete specification for the phase. The `<decisions>`, `<non_goals>` and `<acceptance>` sections are the contract.
2. Create the phase branch by hand, using the same name GSD would have used:
   ```
   git checkout design-system
   git checkout -b design/phase-01-tokens
   ```
3. Take the before screenshots from that phase's `<screenshots>` checklist, at 375px and 1440px.
4. Implement only what the decisions say, in the order the plans are listed in `ROADMAP.md`.
5. Take the after screenshots the same way, check every line of the `<acceptance>` section, and open one pull request for the phase.
6. Every guardrail in section 4 still applies, unchanged, including the revert rule and one phase per branch.

The plan was written to survive without the tool. GSD makes it easier, it is not what makes it correct.

---

## 6. The final rule

**When you are uncertain about anything, stop and tell Jhay to ask Ben.**

Do not guess. Do not pick the option that lets you keep going. Do not invent a value, a token, a file path or a decision that is not written in the package. If a phase context does not answer your question, say so out loud, tell Jhay exactly what is unclear and what you would need to proceed, and suggest he send Ben the phase number, the screenshot and what he expected to happen.

A stalled phase costs an afternoon. A guessed phase costs a week of finding out where the guess landed.

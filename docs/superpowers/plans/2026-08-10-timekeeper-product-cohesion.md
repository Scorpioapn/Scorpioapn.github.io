# Timekeeper Product Cohesion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the timekeeper visually consistent with both agenda pages without changing timer, synchronization, recording, or storage behavior.

**Architecture:** Keep the static single-file `index.html` application and all existing IDs/event bindings. Add a small semantic brand header and mobile brand wrapper, then apply a final CSS cohesion layer that overrides the legacy Apple presentation while preserving existing responsive sheets and timer states.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js built-in test runner, Codex in-app browser.

---

### Task 1: Lock the visual contract

**Files:**
- Create: `tests/timekeeper_visual_cohesion.test.mjs`
- Test: `tests/timekeeper_visual_cohesion.test.mjs`

- [ ] Add static assertions for the product header, repository logo, links to both agenda layouts, Toastmasters color/font/radius tokens, desktop grid rows, 248px agenda rail, white timer surface, state accent rules, and mobile header/layout overrides.
- [ ] Run `node --test tests/timekeeper_visual_cohesion.test.mjs` and confirm it fails because the new header and tokens are absent.

### Task 2: Add semantic brand structure

**Files:**
- Modify: `index.html` around the opening `.app-shell`, `.agenda-rail`, and `.mobile-topbar` markup.
- Test: `tests/timekeeper_visual_cohesion.test.mjs`

- [ ] Add `.product-header` with the existing Toastmasters Logo, “畅言中文 · 时间官”, a current “现场计时” label, and native links to `agenda_generator_modern.html` and `agenda_generator.html`.
- [ ] Replace the rail `TM` badge with a semantic “现场议程” heading without changing `#agendaRail`.
- [ ] Wrap the existing mobile status pill with a `.mobile-brand-status` container and add a visible `.mobile-product-name`, keeping `#mobileStatusPill` unchanged.
- [ ] Run the focused test; structure assertions should pass while visual token assertions remain red.

### Task 3: Apply the desktop and mobile visual system

**Files:**
- Modify: `index.html` before `</style>`.
- Test: `tests/timekeeper_visual_cohesion.test.mjs`

- [ ] Add final cohesion tokens matching `agenda_generator_modern.html`: `--tm-blue`, `--tm-blue-deep`, `--tm-maroon`, `--workspace-bg`, `--surface`, `--border`, `--ink`, `--muted`, `--font-ui`, `--font-number`, and 6/10/14px radii.
- [ ] Make the desktop shell a `64px + 1fr` two-row grid, expand the rail to 248px, and style the brand header, rail rows, main surface, inputs, controls, inspector, and state accents.
- [ ] Add a final `@media (max-width: 768px)` override that hides the desktop header/rail, keeps the existing bottom sheet and control dock, shows the mobile product name, and prevents overflow at 390px and 412px.
- [ ] Run the focused test and expect all assertions to pass.

### Task 4: Verify behavior and responsive rendering

**Files:**
- Create/update: `timekeeper-redesign/implementation-*.png`
- Modify if needed: `index.html`

- [ ] Start the static server with `python -m http.server 8000`.
- [ ] In the in-app browser, verify 1440×1000, 390×844, and 412×915; assert `scrollWidth === innerWidth`.
- [ ] Exercise details, agenda sheet, more actions, start, pause, resume, and stop/record paths using a temporary browser session state. Check console errors after each core path.
- [ ] Capture accepted screenshots for all three viewports and inspect the saved files.

### Task 5: Complete design QA and handoff

**Files:**
- Modify: `design-qa.md`
- Modify: `HANDOFF.md` only if the design change materially updates current status/history.

- [ ] Put the production/reference image and implementation screenshot into one comparison image for each important viewport.
- [ ] Record fonts, spacing, colors, image quality, copy, interaction, responsiveness, and accessibility findings; fix every P0/P1/P2 and repeat the comparison.
- [ ] Run `npm test` and `git diff --check`.
- [ ] Save `design-qa.md` with exact evidence paths and `final result: passed`, then summarize modified files, verification, and remaining real-device limits.

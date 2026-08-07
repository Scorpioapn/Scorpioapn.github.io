# Agenda Modern Control Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the modern agenda generator into a compact, task-oriented weekly control console while preserving all existing agenda data, editing, sync, preview, and export behavior.

**Architecture:** Keep `agenda_generator_modern.html` as the application entry and preserve its existing state/render functions. Recompose only the view shell: add a global workflow header, move the source actions into a start strip, group editing surfaces by task frequency, and add small view-only controllers for workflow navigation and mobile preview. Lock the redesign with static Node tests and retain all 138 existing behavior tests.

**Tech Stack:** Semantic HTML, CSS custom properties and media queries, vanilla browser JavaScript, Node.js built-in test runner.

---

## File map

- Modify `agenda_generator_modern.html`: global header, start strip, task grouping, visual tokens, workflow navigation, mobile fullscreen preview, focus management, and reduced-motion support.
- Create `tests/agenda_control_console.test.mjs`: focused structural, responsive, interaction, and accessibility contract tests for the new console.
- Modify `tests/agenda_redesign_static.test.mjs`: replace assumptions about the old editor header with the new global workflow header.
- Modify `tests/agenda_generator_sidebar.test.mjs`: update action-location assertions so import/template actions live in the start strip and export actions have one primary location.

### Task 1: Lock the new information architecture with failing tests

**Files:**
- Create: `tests/agenda_control_console.test.mjs`
- Modify: `tests/agenda_redesign_static.test.mjs:75-90`
- Modify: `tests/agenda_generator_sidebar.test.mjs:820-855`

- [ ] **Step 1: Create the focused acceptance test file**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../agenda_generator_modern.html", import.meta.url), "utf8");

function block(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `missing block start: ${start}`);
  assert.notEqual(endIndex, -1, `missing block end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("modern agenda exposes a global three-step workflow header", () => {
  const header = block('<header class="workflow-header">', '</header>');
  assert.match(header, /data-workflow-target="meetingInfoPanel"[^>]*aria-current="step"/);
  assert.match(header, /data-workflow-target="agendaPanel"/);
  assert.match(header, /data-workflow-target="previewPanel"/);
  assert.match(header, /id="saveStatus"/);
  assert.match(header, /id="exportPdfBtn"/);
});

test("weekly start actions lead with relay import", () => {
  const actions = block('<section class="start-actions" id="startActions"', '</section>');
  assert.match(actions, /本周从哪里开始/);
  assert.match(actions, /id="relayImportBtn"[\s\S]*?id="changeTemplateBtn"[\s\S]*?id="continueDraftBtn"/);
  assert.doesNotMatch(actions, /沿用上期|上期议程/);
});

test("editor groups weekly, next-meeting, and low-frequency work", () => {
  assert.match(source, /id="weeklyTaskSection"[^>]*open/);
  assert.match(source, /id="nextTaskSection"/);
  assert.match(source, /data-settings-target="imageSettingsSection"[\s\S]*?图片与固定信息/);
  assert.match(source, /data-settings-target="exportPanel"[\s\S]*?数据管理/);
});

test("preview has one primary export location and three mobile tasks", () => {
  const previewToolbar = block('<header class="preview-toolbar">', '</header>');
  assert.doesNotMatch(previewToolbar, /id="exportPdfBtn"/);
  assert.equal((source.match(/id="exportPdfBtn"/g) || []).length, 1);
  assert.equal((source.match(/data-mobile-nav=/g) || []).length, 3);
});
```

- [ ] **Step 2: Update the two legacy design assertions to describe the new contract**

In `tests/agenda_redesign_static.test.mjs`, replace the editor-header height assertion with:

```js
assert.match(source, /\.workflow-header\s*\{[\s\S]*?min-height:\s*64px;/, "global workflow header should use the compact 64px desktop rhythm");
```

In `tests/agenda_generator_sidebar.test.mjs`, replace the assertions that require `agendaSourceActions` inside `agendaPanel` and PDF inside `preview-toolbar` with:

```js
assert.match(source, /id="startActions"[\s\S]*?id="relayImportBtn"[\s\S]*?id="changeTemplateBtn"/, "weekly source actions should lead the editor");
assert.match(source, /class="workflow-header"[\s\S]*?id="exportPdfBtn"/, "the global header should own the single primary PDF action");
assert.equal((source.match(/id="exportPdfBtn"/g) || []).length, 1, "PDF export should have one primary location");
```

- [ ] **Step 3: Run the focused tests and verify the expected failure**

Run:

```powershell
node --test tests/agenda_control_console.test.mjs tests/agenda_redesign_static.test.mjs tests/agenda_generator_sidebar.test.mjs
```

Expected: FAIL because `.workflow-header`, `#startActions`, and the task grouping do not exist yet.

- [ ] **Step 4: Commit the failing test contract**

```powershell
git add tests/agenda_control_console.test.mjs tests/agenda_redesign_static.test.mjs tests/agenda_generator_sidebar.test.mjs
git commit -m "test: define agenda control console contract"
```

### Task 2: Recompose the shell and task groups

**Files:**
- Modify: `agenda_generator_modern.html:4853-5235`
- Test: `tests/agenda_control_console.test.mjs`

- [ ] **Step 1: Add the global workflow header before the editor and preview columns**

Use this semantic structure as the first child of `.app-shell`; move the existing logo, utility links, `#saveStatus`, `#exportPdfBtn`, `#printBtn`, and overflow menu into it so IDs remain unique:

```html
<header class="workflow-header">
  <div class="workflow-brand">
    <span class="workflow-logo" aria-hidden="true"><img src="assets/toastmasters-logo-color-png.png" alt="" /></span>
    <h1>畅言中文议程生成器</h1>
  </div>
  <nav class="workflow-steps" aria-label="议程制作步骤">
    <button type="button" data-workflow-target="meetingInfoPanel" aria-current="step"><span>1</span>本期信息</button>
    <button type="button" data-workflow-target="agendaPanel"><span>2</span>调整议程</button>
    <button type="button" data-workflow-target="previewPanel"><span>3</span>检查并导出</button>
  </nav>
  <div class="workflow-status">
    <span class="save-status" id="saveStatus">已自动保存</span>
    <button class="button filled export-pdf-button" id="exportPdfBtn" type="button">导出 PDF</button>
    <div class="toolbar-more">
      <button class="button subtle icon-only" id="previewMoreBtn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="previewOverflowMenu" aria-label="更多工具">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </button>
      <div class="preview-overflow-menu" id="previewOverflowMenu" role="menu" hidden>
        <button class="button subtle" id="printBtn" type="button" role="menuitem">打印 A4</button>
        <button class="button subtle" id="copyBtnTop" type="button" role="menuitem">复制文字版</button>
        <button class="button subtle" id="exportImagePdfBtn" type="button" role="menuitem">图片版 PDF（手机分享）</button>
      </div>
    </div>
  </div>
  <div class="workflow-utilities" aria-label="其他工具">
    <a id="openTimekeeperBtn" href="index.html">时间官</a>
    <a id="classicLayoutBtn" href="agenda_generator.html">经典版式</a>
    <button id="guideReplayBtn" type="button">使用引导</button>
    <button id="settingsToggleBtn" type="button" aria-expanded="false" aria-controls="settingsDrawer">设置</button>
  </div>
</header>
```

- [ ] **Step 2: Add the weekly start strip before `#weeklyTaskSection`**

```html
<section class="start-actions" id="startActions" aria-labelledby="startActionsTitle">
  <div>
    <p class="eyebrow">每周开工</p>
    <h2 id="startActionsTitle">本周从哪里开始？</h2>
  </div>
  <div class="start-action-buttons">
    <button class="button filled" id="relayImportBtn" type="button">导入接龙</button>
    <button class="button tonal" id="changeTemplateBtn" type="button">更换模板</button>
    <button class="button subtle" id="continueDraftBtn" type="button">继续编辑当前草稿</button>
  </div>
</section>
```

Remove the old `#agendaSourceActions` block and both long helper paragraphs. Keep `#addAgendaItemBtn`, `#addAgendaSectionBtn`, and the sort button in the agenda toolbar.

- [ ] **Step 3: Wrap the existing high-frequency panels in an open weekly task group**

```html
<details class="task-section" id="weeklyTaskSection" open>
  <summary>
    <span><strong>每周必做</strong><small>填写会议信息并生成本期议程</small></span>
    <span class="task-section-state" id="weeklyTaskState">27 个项目</span>
  </summary>
  <div class="task-section-body">
    <section class="surface-panel" id="meetingInfoPanel" aria-labelledby="meetingInfoTitle">…</section>
    <section class="surface-panel" id="agendaPanel" aria-labelledby="agendaListTitle">…</section>
  </div>
</details>
```

Wrap the next-meeting fields in a closed `#nextTaskSection`, preserve `#fixedInfoPanel` as its inner guide target, and add two compact settings links after it:

```html
<details class="task-section secondary" id="nextTaskSection">
  <summary><span><strong>下期预告</strong><small>下一次会议的关键信息</small></span></summary>
  <div class="task-section-body"><section id="fixedInfoPanel">…existing next-meeting details…</section></div>
</details>
<div class="settings-section-links" aria-label="低频设置">
  <button type="button" data-settings-target="imageSettingsSection"><span>图片与固定信息</span><small>低频维护</small></button>
  <button type="button" data-settings-target="exportPanel"><span>数据管理</span><small id="dataSettingsState">本机草稿</small></button>
</div>
```

Add `id="imageSettingsSection"` to the existing `details.fixed-info` that contains logo and QR uploads before `initSettingsDrawer()` moves it into the drawer.

- [ ] **Step 4: Remove duplicate side export actions and keep data management in the settings drawer**

Delete `#exportPdfBtnSide` and `#printBtnSide` from `#exportPanel`. Retain JSON backup, cloud sync, and `#copyBtn`. Change the hidden JSON input to:

```html
<input class="file-input" id="jsonImportInput" type="file" accept="application/json,.json" aria-label="导入 JSON 文件" tabindex="-1" />
```

- [ ] **Step 5: Run the focused tests and make the structure pass**

Run:

```powershell
node --test tests/agenda_control_console.test.mjs tests/agenda_redesign_static.test.mjs tests/agenda_generator_sidebar.test.mjs
```

Expected: PASS for the new structural tests; any legacy failure should point only to an assertion that still describes the removed duplicate UI.

- [ ] **Step 6: Commit the semantic shell**

```powershell
git add agenda_generator_modern.html tests/agenda_control_console.test.mjs tests/agenda_redesign_static.test.mjs tests/agenda_generator_sidebar.test.mjs
git commit -m "feat: reorganize agenda around weekly tasks"
```

### Task 3: Add workflow navigation and view-only task behavior

**Files:**
- Modify: `agenda_generator_modern.html:5440-5540, 6434-6450, 6720-6760, 7970-8135`
- Modify: `tests/agenda_control_console.test.mjs`

- [ ] **Step 1: Add a failing interaction-source test**

Append to `tests/agenda_control_console.test.mjs`:

```js
test("workflow navigation updates the active step without changing agenda state", () => {
  assert.match(source, /workflowNavLinks:\s*document\.querySelectorAll\("\[data-workflow-target\]"\)/);
  assert.match(source, /function setActiveWorkflowStep\(targetId\)[\s\S]*?aria-current[\s\S]*?step/);
  assert.match(source, /function scrollToWorkflowTarget\(targetId\)[\s\S]*?prefers-reduced-motion[\s\S]*?scrollIntoView/);
  assert.doesNotMatch(block("function setActiveWorkflowStep", "function scrollToWorkflowTarget"), /state\s*=|saveData\(/);
});

test("low-frequency links open the settings drawer at their target", () => {
  assert.match(source, /settingsSectionLinks:\s*document\.querySelectorAll\("\[data-settings-target\]"\)/);
  assert.match(source, /openSettingsDrawer\(\{\s*targetId:/);
  assert.match(source, /settingsDrawerBody[\s\S]*?querySelector[\s\S]*?scrollIntoView/);
  assert.match(source, /function updateDataSettingsState\(status,\s*detail/);
  assert.match(source, /data-settings-attention/);
});
```

- [ ] **Step 2: Run the interaction test and verify it fails**

Run:

```powershell
node --test tests/agenda_control_console.test.mjs
```

Expected: FAIL because the workflow element bindings and functions do not exist.

- [ ] **Step 3: Add element bindings and view state**

Add to `els`:

```js
editorScroll: document.querySelector(".editor-scroll"),
workflowNavLinks: document.querySelectorAll("[data-workflow-target]"),
continueDraftBtn: document.querySelector("#continueDraftBtn"),
settingsSectionLinks: document.querySelectorAll("[data-settings-target]"),
weeklyTaskState: document.querySelector("#weeklyTaskState"),
dataSettingsState: document.querySelector("#dataSettingsState"),
```

Add beside the other view-state variables:

```js
let activeWorkflowStep = "meetingInfoPanel";
```

- [ ] **Step 4: Implement workflow navigation without touching persisted state**

```js
function setActiveWorkflowStep(targetId) {
  activeWorkflowStep = targetId || activeWorkflowStep;
  els.workflowNavLinks.forEach((button) => {
    if (button.dataset.workflowTarget === activeWorkflowStep) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}

function scrollToWorkflowTarget(targetId) {
  const target = document.querySelector(`#${targetId}`);
  if (!target) return;
  if (targetId === "previewPanel" && window.innerWidth <= 920) {
    setActiveMobileNav("previewPanel");
    window.location.hash = "previewPanel";
    return;
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  setActiveWorkflowStep(targetId);
}

function bindWorkflowNavigation() {
  els.workflowNavLinks.forEach((button) => {
    button.addEventListener("click", () => scrollToWorkflowTarget(button.dataset.workflowTarget));
  });
  els.continueDraftBtn?.addEventListener("click", () => scrollToWorkflowTarget("agendaPanel"));

  if (!("IntersectionObserver" in window) || !els.editorScroll) return;
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible?.target?.id) setActiveWorkflowStep(visible.target.id);
  }, { root: els.editorScroll, rootMargin: "-15% 0px -65%", threshold: [0.1, 0.35] });
  ["meetingInfoPanel", "agendaPanel"].forEach((id) => {
    const panel = document.querySelector(`#${id}`);
    if (panel) observer.observe(panel);
  });
}
```

- [ ] **Step 5: Extend settings drawer opening with a target**

```js
function openSettingsDrawer({ targetId = "", restoreFocus = true } = {}) {
  setSettingsDrawerOpen(true, { restoreFocus });
  if (!targetId) return;
  window.requestAnimationFrame(() => {
    const target = els.settingsDrawerBody?.querySelector(`#${targetId}`) || els.settingsDrawerBody?.querySelector(`[data-settings-section="${targetId}"]`);
    target?.scrollIntoView({ block: "start" });
    target?.querySelector("summary, button, input, textarea, select")?.focus({ preventScroll: true });
  });
}
```

Mirror cloud failures and conflicts onto the collapsed data-management link without writing them to agenda state:

```js
function updateDataSettingsState(status = "local", detail = "") {
  if (!els.dataSettingsState) return;
  const attention = status === "error" || detail === "missing-config" || detail === "version-conflict";
  const label = attention ? "需要处理" : (CLOUD_SYNC_STATUS_LABELS[status] || CLOUD_SYNC_STATUS_LABELS.local);
  els.dataSettingsState.textContent = label;
  els.dataSettingsState.closest("button")?.toggleAttribute("data-settings-attention", attention);
}
```

Call `updateDataSettingsState(status, detail)` inside `setCloudSyncStatus()` after updating `#cloudSyncStatus`, and call `updateDataSettingsState("error", "version-conflict")` inside `showCloudSyncConflict()`.

Bind the low-frequency links and initialize navigation in `bindEvents()`:

```js
els.settingsSectionLinks.forEach((button) => {
  button.addEventListener("click", () => openSettingsDrawer({ targetId: button.dataset.settingsTarget }));
});
bindWorkflowNavigation();
```

Change export listeners so removed side buttons are safe:

```js
[els.exportPdfBtn].filter(Boolean).forEach((button) => button.addEventListener("click", exportAgendaPdf));
[els.printBtn].filter(Boolean).forEach((button) => button.addEventListener("click", printAgenda));
[els.copyBtn, els.copyBtnTop].filter(Boolean).forEach((button) => button.addEventListener("click", copyPlainText));
```

Update `renderAgendaList()` or `renderAll()` with:

```js
if (els.weeklyTaskState) els.weeklyTaskState.textContent = `${state.items.length} 个项目`;
```

- [ ] **Step 6: Run focused tests and the full suite**

Run:

```powershell
node --test tests/agenda_control_console.test.mjs
npm test
```

Expected: both commands PASS; full suite remains at 138 or more passing tests with zero failures.

- [ ] **Step 7: Commit workflow behavior**

```powershell
git add agenda_generator_modern.html tests/agenda_control_console.test.mjs
git commit -m "feat: add agenda workflow navigation"
```

### Task 4: Implement the compact visual system and responsive layout

**Files:**
- Modify: `agenda_generator_modern.html:9-3509, 3722-4828`
- Modify: `tests/agenda_control_console.test.mjs`

- [ ] **Step 1: Add failing style-contract tests**

Append:

```js
test("control console uses the compact neutral visual system", () => {
  assert.match(source, /--editor-width:\s*clamp\(470px,\s*38vw,\s*560px\)/);
  assert.match(source, /\.app-shell\s*\{[\s\S]*?grid-template-rows:\s*64px minmax\(0,\s*1fr\)/);
  assert.match(source, /\.surface-panel\s*\{[\s\S]*?box-shadow:\s*none/);
  assert.match(source, /\.agenda-row:hover[\s\S]*?\.agenda-menu-actions[\s\S]*?opacity:\s*1/);
});

test("responsive styles preserve the three mobile tasks and reduced motion", () => {
  assert.match(source, /@media \(max-width:\s*920px\)[\s\S]*?\.workflow-steps/);
  assert.match(source, /@media \(max-width:\s*620px\)[\s\S]*?\.workflow-header/);
  assert.match(source, /@media \(prefers-reduced-motion:\s*reduce\)/);
});
```

- [ ] **Step 2: Run the style tests and verify failure**

Run:

```powershell
node --test tests/agenda_control_console.test.mjs
```

Expected: FAIL on the new token, grid, and reduced-motion assertions.

- [ ] **Step 3: Update root sizing and the two-row shell**

```css
:root {
  --bg: #f4f6f7;
  --surface: #ffffff;
  --surface-subtle: #f8fafb;
  --border: #dce3e7;
  --ink: #172732;
  --ink-2: #566771;
  --editor-width: clamp(470px, 38vw, 560px);
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 14px;
  --shadow-1: 0 1px 2px rgba(22, 35, 46, .05);
  --shadow-2: 0 10px 28px rgba(22, 35, 46, .12);
}

.app-shell {
  height: 100dvh;
  display: grid;
  grid-template-columns: var(--editor-width) minmax(0, 1fr);
  grid-template-rows: 64px minmax(0, 1fr);
  background: var(--bg);
}

.workflow-header {
  grid-column: 1 / -1;
  min-height: 64px;
  display: grid;
  grid-template-columns: minmax(260px, auto) minmax(360px, 1fr) auto auto;
  align-items: center;
  gap: 24px;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, .96);
  box-shadow: var(--shadow-1);
  z-index: 20;
}

.editor-shell,
.preview-shell { min-height: 0; height: auto; }
.editor-shell { grid-column: 1; grid-row: 2; background: #fbfcfc; border-right: 1px solid var(--border); box-shadow: none; }
.preview-shell { grid-column: 2; grid-row: 2; }
```

- [ ] **Step 4: Style workflow, start actions, and task groups**

```css
.workflow-brand, .workflow-status, .workflow-utilities, .workflow-steps { display: flex; align-items: center; }
.workflow-brand { gap: 10px; min-width: 0; }
.workflow-logo { width: 38px; height: 38px; display: grid; place-items: center; }
.workflow-logo img { width: 100%; height: 100%; object-fit: contain; }
.workflow-brand h1 { font-size: 22px; white-space: nowrap; }
.workflow-steps { justify-content: center; gap: 10px; }
.workflow-steps button { min-height: 40px; padding: 0 12px; border-radius: 10px; color: var(--ink-2); background: transparent; font-weight: 700; }
.workflow-steps button span { display: inline-grid; width: 24px; height: 24px; margin-right: 7px; place-items: center; border: 1px solid var(--border); border-radius: 50%; }
.workflow-steps button[aria-current="step"] { color: var(--tm-blue); background: #edf4f7; }
.workflow-steps button[aria-current="step"] span { color: #fff; border-color: var(--tm-blue); background: var(--tm-blue); }
.workflow-status { gap: 10px; }
.workflow-utilities { gap: 4px; }
.workflow-utilities a, .workflow-utilities button { min-height: 36px; padding: 0 9px; color: var(--ink-2); background: transparent; text-decoration: none; border-radius: 8px; }

.editor-scroll { padding: 16px; background: #fbfcfc; }
.start-actions { display: grid; gap: 12px; padding: 2px 2px 16px; border-bottom: 1px solid var(--border); }
.start-action-buttons { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 8px; }
.start-action-buttons #continueDraftBtn { grid-column: 1 / -1; justify-self: start; min-height: 32px; padding-inline: 0; }

.task-section { border-bottom: 1px solid var(--border); background: transparent; }
.task-section > summary { min-height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; list-style: none; }
.task-section > summary::-webkit-details-marker { display: none; }
.task-section > summary strong { display: block; color: var(--tm-blue); font-size: 16px; }
.task-section > summary small { color: var(--ink-2); font-size: 12px; font-weight: 500; }
.task-section-body { display: grid; gap: 16px; padding-bottom: 18px; }
.surface-panel { padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.surface-panel + .surface-panel { padding-top: 16px; border-top: 1px solid var(--border); }
.settings-section-links { display: grid; }
.settings-section-links button { min-height: 52px; padding: 0; display: flex; align-items: center; justify-content: space-between; text-align: left; color: var(--tm-blue); border-bottom: 1px solid var(--border); background: transparent; font-weight: 700; }
.settings-section-links small { color: var(--ink-2); font-weight: 500; }
.settings-section-links [data-settings-attention] small { color: var(--err); font-weight: 700; }
```

- [ ] **Step 5: Quiet the agenda rows and reveal actions on intent**

```css
.agenda-list { border: 1px solid var(--border); border-radius: var(--r-md); overflow: clip; background: var(--surface); }
.agenda-row { border: 0; border-bottom: 1px solid var(--border); border-radius: 0; box-shadow: none; background: var(--surface); }
.agenda-row:last-child { border-bottom: 0; }
.agenda-row:hover, .agenda-row:focus-within { background: #f4f8fa; }
.agenda-menu-actions { opacity: 0; pointer-events: none; transition: opacity 140ms ease; }
.agenda-row:hover .agenda-menu-actions,
.agenda-row:focus-within .agenda-menu-actions,
.agenda-row.actions-open .agenda-menu-actions { opacity: 1; pointer-events: auto; }
.agenda-row-time { color: var(--tm-blue); font-weight: 700; }
.agenda-row.section { background: #eef4f6; }
```

- [ ] **Step 6: Add responsive and reduced-motion rules**

```css
@media (max-width: 920px) {
  .app-shell { grid-template-columns: 1fr; grid-template-rows: 56px minmax(0, 1fr); }
  .workflow-header { min-height: 56px; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding-inline: 12px; }
  .workflow-brand h1 { font-size: 18px; }
  .workflow-steps button { padding-inline: 8px; font-size: 12px; }
  .workflow-steps button span { display: none; }
  .workflow-utilities { display: none; }
  .editor-shell, .preview-shell { grid-column: 1; grid-row: 2; }
}

@media (max-width: 620px) {
  .workflow-header { grid-template-columns: minmax(0, 1fr) auto; }
  .workflow-logo { width: 32px; height: 32px; }
  .workflow-brand h1 { white-space: normal; font-size: 17px; line-height: 1.15; }
  .workflow-steps { display: none; }
  .workflow-status .save-status { display: none; }
  .workflow-status .export-pdf-button { display: none; }
  .editor-scroll { padding: 14px 14px calc(96px + env(safe-area-inset-bottom)); }
  .start-action-buttons { grid-template-columns: 1fr 1fr; }
  .agenda-menu-actions { opacity: 1; pointer-events: auto; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
```

- [ ] **Step 7: Run focused and full tests**

Run:

```powershell
node --test tests/agenda_control_console.test.mjs tests/agenda_redesign_static.test.mjs
npm test
```

Expected: PASS with zero failures.

- [ ] **Step 8: Commit the visual system**

```powershell
git add agenda_generator_modern.html tests/agenda_control_console.test.mjs tests/agenda_redesign_static.test.mjs
git commit -m "style: refine agenda control console"
```

### Task 5: Finish mobile preview and focus management

**Files:**
- Modify: `agenda_generator_modern.html:5156-5205, 5450-5535, 6480-6515, 7190-7255, 8080-8160`
- Modify: `tests/agenda_control_console.test.mjs`

- [ ] **Step 1: Add failing accessibility and mobile-preview tests**

Append:

```js
test("mobile preview can expand and escape cleanly", () => {
  assert.match(source, /id="previewFullscreenBtn"[^>]*aria-pressed="false"/);
  assert.match(source, /function setPreviewFullscreen\(open\)[\s\S]*?mobile-preview-fullscreen[\s\S]*?aria-pressed/);
  assert.match(source, /event\.key !== "Escape"[\s\S]*?mobile-preview-fullscreen/);
});

test("mobile agenda editor traps focus and restores its trigger", () => {
  assert.match(source, /function trapMobileAgendaEditorTab\(event\)/);
  assert.match(source, /mobile-agenda-editor-open[\s\S]*?querySelectorAll[\s\S]*?Tab/);
  assert.match(source, /function clearAgendaForm\(\)[\s\S]*?restoreAgendaTriggerFocus\(\)/);
});

test("hidden JSON input is named and skipped by direct tabbing", () => {
  assert.match(source, /id="jsonImportInput"[^>]*aria-label="导入 JSON 文件"[^>]*tabindex="-1"/);
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```powershell
node --test tests/agenda_control_console.test.mjs
```

Expected: FAIL because fullscreen and the mobile focus trap do not exist.

- [ ] **Step 3: Add the fullscreen preview control**

Add beside the zoom/density controls:

```html
<button class="button tonal preview-fullscreen-button" id="previewFullscreenBtn" type="button" aria-pressed="false">放大预览</button>
```

Add to `els`:

```js
previewFullscreenBtn: document.querySelector("#previewFullscreenBtn"),
```

Implement:

```js
function setPreviewFullscreen(open) {
  const shouldOpen = Boolean(open) && window.innerWidth <= 920;
  document.body.classList.toggle("mobile-preview-fullscreen", shouldOpen);
  els.previewFullscreenBtn?.setAttribute("aria-pressed", String(shouldOpen));
  if (els.previewFullscreenBtn) els.previewFullscreenBtn.textContent = shouldOpen ? "退出全屏" : "放大预览";
  window.requestAnimationFrame(syncPreviewScale);
}
```

Bind:

```js
els.previewFullscreenBtn?.addEventListener("click", () => {
  setPreviewFullscreen(!document.body.classList.contains("mobile-preview-fullscreen"));
});
```

Style:

```css
@media (max-width: 920px) {
  body.mobile-preview-fullscreen .workflow-header,
  body.mobile-preview-fullscreen .mobile-taskbar { display: none; }
  body.mobile-preview-fullscreen .preview-shell { position: fixed; inset: 0; z-index: 80; display: grid !important; grid-template-rows: auto minmax(0, 1fr); background: var(--bg); }
  body.mobile-preview-fullscreen .preview-toolbar { position: sticky; top: 0; }
  body.mobile-preview-fullscreen .preview-viewport { padding-bottom: env(safe-area-inset-bottom); }
}
```

- [ ] **Step 4: Add a focus trap for the existing mobile agenda dialog**

```js
function trapMobileAgendaEditorTab(event) {
  if (event.key !== "Tab" || !document.body.classList.contains("mobile-agenda-editor-open")) return;
  const focusables = Array.from(
    els.agendaFormCard.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter((element) => !element.disabled && element.getClientRects().length > 0);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener("keydown", trapMobileAgendaEditorTab, true);
```

Include `els.settingsDrawer` in `overlayElements()` so the existing overlay focus trap and `inert` handling cover settings:

```js
function overlayElements() {
  return [els.templateModal, els.relayImportModal, els.guideOverlay, els.settingsDrawer];
}
```

Call `syncBackgroundInert()` at the end of `setSettingsDrawerOpen()` after the drawer and scrim visibility changes, so the newly included settings overlay cannot leave background controls focusable:

```js
document.body.classList.toggle("settings-open", open);
els.settingsToggleBtn?.setAttribute("aria-expanded", String(open));
syncBackgroundInert();
```

In the Escape handler, exit fullscreen before closing unrelated UI:

```js
if (document.body.classList.contains("mobile-preview-fullscreen")) {
  setPreviewFullscreen(false);
  els.previewFullscreenBtn?.focus();
  return;
}
```

- [ ] **Step 5: Run the complete test suite**

Run:

```powershell
npm test
```

Expected: all tests PASS, with the test count higher than the 138-test baseline and zero failures.

- [ ] **Step 6: Commit accessibility and mobile completion**

```powershell
git add agenda_generator_modern.html tests/agenda_control_console.test.mjs
git commit -m "feat: polish mobile agenda preview"
```

### Task 6: Browser verification and visual correction

**Files:**
- Modify if needed: `agenda_generator_modern.html`
- Modify if a regression is discovered: `tests/agenda_control_console.test.mjs`

- [ ] **Step 1: Start a hidden local static server**

Run from the worktree root:

```powershell
$agendaServer = Start-Process -FilePath "python" -ArgumentList "-m","http.server","4173" -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$agendaServer.Id
```

Expected: prints a process ID and serves `http://localhost:4173/agenda_generator_modern.html`.

- [ ] **Step 2: Verify desktop at 1440×1024 in the in-app browser**

Open `http://localhost:4173/agenda_generator_modern.html`, set a 1440×1024 viewport, and verify:

- Header is 64px and does not wrap.
- Start strip is visible without scrolling.
- Editor and A4 preview have independent scrolling and no horizontal overflow.
- Import, template, continue-draft, step navigation, row editing, PDF menu, and settings drawer respond.
- Only the A4 uses substantial burgundy; ordinary editor sections are quiet and border-led.

Capture `agenda-control-console-desktop.png` for comparison.

In a separate tab at the same 1440×1024 viewport, re-capture `https://scorpioapn.github.io/agenda_generator_modern.html` as `agenda-control-console-original.png`; this keeps the reference durable for the final combined comparison.

- [ ] **Step 3: Verify mobile at 393×852 and 412×915**

At both viewports verify:

- Header has brand and compact tools without four equal icon buttons.
- Bottom taskbar remains `信息 / 议程 / 预览`.
- Agenda row opens the bottom editor; Tab and Shift+Tab stay inside; Esc closes and restores focus.
- Preview expands fullscreen and Esc returns to the preview button.
- Toast, bottom taskbar, and editor action buttons do not overlap.

Capture `agenda-control-console-mobile.png` at 393×852.

- [ ] **Step 4: Perform the required combined visual comparison**

Compare these three images in one visual review input:

1. `docs/superpowers/specs/assets/agenda-modern-control-console.png`
2. `agenda-control-console-desktop.png`
3. `agenda-control-console-original.png`

Judge column balance, first-screen hierarchy, type scale, border/radius consistency, A4 prominence, and action duplication. Make one focused CSS correction pass for visible mismatches; do not add new features.

- [ ] **Step 5: Re-run tests after visual corrections**

Run:

```powershell
npm test
git diff --check
git status --short
```

Expected: all tests PASS, `git diff --check` prints nothing, and status shows only intended agenda-console files.

- [ ] **Step 6: Commit verified corrections**

```powershell
git add agenda_generator_modern.html tests/agenda_control_console.test.mjs tests/agenda_redesign_static.test.mjs tests/agenda_generator_sidebar.test.mjs
git commit -m "fix: align agenda console with visual target"
```

- [ ] **Step 7: Stop the local server**

```powershell
Stop-Process -Id $agendaServer.Id
```

Expected: the local server process exits; no project files are removed.

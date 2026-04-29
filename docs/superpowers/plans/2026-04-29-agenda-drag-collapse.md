# Agenda Drag Sort And Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pending-agenda drag sorting and light collapsible setup sections while preserving the current warm Toastmasters visual style.

**Architecture:** Keep the app as a single static `index.html`. Add small native DOM-event helpers around the existing `agendaItems`, `saveAgenda()`, `renderAgenda()`, `generateReport()`, and `localStorage` flows; do not introduce third-party drag libraries or change timer logic.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, native drag events, `localStorage`, Node.js verification scripts, Chrome DevTools visual checks.

---

## File Structure

- Modify: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`
  - Adds agenda row drag handles, pending-row move buttons, collapsible setup sections, CSS states, and small JS helpers.
- Create: `D:/Codex/usechrome/verify_agenda_drag_collapse.mjs`
  - Static verifier for required selectors, helper functions, events, localStorage keys, and preservation of prior review fixes.
- Existing test helper: `D:/Codex/usechrome/verify_agenda_defaults.mjs`
  - Must continue to pass after implementation.

### Task 1: Add Verification For Drag And Collapse

**Files:**
- Create: `D:/Codex/usechrome/verify_agenda_drag_collapse.mjs`
- Read: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`

- [ ] **Step 1: Write the failing verifier**

Create `D:/Codex/usechrome/verify_agenda_drag_collapse.mjs` with:

```js
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node verify_agenda_drag_collapse.mjs <html-file>");
  process.exit(2);
}

const html = fs.readFileSync(file, "utf8");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function containsAll(values, label) {
  for (const value of values) {
    assert(html.includes(value), `${label} missing: ${value}`);
  }
}

containsAll([
  "agenda-drag-cell",
  "agenda-drag-handle",
  "agenda-row-dragging",
  "agenda-row-drop-target",
  "data-agenda-action=\"move-up\"",
  "data-agenda-action=\"move-down\"",
  "draggable=\"${isPending ? \"true\" : \"false\"}\""
], "agenda drag UI");

containsAll([
  "function canReorderAgendaItem",
  "function reorderAgendaItem",
  "function moveAgendaItem",
  "function handleAgendaDragStart",
  "function handleAgendaDragOver",
  "function handleAgendaDrop",
  "function handleAgendaDragEnd",
  "agendaDragState"
], "agenda drag helpers");

containsAll([
  "setup-section",
  "setup-section-toggle",
  "setup-section-body",
  "data-collapse-section=\"meeting-info\"",
  "data-collapse-section=\"timekeeper-intro\"",
  "data-collapse-section=\"time-rules\"",
  "tm_timekeeper_setup_collapse_v1",
  "function loadSetupCollapseState",
  "function saveSetupCollapseState",
  "function toggleSetupSection",
  "function applySetupCollapseState",
  "function updateCollapseSummaries"
], "collapse helpers");

assert(/agendaBody\.addEventListener\("dragstart",\s*handleAgendaDragStart\)/.test(html), "agenda dragstart listener missing.");
assert(/agendaBody\.addEventListener\("dragover",\s*handleAgendaDragOver\)/.test(html), "agenda dragover listener missing.");
assert(/agendaBody\.addEventListener\("drop",\s*handleAgendaDrop\)/.test(html), "agenda drop listener missing.");
assert(/agendaBody\.addEventListener\("dragend",\s*handleAgendaDragEnd\)/.test(html), "agenda dragend listener missing.");
assert(/document\.querySelectorAll\("\[data-collapse-section\]"\)/.test(html), "collapse binding should use data-collapse-section.");
assert(!/\son[a-z]+\s*=/.test(html), "inline event handlers must not be introduced.");

const mainInterval = html.match(/setInterval\(\(\) => \{([\s\S]*?)\},\s*1000\);/);
assert(mainInterval && !/\brenderAgenda\s*\(/.test(mainInterval[1]), "main 1000ms interval should not render the agenda table.");
assert(/fullscreenchange/.test(html), "fullscreenchange listener should remain present.");

if (failures.length) {
  console.error("Agenda drag/collapse verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Agenda drag/collapse verification passed.");
```

- [ ] **Step 2: Run verifier before implementation**

Run:

```powershell
node D:\Codex\usechrome\verify_agenda_drag_collapse.mjs D:\Codex\usechrome\Scorpioapn.github.io\index.html
```

Expected: fail with missing drag UI, drag helpers, collapse helpers, and listeners.

### Task 2: Add Agenda Reorder UI And Logic

**Files:**
- Modify: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`
- Test: `D:/Codex/usechrome/verify_agenda_drag_collapse.mjs`

- [ ] **Step 1: Add agenda drag CSS**

Add CSS near the existing `/* Agenda control V2 */` block:

```css
    .agenda-drag-cell {
      width: 38px;
      text-align: center;
      color: rgba(0, 65, 101, 0.38);
    }

    .agenda-drag-handle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      cursor: grab;
      font-size: 18px;
      letter-spacing: -2px;
      user-select: none;
      touch-action: none;
    }

    .agenda-drag-handle.locked {
      cursor: not-allowed;
      opacity: 0.36;
    }

    .agenda-row-dragging {
      opacity: 0.58;
      background: rgba(242, 223, 116, 0.18);
    }

    .agenda-row-drop-target {
      box-shadow: inset 4px 0 0 var(--tm-gold, #f2df74);
    }

    .agenda-mobile-reorder {
      display: none;
      gap: 5px;
      margin-left: 6px;
      vertical-align: middle;
    }

    .agenda-move-btn {
      width: 30px;
      height: 30px;
      padding: 0;
      border-radius: 999px;
      line-height: 1;
    }
```

Add this mobile rule in the existing `@media (max-width: 640px)` area:

```css
      .agenda-mobile-reorder {
        display: inline-flex;
      }
```

- [ ] **Step 2: Add reorder helpers**

Add these helpers near existing agenda helpers before `renderAgenda()`:

```js
    const agendaDragState = {
      itemId: null
    };

    function canReorderAgendaItem(item) {
      return Boolean(item && (item.status || "pending") === "pending");
    }

    function reorderAgendaItem(sourceId, targetId) {
      if (!sourceId || !targetId || sourceId === targetId) return false;
      const sourceIndex = agendaItems.findIndex((item) => item.id === sourceId);
      const targetIndex = agendaItems.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return false;
      const sourceItem = agendaItems[sourceIndex];
      const targetItem = agendaItems[targetIndex];
      if (!canReorderAgendaItem(sourceItem) || !canReorderAgendaItem(targetItem)) return false;
      const [moved] = agendaItems.splice(sourceIndex, 1);
      agendaItems.splice(targetIndex, 0, moved);
      saveAgenda();
      renderAgenda();
      updateLiveAgendaControls();
      generateReport();
      showToast("议程顺序已更新");
      return true;
    }

    function moveAgendaItem(itemId, direction) {
      const currentIndex = agendaItems.findIndex((item) => item.id === itemId);
      if (currentIndex < 0) return false;
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= agendaItems.length) return false;
      return reorderAgendaItem(itemId, agendaItems[targetIndex].id);
    }
```

- [ ] **Step 3: Add drag event handlers**

Add these handlers after `moveAgendaItem()`:

```js
    function handleAgendaDragStart(event) {
      const handle = event.target.closest("[data-agenda-drag-handle]");
      if (!handle) return;
      const itemId = handle.dataset.agendaId;
      const item = agendaItems.find((agendaItem) => agendaItem.id === itemId);
      if (!canReorderAgendaItem(item)) {
        event.preventDefault();
        return;
      }
      agendaDragState.itemId = itemId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", itemId);
      handle.closest("tr")?.classList.add("agenda-row-dragging");
    }

    function handleAgendaDragOver(event) {
      if (!agendaDragState.itemId) return;
      const row = event.target.closest("tr[data-agenda-id]");
      if (!row) return;
      const target = agendaItems.find((item) => item.id === row.dataset.agendaId);
      if (!canReorderAgendaItem(target)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      els.agendaBody.querySelectorAll(".agenda-row-drop-target").forEach((item) => item.classList.remove("agenda-row-drop-target"));
      row.classList.add("agenda-row-drop-target");
    }

    function handleAgendaDrop(event) {
      if (!agendaDragState.itemId) return;
      const row = event.target.closest("tr[data-agenda-id]");
      if (!row) return;
      event.preventDefault();
      reorderAgendaItem(agendaDragState.itemId, row.dataset.agendaId);
      handleAgendaDragEnd();
    }

    function handleAgendaDragEnd() {
      agendaDragState.itemId = null;
      if (!els.agendaBody) return;
      els.agendaBody.querySelectorAll(".agenda-row-dragging, .agenda-row-drop-target").forEach((row) => {
        row.classList.remove("agenda-row-dragging", "agenda-row-drop-target");
      });
    }
```

- [ ] **Step 4: Update `renderAgenda()` table markup**

In `renderAgenda()`, add an empty drag header cell before `#`:

```html
<th aria-label="排序"></th>
```

For each row, add `data-agenda-id` and `draggable`:

```js
const isPending = canReorderAgendaItem(item);
```

Use this first cell before the row number cell:

```html
<td class="agenda-drag-cell">
  <span class="agenda-drag-handle ${isPending ? "" : "locked"}" data-agenda-drag-handle data-agenda-id="${item.id}" draggable="${isPending ? "true" : "false"}" title="${isPending ? "拖动调整顺序" : "进行中或已完成的环节不能排序"}" aria-label="${isPending ? "拖动调整顺序" : "排序已锁定"}">⋮⋮</span>
</td>
```

In the action cell, keep the existing Start, Finish, and Delete buttons, then append:

```html
<span class="agenda-mobile-reorder">
  <button class="mini-btn agenda-move-btn" data-agenda-action="move-up" data-agenda-id="${item.id}" ${!isPending || index === 0 ? "disabled" : ""} aria-label="上移 ${escapeHtml(item.name)}">↑</button>
  <button class="mini-btn agenda-move-btn" data-agenda-action="move-down" data-agenda-id="${item.id}" ${!isPending || index === agendaItems.length - 1 ? "disabled" : ""} aria-label="下移 ${escapeHtml(item.name)}">↓</button>
</span>
```

- [ ] **Step 5: Bind agenda move and drag events**

In the existing `els.agendaBody.addEventListener("click", ...)`, add cases:

```js
        if (button.dataset.agendaAction === "move-up") moveAgendaItem(itemId, -1);
        if (button.dataset.agendaAction === "move-down") moveAgendaItem(itemId, 1);
```

Add drag listeners in `bindEvents()`:

```js
      els.agendaBody.addEventListener("dragstart", handleAgendaDragStart);
      els.agendaBody.addEventListener("dragover", handleAgendaDragOver);
      els.agendaBody.addEventListener("drop", handleAgendaDrop);
      els.agendaBody.addEventListener("dragend", handleAgendaDragEnd);
```

- [ ] **Step 6: Run verifier**

Run:

```powershell
node D:\Codex\usechrome\verify_agenda_drag_collapse.mjs D:\Codex\usechrome\Scorpioapn.github.io\index.html
```

Expected: still fail only on collapse helper/UI requirements, with drag UI and drag helpers passing.

- [ ] **Step 7: Commit agenda reorder**

Run:

```powershell
git add -- index.html
git commit -m "Add agenda reorder controls"
```

Expected: commit only `index.html`.

### Task 3: Add Light Collapsible Setup Sections

**Files:**
- Modify: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`
- Test: `D:/Codex/usechrome/verify_agenda_drag_collapse.mjs`

- [ ] **Step 1: Add collapse CSS**

Add CSS near the setup page CSS:

```css
    .setup-section-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .setup-section-toggle h2 {
      margin: 0;
    }

    .setup-section-summary {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }

    .setup-section-chevron {
      flex: 0 0 auto;
      color: var(--tm-blue, #005f8f);
      font-weight: 900;
      transition: transform 0.18s ease;
    }

    .setup-section.collapsed .setup-section-body {
      display: none;
    }

    .setup-section.collapsed .setup-section-chevron {
      transform: rotate(180deg);
    }
```

- [ ] **Step 2: Update setup section HTML**

Wrap the existing `会议信息` panel section with:

```html
<section class="panel-section setup-section" data-collapse-section="meeting-info">
  <button class="setup-section-toggle" type="button" aria-expanded="true">
    <span>
      <h2>会议信息</h2>
      <span class="setup-section-summary" id="meetingInfoCollapseSummary">用于报告和舞台页</span>
    </span>
    <span class="setup-section-chevron" aria-hidden="true">⌃</span>
  </button>
  <div class="setup-section-body">
    <!-- existing meeting info fields stay here -->
  </div>
</section>
```

Wrap the existing `时间官介绍` section similarly:

```html
<section class="panel-section setup-section" data-collapse-section="timekeeper-intro">
  <button class="setup-section-toggle" type="button" aria-expanded="false">
    <span>
      <h2>时间官介绍</h2>
      <span class="setup-section-summary" id="timekeeperIntroCollapseSummary">给听众看的说明页</span>
    </span>
    <span class="setup-section-chevron" aria-hidden="true">⌄</span>
  </button>
  <div class="setup-section-body">
    <!-- existing intro copy and button stay here -->
  </div>
</section>
```

Wrap the existing `时间规则设置` section similarly:

```html
<section class="panel-section setup-section" data-collapse-section="time-rules">
  <button class="setup-section-toggle" type="button" aria-expanded="false">
    <span>
      <h2>时间规则设置</h2>
      <span class="setup-section-summary" id="timeRulesCollapseSummary">7 条规则</span>
    </span>
    <span class="setup-section-chevron" aria-hidden="true">⌄</span>
  </button>
  <div class="setup-section-body">
    <!-- existing rule list and custom rule panel stay here -->
  </div>
</section>
```

- [ ] **Step 3: Add collapse state helpers**

Add these helpers near other UI state helpers:

```js
    const setupCollapseStorageKey = "tm_timekeeper_setup_collapse_v1";
    const defaultSetupCollapseState = {
      "meeting-info": false,
      "timekeeper-intro": true,
      "time-rules": true
    };
    let setupCollapseState = { ...defaultSetupCollapseState };

    function loadSetupCollapseState() {
      try {
        const saved = JSON.parse(localStorage.getItem(setupCollapseStorageKey)) || {};
        setupCollapseState = { ...defaultSetupCollapseState, ...saved };
      } catch {
        setupCollapseState = { ...defaultSetupCollapseState };
      }
    }

    function saveSetupCollapseState() {
      localStorage.setItem(setupCollapseStorageKey, JSON.stringify(setupCollapseState));
    }

    function getMeetingInfoSummary() {
      const meetingName = els.meetingTitle.value.trim() || "Toastmasters 例会";
      const meetingDate = els.meetingDate.value || "未填写日期";
      return `${meetingName}｜${meetingDate}`;
    }

    function updateCollapseSummaries() {
      const meetingSummary = document.getElementById("meetingInfoCollapseSummary");
      const introSummary = document.getElementById("timekeeperIntroCollapseSummary");
      const ruleSummary = document.getElementById("timeRulesCollapseSummary");
      if (meetingSummary) meetingSummary.textContent = getMeetingInfoSummary();
      if (introSummary) introSummary.textContent = "给听众看的说明页";
      if (ruleSummary) ruleSummary.textContent = `${getAllRules().length} 条规则`;
    }

    function applySetupCollapseState() {
      document.querySelectorAll("[data-collapse-section]").forEach((section) => {
        const key = section.dataset.collapseSection;
        const collapsed = Boolean(setupCollapseState[key]);
        section.classList.toggle("collapsed", collapsed);
        const toggle = section.querySelector(".setup-section-toggle");
        const chevron = section.querySelector(".setup-section-chevron");
        if (toggle) toggle.setAttribute("aria-expanded", String(!collapsed));
        if (chevron) chevron.textContent = collapsed ? "⌄" : "⌃";
      });
      updateCollapseSummaries();
    }

    function toggleSetupSection(key) {
      setupCollapseState[key] = !setupCollapseState[key];
      saveSetupCollapseState();
      applySetupCollapseState();
    }
```

- [ ] **Step 4: Bind collapse events and summaries**

In `bindEvents()`, add:

```js
      document.querySelectorAll("[data-collapse-section]").forEach((section) => {
        const toggle = section.querySelector(".setup-section-toggle");
        if (!toggle) return;
        toggle.addEventListener("click", () => toggleSetupSection(section.dataset.collapseSection));
      });
      els.meetingTitle.addEventListener("input", updateCollapseSummaries);
      els.meetingDate.addEventListener("input", updateCollapseSummaries);
```

In `init()`, before the first render that shows setup UI, add:

```js
      loadSetupCollapseState();
      applySetupCollapseState();
```

- [ ] **Step 5: Run verifier**

Run:

```powershell
node D:\Codex\usechrome\verify_agenda_drag_collapse.mjs D:\Codex\usechrome\Scorpioapn.github.io\index.html
```

Expected: pass with `Agenda drag/collapse verification passed.`

- [ ] **Step 6: Commit collapse behavior**

Run:

```powershell
git add -- index.html
git commit -m "Add collapsible setup sections"
```

Expected: commit only `index.html`.

### Task 4: Regression Checks And Visual Verification

**Files:**
- Read: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`
- Read: `D:/Codex/usechrome/verify_agenda_defaults.mjs`
- Read: `D:/Codex/usechrome/verify_agenda_drag_collapse.mjs`

- [ ] **Step 1: Run drag/collapse verifier**

Run:

```powershell
node D:\Codex\usechrome\verify_agenda_drag_collapse.mjs D:\Codex\usechrome\Scorpioapn.github.io\index.html
```

Expected:

```text
Agenda drag/collapse verification passed.
```

- [ ] **Step 2: Run existing agenda defaults verifier**

Run:

```powershell
node D:\Codex\usechrome\verify_agenda_defaults.mjs D:\Codex\usechrome\Scorpioapn.github.io\index.html
```

Expected:

```text
Agenda default mapping verification passed.
```

- [ ] **Step 3: Run JavaScript syntax check**

Run:

```powershell
$html = Get-Content -Raw -LiteralPath index.html
$script = [regex]::Match($html, '<script>([\s\S]*)</script>').Groups[1].Value
$tmp = Join-Path $env:TEMP 'timekeeper-index-script.js'
Set-Content -LiteralPath $tmp -Value $script -Encoding UTF8
node --check $tmp
```

Expected: no output and exit code `0`.

- [ ] **Step 4: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected: no output and exit code `0`.

- [ ] **Step 5: Browser smoke test**

Open:

```text
file:///D:/Codex/usechrome/Scorpioapn.github.io/index.html
```

Use Chrome DevTools to verify:

```js
document.getElementById("setupTabBtn").click();
Boolean(document.querySelector(".agenda-drag-handle"));
Boolean(document.querySelector('[data-collapse-section="time-rules"].collapsed'));
```

Expected result:

```json
true
true
```

Then check console messages:

```text
No JavaScript errors.
```

- [ ] **Step 6: Keep the external verifier out of the repo**

The verifier is outside the GitHub Pages repo. Leave it uncommitted unless the user asks to add test helpers to the repo.

### Task 5: Deploy To GitHub Pages

**Files:**
- Commit: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`
- Push: `main` branch to `origin`

- [ ] **Step 1: Confirm branch and status**

Run:

```powershell
git status -sb
git log --oneline -5
```

Expected: on `main`, clean or only intended committed changes ahead of `origin/main`.

- [ ] **Step 2: Push**

Run:

```powershell
git push origin main
```

Expected: push succeeds with `main -> main`.

- [ ] **Step 3: Wait for Pages build**

Run:

```powershell
$deadline = (Get-Date).AddMinutes(3)
do {
  $json = gh api repos/Scorpioapn/Scorpioapn.github.io/pages/builds/latest | ConvertFrom-Json
  "Pages build: status=$($json.status) result=$($json.result) commit=$($json.commit.Substring(0,7))"
  if ($json.status -ne 'building' -and $json.status -ne 'queued') { break }
  Start-Sleep -Seconds 10
} while ((Get-Date) -lt $deadline)
if ($json.status -eq 'building' -or $json.status -eq 'queued') { exit 1 }
```

Expected: final line reports `status=built`.

- [ ] **Step 4: Verify deployed HTML**

Run:

```powershell
$url = 'https://scorpioapn.github.io/?codex=agenda-drag-collapse'
$response = Invoke-WebRequest -Uri $url -UseBasicParsing
$html = $response.Content
Write-Output "HTTP: $($response.StatusCode)"
Write-Output "HasDragHandle: $($html.Contains('agenda-drag-handle'))"
Write-Output "HasCollapseState: $($html.Contains('tm_timekeeper_setup_collapse_v1'))"
Write-Output "HasAgendaMapping: $($html.Contains('defaultAgendaMappings'))"
```

Expected:

```text
HTTP: 200
HasDragHandle: True
HasCollapseState: True
HasAgendaMapping: True
```

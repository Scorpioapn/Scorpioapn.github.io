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
  const header = block('<header class="workflow-header">', "</header>");
  assert.match(header, /data-workflow-target="meetingInfoPanel"[^>]*aria-current="step"/);
  assert.match(header, /data-workflow-target="agendaPanel"/);
  assert.match(header, /data-workflow-target="previewPanel"/);
  assert.match(header, /id="saveStatus"/);
  assert.match(header, /id="exportPdfBtn"/);
});

test("weekly start actions lead with relay import", () => {
  const actions = block('<section class="start-actions" id="startActions"', "</section>");
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
  const previewToolbar = block('<header class="preview-toolbar">', "</header>");
  assert.doesNotMatch(previewToolbar, /id="exportPdfBtn"/);
  assert.equal((source.match(/id="exportPdfBtn"/g) || []).length, 1);
  assert.equal((source.match(/data-mobile-nav=/g) || []).length, 3);
});

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

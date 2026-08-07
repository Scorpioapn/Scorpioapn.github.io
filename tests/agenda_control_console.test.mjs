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

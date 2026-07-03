import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../agenda_generator.html", import.meta.url), "utf8");

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  assert.ok(match, `${selector} CSS rule should exist`);
  return match[1];
}

function functionBlock(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} function should exist`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let signatureEnd = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0) {
      signatureEnd = index;
      break;
    }
  }
  assert.notEqual(signatureEnd, -1, `${name} function signature should close`);
  const braceStart = source.indexOf("{", signatureEnd);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} function block should close`);
}

test("agenda generator exposes a replayable first-run guide shell", () => {
  assert.match(source, /const GUIDE_SEEN_STORAGE_KEY\s*=\s*"tm_agenda_guide_seen_v1";/);
  assert.match(source, /<button class="nav-button" id="guideReplayBtn"[\s\S]*?重新查看引导[\s\S]*?<\/button>/);
  assert.match(source, /id="guideOverlay"[^>]*hidden[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(source, /id="guidePrevBtn"/);
  assert.match(source, /id="guideNextBtn"/);
  assert.match(source, /id="guideDoneBtn"/);
});

test("agenda guide highlights the required existing sections", () => {
  assert.match(source, /id="fixedInfoPanel"/, "fixed information section should have a guide target id");

  for (const target of [
    "#meetingInfoPanel",
    "#agendaPanel",
    "#fixedInfoPanel",
    "#previewPanel",
    "#exportPanel",
    "#cloudSyncPanel"
  ]) {
    assert.ok(source.includes(`target: "${target}"`), `guide should include ${target}`);
  }

  assert.match(source, /filter\(\(step\) => document\.querySelector\(step\.target\)\)/, "optional targets should be skipped when absent");
});

test("agenda guide persists completion and supports keyboard/mobile behavior", () => {
  assert.match(source, /localStorage\.getItem\(GUIDE_SEEN_STORAGE_KEY\)\s*!==\s*"true"/);
  assert.match(source, /localStorage\.setItem\(GUIDE_SEEN_STORAGE_KEY,\s*"true"\)/);
  assert.match(source, /event\.key\s*!==\s*"Escape"/);
  assert.match(source, /closeGuide\(\{ markSeen:\s*false \}\)/, "Escape should close without marking the guide seen");
  assert.match(source, /scrollIntoView\(\{ block:\s*"center",\s*inline:\s*"nearest"/, "guide should scroll the highlighted target into view");
});

test("agenda guide overlay does not participate in normal page layout", () => {
  const overlayCss = cssRule(".guide-overlay");
  assert.match(overlayCss, /position:\s*fixed;/);
  assert.match(overlayCss, /inset:\s*0;/);
  assert.match(overlayCss, /pointer-events:\s*auto;/, "modal overlay should block clicks from reaching the editor beneath it");
  assert.match(cssRule(".guide-overlay[hidden]"), /display:\s*none;/);
  assert.match(source, /@media print[\s\S]*?\.guide-overlay/, "guide overlay should be hidden when printing");
});

test("agenda guide still closes when completion state cannot be persisted", () => {
  const closeGuideSource = functionBlock("closeGuide");
  assert.match(closeGuideSource, /try\s*{[\s\S]*?localStorage\.setItem\(GUIDE_SEEN_STORAGE_KEY,\s*"true"\)[\s\S]*?}\s*catch/, "guide completion persistence should be guarded");
  assert.match(closeGuideSource, /catch\s*\(error\)\s*{[\s\S]*?console\.warn\("Failed to save guide state",\s*error\);[\s\S]*?}/, "storage failures should be logged without blocking close");
  assert.match(closeGuideSource, /els\.guideOverlay\.hidden\s*=\s*true;/, "guide should still hide after a storage failure");
});

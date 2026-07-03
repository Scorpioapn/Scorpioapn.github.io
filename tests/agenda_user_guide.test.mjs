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
  assert.match(cssRule(".guide-overlay[hidden]"), /display:\s*none;/);
  assert.match(source, /@media print[\s\S]*?\.guide-overlay/, "guide overlay should be hidden when printing");
});

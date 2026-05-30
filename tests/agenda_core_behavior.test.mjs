import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

const moduleUrl = new URL("../src/shared/agendaCore.mjs", import.meta.url);

async function loadCore() {
  assert.ok(existsSync(moduleUrl), "shared agenda core module should exist");
  return import(moduleUrl.href);
}

test("shared core parses duration labels used by agenda rows", async () => {
  const { parseDurationMinutes } = await loadCore();

  assert.equal(parseDurationMinutes("5-7"), 7);
  assert.equal(parseDurationMinutes("2–3 分钟"), 3);
  assert.equal(parseDurationMinutes("2min/人"), 2);
  assert.equal(parseDurationMinutes(""), 0);
});

test("shared core formats meeting times without leaking days", async () => {
  const { timeToMinutes, minutesToTime, addMinutesToTime } = await loadCore();

  assert.equal(timeToMinutes("19:25"), 1165);
  assert.equal(minutesToTime(1165 + 45), "20:10");
  assert.equal(minutesToTime(24 * 60 + 5), "00:05");
  assert.equal(addMinutesToTime("23:50", 20), "00:10");
});

test("shared core derives timing reminder boundaries", async () => {
  const { deriveTimingRuleFromMinutes } = await loadCore();

  assert.deepEqual(deriveTimingRuleFromMinutes(3), {
    green: 120,
    yellow: 150,
    red: 180,
    greenRemaining: 60,
    yellowRemaining: 30,
    overtimeAlert: 15,
    band: "3分钟及以下规则"
  });
  assert.deepEqual(deriveTimingRuleFromMinutes(7), {
    green: 300,
    yellow: 360,
    red: 420,
    greenRemaining: 120,
    yellowRemaining: 60,
    overtimeAlert: 30,
    band: "3-10分钟规则"
  });
  assert.deepEqual(deriveTimingRuleFromMinutes(12), {
    green: 420,
    yellow: 600,
    red: 720,
    greenRemaining: 300,
    yellowRemaining: 120,
    overtimeAlert: 30,
    band: "10分钟以上规则"
  });
});

test("shared core can reschedule agenda rows while preserving sections", async () => {
  const { rescheduleAgendaItems } = await loadCore();

  const rows = rescheduleAgendaItems([
    { kind: "section", title: "一、开场" },
    { kind: "item", title: "规则", duration: "1" },
    { kind: "item", title: "主持开场", duration: "2-3" }
  ], "19:30");

  assert.deepEqual(rows, [
    { kind: "section", title: "一、开场" },
    { kind: "item", title: "规则", duration: "1", time: "19:30" },
    { kind: "item", title: "主持开场", duration: "2-3", time: "19:31" }
  ]);
});

test("shared core drops removed agenda-generator fields during normalization", async () => {
  const { normalizeAgendaGeneratorData } = await loadCore();

  const normalized = normalizeAgendaGeneratorData({
    theme: "即兴之夜",
    posterData: "data:image/png;base64,old",
    footerNotes: "old notes",
    pathways: "old pathways",
    joinInfo: "old join info",
    items: []
  }, {
    theme: "默认主题",
    items: [{ kind: "item", title: "默认", duration: "1" }]
  });

  assert.equal(normalized.theme, "即兴之夜");
  assert.deepEqual(normalized.items, [{ kind: "item", title: "默认", duration: "1" }]);
  assert.equal("posterData" in normalized, false);
  assert.equal("footerNotes" in normalized, false);
  assert.equal("pathways" in normalized, false);
  assert.equal("joinInfo" in normalized, false);
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const agendaGenerator = readFileSync(new URL("../agenda_generator.html", import.meta.url), "utf8");
const timekeeper = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const packageUrl = new URL("../package.json", import.meta.url);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} function body should close`);
}

test("project exposes a single npm test command", () => {
  assert.ok(existsSync(packageUrl), "package.json should exist");
  const packageJson = JSON.parse(readFileSync(packageUrl, "utf8"));
  assert.equal(packageJson.scripts?.test, "node --test tests/*.test.mjs");
});

test("hardened client modules and Edge deployment guide are tracked", () => {
  for (const path of [
    "js/agenda-data.js",
    "js/timekeeper-state.js",
    "js/export-safety.js",
    "supabase/functions/agenda-drafts/index.ts",
    "supabase/functions/agenda-drafts/README.md"
  ]) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} should exist`);
  }
});

test("timekeeper storage writes use guarded helpers", () => {
  assert.match(timekeeper, /function writeJson\(/, "timekeeper should centralize JSON writes");
  assert.match(timekeeper, /function removeStoredValue\(/, "timekeeper should centralize storage removal");
  const saveAgenda = extractFunction(timekeeper, "saveAgenda");
  const saveRecords = extractFunction(timekeeper, "saveRecords");
  const saveMeeting = extractFunction(timekeeper, "saveMeeting");
  assert.doesNotMatch(
    saveAgenda,
    /localStorage\.setItem/,
    "saveAgenda should not write directly to localStorage"
  );
  assert.doesNotMatch(
    saveRecords,
    /localStorage\.setItem/,
    "saveRecords should not write directly to localStorage"
  );
  assert.doesNotMatch(
    saveMeeting,
    /localStorage\.setItem/,
    "saveMeeting should not write directly to localStorage"
  );
});

test("timekeeper omits unused setup state keys", () => {
  for (const token of [
    "UI_MODE_KEY",
    "COLLAPSE_KEY",
    "tm_timekeeper_ui_mode_v1",
    "tm_timekeeper_setup_collapse_v1"
  ]) {
    assert.equal(timekeeper.includes(token), false, `${token} should not remain without active UI`);
  }
});

test("timekeeper tick skips redundant timer renders within the same second", () => {
  assert.match(
    timekeeper,
    /const nextElapsed = Math\.floor\(\(Date\.now\(\) - state\.timer\.startedAt - state\.timer\.pausedMs\) \/ 1000\);/,
    "tick should calculate the next whole second before mutating timer state"
  );
  assert.match(
    timekeeper,
    /if \(nextElapsed === state\.timer\.elapsed\) return;/,
    "tick should avoid repainting timer UI when the displayed second did not change"
  );
});

test("live agenda generator parses unicode dash duration ranges", () => {
  const parseDurationMinutes = new Function(`
    ${extractFunction(agendaGenerator, "parseDurationMinutes")}
    return parseDurationMinutes;
  `)();

  assert.equal(parseDurationMinutes("2–3 分钟"), 3);
  assert.equal(parseDurationMinutes("10—12"), 12);
});

test("agenda generator JSON import strips removed fields", () => {
  assert.match(
    agendaGenerator,
    /function normalizeImportedData\(parsed\) \{[\s\S]*?stripRemovedDataFields\(normalized\);[\s\S]*?return normalized;/,
    "imported JSON should pass through the same removed-field migration as localStorage data"
  );
});

test("timekeeper reset-all stops when storage cleanup fails", () => {
  assert.match(
    timekeeper,
    /const recordsRemoved = removeStoredValue\(STORAGE_KEYS\.records, "计时记录清理失败，请稍后再试"\);/,
    "resetAll should keep the result of record cleanup"
  );
  assert.match(
    timekeeper,
    /const agendaRemoved = removeStoredValue\(STORAGE_KEYS\.agenda, "议程清理失败，请稍后再试"\);/,
    "resetAll should keep the result of agenda cleanup"
  );
  assert.match(
    timekeeper,
    /if \(!recordsRemoved \|\| !agendaRemoved\) return;/,
    "resetAll should not continue to success state after cleanup failure"
  );
});

test("agenda generator defaults omit removed preview fields", () => {
  for (const token of [
    "posterData:",
    "footerNotes:",
    "pathways:",
    "joinInfo:",
    "function pathwaysHtml",
    ".pathways-card",
    ".pathways-body",
    ".pathways-grid"
  ]) {
    assert.equal(agendaGenerator.includes(token), false, `${token} should not remain after cleanup`);
  }
});

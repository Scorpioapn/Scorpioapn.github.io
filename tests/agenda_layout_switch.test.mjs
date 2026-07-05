import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const classicSource = readFileSync(new URL("../agenda_generator.html", import.meta.url), "utf8");
const modernSource = readFileSync(new URL("../agenda_generator_modern.html", import.meta.url), "utf8");

test("classic and modern agenda layout pages are both available and cross-linked", () => {
  assert.match(classicSource, /id="modernLayoutBtn"[\s\S]*?href="agenda_generator_modern\.html"[\s\S]*?新版版式/);
  assert.match(modernSource, /id="classicLayoutBtn"[\s\S]*?href="agenda_generator\.html"[\s\S]*?经典版式/);
});

test("layout switch keeps the existing shared data and feature modules", () => {
  for (const sharedScript of [
    "js/agenda-templates.js",
    "js/agenda-relay-importer.js",
    "js/agenda-data.js",
    "js/storage.js",
    "js/agenda-cloud-sync.js"
  ]) {
    assert.ok(classicSource.includes(sharedScript), `classic page should keep ${sharedScript}`);
    assert.ok(modernSource.includes(sharedScript), `modern page should keep ${sharedScript}`);
  }

  for (const hook of [
    'id="meetingInfoPanel"',
    'id="agendaPanel"',
    'id="relayImportBtn"',
    'id="changeTemplateBtn"',
    'id="exportPanel"',
    'id="cloudSyncPanel"'
  ]) {
    assert.ok(classicSource.includes(hook), `classic page should keep ${hook}`);
    assert.ok(modernSource.includes(hook), `modern page should keep ${hook}`);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const AgendaData = require("../js/agenda-data.js");

const defaults = {
  clubName: "畅言中文国际演讲会",
  theme: "主题",
  logoData: "",
  wechatQrData: "",
  joinQrData: "",
  items: [{ id: "item-1", kind: "item", title: "主持", duration: "3", time: "19:30", person: "", detail: "" }]
};

test("strict agenda normalization rejects wrong scalar types before persistence", () => {
  assert.throws(
    () => AgendaData.normalizeAgendaData({ ...defaults, clubName: null }, defaults),
    /clubName must be a string/
  );
});

test("agenda normalization drops unknown fields and normalizes item shape", () => {
  const result = AgendaData.normalizeAgendaData({
    ...defaults,
    unknown: "drop-me",
    items: [{ id: 7, kind: "wrong", title: "主持", injected: true }]
  }, defaults);
  assert.equal(Object.hasOwn(result, "unknown"), false);
  assert.deepEqual(result.items[0], {
    id: "7",
    kind: "item",
    time: "",
    title: "主持",
    detail: "",
    duration: "",
    person: ""
  });
});

test("agenda normalization rejects external image URLs and excessive payloads", () => {
  assert.throws(
    () => AgendaData.normalizeAgendaData({ ...defaults, logoData: "https://tracker.test/pixel" }, defaults),
    /logoData contains an unsupported image source/
  );
  assert.throws(
    () => AgendaData.assertPayloadSize({ value: "x".repeat(AgendaData.MAX_PAYLOAD_BYTES) }),
    /payload exceeds 4 MiB/
  );
});

test("tolerant startup falls back to defaults instead of preserving corrupt values", () => {
  const result = AgendaData.normalizeAgendaData({ ...defaults, clubName: null }, defaults, { strict: false });
  assert.equal(result.clubName, defaults.clubName);
});

test("agenda normalization caps items and accepts bundled/data image sources", () => {
  const manyItems = Array.from({ length: AgendaData.MAX_ITEMS + 1 }, (_, index) => ({
    id: `item-${index}`,
    kind: "item",
    title: "议程"
  }));
  assert.throws(() => AgendaData.normalizeAgendaData({ ...defaults, items: manyItems }, defaults), /items exceeds/);

  const result = AgendaData.normalizeAgendaData({
    ...defaults,
    logoData: "data:image/png;base64,AAAA",
    wechatQrData: "assets/quhuo-qr.png"
  }, defaults);
  assert.equal(result.logoData, "data:image/png;base64,AAAA");
  assert.equal(result.wechatQrData, "assets/quhuo-qr.png");
});

test("agenda generator uses strict normalization before replacing persisted state", () => {
  const html = readFileSync(new URL("../agenda_generator.html", import.meta.url), "utf8");
  assert.match(html, /<script src="js\/agenda-data\.js"><\/script>/);
  assert.match(html, /AgendaData\.normalizeAgendaData\(parsed, DEFAULT_DATA\)/);
  assert.match(html, /function replaceAgendaState\(payload\)/);
  assert.match(html, /renderAll\(\);\s*saveData\(\);/);
});

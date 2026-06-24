import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const TimekeeperState = require("../js/timekeeper-state.js");

test("paused, running, elapsed, or post-record state cannot be abandoned", () => {
  assert.equal(TimekeeperState.canLeaveAgenda({ running: true, paused: false, elapsed: 0 }, null), false);
  assert.equal(TimekeeperState.canLeaveAgenda({ running: true, paused: true, elapsed: 42 }, null), false);
  assert.equal(TimekeeperState.canLeaveAgenda({ running: false, paused: false, elapsed: 1 }, null), false);
  assert.equal(TimekeeperState.canLeaveAgenda({ running: false, paused: false, elapsed: 0 }, "finish-agenda"), false);
  assert.equal(TimekeeperState.canLeaveAgenda({ running: false, paused: false, elapsed: 0 }, null), true);
});

test("activating one item demotes every other active item", () => {
  const items = [
    { id: "a", status: "active" },
    { id: "b", status: "pending" },
    { id: "c", status: "done" }
  ];
  TimekeeperState.activateOnly(items, "b");
  assert.deepEqual(items.map(({ status }) => status), ["pending", "active", "done"]);
});

test("failed record persistence rolls back the append", () => {
  const records = [];
  const result = TimekeeperState.appendPersistedRecord(records, { id: "r1" }, () => false);
  assert.equal(result, false);
  assert.deepEqual(records, []);
});

test("thrown record persistence rolls back the append", () => {
  const records = [];
  const result = TimekeeperState.appendPersistedRecord(records, { id: "r1" }, () => {
    throw new Error("quota exceeded");
  });
  assert.equal(result, false);
  assert.deepEqual(records, []);
});

test("live timekeeper uses the guarded transition and persistence module", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<script src="js\/timekeeper-state\.js"><\/script>/);
  assert.match(html, /TimekeeperState\.canLeaveAgenda\(state\.timer, state\.postRecordAction\)/);
  assert.match(html, /TimekeeperState\.activateOnly\(state\.agendaItems, item\.id\)/);
  assert.match(html, /TimekeeperState\.appendPersistedRecord\(state\.records, record, saveRecords\)/);
  assert.match(html, /if \(elapsed > 0 && !record\) return;/);
});

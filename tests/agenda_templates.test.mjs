import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const templates = require("../js/agenda-templates.js");

test("template skeletons clear participant names but keep collective values", () => {
  const skeleton = templates.getTemplateSkeleton("regular-meeting");

  const persons = skeleton.items.filter((item) => item.kind === "item").map((item) => item.person);
  assert.ok(!persons.includes("卡卡"), "real names should be cleared from the skeleton");
  assert.ok(!persons.includes("Jessica"), "real names should be cleared from the skeleton");
  const warmup = skeleton.items.find((item) => item.title === "暖场互动");
  assert.equal(warmup.person, "全体会员", "collective values are structure and should survive");
  const break_ = skeleton.items.find((item) => item.title === "茶歇+大合照");
  assert.equal(break_.person, "全场人员");
});

test("template skeletons genericize past speech titles into numbered slots", () => {
  const skeleton = templates.getTemplateSkeleton("regular-meeting");
  const titles = skeleton.items.map((item) => item.title);

  assert.ok(titles.includes("备稿演讲1"), "speech rows should become numbered generic slots");
  assert.ok(titles.includes("备稿演讲2"));
  assert.ok(titles.includes("备稿点评1"), "evaluation rows should become numbered generic slots");
  assert.ok(titles.includes("备稿点评2"));
  assert.ok(!titles.some((title) => title.includes("《")), "no stale speech titles should remain");
  const speech1 = skeleton.items.find((item) => item.title === "备稿演讲1");
  assert.equal(speech1.detail, "", "speech-specific details should be cleared");
});

test("template skeletons keep structure, sections, durations, and schedule defaults", () => {
  const template = templates.getTemplate("regular-meeting");
  const skeleton = templates.getTemplateSkeleton("regular-meeting");

  assert.equal(skeleton.items.length, template.data.items.length, "no rows should be added or removed");
  assert.deepEqual(
    skeleton.items.filter((item) => item.kind === "section").map((item) => item.title),
    template.data.items.filter((item) => item.kind === "section").map((item) => item.title),
    "section structure should be identical"
  );
  assert.equal(skeleton.startTime, template.data.startTime);
  assert.equal(skeleton.endTime, template.data.endTime);
  const templateDurations = template.data.items.map((item) => item.duration || "");
  const skeletonDurations = skeleton.items.map((item) => item.duration || "");
  assert.deepEqual(skeletonDurations, templateDurations, "durations are structure and must be kept");
});

test("marathon template skeleton clears role-name placeholders so relay import can fill them", () => {
  const skeleton = templates.getTemplateSkeleton("impromptu-marathon");

  const host = skeleton.items.find((item) => String(item.title).includes("即兴主持介绍第一轮"));
  assert.equal(host.person, "", "role-name placeholders like 即兴主持 would block relay fill and must be cleared");
  const round1 = skeleton.items.find((item) => String(item.title).includes("即兴演讲 Round 1"));
  assert.equal(round1.person, "现场所有人", "collective values stay");
});

test("getTemplateSkeleton does not affect getTemplate or getDefaultData", () => {
  templates.getTemplateSkeleton("regular-meeting");
  const raw = templates.getTemplate("regular-meeting");
  assert.ok(raw.data.items.some((item) => item.person === "卡卡"), "raw template data must keep its sample people");
  assert.equal(templates.getDefaultData().theme, "复盘：我过的怎么样", "first-run default seed stays untouched");
  assert.equal(templates.getTemplateSkeleton("不存在的模板"), null);
});

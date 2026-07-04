import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { parseRelayText } = require("../js/agenda-relay-importer.js");

const sampleRelayText = `@所有人
[烟花]畅言779期报名帖[烟花]
主题：志愿者
今日一词：服务
例会经理：莫婷
时间：6月9日 19:30-21:30
地点: 深圳南山•讯美科技3号楼4楼Space Max会议室
事务官开场：文星
主席致辞：卡卡
总主持：[玫瑰]
来宾介绍：VPM
时间官：[玫瑰]
哼哈官：[玫瑰]
语法官：[玫瑰]
提问官：[玫瑰]
即兴主持：Jessica
备稿演讲1：卡卡
备稿演讲2：史迪仔
备稿演讲3：女侠
即兴点评：[玫瑰]
备稿点评1：Jessica
备稿点评2：[玫瑰]
总点评：[玫瑰]
颁奖&真情分享：[玫瑰]
拍照侠：ALL`;

function itemByTitle(result, title) {
  return result.items.find((item) => item.title === title);
}

function titleSequence(result) {
  return result.items.map((item) => item.title);
}

test("parseRelayText extracts meeting metadata and mapped agenda items from WeChat relay text", () => {
  const result = parseRelayText(sampleRelayText, { now: new Date("2026-01-15T00:00:00+08:00") });

  assert.equal(result.meetingNo, "779");
  assert.equal(result.theme, "志愿者");
  assert.equal(result.wordOfDay, "服务");
  assert.equal(result.manager, "莫婷");
  assert.equal(result.date, "2026-06-09");
  assert.equal(result.startTime, "19:30");
  assert.equal(result.endTime, "21:30");
  assert.equal(result.location, "深圳南山•讯美科技3号楼4楼Space Max会议室");
  assert.equal(result.items.length, 26);
  assert.deepEqual(titleSequence(result), [
    "开场环节",
    "事务官开场",
    "主席致辞",
    "总主持开场，介绍会议流程",
    "来宾介绍",
    "时间官宣言",
    "语法官宣言",
    "哼哈官宣言",
    "即兴马拉松",
    "即兴演讲",
    "精心演讲环节",
    "备稿演讲1",
    "备稿演讲2",
    "备稿演讲3",
    "茶歇&会议反馈环节",
    "即兴点评",
    "备稿点评1",
    "备稿点评2",
    "备稿点评3",
    "时间官报告",
    "语法官报告",
    "哼哈官报告",
    "总点评",
    "分享环节",
    "颁奖&真情分享",
    "拍照侠 / 大合照"
  ]);
  assert.equal(itemByTitle(result, "开场环节").kind, "section");
  assert.equal(itemByTitle(result, "即兴马拉松").kind, "section");
  assert.equal(itemByTitle(result, "精心演讲环节").kind, "section");
  assert.equal(itemByTitle(result, "茶歇&会议反馈环节").kind, "section");
  assert.equal(itemByTitle(result, "分享环节").kind, "section");

  assert.deepEqual(itemByTitle(result, "事务官开场"), { id: "relay-i-officer-open", kind: "item", title: "事务官开场", duration: "1", person: "文星" });
  assert.deepEqual(itemByTitle(result, "主席致辞"), { id: "relay-i-president", kind: "item", title: "主席致辞", duration: "3", person: "卡卡" });
  assert.deepEqual(itemByTitle(result, "总主持开场，介绍会议流程"), { id: "relay-i-host-open", kind: "item", title: "总主持开场，介绍会议流程", duration: "3", person: "待定" });
  assert.deepEqual(itemByTitle(result, "时间官宣言"), { id: "relay-i-timer-declaration", kind: "item", title: "时间官宣言", duration: "2", person: "待定" });
  assert.deepEqual(itemByTitle(result, "语法官宣言"), { id: "relay-i-grammarian-declaration", kind: "item", title: "语法官宣言", duration: "2", person: "待定" });
  assert.deepEqual(itemByTitle(result, "哼哈官宣言"), { id: "relay-i-ah-counter-declaration", kind: "item", title: "哼哈官宣言", duration: "2", person: "待定" });
  assert.deepEqual(itemByTitle(result, "即兴演讲"), { id: "relay-i-impromptu", kind: "item", title: "即兴演讲", duration: "15", durationNote: "2min/人", person: "Jessica" });
  assert.deepEqual(itemByTitle(result, "时间官报告"), { id: "relay-i-timer-report", kind: "item", title: "时间官报告", duration: "3", person: "待定" });
  assert.deepEqual(itemByTitle(result, "语法官报告"), { id: "relay-i-grammarian-report", kind: "item", title: "语法官报告", duration: "3", person: "待定" });
  assert.deepEqual(itemByTitle(result, "哼哈官报告"), { id: "relay-i-ah-counter-report", kind: "item", title: "哼哈官报告", duration: "3", person: "待定" });
  assert.deepEqual(itemByTitle(result, "拍照侠 / 大合照"), { id: "relay-i-photo", kind: "item", title: "拍照侠 / 大合照", duration: "3", person: "ALL" });
  assert.equal(itemByTitle(result, "三官宣言"), undefined);
});

test("parseRelayText normalizes placeholders and creates separate officer declarations and reports", () => {
  const result = parseRelayText(sampleRelayText, { now: new Date("2026-01-15T00:00:00+08:00") });

  assert.equal(itemByTitle(result, "时间官宣言").person, "待定");
  assert.equal(itemByTitle(result, "语法官宣言").person, "待定");
  assert.equal(itemByTitle(result, "哼哈官宣言").person, "待定");
  assert.equal(itemByTitle(result, "时间官报告").person, "待定");
  assert.equal(itemByTitle(result, "语法官报告").person, "待定");
  assert.equal(itemByTitle(result, "哼哈官报告").person, "待定");
  assert.equal(itemByTitle(result, "即兴点评").person, "待定");
  assert.equal(itemByTitle(result, "总点评").person, "待定");
});

test("parseRelayText supports English colons and omits optional photo item when absent", () => {
  const result = parseRelayText(`畅言780期报名帖
主题: 练习
今日一词: Focus
例会经理: TBD
时间: 7月10日 19:30-21:30
地点: Space Max
总主持: 空
备稿演讲1: Ada`, { now: new Date("2026-01-15T00:00:00+08:00") });

  assert.equal(result.meetingNo, "780");
  assert.equal(result.theme, "练习");
  assert.equal(result.wordOfDay, "Focus");
  assert.equal(result.manager, "待定");
  assert.equal(result.location, "Space Max");
  assert.equal(itemByTitle(result, "总主持开场，介绍会议流程").person, "待定");
  assert.equal(itemByTitle(result, "备稿演讲1").person, "Ada");
  assert.equal(itemByTitle(result, "拍照侠 / 大合照"), undefined);
});

test("parseRelayText handles relay text whose line breaks were collapsed into spaces", () => {
  const result = parseRelayText("@所有人  [烟花]畅言779期报名帖[烟花] 主题：志愿者 今日一词：服务 例会经理：莫婷  时间：6月9日 19:30-21:30 地点:   深圳南山•讯美科技3号楼4楼Space Max会议室 事务官开场：文星 主席致辞：卡卡 总主持：simon 来宾介绍：VPM  时间官：May 哼哈官：Jessica 语法官：莫婷 提问官：文星  即兴主持：莫婷 备稿演讲1：卡卡 备稿演讲2：史迪仔  即兴点评：女侠 备稿点评1：Jessica 备稿点评2：聪聪  总点评：思玮  颁奖&真情分享：卡卡 拍照侠：ALL", { now: new Date("2026-01-15T00:00:00+08:00") });

  assert.equal(result.meetingNo, "779");
  assert.equal(result.theme, "志愿者");
  assert.equal(result.manager, "莫婷");
  assert.equal(itemByTitle(result, "总主持开场，介绍会议流程").person, "simon");
  assert.equal(itemByTitle(result, "时间官宣言").person, "May");
  assert.equal(itemByTitle(result, "语法官宣言").person, "莫婷");
  assert.equal(itemByTitle(result, "哼哈官宣言").person, "Jessica");
  assert.equal(itemByTitle(result, "时间官报告").person, "May");
  assert.equal(itemByTitle(result, "语法官报告").person, "莫婷");
  assert.equal(itemByTitle(result, "哼哈官报告").person, "Jessica");
  assert.equal(itemByTitle(result, "备稿演讲3").person, "待定");
  assert.equal(itemByTitle(result, "三官宣言"), undefined);
  assert.deepEqual(result.items.filter((item) => item.kind === "section").map((item) => item.title), [
    "开场环节",
    "即兴马拉松",
    "精心演讲环节",
    "茶歇&会议反馈环节",
    "分享环节"
  ]);
});

test("parseRelayText merges duplicated posts and keeps real names over placeholders", () => {
  const result = parseRelayText(`畅言779期报名帖
主题：旧主题
例会经理：[玫瑰]
时间：6月9日 19:30-21:30
总主持：[玫瑰]
时间官：[玫瑰]
备稿演讲1：[玫瑰]

畅言779期报名帖
主题：志愿者
例会经理：莫婷
总主持：Jessica
时间官：Tim
备稿演讲1：卡卡`, { now: new Date("2026-01-15T00:00:00+08:00") });

  assert.equal(result.meetingNo, "779");
  assert.equal(result.theme, "志愿者");
  assert.equal(result.manager, "莫婷");
  assert.equal(itemByTitle(result, "总主持开场，介绍会议流程").person, "Jessica");
  assert.equal(itemByTitle(result, "备稿演讲1").person, "卡卡");
  assert.equal(itemByTitle(result, "时间官宣言").person, "Tim");
  assert.equal(itemByTitle(result, "时间官报告").person, "Tim");
  assert.equal(itemByTitle(result, "三官宣言"), undefined);
});

test("parseRelayText uses the current year for yearless dates and warns for old dates", () => {
  const result = parseRelayText(`畅言779期报名帖
时间：1月1日 19:30-21:30`, { now: new Date("2026-09-01T00:00:00+08:00") });

  assert.equal(result.date, "2026-01-01");
  assert.ok(result.warnings.some((warning) => warning.code === "date-past"));
});

test("parseRelayText keeps empty input empty instead of inventing pending fields", () => {
  const result = parseRelayText("");

  assert.equal(result.manager, "");
  assert.equal(result.items.length, 0);
  assert.equal(result.meetingNo, "");
});

test("parseRelayText rejects invalid clock values instead of storing them", () => {
  for (const range of ["19:99-21:30", "25:30-26:10", "12:60-13:00", "19:30-24:01"]) {
    const result = parseRelayText(`畅言779期报名帖\n时间：6月9日 ${range}`, { now: new Date("2026-01-15T00:00:00+08:00") });
    assert.equal(result.startTime, "", `${range} should not produce a start time`);
    assert.equal(result.endTime, "", `${range} should not produce an end time`);
    assert.equal(result.date, "", `${range} should not produce a date either`);
  }
});

test("parseRelayText rejects impossible calendar dates", () => {
  for (const dateText of ["13月32日", "2月30日", "0月5日"]) {
    const result = parseRelayText(`时间：${dateText} 19:30-21:30`, { now: new Date("2026-01-15T00:00:00+08:00") });
    assert.equal(result.date, "", `${dateText} should be rejected`);
  }
  const leap = parseRelayText("时间：2028年2月29日 19:30-21:30", { now: new Date("2026-01-15T00:00:00+08:00") });
  assert.equal(leap.date, "2028-02-29", "valid leap-year date should still parse");
});

test("parseRelayText normalizes full-width digits in meeting number and times", () => {
  const result = parseRelayText("畅言７７９期报名帖\n时间：６月９日 １９:３０-２１:３０", { now: new Date("2026-01-15T00:00:00+08:00") });
  assert.equal(result.meetingNo, "779");
  assert.equal(result.date, "2026-06-09");
  assert.equal(result.startTime, "19:30");
});

test("parseRelayText recognizes 总主持人 and 主持人 as the host role", () => {
  const result = parseRelayText("总主持人：文星", {});
  assert.equal(itemByTitle(result, "总主持开场，介绍会议流程").person, "文星");
  const result2 = parseRelayText("主持人：莫婷", {});
  assert.equal(itemByTitle(result2, "总主持开场，介绍会议流程").person, "莫婷");
});

test("parseRelayText reads the meeting number without the club name prefix", () => {
  assert.equal(parseRelayText("780期报名帖", {}).meetingNo, "780");
  assert.equal(parseRelayText("第781期例会 主题：练习", {}).meetingNo, "781");
  assert.equal(parseRelayText("隶属于第118大区", {}).meetingNo, "", "district numbers should not be mistaken for meeting numbers");
});

test("parseRelayText splits inline key-value pairs on any line, not only single-line pastes", () => {
  const result = parseRelayText(`畅言779期报名帖
主席致辞：卡卡 总主持：文星
备稿演讲1：Ada`, { now: new Date("2026-01-15T00:00:00+08:00") });

  assert.equal(itemByTitle(result, "主席致辞").person, "卡卡");
  assert.equal(itemByTitle(result, "总主持开场，介绍会议流程").person, "文星");
  assert.equal(itemByTitle(result, "备稿演讲1").person, "Ada");
});

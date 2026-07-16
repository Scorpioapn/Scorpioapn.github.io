import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import {
  COLORS,
  FIRST_PAGE_ITEMS,
  MAX_ITEMS,
  RELAY_LABELS,
  SHEETS,
  buildRelayAgendaRows,
  loadTemplateRows,
  normalizedRelayFormula,
  relayValueFormula,
  selectLastRealRelayValue
} from "../scripts/excel-agenda/workbook-spec.mjs";

const require = createRequire(import.meta.url);
const AgendaSchema = require("../js/agenda-schema.js");

const EXPECTED_LABELS = [
  "主题",
  "今日一词",
  "例会经理",
  "时间",
  "地点",
  "事务官开场",
  "主席致辞",
  "总主持",
  "来宾介绍",
  "时间官",
  "哼哈官",
  "语法官",
  "提问官",
  "即兴主持",
  "备稿演讲1",
  "备稿演讲2",
  "备稿演讲3",
  "即兴点评",
  "备稿点评1",
  "备稿点评2",
  "备稿点评3",
  "总点评",
  "颁奖&真情分享",
  "拍照侠"
];

const REQUIRED_RELAY_TITLES = [
  "事务官开场",
  "主席致辞",
  "总主持开场，介绍会议流程",
  "来宾介绍",
  "即兴演讲",
  "备稿演讲1",
  "备稿演讲2",
  "备稿演讲3",
  "茶歇+大合照",
  "即兴点评",
  "备稿点评1",
  "备稿点评2",
  "备稿点评3",
  "总点评",
  "颁奖&真情分享"
];

const RELAY_ROW_KEYS = [
  "id",
  "kind",
  "sectionNo",
  "sectionName",
  "title",
  "detail",
  "durationText",
  "scheduleMinutes",
  "roleKey",
  "person",
  "rowType"
];

test("workbook exposes the exact sheet order and page capacities", () => {
  assert.deepEqual(SHEETS, [
    "操作台",
    "议程编辑",
    "A4议程",
    "A4续页",
    "模板库",
    "基础资料",
    "计算区"
  ]);
  assert.equal(FIRST_PAGE_ITEMS, 30);
  assert.equal(MAX_ITEMS, 60);
});

test("workbook exposes the agreed Toastmasters palette", () => {
  assert.deepEqual(COLORS, {
    blue: "#004165",
    blueDeep: "#00334F",
    maroon: "#772432",
    maroonBright: "#9D2235",
    yellow: "#F2DF74",
    ink: "#16232E",
    ink2: "#54646F",
    border: "#DFE5EA",
    surface: "#FFFFFF",
    rowBlue: "#EDF4FA",
    rowGreen: "#EFF7EF",
    rowGray: "#F0F2F3",
    warning: "#B7791F",
    warningBg: "#FBF3DE"
  });
});

test("current templates flatten into stable section and item rows", () => {
  const rows = loadTemplateRows();
  assert.deepEqual([...new Set(rows.map((row) => row.templateId))], [
    "regular-meeting",
    "impromptu-marathon"
  ]);
  assert.equal(
    rows.filter((row) => row.templateId === "regular-meeting" && row.kind === "section").length,
    5
  );

  const expectedKeys = [
    "templateId",
    "templateName",
    "order",
    "id",
    "kind",
    "sectionNo",
    "sectionName",
    "title",
    "detail",
    "durationText",
    "scheduleMinutes",
    "person",
    "rowType"
  ];
  for (const row of rows) assert.deepEqual(Object.keys(row), expectedKeys);
});

test("template sections are retained, normalized, and propagated to item rows", () => {
  const rows = loadTemplateRows();
  const ordinalPrefix = /^[一二三四五六七八九十]+、/;

  for (const templateId of ["regular-meeting", "impromptu-marathon"]) {
    const templateRows = rows.filter((row) => row.templateId === templateId);
    const sectionNames = new Map(
      templateRows
        .filter((row) => row.kind === "section")
        .map((row) => [row.sectionNo, row.sectionName])
    );

    for (const row of templateRows) {
      assert.doesNotMatch(row.sectionName, ordinalPrefix);
      assert.equal(row.sectionName, sectionNames.get(row.sectionNo));
      if (row.kind === "section") assert.equal(row.title, row.sectionName);
    }
  }
});

test("relay agenda organizes required item rows under five sections", () => {
  const rows = buildRelayAgendaRows();
  assert.ok(rows.every((row) => row.kind === "item"));
  assert.deepEqual(
    [...new Map(rows.map((row) => [row.sectionNo, row.sectionName])).entries()],
    [
      [1, "开场环节"],
      [2, "即兴演讲"],
      [3, "精心演讲环节"],
      [4, "茶歇&会议反馈环节"],
      [5, "分享环节"]
    ]
  );
  for (const title of REQUIRED_RELAY_TITLES) {
    assert.ok(rows.some((row) => row.title === title), `missing relay row: ${title}`);
  }
});

test("relay agenda rows have an exact stable shape and unique IDs", () => {
  const rows = buildRelayAgendaRows();
  const expectedTypes = {
    id: "string",
    kind: "string",
    sectionNo: "number",
    sectionName: "string",
    title: "string",
    detail: "string",
    durationText: "string",
    scheduleMinutes: "number",
    roleKey: "string",
    person: "string",
    rowType: "string"
  };

  assert.equal(rows.length, 21);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);

  for (const row of rows) {
    assert.deepEqual(Object.keys(row), RELAY_ROW_KEYS);
    assert.equal(row.kind, "item");
    for (const [key, type] of Object.entries(expectedTypes)) {
      assert.equal(typeof row[key], type, `${row.id}.${key}`);
    }
  }
});

test("relay agenda maps three officers to one declaration and one report", () => {
  const rows = buildRelayAgendaRows();
  for (const roleKey of ["时间官", "语法官", "哼哈官"]) {
    const declarations = rows.filter(
      (row) => row.title === `${roleKey}宣言` && row.roleKey === roleKey
    );
    const reports = rows.filter(
      (row) => row.title === `${roleKey}报告` && row.roleKey === roleKey
    );
    assert.equal(declarations.length, 1);
    assert.equal(reports.length, 1);
    assert.equal(declarations[0].sectionName, "开场环节");
    assert.equal(reports[0].sectionName, "茶歇&会议反馈环节");
  }
});

test("relay award and sharing row uses prepared styling", () => {
  const row = buildRelayAgendaRows().find((item) => item.title === "颁奖&真情分享");
  assert.ok(row);
  assert.equal(row.rowType, "prepared");
});

test("relay agenda assigns required row types to representative rows", () => {
  const rows = buildRelayAgendaRows();
  for (const [title, rowType] of [
    ["主席致辞", "plain"],
    ["即兴演讲", "impromptu"],
    ["备稿演讲1", "prepared"],
    ["茶歇+大合照", "break"],
    ["颁奖&真情分享", "prepared"]
  ]) {
    const row = rows.find((item) => item.title === title);
    assert.ok(row, `missing relay row: ${title}`);
    assert.equal(row.rowType, rowType);
  }
});

test("relay 5-7 minute durations follow the schema upper-bound behavior", () => {
  const expectedMinutes = AgendaSchema.parseDurationToMinutes("5-7", 0);
  assert.equal(expectedMinutes, 7);

  const rows = buildRelayAgendaRows().filter((row) => row.durationText === "5-7");
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.scheduleMinutes === expectedMinutes));
});

test("relay labels have the exact stable 24-label order", () => {
  assert.equal(RELAY_LABELS.length, 24);
  assert.deepEqual(RELAY_LABELS, EXPECTED_LABELS);
});

test("relay value selection uses the last real name from duplicate entries", () => {
  assert.equal(selectLastRealRelayValue(["Ada", "Grace"]), "Grace");
});

test("relay value selection ignores placeholders after a real name", () => {
  assert.equal(
    selectLastRealRelayValue(["Ada", "[玫瑰]", "待定", "TBD"]),
    "Ada"
  );
});

test("relay value selection returns 待定 for empty or placeholder-only values", () => {
  for (const values of [
    [],
    [""],
    ["[玫瑰]", "[烟花]", "待报名", "空", "TBD", "待定"]
  ]) {
    assert.equal(selectLastRealRelayValue(values), "待定");
  }
});

test("relay value selection trims surrounding whitespace", () => {
  assert.equal(
    selectLastRealRelayValue(["  Ada Lovelace  "]),
    "Ada Lovelace"
  );
});

test("normalized relay formula tokenizes known labels in a bounded range", () => {
  const formula = normalizedRelayFormula();
  for (const functionName of ["LET", "SUBSTITUTE", "REDUCE", "LAMBDA"]) {
    assert.match(formula, new RegExp(`${functionName}\\(`));
  }
  assert.match(formula, /"：",":"/);
  assert.match(formula, /CHAR\(13\)/);
  assert.match(formula, /CHAR\(10\)/);
  assert.match(
    formula,
    /flat,TRIM\(SUBSTITUTE\(SUBSTITUTE\(raw,CHAR\(13\)," "\),CHAR\(10\)," "\)\)/
  );
  assert.match(formula, /colon,SUBSTITUTE\(flat,"：",":"\)/);
  assert.match(formula, /tight,SUBSTITUTE\(SUBSTITUTE\(colon," :",":"\),": ",":"\)/);
  assert.ok(formula.indexOf("flat,TRIM(") < formula.indexOf("tight,SUBSTITUTE("));
  assert.match(formula, /REDUCE\(tight,labels/);
  assert.match(formula, /\$A\$5:\$A\$28/);
  assert.doesNotMatch(formula, /\$[A-Z]+:\$[A-Z]+/);
});

test("relay value formula chooses the last real value over placeholders", () => {
  const formula = relayValueFormula("A5", "$B$2");
  for (const functionName of [
    "TEXTSPLIT",
    "TOCOL",
    "FILTER",
    "TEXTBEFORE",
    "TEXTAFTER",
    "XMATCH",
    "TAKE",
    "IFERROR"
  ]) {
    assert.match(formula, new RegExp(`${functionName}\\(`));
  }
  assert.match(formula, /parts,TOCOL\(TEXTSPLIT\(\$B\$2,"\|"\),1\)/);
  assert.match(formula, /\{"\[玫瑰\]","\[烟花\]","待报名","空","TBD","待定"\}/);
  assert.match(formula, /IFERROR\(TAKE\(real,-1\),"待定"\)/);
  assert.equal((formula.match(/TAKE\(real,-1\)/g) || []).length, 1);
  assert.doesNotMatch(formula, /\$[A-Z]+:\$[A-Z]+/);
});

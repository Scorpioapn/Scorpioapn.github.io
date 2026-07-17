import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

import {
  COLORS,
  FIRST_PAGE_ITEMS,
  MAX_ITEMS,
  RELAY_LABELS,
  SHEETS,
  buildRelayAgendaRows,
  loadDefaultMeetingData,
  loadTemplateRows,
  normalizedRelayFormula,
  relayValueFormula,
  selectLastRealRelayValue
} from "../scripts/excel-agenda/workbook-spec.mjs";

const require = createRequire(import.meta.url);
const AgendaSchema = require("../js/agenda-schema.js");

test("workbook builder creates every sheet before exporting to the agreed path", async () => {
  const buildSource = await fs.readFile(
    new URL("../scripts/excel-agenda/build.mjs", import.meta.url),
    "utf8"
  );

  assert.match(buildSource, /for \(const name of SHEETS\)/);
  assert.match(buildSource, /workbook\.worksheets\.add\(name\)/);
  assert.match(
    buildSource,
    /function applyBand\(sheet, address, text, \{ fill, size \}\)/
  );
  assert.doesNotMatch(buildSource, /function apply(?:Title|Section)Band/);
  assert.equal((buildSource.match(/applyReservedBase\(/g) || []).length, 2);
  assert.match(buildSource, /SpreadsheetFile\.exportXlsx/);
  assert.match(
    buildSource,
    /outputs\/agenda-excel-20260717\/畅言议程生成器-无宏版\.xlsx/
  );
  assert.ok(
    buildSource.includes(
      "await fs.rm(`${outputPath}.inspect.ndjson`, { force: true });"
    )
  );
});

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
  for (const functionName of ["LET", "SUBSTITUTE"]) {
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
  for (const label of RELAY_LABELS) assert.ok(formula.includes(`"${label}:"`));
  assert.match(formula, /tokens,SUBSTITUTE\(/);
  assert.doesNotMatch(formula, /REDUCE|LAMBDA/);
  assert.doesNotMatch(formula, /\$[A-Z]+:\$[A-Z]+/);
});

test("relay value formula chooses the last real value over placeholders", () => {
  const formula = relayValueFormula("A5", "$B$2");
  for (const functionName of ["LET", "SUBSTITUTE", "TEXTBEFORE", "TEXTAFTER"]) {
    assert.match(formula, new RegExp(`${functionName}\\(`));
  }
  assert.match(formula, /token,\$B\$2&"\|"/);
  assert.match(formula, /key,"\|"&A5&":"/);
  for (const placeholder of ["[玫瑰]", "[烟花]", "待报名", "空", "TBD", "待定"]) {
    assert.ok(formula.includes(`key&"${placeholder}"&"|"`));
  }
  assert.match(formula, /TEXTAFTER\(clean,key,-1/);
  assert.match(formula, /value,IFERROR\(TRIM\(TEXTBEFORE/);
  assert.match(formula, /IF\(value="","待定",value\)/);
  assert.doesNotMatch(formula, /TEXTSPLIT|TOCOL|FILTER|XMATCH|TAKE/);
  assert.doesNotMatch(formula, /\$[A-Z]+:\$[A-Z]+/);
});

test("workbook seed contains current club assets and two templates", async () => {
  const rows = loadTemplateRows();
  assert.deepEqual([...new Set(rows.map((row) => row.templateName))], [
    "常规例会模板",
    "即兴马拉松模板"
  ]);

  for (const asset of [
    "assets/toastmasters-logo-color-png.png",
    "assets/quhuo-qr.png",
    "assets/join-consult-qr.png",
    "assets/vote-qr.png"
  ]) {
    const stat = await fs.stat(new URL(`../${asset}`, import.meta.url));
    assert.ok(stat.isFile(), `missing workbook asset: ${asset}`);
    assert.ok(stat.size > 0, `empty workbook asset: ${asset}`);
  }
});

test("builder seeds template library, base data, and four embedded images", async () => {
  const source = await fs.readFile(
    new URL("../scripts/excel-agenda/build.mjs", import.meta.url),
    "utf8"
  );

  assert.match(source, /function writeTemplateLibrary\(/);
  assert.match(source, /AgendaTemplatesTable/);
  assert.match(source, /function writeBaseData\(/);
  assert.match(source, /BaseInfoTable/);
  assert.match(loadDefaultMeetingData().officers, /President会长：贾燕微/);
  assert.match(source, /toastmasters-logo-color-png\.png/);
  assert.match(source, /mime = "image\/jpeg"/);
  const baseDataSource = source.slice(
    source.indexOf("async function writeBaseData("),
    source.indexOf("function writeCalculationSheet(")
  );
  assert.equal((baseDataSource.match(/await addImage\(/g) || []).length, 4);
});

test("operation dashboard defines source, template, relay, preview, and warning areas", async () => {
  const source = await fs.readFile(
    new URL("../scripts/excel-agenda/build.mjs", import.meta.url),
    "utf8"
  );

  for (const address of ["B4", "F4", "B18:J26", "L18:P26", "B30:P32"]) {
    assert.ok(source.includes(address), `missing dashboard range: ${address}`);
  }
  for (const sourceName of ["接龙导入", "议程模板", "手工编辑"]) {
    assert.ok(source.includes(sourceName), `missing agenda source: ${sourceName}`);
  }
  assert.match(source, /dataValidation/);
  assert.match(source, /SORT\(UNIQUE\(FILTER/);
  assert.match(source, /formula1: "\$Q\$2:\$Q\$64"/);
  assert.match(source, /TEMPLATE_LIBRARY_MAX_ROW = 1000/);
  assert.match(source, /未识别内容：完整原文保留在左侧/);
  assert.match(source, /comments\.setSelf/);
  assert.match(source, /comments\.addThread/);
});

test("builder writes bounded formula-driven relay parsing and preview", async () => {
  const source = await fs.readFile(
    new URL("../scripts/excel-agenda/build.mjs", import.meta.url),
    "utf8"
  );

  assert.match(source, /function writeCalculationSheet\(/);
  assert.match(source, /A5:A28/);
  assert.match(source, /B5:B28/);
  assert.match(source, /F5:N25/);
  assert.match(source, /TEXTBEFORE/);
  assert.match(source, /TIME\(--TEXTBEFORE/);
  assert.match(source, /YEAR\(TODAY\(\)\)/);
  assert.match(source, /解析角色数/);
});

test("agenda formulas keep override precedence and numeric scheduling", async () => {
  const source = await fs.readFile(
    new URL("../scripts/excel-agenda/build.mjs", import.meta.url),
    "utf8"
  );

  assert.match(source, /AgendaEditTable/);
  assert.match(source, /LET\(v,IFERROR\(INDEX\(FILTER/);
  assert.match(source, /IF\(OR\(v="",v=0\),"",v\)/);
  assert.match(source, /修正标题/);
  assert.match(source, /修正排程分钟/);
  assert.match(source, /1440/);
  assert.match(source, /超过单页容量/);
  assert.match(source, /超过60项/);
  assert.match(source, /待定/);
});

test("A4 builder reserves first and overflow presentation sheets", async () => {
  const source = await fs.readFile(
    new URL("../scripts/excel-agenda/build.mjs", import.meta.url),
    "utf8"
  );

  assert.match(source, /function writeA4Page\(/);
  assert.match(source, /A4议程/);
  assert.match(source, /A4续页/);
  assert.match(source, /rowBlue/);
  assert.match(source, /rowGreen/);
  assert.match(source, /rowGray/);
  assert.match(source, /FIRST_PAGE_ITEMS/);
  assert.match(source, /续页 · 仅在议程超过30项时打印/);
});

test("verifier inspects formulas, errors, sheets, and renders every sheet", async () => {
  const source = await fs.readFile(
    new URL("../scripts/excel-agenda/verify.mjs", import.meta.url),
    "utf8"
  );

  assert.match(source, /#REF!/);
  assert.match(source, /#SPILL!/);
  assert.match(source, /workbook\.render/);
  assert.match(source, /for \(const sheetName of SHEETS\)/);
});

test("native Excel finalizer normalizes formulas and enforces print metadata", async () => {
  const source = await fs.readFile(
    new URL("../scripts/excel-agenda/finalize-excel.vbs", import.meta.url),
    "utf8"
  );
  const verifier = await fs.readFile(
    new URL("../scripts/excel-agenda/verify-excel-native.vbs", import.meta.url),
    "utf8"
  );

  assert.match(source, /cell\.Formula2 = formulaText/);
  assert.match(source, /VarType\(cell\.Value\) = 10/);
  assert.match(source, /PaperSize = xlPaperA4/);
  assert.match(source, /FitToPagesWide = 1/);
  assert.match(source, /ExportAsFixedFormat/);
  assert.match(source, /calculation\.Visible = xlSheetHidden/);
  assert.match(source, /sheet\.Protect "", False, True, True/);
  assert.match(verifier, /formula errors after native save/);
  assert.match(verifier, /pageSetup\.PrintArea <> "\$A\$1:\$P\$48"/);
  assert.match(verifier, /calculation\.ProtectContents/);
  assert.match(verifier, /ProtectDrawingObjects/);
});

test("native scenario verifier exercises relay, templates, corrections, and overflow", async () => {
  const source = await fs.readFile(
    new URL("../scripts/excel-agenda/verify-excel-scenarios.vbs", import.meta.url),
    "utf8"
  );

  for (const expected of [
    "接龙导入",
    "即兴马拉松模板",
    "修正标题验收",
    "超过单页容量",
    "手工项目 31",
    "备稿演讲1:Alice",
    "QA扩展模板"
  ]) {
    assert.ok(source.includes(expected));
  }
  assert.match(source, /relayItems=21/);
  assert.match(source, /regularTemplateItems=27/);
  assert.match(source, /impromptuTemplateItems=19/);
  assert.match(source, /dynamicTemplateItems=1/);
  assert.match(source, /manualOverflowItems=31/);
  assert.match(source, /FormulaErrorCount\(\)/);
});

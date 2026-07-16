# Macro-Free Excel Agenda Workbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, formula-driven Microsoft 365 `.xlsx` agenda generator that reuses the current Toastmasters templates and assets, parses WeChat relay text, schedules agenda items, and produces an A4 layout close to the current HTML design without macros.

**Architecture:** A focused JavaScript builder uses `@oai/artifact-tool` to create one workbook with editable source sheets, formula-backed calculation sheets, and two presentation sheets for the first A4 page and overflow page. Pure workbook metadata, seed conversion, and formula builders live in a testable module; the builder performs structured writes and formatting, while a separate verifier imports, inspects, and renders the result. The existing HTML application remains unchanged and supplies the authoritative template data and image assets.

**Tech Stack:** Microsoft 365 formulas, Excel tables/data validation/conditional formatting, JavaScript ES modules, Node.js built-in test runner, `@oai/artifact-tool` 2.8.6+, native Excel desktop print settings.

---

## File Map

- Create: `scripts/excel-agenda/workbook-spec.mjs` — workbook constants, source conversion, relay mapping, and formula builders.
- Create: `scripts/excel-agenda/build.mjs` — creates, formats, populates, and exports the workbook.
- Create: `scripts/excel-agenda/verify.mjs` — imports the generated workbook, inspects key ranges, scans formula errors, and renders every sheet.
- Create: `tests/excel_agenda_workbook.test.mjs` — pure unit and static structure tests.
- Create: `docs/excel-agenda-usage.md` — concise end-user instructions for the no-macro workbook.
- Create: `outputs/agenda-excel-20260717/畅言议程生成器-无宏版.xlsx` — final workbook artifact.
- Modify: `.gitignore` — ignore the local bundled dependency junction and rendered QA previews.
- Read only: `js/agenda-templates.js`, `js/agenda-relay-importer.js`, `assets/*.png`.

## Runtime Convention

Use the bundled workspace runtime returned by `codex_app__load_workspace_dependencies`. In this session:

```text
Node: C:\Users\77075\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
Packages: C:\Users\77075\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules
```

Create a local junction at `scripts/excel-agenda/node_modules` pointing to the bundled packages. Never install or add an npm dependency.

### Task 1: Define the workbook model and formula contract

**Files:**
- Create: `scripts/excel-agenda/workbook-spec.mjs`
- Create: `tests/excel_agenda_workbook.test.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Add failing model tests**

Create `tests/excel_agenda_workbook.test.mjs` with these initial assertions:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIRST_PAGE_ITEMS,
  MAX_ITEMS,
  SHEETS,
  buildRelayAgendaRows,
  loadTemplateRows,
  relayValueFormula
} from "../scripts/excel-agenda/workbook-spec.mjs";

test("workbook exposes the agreed sheet order and page capacities", () => {
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

test("current templates flatten into stable section and item rows", () => {
  const rows = loadTemplateRows();
  assert.ok(rows.some((row) => row.templateId === "regular-meeting"));
  assert.ok(rows.some((row) => row.templateId === "impromptu-marathon"));
  assert.equal(rows.filter((row) => row.templateId === "regular-meeting" && row.kind === "section").length, 5);
});

test("relay agenda maps three officers to declarations and reports", () => {
  const rows = buildRelayAgendaRows();
  for (const role of ["时间官", "语法官", "哼哈官"]) {
    assert.ok(rows.some((row) => row.title === `${role}宣言` && row.roleKey === role));
    assert.ok(rows.some((row) => row.title === `${role}报告` && row.roleKey === role));
  }
});

test("relay value formula prefers the last real name over placeholders", () => {
  const formula = relayValueFormula("A5", "$B$2");
  assert.match(formula, /TEXTSPLIT/);
  assert.match(formula, /TAKE\(real,-1\)/);
  assert.match(formula, /待定/);
  assert.match(formula, /\[玫瑰\]/);
});
```

- [ ] **Step 2: Run the model test and verify the expected failure**

Run:

```powershell
node --test tests/excel_agenda_workbook.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/excel-agenda/workbook-spec.mjs`.

- [ ] **Step 3: Implement the model, constants, and formula builders**

Create `scripts/excel-agenda/workbook-spec.mjs` with these public exports and stable row shapes:

```js
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const templates = require("../../js/agenda-templates.js");
const agendaSchema = require("../../js/agenda-schema.js");

export const SHEETS = ["操作台", "议程编辑", "A4议程", "A4续页", "模板库", "基础资料", "计算区"];
export const FIRST_PAGE_ITEMS = 30;
export const MAX_ITEMS = 60;

export const COLORS = Object.freeze({
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


function stripSectionOrdinal(title) {
  return String(title || "").replace(/^[一二三四五六七八九十]+、\s*/, "").trim();
}

export function loadTemplateRows() {
  const rows = [];
  for (const meta of templates.listTemplates()) {
    const skeleton = templates.getTemplateSkeleton(meta.id);
    let sectionNo = 0;
    let sectionName = "";
    let order = 0;
    for (const item of skeleton.items) {
      order += 1;
      if (item.kind === "section") {
        sectionNo += 1;
        sectionName = stripSectionOrdinal(item.title);
      }
      rows.push({
        templateId: meta.id,
        templateName: meta.name,
        order,
        id: item.id,
        kind: item.kind,
        sectionNo,
        sectionName,
        title: item.kind === "section" ? sectionName : String(item.title || ""),
        detail: String(item.detail || ""),
        durationText: String(item.duration || ""),
        scheduleMinutes: item.kind === "section" ? 0 : agendaSchema.parseDurationToMinutes(item.duration, 0),
        person: String(item.person || ""),
        rowType: /即兴/.test(item.title) ? "impromptu" : /备稿|演讲/.test(item.title) ? "prepared" : /茶歇|大合照/.test(item.title) ? "break" : "plain"
      });
    }
  }
  return rows;
}

export function buildRelayAgendaRows() {
  const row = (id, sectionNo, sectionName, title, durationText, scheduleMinutes, roleKey = "", rowType = "plain") => ({
    id, kind: "item", sectionNo, sectionName, title, detail: "", durationText, scheduleMinutes, roleKey, person: "", rowType
  });
  return [
    row("relay-officer-open", 1, "开场环节", "事务官开场", "1", 1, "事务官开场"),
    row("relay-president", 1, "开场环节", "主席致辞", "3", 3, "主席致辞"),
    row("relay-host", 1, "开场环节", "总主持开场，介绍会议流程", "3", 3, "总主持"),
    row("relay-guests", 1, "开场环节", "来宾介绍", "5", 5, "来宾介绍"),
    row("relay-timer-declare", 1, "开场环节", "时间官宣言", "2", 2, "时间官"),
    row("relay-grammar-declare", 1, "开场环节", "语法官宣言", "2", 2, "语法官"),
    row("relay-ah-declare", 1, "开场环节", "哼哈官宣言", "2", 2, "哼哈官"),
    row("relay-impromptu", 2, "即兴演讲", "即兴演讲", "15 / 2min/人", 15, "即兴主持", "impromptu"),
    row("relay-speech-1", 3, "精心演讲环节", "备稿演讲1", "5-7", 7, "备稿演讲1", "prepared"),
    row("relay-speech-2", 3, "精心演讲环节", "备稿演讲2", "5-7", 7, "备稿演讲2", "prepared"),
    row("relay-speech-3", 3, "精心演讲环节", "备稿演讲3", "5-7", 7, "备稿演讲3", "prepared"),
    row("relay-break", 4, "茶歇&会议反馈环节", "茶歇+大合照", "5", 5, "拍照侠", "break"),
    row("relay-impromptu-eval", 4, "茶歇&会议反馈环节", "即兴点评", "5", 5, "即兴点评", "impromptu"),
    row("relay-eval-1", 4, "茶歇&会议反馈环节", "备稿点评1", "3", 3, "备稿点评1", "prepared"),
    row("relay-eval-2", 4, "茶歇&会议反馈环节", "备稿点评2", "3", 3, "备稿点评2", "prepared"),
    row("relay-eval-3", 4, "茶歇&会议反馈环节", "备稿点评3", "3", 3, "备稿点评3", "prepared"),
    row("relay-grammar-report", 4, "茶歇&会议反馈环节", "语法官报告", "3", 3, "语法官"),
    row("relay-ah-report", 4, "茶歇&会议反馈环节", "哼哈官报告", "3", 3, "哼哈官"),
    row("relay-timer-report", 4, "茶歇&会议反馈环节", "时间官报告", "3", 3, "时间官"),
    row("relay-general-eval", 4, "茶歇&会议反馈环节", "总点评", "8", 8, "总点评"),
    row("relay-award", 5, "分享环节", "颁奖&真情分享", "5", 5, "颁奖&真情分享", "prepared")
  ];
}

export const RELAY_LABELS = [
  "主题", "今日一词", "例会经理", "时间", "地点", "事务官开场", "主席致辞", "总主持", "来宾介绍",
  "时间官", "哼哈官", "语法官", "提问官", "即兴主持", "备稿演讲1", "备稿演讲2", "备稿演讲3",
  "即兴点评", "备稿点评1", "备稿点评2", "备稿点评3", "总点评", "颁奖&真情分享", "拍照侠"
];

export function normalizedRelayFormula(rawCell = "'操作台'!$B$18") {
  return `=LET(raw,${rawCell},colon,SUBSTITUTE(raw,"：",":"),flat,TRIM(SUBSTITUTE(SUBSTITUTE(colon,CHAR(13)," "),CHAR(10)," ")),labels,$A$5:$A$28,TRIM(REDUCE(flat,labels,LAMBDA(acc,label,SUBSTITUTE(acc,label&":","|"&label&":")))))`;
}

export function relayValueFormula(labelCell, tokenizedCell = "$B$2") {
  return `=LET(parts,TEXTSPLIT(${tokenizedCell},"|"),hits,FILTER(parts,TEXTBEFORE(parts,":")=${labelCell},""),vals,TRIM(TEXTAFTER(hits,":")),real,FILTER(vals,(vals<>"")*ISNA(XMATCH(UPPER(vals),{"[玫瑰]","[烟花]","待报名","空","TBD"}))),IFERROR(TAKE(real,-1),"待定"))`;
}
```

Add these ignore entries:

```gitignore
scripts/excel-agenda/node_modules/
outputs/agenda-excel-20260717/qa/
```

- [ ] **Step 4: Run the model test and verify it passes**

Run:

```powershell
node --test tests/excel_agenda_workbook.test.mjs
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit the model contract**

```powershell
git add .gitignore scripts/excel-agenda/workbook-spec.mjs tests/excel_agenda_workbook.test.mjs
git commit -m "feat: define Excel agenda workbook model"
```

### Task 2: Create the workbook shell and reusable styling helpers

**Files:**
- Create: `scripts/excel-agenda/build.mjs`
- Modify: `tests/excel_agenda_workbook.test.mjs`

- [ ] **Step 1: Add a failing source-structure test**

Append:

```js
import fs from "node:fs";

test("builder creates all sheets before cross-sheet formulas", () => {
  const source = fs.readFileSync(new URL("../scripts/excel-agenda/build.mjs", import.meta.url), "utf8");
  assert.match(source, /for \(const name of SHEETS\)/);
  assert.match(source, /workbook\.worksheets\.add\(name\)/);
  assert.match(source, /SpreadsheetFile\.exportXlsx/);
});
```

- [ ] **Step 2: Run the targeted test and confirm failure**

Run:

```powershell
node --test tests/excel_agenda_workbook.test.mjs
```

Expected: FAIL because `scripts/excel-agenda/build.mjs` does not exist.

- [ ] **Step 3: Create the builder shell**

Create `scripts/excel-agenda/build.mjs` with a workbook-first flow:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import { COLORS, SHEETS } from "./workbook-spec.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const outputDir = path.join(repoRoot, "outputs", "agenda-excel-20260717");
const outputPath = path.join(outputDir, "畅言议程生成器-无宏版.xlsx");

const workbook = Workbook.create();
for (const name of SHEETS) workbook.worksheets.add(name);

function titleBand(sheet, rangeAddress, title) {
  const range = sheet.getRange(rangeAddress);
  range.merge();
  range.values = [[title]];
  range.format = {
    fill: COLORS.blue,
    font: { name: "Microsoft YaHei", size: 16, bold: true, color: "#FFFFFF" },
    verticalAlignment: "center",
    horizontalAlignment: "left"
  };
}

function sectionBand(sheet, rangeAddress, title) {
  const range = sheet.getRange(rangeAddress);
  range.merge();
  range.values = [[title]];
  range.format = {
    fill: COLORS.maroon,
    font: { name: "Microsoft YaHei", size: 11, bold: true, color: "#FFFFFF" },
    verticalAlignment: "center"
  };
}

for (const name of SHEETS) {
  const sheet = workbook.worksheets.getItem(name);
  sheet.showGridLines = false;
  sheet.getRange("A1:P80").format.font = { name: "Microsoft YaHei", size: 10, color: COLORS.ink };
}

titleBand(workbook.worksheets.getItem("操作台"), "A1:P2", "畅言议程生成器 · 操作台");
sectionBand(workbook.worksheets.getItem("议程编辑"), "A1:O2", "议程编辑与手工修正");

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
```

- [ ] **Step 4: Link the bundled runtime and export the shell workbook**

Run from the repository root:

```powershell
$runtime = 'C:\Users\77075\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$link = 'scripts\excel-agenda\node_modules'
if (-not (Test-Path $link)) { New-Item -ItemType Junction -Path $link -Target $runtime | Out-Null }
& 'C:\Users\77075\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\excel-agenda\build.mjs
```

Expected: `outputs/agenda-excel-20260717/畅言议程生成器-无宏版.xlsx` exists and is non-empty.

- [ ] **Step 5: Run tests and commit**

```powershell
node --test tests/excel_agenda_workbook.test.mjs
git add scripts/excel-agenda/build.mjs tests/excel_agenda_workbook.test.mjs
git commit -m "feat: scaffold Excel agenda workbook"
```

### Task 3: Populate templates, base information, and embedded assets

**Files:**
- Modify: `scripts/excel-agenda/build.mjs`
- Modify: `tests/excel_agenda_workbook.test.mjs`

- [ ] **Step 1: Add failing tests for source data coverage**

Append:

```js
test("workbook seed contains current club assets and two templates", () => {
  const rows = loadTemplateRows();
  assert.deepEqual([...new Set(rows.map((row) => row.templateName))], ["常规例会模板", "即兴马拉松模板"]);
  const requiredAssets = [
    "assets/toastmasters-logo-color-png.png",
    "assets/quhuo-qr.png",
    "assets/join-consult-qr.png",
    "assets/vote-qr.png"
  ];
  for (const asset of requiredAssets) assert.ok(fs.existsSync(new URL(`../${asset}`, import.meta.url)));
});
```

- [ ] **Step 2: Run the targeted tests**

Run `node --test tests/excel_agenda_workbook.test.mjs`.

Expected: PASS for template conversion and asset presence before workbook population.

- [ ] **Step 3: Write template and base-data sheets in blocks**

Add imports for `loadTemplateRows`, `buildRelayAgendaRows`, and `RELAY_LABELS`, then add builder functions with these ranges:

```js
function writeTemplateLibrary(sheet) {
  const headers = [["模板ID", "模板名称", "顺序", "项目键", "类型", "分组编号", "分组名称", "标题", "说明", "时长显示", "排程分钟", "默认负责人", "行类型"]];
  const rows = loadTemplateRows().map((row) => [
    row.templateId, row.templateName, row.order, row.id, row.kind, row.sectionNo, row.sectionName,
    row.title, row.detail, row.durationText, row.scheduleMinutes, row.person, row.rowType
  ]);
  sheet.getRange(`A1:M${rows.length + 1}`).values = [...headers, ...rows];
  const table = sheet.tables.add(`A1:M${rows.length + 1}`, true, "AgendaTemplatesTable");
  table.style = "TableStyleMedium2";
  sheet.freezePanes.freezeRows(1);
}

function writeBaseData(sheet) {
  sheet.getRange("A1:B14").values = [
    ["字段", "内容"],
    ["中文会名", "畅言中文国际演讲会"],
    ["英文会名", "Charm Voice Mandarin Toastmasters Club"],
    ["俱乐部介绍", "畅言中文国际演讲俱乐部，成立于2009年，是南山第一家中文俱乐部。隶属于第118大区、D中区、D2小区。"],
    ["愿景", "打造全球最具人格魅力的演讲俱乐部。"],
    ["会议频率", "每周日晚"],
    ["President会长", "贾燕微"],
    ["VPE 教育副会长", "莫婷"],
    ["VPM 会员副会长", "Jessica"],
    ["VPPR 公关副会长", "史迪仔"],
    ["Secretary 秘书", "女侠"],
    ["Treasurer 财务", "聪聪"],
    ["Sergeant at Arms 接待官", "Venus Deng斯敏"],
    ["会议守则", "手机请调至静音｜请留意时间官提示｜欢迎鼓掌、反馈与投票｜入会咨询请联系会员副会长"]
  ];
  sheet.tables.add("A1:B14", true, "BaseInfoTable").style = "TableStyleMedium2";
}
```

Use `sheet.images.add` to embed all four PNG files. Convert each file to a data URL with:

```js
async function imageDataUrl(filePath) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  const bytes = await fs.readFile(filePath);
  return `data:image/${extension};base64,${bytes.toString("base64")}`;
}
```

- [ ] **Step 4: Rebuild and inspect source ranges**

Run the builder, then use the verifier introduced in Task 8 or a temporary import script to inspect `模板库!A1:M12` and `基础资料!A1:B14`.

Expected: both template names appear, officer names match the approved team, and four image drawings exist.

- [ ] **Step 5: Commit**

```powershell
git add scripts/excel-agenda/build.mjs tests/excel_agenda_workbook.test.mjs
git commit -m "feat: seed Excel templates and club data"
```

### Task 4: Build the operation dashboard and editable controls

**Files:**
- Modify: `scripts/excel-agenda/build.mjs`
- Modify: `tests/excel_agenda_workbook.test.mjs`

- [ ] **Step 1: Add a failing source test for controls**

Append:

```js
test("operation dashboard defines source, template, relay, and warning areas", () => {
  const source = fs.readFileSync(new URL("../scripts/excel-agenda/build.mjs", import.meta.url), "utf8");
  for (const address of ["B4", "F4", "B18:J26", "L18:P26", "B30:P32"]) assert.ok(source.includes(address));
  assert.match(source, /接龙导入/);
  assert.match(source, /议程模板/);
  assert.match(source, /手工编辑/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run `node --test tests/excel_agenda_workbook.test.mjs`.

Expected: FAIL because the builder does not yet contain the agreed operation ranges.

- [ ] **Step 3: Implement the operation dashboard**

Use these stable cells:

```text
B4: 议程来源
F4: 模板选择
B7: 期数
F7: 主题
J7: 今日一词
N7: 例会经理
B10: 日期
F10: 开始时间
J10: 结束时间
B13:P14: 地点
B18:J26: 接龙粘贴区（合并）
L18:P26: 解析预览摘要
B30:P32: 警告横幅
```

Apply data validation:

```js
sheet.getRange("B4").dataValidation = {
  rule: { type: "list", values: ["接龙导入", "议程模板", "手工编辑"] }
};
sheet.getRange("F4").dataValidation = {
  rule: { type: "list", values: ["常规例会模板", "即兴马拉松模板"] }
};
```

Set editable cells to `#FFF8E8`, 38 px row height where appropriate, thin `#C4CFD8` borders, and input labels in `COLORS.ink2`. Add threaded comments after calling:

```js
workbook.comments.setSelf({ displayName: "User" });
workbook.comments.addThread({ cell: sheet.getRange("B18") }, "粘贴完整微信接龙文字。仅当议程来源选择“接龙导入”时，A4议程才采用解析结果。");
```

- [ ] **Step 4: Rebuild and render the operation dashboard**

Render `操作台!A1:P34` at scale 1.5. Verify labels are not clipped, editable regions are obvious, and the relay area can display wrapped text.

- [ ] **Step 5: Commit**

```powershell
git add scripts/excel-agenda/build.mjs tests/excel_agenda_workbook.test.mjs
git commit -m "feat: add Excel agenda operation dashboard"
```

### Task 5: Implement formula-driven relay parsing and mapping

**Files:**
- Modify: `scripts/excel-agenda/build.mjs`
- Modify: `scripts/excel-agenda/workbook-spec.mjs`
- Modify: `tests/excel_agenda_workbook.test.mjs`

- [ ] **Step 1: Add failing formula contract tests**

Append:

```js
import { normalizedRelayFormula, RELAY_LABELS } from "../scripts/excel-agenda/workbook-spec.mjs";

test("relay formulas normalize colons and tokenize every supported role", () => {
  assert.equal(RELAY_LABELS.length, 24);
  const formula = normalizedRelayFormula();
  assert.match(formula, /SUBSTITUTE\(raw,"：",":"\)/);
  assert.match(formula, /REDUCE/);
  assert.match(formula, /LAMBDA/);
});
```

- [ ] **Step 2: Run tests and confirm the new count or formula assertion fails if the implementation drifted**

Run `node --test tests/excel_agenda_workbook.test.mjs`.

Expected: the complete formula contract passes before worksheet integration; any mismatch is fixed in `workbook-spec.mjs` first.

- [ ] **Step 3: Populate the calculation sheet parser**

Use this calculation layout:

```text
A5:A28  supported labels
B2      normalized and tokenized relay text
B5:B28  merged label values, last real value wins
D2      meeting number
D3      theme
D4      word of day
D5      manager
D6      meeting date
D7      start time
D8      end time
D9      location
F5:N25  relay agenda mapping
```

Write labels and formulas:

```js
calculation.getRange("A5:A28").values = RELAY_LABELS.map((label) => [label]);
calculation.getRange("B2").formulas = [[normalizedRelayFormula()]];
calculation.getRange("B5").formulas = [[relayValueFormula("A5", "$B$2")]];
calculation.getRange("B5:B28").fillDown();
calculation.getRange("D2").formulas = [["=IFERROR(TEXTBEFORE(TEXTAFTER($B$2,\"畅言\",-1),\"期报名帖\"),\"\")"]];
calculation.getRange("D3").formulas = [["=XLOOKUP(\"主题\",$A$5:$A$28,$B$5:$B$28,\"\")"]];
calculation.getRange("D4").formulas = [["=XLOOKUP(\"今日一词\",$A$5:$A$28,$B$5:$B$28,\"\")"]];
calculation.getRange("D5").formulas = [["=XLOOKUP(\"例会经理\",$A$5:$A$28,$B$5:$B$28,\"\")"]];
calculation.getRange("D9").formulas = [["=XLOOKUP(\"地点\",$A$5:$A$28,$B$5:$B$28,\"\")"]];
```

Parse the date and times from the `时间` value with separate helper cells. Store the date as a real Excel date and times as time fractions. If the source has no year, use `YEAR(TODAY())`:

```js
calculation.getRange("C2").formulas = [["=XLOOKUP(\"时间\",$A$5:$A$28,$B$5:$B$28,\"\")"]];
calculation.getRange("D6").formulas = [[`=LET(v,$C$2,dateText,TRIM(TEXTBEFORE(v," ")),y,IF(ISNUMBER(SEARCH("年",dateText)),--TEXTBEFORE(dateText,"年"),YEAR(TODAY())),md,IF(ISNUMBER(SEARCH("年",dateText)),TEXTAFTER(dateText,"年"),dateText),m,--TEXTBEFORE(md,"月"),d,--TEXTBEFORE(TEXTAFTER(md,"月"),"日"),IFERROR(DATE(y,m,d),""))`]];
calculation.getRange("D7").formulas = [[`=LET(v,$C$2,clock,TRIM(TEXTAFTER(v," ",-1)),span,SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(clock,"–","-"),"—","-"),"至","-"),IFERROR(TIMEVALUE(TEXTBEFORE(span,"-")),""))`]];
calculation.getRange("D8").formulas = [[`=LET(v,$C$2,clock,TRIM(TEXTAFTER(v," ",-1)),span,SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(clock,"–","-"),"—","-"),"至","-"),IFERROR(TIMEVALUE(TEXTAFTER(span,"-",-1)),""))`]];
calculation.getRange("D6").format.numberFormat = "yyyy-mm-dd";
calculation.getRange("D7:D8").format.numberFormat = "hh:mm";
```

Calculate the warning with:

```excel
=IF(AND(D6<>"",TODAY()-D6>180),"接龙日期距离当前日期较久，请确认年份是否正确。","")
```

Write `buildRelayAgendaRows()` into `F5:N25`. The person formula for each row must use its `roleKey` to look up `A5:B28`; rows with an empty or placeholder result display `待定`.

- [ ] **Step 4: Connect parsed fields to the dashboard preview**

Set `操作台!L18:P26` formulas to show meeting number, theme, word of day, date/time, location, parsed role count, generated item count, and date warning. Keep the current meeting fields unchanged until `操作台!B4` equals `接龙导入`.

- [ ] **Step 5: Rebuild, inspect formulas, and commit**

Inspect `计算区!A1:N28` with values and formulas. Confirm formula anchors exist and no source range exceeds the designed bounds.

```powershell
git add scripts/excel-agenda/build.mjs scripts/excel-agenda/workbook-spec.mjs tests/excel_agenda_workbook.test.mjs
git commit -m "feat: add formula-driven relay parser"
```

### Task 6: Build unified agenda rows, overrides, scheduling, and warnings

**Files:**
- Modify: `scripts/excel-agenda/build.mjs`
- Modify: `tests/excel_agenda_workbook.test.mjs`

- [ ] **Step 1: Add failing tests for scheduling and override semantics**

Append source assertions:

```js
test("agenda formulas keep override precedence and numeric scheduling", () => {
  const source = fs.readFileSync(new URL("../scripts/excel-agenda/build.mjs", import.meta.url), "utf8");
  assert.match(source, /修正标题/);
  assert.match(source, /修正排程分钟/);
  assert.match(source, /1440/);
  assert.match(source, /超过单页容量/);
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run `node --test tests/excel_agenda_workbook.test.mjs`.

Expected: FAIL until edit and warning formulas are present.

- [ ] **Step 3: Create a 60-row agenda edit table**

Use columns `A:Q` and rows `4:63`. Template section rows stay in `模板库` only; after their number and name have been propagated to following items, filter them out so `议程编辑` contains 60 actual agenda-item slots:

```text
A 序号
B 项目键
C 分组编号
D 分组名称
E 类型
F 自动开始时间
G 来源标题
H 来源说明
I 来源时长
J 来源排程分钟
K 来源负责人
L 修正标题
M 修正说明
N 修正时长
O 修正排程分钟
P 修正负责人
Q 状态
```

Create `AgendaEditTable`, make `L:P` editable with warm fill, and use formulas in source columns to select one of:

```excel
=IF('操作台'!$B$4="议程模板", template_result,
 IF('操作台'!$B$4="接龙导入", relay_result, manual_result))
```

Final display formulas use non-empty overrides:

```excel
=IF([@[修正标题]]<>"",[@[修正标题]],[@[来源标题]])
=IF([@[修正负责人]]<>"",[@[修正负责人]],IF([@[来源负责人]]="","待定",[@[来源负责人]]))
```

- [ ] **Step 4: Add schedule and status formulas**

The first nonblank item starts at the selected meeting start time. Every later nonblank item uses the prior row's start time plus prior final schedule minutes divided by 1440. Blank rows contribute zero minutes; section titles are represented by the group columns and do not occupy agenda rows.

```excel
=IF(B4="","",IF(A4=1,MeetingStart,F3+FinalMinutesPrevious/1440))
```

Add dashboard warnings for:

- more than 30 non-section items: `议程超过单页容量，将使用A4续页。`
- more than 60 items: `议程超过60项，请精简后再打印。`
- blank or nonnumeric schedule minutes in a non-section row.
- projected end time later than the selected meeting end time, including the number of overtime minutes.
- any final person equal to `待定`.

- [ ] **Step 5: Rebuild, inspect, and commit**

Inspect `议程编辑!A1:Q15` and trace one start-time cell to the selected meeting start and previous schedule minutes.

```powershell
git add scripts/excel-agenda/build.mjs tests/excel_agenda_workbook.test.mjs
git commit -m "feat: add Excel agenda overrides and scheduling"
```

### Task 7: Recreate the Toastmasters A4 visual layout

**Files:**
- Modify: `scripts/excel-agenda/build.mjs`
- Modify: `tests/excel_agenda_workbook.test.mjs`

- [ ] **Step 1: Add a failing presentation structure test**

Append:

```js
test("A4 builder reserves first and overflow presentation sheets", () => {
  const source = fs.readFileSync(new URL("../scripts/excel-agenda/build.mjs", import.meta.url), "utf8");
  assert.match(source, /A4议程/);
  assert.match(source, /A4续页/);
  assert.match(source, /rowBlue/);
  assert.match(source, /rowGreen/);
  assert.match(source, /rowGray/);
  assert.match(source, /FIRST_PAGE_ITEMS/);
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run `node --test tests/excel_agenda_workbook.test.mjs`.

Expected: FAIL until the A4 builder uses the agreed constants and row colors.

- [ ] **Step 3: Build the first A4 page**

Use `A:P` with a conservative physical footprint that fits both A4 and Letter at 100%:

```text
A1:P6   deep-blue meeting header
A7:E42  left information cards
F7:P42  meeting agenda table
A44:P48 bottom cards and meeting wish
```

Recommended column widths in pixels:

```js
const widths = [28, 54, 54, 54, 42, 22, 66, 50, 54, 44, 116, 116, 68, 56, 58, 58];
widths.forEach((width, index) => sheet.getRangeByIndexes(0, index, 48, 1).format.columnWidthPx = width);
```

Agenda row mapping:

```text
F  group number band
G:H group name band
I  start time
J:M title and detail
N  duration
O:P responsible person
```

Fill every group-band row with the same maroon or pale blue color and remove internal horizontal borders. Compute the label row as the rounded midpoint between the first and last occurrence of the group number, so only that row displays the number and name. This simulates a dynamic merged vertical band without merging editable rows.

Apply conditional formatting to `I8:P37`:

- row type `impromptu` → `COLORS.rowBlue`
- row type `prepared` → `COLORS.rowGreen`
- row type `break` → `COLORS.rowGray` plus a dark-blue left edge
- final person `待定` → amber text on `COLORS.warningBg`

Embed the Toastmasters logo and the two contact QR images. Use the vote QR in the bottom participation card.

- [ ] **Step 4: Build the continuation page**

Use the same header and agenda table style on `A4续页`, reading rows 31–60. Add a visible top note `续页 · 仅在议程超过30项时打印` and a formula status that displays `本页无超出项目` when no overflow exists.

- [ ] **Step 5: Render both pages and commit**

Render both sheets at scale 2 and inspect the PNGs with `view_image`. Fix clipping, overlapping images, weak contrast, broken borders, and text overflow before committing.

```powershell
git add scripts/excel-agenda/build.mjs tests/excel_agenda_workbook.test.mjs
git commit -m "feat: add Toastmasters A4 Excel layouts"
```

### Task 8: Add automated workbook verification and visual QA

**Files:**
- Create: `scripts/excel-agenda/verify.mjs`
- Modify: `tests/excel_agenda_workbook.test.mjs`

- [ ] **Step 1: Add a failing verifier source test**

Append:

```js
test("verifier inspects formulas, errors, sheets, and renders every sheet", () => {
  const source = fs.readFileSync(new URL("../scripts/excel-agenda/verify.mjs", import.meta.url), "utf8");
  assert.match(source, /#REF!/);
  assert.match(source, /#SPILL!/);
  assert.match(source, /workbook\.render/);
  assert.match(source, /for \(const sheetName of SHEETS\)/);
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run `node --test tests/excel_agenda_workbook.test.mjs`.

Expected: FAIL because `verify.mjs` does not exist.

- [ ] **Step 3: Create the verifier**

Create `scripts/excel-agenda/verify.mjs`:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { SHEETS } from "./workbook-spec.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const workbookPath = path.join(repoRoot, "outputs", "agenda-excel-20260717", "畅言议程生成器-无宏版.xlsx");
const qaDir = path.join(repoRoot, "outputs", "agenda-excel-20260717", "qa");

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table,drawing",
  maxChars: 10000,
  tableMaxRows: 4,
  tableMaxCols: 8
});
console.log(summary.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#SPILL!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan"
});
console.log(errors.ndjson);

await fs.mkdir(qaDir, { recursive: true });
for (const sheetName of SHEETS) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1.5, format: "png" });
  await fs.writeFile(path.join(qaDir, `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
}
```

- [ ] **Step 4: Run compact inspection and visual verification**

Run:

```powershell
& 'C:\Users\77075\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\excel-agenda\verify.mjs
```

Expected:

- seven sheet names are present in the expected order;
- template, agenda, and base-data tables exist;
- all four image drawings exist;
- no formula error token is found in calculated values;
- seven PNG previews are generated under the ignored QA directory.

Use `view_image` on all seven previews. Calculation and library sheets may be utilitarian, but no visible data may be clipped or unreadable.

- [ ] **Step 5: Commit**

```powershell
git add scripts/excel-agenda/verify.mjs tests/excel_agenda_workbook.test.mjs
git commit -m "test: verify generated Excel agenda workbook"
```

### Task 9: Finalize native Excel print settings and usage documentation

**Files:**
- Create: `docs/excel-agenda-usage.md`
- Modify: `outputs/agenda-excel-20260717/畅言议程生成器-无宏版.xlsx`

- [ ] **Step 1: Write concise user instructions**

Create `docs/excel-agenda-usage.md` with this exact workflow:

```markdown
# 畅言议程生成器 Excel 版使用说明

1. 在“操作台”选择议程来源：接龙导入、议程模板或手工编辑。
2. 接龙导入时，将完整接龙文字粘贴到黄色区域，先检查右侧解析预览，再把议程来源切换为“接龙导入”。
3. 模板模式下选择“常规例会模板”或“即兴马拉松模板”。
4. 在“议程编辑”的黄色修正列调整标题、说明、时长、排程分钟和负责人；清空修正值即可恢复自动结果。
5. 在“A4议程”检查第一页。议程超过30项时，再检查并打印“A4续页”。
6. Logo、二维码或海报需要更新时，在图片上使用 Excel 的“更改图片”。
7. 使用 Excel 桌面版的“文件 → 导出 → 创建 PDF/XPS”生成 PDF。

黄色单元格可以编辑。公式页和成品页不建议直接覆盖。
```

- [ ] **Step 2: Open the workbook in Microsoft Excel desktop**

For `A4议程` and `A4续页`, set:

```text
纸张：A4
方向：纵向
页边距：上/下/左/右 12 mm
打印区域：各页实际使用区域
缩放：1 页宽 × 1 页高
居中方式：水平居中
打印网格线：关闭
打印行列标题：关闭
```

Hide `计算区`; protect `计算区` and formula cells on `A4议程`、`A4续页` without a password, while leaving yellow input cells editable. Save as `.xlsx` and confirm Excel does not report macros or external links.

- [ ] **Step 3: Verify print preview**

Open print preview for both A4 sheets and confirm:

- first page is exactly one A4 page with no clipped header, footer, or QR code;
- text remains legible at normal print scale;
- overflow sheet is one A4 page;
- grayscale preview remains understandable through labels and borders;
- PDF text remains selectable after export.

- [ ] **Step 4: Commit documentation and the finalized workbook**

```powershell
git add docs/excel-agenda-usage.md outputs/agenda-excel-20260717/畅言议程生成器-无宏版.xlsx
git commit -m "feat: deliver macro-free Excel agenda workbook"
```

### Task 10: Run final regression and artifact checks

**Files:**
- Verify only; modify earlier files only when a failing check identifies a defect.

- [ ] **Step 1: Run all repository tests**

```powershell
npm test
```

Expected: all existing HTML/JS tests and the new Excel workbook tests pass. No current agenda, relay, template, guide, export, or cloud-sync test regresses.

- [ ] **Step 2: Rebuild from a clean output path**

Move the current workbook to a temporary backup inside `C:\tmp`, rerun `build.mjs`, and compare sheet names, used ranges, tables, formulas, and drawings with the finalized structure. Do not delete or overwrite unrelated workspace files.

Expected: the builder deterministically creates the same workbook structure before native Excel print metadata is applied.

- [ ] **Step 3: Run workbook verification and formula scan**

```powershell
& 'C:\Users\77075\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\excel-agenda\verify.mjs
git diff --check
```

Expected: no formula-error matches, all sheets render, and `git diff --check` reports no whitespace errors.

- [ ] **Step 4: Manually exercise the acceptance sample in Excel**

Paste the approved 779 relay example into `操作台`, choose `接龙导入`, and verify:

- meeting number, theme, word of day, manager, date, time, and location populate;
- placeholders display as `待定`;
- duplicate posts retain real names over placeholders;
- 时间官、语法官、哼哈官各 have a declaration in the opening section and a report in the feedback section;
- template switching and manual corrections still work after returning from relay mode;
- first page fits one A4 sheet for 30 or fewer agenda rows.

- [ ] **Step 5: Confirm final repository state**

```powershell
git status --short --branch
git log -8 --oneline
```

Expected: only intentional commits from this plan are present; `agenda-audit/` remains untouched and untracked unless it was already handled independently by the user.

## Final Deliverable

The user-facing artifact is:

```text
outputs/agenda-excel-20260717/畅言议程生成器-无宏版.xlsx
```

The final response must link only the `.xlsx` artifact as the standalone deliverable, summarize verification briefly, and state any limitation discovered in native Excel print or formula compatibility.

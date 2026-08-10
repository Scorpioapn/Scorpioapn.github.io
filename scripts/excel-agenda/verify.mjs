import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

import { SHEETS } from "./workbook-spec.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const workbookPath = path.join(
  repoRoot,
  "outputs",
  "agenda-excel-20260717",
  "畅言议程生成器-无宏版.xlsx"
);
const qaDir = path.join(repoRoot, "outputs", "agenda-excel-20260717", "qa");

const renderRanges = Object.freeze({
  操作台: "A1:P34",
  议程编辑: "A1:R63",
  A4议程: "A1:P48",
  A4续页: "A1:P48",
  模板库: "A1:M57",
  基础资料: "A1:K20",
  计算区: "A1:N28"
});

function collectFormulaErrors(values, sheetName) {
  const formulaError = /#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A|#SPILL!/;
  const matches = [];
  for (let row = 0; row < values.length; row += 1) {
    for (let column = 0; column < (values[row] || []).length; column += 1) {
      const value = values[row][column];
      if (typeof value === "string" && formulaError.test(value)) {
        matches.push({ sheetName, row: row + 1, column: column + 1, value });
      }
    }
  }
  return matches;
}

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const actualSheetOrder = SHEETS.map(
  (_, index) => workbook.worksheets.getItemAt(index).name
);
assert.deepEqual(actualSheetOrder, SHEETS, "worksheet order drifted");

for (const sheetName of SHEETS) workbook.worksheets.getItem(sheetName);

const expectedTables = new Map([
  ["模板库", ["AgendaTemplatesTable"]],
  ["基础资料", ["BaseInfoTable"]],
  ["议程编辑", ["AgendaEditTable"]]
]);
for (const [sheetName, names] of expectedTables) {
  const actualNames = workbook.worksheets
    .getItem(sheetName)
    .tables.items.map((table) => table.name);
  assert.deepEqual(actualNames, names, `${sheetName} table contract drifted`);
}

assert.equal(
  workbook.worksheets.getItem("基础资料").images.items.length,
  4,
  "基础资料 must contain the four replaceable source images"
);
for (const sheetName of ["A4议程", "A4续页"]) {
  assert.equal(
    workbook.worksheets.getItem(sheetName).images.items.length,
    4,
    `${sheetName} must contain logo, two contact QR images, and vote QR`
  );
}

const calculation = workbook.worksheets.getItem("计算区");
const meetingValues = calculation.getRange("E2:E9").values.flat();
assert.equal(String(meetingValues[0]), "779", "relay meeting number did not parse");
assert.equal(meetingValues[1], "志愿者", "relay theme did not parse");
assert.equal(meetingValues[2], "服务", "relay word of day did not parse");
assert.equal(meetingValues[3], "莫婷", "relay manager did not parse");
assert.ok(
  meetingValues[4] instanceof Date ||
    typeof meetingValues[4] === "number" ||
    /^\d{4}-\d{2}-\d{2}T/.test(String(meetingValues[4])),
  "relay date is not a typed date value"
);
const isTypedTime = (value) =>
  typeof value === "number" ||
  value instanceof Date ||
  /^1899-12-30T\d{2}:\d{2}:\d{2}/.test(String(value));
assert.ok(isTypedTime(meetingValues[5]), "relay start time is not a typed time");
assert.ok(isTypedTime(meetingValues[6]), "relay end time is not a typed time");
assert.equal(
  meetingValues[7],
  "深圳南山•讯美科技3号楼4楼Space Max会议室",
  "relay location did not parse"
);

const roleValues = calculation.getRange("B5:B28").values.flat();
const roleByLabel = Object.fromEntries(
  calculation
    .getRange("A5:A28")
    .values.flat()
    .map((label, index) => [label, roleValues[index]])
);
assert.equal(roleByLabel["时间官"], "May");
assert.equal(roleByLabel["语法官"], "莫婷");
assert.equal(roleByLabel["哼哈官"], "Jessica");
assert.equal(roleByLabel["备稿演讲3"], "待定");

const agenda = workbook.worksheets.getItem("议程编辑");
const sourceIds = agenda.getRange("B4:B63").values.flat().filter(Boolean);
assert.ok(sourceIds.length > 0, "selected template produced no agenda rows");
assert.ok(sourceIds.length <= 60, "agenda exceeded the 60-row workbook contract");
assert.ok(
  agenda.getRange("F4:F63").values.flat().some(isTypedTime),
  "agenda scheduling produced no typed start times"
);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table,drawing",
  maxChars: 10000,
  tableMaxRows: 4,
  tableMaxCols: 8
});
console.log(summary.ndjson);

for (const [sheetName, range] of [
  ["操作台", "A1:P34"],
  ["议程编辑", "A1:R15"],
  ["计算区", "A1:N28"]
]) {
  const inspection = await workbook.inspect({
    kind: "table",
    sheetId: sheetName,
    range,
    include: "values,formulas",
    tableMaxRows: 28,
    tableMaxCols: 18,
    maxChars: 8000
  });
  console.log(inspection.ndjson);
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#SPILL!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan"
});
console.log(errors.ndjson);

const formulaErrors = [];
for (const sheetName of SHEETS) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const usedRange = sheet.getUsedRange();
  formulaErrors.push(...collectFormulaErrors(usedRange.values, sheetName));
}
assert.deepEqual(formulaErrors, [], `formula errors found: ${JSON.stringify(formulaErrors)}`);

await fs.mkdir(qaDir, { recursive: true });
for (const sheetName of SHEETS) {
  const preview = await workbook.render({
    sheetName,
    range: renderRanges[sheetName],
    scale: sheetName.startsWith("A4") ? 2 : 1.25,
    format: "png"
  });
  await fs.writeFile(
    path.join(qaDir, `${sheetName}.png`),
    new Uint8Array(await preview.arrayBuffer())
  );
}

console.log(
  JSON.stringify(
    {
      workbookPath,
      sheetOrder: actualSheetOrder,
      sourceItems: sourceIds.length,
      formulaErrors: formulaErrors.length,
      previews: SHEETS.length
    },
    null,
    2
  )
);

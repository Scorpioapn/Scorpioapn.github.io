import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

import { COLORS, SHEETS } from "./workbook-spec.mjs";

const BASE_FONT = "Microsoft YaHei";
const OUTPUT_RELATIVE_PATH = "outputs/agenda-excel-20260717/畅言议程生成器-无宏版.xlsx";
const SHELL_LABELS = ["A4议程", "A4续页", "模板库", "基础资料", "计算区"];

function applyReservedBase(sheet, address, { bold = false, size = 10 } = {}) {
  const range = sheet.getRange(address);
  range.format = {
    font: {
      name: BASE_FONT,
      size,
      color: COLORS.ink,
      bold
    }
  };
  return range;
}

function applyBand(sheet, address, text, { fill, size }) {
  const range = sheet.getRange(address);
  range.merge();
  range.values = [[text]];
  range.format = {
    fill,
    font: {
      name: BASE_FONT,
      size,
      color: COLORS.surface,
      bold: true
    },
    horizontalAlignment: "left",
    verticalAlignment: "center"
  };
}

function addShellLabel(sheet, text) {
  applyReservedBase(sheet, "A1:D1", { bold: true, size: 12 });
  sheet.getRange("A1").values = [[text]];
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const outputPath = path.resolve(repoRoot, OUTPUT_RELATIVE_PATH);

const workbook = Workbook.create();
const sheets = new Map();

for (const name of SHEETS) {
  const sheet = workbook.worksheets.add(name);
  sheets.set(name, sheet);
}

for (const sheet of sheets.values()) {
  sheet.showGridLines = false;
}

applyBand(sheets.get("操作台"), "A1:P2", "畅言议程生成器 · 操作台", {
  fill: COLORS.blueDeep,
  size: 18
});
applyBand(sheets.get("议程编辑"), "A1:Q2", "议程编辑与手工修正", {
  fill: COLORS.maroon,
  size: 15
});

for (const name of SHELL_LABELS) {
  addShellLabel(sheets.get(name), name);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
await fs.rm(`${outputPath}.inspect.ndjson`, { force: true });

console.log(outputPath);

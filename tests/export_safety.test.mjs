import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

test("CSV cells neutralize spreadsheet formulas", () => {
  const { escapeCsvCell } = require(path.join(root, "js", "export-safety.js"));

  for (const value of ["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "\t=1", "\r=1", "\n=1", "  =1"]) {
    const escaped = escapeCsvCell(value);
    assert.match(escaped, /^"'/, value);
  }
});

test("CSV cells remain quoted and escape embedded quotes", () => {
  const { escapeCsvCell } = require(path.join(root, "js", "export-safety.js"));

  assert.equal(escapeCsvCell("Ada \"Ace\""), '"Ada ""Ace"""');
  assert.equal(escapeCsvCell("ordinary text"), '"ordinary text"');
  assert.equal(escapeCsvCell(null), '""');
});

test("live timekeeper routes every exported cell through the safety helper", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

  assert.match(html, /<script src="js\/export-safety\.js"><\/script>/);
  assert.match(html, /const ExportSafety = window\.TMExportSafety;/);
  assert.match(html, /row\.map\(ExportSafety\.escapeCsvCell\)/);
});

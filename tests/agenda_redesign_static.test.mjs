import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../agenda_generator_modern.html", import.meta.url), "utf8");

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = Array.from(source.matchAll(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "g")));
  assert.ok(matches.length, `${selector} CSS rule should exist`);
  return matches.at(-1)[1];
}

function cssRuleContaining(selector, marker) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = Array.from(source.matchAll(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "g")));
  const match = matches.find((entry) => entry[1].includes(marker));
  assert.ok(match, `${selector} CSS rule should contain ${marker}`);
  return match[1];
}

function functionBlock(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} function should exist`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} should close`);
}

function atRuleBlock(name) {
  const start = source.indexOf(name);
  assert.notEqual(start, -1, `${name} at-rule should exist`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} should close`);
}

test("redesign tokens replace the old warm material palette", () => {
  for (const token of [
    "--tm-blue:#004165",
    "--tm-blue-deep:#00334F",
    "--tm-maroon:#772432",
    "--tm-yellow:#F2DF74",
    "--bg:#F2F4F6",
    "--surface:#FFFFFF",
    "--border:#DFE5EA",
    "--ink:#16232E",
    "--font-ui:\"NotoSansSC\",\"PingFangSC\",\"MicrosoftYaHei\",system-ui,sans-serif"
  ]) {
    assert.ok(source.replace(/\s+/g, "").includes(token), `root should include ${token}`);
  }

  assert.doesNotMatch(source, /--md-/, "legacy --md-* tokens should be removed");
  assert.doesNotMatch(cssRule(".app-shell"), /radial-gradient|linear-gradient/, "app shell should use a flat background");
});

test("paper layout uses the compact A4 spec without the redundant row legend", () => {
  const sheet = source;
  const renderPreview = functionBlock("renderPreview");

  assert.match(sheet, /--template-sidebar-width:\s*232px;/, "print sidebar should use the redesigned narrow width");
  assert.match(sheet, /width:\s*210mm;/, "screen artboard should model A4 width directly");
  assert.match(sheet, /height:\s*297mm;/, "screen artboard should model A4 height directly");
  assert.match(source, /\.template-header\s*\{[\s\S]*?background:\s*var\(--surface\);[\s\S]*?border-bottom:\s*2\.5px solid var\(--tm-blue\);/, "paper header should be white with a blue rule");
  assert.match(renderPreview, /class="timing-legend-table"/, "timing rules should render as one legend table");
  assert.match(renderPreview, /≤3 分[\s\S]*?3–10 分[\s\S]*?＞10 分/, "timing table should expose all duration columns");
  assert.doesNotMatch(renderPreview, /class="flow-row-legend"/, "flow table should not spend A4 height on the row color legend");
  assert.equal(sheet.includes("--flow-td-font: 12px"), true, "standard density should use the 12px body tier");
});

test("paper header scales its identity into the available whitespace", () => {
  assert.match(cssRuleContaining(".template-sheet", "--template-sidebar-width: 232px"), /--template-header-min:\s*76px;/, "paper header should use a modestly taller identity row");
  assert.match(cssRuleContaining(".template-header", "grid-template-columns: 78px"), /grid-template-columns:\s*78px minmax\(0,\s*1fr\) 182px;/, "header columns should make room for the larger logo and metadata");
  assert.match(cssRule(".tm-logo-print"), /width:\s*72px;[\s\S]*?height:\s*58px;/, "print logo should use the available header space");
  assert.match(cssRule(".template-title-block h2"), /font-size:\s*24px;/, "club name should lead the header more confidently");
  assert.match(cssRule(".template-theme-line"), /font-size:\s*12\.5px;/, "theme metadata should remain readable under the larger title");
  assert.match(cssRule(".template-meta-stack"), /font-size:\s*13px;/, "date and issue metadata should balance the title block");
});

test("primary PDF and print actions use vector browser print while image PDF remains secondary", () => {
  const exportAgendaPdf = functionBlock("exportAgendaPdf");
  const printAgenda = functionBlock("printAgenda");
  const bindEvents = functionBlock("bindEvents");

  assert.match(source, /id="previewDensitySelect"/, "preview toolbar should expose density selection");
  assert.match(source, /id="previewFitStatus"/, "preview toolbar should expose persistent page-fit status");
  assert.match(source, /id="previewMoreBtn"/, "copy text and image PDF should move into a toolbar overflow menu");
  assert.match(source, /id="exportImagePdfBtn"/, "image PDF should remain available as a secondary action");
  assert.match(exportAgendaPdf, /printAgenda\(\)/, "main PDF export should delegate to the print path");
  assert.match(printAgenda, /window\.print\(\)/, "print path should call window.print for selectable text");
  assert.match(printAgenda, /document\.title\s*=/, "print path should set a meaningful default PDF filename title");
  assert.match(bindEvents, /exportImagePdfBtn[\s\S]*?exportImageAgendaPdf/, "overflow image PDF action should use the retained raster exporter");
});

test("browser PDF print isolates exactly one fixed A4 sheet", () => {
  const pageRules = Array.from(source.matchAll(/@page\s*\{([\s\S]*?)\}/g));
  const printMediaRules = Array.from(source.matchAll(/@media print\s*\{/g));
  const printCss = atRuleBlock("@media print");
  const printSheetRule = printCss.match(/\.preview-frame \.template-sheet\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";

  assert.equal(pageRules.length, 1, "one authoritative @page rule should control PDF pagination");
  assert.match(pageRules[0][1], /size:\s*A4 portrait;[\s\S]*?margin:\s*0;/, "browser PDF should use a borderless A4 canvas");
  assert.equal(printMediaRules.length, 1, "duplicate print media blocks must not override the fixed A4 model");
  assert.match(printCss, /\.workflow-header,[\s\S]*?\.settings-drawer-scrim\s*\{\s*display:\s*none !important;/, "browser chrome and drawers should be absent from the PDF");
  assert.match(printCss, /\.preview-frame\s*\{[\s\S]*?width:\s*210mm !important;[\s\S]*?height:\s*297mm !important;[\s\S]*?margin:\s*0 !important;[\s\S]*?overflow:\s*hidden !important;/, "print frame should occupy exactly one physical A4 page despite later screen rules");
  assert.match(printCss, /\.preview-frame \.template-sheet\s*\{[\s\S]*?width:\s*980px !important;[\s\S]*?height:\s*1386px !important;[\s\S]*?transform:\s*scale\(0\.8099\) !important;/, "print sheet should retain the fixed artboard scale that fits A4");
  assert.doesNotMatch(printSheetRule, /height:\s*auto !important|transform:\s*none !important|min-height:\s*calc\(297mm - 24mm\)/, "print rules must not expand or unscale the sheet");
});

test("editor chrome, settings drawer, and mobile taskbar match the redesign shell", () => {
  const mobileCssStart = source.indexOf("@media (max-width: 620px)");
  assert.notEqual(mobileCssStart, -1, "mobile media query should exist");
  const mobileCss = source.slice(mobileCssStart);

  assert.match(source, /\.workflow-header\s*\{[\s\S]*?min-height:\s*64px;/, "global workflow header should use the compact 64px desktop rhythm");
  assert.doesNotMatch(source, /TOASTMASTERS AGENDA BUILDER/, "old eyebrow should be removed");
  assert.match(source, /id="settingsDrawer"/, "fixed info, backup, and sync controls should live in a settings drawer");
  assert.match(source, /id="settingsToggleBtn"/, "top bar should expose a settings button");
  assert.match(source, /id="relayImportBtn"[\s\S]*?导入接龙/, "agenda panel should make relay import the primary action");
  assert.match(mobileCss, /\.mobile-taskbar\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/, "mobile taskbar should only expose information, agenda, and preview");
  assert.match(mobileCss, /\.toast\s*\{[\s\S]*?bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom\)\);[\s\S]*?z-index:\s*90;/, "mobile toast should sit above the fixed taskbar so undo remains tappable");
  assert.doesNotMatch(source, /data-mobile-nav="exportPanel"/, "export should no longer be a mobile bottom task");
});

test("template switcher renders redesigned summary cards", () => {
  const renderTemplates = functionBlock("renderTemplateOptions");

  assert.match(renderTemplates, /AgendaTemplates\.getTemplate/, "template cards should read full template data for summaries");
  assert.match(renderTemplates, /template-option-stats/, "template cards should show item count and total duration");
  assert.match(renderTemplates, /template-mini-timeline/, "template cards should show a first-four-item mini timeline");
  assert.match(renderTemplates, /只替换议程流程，不动会议信息与图片/, "template cards should explain the replacement scope");
  assert.match(cssRule(".template-option"), /border-radius:\s*var\(--r-md\);/, "template cards should use the redesigned radius scale");
});

test("agenda rows use compact inline-edit row anatomy", () => {
  const renderList = functionBlock("renderAgendaList");

  assert.match(renderList, /agenda-row-time/, "rows should expose a fixed time column");
  assert.match(renderList, /agenda-duration-pill/, "rows should expose a duration pill");
  assert.match(renderList, /agenda-person-pill/, "rows should expose a person pill");
  assert.match(renderList, /agenda-inline-editor/, "edited rows should contain the shared inline form mount");
  assert.match(source, /function mountAgendaForm/, "the existing agenda form should be moved into rows without changing field ids");
  assert.match(cssRule(".agenda-row"), /grid-template-columns:\s*28px 42px minmax\(0,\s*1fr\) auto auto auto;/, "row layout should match the requested six-part anatomy");
});

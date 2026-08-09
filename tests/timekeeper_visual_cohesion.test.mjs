import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cohesionMarker = "/* Timekeeper product cohesion layer */";

function cohesionCss() {
  const start = source.indexOf(cohesionMarker);
  assert.notEqual(start, -1, "timekeeper should include a final product cohesion layer");
  const end = source.indexOf("</style>", start);
  assert.notEqual(end, -1, "cohesion layer should stay inside the document style block");
  return source.slice(start, end);
}

test("timekeeper shares the agenda builder brand header and navigation", () => {
  assert.match(source, /<header class="product-header"/);
  assert.match(source, /src="assets\/toastmasters-logo-color-png\.png"/);
  assert.match(source, /<span class="product-name">畅言中文 · 时间官<\/span>/);
  assert.match(source, /href="agenda_generator_modern\.html"[^>]*>议程生成器<\/a>/);
  assert.match(source, /href="agenda_generator\.html"[^>]*>经典版式<\/a>/);
  assert.match(source, /<div class="rail-heading">[\s\S]*?现场议程/);
  assert.match(source, /<div class="mobile-brand-status">[\s\S]*?class="mobile-product-name">畅言中文 · 时间官/);
  assert.match(source, /id="mobileStatusPill"/, "mobile status binding should remain unchanged");
});

test("timekeeper uses the agenda visual tokens and desktop control-room layout", () => {
  const css = cohesionCss();

  assert.match(css, /--tm-blue:\s*#004165/);
  assert.match(css, /--tm-blue-deep:\s*#00334f/i);
  assert.match(css, /--tm-maroon:\s*#772432/);
  assert.match(css, /--workspace-bg:\s*#f2f4f6/i);
  assert.match(css, /--surface:\s*#ffffff/i);
  assert.match(css, /--border:\s*#dfe5ea/i);
  assert.match(css, /--font-ui:\s*"Noto Sans SC"/);
  assert.match(css, /--font-number:\s*"Oswald"/);
  assert.match(css, /--rail-width:\s*248px/);
  assert.match(css, /\.app-shell\s*\{[\s\S]*?grid-template-rows:\s*64px minmax\(0,\s*1fr\)/);
  assert.match(css, /\.product-header\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.agenda-rail\s*\{[\s\S]*?grid-row:\s*2/);
  assert.match(css, /\.timer-hero[\s\S]*?background:\s*var\(--surface\)[\s\S]*?border-radius:\s*var\(--radius-lg\)/);
  assert.match(css, /\.filled-button\s*\{[\s\S]*?background:\s*var\(--tm-blue\)/);
  assert.match(css, /\.icon-button,[\s\S]*?\.mini-button\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(css, /\.focus-card\.state-green\s*\{[\s\S]*?border-top-color:\s*var\(--signal-green\)/);
  assert.match(css, /\.focus-card\.state-yellow\s*\{[\s\S]*?border-top-color:\s*var\(--signal-yellow\)/);
  assert.match(css, /\.focus-card\.state-red,[\s\S]*?\.focus-card\.state-overtime\s*\{[\s\S]*?border-top-color:\s*var\(--signal-red\)/);
});

test("timekeeper keeps the existing mobile behavior inside the coordinated shell", () => {
  const css = cohesionCss();
  const mobileStart = css.indexOf("@media (max-width: 768px)");
  assert.notEqual(mobileStart, -1, "cohesion layer should include a mobile override");
  const mobileCss = css.slice(mobileStart);

  assert.match(mobileCss, /\.product-header,[\s\S]*?\.agenda-rail,[\s\S]*?\.story-progress\s*\{[\s\S]*?display:\s*none/);
  assert.match(mobileCss, /\.mobile-product-name\s*\{[\s\S]*?display:\s*block/);
  assert.match(mobileCss, /\.mobile-topbar\s*\{[\s\S]*?background:\s*var\(--surface\)/);
  assert.match(mobileCss, /\.app-shell\s*\{[\s\S]*?padding-bottom:\s*0/);
  assert.match(mobileCss, /\.content-grid\s*\{[\s\S]*?padding:\s*0 16px 16px/);
  assert.match(mobileCss, /\.timer-hero[\s\S]*?border-radius:\s*var\(--radius-lg\)/);
  assert.match(mobileCss, /\.floating-control-dock\s*\{[\s\S]*?bottom:\s*calc\([\s\S]*?width:\s*calc\(100% - 32px\)/);

  assert.match(source, /startBtn\.addEventListener\("click", handlePrimaryAction\)/);
  assert.match(source, /pauseBtn\.addEventListener\("click", pauseTimer\)/);
  assert.match(source, /resumeBtn\.addEventListener\("click", resumeTimer\)/);
  assert.match(source, /stopBtn\.addEventListener\("click", stopTimer\)/);
});

test("desktop agenda actions open the existing inspector instead of an off-screen mobile sheet", () => {
  const start = source.indexOf("function setMobileTab(tabName)");
  const end = source.indexOf("function closeMobileSheet()", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const setMobileTabSource = source.slice(start, end);

  assert.match(setMobileTabSource, /window\.matchMedia\("\(max-width: 768px\)"\)\.matches/);
  assert.match(setMobileTabSource, /if \(!isMobileViewport && state\.activeSheet\)/);
  assert.match(setMobileTabSource, /toggleInspector\(true\)/);
  assert.match(setMobileTabSource, /classList\.remove\("sheet-open"\)/);
});

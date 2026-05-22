import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function cssMediaBlock(query) {
  const start = source.indexOf(`@media (${query})`);
  assert.notEqual(start, -1, `${query} media query should exist`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`${query} media query should close`);
}

test("timekeeper keeps desktop app static and adds four mobile tabs", () => {
  const mobileCss = cssMediaBlock("max-width: 768px");

  assert.match(source, /<main class="main-shell">/, "existing app shell should remain a static HTML app");
  assert.match(source, /<script src="js\/storage\.js"><\/script>/, "timekeeper should load shared storage keys");
  assert.match(source, /<script src="js\/time-rules\.js"><\/script>/, "timekeeper should load shared time rule helpers");
  assert.match(source, /<script src="js\/agenda-schema\.js"><\/script>/, "timekeeper should load shared agenda schema");
  assert.match(source, /data-mobile-panel="timer"/, "timer panel should be marked for mobile tabs");
  assert.match(source, /data-mobile-panel="agenda"/, "agenda panel should be marked for mobile tabs");
  assert.match(source, /data-mobile-panel="context"/, "context panel should be marked for mobile tabs");
  assert.match(source, /data-mobile-panel="report"/, "report panel should be marked for mobile tabs");

  for (const tab of ["timer", "agenda", "context", "report"]) {
    assert.match(source, new RegExp(`data-mobile-tab="${tab}"`), `${tab} tab button should exist`);
  }

  for (const label of ["计时器", "议程", "上下文", "会议与报告"]) {
    assert.ok(source.includes(label), `mobile tab label should remain Chinese: ${label}`);
  }

  assert.match(mobileCss, /\.agenda-rail,\s*[\s\S]*?\.story-progress\s*\{[\s\S]*?display:\s*none;/, "mobile layout should remove the desktop rail/progress strip");
  assert.match(mobileCss, /\.mobile-tabbar\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*0;/, "mobile tab bar should be fixed to the bottom");
  assert.match(mobileCss, /\.toast\s*\{[\s\S]*?bottom:\s*calc\(94px \+ env\(safe-area-inset-bottom, 0px\)\);/, "mobile toast should sit above the bottom tab bar");
  assert.match(mobileCss, /\[data-mobile-panel\]\s*\{[\s\S]*?display:\s*none !important;/, "inactive mobile panels should be hidden");
  assert.match(mobileCss, /\.mobile-panel-active\s*\{[\s\S]*?display:\s*block !important;/, "active mobile panels should be shown");
  assert.match(mobileCss, /\.content-grid\s*\{[\s\S]*?padding:\s*0 16px;/, "mobile panels should use 16px side gutters");
});

test("timekeeper mobile controls preserve existing timer and agenda behavior", () => {
  assert.match(source, /function setMobileTab\(tabName\)/, "native tab switching helper should exist");
  assert.match(source, /querySelectorAll\("\[data-mobile-tab\]"\)[\s\S]*?setMobileTab\(button\.dataset\.mobileTab\)/, "tab buttons should switch panels without routing");
  assert.match(source, /startBtn\.addEventListener\("click", startTimer\)/, "start button should keep existing timer binding");
  assert.match(source, /pauseBtn\.addEventListener\("click", pauseTimer\)/, "pause button should keep existing timer binding");
  assert.match(source, /resumeBtn\.addEventListener\("click", resumeTimer\)/, "resume button should keep existing timer binding");
  assert.match(source, /stopBtn\.addEventListener\("click", stopTimer\)/, "stop and record button should keep existing timer binding");
  assert.match(source, /mobileFinishAgendaBtn\.addEventListener\("click", finishCurrentAgenda\)/, "mobile agenda tab should preserve finish current agenda behavior");
  assert.match(source, /agendaMinuteMinus\.addEventListener\("click", \(\) => adjustAgendaMinutes\(-1\)\)/, "mobile minute stepper should reduce minutes through existing input");
  assert.match(source, /agendaMinutePlus\.addEventListener\("click", \(\) => adjustAgendaMinutes\(1\)\)/, "mobile minute stepper should increase minutes through existing input");
  assert.match(source, /mobileExportReportBtn\.addEventListener\("click"[\s\S]*?openModal\(els\.reportModal\)/, "mobile export report should reuse the existing report modal");
  assert.match(source, /mobileShareReportBtn\.addEventListener\("click", copyReport\)/, "mobile share report should reuse existing copy report logic");
});

test("timekeeper preserves synced agenda context and exposes speaker input on timer", () => {
  assert.match(source, /id="speakerNameQuick"/, "timer card should expose a quick speaker input");
  assert.match(source, /function syncSpeakerInputs\(value/, "quick speaker input should share one sync helper with context input");
  assert.match(source, /speakerNameQuick\.addEventListener\("input"[\s\S]*?syncSpeakerInputs/, "quick speaker input should update the original speakerName field");
  assert.match(source, /speakerName\.addEventListener\("input"[\s\S]*?syncSpeakerInputs/, "original speakerName field should update the quick input");
  assert.match(source, /AgendaSchema\.normalizeTimekeeperAgendaItem/, "timekeeper should normalize agenda items through the shared schema");
  assert.match(source, /agendaContextMeta\.textContent = agendaContextMetaText\(item\)/, "smart context should display synced speaker/detail/scheduled time metadata");
  assert.match(source, /item\.scheduledTime \? `计划 \$\{item\.scheduledTime\}`/, "smart context should include scheduled time");
  assert.match(source, /speaker:\s*getSpeakerInputValue\(\) \|\| item\.speaker/, "records should fall back to the synced agenda speaker");
  assert.match(source, /title:\s*els\.speechTitle\.value\.trim\(\) \|\| item\.detail/, "records should fall back to the synced agenda detail");
  assert.match(source, /scheduledTime:\s*item\.scheduledTime \|\| ""/, "records should preserve synced scheduled time");
});

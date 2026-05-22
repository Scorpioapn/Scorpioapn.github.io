import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function cssMediaBlock(query) {
  const blocks = [];
  let searchFrom = 0;
  while (true) {
    const start = source.indexOf(`@media (${query})`, searchFrom);
    if (start === -1) break;
    const open = source.indexOf("{", start);
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) {
        blocks.push(source.slice(open + 1, index));
        searchFrom = index + 1;
        break;
      }
    }
  }
  assert.ok(blocks.length, `${query} media query should exist`);
  return blocks.join("\n");
}

test("timekeeper keeps desktop app static and adds Apple-style mobile sheets", () => {
  const mobileCss = cssMediaBlock("max-width: 768px");

  assert.match(source, /<main class="main-shell">/, "existing app shell should remain a static HTML app");
  assert.match(source, /<script src="js\/storage\.js"><\/script>/, "timekeeper should load shared storage keys");
  assert.match(source, /<script src="js\/time-rules\.js"><\/script>/, "timekeeper should load shared time rule helpers");
  assert.match(source, /<script src="js\/agenda-schema\.js"><\/script>/, "timekeeper should load shared agenda schema");
  assert.match(source, /--apple-bg:\s*#f5f5f7/, "Apple background token should exist");
  assert.match(source, /--apple-blue:\s*#007aff/, "Apple blue token should exist");
  assert.match(source, /class="focus-card timer-hero/, "timer hero should be the main surface");
  assert.match(source, /id="mobileMoreBtn"/, "mobile top bar should expose a More button");
  assert.match(source, /id="moreSheet"/, "More actions should live in an action sheet");
  assert.match(source, /id="sheetScrim"/, "mobile bottom sheet should have a scrim");
  assert.match(source, /id="agendaDetailModal"/, "agenda item details should open in a sheet/modal");
  assert.doesNotMatch(source, /data-mobile-tab="/, "mobile should no longer use four peer tabs");

  assert.match(mobileCss, /\.agenda-rail,\s*[\s\S]*?\.story-progress\s*\{[\s\S]*?display:\s*none;/, "mobile layout should remove the desktop rail/progress strip");
  assert.match(mobileCss, /\.mobile-tabbar\s*\{[\s\S]*?display:\s*none !important;/, "mobile tab bar should stay removed");
  assert.match(mobileCss, /\.floating-control-dock\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*calc/, "mobile controls should float near the thumb zone");
  assert.match(mobileCss, /\.side-panel\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?border-radius:\s*28px 28px 0 0;/, "mobile inspector panels should become a bottom sheet");
  assert.match(mobileCss, /\.app-shell\.sheet-open \.side-panel\s*\{[\s\S]*?transform:\s*translateY\(0\)/, "opening a sheet should slide it up");
  assert.match(mobileCss, /\.content-grid\s*\{[\s\S]*?padding:\s*0 16px;/, "mobile panels should use 16px side gutters");
  assert.match(source, /\.app-shell\.inspector-collapsed \.side-panel/, "desktop inspector should be collapsible by default");
});

test("timekeeper mobile controls preserve existing timer and agenda behavior", () => {
  assert.match(source, /function setMobileTab\(tabName\)/, "native tab switching helper should exist");
  assert.match(source, /querySelectorAll\("\.side-panel \[data-mobile-panel\]"\)[\s\S]*?mobile-panel-active/, "sheet switching should show one side panel without routing");
  assert.match(source, /function getSuggestedNextAction\(\)/, "dynamic primary action helper should exist");
  assert.match(source, /startBtn\.addEventListener\("click", handlePrimaryAction\)/, "main button should use the suggested next action");
  assert.match(source, /pauseBtn\.addEventListener\("click", pauseTimer\)/, "pause button should keep existing timer binding");
  assert.match(source, /resumeBtn\.addEventListener\("click", resumeTimer\)/, "resume button should keep existing timer binding");
  assert.match(source, /stopBtn\.addEventListener\("click", stopTimer\)/, "stop and record button should keep existing timer binding");
  assert.match(source, /resetBtn\.addEventListener\("click", requestResetTimer\)/, "reset should go through confirmation-aware reset");
  assert.match(source, /agendaSheetBtn\.addEventListener\("click", \(\) => setMobileTab\("agenda"\)\)/, "agenda button should open the bottom sheet");
  assert.match(source, /mobileFinishAgendaBtn\.addEventListener\("click", finishCurrentAgenda\)/, "mobile agenda tab should preserve finish current agenda behavior");
  assert.match(source, /agendaMinuteMinus\.addEventListener\("click", \(\) => adjustAgendaMinutes\(-1\)\)/, "mobile minute stepper should reduce minutes through existing input");
  assert.match(source, /agendaMinutePlus\.addEventListener\("click", \(\) => adjustAgendaMinutes\(1\)\)/, "mobile minute stepper should increase minutes through existing input");
  assert.match(source, /moreReportBtn\.addEventListener\("click"[\s\S]*?openModal\(els\.reportModal\)/, "More report action should reuse the existing report modal");
  assert.match(source, /mobileExportReportBtn\.addEventListener\("click"[\s\S]*?openModal\(els\.reportModal\)/, "mobile export report should reuse the existing report modal");
  assert.match(source, /mobileShareReportBtn\.addEventListener\("click", copyReport\)/, "mobile share report should reuse existing copy report logic");
});

test("timekeeper preserves synced agenda context and exposes speaker input on timer", () => {
  assert.match(source, /id="speakerNameQuick"/, "timer card should expose a quick speaker input");
  assert.match(source, /id="speakerNameQuick" placeholder="发言人姓名（可选）"/, "quick speaker input should use the requested placeholder");
  assert.match(source, /id="speechTitleQuick"/, "timer card should expose a quick speech title input");
  assert.match(source, /function syncSpeakerInputs\(value/, "quick speaker input should share one sync helper with context input");
  assert.match(source, /function syncSpeechTitleInputs\(value/, "quick speech title input should share one sync helper with context input");
  assert.match(source, /speakerNameQuick\.addEventListener\("input"[\s\S]*?syncSpeakerInputs/, "quick speaker input should update the original speakerName field");
  assert.match(source, /speakerName\.addEventListener\("input"[\s\S]*?syncSpeakerInputs/, "original speakerName field should update the quick input");
  assert.match(source, /speechTitleQuick\.addEventListener\("input"[\s\S]*?syncSpeechTitleInputs/, "quick speech title should update the original speechTitle field");
  assert.match(source, /AgendaSchema\.normalizeTimekeeperAgendaItem/, "timekeeper should normalize agenda items through the shared schema");
  assert.match(source, /agendaContextMeta\.textContent = agendaContextMetaText\(item\)/, "smart context should display synced speaker/detail/scheduled time metadata");
  assert.match(source, /item\.scheduledTime \? `计划 \$\{item\.scheduledTime\}`/, "smart context should include scheduled time");
  assert.match(source, /speaker:\s*getSpeakerInputValue\(\) \|\| item\.speaker/, "records should fall back to the synced agenda speaker");
  assert.match(source, /title:\s*getSpeechTitleInputValue\(\) \|\| item\.detail/, "records should fall back to the synced agenda detail");
  assert.match(source, /scheduledTime:\s*item\.scheduledTime \|\| ""/, "records should preserve synced scheduled time");
});

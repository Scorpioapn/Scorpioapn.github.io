import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../agenda_generator.html", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../js/storage.js", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../js/agenda-schema.js", import.meta.url), "utf8");
const templatesSource = readFileSync(new URL("../js/agenda-templates.js", import.meta.url), "utf8");
const schema = require("../js/agenda-schema.js");
const templates = require("../js/agenda-templates.js");

function sidebarTemplate() {
  const match = source.match(/<aside class="template-sidebar">([\s\S]*?)<\/aside>/);
  assert.ok(match, "renderPreview should contain the printable template sidebar");
  return match[1];
}

function footerTemplate() {
  const match = source.match(/<footer class="template-footer">([\s\S]*?)<\/footer>/);
  assert.ok(match, "renderPreview should contain the printable template footer");
  return match[1];
}

function fixedInfoDetails(summaryText) {
  const escaped = summaryText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`<details class="fixed-info">\\s*<summary>${escaped}</summary>([\\s\\S]*?)</details>`));
  assert.ok(match, `${summaryText} fixed-info details should exist`);
  return match[1];
}

function exportPanelTemplate() {
  const match = source.match(/<section class="surface-panel export-panel"[^>]*aria-labelledby="templateTitle"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(match, "export panel should use the optimized export-panel layout");
  return match[1];
}

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  assert.ok(match, `${selector} CSS rule should exist`);
  return match[1];
}

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

function functionSource(name) {
  const match = source.match(new RegExp(`function ${name}\\(.*?\\) \\{([\\s\\S]*?)\\n    \\}`));
  assert.ok(match, `${name} function should exist`);
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
  throw new Error(`${name} function block should close`);
}

function storageFake(values) {
  return {
    getItem(key) {
      return Object.hasOwn(values, key) ? JSON.stringify(values[key]) : null;
    }
  };
}

function buildDurationParser() {
  return schema.parseDurationToMinutes;
}

function buildAgendaNormalizer() {
  return new Function(`
    ${functionBlock("hasPerPersonDuration")}
    ${functionBlock("isLegacyImpromptuPair")}
    ${functionBlock("compactDetailLines")}
    ${functionBlock("normalizeAgendaItemFields")}
    ${functionBlock("mergeLegacyImpromptuPair")}
    ${functionBlock("normalizeAgendaItems")}
    return normalizeAgendaItems;
  `)();
}

function buildConflictChecker(storageValues) {
  const windowFake = {
    TMStorage: {
      readJson(key, fallback) {
        return Object.hasOwn(storageValues, key) ? storageValues[key] : fallback;
      }
    }
  };
  return new Function("localStorage", "window", "AgendaSchema", `
    const TIMEKEEPER_STORAGE_KEYS = {
      agenda: "tm_timekeeper_agenda_v2",
      meeting: "tm_timekeeper_meeting_v1",
      records: "tm_timekeeper_records_v1",
      syncMeta: "tm_timekeeper_agenda_sync_meta_v1"
    };
    const TIMEKEEPER_DEFAULT_AGENDA_SIGNATURE = ${JSON.stringify([
      { name: "事务官宣布会议规则", plannedMinutes: 1, durationLabel: "1 分钟" },
      { name: "主席致词", plannedMinutes: 3, durationLabel: "3 分钟" },
      { name: "总主持 / 串场", plannedMinutes: 3, durationLabel: "2-3 分钟" },
      { name: "三官宣言", plannedMinutes: 2, durationLabel: "2 分钟" },
      { name: "即兴演讲", plannedMinutes: 2, durationLabel: "2 分钟/人" },
      { name: "备稿演讲", plannedMinutes: 7, durationLabel: "5-7 分钟" },
      { name: "来宾介绍", plannedMinutes: 5, durationLabel: "5 分钟" },
      { name: "即兴点评", plannedMinutes: 5, durationLabel: "5 分钟" },
      { name: "备稿点评", plannedMinutes: 3, durationLabel: "3 分钟" },
      { name: "三官报告", plannedMinutes: 3, durationLabel: "3 分钟" },
      { name: "总点评", plannedMinutes: 8, durationLabel: "8 分钟" },
      { name: "颁奖 / 分享", plannedMinutes: 5, durationLabel: "5 分钟" }
    ])};
    ${functionBlock("readStorageJson")}
    ${functionBlock("comparableTimekeeperAgenda")}
    ${functionBlock("comparableTimekeeperMeeting")}
    ${functionBlock("isDefaultTimekeeperAgenda")}
    ${functionBlock("timekeeperHasSyncConflict")}
    return timekeeperHasSyncConflict();
  `)(storageFake(storageValues), windowFake, schema);
}

test("printable sidebar renders the requested information cards in order", () => {
  const sidebar = sidebarTemplate();
  const expectedOrder = ["关于我们", "提示信号与计时规则", "关注我们", "会员团队"];
  let previousIndex = -1;

  for (const label of expectedOrder) {
    const index = sidebar.indexOf(label);
    assert.ok(index > previousIndex, `${label} should appear after the previous sidebar card`);
    previousIndex = index;
  }

  assert.equal(sidebar.includes("如何加入我们"), false, "join information should not occupy a printable sidebar card");
  assert.equal(sidebar.includes("TM-Pathways"), false, "Pathways should not occupy printable sidebar space");
});

test("desktop editor header gives the brand title enough room", () => {
  const desktopHeaderCss = cssMediaBlock("min-width: 921px");

  assert.match(desktopHeaderCss, /\.brand-row\s*{[\s\S]*?grid-template-columns:\s*50px minmax\(190px,\s*1fr\);/, "desktop header should reserve a real title column instead of squeezing it beside action buttons");
  assert.match(desktopHeaderCss, /\.header-actions\s*{[\s\S]*?grid-column:\s*2;/, "desktop header actions should wrap below the title column");
  assert.match(desktopHeaderCss, /\.brand-copy\s*{[\s\S]*?min-width:\s*190px;/, "desktop brand copy should keep the Chinese title from fragmenting into narrow lines");
});


test("default member team roster matches the 2026-2027 club officers", () => {
  const defaultData = templates.getDefaultData();
  const loadDataSource = functionBlock("loadData");

  assert.match(source, /const DEFAULT_OFFICERS\s*=\s*AgendaTemplates\.DEFAULT_OFFICERS/, "agenda page should read the shared updated officer roster from templates");
  assert.ok(templatesSource.includes("LEGACY_DEFAULT_OFFICERS"), "old saved default roster should remain available for migration");
  assert.match(loadDataSource, /LEGACY_DEFAULT_OFFICERS\.includes\(merged\.officers\)/, "saved data using a previous default roster should migrate to the current officer team");
  for (const text of [
    "President会长：贾燕微",
    "VPE 教育副会长：莫婷",
    "VPM 会员副会长：Jessica",
    "VPPR 公关副会长：史迪仔",
    "Secretary 秘书：女侠",
    "Treasurer 财务：聪聪",
    "Sergeant at Arms 接待官：Venus Deng斯敏"
  ]) {
    assert.ok(defaultData.officers.includes(text), `updated default roster should include: ${text}`);
  }
});

test("member team preview preserves bilingual officer role labels", () => {
  const labelsMatch = source.match(/const OFFICER_ROLE_LABELS = \[([\s\S]*?)\];/);
  assert.ok(labelsMatch, "officer role label list should exist");
  const parseOfficerEntries = new Function(`
    const OFFICER_ROLE_LABELS = [${labelsMatch[1]}];
    const OFFICER_ROLE_PATTERN = OFFICER_ROLE_LABELS.join("|");
    ${functionBlock("parseOfficerEntries")}
    return parseOfficerEntries;
  `)();
  const entries = parseOfficerEntries(templates.getDefaultData().officers);

  assert.deepEqual(entries.map((entry) => entry.role), [
    "President会长",
    "VPE 教育副会长",
    "VPM 会员副会长",
    "VPPR 公关副会长",
    "Secretary 秘书",
    "Treasurer 财务",
    "Sergeant at Arms 接待官"
  ]);
});

test("member team preview compacts the longest officer role for the narrow sidebar", () => {
  const compactOfficerRole = new Function(`
    ${functionBlock("compactOfficerRole")}
    return compactOfficerRole;
  `)();
  const officerGridHtmlSource = functionBlock("officerGridHtml");

  assert.equal(compactOfficerRole("Sergeant at Arms 接待官"), "SAA 接待官");
  assert.equal(compactOfficerRole("VPE 教育副会长"), "VPE 教育副会长");
  assert.match(officerGridHtmlSource, /compactOfficerRole\(entry\.role\)/, "printable team card should use the compact role label");
});

test("regular meeting template uses the supplied 782 agenda JSON as the default", () => {
  const defaultData = templates.getDefaultData();

  assert.equal(defaultData.meetingNo, "782");
  assert.equal(defaultData.theme, "复盘：我过的怎么样");
  assert.equal(defaultData.wordOfDay, "看见");
  assert.equal(defaultData.date, "2026-06-30");
  assert.equal(defaultData.startTime, "19:20");
  assert.equal(defaultData.endTime, "21:30");
  assert.equal(defaultData.manager, "斯敏");
  assert.equal(defaultData.posterDesigner, "Jessica");
  assert.equal(defaultData.nextTheme, "人生暂停5分钟");
  assert.equal(defaultData.nextMeetingDate, "2026-07-07");
  assert.ok(defaultData.items.some((item) => item.title === "茶歇+大合照"), "supplied default agenda should include the feedback break");
  assert.ok(defaultData.items.some((item) => item.title === "主席总结本期活动，结束会议"), "supplied default agenda should keep the closing item");
});

test("agenda duration suggestions cover every individual officer declaration and report", () => {
  const match = source.match(/const DEFAULT_MATCHES = \[([\s\S]*?)\];\n\n    const AGENDA_GUIDE_STEPS/);
  assert.ok(match, "duration suggestion table should exist");
  const suggestions = match[1];

  for (const title of ["时间官宣言", "语法官宣言", "哼哈官宣言", "时间官报告", "语法官报告", "哼哈官报告"]) {
    assert.ok(suggestions.includes(`"${title}"`), `duration suggestions should include ${title}`);
  }
});

test("follow-us card uses default QR assets with upload override support", () => {
  const sidebar = sidebarTemplate();

  assert.ok(sidebar.includes("关注我们"), "QR sidebar card should use the shorter title");
  assert.equal(sidebar.includes("拍照关注我们"), false, "QR sidebar card should not use the old longer title");
  assert.ok(existsSync(new URL("../assets/quhuo-qr.png", import.meta.url)), "default 取火 QR asset should exist");
  assert.ok(existsSync(new URL("../assets/join-consult-qr.png", import.meta.url)), "default 入会咨询 QR asset should exist");
  assert.ok(existsSync(new URL("../assets/vote-qr.png", import.meta.url)), "default 现场投票 QR asset should exist");
  assert.match(source, /DEFAULT_WECHAT_QR_SRC\s*=\s*"assets\/quhuo-qr\.png"/, "取火 QR should have a repo asset default");
  assert.match(source, /DEFAULT_JOIN_QR_SRC\s*=\s*"assets\/join-consult-qr\.png"/, "入会咨询 QR should have a repo asset default");
  assert.match(source, /DEFAULT_VOTE_QR_SRC\s*=\s*"assets\/vote-qr\.png"/, "现场投票 QR should have a repo asset default");
  assert.match(source, /qrBoxHtml\(state\.wechatQrData\s*\|\|\s*DEFAULT_WECHAT_QR_SRC\)/, "取火 QR should fall back to the default asset");
  assert.match(source, /qrBoxHtml\(state\.joinQrData\s*\|\|\s*DEFAULT_JOIN_QR_SRC\)/, "入会咨询 QR should fall back to the default asset");
  assert.match(templatesSource, /voteQrData:\s*""/, "vote QR upload should be part of agenda template state");
  assert.match(source, /state\.voteQrData\s*\|\|\s*DEFAULT_VOTE_QR_SRC/, "现场投票 QR should use uploaded data before the default asset");
});

test("image upload editor omits obsolete current poster upload", () => {
  const uploadDetails = fixedInfoDetails("海报与标识：图片上传");

  assert.ok(uploadDetails.includes('id="logoInput"'), "brand logo upload should remain available");
  assert.ok(uploadDetails.includes('id="wechatQrInput"'), "取火 QR upload should remain available");
  assert.ok(uploadDetails.includes('id="joinQrInput"'), "入会咨询 QR upload should remain available");
  assert.ok(uploadDetails.includes('id="voteQrInput"'), "现场投票 QR upload should be available");
  assert.ok(uploadDetails.includes('data-image-preview="voteQrData"'), "现场投票 QR preview should use the shared upload renderer");
  assert.ok(uploadDetails.includes('data-image-field="voteQrData"'), "现场投票 QR input should save through the shared upload handler");
  assert.equal(uploadDetails.includes('id="posterInput"'), false, "current poster upload input should be removed");
  assert.equal(uploadDetails.includes('data-image-preview="posterData"'), false, "current poster preview upload card should be removed");
  assert.equal(uploadDetails.includes("当期海报"), false, "current poster editing copy should be removed from the upload editor");
});

test("image uploads reject oversized files before decoding and use object URLs", () => {
  const validateUpload = functionBlock("validateUploadImageFile");
  const loadImage = functionBlock("loadImageFromFile");
  const imageUpload = functionBlock("imageFileToDataUrl");

  assert.match(source, /const MAX_UPLOAD_IMAGE_BYTES\s*=\s*10 \* 1024 \* 1024;/, "image upload should define a 10MB preflight limit");
  assert.match(validateUpload, /file\.size > MAX_UPLOAD_IMAGE_BYTES/, "image upload should reject oversized files before reading them");
  assert.match(validateUpload, /10MB 以内的图片/, "oversized image uploads should show a user-friendly Chinese message");
  assert.match(loadImage, /URL\.createObjectURL\(file\)/, "image upload should load the original file through an object URL instead of base64");
  assert.match(loadImage + imageUpload, /URL\.revokeObjectURL\(objectUrl\)/, "object URLs should be revoked after use or load failure");
  assert.match(imageUpload, /validateUploadImageFile\(file\)[\s\S]*loadImageFromFile\(file\)/, "validation should happen before image decoding");
  assert.doesNotMatch(imageUpload, /readAsDataURL\(file\)/, "image upload should not base64-read the whole original file before resizing");
});

test("printable sidebar keeps a single aligned four-card grid", () => {
  assert.match(source, /--template-sidebar-width:\s*316px;/, "sidebar should gain a little width for a calmer left column");
  assert.match(
    source,
    /\.template-sidebar\s*\{[\s\S]*?grid-template-rows:\s*0\.90fr 2\.22fr 0\.66fr 0\.80fr;[\s\S]*?align-content:\s*stretch;/,
    "sidebar should keep four aligned rows while giving the member team card more room"
  );
  assert.match(source, /\.template-sidebar\s*\{[\s\S]*?gap:\s*10px;/, "sidebar cards should keep consistent compact gaps");
  assert.match(source, /\.template-info-card\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\);/, "cards should keep title/body alignment");
  assert.match(
    source,
    /\.timing-rules-body\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;[\s\S]*?align-content:\s*stretch;/,
    "timing content should fill its allotted card without creating a bottom void"
  );
  assert.doesNotMatch(source, /\.timing-rule-groups\s*\{[\s\S]*?align-content:\s*space-between;/, "rule groups should not be artificially spread apart");
  assert.match(
    source,
    /\.timing-rule-groups\s*\{[\s\S]*?grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
    "rule groups should fill the timing card as three evenly weighted light blocks"
  );
});

test("timing rule groups read as calm vertical instruction cards", () => {
  const listRule = cssRule(".timing-rule-list");
  const itemRule = cssRule(".timing-rule-item");

  assert.doesNotMatch(listRule, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/, "timing rules should not use 2 × 2 cell grids");
  assert.match(listRule, /width:\s*min\(100%,\s*var\(--sidebar-pair-grid-width\)\);/, "rule lists should use the shared centered two-column measure");
  assert.match(listRule, /justify-self:\s*center;/, "rule lists should sit on the same center line as other paired sidebar content");
  assert.match(itemRule, /grid-template-columns:\s*var\(--sidebar-pair-columns\);/, "rule rows should use the shared paired column definition");
  assert.match(itemRule, /column-gap:\s*var\(--sidebar-pair-gap\);/, "rule rows should use the shared paired column gap");
  assert.doesNotMatch(source, /class="timing-rule-line"/, "timing rules should not render as four-row mini tables");
  assert.doesNotMatch(itemRule, /background:/, "individual rule rows should not look like boxed cells");
  assert.match(source, /\.timing-rule-heading\s*\{[\s\S]*?grid-template-columns:\s*26px minmax\(0,\s*1fr\);/, "each rule card should have a clear icon-led heading");
});

test("sidebar typography and gutters stay visually consistent", () => {
  const titleRule = cssRule(".template-info-card h3");
  const bodyRule = cssRule(".template-info-body");
  const compactBodyRule = cssRule(".template-info-body.compact");
  const timingBodyRule = cssRule(".timing-rules-body");
  const infoLineRule = cssRule(".info-line");
  const qrRowRule = cssRule(".qr-row");
  const teamGridRule = cssRule(".team-grid");
  const teamRowRule = cssRule(".team-row");
  const teamNameRule = cssRule(".team-name");
  const teamRoleRule = cssRule(".team-role");
  const timingTokenRule = cssRule(".timing-rule-token");
  const timingValueRule = cssRule(".timing-rule-value");

  assert.match(source, /--sidebar-card-x:\s*14px;/, "sidebar cards should share one horizontal padding token");
  assert.match(source, /--sidebar-pair-grid-width:\s*218px;/, "paired sidebar content should share one centered grid width");
  assert.match(source, /--sidebar-pair-gap:\s*18px;/, "paired sidebar content should share one column gap");
  assert.match(source, /--sidebar-pair-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/, "paired sidebar content should share one two-column definition");
  assert.match(titleRule, /padding:\s*7px var\(--sidebar-card-x\);/, "card titles should align with body text");
  assert.match(bodyRule, /padding:\s*var\(--sidebar-card-y\) var\(--sidebar-card-x\) 11px;/, "standard card bodies should use the shared gutter");
  assert.match(compactBodyRule, /padding:\s*var\(--sidebar-card-y\) var\(--sidebar-card-x\);/, "compact card bodies should keep the same left and right gutter");
  assert.match(timingBodyRule, /padding:\s*var\(--sidebar-card-y\) var\(--sidebar-card-x\);/, "timing card body should align to the shared sidebar gutter");
  assert.match(infoLineRule, /font-size:\s*10\.8px;[\s\S]*?line-height:\s*1\.38;/, "about text should keep a readable body rhythm");
  assert.match(teamGridRule, /row-gap:\s*5px;[\s\S]*?align-content:\s*center;/, "team list should have demo-like vertical breathing room");
  assert.doesNotMatch(teamGridRule, /padding-left:\s*57px;[\s\S]*?padding-right:\s*57px;/, "team columns should not rely on a separate inset from the shared paired grid");
  assert.match(teamRowRule, /font-size:\s*10\.4px;[\s\S]*?line-height:\s*1\.38;/, "team rows should be readable without feeling cramped");
  assert.match(qrRowRule, /width:\s*min\(100%,\s*var\(--sidebar-pair-grid-width\)\);[\s\S]*?grid-template-columns:\s*var\(--sidebar-pair-columns\);[\s\S]*?column-gap:\s*var\(--sidebar-pair-gap\);/, "QR blocks should sit on the same paired column centers as the team and timing rows");
  assert.match(teamRowRule, /width:\s*min\(100%,\s*var\(--sidebar-pair-grid-width\)\);[\s\S]*?grid-template-columns:\s*var\(--sidebar-pair-columns\);[\s\S]*?column-gap:\s*var\(--sidebar-pair-gap\);/, "team rows should use the shared paired column centers");
  assert.match(teamRoleRule, /text-align:\s*center;/, "member roles should center within their shared left column");
  assert.match(teamNameRule, /text-align:\s*center;/, "member names should center within their shared right column");
  assert.match(timingTokenRule, /justify-content:\s*center;/, "timing rule labels should center within their shared left column");
  assert.match(timingValueRule, /text-align:\s*center;/, "timing rule values should center within their shared right column");
  assert.match(source, /\.about-card \.info-line-list\s*\{[\s\S]*?height:\s*100%;[\s\S]*?align-content:\s*space-between;/, "about text should balance vertically inside its card");
});

test("timing rules module contains all three detailed rule groups", () => {
  const sidebar = sidebarTemplate();

  const requiredRules = [
    {
      title: "3分钟及以下规则",
      note: "适用于主席致辞、主持串场、三官宣言、短点评等",
      green: "剩余 1 分钟",
      yellow: "剩余 30 秒",
      bell: "超时 15 秒"
    },
    {
      title: "3–10分钟规则",
      note: "适用于备稿演讲、来宾介绍、即兴点评等",
      green: "剩余 2 分钟",
      yellow: "剩余 1 分钟",
      bell: "超时 30 秒"
    },
    {
      title: "10分钟以上规则",
      note: "适用于工作坊、专题分享、较长流程说明等",
      green: "剩余 5 分钟",
      yellow: "剩余 2 分钟",
      bell: "超时 30 秒"
    }
  ];

  assert.ok(sidebar.includes("计时员将按不同演讲时长举牌提醒，并在超时后响铃。"));
  assert.ok(sidebar.includes("举牌为静音提示，请演讲者留意节奏；红牌后请尽快收尾。"));

  for (const rule of requiredRules) {
    for (const text of [rule.title, rule.note, "绿牌", rule.green, "黄牌", rule.yellow, "红牌", "时间到", "响铃", rule.bell]) {
      assert.ok(sidebar.includes(text), `${rule.title} should include: ${text}`);
    }
  }
});

test("printable footer keeps guest participation beside the live voting QR", () => {
  const footer = footerTemplate();
  const defaultGuestInvitation = templates.getDefaultData().guestInvitation;
  const guestTagsRule = cssRule(".guest-tags");
  const guestCardRule = cssRule(".guest-participation");
  const voteCardRule = cssRule(".guest-vote-card");
  const voteImageRule = cssRule(".guest-vote-card img");

  assert.ok(footer.includes("来宾可参与方式"), "footer should use the updated guest participation title");
  assert.ok(footer.includes("guestParticipationHtml(state.guestInvitation)"), "guest card should use the tag renderer");
  for (const text of ["来宾介绍", "即兴演讲", "话题分词", "无需经验，欢迎第一次参加"]) {
    assert.ok(defaultGuestInvitation.includes(text), `guest card defaults should include: ${text}`);
  }
  assert.ok(source.includes("现场投票"), "guest card should include the live voting label");
  assert.ok(source.includes("DEFAULT_VOTE_QR_SRC"), "guest card should reference the bundled vote QR asset");
  assert.ok(existsSync(new URL("../assets/vote-qr.png", import.meta.url)), "vote QR asset should exist");
  assert.match(source, /voteQrData:\s*\{[\s\S]*?emptyLabel:\s*"现场投票二维码"[\s\S]*?defaultSrc:\s*DEFAULT_VOTE_QR_SRC/, "vote QR should use the shared image upload metadata");
  assert.doesNotMatch(templatesSource, /诚邀您一起|成为一半|所有的伟大都源于开始/, "guest card defaults should not include long slogans");
  assert.match(guestTagsRule, /display:\s*flex;[\s\S]*?justify-content:\s*flex-start;/, "guest tags should stay on the left side");
  assert.match(guestCardRule, /grid-template-columns:\s*minmax\(0,\s*1fr\) 78px;[\s\S]*?align-items:\s*center;/, "guest card should reserve a right column for voting QR");
  assert.match(voteCardRule, /width:\s*78px;[\s\S]*?border-radius:\s*9px;[\s\S]*?background:\s*#ffffff;/, "vote QR should sit in a small white rounded card");
  assert.match(voteImageRule, /width:\s*64px;[\s\S]*?height:\s*64px;/, "vote QR image should stay compact in the footer");
});

test("agenda generator adds task-oriented mobile navigation and bottom sheet editing", () => {
  const mobileCss = cssMediaBlock("max-width: 620px");

  for (const id of ["meetingInfoPanel", "agendaPanel", "previewPanel", "exportPanel"]) {
    assert.match(source, new RegExp(`id="${id}"`), `${id} anchor should exist for mobile task navigation`);
    assert.match(source, new RegExp(`data-mobile-nav="${id}"`), `${id} should be represented in the mobile taskbar`);
  }
  assert.match(source, /class="mobile-taskbar"/, "mobile taskbar should be rendered outside the desktop editor flow");
  assert.match(source, /id="mobileQuickAddBtn"/, "mobile quick add button should exist");
  assert.match(source, /id="mobileQuickAddBtn"[^>]*aria-label="添加项目"/, "compact mobile quick add should retain an accessible label");
  assert.match(source, /id="mobileQuickAddBtn"[^>]*hidden/, "mobile quick add should start hidden until the agenda tab is active");
  assert.match(source, /id="mobileEditorScrim"/, "mobile bottom sheet should have a dismiss scrim");
  assert.match(source, /id="cancelAgendaBtn"/, "mobile editor should expose an explicit cancel button");

  assert.match(mobileCss, /\.mobile-taskbar\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/, "mobile taskbar should be fixed with four task entries");
  assert.match(mobileCss, /\.toast\s*\{[\s\S]*?bottom:\s*calc\(76px \+ env\(safe-area-inset-bottom\)\);[\s\S]*?z-index:\s*90;/, "mobile toast should sit above the lighter fixed taskbar so undo remains tappable");
  assert.match(mobileCss, /\.mobile-quick-add\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*calc\(72px/, "quick add should sit above the compact taskbar");
  assert.match(mobileCss, /\.mobile-quick-add\s*\{[\s\S]*?width:\s*46px;[\s\S]*?font-size:\s*0;/, "mobile quick add should collapse to an icon button instead of covering agenda rows");
  assert.match(mobileCss, /body\.mobile-agenda-editor-open \.mobile-taskbar\s*\{[\s\S]*?display:\s*none;/, "taskbar should not cover mobile sheet save/cancel actions");
  assert.match(mobileCss, /\.agenda-form-card\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*0;[\s\S]*?max-height:\s*min\(88dvh,\s*720px\);/, "agenda form should become a mobile bottom sheet");
  assert.match(mobileCss, /\.agenda-form-card \.actions-row\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?bottom:\s*0;/, "mobile save/cancel actions should stay fixed at the bottom of the sheet");
});

test("agenda generator mobile list hides risky actions behind a menu and adds sort buttons", () => {
  const mobileCss = cssMediaBlock("max-width: 620px");
  const renderList = functionBlock("renderAgendaList");
  const bindEventsSource = functionBlock("bindEvents");

  assert.match(renderList, /agenda-direct-actions/, "desktop duplicate/delete buttons should remain as direct actions");
  assert.match(renderList, /agenda-menu-actions/, "mobile agenda rows should render a compact more menu");
  assert.match(renderList, /data-action="toggle-menu"/, "mobile rows should have a menu toggle action");
  assert.match(renderList, /aria-expanded="false"[\s\S]*?aria-controls="agenda-menu-\$\{escapeHtml\(item\.id\)\}"/, "menu toggles should expose expanded state and controls");
  assert.match(renderList, /class="agenda-overflow-menu"[\s\S]*?hidden aria-hidden="true"/, "overflow menu content should be hidden from focus and screen readers by default");
  assert.match(renderList, /data-action="move-up"[\s\S]*?上移/, "mobile sort mode should render an up action");
  assert.match(renderList, /data-action="move-down"[\s\S]*?下移/, "mobile sort mode should render a down action");
  assert.match(source, /function moveAgendaItem\(id,\s*direction\)/, "mobile sort controls should use a dedicated move helper");
  assert.match(bindEventsSource, /setMobileSortMode\(!mobileSortMode\)/, "sort toggle should switch mobile sort mode");
  assert.match(bindEventsSource, /toggleAgendaMenu\(button\)/, "menu toggle should not reuse edit/delete handling");
  assert.match(bindEventsSource, /mobileSortMode && isMobileViewport\(\)/, "desktop drag should not stay disabled after leaving mobile sort mode");
  assert.match(bindEventsSource, /event\.key !== "Escape"[\s\S]*?clearAgendaForm\(\)/, "Escape should close mobile editor and menus");
  assert.match(bindEventsSource, /moveAgendaItem\(id,\s*-1\)/, "up action should move the agenda item up");
  assert.match(bindEventsSource, /moveAgendaItem\(id,\s*1\)/, "down action should move the agenda item down");

  assert.match(mobileCss, /\.agenda-direct-actions\s*\{[\s\S]*?display:\s*none;/, "mobile should hide direct duplicate/delete actions");
  assert.match(mobileCss, /\.agenda-menu-actions\s*\{[\s\S]*?display:\s*flex;/, "mobile should show the compact menu action");
  assert.match(mobileCss, /\.agenda-list\.sort-mode \.agenda-mobile-sort\s*\{[\s\S]*?display:\s*grid;/, "sort mode should reveal explicit up/down controls");
  assert.match(mobileCss, /\.agenda-source-note,\s*\.agenda-toolbar-note\s*\{[\s\S]*?display:\s*none;/, "mobile agenda should hide explanatory copy so rows appear earlier");
  assert.match(mobileCss, /\.agenda-row\s*\{[\s\S]*?min-height:\s*48px;[\s\S]*?padding:\s*7px 8px;/, "mobile agenda rows should stay compact enough for scanning");
});

test("agenda generator mobile preview shows a confident thumbnail and export-first actions", () => {
  const mobileCss = cssMediaBlock("max-width: 620px");

  assert.match(mobileCss, /\.preview-title p,\s*#previewChip,\s*#copyBtnTop\s*\{[\s\S]*?display:\s*none;/, "mobile preview should remove secondary toolbar content so the poster appears sooner");
  assert.match(mobileCss, /\.preview-viewport\s*\{[\s\S]*?min-height:\s*min\(660px,\s*calc\(100dvh - 170px\)\);/, "mobile preview should prioritize a tall visible A4 thumbnail area");
  assert.match(mobileCss, /\.preview-frame\s*\{[\s\S]*?background:\s*#fffdf8;[\s\S]*?box-shadow:\s*var\(--shadow-2\);/, "mobile preview frame should read as a loaded document card");
  assert.match(mobileCss, /\.toolbar-actions\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1\.12fr\) minmax\(0,\s*0\.88fr\);/, "mobile toolbar should keep export stronger while fitting one compact row");
  assert.match(mobileCss, /\.toolbar-actions \.export-pdf-button\s*\{[\s\S]*?min-height:\s*46px;/, "mobile PDF export should remain thumb-friendly without delaying the preview");
  assert.match(mobileCss, /\.toolbar-actions \.print-button\s*\{[\s\S]*?min-height:\s*44px;/, "mobile print should remain available but secondary to PDF export");
  assert.match(mobileCss, /\.nav-button-label\s*\{[\s\S]*?position:\s*static;[\s\S]*?clip-path:\s*none;/, "mobile header icon buttons should expose visible labels");
  assert.match(mobileCss, /#meetingInfoPanel \.field-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/, "mobile meeting info should use two columns for short editable fields");
});

test("agenda generator gives the mobile editor dialog semantics and scoped quick add", () => {
  const syncMobileEditorState = functionBlock("syncMobileEditorState");
  const updateQuickAdd = functionBlock("updateMobileQuickAddVisibility");
  const setActiveMobileNav = functionBlock("setActiveMobileNav");

  assert.match(syncMobileEditorState, /setAttribute\("role",\s*"dialog"\)/, "mobile sheet should become a dialog while open");
  assert.match(syncMobileEditorState, /setAttribute\("aria-modal",\s*"true"\)/, "mobile sheet should be modal for assistive technology while open");
  assert.match(syncMobileEditorState, /removeAttribute\("role"\)/, "dialog semantics should be removed outside the mobile open state");
  assert.match(updateQuickAdd, /targetId === "agendaPanel"[\s\S]*?!mobileSortMode[\s\S]*?els\.agendaFormCard\.hidden/, "quick add should only appear in the agenda task when safe");
  assert.match(setActiveMobileNav, /updateMobileQuickAddVisibility\(activeMobilePanel\)/, "mobile task changes should refresh quick add visibility");
});

test("screen preview uses the same fixed artboard model as print", () => {
  const frameRule = cssRule(".preview-frame");
  const sheetRule = cssRule(".template-sheet");
  const syncScaleMatch = source.match(/function syncPreviewScale\(\) \{([\s\S]*?)\n    \}/);

  assert.match(frameRule, /width:\s*calc\(980px \* var\(--preview-scale,\s*1\)\);/, "preview frame should be sized from the fixed artboard scale");
  assert.match(frameRule, /height:\s*calc\(1386px \* var\(--preview-scale,\s*1\)\);/, "preview frame should preserve the fixed A4 artboard height");
  assert.match(frameRule, /overflow:\s*hidden;/, "preview frame should clip the scaled artboard like print output");
  assert.match(sheetRule, /width:\s*980px;[\s\S]*?height:\s*1386px;[\s\S]*?transform:\s*scale\(var\(--preview-scale,\s*1\)\);/, "screen sheet should keep the same 980 x 1386 layout used by print");
  assert.ok(syncScaleMatch, "preview scale sync function should exist");
  assert.doesNotMatch(syncScaleMatch[1], /max-width:\s*920px/, "preview scale should not be limited to mobile widths");
});

test("agenda generator separates total duration from per-person duration notes", () => {
  const renderPreview = functionBlock("renderPreview");
  const readAgendaForm = functionBlock("readAgendaForm");
  const applyTitleDefault = functionBlock("applyTitleDefault");
  const autoSchedule = functionBlock("autoScheduleAgenda");
  const durationRule = cssRule(".flow-duration-note");

  assert.match(source, /id="agendaDurationNote"/, "agenda editor should expose an optional duration note field");
  assert.match(source, /<label for="agendaDuration">总时长<\/label>/, "duration field should clearly mean total scheduled duration");
  assert.match(source, /durationNote:\s*"2min\/人"/, "default impromptu agenda should store a per-person duration note");
  assert.match(source, /duration:\s*"15"[\s\S]*?durationNote:\s*"2min\/人"/, "default impromptu agenda should use 15 minutes as the scheduled total");
  assert.match(renderPreview, /flow-duration-main/, "A4 preview should render the primary total duration separately");
  assert.match(renderPreview, /flow-duration-note/, "A4 preview should render duration notes as secondary text");
  assert.match(durationRule, /font-size:\s*9\.5px;/, "duration notes should stay visually secondary inside the compact table cell");
  assert.match(readAgendaForm, /durationNote/, "saving the agenda form should preserve a non-empty duration note");
  assert.match(applyTitleDefault, /match\?\.durationNote/, "title defaults should fill the duration note when available");
  assert.match(autoSchedule, /parseDurationMinutes\(item\.duration\)/, "automatic scheduling should use the total duration field");
  assert.doesNotMatch(autoSchedule, /durationNote/, "duration notes should not affect automatic scheduling");
});

test("agenda generator normalizes legacy impromptu two-row timing into one double-duration row", () => {
  const normalizeAgendaItems = buildAgendaNormalizer();
  const { items, changed } = normalizeAgendaItems([
    { id: "s-impromptu", kind: "section", title: "二、即兴演讲" },
    { id: "rule", kind: "item", time: "19:42", title: "即兴主持介绍规则", detail: "", person: "燕微", duration: "15" },
    { id: "speech", kind: "item", time: "19:57", title: "即兴演讲", detail: "即兴主持人设计规则，展开两分钟演讲", person: "现场所有人", duration: "2min/人" },
    { id: "next", kind: "item", time: "19:59", title: "总主持人介绍本环节+串场", person: "卡卡", duration: "2" }
  ]);

  assert.equal(changed, true, "legacy impromptu rows should be detected as a migration");
  assert.equal(items.length, 3, "legacy rule and speech rows should collapse into one agenda item");
  assert.equal(items[1].id, "speech", "the merged row should keep the original speech item identity");
  assert.equal(items[1].time, "19:42", "the merged row should start at the original total-flow time");
  assert.equal(items[1].title, "即兴演讲");
  assert.equal(items[1].duration, "15", "the merged row should schedule by total duration");
  assert.equal(items[1].durationNote, "2min/人", "the merged row should preserve the per-person duration");
  assert.equal(items[1].person, "燕微", "the merged row should keep the impromptu host as owner");
  assert.match(items[1].detail, /即兴主持介绍规则/, "rule explanation should remain visible in the detail");
  assert.match(items[1].detail, /现场所有人参与/, "participants should be preserved in the detail");
});

test("agenda builder syncs a copied agenda into timekeeper storage", () => {
  const buildAgenda = functionSource("buildTimekeeperAgendaItems");
  const syncAgenda = functionSource("syncTimekeeperAgenda");
  const openTimekeeper = functionSource("openTimekeeper");

  assert.match(source, /<script src="js\/storage\.js"><\/script>/, "agenda builder should load shared storage keys");
  assert.match(source, /<script src="js\/agenda-schema\.js"><\/script>/, "agenda builder should load the shared agenda schema");
  assert.match(storageSource, /timekeeperAgendaSyncMeta:\s*"tm_timekeeper_agenda_sync_meta_v1"/, "timekeeper sync metadata key should exist");
  assert.match(storageSource, /timekeeperAgenda:\s*"tm_timekeeper_agenda_v2"/, "agenda builder should write the existing timekeeper agenda key");
  assert.match(storageSource, /timekeeperMeeting:\s*"tm_timekeeper_meeting_v1"/, "agenda builder should write the existing timekeeper meeting key");
  assert.match(storageSource, /timekeeperRecords:\s*"tm_timekeeper_records_v1"/, "sync conflict checks should inspect timekeeper records");
  assert.match(schemaSource, /function convertGeneratorItemToTimekeeperAgenda/, "schema should own generator-to-timekeeper item conversion");
  assert.match(schemaSource, /\(item\.kind \|\| "item"\) === "section"/, "timekeeper sync should skip section headings");
  assert.match(schemaSource, /name:\s*String\(item\.title/, "agenda title should become the timekeeper item name");
  assert.match(schemaSource, /speaker:\s*item\.person/, "agenda person should become the timekeeper speaker field");
  assert.match(schemaSource, /detail:\s*item\.detail/, "agenda detail should be preserved for timekeeper context");
  assert.match(schemaSource, /scheduledTime:\s*item\.time/, "agenda time should be preserved for timekeeper context");
  assert.match(buildAgenda, /buildTimekeeperPayloadForSync\(\)\.agendaItems/, "agenda builder should use the shared payload builder");
  assert.match(syncAgenda, /mergeTimekeeperAgendaItems\(agendaItems,\s*currentAgenda\)/, "sync should merge into the live agenda instead of replacing every item");
  assert.match(syncAgenda, /TMStorage\.writeJson\(TIMEKEEPER_STORAGE_KEYS\.agenda,\s*mergedAgenda\)/, "sync should write the merged agenda items");
  assert.match(syncAgenda, /TMStorage\.writeJson\(TIMEKEEPER_STORAGE_KEYS\.meeting,\s*meeting\)/, "sync should write meeting metadata");
  assert.match(syncAgenda, /TMStorage\.writeJson\(TIMEKEEPER_STORAGE_KEYS\.syncMeta/, "sync should save the copied agenda snapshot for future conflict checks");
  assert.doesNotMatch(syncAgenda, /TIMEKEEPER_STORAGE_KEYS\.records[\s\S]*writeJson/, "sync should not clear or rewrite timing records");
  assert.match(syncAgenda, /syncedMeeting:\s*comparableTimekeeperMeeting\(meeting\)/, "sync metadata should snapshot meeting fields");
  assert.match(openTimekeeper, /syncTimekeeperAgenda\(\);[\s\S]*?window\.location\.href = "index\.html";/, "open action should try syncing and always navigate to timekeeper");
  assert.match(source, /openTimekeeperBtn\.addEventListener\("click",\s*openTimekeeper\)/, "timekeeper button should use the sync-aware open handler");
  assert.match(source, /<a class="nav-button" id="openTimekeeperBtn" href="index\.html"/, "timekeeper entry should keep a native link fallback if JavaScript sync fails");
});

test("timekeeper sync parses durations and guards live edits", () => {
  const conflictCheck = functionSource("timekeeperHasSyncConflict");

  assert.match(schemaSource, /rangeMatch[\s\S]*?Number\(rangeMatch\[2\]\)/, "duration ranges like 5-7 should use the upper bound");
  assert.match(schemaSource, /text\.match\(\/\(\\d\+\(\?:\\\.\\d\+\)\?\)\/\)/, "single values like 2min/人 should use the first number");
  assert.match(schemaSource, /\/秒\/\.test\(text\)[\s\S]*?Math\.ceil\(value \/ 60\)/, "second-based durations should convert to at least one minute");
  assert.match(schemaSource, /secondsOnly \? Math\.max\(1,\s*Math\.ceil\(upper \/ 60\)\)/, "second-based ranges should convert the upper bound from seconds");
  assert.match(conflictCheck, /currentRecords[\s\S]*?currentRecords\.length > 0/, "existing timing records should require confirmation before overwrite");
  assert.match(conflictCheck, /item\.status && item\.status !== "pending"/, "active or done agenda items should require confirmation");
  assert.match(conflictCheck, /hasUntrackedAgenda[\s\S]*?!lastSyncedAgenda[\s\S]*?!isDefaultTimekeeperAgenda\(currentAgenda\)/, "pre-existing non-default unsynced agenda data should require confirmation");
  assert.match(conflictCheck, /JSON\.stringify\(comparableTimekeeperAgenda\(currentAgenda\)\) !== JSON\.stringify\(lastSyncedAgenda\)/, "local edits after last sync should require confirmation");
  assert.match(conflictCheck, /JSON\.stringify\(comparableTimekeeperMeeting\(currentMeeting\)\) !== JSON\.stringify\(lastSyncedMeeting\)/, "meeting edits after last sync should require confirmation");
  assert.match(source, /window\.confirm\("时间官已有现场数据或本地调整。同步只会更新未开始环节和会议基础信息，不会清空计时记录，也不会覆盖已完成环节。继续同步吗？"\)/, "conflict confirmation should explain that records and completed agenda status are preserved");
  assert.match(schemaSource, /timekeeperName:\s*existingMeeting\.timekeeperName \|\| ""/, "meeting sync should preserve the existing timekeeper name");
  assert.match(schemaSource, /meetingDate:\s*generatorState\.date/, "meeting sync should copy the agenda date");
  assert.match(schemaSource, /meetingStartTime:\s*generatorState\.startTime/, "meeting sync should copy the agenda start time");
  assert.match(schemaSource, /meetingEndTime:\s*generatorState\.endTime/, "meeting sync should copy the agenda end time");
  assert.doesNotMatch(source, /function deriveTimingRule/, "agenda generator should not keep a local duplicate timing-rule implementation");
  assert.match(functionSource("ruleTextForDuration"), /TimeRules\.deriveRuleForMinutes\(minutes\)/, "rule hint should use shared time-rule data");
});

test("timekeeper duration conversion handles real edge cases", () => {
  const parseMinutes = buildDurationParser();

  assert.equal(parseMinutes("5-7"), 7, "minute ranges should use the upper bound");
  assert.equal(parseMinutes("2min/人"), 2, "per-person minute labels should use the first number");
  assert.equal(parseMinutes("20"), 20, "plain minute values should parse directly");
  assert.equal(parseMinutes("30秒 × 4"), 2, "second-based repeated expressions should convert to total minutes");
  assert.equal(parseMinutes("30秒 × 4 + 1分钟"), 3, "mixed second/minute expressions should sum all reliable terms");
  assert.equal(parseMinutes("30秒"), 1, "single second values should round up to one minute");
  assert.equal(parseMinutes("30-45秒"), 1, "second ranges should round the upper bound up to one minute");
  assert.equal(parseMinutes("90秒"), 2, "long second values should round up by minute");
  assert.equal(parseMinutes("０５-０７"), 7, "full-width digits should parse correctly");
  assert.equal(parseMinutes("30秒 × 4 + 1", 9), 9, "ambiguous mixed expressions should return fallback");
  assert.equal(parseMinutes("30秒 4", 9), 9, "unstructured multi-number labels should return fallback");
});

test("timekeeper sync uses total impromptu duration while preserving the per-person note", () => {
  const payload = schema.buildTimekeeperPayload({
    date: "2026-06-16",
    startTime: "19:20",
    endTime: "21:30",
    items: [
      { id: "s-impromptu", kind: "section", title: "二、即兴演讲" },
      { id: "i-impromptu", kind: "item", time: "19:42", title: "即兴演讲", detail: "即兴主持介绍规则", person: "燕微", duration: "15", durationNote: "2min/人" }
    ]
  });

  assert.equal(payload.agendaItems.length, 1);
  assert.equal(payload.agendaItems[0].plannedMinutes, 15, "timekeeper should count the full impromptu flow, not the per-person note");
  assert.equal(payload.agendaItems[0].durationLabel, "15 (2min/人)", "timekeeper should retain the readable per-person timing note");
});

test("timekeeper meeting title follows the editable Chinese club name", () => {
  const payload = schema.buildTimekeeperPayload({
    clubName: "新中文俱乐部名",
    meetingNo: "777",
    theme: "重来",
    items: [
      { id: "i-opening", kind: "item", title: "开场", duration: "3" }
    ]
  });

  assert.equal(payload.meeting.meetingTitle, "新中文俱乐部名 · 第777期例会 · 主题：重来");
});

test("timekeeper conflict detection handles default agenda and meeting edits", () => {
  const defaultAgenda = [
    { name: "事务官宣布会议规则", plannedMinutes: 1, durationLabel: "1 分钟", status: "pending" },
    { name: "主席致词", plannedMinutes: 3, durationLabel: "3 分钟", status: "pending" },
    { name: "总主持 / 串场", plannedMinutes: 3, durationLabel: "2-3 分钟", status: "pending" },
    { name: "三官宣言", plannedMinutes: 2, durationLabel: "2 分钟", status: "pending" },
    { name: "即兴演讲", plannedMinutes: 2, durationLabel: "2 分钟/人", status: "pending" },
    { name: "备稿演讲", plannedMinutes: 7, durationLabel: "5-7 分钟", status: "pending" },
    { name: "来宾介绍", plannedMinutes: 5, durationLabel: "5 分钟", status: "pending" },
    { name: "即兴点评", plannedMinutes: 5, durationLabel: "5 分钟", status: "pending" },
    { name: "备稿点评", plannedMinutes: 3, durationLabel: "3 分钟", status: "pending" },
    { name: "三官报告", plannedMinutes: 3, durationLabel: "3 分钟", status: "pending" },
    { name: "总点评", plannedMinutes: 8, durationLabel: "8 分钟", status: "pending" },
    { name: "颁奖 / 分享", plannedMinutes: 5, durationLabel: "5 分钟", status: "pending" }
  ];
  const syncedAgenda = [{ id: "i-1", name: "开场", plannedMinutes: 2, durationLabel: "2", status: "pending" }];
  const syncedMeeting = {
    meetingTitle: "畅言中文 · 第739期例会",
    meetingDate: "2025-07-15",
    meetingStartTime: "19:25",
    meetingEndTime: "21:30"
  };

  assert.equal(buildConflictChecker({
    tm_timekeeper_agenda_v2: defaultAgenda,
    tm_timekeeper_records_v1: []
  }), false, "first sync should not block on the built-in default timekeeper agenda");

  assert.equal(buildConflictChecker({
    tm_timekeeper_agenda_v2: [{ name: "现场自定义", plannedMinutes: 9, durationLabel: "9 分钟", status: "pending" }],
    tm_timekeeper_records_v1: []
  }), true, "non-default unsynced agenda data should still require confirmation");

  assert.equal(buildConflictChecker({
    tm_timekeeper_agenda_v2: syncedAgenda,
    tm_timekeeper_meeting_v1: { ...syncedMeeting, meetingTitle: "现场改过的标题" },
    tm_timekeeper_records_v1: [],
    tm_timekeeper_agenda_sync_meta_v1: {
      syncedAgendaItems: [{ id: "i-1", name: "开场", plannedMinutes: 2, durationLabel: "2" }],
      syncedMeeting
    }
  }), true, "meeting edits after the last sync should require confirmation");
});

test("timekeeper agenda schema preserves live progress while updating pending items", () => {
  const incoming = [
    { id: "a", name: "备稿演讲", plannedMinutes: 7, durationLabel: "5-7", speaker: "Maggie", detail: "新题目", scheduledTime: "20:06" },
    { id: "b", name: "即兴点评", plannedMinutes: 5, durationLabel: "5", speaker: "Rui", scheduledTime: "20:43" }
  ];
  const current = [
    { id: "a", name: "旧备稿", plannedMinutes: 6, durationLabel: "6", status: "done", actualStart: "start", actualEnd: "end", speaker: "旧发言人" },
    { id: "b", name: "旧点评", plannedMinutes: 4, durationLabel: "4", status: "pending" }
  ];

  const merged = schema.mergeTimekeeperAgendaItems(incoming, current);

  assert.equal(merged[0].name, "旧备稿", "done agenda names should not be overwritten");
  assert.equal(merged[0].status, "done", "done agenda status should be preserved");
  assert.equal(merged[0].actualStart, "start", "done agenda actualStart should be preserved");
  assert.equal(merged[0].actualEnd, "end", "done agenda actualEnd should be preserved");
  assert.equal(merged[0].speaker, "旧发言人", "live speaker edits should win on completed agenda items");
  assert.equal(merged[1].name, "即兴点评", "pending agenda items should receive the latest generator name");
  assert.equal(merged[1].speaker, "Rui", "pending agenda items should receive synced speaker data");
  assert.equal(merged[1].scheduledTime, "20:43", "pending agenda items should receive synced scheduled time");
});

test("timekeeper agenda matching avoids ambiguous duplicate names", () => {
  const incoming = [
    { id: "new-1", sourceId: "source-1", name: "备稿演讲", scheduledTime: "20:06", speaker: "A" },
    { id: "new-2", sourceId: "source-2", name: "备稿演讲", scheduledTime: "20:13", speaker: "B" }
  ];
  const current = [
    { id: "current-1", sourceId: "source-1", name: "旧标题", scheduledTime: "20:00", status: "pending" },
    { id: "current-2", name: "备稿演讲", scheduledTime: "20:13", status: "pending" }
  ];

  const merged = schema.mergeTimekeeperAgendaItems(incoming, current);

  assert.equal(merged[0].id, "current-1", "sourceId should be the first matching priority");
  assert.equal(merged[0].speaker, "A", "sourceId match should update the pending item");
  assert.equal(merged[1].id, "current-2", "scheduledTime + name should match the intended duplicate item");
  assert.equal(merged[1].speaker, "B", "scheduledTime + name match should update the intended duplicate item");

  const ambiguous = schema.mergeTimekeeperAgendaItems(
    [
      { id: "x1", name: "备稿演讲", speaker: "A" },
      { id: "x2", name: "备稿演讲", speaker: "B" }
    ],
    [
      { id: "old-1", name: "备稿演讲", status: "pending" },
      { id: "old-2", name: "备稿演讲", status: "pending" }
    ]
  );
  assert.equal(ambiguous[0].id, "x1", "duplicate names without stronger keys should not inherit a possibly wrong existing item");
  assert.equal(ambiguous[1].id, "x2", "duplicate names without stronger keys should remain independent");
});

test("timekeeper agenda schema assigns unique fallback ids to idless incoming items", () => {
  const merged = schema.mergeTimekeeperAgendaItems(
    [
      { name: "无 ID 环节 A", plannedMinutes: 2 },
      { name: "无 ID 环节 B", plannedMinutes: 3 }
    ],
    []
  );

  assert.deepEqual(merged.map((item) => item.id), ["agenda-item-1", "agenda-item-2"]);
  assert.deepEqual(merged.map((item) => item.name), ["无 ID 环节 A", "无 ID 环节 B"]);
});

test("agenda generator warns when the A4 preview may overflow", () => {
  const renderPreview = functionBlock("renderPreview");
  const queueFit = functionBlock("queueFlowLayoutFit");
  const checkOverflow = functionBlock("checkPrintOverflow");

  assert.match(renderPreview, /queueFlowLayoutFit\(\)/, "preview render should queue a fit and overflow check after layout");
  assert.match(queueFit, /window\.requestAnimationFrame\(run\)/, "fit queue should run once after the next layout frame");
  assert.match(queueFit, /window\.setTimeout\(run,\s*120\)/, "fit queue should re-run after delayed layout settles");
  assert.match(queueFit, /fitFlowLayout\(\)/, "fit queue should try compact preview layouts before warning");
  assert.match(queueFit, /checkPrintOverflow\(\)/, "fit queue should still warn when compact layouts cannot fit");
  assert.match(checkOverflow, /scrollHeight > page\.clientHeight \+ 2/, "overflow check should compare rendered height with the A4 page height");
  assert.match(checkOverflow, /hasFlowOverlap\(\)/, "overflow check should also detect flow rows colliding with the vision bar");
  assert.match(source, /当前内容可能超出 A4 页面，已使用最紧凑版式；请减少文字或拆分议程/, "overflow warning should explain that compact fitting already ran");
});

test("A4 preview top line includes the editable meeting manager when present", () => {
  const renderPreview = functionBlock("renderPreview");
  const themeLineRule = cssRule(".template-theme-line");
  const themeLabelRule = cssRule(".template-theme-label");

  assert.match(renderPreview, /const managerName = String\(state\.manager \|\| ""\)\.trim\(\)/, "preview should read the existing editable manager field");
  assert.match(renderPreview, /const managerThemeMeta = managerName \?/, "manager label should be conditional so empty values do not leave a trailing separator");
  assert.match(renderPreview, /<span class="template-theme-label">例会经理：\$\{escapeHtml\(managerName\)\}<\/span>/, "preview top line should render the escaped manager name");
  assert.match(renderPreview, /<span class="template-theme-label">主题：\$\{escapeHtml\(state\.theme\)\}<\/span>/, "theme text should share the same fitting behavior");
  assert.match(renderPreview, /\$\{managerThemeMeta\}/, "manager label should be part of the title metadata row");
  assert.match(themeLineRule, /min-width:\s*0/, "metadata row should be allowed to shrink inside the fixed A4 header");
  assert.match(themeLineRule, /overflow:\s*hidden/, "metadata row should not overlap the right-side date stack");
  assert.match(themeLabelRule, /text-overflow:\s*ellipsis/, "long editable metadata should truncate instead of overflowing");
  assert.match(themeLabelRule, /white-space:\s*nowrap/, "normal short metadata should keep the existing one-line header appearance");
});

test("printable footer renders as three independent reference-style cards", () => {
  const footerRule = cssRule(".template-footer");
  const cardRule = cssRule(".template-footer-box");
  const titleRule = cssRule(".template-footer-box h3");
  const nextRule = cssRule(".next-meeting-footer");
  const nextThemeRule = cssRule(".next-meeting-footer .next-theme");
  const guestTagRule = cssRule(".guest-tag");
  const rulesBulletRule = cssRule(".meeting-rules-list li::before");
  const templateRule = cssRule(".template-sheet");

  assert.match(footerRule, /grid-template-columns:\s*var\(--template-sidebar-width\) minmax\(0,\s*1\.4fr\) minmax\(0,\s*1fr\);/, "footer should preserve the original three-column alignment");
  assert.match(footerRule, /margin:\s*var\(--template-footer-margin\);/, "footer should use the shared fitting variable for its outer alignment");
  assert.match(templateRule, /--template-footer-margin:\s*0 20px 18px;/, "footer should keep its original default outer alignment with the page");
  assert.match(footerRule, /gap:\s*var\(--template-footer-gap\);/, "footer cards should use the shared fitting variable for spacing");
  assert.match(templateRule, /--template-footer-gap:\s*14px;/, "footer cards should keep their original default independent-card spacing");
  assert.match(footerRule, /background:\s*transparent;/, "footer strip should not look like one connected table");
  assert.match(footerRule, /box-shadow:\s*none;/, "footer wrapper should not carry the card shadow");
  assert.doesNotMatch(source, /@media print\s*\{[\s\S]*?\.template-footer\s*\{[\s\S]*?background:\s*#fff !important;/, "print should not give the footer wrapper a different background from screen preview");
  assert.match(cardRule, /border:\s*1px solid var\(--tm-border\);[\s\S]*?border-radius:\s*var\(--radius-card\);[\s\S]*?background:\s*var\(--tm-card\);/, "each footer item should be its own bordered white card");
  assert.match(cardRule, /text-align:\s*left;/, "footer cards should follow the reference's left-aligned title rhythm");
  assert.doesNotMatch(source, /\.template-footer-box:last-child\s*\{[\s\S]*?border-right:\s*0;/, "last footer card should keep a complete border");
  assert.match(titleRule, /display:\s*flex;[\s\S]*?justify-content:\s*flex-start;/, "footer titles should align to the left");
  assert.match(nextRule, /justify-items:\s*start;[\s\S]*?text-align:\s*left;/, "next meeting content should be left aligned");
  assert.match(nextThemeRule, /color:\s*var\(--tm-maroon\);[\s\S]*?font-size:\s*14px;/, "next meeting theme should be the visual emphasis");
  assert.match(guestTagRule, /background:\s*#eaf3fb;[\s\S]*?border-radius:\s*999px;[\s\S]*?padding:\s*4px 8px;/, "guest participation labels should look like compact blue pills");
  assert.match(rulesBulletRule, /background:\s*var\(--tm-maroon\);[\s\S]*?content:\s*"✓";/, "meeting rules should use compact red checked bullets");
});

test("printable footer replaces notes with meeting rules", () => {
  const footer = footerTemplate();
  const rulesListRule = cssRule(".meeting-rules-list");

  assert.ok(footer.includes("会议守则"), "footer should render a meeting rules card");
  assert.equal(footer.includes("<span>备注</span>"), false, "footer should not render the old notes title");
  assert.ok(footer.includes("meetingRulesHtml(state.meetingRules)"), "meeting rules should use the rules renderer");
  for (const text of ["手机请调至静音", "请留意时间官提示", "欢迎鼓掌、反馈与投票", "入会咨询请联系会员副会长"]) {
    assert.ok(source.includes(text), `meeting rules should include: ${text}`);
  }
  assert.match(rulesListRule, /align-content:\s*center;[\s\S]*?text-align:\s*left;/, "meeting rules should be vertically centered and readable");
});

test("fixed info editor only exposes fields that still appear in the preview", () => {
  const nextDetails = fixedInfoDetails("下期与页脚信息");
  const fixedDetails = fixedInfoDetails("固定信息：关于我们、会员团队、会议守则");

  assert.equal(nextDetails.includes('id="footerNotes"'), false, "obsolete footer notes editor should be removed");
  assert.equal(fixedDetails.includes('id="pathways"'), false, "Pathways editor should be removed because it no longer appears in preview");
  assert.equal(fixedDetails.includes('id="joinInfo"'), false, "join info editor should be removed because it no longer appears in preview");
  assert.ok(fixedDetails.includes('for="clubName"'), "Chinese club name label should be visible in the fixed info editor");
  assert.ok(fixedDetails.includes("中文俱乐部名"), "Chinese club name should use the requested editor label");
  assert.ok(fixedDetails.includes('id="clubName"'), "Chinese club name input should be present");
  assert.ok(fixedDetails.includes('data-field="clubName"'), "Chinese club name should use the existing autosave binding");
  assert.ok(fixedDetails.includes('id="clubNameEnglish"'), "English club name editor should remain unchanged");
  assert.ok(fixedDetails.includes('id="meetingRules"'), "meeting rules editor should remain because it drives the footer card");
  assert.ok(fixedDetails.includes("每行一条"), "meeting rules editor should explain that each line maps to one preview rule");
});

test("export panel separates print actions from json backup actions", () => {
  const panel = exportPanelTemplate();
  const groupsRule = cssRule(".export-action-groups");
  const actionsRule = cssRule(".export-actions");
  const primaryActionsRule = cssRule(".export-actions.primary");

  assert.ok(panel.includes("导出与备份"), "export panel title should be clearer than only 导出");
  assert.ok(panel.includes("打印输出"), "print/copy actions should have their own group");
  assert.ok(panel.includes("数据备份"), "JSON actions should have their own group");
  assert.match(panel, /<div class="export-actions primary">[\s\S]*?id="exportPdfBtnSide"[\s\S]*?id="printBtnSide"[\s\S]*?id="copyBtn"[\s\S]*?<\/div>/, "PDF, print, and copy should sit together");
  assert.match(source, /id="exportPdfBtn"/, "preview toolbar should include a PDF export action beside print");
  assert.match(panel, /<div class="export-actions backup">[\s\S]*?id="exportJsonBtn"[\s\S]*?id="importJsonBtn"[\s\S]*?<\/div>/, "JSON export/import should sit together");
  assert.match(groupsRule, /display:\s*grid;[\s\S]*?gap:\s*14px;/, "export groups should be visually separated");
  assert.match(actionsRule, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/, "paired export buttons should align in two columns");
  assert.match(primaryActionsRule, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/, "primary export buttons should align in three columns on desktop");
});

test("agenda generator exposes a WeChat relay text import modal", () => {
  const panel = exportPanelTemplate();
  const applyRelayImportSource = functionBlock("applyRelayImport");
  const renderRelayImportPreviewSource = functionBlock("renderRelayImportPreview");

  assert.match(source, /<script src="js\/agenda-relay-importer\.js"><\/script>[\s\S]*?<script src="js\/agenda-data\.js"><\/script>/, "relay importer should load before agenda app initialization");
  assert.match(
    source,
    /id="agendaPanel"[\s\S]*?id="agendaSourceActions"[\s\S]*?id="relayImportBtn"[\s\S]*?id="changeTemplateBtn"[\s\S]*?id="addAgendaItemBtn"/,
    "relay import and template switching should lead the agenda panel, ahead of manual add buttons"
  );
  assert.equal(panel.includes('id="relayImportBtn"'), false, "relay import should no longer hide among JSON backup controls");
  assert.ok(source.includes('id="relayImportModal"'), "relay import modal should exist");
  assert.ok(source.includes('id="relayImportText"'), "relay import modal should provide a paste textarea");
  assert.ok(source.includes('id="relayImportPreview"'), "relay import modal should show parsed preview");
  assert.ok(source.includes('id="relayImportWarnings"'), "relay import modal should show parser warnings");
  assert.ok(source.includes('id="relayImportCancelBtn"'), "relay import modal should allow canceling without changes");
  assert.ok(source.includes('id="relayImportConfirmBtn"'), "relay import modal should require explicit confirmation");
  assert.match(applyRelayImportSource, /autoScheduleAgenda\(\);\s*renderAll\(\);\s*saveData\(\);/, "confirmed relay import should reschedule, rerender, and save through the normal path");
  assert.match(applyRelayImportSource, /RelayImporter\.mergeRelayIntoAgenda\(state\.items,\s*parsedRelayImport,\s*\{\s*overwrite\s*\}\)/, "relay import should merge signups into the standing agenda instead of replacing it");
  assert.match(applyRelayImportSource, /\.\.\.state[\s\S]*?items:\s*mergeResult\.items/, "relay import should preserve fixed information and apply the merged agenda");
  assert.ok(source.includes('id="relayOverwriteToggle"'), "relay modal should offer the 覆盖已有人员 checkbox");
  assert.match(source, /覆盖已有人员/, "the overwrite option should be labeled in plain Chinese");
  assert.match(renderRelayImportPreviewSource, /mergeRelayIntoAgenda/, "relay preview should show the same merge plan that confirming would apply");
  assert.match(renderRelayImportPreviewSource, /将填入/, "relay preview should list rows that will be filled");
  assert.match(renderRelayImportPreviewSource, /已跳过/, "relay preview should list rows skipped because they already have people");
  assert.match(renderRelayImportPreviewSource, /未匹配的报名/, "relay preview should list signups without a matching agenda row");
  assert.match(renderRelayImportPreviewSource, /usedFallbackItems/, "relay preview should fall back to the full relay agenda when the current agenda is empty");
  assert.match(source, /relayOverwriteToggle\?\.addEventListener\("change",\s*refreshRelayImportPreview\)/, "toggling overwrite mode should refresh the preview");
  assert.match(source, /window\.parseRelayText\s*=\s*RelayImporter\.parseRelayText/, "parser should be exposed for browser console testing");
  assert.match(renderRelayImportPreviewSource, /item\.kind === "section"/, "relay preview should render imported sections as section dividers");
  assert.ok(source.includes(".relay-import-section-preview"), "relay section preview should have dedicated styling");
  assert.match(applyRelayImportSource, /showToast\(message,\s*"撤销",/, "confirmed relay import should offer an undo action in the toast");
});

test("agenda generator exposes selectable agenda templates", () => {
  const names = templates.listTemplates().map((template) => template.name);
  const regular = templates.getTemplate("常规例会模板");
  const marathon = templates.getTemplate("impromptu-marathon");

  assert.ok(existsSync(new URL("../js/agenda-templates.js", import.meta.url)), "agenda templates module should exist");
  assert.match(source, /<script src="js\/agenda-templates\.js"><\/script>[\s\S]*?<script src="js\/agenda-data\.js"><\/script>/, "agenda templates should load before agenda app initialization");
  assert.ok(names.includes("常规例会模板"), "regular meeting template should be listed");
  assert.ok(names.includes("即兴马拉松模板"), "impromptu marathon template should be listed");
  assert.equal(templates.getDefaultData().theme, "复盘：我过的怎么样", "default data should still come from the regular meeting template");
  assert.ok(regular.data.items.some((item) => item.title === "主席总结本期活动，结束会议"), "regular template should keep the existing default agenda content");
  assert.ok(marathon.data.items.some((item) => String(item.title).includes("即兴演讲 Round 2")), "marathon template should provide a distinct agenda");
});

test("template picker confirms before overwriting agenda state", () => {
  const panel = exportPanelTemplate();
  const loadDataSource = functionBlock("loadData");
  const applyTemplateSource = functionBlock("applyAgendaTemplate");

  assert.equal(panel.includes('id="changeTemplateBtn"'), false, "template switch should live in the agenda panel, not among backup actions");
  assert.match(source, /id="agendaSourceActions"[\s\S]*?id="changeTemplateBtn"/, "agenda panel should expose the template switch button");
  assert.ok(source.includes('id="templateModal"'), "template picker modal should be present");
  assert.match(applyTemplateSource, /AgendaTemplates\.getTemplateSkeleton\(templateId\)/, "template application should use the people-free skeleton from the shared template module");
  assert.match(applyTemplateSource, /window\.confirm\(`更换模板会用「\$\{skeleton\.name\}」的流程结构替换当前议程列表（人员留空，等待接龙导入或手动填写）；会议信息、图片和固定信息保持不变。是否继续？`\)[\s\S]*?return;/, "template switch should confirm with an accurate description of skeleton-only replacement");
  assert.match(applyTemplateSource, /state\s*=\s*nextState/, "template switch should replace the current agenda only after confirmation");
  assert.match(applyTemplateSource, /\.\.\.state[\s\S]*?items:\s*skeleton\.items/, "template switch should keep meeting info, images, and fixed info by spreading the current state");
  assert.match(applyTemplateSource, /showToast\(`已切换为\$\{skeleton\.name\}（人员留空）`,\s*"撤销",/, "template switch should offer an undo action in the toast");
  assert.match(applyTemplateSource, /autoScheduleAgenda\(\);\s*renderAll\(\);\s*saveData\(\);/, "template switch should reschedule, rerender, and save through the normal path");
  assert.match(loadDataSource, /if \(!saved\) return normalizeEscapedNewlines\(clone\(DEFAULT_DATA\)\)/, "default template should only seed the page when no saved local data exists");
});

test("saved empty agendas stay empty instead of being reseeded from the default template", () => {
  const loadDataSource = functionBlock("loadData");

  assert.match(loadDataSource, /if \(!Array\.isArray\(source\.items\)\) source\.items = clone\(DEFAULT_DATA\.items\);/, "missing legacy items should still receive default items");
  assert.doesNotMatch(loadDataSource, /!\s*source\.items\.length/, "an intentionally saved empty agenda should not be overwritten by the default template");
});

test("agenda generator exposes multi-device Supabase draft sync controls", () => {
  const panel = exportPanelTemplate();
  const saveDataSource = functionBlock("saveData");
  const initCloudSyncSource = functionBlock("initCloudSync");

  assert.match(source, /js\/supabase-config\.js/, "Supabase config should be loaded before app initialization");
  assert.match(source, /js\/vendor\/supabase-js-v2\.umd\.min\.js/, "Supabase JS v2 should be loaded as a browser script");
  assert.match(source, /js\/agenda-cloud-sync\.js/, "cloud sync controller should be loaded");
  assert.ok(existsSync(new URL("../js/supabase-config.js", import.meta.url)), "Supabase config placeholder should exist");
  assert.ok(existsSync(new URL("../js/vendor/supabase-js-v2.umd.min.js", import.meta.url)), "local Supabase JS vendor file should exist");
  assert.ok(existsSync(new URL("../js/agenda-cloud-sync.js", import.meta.url)), "cloud sync module should exist");

  assert.match(panel, /id="cloudSyncPanel"[\s\S]*?多设备同步/, "export panel should include a multi-device sync section");
  assert.match(panel, /id="createSyncDraftBtn"[\s\S]*?创建同步草稿/, "sync panel should create a cloud draft");
  assert.match(panel, /id="copySyncLinkBtn"[\s\S]*?复制同步链接/, "sync panel should copy the draft link");
  assert.match(panel, /id="cloudSyncStatus"[\s\S]*?本机草稿/, "sync panel should show local/sync status");
  assert.match(saveDataSource, /queueCloudSave\(\)/, "local saves should enter the cloud save debounce when a draft is active");
  assert.match(initCloudSyncSource, /CloudSync\.getDraftIdFromSearch\(window\.location\.search\)/, "draft URL parameter should bootstrap cloud loading");
  assert.match(initCloudSyncSource, /applyRemotePayload:\s*applyCloudDraftPayload/, "remote draft payloads should update the editor state");
});

test("agenda generator JSON import still enters the cloud sync save path", () => {
  const importJsonSource = functionBlock("importJson");
  const replaceAgendaStateSource = functionBlock("replaceAgendaState");
  const saveDataSource = functionBlock("saveData");

  assert.match(importJsonSource, /replaceAgendaState\(JSON\.parse\(text\)\)/, "JSON import should validate through the atomic replacement path");
  assert.match(replaceAgendaStateSource, /renderAll\(\);[\s\S]*?saveData\(\)/, "validated state should render successfully before persistence");
  assert.match(saveDataSource, /queueCloudSave\(\)/, "the common save path should queue cloud sync after localStorage");
});

test("cloud sync exposes explicit conflict recovery actions", () => {
  const initCloudSyncSource = functionBlock("initCloudSync");
  assert.match(source, /id="cloudSyncConflictActions"/);
  assert.match(source, /id="loadRemoteDraftBtn"/);
  assert.match(source, /id="forkLocalDraftBtn"/);
  assert.match(source, /cloudSyncController\.loadRemoteLatest\(\)/);
  assert.match(source, /cloudSyncController\.forkDraft\(\)/);
  assert.match(initCloudSyncSource, /onConflict:\s*showCloudSyncConflict/);
});

test("agenda generator exports a mobile-friendly image PDF from the A4 preview", () => {
  const capturePrintPageCanvas = functionBlock("capturePrintPageCanvas");
  const renderPrintPageDomCanvas = functionBlock("renderPrintPageDomCanvas");
  const collectSnapshotImagePaints = functionBlock("collectSnapshotImagePaints");
  const hideSnapshotRepaintImages = functionBlock("hideSnapshotRepaintImages");
  const paintSnapshotImagesOntoCanvas = functionBlock("paintSnapshotImagesOntoCanvas");
  const exportAgendaPdf = functionBlock("exportAgendaPdf");
  const saveBlobForDevice = functionBlock("saveBlobForDevice");

  assert.match(source, /js\/vendor\/html2canvas-1\.4\.1\.min\.js/, "html2canvas should be loaded locally for image capture");
  assert.match(source, /js\/vendor\/jspdf-2\.5\.1\.umd\.min\.js/, "jsPDF should be loaded locally for PDF creation");
  assert.ok(existsSync(new URL("../js/vendor/html2canvas-1.4.1.min.js", import.meta.url)), "local html2canvas vendor file should exist");
  assert.ok(existsSync(new URL("../js/vendor/jspdf-2.5.1.umd.min.js", import.meta.url)), "local jsPDF vendor file should exist");
  assert.doesNotMatch(source, /id="previewRaster"|raster-ready/, "the visible A4 preview should remain the browser DOM preview, not a generated image overlay");
  assert.match(renderPrintPageDomCanvas, /cloneNode\(true\)/, "PDF export should clone the current DOM preview without replacing it");
  assert.match(renderPrintPageDomCanvas, /new XMLSerializer\(\)\.serializeToString\(snapshot\)/, "PDF export should serialize the browser DOM preview");
  assert.match(renderPrintPageDomCanvas, /snapshot\.style\.border\s*=\s*"0"/, "PDF export snapshot should remove the preview card border so the A4 page starts flush at the header");
  assert.match(renderPrintPageDomCanvas, /snapshot\.style\.borderRadius\s*=\s*"0"/, "PDF export snapshot should remove preview card rounded corners for a formal A4 document");
  assert.match(renderPrintPageDomCanvas, /const imagePaints = collectSnapshotImagePaints\(els\.printPage,\s*canvasWidth,\s*canvasHeight\);[\s\S]*?await inlineSnapshotImages\(snapshot\)/, "PDF export should freeze repaint image positions before async rendering can let the live preview change");
  assert.match(renderPrintPageDomCanvas, /await inlineSnapshotImages\(snapshot\);[\s\S]*?hideSnapshotRepaintImages\(snapshot,\s*imagePaints\);[\s\S]*?new XMLSerializer\(\)\.serializeToString\(snapshot\)/, "PDF export should hide repaint images in the cloned DOM before serialization so they are drawn exactly once");
  assert.match(renderPrintPageDomCanvas, /<foreignObject width="100%" height="100%">/, "PDF export should render the DOM through the browser SVG foreignObject path");
  assert.match(renderPrintPageDomCanvas, /data:image\/svg\+xml;charset=utf-8,\$\{encodeURIComponent\(svgMarkup\)\}/, "foreignObject should use a data URL so the canvas remains exportable");
  assert.match(renderPrintPageDomCanvas, /inlineSnapshotImages\(snapshot\)/, "local preview images should be embedded before DOM rendering");
  assert.match(renderPrintPageDomCanvas, /context\.drawImage\(image, 0, 0, canvas\.width, canvas\.height\)/, "the browser-rendered DOM image should back the PDF canvas");
  assert.match(renderPrintPageDomCanvas, /await paintSnapshotImagesOntoCanvas\(context,\s*imagePaints\)/, "mobile export should draw frozen preview images once after the DOM canvas render");
  assert.doesNotMatch(renderPrintPageDomCanvas, /paintSnapshotImagesOntoCanvas\(context,\s*canvas,\s*els\.printPage\)/, "image repaint should not read the live preview after async export work has started");
  assert.match(collectSnapshotImagePaints, /querySelectorAll\("img"\)/, "image repaint should include the QR and logo images from the live preview");
  assert.match(collectSnapshotImagePaints, /getBoundingClientRect\(\)/, "image repaint should preserve each image's preview position");
  assert.match(collectSnapshotImagePaints, /snapshotIndex/, "image repaint should track the matching clone image for one-pass export rendering");
  assert.match(hideSnapshotRepaintImages, /image\.style\.visibility\s*=\s*"hidden"/, "matched clone images should keep layout space but not double-paint inside the foreignObject render");
  assert.match(collectSnapshotImagePaints, /new Image\(\)/, "image repaint should freeze each image source before async export rendering can change the live DOM");
  assert.match(paintSnapshotImagesOntoCanvas, /context\.drawImage\(\s*paint\.image,/, "image repaint should draw the frozen image directly onto the export canvas");
  assert.match(capturePrintPageCanvas, /waitForPrintAssets\(els\.printPage\)[\s\S]*?fitFlowLayout\(\)[\s\S]*?renderPrintPageDomCanvas\(\)/, "PDF capture should use the settled visible DOM preview as its source");
  assert.doesNotMatch(capturePrintPageCanvas, /renderPreview\(\)|syncPreviewScale\(\)/, "PDF capture should not re-render or rescale the visible preview before capture");
  assert.match(exportAgendaPdf, /new jsPDF\(\{ orientation: "portrait", unit: "mm", format: "a4", compress: true \}\)/, "PDF should be a single portrait A4 page");
  assert.match(exportAgendaPdf, /addImage\([\s\S]*?0,\s*0,\s*210,\s*297/, "captured preview image should fill the A4 page");
  assert.match(exportAgendaPdf, /exportCanvasAsPng\(canvas/, "PDF failures after capture should fall back to PNG export");
  assert.match(saveBlobForDevice, /supportsDownloadAttribute\(\)[\s\S]*?link\.download = filename/, "download-capable browsers should receive a file download");
  assert.match(saveBlobForDevice, /window\.open\(url,\s*"_blank"/, "non-download or toast fallback should open a preview tab");
  assert.match(source, /畅言中文第\$\{safeMeetingNo\}期议程/, "export filename should follow the requested meeting title format");
});

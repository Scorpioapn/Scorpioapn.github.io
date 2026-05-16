import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../agenda_generator.html", import.meta.url), "utf8");

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

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  assert.ok(match, `${selector} CSS rule should exist`);
  return match[1];
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


test("default member team roster matches the updated club officers", () => {
  assert.match(source, /officers:\s*DEFAULT_OFFICERS,/, "default data should reference the shared updated officer roster");
  assert.ok(source.includes("LEGACY_DEFAULT_OFFICERS"), "old saved default roster should migrate without overwriting custom edits");
  for (const text of [
    "会长：卡卡  秘书长：浩岩",
    "教育副会长：斯敏  财务官：燕薇",
    "会员副会长：莫婷  事务官：文星",
    "公关副会长：聪聪"
  ]) {
    assert.ok(source.includes(text), `updated default roster should include: ${text}`);
  }
});

test("follow-us card uses default QR assets with upload override support", () => {
  const sidebar = sidebarTemplate();

  assert.ok(sidebar.includes("关注我们"), "QR sidebar card should use the shorter title");
  assert.equal(sidebar.includes("拍照关注我们"), false, "QR sidebar card should not use the old longer title");
  assert.ok(existsSync(new URL("../assets/quhuo-qr.png", import.meta.url)), "default 取火 QR asset should exist");
  assert.ok(existsSync(new URL("../assets/join-consult-qr.png", import.meta.url)), "default 入会咨询 QR asset should exist");
  assert.match(source, /DEFAULT_WECHAT_QR_SRC\s*=\s*"assets\/quhuo-qr\.png"/, "取火 QR should have a repo asset default");
  assert.match(source, /DEFAULT_JOIN_QR_SRC\s*=\s*"assets\/join-consult-qr\.png"/, "入会咨询 QR should have a repo asset default");
  assert.match(source, /qrBoxHtml\(state\.wechatQrData\s*\|\|\s*DEFAULT_WECHAT_QR_SRC\)/, "取火 QR should fall back to the default asset");
  assert.match(source, /qrBoxHtml\(state\.joinQrData\s*\|\|\s*DEFAULT_JOIN_QR_SRC\)/, "入会咨询 QR should fall back to the default asset");
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
  assert.match(listRule, /padding-left:\s*32px;/, "rule lists should align under the heading copy instead of filling the whole card like a table");
  assert.match(listRule, /padding-right:\s*32px;/, "rule values should use a symmetric right inset matching the left signal label inset");
  assert.match(itemRule, /grid-template-columns:\s*62px minmax\(0,\s*1fr\);/, "rule rows should align labels and values cleanly");
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
  const timingValueRule = cssRule(".timing-rule-value");

  assert.match(source, /--sidebar-card-x:\s*14px;/, "sidebar cards should share one horizontal padding token");
  assert.match(titleRule, /padding:\s*7px var\(--sidebar-card-x\);/, "card titles should align with body text");
  assert.match(bodyRule, /padding:\s*var\(--sidebar-card-y\) var\(--sidebar-card-x\) 11px;/, "standard card bodies should use the shared gutter");
  assert.match(compactBodyRule, /padding:\s*var\(--sidebar-card-y\) var\(--sidebar-card-x\);/, "compact card bodies should keep the same left and right gutter");
  assert.match(timingBodyRule, /padding:\s*var\(--sidebar-card-y\) var\(--sidebar-card-x\);/, "timing card body should align to the shared sidebar gutter");
  assert.match(infoLineRule, /font-size:\s*10\.8px;[\s\S]*?line-height:\s*1\.38;/, "about text should keep a readable body rhythm");
  assert.match(teamGridRule, /row-gap:\s*5px;[\s\S]*?align-content:\s*center;/, "team list should have demo-like vertical breathing room");
  assert.match(teamGridRule, /padding-left:\s*57px;[\s\S]*?padding-right:\s*57px;/, "team columns should share the same vertical guide as timing labels and values");
  assert.match(teamRowRule, /font-size:\s*10\.4px;[\s\S]*?line-height:\s*1\.38;/, "team rows should be readable without feeling cramped");
  assert.match(qrRowRule, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?align-items:\s*center;/, "QR blocks should sit in equal-width columns and align vertically");
  assert.match(teamRowRule, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/, "team names should use equal-width columns for cleaner left and right edges");
  assert.match(teamNameRule, /text-align:\s*right;/, "member names should align to the right card edge");
  assert.match(timingValueRule, /text-align:\s*right;/, "timing rule values should align to the right edge of each rule row");
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

test("printable footer keeps guest participation as centered tags", () => {
  const footer = footerTemplate();
  const guestTagsRule = cssRule(".guest-tags");
  const guestCardRule = cssRule(".guest-participation");

  assert.ok(footer.includes("来宾可参与环节"), "footer should keep the guest participation title");
  assert.ok(footer.includes("guestParticipationHtml(state.guestInvitation)"), "guest card should use the tag renderer");
  for (const text of ["来宾介绍", "即兴演讲", "真情分享", "无需经验，欢迎第一次参加"]) {
    assert.ok(source.includes(text), `guest card should include: ${text}`);
  }
  assert.doesNotMatch(source, /诚邀您一起|成为一半|所有的伟大都源于开始/, "guest card defaults should not include long slogans");
  assert.match(guestTagsRule, /display:\s*flex;[\s\S]*?justify-content:\s*center;/, "guest tags should align neatly as centered tags");
  assert.match(guestCardRule, /align-content:\s*center;[\s\S]*?justify-items:\s*center;/, "guest content should be vertically centered");
});

test("printable footer renders as three independent reference-style cards", () => {
  const footerRule = cssRule(".template-footer");
  const cardRule = cssRule(".template-footer-box");
  const titleRule = cssRule(".template-footer-box h3");
  const nextRule = cssRule(".next-meeting-footer");
  const nextThemeRule = cssRule(".next-meeting-footer .next-theme");
  const guestTagRule = cssRule(".guest-tag");
  const rulesBulletRule = cssRule(".meeting-rules-list li::before");

  assert.match(footerRule, /grid-template-columns:\s*var\(--template-sidebar-width\) minmax\(0,\s*1\.4fr\) minmax\(0,\s*1fr\);/, "footer should preserve the original three-column alignment");
  assert.match(footerRule, /margin:\s*0 20px 18px;/, "footer should keep its original outer alignment with the page");
  assert.match(footerRule, /gap:\s*14px;/, "footer cards should be separated like independent cards");
  assert.match(footerRule, /background:\s*transparent;/, "footer strip should not look like one connected table");
  assert.match(footerRule, /box-shadow:\s*none;/, "footer wrapper should not carry the card shadow");
  assert.match(cardRule, /border:\s*1px solid var\(--tm-border\);[\s\S]*?border-radius:\s*var\(--radius-card\);[\s\S]*?background:\s*var\(--tm-card\);/, "each footer item should be its own bordered white card");
  assert.match(cardRule, /text-align:\s*left;/, "footer cards should follow the reference's left-aligned title rhythm");
  assert.doesNotMatch(source, /\.template-footer-box:last-child\s*\{[\s\S]*?border-right:\s*0;/, "last footer card should keep a complete border");
  assert.match(titleRule, /display:\s*flex;[\s\S]*?justify-content:\s*flex-start;/, "footer titles should align to the left");
  assert.match(nextRule, /justify-items:\s*start;[\s\S]*?text-align:\s*left;/, "next meeting content should be left aligned");
  assert.match(nextThemeRule, /color:\s*var\(--tm-maroon\);[\s\S]*?font-size:\s*14px;/, "next meeting theme should be the visual emphasis");
  assert.match(guestTagRule, /background:\s*#eaf3fb;[\s\S]*?border-radius:\s*999px;[\s\S]*?padding:\s*4px 10px;/, "guest participation labels should look like blue pills");
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

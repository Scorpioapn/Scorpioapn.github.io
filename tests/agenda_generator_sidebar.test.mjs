import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../agenda_generator.html", import.meta.url), "utf8");

function sidebarTemplate() {
  const match = source.match(/<aside class="template-sidebar">([\s\S]*?)<\/aside>/);
  assert.ok(match, "renderPreview should contain the printable template sidebar");
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
  const expectedOrder = ["关于我们", "提示信号与计时规则", "拍照关注我们", "会员团队"];
  let previousIndex = -1;

  for (const label of expectedOrder) {
    const index = sidebar.indexOf(label);
    assert.ok(index > previousIndex, `${label} should appear after the previous sidebar card`);
    previousIndex = index;
  }

  assert.equal(sidebar.includes("如何加入我们"), false, "join information should not occupy a printable sidebar card");
  assert.equal(sidebar.includes("TM-Pathways"), false, "Pathways should not occupy printable sidebar space");
});

test("printable sidebar keeps a single aligned four-card grid", () => {
  assert.match(source, /--template-sidebar-width:\s*316px;/, "sidebar should gain a little width for a calmer left column");
  assert.match(
    source,
    /\.template-sidebar\s*\{[\s\S]*?grid-template-rows:\s*0\.92fr 2\.32fr 0\.66fr 0\.68fr;[\s\S]*?align-content:\s*stretch;/,
    "sidebar should keep four aligned rows that fill the printable flow height"
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
  assert.match(itemRule, /grid-template-columns:\s*62px minmax\(0,\s*1fr\);/, "rule rows should align labels and values cleanly");
  assert.doesNotMatch(source, /class="timing-rule-line"/, "timing rules should not render as four-row mini tables");
  assert.doesNotMatch(itemRule, /background:/, "individual rule rows should not look like boxed cells");
  assert.match(source, /\.timing-rule-heading\s*\{[\s\S]*?grid-template-columns:\s*26px minmax\(0,\s*1fr\);/, "each rule card should have a clear icon-led heading");
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

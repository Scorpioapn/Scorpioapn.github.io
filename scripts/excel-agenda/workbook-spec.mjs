import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AgendaTemplates = require("../../js/agenda-templates.js");
const AgendaSchema = require("../../js/agenda-schema.js");

export const SHEETS = [
  "操作台",
  "议程编辑",
  "A4议程",
  "A4续页",
  "模板库",
  "基础资料",
  "计算区"
];

export const FIRST_PAGE_ITEMS = 30;
export const MAX_ITEMS = 60;

export const COLORS = Object.freeze({
  blue: "#004165",
  blueDeep: "#00334F",
  maroon: "#772432",
  maroonBright: "#9D2235",
  yellow: "#F2DF74",
  ink: "#16232E",
  ink2: "#54646F",
  border: "#DFE5EA",
  surface: "#FFFFFF",
  rowBlue: "#EDF4FA",
  rowGreen: "#EFF7EF",
  rowGray: "#F0F2F3",
  warning: "#B7791F",
  warningBg: "#FBF3DE"
});

function stripSectionOrdinal(title) {
  return String(title || "")
    .replace(/^[一二三四五六七八九十]+、\s*/, "")
    .trim();
}

function rowTypeForTitle(title) {
  const text = String(title || "");
  if (/即兴/.test(text)) return "impromptu";
  if (/备稿|演讲/.test(text)) return "prepared";
  if (/茶歇|大合照/.test(text)) return "break";
  return "plain";
}

export function loadTemplateRows() {
  const rows = [];

  for (const template of AgendaTemplates.listTemplates()) {
    const skeleton = AgendaTemplates.getTemplateSkeleton(template.id);
    let sectionNo = 0;
    let sectionName = "";

    for (const [index, item] of skeleton.items.entries()) {
      const title = String(item.title || "");
      if (item.kind === "section") {
        sectionNo += 1;
        sectionName = stripSectionOrdinal(title);
      }

      rows.push({
        templateId: template.id,
        templateName: template.name,
        order: index + 1,
        id: item.id,
        kind: item.kind,
        sectionNo,
        sectionName,
        title: item.kind === "section" ? sectionName : title,
        detail: String(item.detail || ""),
        durationText: String(item.duration || ""),
        scheduleMinutes:
          item.kind === "section" ? 0 : AgendaSchema.parseDurationToMinutes(item.duration, 0),
        person: String(item.person || ""),
        rowType: rowTypeForTitle(title)
      });
    }
  }

  return rows;
}

export function buildRelayAgendaRows() {
  const row = (id, sectionNo, sectionName, title, durationText, scheduleMinutes, roleKey, rowType = rowTypeForTitle(title)) => ({
    id,
    kind: "item",
    sectionNo,
    sectionName,
    title,
    detail: "",
    durationText,
    scheduleMinutes,
    roleKey,
    person: "",
    rowType
  });

  return [
    row("relay-officer-open", 1, "开场环节", "事务官开场", "1", 1, "事务官开场"),
    row("relay-president", 1, "开场环节", "主席致辞", "3", 3, "主席致辞"),
    row("relay-host", 1, "开场环节", "总主持开场，介绍会议流程", "3", 3, "总主持"),
    row("relay-guests", 1, "开场环节", "来宾介绍", "5", 5, "来宾介绍"),
    row("relay-timer-declare", 1, "开场环节", "时间官宣言", "2", 2, "时间官"),
    row("relay-grammar-declare", 1, "开场环节", "语法官宣言", "2", 2, "语法官"),
    row("relay-ah-declare", 1, "开场环节", "哼哈官宣言", "2", 2, "哼哈官"),
    row("relay-impromptu", 2, "即兴演讲", "即兴演讲", "15 / 2min/人", 15, "即兴主持"),
    row("relay-speech-1", 3, "精心演讲环节", "备稿演讲1", "5-7", 7, "备稿演讲1"),
    row("relay-speech-2", 3, "精心演讲环节", "备稿演讲2", "5-7", 7, "备稿演讲2"),
    row("relay-speech-3", 3, "精心演讲环节", "备稿演讲3", "5-7", 7, "备稿演讲3"),
    row("relay-break", 4, "茶歇&会议反馈环节", "茶歇+大合照", "5", 5, "拍照侠"),
    row("relay-impromptu-eval", 4, "茶歇&会议反馈环节", "即兴点评", "5", 5, "即兴点评"),
    row("relay-eval-1", 4, "茶歇&会议反馈环节", "备稿点评1", "3", 3, "备稿点评1"),
    row("relay-eval-2", 4, "茶歇&会议反馈环节", "备稿点评2", "3", 3, "备稿点评2"),
    row("relay-eval-3", 4, "茶歇&会议反馈环节", "备稿点评3", "3", 3, "备稿点评3"),
    row("relay-grammar-report", 4, "茶歇&会议反馈环节", "语法官报告", "3", 3, "语法官"),
    row("relay-ah-report", 4, "茶歇&会议反馈环节", "哼哈官报告", "3", 3, "哼哈官"),
    row("relay-timer-report", 4, "茶歇&会议反馈环节", "时间官报告", "3", 3, "时间官"),
    row("relay-general-eval", 4, "茶歇&会议反馈环节", "总点评", "8", 8, "总点评"),
    row("relay-award", 5, "分享环节", "颁奖&真情分享", "5", 5, "颁奖&真情分享", "prepared")
  ];
}

export const RELAY_LABELS = [
  "主题",
  "今日一词",
  "例会经理",
  "时间",
  "地点",
  "事务官开场",
  "主席致辞",
  "总主持",
  "来宾介绍",
  "时间官",
  "哼哈官",
  "语法官",
  "提问官",
  "即兴主持",
  "备稿演讲1",
  "备稿演讲2",
  "备稿演讲3",
  "即兴点评",
  "备稿点评1",
  "备稿点评2",
  "备稿点评3",
  "总点评",
  "颁奖&真情分享",
  "拍照侠"
];

const RELAY_PLACEHOLDERS = Object.freeze([
  "[玫瑰]",
  "[烟花]",
  "待报名",
  "空",
  "TBD",
  "待定"
]);

const RELAY_PLACEHOLDER_SET = new Set(
  RELAY_PLACEHOLDERS.map((value) => value.toUpperCase())
);
const RELAY_PLACEHOLDER_FORMULA = `{${RELAY_PLACEHOLDERS
  .map((value) => `"${value}"`)
  .join(",")}}`;

export function selectLastRealRelayValue(values) {
  const candidates = Array.isArray(values) ? values : [];

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const value = String(candidates[index] ?? "").trim();
    if (value && !RELAY_PLACEHOLDER_SET.has(value.toUpperCase())) return value;
  }

  return "待定";
}

export function normalizedRelayFormula(rawCell = "'操作台'!$B$18") {
  return `=LET(raw,${rawCell},flat,TRIM(SUBSTITUTE(SUBSTITUTE(raw,CHAR(13)," "),CHAR(10)," ")),colon,SUBSTITUTE(flat,"：",":"),tight,SUBSTITUTE(SUBSTITUTE(colon," :",":"),": ",":"),labels,$A$5:$A$28,TRIM(REDUCE(tight,labels,LAMBDA(acc,label,SUBSTITUTE(acc,label&":","|"&label&":")))))`;
}

export function relayValueFormula(labelCell, tokenizedCell = "$B$2") {
  return `=LET(parts,TOCOL(TEXTSPLIT(${tokenizedCell},"|"),1),keys,TEXTBEFORE(parts,":",1,0,0,""),vals,TRIM(TEXTAFTER(parts,":",1,0,0,"")),hits,FILTER(vals,keys=${labelCell},NA()),real,FILTER(hits,(hits<>"")*ISNA(XMATCH(UPPER(hits),${RELAY_PLACEHOLDER_FORMULA})),NA()),IFERROR(TAKE(real,-1),"待定"))`;
}

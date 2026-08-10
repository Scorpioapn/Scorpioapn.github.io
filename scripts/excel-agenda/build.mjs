import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

import {
  COLORS,
  FIRST_PAGE_ITEMS,
  MAX_ITEMS,
  RELAY_ACCEPTANCE_SAMPLE,
  RELAY_LABELS,
  SHEETS,
  buildRelayAgendaRows,
  loadDefaultMeetingData,
  loadTemplateRows,
  normalizedRelayFormula,
  relayValueFormula
} from "./workbook-spec.mjs";

const BASE_FONT = "Microsoft YaHei";
const OUTPUT_RELATIVE_PATH =
  "outputs/agenda-excel-20260717/畅言议程生成器-无宏版.xlsx";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const outputPath = path.resolve(repoRoot, OUTPUT_RELATIVE_PATH);

const defaultMeeting = loadDefaultMeetingData();
const templateRows = loadTemplateRows();
const relayRows = buildRelayAgendaRows();
const TEMPLATE_LIBRARY_MAX_ROW = 1000;

const assets = Object.freeze({
  logo: path.join(repoRoot, "assets", "toastmasters-logo-color-png.png"),
  quhuo: path.join(repoRoot, "assets", "quhuo-qr.png"),
  join: path.join(repoRoot, "assets", "join-consult-qr.png"),
  vote: path.join(repoRoot, "assets", "vote-qr.png")
});

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

function applyBodyFont(sheet, address, size = 10) {
  sheet.getRange(address).format.font = {
    name: BASE_FONT,
    size,
    color: COLORS.ink
  };
}

function setColumnWidths(sheet, widths, rowCount) {
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, rowCount, 1).format.columnWidthPx = width;
  });
}

function mergeValue(sheet, address, value, format = {}) {
  const range = sheet.getRange(address);
  range.merge();
  range.values = [[value]];
  range.format = format;
  return range;
}

function mergeFormula(sheet, address, formula, format = {}) {
  const range = sheet.getRange(address);
  range.merge();
  range.formulas = [[formula]];
  range.format = format;
  return range;
}

function inputFormat({ horizontalAlignment = "left", wrapText = false } = {}) {
  return {
    fill: "#FFF8E8",
    font: { name: BASE_FONT, size: 10, color: COLORS.ink },
    borders: { preset: "outside", style: "thin", color: "#C4CFD8" },
    horizontalAlignment,
    verticalAlignment: "center",
    wrapText
  };
}

function labelFormat() {
  return {
    font: { name: BASE_FONT, size: 9, bold: true, color: COLORS.ink2 },
    verticalAlignment: "center"
  };
}

function cardFormat({ fill = COLORS.surface, wrapText = true } = {}) {
  return {
    fill,
    font: { name: BASE_FONT, size: 9, color: COLORS.ink },
    borders: { preset: "outside", style: "thin", color: COLORS.border },
    verticalAlignment: "center",
    wrapText
  };
}

function parseDateValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function parseTimeFraction(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  return (Number(match[1]) * 60 + Number(match[2])) / 1440;
}

async function imageDataUrl(filePath) {
  const bytes = await fs.readFile(filePath);
  let mime;
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    mime = "image/png";
  } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = "image/jpeg";
  } else {
    throw new Error(`Unsupported embedded image format: ${filePath}`);
  }
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

async function addImage(sheet, filePath, from, extent) {
  sheet.images.add({
    dataUrl: await imageDataUrl(filePath),
    anchor: { from, extent }
  });
}

function meetingChoiceFormula(inputCell, calculationCell) {
  return `=IF('操作台'!$B$4="接龙导入",IF('计算区'!${calculationCell}<>"",'计算区'!${calculationCell},'操作台'!${inputCell}),'操作台'!${inputCell})`;
}

function writeTemplateLibrary(sheet) {
  const headers = [[
    "模板ID",
    "模板名称",
    "顺序",
    "项目键",
    "类型",
    "分组编号",
    "分组名称",
    "标题",
    "说明",
    "时长显示",
    "排程分钟",
    "默认负责人",
    "行类型"
  ]];
  const rows = templateRows.map((row) => [
    row.templateId,
    row.templateName,
    row.order,
    row.id,
    row.kind,
    row.sectionNo,
    row.sectionName,
    row.title,
    row.detail,
    row.durationText,
    row.scheduleMinutes,
    row.person,
    row.rowType
  ]);

  applyReservedBase(sheet, `A1:M${rows.length + 1}`);
  sheet.getRange(`A1:M${rows.length + 1}`).values = [...headers, ...rows];
  const table = sheet.tables.add(
    `A1:M${rows.length + 1}`,
    true,
    "AgendaTemplatesTable"
  );
  table.style = "TableStyleMedium2";
  sheet.getRange("A1:M1").format = {
    fill: COLORS.blue,
    font: { name: BASE_FONT, size: 10, bold: true, color: COLORS.surface },
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange(`A2:M${rows.length + 1}`).format = {
    font: { name: BASE_FONT, size: 9, color: COLORS.ink },
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange(`K2:K${rows.length + 1}`).format.numberFormat = "0";
  setColumnWidths(
    sheet,
    [112, 122, 48, 126, 62, 66, 124, 188, 220, 86, 78, 126, 82],
    rows.length + 1
  );
  sheet.getRange("A1:M1").format.rowHeightPx = 34;
  sheet.freezePanes.freezeRows(1);
}

function currentBaseRows() {
  const introLines = defaultMeeting.clubIntro.split(/\r?\n/).filter(Boolean);
  const officerRows = defaultMeeting.officers
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const splitAt = line.indexOf("：");
      return splitAt < 0
        ? [line, ""]
        : [line.slice(0, splitAt), line.slice(splitAt + 1)];
    });

  return [
    ["字段", "内容"],
    ["中文会名", defaultMeeting.clubName],
    ["英文会名", defaultMeeting.clubNameEnglish],
    ["俱乐部介绍", introLines[0] || defaultMeeting.clubIntro],
    ["愿景", (introLines.find((line) => line.startsWith("愿景：")) || "愿景：").slice(3)],
    ["会议频率", introLines.find((line) => line.startsWith("每周"))?.split("，")[0] || "每周二晚"],
    ...officerRows,
    ["会议守则", defaultMeeting.meetingRules.replace(/\r?\n/g, "｜")]
  ];
}

async function writeBaseData(sheet) {
  const rows = currentBaseRows();
  if (rows.length !== 14) {
    throw new Error(`BaseInfoTable contract expected 14 rows, received ${rows.length}`);
  }

  sheet.getRange("A1:B14").values = rows;
  const table = sheet.tables.add("A1:B14", true, "BaseInfoTable");
  table.style = "TableStyleMedium2";
  sheet.getRange("A1:B1").format = {
    fill: COLORS.blue,
    font: { name: BASE_FONT, size: 10, bold: true, color: COLORS.surface }
  };
  sheet.getRange("A2:B14").format = {
    font: { name: BASE_FONT, size: 9, color: COLORS.ink },
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange("A16:B20").values = [
    ["官员团队全文", defaultMeeting.officers],
    ["会议愿景", defaultMeeting.meetingVision],
    ["下期主题", defaultMeeting.nextTheme],
    ["下期日期", defaultMeeting.nextMeetingDate],
    ["来宾参与", defaultMeeting.guestInvitation]
  ];
  sheet.getRange("A16:B20").format = cardFormat({ fill: "#F6F8FA" });
  sheet.getRange("B16:B20").format.wrapText = true;

  sheet.getRange("D1:K1").merge();
  sheet.getRange("D1").values = [["可替换的内嵌图片（右键图片 → 更改图片）"]];
  sheet.getRange("D1:K1").format = {
    fill: COLORS.maroon,
    font: { name: BASE_FONT, size: 11, bold: true, color: COLORS.surface },
    verticalAlignment: "center"
  };
  sheet.getRange("D7:K7").values = [[
    "Toastmasters Logo",
    "",
    "",
    "取伙二维码",
    "",
    "入会咨询二维码",
    "",
    "投票二维码"
  ]];
  sheet.getRange("D7:K7").format = {
    font: { name: BASE_FONT, size: 9, bold: true, color: COLORS.ink2 },
    horizontalAlignment: "center"
  };

  await addImage(sheet, assets.logo, { row: 1, col: 3 }, { widthPx: 230, heightPx: 150 });
  await addImage(sheet, assets.quhuo, { row: 7, col: 5 }, { widthPx: 118, heightPx: 118 });
  await addImage(sheet, assets.join, { row: 7, col: 7 }, { widthPx: 118, heightPx: 118 });
  await addImage(sheet, assets.vote, { row: 7, col: 9 }, { widthPx: 118, heightPx: 118 });

  setColumnWidths(sheet, [190, 430, 22, 86, 86, 86, 86, 86, 86, 86, 86], 24);
  sheet.getRange("A1:B20").format.rowHeightPx = 30;
  sheet.getRange("B4:B5").format.rowHeightPx = 62;
  sheet.getRange("B14:B20").format.rowHeightPx = 72;
  sheet.freezePanes.freezeRows(1);
}

function writeCalculationSheet(sheet) {
  applyBodyFont(sheet, "A1:N32", 9);
  applyBand(sheet, "A1:N1", "计算区 · 接龙解析、统一状态与验证", {
    fill: COLORS.blueDeep,
    size: 13
  });

  sheet.getRange("A4:B4").values = [["支持标签", "最后一个真实值"]];
  sheet.getRange("A5:A28").values = RELAY_LABELS.map((label) => [label]);
  sheet.getRange("B2").formulas = [[normalizedRelayFormula()]];
  sheet.getRange("B5").formulas = [[relayValueFormula("A5", "$B$2")]];
  sheet.getRange("B5:B28").fillDown();

  sheet.getRange("C1:E1").values = [["时间原文", "会议字段", "值"]];
  sheet.getRange("C2").formulas = [[
    '=IFERROR(XLOOKUP("时间",$A$5:$A$28,$B$5:$B$28,""),"")'
  ]];
  sheet.getRange("D2:D9").values = [
    ["期数"],
    ["主题"],
    ["今日一词"],
    ["例会经理"],
    ["日期"],
    ["开始时间"],
    ["结束时间"],
    ["地点"]
  ];
  sheet.getRange("E2").formulas = [[
    '=IFERROR(TEXTBEFORE(TEXTAFTER($B$2,"畅言",-1),"期报名帖"),"")'
  ]];
  sheet.getRange("E3").formulas = [[
    '=IFERROR(XLOOKUP("主题",$A$5:$A$28,$B$5:$B$28,""),"")'
  ]];
  sheet.getRange("E4").formulas = [[
    '=IFERROR(XLOOKUP("今日一词",$A$5:$A$28,$B$5:$B$28,""),"")'
  ]];
  sheet.getRange("E5").formulas = [[
    '=IFERROR(XLOOKUP("例会经理",$A$5:$A$28,$B$5:$B$28,""),"")'
  ]];
  sheet.getRange("E6").formulas = [[
    '=LET(v,$C$2,dateText,TRIM(TEXTBEFORE(v," ")),y,IF(ISNUMBER(SEARCH("年",dateText)),--TEXTBEFORE(dateText,"年"),YEAR(TODAY())),md,IF(ISNUMBER(SEARCH("年",dateText)),TEXTAFTER(dateText,"年"),dateText),m,--TEXTBEFORE(md,"月"),d,--TEXTBEFORE(TEXTAFTER(md,"月"),"日"),IFERROR(DATE(y,m,d),""))'
  ]];
  sheet.getRange("E7").formulas = [[
    '=LET(v,$C$2,clock,TRIM(TEXTAFTER(v," ",-1)),span,SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(clock,"–","-"),"—","-"),"至","-"),t,TRIM(TEXTBEFORE(span,"-")),IFERROR(TIME(--TEXTBEFORE(t,":"),--TEXTAFTER(t,":"),0),""))'
  ]];
  sheet.getRange("E8").formulas = [[
    '=LET(v,$C$2,clock,TRIM(TEXTAFTER(v," ",-1)),span,SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(clock,"–","-"),"—","-"),"至","-"),t,TRIM(TEXTAFTER(span,"-",-1)),IFERROR(TIME(--TEXTBEFORE(t,":"),--TEXTAFTER(t,":"),0),""))'
  ]];
  sheet.getRange("E9").formulas = [[
    '=IFERROR(XLOOKUP("地点",$A$5:$A$28,$B$5:$B$28,""),"")'
  ]];
  sheet.getRange("E6").format.numberFormat = "yyyy-mm-dd";
  sheet.getRange("E7:E8").format.numberFormat = "hh:mm";

  sheet.getRange("D11:E16").values = [
    ["日期提示", ""],
    ["解析角色数", ""],
    ["生成项目数", relayRows.length],
    ["缺失负责人", ""],
    ["排程错误", ""],
    ["预计超时分钟", ""]
  ];
  sheet.getRange("E11").formulas = [[
    '=IF(AND(E6<>"",TODAY()-E6>180),"接龙日期距离当前日期较久，请确认年份是否正确。","")'
  ]];
  sheet.getRange("E12").formulas = [[
    '=COUNTIF($B$5:$B$28,"<>待定")'
  ]];
  sheet.getRange("E14").formulas = [[
    '=COUNTIF(\'议程编辑\'!$Q$4:$Q$63,"*负责人待定*")'
  ]];
  sheet.getRange("E15").formulas = [[
    '=COUNTIF(\'议程编辑\'!$Q$4:$Q$63,"*排程*")'
  ]];
  sheet.getRange("E16").formulas = [[
    '=IFERROR(MAX(0,(MAX(\'议程编辑\'!$R$4:$R$63)-\'操作台\'!$J$10)*1440),0)'
  ]];
  sheet.getRange("E16").format.numberFormat = "0";

  sheet.getRange("F4:N4").values = [[
    "项目键",
    "分组编号",
    "分组名称",
    "标题",
    "时长显示",
    "排程分钟",
    "角色键",
    "负责人",
    "行类型"
  ]];
  sheet.getRange("F5:L25").values = relayRows.map((row) => [
    row.id,
    row.sectionNo,
    row.sectionName,
    row.title,
    row.durationText,
    row.scheduleMinutes,
    row.roleKey
  ]);
  sheet.getRange("M5:M25").formulas = relayRows.map((_, index) => [
    `=IF($L${index + 5}="","待定",IFERROR(XLOOKUP($L${index + 5},$A$5:$A$28,$B$5:$B$28,"待定"),"待定"))`
  ]);
  sheet.getRange("N5:N25").values = relayRows.map((row) => [row.rowType]);

  sheet.getRange("A4:N4").format = {
    fill: COLORS.blue,
    font: { name: BASE_FONT, size: 9, bold: true, color: COLORS.surface },
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange("A5:N28").format = {
    font: { name: BASE_FONT, size: 9, color: COLORS.ink },
    borders: { preset: "inside", style: "thin", color: COLORS.border },
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange("F5:N25").format.borders = {
    preset: "all",
    style: "thin",
    color: COLORS.border
  };
  setColumnWidths(
    sheet,
    [108, 220, 210, 88, 220, 124, 66, 120, 170, 92, 78, 112, 110, 76],
    32
  );
  sheet.freezePanes.freezeRows(4);
}

function warningFormula() {
  return '=LET(n,SUM(\'议程编辑\'!$S$4:$S$63),bad,\'计算区\'!$E$15,missing,\'计算区\'!$E$14,overtime,ROUND(\'计算区\'!$E$16,0),dateWarning,\'计算区\'!$E$11,w,IF(n>60,"议程超过60项，请精简后再打印。"&CHAR(10),"")&IF(n>30,"议程超过单页容量，将使用A4续页。"&CHAR(10),"")&IF(bad>0,"存在缺少或非法排程分钟，后续排程已停止。"&CHAR(10),"")&IF(missing>0,"仍有"&missing&"个负责人待定。"&CHAR(10),"")&IF(overtime>0,"预计超时"&overtime&"分钟。"&CHAR(10),"")&IF(dateWarning<>"",dateWarning,""),IF(w="","议程状态正常，可以检查 A4 成品。",w))';
}

function writeDashboard(sheet, workbook) {
  applyBodyFont(sheet, "A1:P34", 10);
  setColumnWidths(
    sheet,
    [32, 68, 68, 68, 28, 68, 68, 68, 28, 68, 68, 68, 28, 68, 68, 68],
    34
  );

  applyBand(sheet, "A1:P2", "畅言议程生成器 · 操作台", {
    fill: COLORS.blueDeep,
    size: 18
  });

  sheet.getRange("A4").values = [["议程来源"]];
  sheet.getRange("E4").values = [["模板选择"]];
  sheet.getRange("A4").format = labelFormat();
  sheet.getRange("E4").format = labelFormat();
  mergeValue(sheet, "B4:D4", "议程模板", inputFormat({ horizontalAlignment: "center" }));
  mergeValue(sheet, "F4:J4", "常规例会模板", inputFormat({ horizontalAlignment: "center" }));
  sheet.getRange("Q2").formulas = [[
    `=SORT(UNIQUE(FILTER('模板库'!$B$2:$B$${TEMPLATE_LIBRARY_MAX_ROW},'模板库'!$B$2:$B$${TEMPLATE_LIBRARY_MAX_ROW}<>"")))`
  ]];
  sheet.getRange("Q2:Q64").format = {
    font: { name: BASE_FONT, size: 1, color: COLORS.surface },
    columnWidthPx: 2
  };
  sheet.getRange("B4").dataValidation = {
    rule: { type: "list", values: ["接龙导入", "议程模板", "手工编辑"] }
  };
  sheet.getRange("F4").dataValidation = {
    rule: { type: "list", formula1: "$Q$2:$Q$64" }
  };
  mergeValue(
    sheet,
    "L4:P4",
    "黄色区域可编辑 · 切换来源不会清空手工修正",
    cardFormat({ fill: "#EEF4F7" })
  );

  applyBand(sheet, "A6:P6", "会议信息", { fill: COLORS.maroon, size: 11 });
  for (const [cell, label] of [["A7", "期数"], ["E7", "主题"], ["I7", "今日一词"], ["M7", "例会经理"]]) {
    sheet.getRange(cell).values = [[label]];
    sheet.getRange(cell).format = labelFormat();
  }
  mergeValue(sheet, "B7:D7", defaultMeeting.meetingNo, inputFormat());
  mergeValue(sheet, "F7:H7", defaultMeeting.theme, inputFormat());
  mergeValue(sheet, "J7:L7", defaultMeeting.wordOfDay, inputFormat());
  mergeValue(sheet, "N7:P7", defaultMeeting.manager, inputFormat());

  for (const [cell, label] of [["A10", "日期"], ["E10", "开始时间"], ["I10", "结束时间"]]) {
    sheet.getRange(cell).values = [[label]];
    sheet.getRange(cell).format = labelFormat();
  }
  mergeValue(sheet, "B10:D10", parseDateValue(defaultMeeting.date), inputFormat({ horizontalAlignment: "center" }));
  mergeValue(sheet, "F10:H10", parseTimeFraction(defaultMeeting.startTime), inputFormat({ horizontalAlignment: "center" }));
  mergeValue(sheet, "J10:L10", parseTimeFraction(defaultMeeting.endTime), inputFormat({ horizontalAlignment: "center" }));
  sheet.getRange("B10").format.numberFormat = "yyyy-mm-dd";
  sheet.getRange("F10").format.numberFormat = "hh:mm";
  sheet.getRange("J10").format.numberFormat = "hh:mm";
  mergeValue(
    sheet,
    "N10:P10",
    "A4 页会根据来源选择解析字段或本页输入",
    cardFormat({ fill: "#F6F8FA" })
  );

  sheet.getRange("A13").values = [["地点"]];
  sheet.getRange("A13").format = labelFormat();
  mergeValue(sheet, "B13:P14", defaultMeeting.location, inputFormat({ wrapText: true }));

  applyBand(sheet, "A16:J16", "微信接龙粘贴区（已预置 779 期验收样例，可直接替换）", {
    fill: COLORS.blue,
    size: 11
  });
  applyBand(sheet, "L16:P16", "解析预览", { fill: COLORS.blue, size: 11 });
  mergeValue(
    sheet,
    "B18:J26",
    RELAY_ACCEPTANCE_SAMPLE,
    inputFormat({ wrapText: true })
  );
  sheet.getRange("B18:J26").format.verticalAlignment = "top";

  sheet.getRange("L18:P26").format = cardFormat({ fill: "#F6F8FA" });
  mergeFormula(
    sheet,
    "L18:P19",
    '="期数："&\'计算区\'!$E$2&" · 主题："&\'计算区\'!$E$3',
    cardFormat({ fill: "#F6F8FA" })
  );
  mergeFormula(
    sheet,
    "L20:P20",
    '="今日一词："&\'计算区\'!$E$4&" · 经理："&\'计算区\'!$E$5',
    cardFormat({ fill: "#F6F8FA" })
  );
  mergeFormula(
    sheet,
    "L21:P22",
    '=IF(\'计算区\'!$E$6="","日期/时间：待检查","日期/时间："&TEXT(\'计算区\'!$E$6,"yyyy-mm-dd")&" "&TEXT(\'计算区\'!$E$7,"hh:mm")&"–"&TEXT(\'计算区\'!$E$8,"hh:mm"))',
    cardFormat({ fill: "#F6F8FA" })
  );
  mergeFormula(
    sheet,
    "L23:P23",
    '="地点："&\'计算区\'!$E$9',
    cardFormat({ fill: "#F6F8FA" })
  );
  mergeFormula(
    sheet,
    "L24:P24",
    '="解析角色数："&\'计算区\'!$E$12&" · 生成项目数："&\'计算区\'!$E$13',
    cardFormat({ fill: "#F6F8FA" })
  );
  mergeFormula(
    sheet,
    "L25:P25",
    '=IF(\'计算区\'!$E$11="","接龙字段已解析；切换来源后生效。",\'计算区\'!$E$11)',
    cardFormat({ fill: COLORS.warningBg })
  );
  mergeValue(
    sheet,
    "L26:P26",
    "未识别内容：完整原文保留在左侧；右侧未显示的内容请人工核对。",
    cardFormat({ fill: COLORS.rowGray })
  );

  applyBand(sheet, "A28:P28", "状态检查", { fill: COLORS.maroon, size: 11 });
  mergeFormula(
    sheet,
    "B30:P32",
    warningFormula(),
    {
      fill: COLORS.warningBg,
      font: { name: BASE_FONT, size: 10, bold: true, color: COLORS.warning },
      borders: { preset: "outside", style: "thin", color: "#D6B866" },
      verticalAlignment: "center",
      wrapText: true
    }
  );
  mergeValue(
    sheet,
    "B34:P34",
    "操作顺序：先选来源 → 检查“议程编辑”黄色修正列 → 查看 A4议程；超过30项时再打印 A4续页。",
    cardFormat({ fill: "#EEF4F7" })
  );

  for (const row of [4, 7, 10]) sheet.getRange(`A${row}:P${row}`).format.rowHeightPx = 38;
  sheet.getRange("A13:P14").format.rowHeightPx = 32;
  sheet.getRange("A18:P26").format.rowHeightPx = 24;
  sheet.getRange("A30:P32").format.rowHeightPx = 30;

  workbook.comments.setSelf({ displayName: "User" });
  workbook.comments.addThread(
    { cell: sheet.getRange("B18") },
    "粘贴完整微信接龙文字。先检查右侧解析预览；仅当议程来源选择“接龙导入”时，A4议程才采用解析结果。"
  );
  workbook.comments.addThread(
    { cell: sheet.getRange("B4") },
    "接龙导入、议程模板和手工编辑共用同一套修正与 A4 输出。"
  );
}

function templateItemFormula(column, itemIndex) {
  return `LET(v,IFERROR(INDEX(FILTER('模板库'!$${column}$2:$${column}$${TEMPLATE_LIBRARY_MAX_ROW},('模板库'!$B$2:$B$${TEMPLATE_LIBRARY_MAX_ROW}='操作台'!$F$4)*('模板库'!$E$2:$E$${TEMPLATE_LIBRARY_MAX_ROW}="item")),${itemIndex}),""),IF(OR(v="",v=0),"",v))`;
}

function relayItemFormula(column, itemIndex) {
  return `IFERROR(INDEX('计算区'!$${column}$5:$${column}$25,${itemIndex}),"")`;
}

function sourceFormula(templateFormula, relayFormula, manualFormula = '""') {
  return `=IF('操作台'!$B$4="议程模板",${templateFormula},IF('操作台'!$B$4="接龙导入",${relayFormula},${manualFormula}))`;
}

function writeAgendaEditor(sheet) {
  applyBodyFont(sheet, "A1:R63", 9);
  applyBand(sheet, "A1:Q2", "议程编辑与手工修正", {
    fill: COLORS.maroon,
    size: 15
  });
  sheet.getRange("R1:R2").merge();
  sheet.getRange("R1").values = [["辅助"]];
  sheet.getRange("R1:R2").format = {
    fill: COLORS.blueDeep,
    font: { name: BASE_FONT, size: 9, bold: true, color: COLORS.surface },
    horizontalAlignment: "center",
    verticalAlignment: "center"
  };

  const headers = [[
    "序号",
    "项目键",
    "分组编号",
    "分组名称",
    "类型",
    "自动开始时间",
    "来源标题",
    "来源说明",
    "来源时长",
    "来源排程分钟",
    "来源负责人",
    "修正标题",
    "修正说明",
    "修正时长",
    "修正排程分钟",
    "修正负责人",
    "状态"
  ]];
  sheet.getRange("A3:Q3").values = headers;
  sheet.getRange("R3").values = [["预计结束时间"]];
  sheet.getRange("S3").values = [["活动行"]];
  sheet.getRange("A4:A63").values = Array.from({ length: MAX_ITEMS }, (_, index) => [index + 1]);

  const formulas = { B: [], C: [], D: [], E: [], G: [], H: [], I: [], J: [], K: [] };
  for (let index = 0; index < MAX_ITEMS; index += 1) {
    const row = index + 4;
    const itemIndex = index + 1;
    const manualActive = `IF(COUNTA($L${row}:$P${row})>0,"manual-"&TEXT($A${row},"00"),"")`;
    formulas.B.push([sourceFormula(
      templateItemFormula("D", itemIndex),
      relayItemFormula("F", itemIndex),
      manualActive
    )]);
    formulas.C.push([sourceFormula(
      templateItemFormula("F", itemIndex),
      relayItemFormula("G", itemIndex),
      `IF(COUNTA($L${row}:$P${row})>0,1,"")`
    )]);
    formulas.D.push([sourceFormula(
      templateItemFormula("G", itemIndex),
      relayItemFormula("H", itemIndex),
      `IF(COUNTA($L${row}:$P${row})>0,"手工议程","")`
    )]);
    formulas.E.push([sourceFormula(
      templateItemFormula("M", itemIndex),
      relayItemFormula("N", itemIndex),
      `IF(COUNTA($L${row}:$P${row})>0,"plain","")`
    )]);
    formulas.G.push([sourceFormula(templateItemFormula("H", itemIndex), relayItemFormula("I", itemIndex))]);
    formulas.H.push([sourceFormula(templateItemFormula("I", itemIndex), '""')]);
    formulas.I.push([sourceFormula(templateItemFormula("J", itemIndex), relayItemFormula("J", itemIndex))]);
    formulas.J.push([sourceFormula(templateItemFormula("K", itemIndex), relayItemFormula("K", itemIndex))]);
    formulas.K.push([sourceFormula(templateItemFormula("L", itemIndex), relayItemFormula("M", itemIndex))]);
  }
  for (const [column, matrix] of Object.entries(formulas)) {
    sheet.getRange(`${column}4:${column}63`).formulas = matrix;
  }

  const meetingStart = `IF('操作台'!$B$4="接龙导入",IF('计算区'!$E$7<>"",'计算区'!$E$7,'操作台'!$F$10),'操作台'!$F$10)`;
  sheet.getRange("F4").formulas = [[`=IF($B4="","",${meetingStart})`]];
  sheet.getRange("F5:F63").formulas = Array.from({ length: MAX_ITEMS - 1 }, (_, index) => {
    const row = index + 5;
    const previous = row - 1;
    return [
      `=IF($B${row}="","",IF(COUNTIF($Q$4:$Q${previous},"*排程*")>0,"",IF(COUNTIF($B$4:$B${previous},"<>")=0,${meetingStart},MAX($R$4:$R${previous}))))`
    ];
  });

  sheet.getRange("Q4:Q63").formulas = Array.from({ length: MAX_ITEMS }, (_, index) => {
    const row = index + 4;
    const minutes = `IF($O${row}<>"",$O${row},$J${row})`;
    const person = `IF($P${row}<>"",$P${row},IF($K${row}="","待定",$K${row}))`;
    return [
      `=IF($B${row}="","",LET(m,${minutes},p,${person},title,IF($L${row}<>"",$L${row},$G${row}),TEXTJOIN("；",TRUE,IF(title="","缺少标题",""),IF(m="","缺少排程分钟",IF(NOT(ISNUMBER(m)),"排程分钟无效","")),IF(p="待定","负责人待定",""),IF(AND($A${row}>1,$F${row}=""),"前序排程中断",""))))`
    ];
  });
  sheet.getRange("R4:R63").formulas = Array.from({ length: MAX_ITEMS }, (_, index) => {
    const row = index + 4;
    return [
      `=IF($B${row}="","",IF(OR($F${row}="",IF($O${row}<>"",NOT(ISNUMBER($O${row})),NOT(ISNUMBER($J${row})))),"",$F${row}+IF($O${row}<>"",$O${row},$J${row})/1440))`
    ];
  });
  sheet.getRange("S4:S63").formulas = Array.from({ length: MAX_ITEMS }, (_, index) => {
    const row = index + 4;
    return [`=IF($B${row}="",0,1)`];
  });

  const table = sheet.tables.add("A3:Q63", true, "AgendaEditTable");
  table.style = "TableStyleMedium2";
  sheet.getRange("A3:R3").format = {
    fill: COLORS.blue,
    font: { name: BASE_FONT, size: 9, bold: true, color: COLORS.surface },
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange("A4:K63").format = {
    font: { name: BASE_FONT, size: 9, color: COLORS.ink },
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange("L4:P63").format = inputFormat({ wrapText: true });
  sheet.getRange("Q4:R63").format = {
    fill: "#F6F8FA",
    font: { name: BASE_FONT, size: 9, color: COLORS.ink2 },
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange("S1:S63").format.columnWidthPx = 2;
  sheet.getRange("F4:F63").format.numberFormat = "hh:mm";
  sheet.getRange("R4:R63").format.numberFormat = "hh:mm";
  sheet.getRange("O4:O63").dataValidation = {
    rule: { type: "whole", operator: "between", formula1: 0, formula2: 240 }
  };
  sheet.getRange("Q4:Q63").conditionalFormats.add("containsText", {
    text: "待定",
    format: { fill: COLORS.warningBg, font: { color: COLORS.warning, bold: true } }
  });
  sheet.getRange("Q4:Q63").conditionalFormats.add("containsText", {
    text: "排程",
    format: { fill: "#FDECEC", font: { color: "#9B1C1C", bold: true } }
  });

  setColumnWidths(
    sheet,
    [46, 116, 62, 118, 72, 82, 180, 220, 82, 84, 118, 180, 220, 82, 92, 118, 190, 84],
    63
  );
  sheet.getRange("A3:R3").format.rowHeightPx = 42;
  sheet.getRange("A4:R63").format.rowHeightPx = 36;
  sheet.freezePanes.freezeRows(3);
  sheet.freezePanes.freezeColumns(2);
}

function a4Header(sheet, overflow) {
  mergeValue(sheet, "A1:B2", "", {
    fill: COLORS.blueDeep,
    borders: { preset: "none" }
  });
  mergeValue(sheet, "C1:P2", defaultMeeting.clubNameEnglish, {
    fill: COLORS.blueDeep,
    font: { name: BASE_FONT, size: 15, bold: true, color: COLORS.surface },
    horizontalAlignment: "center",
    verticalAlignment: "center"
  });
  mergeFormula(
    sheet,
    "A3:P3",
    `="${defaultMeeting.clubName} · 第 "&${meetingChoiceFormula("$B$7", "$E$2").slice(1)}&" 期"`,
    {
      fill: COLORS.blue,
      font: { name: BASE_FONT, size: 14, bold: true, color: COLORS.surface },
      horizontalAlignment: "center",
      verticalAlignment: "center"
    }
  );
  mergeFormula(
    sheet,
    "A4:H4",
    `="主题："&${meetingChoiceFormula("$F$7", "$E$3").slice(1)}`,
    cardFormat({ fill: "#EAF1F5" })
  );
  mergeFormula(
    sheet,
    "I4:L4",
    `="今日一词："&${meetingChoiceFormula("$J$7", "$E$4").slice(1)}`,
    cardFormat({ fill: "#EAF1F5" })
  );
  mergeFormula(
    sheet,
    "M4:P4",
    `="例会经理："&${meetingChoiceFormula("$N$7", "$E$5").slice(1)}`,
    cardFormat({ fill: "#EAF1F5" })
  );
  mergeFormula(
    sheet,
    "A5:P5",
    `="日期："&TEXT(${meetingChoiceFormula("$B$10", "$E$6").slice(1)},"yyyy-mm-dd")&"   时间："&TEXT(${meetingChoiceFormula("$F$10", "$E$7").slice(1)},"hh:mm")&"–"&TEXT(${meetingChoiceFormula("$J$10", "$E$8").slice(1)},"hh:mm")&"   地点："&${meetingChoiceFormula("$B$13", "$E$9").slice(1)}`,
    {
      fill: "#F6F8FA",
      font: { name: BASE_FONT, size: 9, color: COLORS.ink },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      wrapText: true
    }
  );
  mergeValue(
    sheet,
    "A6:P6",
    overflow ? "续页 · 仅在议程超过30项时打印" : "表达 · 倾听 · 反馈 · 领导力",
    {
      fill: overflow ? COLORS.warningBg : COLORS.maroon,
      font: {
        name: BASE_FONT,
        size: 10,
        bold: true,
        color: overflow ? COLORS.warning : COLORS.surface
      },
      horizontalAlignment: "center",
      verticalAlignment: "center"
    }
  );
}

function a4LeftRail(sheet) {
  mergeValue(sheet, "A7:E7", "关于我们", {
    fill: COLORS.maroon,
    font: { name: BASE_FONT, size: 10, bold: true, color: COLORS.surface },
    verticalAlignment: "center"
  });
  mergeFormula(sheet, "A8:E13", "='基础资料'!$B$4", cardFormat());
  mergeValue(sheet, "A14:E14", "会议守则", {
    fill: COLORS.blue,
    font: { name: BASE_FONT, size: 10, bold: true, color: COLORS.surface },
    verticalAlignment: "center"
  });
  mergeFormula(sheet, "A15:E19", "='基础资料'!$B$14", cardFormat());
  mergeValue(sheet, "A20:E20", "关注我们 · 入会咨询", {
    fill: COLORS.maroon,
    font: { name: BASE_FONT, size: 10, bold: true, color: COLORS.surface },
    horizontalAlignment: "center",
    verticalAlignment: "center"
  });
  mergeValue(sheet, "A29:B29", "取伙二维码", {
    font: { name: BASE_FONT, size: 8, bold: true, color: COLORS.ink2 },
    horizontalAlignment: "center"
  });
  mergeValue(sheet, "C29:E29", "入会咨询二维码", {
    font: { name: BASE_FONT, size: 8, bold: true, color: COLORS.ink2 },
    horizontalAlignment: "center"
  });
  mergeValue(sheet, "A31:E31", "2026–2027 官员团队", {
    fill: COLORS.blue,
    font: { name: BASE_FONT, size: 10, bold: true, color: COLORS.surface },
    verticalAlignment: "center"
  });
  mergeFormula(sheet, "A32:E38", "='基础资料'!$B$16", cardFormat());
  mergeValue(sheet, "A39:E39", "下期预告", {
    fill: COLORS.maroon,
    font: { name: BASE_FONT, size: 10, bold: true, color: COLORS.surface },
    verticalAlignment: "center"
  });
  mergeFormula(
    sheet,
    "A40:E42",
    '="主题："&\'基础资料\'!$B$18&CHAR(10)&"日期："&\'基础资料\'!$B$19',
    cardFormat()
  );
}

function a4AgendaTable(sheet, startIndex) {
  mergeValue(sheet, "F7:H7", "分组", {
    fill: COLORS.blueDeep,
    font: { name: BASE_FONT, size: 9, bold: true, color: COLORS.surface },
    horizontalAlignment: "center",
    verticalAlignment: "center"
  });
  sheet.getRange("I7").values = [["时间"]];
  mergeValue(sheet, "J7:M7", "内容", {});
  sheet.getRange("N7").values = [["时长"]];
  mergeValue(sheet, "O7:P7", "负责人", {});
  sheet.getRange("I7:P7").format = {
    fill: COLORS.blueDeep,
    font: { name: BASE_FONT, size: 9, bold: true, color: COLORS.surface },
    horizontalAlignment: "center",
    verticalAlignment: "center"
  };

  const sourceStart = startIndex + 4;
  const sourceEnd = sourceStart + FIRST_PAGE_ITEMS - 1;
  for (let index = 0; index < FIRST_PAGE_ITEMS; index += 1) {
    const targetRow = index + 8;
    const sourceRow = startIndex + index + 4;
    const position = index + 1;
    const groupRange = `'议程编辑'!$C$${sourceStart}:$C$${sourceEnd}`;
    const groupMidpoint = `MATCH('议程编辑'!$C${sourceRow},${groupRange},0)+INT((COUNTIF(${groupRange},'议程编辑'!$C${sourceRow})-1)/2)`;
    sheet.getRange(`F${targetRow}`).formulas = [[
      `=IF('议程编辑'!$B${sourceRow}="","",IF(${position}=${groupMidpoint},'议程编辑'!$C${sourceRow},""))`
    ]];
    mergeFormula(
      sheet,
      `G${targetRow}:H${targetRow}`,
      `=IF('议程编辑'!$B${sourceRow}="","",IF(${position}=${groupMidpoint},'议程编辑'!$D${sourceRow},""))`
    );
    sheet.getRange(`I${targetRow}`).formulas = [[
      `=IF('议程编辑'!$B${sourceRow}="","",'议程编辑'!$F${sourceRow})`
    ]];
    mergeFormula(
      sheet,
      `J${targetRow}:M${targetRow}`,
      `=IF('议程编辑'!$B${sourceRow}="","",IF('议程编辑'!$L${sourceRow}<>"",'议程编辑'!$L${sourceRow},'议程编辑'!$G${sourceRow})&IF(IF('议程编辑'!$M${sourceRow}<>"",'议程编辑'!$M${sourceRow},'议程编辑'!$H${sourceRow})="","",CHAR(10)&IF('议程编辑'!$M${sourceRow}<>"",'议程编辑'!$M${sourceRow},'议程编辑'!$H${sourceRow})))`
    );
    sheet.getRange(`N${targetRow}`).formulas = [[
      `=IF('议程编辑'!$B${sourceRow}="","",IF('议程编辑'!$N${sourceRow}<>"",'议程编辑'!$N${sourceRow},'议程编辑'!$I${sourceRow}))`
    ]];
    mergeFormula(
      sheet,
      `O${targetRow}:P${targetRow}`,
      `=IF('议程编辑'!$B${sourceRow}="","",IF('议程编辑'!$P${sourceRow}<>"",'议程编辑'!$P${sourceRow},IF('议程编辑'!$K${sourceRow}="","待定",'议程编辑'!$K${sourceRow})))`
    );
  }

  sheet.getRange("F8:H37").format = {
    fill: COLORS.maroon,
    font: { name: BASE_FONT, size: 8, bold: true, color: COLORS.surface },
    borders: {
      insideVertical: { style: "thin", color: "#9A5260" },
      left: { style: "thin", color: COLORS.maroon },
      right: { style: "thin", color: COLORS.maroon }
    },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange("I8:P37").format = {
    fill: COLORS.surface,
    font: { name: BASE_FONT, size: 8, color: COLORS.ink },
    borders: { preset: "all", style: "thin", color: COLORS.border },
    verticalAlignment: "center",
    wrapText: true
  };
  sheet.getRange("I8:I37").format = {
    font: { name: BASE_FONT, size: 8, bold: true, color: COLORS.blueDeep },
    numberFormat: "hh:mm",
    horizontalAlignment: "center",
    verticalAlignment: "center"
  };
  sheet.getRange("N8:P37").format.horizontalAlignment = "center";

  const sourceTypeRow = startIndex + 4;
  sheet.getRange("I8:P37").conditionalFormats.addCustom(
    `='议程编辑'!$E${sourceTypeRow}="impromptu"`,
    { fill: COLORS.rowBlue }
  );
  sheet.getRange("I8:P37").conditionalFormats.addCustom(
    `='议程编辑'!$E${sourceTypeRow}="prepared"`,
    { fill: COLORS.rowGreen }
  );
  sheet.getRange("I8:P37").conditionalFormats.addCustom(
    `='议程编辑'!$E${sourceTypeRow}="break"`,
    {
      fill: COLORS.rowGray,
      border: { left: { style: "medium", color: COLORS.blueDeep } }
    }
  );
  sheet.getRange("O8:P37").conditionalFormats.add("containsText", {
    text: "待定",
    format: { fill: COLORS.warningBg, font: { color: COLORS.warning, bold: true } }
  });
}

async function writeA4Page(sheet, { startIndex, overflow }) {
  applyBodyFont(sheet, "A1:P48", 9);
  setColumnWidths(
    sheet,
    [24, 46, 46, 46, 38, 20, 40, 42, 48, 30, 68, 68, 52, 46, 48, 48],
    48
  );
  a4Header(sheet, overflow);
  a4LeftRail(sheet);
  a4AgendaTable(sheet, startIndex);

  mergeFormula(
    sheet,
    "A44:M48",
    "='基础资料'!$B$20&CHAR(10)&'基础资料'!$B$17",
    {
      fill: "#F6F8FA",
      font: { name: BASE_FONT, size: 9, color: COLORS.ink },
      borders: { preset: "outside", style: "thin", color: COLORS.border },
      verticalAlignment: "center",
      wrapText: true
    }
  );
  mergeValue(sheet, "N44:P48", "", {
    fill: COLORS.surface,
    borders: { preset: "outside", style: "thin", color: COLORS.border }
  });
  if (overflow) {
    mergeFormula(
      sheet,
      "F39:P42",
      '=IF(SUM(\'议程编辑\'!$S$34:$S$63)=0,"本页无超出项目","续页项目："&SUM(\'议程编辑\'!$S$34:$S$63)&" 项")',
      cardFormat({ fill: COLORS.warningBg })
    );
  } else {
    mergeFormula(
      sheet,
      "F39:P42",
      '=IF(SUM(\'议程编辑\'!$S$4:$S$63)>30,"议程超过30项，请同时打印 A4续页。","首页容量正常（最多30项）。")',
      cardFormat({ fill: "#EEF4F7" })
    );
  }

  await addImage(sheet, assets.logo, { row: 0, col: 0 }, { widthPx: 96, heightPx: 54 });
  await addImage(sheet, assets.quhuo, { row: 20, col: 0 }, { widthPx: 84, heightPx: 84 });
  await addImage(sheet, assets.join, { row: 20, col: 3 }, { widthPx: 84, heightPx: 84 });
  await addImage(sheet, assets.vote, { row: 43, col: 13 }, { widthPx: 64, heightPx: 64 });

  sheet.getRange("A1:P2").format.rowHeightPx = 28;
  sheet.getRange("A3:P3").format.rowHeightPx = 28;
  sheet.getRange("A4:P6").format.rowHeightPx = 22;
  sheet.getRange("A7:P7").format.rowHeightPx = 24;
  sheet.getRange("A8:P37").format.rowHeightPx = 22;
  sheet.getRange("A44:P48").format.rowHeightPx = 22;
}

const workbook = Workbook.create();
const sheets = new Map();
for (const name of SHEETS) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  sheets.set(name, sheet);
}

writeTemplateLibrary(sheets.get("模板库"));
await writeBaseData(sheets.get("基础资料"));
writeCalculationSheet(sheets.get("计算区"));
writeDashboard(sheets.get("操作台"), workbook);
writeAgendaEditor(sheets.get("议程编辑"));
await writeA4Page(sheets.get("A4议程"), { startIndex: 0, overflow: false });
await writeA4Page(sheets.get("A4续页"), {
  startIndex: FIRST_PAGE_ITEMS,
  overflow: true
});

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
await fs.rm(`${outputPath}.inspect.ndjson`, { force: true });

console.log(outputPath);

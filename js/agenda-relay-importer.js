(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMAgendaRelayImporter = api;
  root.parseRelayText = api.parseRelayText;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const PENDING_VALUE = "待定";
  const PENDING_PATTERN = /^(?:待定|待报名|空|tbd|n\/a|na|none|null|-|—|--|无)$/i;
  const ROLE_ALIASES = new Map([
    ["主席致词", "主席致辞"],
    ["颁奖＆真情分享", "颁奖&真情分享"],
    ["颁奖和真情分享", "颁奖&真情分享"],
    ["颁奖/真情分享", "颁奖&真情分享"],
    ["颁奖 / 真情分享", "颁奖&真情分享"]
  ]);
  const ROLE_KEYS = new Set([
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
  ]);
  const RELAY_FIELD_PATTERN = [
    "主题",
    "今日一词",
    "例会经理",
    "时间",
    "地点",
    "事务官开场",
    "主席致辞",
    "主席致词",
    "总主持",
    "来宾介绍",
    "时间官",
    "哼哈官",
    "语法官",
    "提问官",
    "即兴主持",
    "备稿演讲[123]",
    "即兴点评",
    "备稿点评[123]",
    "总点评",
    "颁奖\\s*(?:&|＆|/|和)\\s*真情分享",
    "拍照侠"
  ].join("|");
  const RELAY_FIELD_BOUNDARY = new RegExp(`\\s+(${RELAY_FIELD_PATTERN})\\s*([:：])`, "g");

  function normalizeSpaces(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\u3000/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function normalizeText(text) {
    const normalizedLines = String(text ?? "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map(normalizeSpaces)
      .filter(Boolean);
    if (normalizedLines.length !== 1) return normalizedLines;

    return normalizedLines[0]
      .replace(RELAY_FIELD_BOUNDARY, "\n$1$2")
      .split("\n")
      .map(normalizeSpaces)
      .filter(Boolean);
  }

  function stripEmojiTokens(value) {
    return normalizeSpaces(value).replace(/\[[^\]]+\]/g, "").trim();
  }

  function normalizePerson(value) {
    const text = normalizeSpaces(value);
    if (!text) return PENDING_VALUE;
    const withoutTokens = stripEmojiTokens(text);
    if (!withoutTokens) return PENDING_VALUE;
    if (PENDING_PATTERN.test(withoutTokens)) return PENDING_VALUE;
    return withoutTokens;
  }

  function pickPerson(currentValue, nextValue) {
    const current = normalizePerson(currentValue);
    const next = normalizePerson(nextValue);
    if (next === PENDING_VALUE && current !== PENDING_VALUE) return current;
    return next;
  }

  function normalizeRoleKey(key) {
    const compact = normalizeSpaces(key).replace(/\s+/g, "");
    return ROLE_ALIASES.get(compact) || compact;
  }

  function splitKeyValue(line) {
    const match = line.match(/^([^:：]+)[:：](.*)$/);
    if (!match) return null;
    return {
      key: normalizeRoleKey(match[1]),
      value: normalizeSpaces(match[2])
    };
  }

  function parseMeetingNo(line) {
    const match = line.match(/畅言\s*(\d+)\s*期(?:报名帖|报名|例会)?/);
    return match ? match[1] : "";
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function parseDateTime(value, now) {
    const text = normalizeSpaces(value);
    const match = text.match(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日?.*?(\d{1,2})[:：](\d{2})\s*(?:-|–|—|~|～|至|到)\s*(\d{1,2})[:：](\d{2})/);
    if (!match) return {};
    const year = Number(match[1] || now.getFullYear());
    const month = Number(match[2]);
    const day = Number(match[3]);
    const startHour = Number(match[4]);
    const startMinute = Number(match[5]);
    const endHour = Number(match[6]);
    const endMinute = Number(match[7]);
    if ([year, month, day, startHour, startMinute, endHour, endMinute].some((part) => !Number.isFinite(part))) {
      return {};
    }
    return {
      date: `${year}-${pad2(month)}-${pad2(day)}`,
      startTime: `${pad2(startHour)}:${pad2(startMinute)}`,
      endTime: `${pad2(endHour)}:${pad2(endMinute)}`
    };
  }

  function mergeField(target, field, value) {
    const next = normalizeSpaces(value);
    if (!next) return;
    target[field] = next;
  }

  function mergePersonField(target, field, value) {
    target[field] = pickPerson(target[field], value);
  }

  function mergeRoleField(target, role, value) {
    target.roles[role] = pickPerson(target.roles[role], value);
  }

  function createPost() {
    return {
      meetingNo: "",
      theme: "",
      wordOfDay: "",
      manager: "",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      roles: {}
    };
  }

  function parsePostLines(lines, now) {
    const post = createPost();
    lines.forEach((line) => {
      const meetingNo = parseMeetingNo(line);
      if (meetingNo) post.meetingNo = meetingNo;

      const pair = splitKeyValue(line);
      if (!pair) return;
      if (pair.key === "主题") mergeField(post, "theme", pair.value);
      if (pair.key === "今日一词") mergeField(post, "wordOfDay", pair.value);
      if (pair.key === "例会经理") mergePersonField(post, "manager", pair.value);
      if (pair.key === "地点") mergeField(post, "location", pair.value);
      if (pair.key === "时间") {
        const parsedTime = parseDateTime(pair.value, now);
        mergeField(post, "date", parsedTime.date);
        mergeField(post, "startTime", parsedTime.startTime);
        mergeField(post, "endTime", parsedTime.endTime);
      }
      if (ROLE_KEYS.has(pair.key)) mergeRoleField(post, pair.key, pair.value);
    });
    return post;
  }

  function splitPosts(lines) {
    const posts = [];
    let current = [];
    lines.forEach((line) => {
      if (parseMeetingNo(line) && current.length) {
        posts.push(current);
        current = [];
      }
      current.push(line);
    });
    if (current.length) posts.push(current);
    return posts;
  }

  function mergePost(target, post) {
    ["meetingNo", "theme", "wordOfDay", "date", "startTime", "endTime", "location"].forEach((field) => {
      mergeField(target, field, post[field]);
    });
    if (post.manager) mergePersonField(target, "manager", post.manager);
    Object.entries(post.roles).forEach(([role, value]) => mergeRoleField(target, role, value));
  }

  function roleValue(roles, role) {
    return normalizePerson(roles[role]);
  }

  function addRoleItem(items, roles, role, id, title, duration, extra = {}) {
    if (!Object.prototype.hasOwnProperty.call(roles, role)) return;
    items.push({
      id,
      kind: "item",
      title,
      duration,
      ...extra,
      person: roleValue(roles, role)
    });
  }

  function addNumberedRoleItems(items, roles, prefix, idPrefix, duration) {
    const hasAny = [1, 2, 3].some((index) => Object.prototype.hasOwnProperty.call(roles, `${prefix}${index}`));
    if (!hasAny) return;
    [1, 2, 3].forEach((index) => {
      const role = `${prefix}${index}`;
      items.push({
        id: `${idPrefix}-${index}`,
        kind: "item",
        title: role,
        duration,
        person: roleValue(roles, role)
      });
    });
  }

  const OFFICER_ROLE_ITEMS = [
    {
      role: "时间官",
      declarationId: "relay-i-timer-declaration",
      declarationTitle: "时间官宣言",
      reportId: "relay-i-timer-report",
      reportTitle: "时间官报告"
    },
    {
      role: "语法官",
      declarationId: "relay-i-grammarian-declaration",
      declarationTitle: "语法官宣言",
      reportId: "relay-i-grammarian-report",
      reportTitle: "语法官报告"
    },
    {
      role: "哼哈官",
      declarationId: "relay-i-ah-counter-declaration",
      declarationTitle: "哼哈官宣言",
      reportId: "relay-i-ah-counter-report",
      reportTitle: "哼哈官报告"
    }
  ];

  function addOfficerRoleItems(items, roles, variant) {
    OFFICER_ROLE_ITEMS.forEach((officer) => {
      if (!Object.prototype.hasOwnProperty.call(roles, officer.role)) return;
      const isReport = variant === "report";
      items.push({
        id: isReport ? officer.reportId : officer.declarationId,
        kind: "item",
        title: isReport ? officer.reportTitle : officer.declarationTitle,
        duration: isReport ? "3" : "2",
        person: roleValue(roles, officer.role)
      });
    });
  }

  function sectionItem(id, title) {
    return {
      id,
      kind: "section",
      title
    };
  }

  function appendSection(items, id, title, sectionItems) {
    if (!sectionItems.length) return;
    items.push(sectionItem(id, title), ...sectionItems);
  }

  function buildItems(roles) {
    const items = [];
    const openingItems = [];
    addRoleItem(openingItems, roles, "事务官开场", "relay-i-officer-open", "事务官开场", "1");
    addRoleItem(openingItems, roles, "主席致辞", "relay-i-president", "主席致辞", "3");
    addRoleItem(openingItems, roles, "总主持", "relay-i-host-open", "总主持开场，介绍会议流程", "3");
    addRoleItem(openingItems, roles, "来宾介绍", "relay-i-guest-intro", "来宾介绍", "5");
    addOfficerRoleItems(openingItems, roles, "declaration");
    appendSection(items, "relay-s-opening", "开场环节", openingItems);

    const impromptuItems = [];
    addRoleItem(impromptuItems, roles, "即兴主持", "relay-i-impromptu", "即兴演讲", "15", { durationNote: "2min/人" });
    appendSection(items, "relay-s-impromptu", "即兴马拉松", impromptuItems);

    const preparedItems = [];
    addNumberedRoleItems(preparedItems, roles, "备稿演讲", "relay-i-prepared", "5-7");
    appendSection(items, "relay-s-prepared", "精心演讲环节", preparedItems);

    const feedbackItems = [];
    addRoleItem(feedbackItems, roles, "即兴点评", "relay-i-impromptu-eval", "即兴点评", "5");
    addNumberedRoleItems(feedbackItems, roles, "备稿点评", "relay-i-prepared-eval", "3");
    addOfficerRoleItems(feedbackItems, roles, "report");
    addRoleItem(feedbackItems, roles, "总点评", "relay-i-general-eval", "总点评", "8");
    appendSection(items, "relay-s-feedback", "茶歇&会议反馈环节", feedbackItems);

    const sharingItems = [];
    addRoleItem(sharingItems, roles, "颁奖&真情分享", "relay-i-award-share", "颁奖&真情分享", "5");
    addRoleItem(sharingItems, roles, "拍照侠", "relay-i-photo", "拍照侠 / 大合照", "3");
    appendSection(items, "relay-s-sharing", "分享环节", sharingItems);
    return items;
  }

  function buildWarnings(result, now) {
    const warnings = [];
    if (result.date) {
      const [year, month, day] = result.date.split("-").map(Number);
      const parsedDate = new Date(year, month - 1, day);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysPast = (today.getTime() - parsedDate.getTime()) / 86400000;
      if (daysPast > 180) {
        warnings.push({
          code: "date-past",
          message: "接龙日期距离当前日期较久，请确认年份是否正确。"
        });
      }
    }
    return warnings;
  }

  function parseRelayText(text, options = {}) {
    const now = options.now instanceof Date ? options.now : new Date();
    const lines = normalizeText(text);
    const merged = createPost();
    splitPosts(lines)
      .map((postLines) => parsePostLines(postLines, now))
      .forEach((post) => mergePost(merged, post));

    const result = {
      meetingNo: merged.meetingNo,
      theme: merged.theme,
      wordOfDay: merged.wordOfDay,
      manager: normalizePerson(merged.manager),
      date: merged.date,
      startTime: merged.startTime,
      endTime: merged.endTime,
      location: merged.location,
      items: buildItems(merged.roles),
      warnings: []
    };
    if (!merged.manager) result.manager = "";
    result.warnings = buildWarnings(result, now);
    return result;
  }

  return {
    parseRelayText,
    normalizePerson
  };
});

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMAgendaTemplates = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const GUEST_PARTICIPATION_TAGS = ["来宾介绍", "即兴演讲", "话题分词"];
  const GUEST_PARTICIPATION_NOTE = "无需经验，欢迎第一次参加";
  const DEFAULT_MEETING_RULES = [
    "手机请调至静音",
    "请留意时间官提示",
    "欢迎鼓掌、反馈与投票",
    "入会咨询请联系会员副会长"
  ];
  const DEFAULT_OFFICERS = [
    "President会长：贾燕微",
    "VPE 教育副会长：莫婷",
    "VPM 会员副会长：Jessica",
    "VPPR 公关副会长：史迪仔",
    "Secretary 秘书：女侠",
    "Treasurer 财务：聪聪",
    "Sergeant at Arms 接待官：Venus Deng斯敏"
  ].join("\n");
  const LEGACY_DEFAULT_OFFICERS = [
    [
      "会长：卡卡  秘书长：浩岩",
      "教育副会长：斯敏  财务官：燕薇",
      "会员副会长：莫婷  事务官：文星",
      "公关副会长：聪聪"
    ].join("\n"),
    [
      "会长：女侠  秘书长：夏奈",
      "教育副会长：聪聪  财务官：王兵伟",
      "会员副会长：Venus斯敏  事务官：Jeff",
      "公关副会长：水杨酸"
    ].join("\n")
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function baseAgendaData(overrides = {}) {
    return {
      clubName: "畅言中文国际演讲俱乐部",
      clubNameEnglish: "Charm Voice Mandarin Toastmasters Club",
      meetingNo: "782",
      theme: "复盘：我过的怎么样",
      wordOfDay: "看见",
      date: "2026-06-30",
      startTime: "19:20",
      endTime: "21:30",
      location: "深圳市南山区科技园讯美科技广场3号楼4楼SPACE MAX会议室(高新中A出口)",
      manager: "斯敏",
      posterDesigner: "Jessica",
      logoData: "",
      wechatQrData: "",
      joinQrData: "",
      voteQrData: "",
      nextTheme: "人生暂停5分钟",
      nextMeetingDate: "2026-07-07",
      nextMeetingTime: "",
      residentPeople: "女侠\n聪聪\nVenus斯敏\n纳纳\nIsabel\nRui（Soar High）\nDavid（MAD）\n筠筠\n卡卡\n水杨酸\nJeff\nJessica\n莫婷\n燕微\n晓墨（D118大区 Elect CGD）\n冰洁（D2 Past AD）\n神秘人",
      clubIntro: "畅言中文国际演讲俱乐部，成立于2009年，是南山第一家中文俱乐部，隶属于第118大区、D中区、D5小区。\n愿景：打造全球最具人格魅力的演讲俱乐部。\n每周二晚，我们一起练习表达、倾听、反馈与领导力。",
      officers: DEFAULT_OFFICERS,
      meetingRules: DEFAULT_MEETING_RULES.join("\n"),
      meetingVision: "会议愿景：很开心与大家建立一种愉悦的学习旅程，谢谢大家~",
      guestInvitation: `【${GUEST_PARTICIPATION_TAGS.join("】 【")}】
${GUEST_PARTICIPATION_NOTE}`,
      items: [],
      ...overrides
    };
  }

  const REGULAR_MEETING_DATA = baseAgendaData({
    items: [
      { id: "s-open", kind: "section", title: "一、开场环节" },
      { id: "i-guest-checkin", kind: "item", time: "19:20", title: "来宾入会，相互认识与交流", detail: "", duration: "5", person: "全体会员" },
      { id: "i-warmup", kind: "item", time: "19:25", title: "暖场互动", detail: "", duration: "5", person: "全体会员" },
      { id: "i-rules", kind: "item", time: "19:30", title: "事务官宣布会议规则", detail: "", duration: "1", person: "文星" },
      { id: "i-president", kind: "item", time: "19:31", title: "主席致词", detail: "", duration: "3", person: "卡卡" },
      { id: "i-host-open", kind: "item", time: "19:34", title: "总主持开场，介绍会议流程", detail: "", duration: "2", person: "" },
      { id: "i-timer-declare", kind: "item", time: "19:36", title: "时间官宣言", detail: "", duration: "2", person: "卡卡" },
      { id: "i-ah-declare", kind: "item", time: "19:38", title: "哼哈官宣言", detail: "", duration: "2", person: "亮哥" },
      { id: "i-grammar-declare", kind: "item", time: "19:40", title: "语法官宣言", detail: "", duration: "2", person: "Jessica" },
      { id: "s-impromptu", kind: "section", title: "二、即兴演讲" },
      { id: "i-impromptu-rule", kind: "item", time: "19:42", title: "即兴主持介绍规则", detail: "", duration: "2", person: "史迪仔" },
      { id: "i-impromptu", kind: "item", time: "19:44", title: "即兴演讲", detail: "", duration: "16", durationNote: "2min/人", person: "全员" },
      { id: "s-prepared", kind: "section", title: "三、精心演讲环节" },
      { id: "i-prepared-intro", kind: "item", time: "20:00", title: "总主持人介绍本环节+串场", detail: "", duration: "2", person: "" },
      { id: "i-speech-1", kind: "item", time: "20:02", title: "《今天只做一件事 》自由演讲", detail: "自由演讲", duration: "5", person: "文星" },
      { id: "i-speech-2", kind: "item", time: "20:07", title: "《工作就是排忧解难》Level 4 在困境中领导", detail: "练习针对意外变化进行调整以确定最终计划的策略。", duration: "15-20", person: "Venus斯敏" },
      { id: "i-guests", kind: "item", time: "20:27", title: "来宾介绍", detail: "", duration: "5", person: "莫婷" },
      { id: "i-surprise", kind: "item", time: "20:32", title: "惊喜环节", detail: "", duration: "7", person: "聪聪、春晖" },
      { id: "s-feedback", kind: "section", title: "四、茶歇&会议反馈环节" },
      { id: "i-break", kind: "item", time: "20:39", title: "茶歇+大合照", detail: "", duration: "5", person: "全场人员" },
      { id: "i-feedback-intro", kind: "item", time: "20:44", title: "总主持人介绍本环节+串场", detail: "", duration: "4", person: "" },
      { id: "i-impromptu-eval", kind: "item", time: "20:48", title: "即兴点评", detail: "", duration: "8", person: "莫婷" },
      { id: "i-eval-1", kind: "item", time: "20:56", title: "备稿点评 -《今天只做一件事 》", detail: "", duration: "3", person: "女侠" },
      { id: "i-eval-2", kind: "item", time: "20:59", title: "备稿点评 -《工作就是排忧解难》", detail: "", duration: "3", person: "燕微" },
      { id: "i-grammar-report", kind: "item", time: "21:02", title: "语法官报告", detail: "", duration: "3", person: "Jessica" },
      { id: "i-ah-report", kind: "item", time: "21:05", title: "哼哈官报告", detail: "", duration: "3", person: "亮哥" },
      { id: "i-timer-report", kind: "item", time: "21:08", title: "时间官报告", detail: "", duration: "3", person: "卡卡" },
      { id: "i-vote", kind: "item", time: "21:11", title: "电子投票", detail: "", duration: "1", person: "卡卡" },
      { id: "i-general-eval", kind: "item", time: "21:12", title: "总点评", detail: "", duration: "8", person: "春晖" },
      { id: "s-share", kind: "section", title: "五、分享环节" },
      { id: "i-award", kind: "item", time: "21:20", title: "颁奖&真情分享", detail: "", duration: "5", person: "卡卡" },
      { id: "i-close", kind: "item", time: "21:25", title: "主席总结本期活动，结束会议", detail: "", duration: "1", person: "卡卡" }
    ]
  });

  const IMPROMPTU_MARATHON_DATA = baseAgendaData({
    meetingNo: "740",
    theme: "即兴马拉松",
    wordOfDay: "灵机一动",
    meetingVision: "会议愿景：让每一位伙伴都能上台开口，在轻松反馈中快速成长。",
    guestInvitation: `【${GUEST_PARTICIPATION_TAGS.join("】 【")}】
${GUEST_PARTICIPATION_NOTE}`,
    items: [
      { id: "s-open", kind: "section", title: "一、开场与规则" },
      { id: "i-guest-checkin", kind: "item", time: "19:15", title: "来宾入会，相互认识与交流", detail: "", duration: "10", person: "全体会员" },
      { id: "i-warmup", kind: "item", time: "19:25", title: "暖场互动", detail: "快速破冰，帮助来宾进入状态", duration: "5", person: "全体会员" },
      { id: "i-rules", kind: "item", time: "19:30", title: "事务官宣布会议规则", detail: "", duration: "1", person: "事务官" },
      { id: "i-president", kind: "item", time: "19:31", title: "主席致词", detail: "", duration: "3", person: "主席" },
      { id: "i-host-open", kind: "item", time: "19:34", title: "总主持开场，介绍即兴马拉松规则", detail: "说明抽题、计时、投票与反馈方式", duration: "4", person: "总主持" },
      { id: "i-timer-declare", kind: "item", time: "19:38", title: "时间官宣言", detail: "", duration: "2", person: "时间官" },
      { id: "s-round-1", kind: "section", title: "二、即兴马拉松 Round 1" },
      { id: "i-impromptu-rule-1", kind: "item", time: "19:40", title: "即兴主持介绍第一轮题目", detail: "轻松题，鼓励来宾参与", duration: "3", person: "即兴主持" },
      { id: "i-impromptu-1", kind: "item", time: "19:43", title: "即兴演讲 Round 1", detail: "每人抽题后上台表达", duration: "20", durationNote: "2min/人", person: "现场所有人" },
      { id: "i-mini-feedback-1", kind: "item", time: "20:03", title: "即时反馈与亮点记录", detail: "记录金句、表达亮点与可改进点", duration: "5", person: "点评官" },
      { id: "s-round-2", kind: "section", title: "三、即兴马拉松 Round 2" },
      { id: "i-impromptu-rule-2", kind: "item", time: "20:08", title: "即兴主持介绍第二轮挑战", detail: "加入关键词或情境限制", duration: "3", person: "即兴主持" },
      { id: "i-impromptu-2", kind: "item", time: "20:11", title: "即兴演讲 Round 2", detail: "挑战更完整的观点结构", duration: "20", durationNote: "2min/人", person: "现场所有人" },
      { id: "i-break", kind: "item", time: "20:31", title: "茶歇+大合照", detail: "", duration: "6", person: "全场人员" },
      { id: "s-feedback", kind: "section", title: "四、点评与报告" },
      { id: "i-impromptu-eval", kind: "item", time: "20:37", title: "即兴点评", detail: "针对两轮即兴演讲做整体反馈", duration: "10", person: "即兴点评官" },
      { id: "i-ah-report", kind: "item", time: "20:47", title: "哼哈官报告", detail: "", duration: "3", person: "哼哈官" },
      { id: "i-timer-report", kind: "item", time: "20:50", title: "时间官报告", detail: "", duration: "3", person: "时间官" },
      { id: "i-vote", kind: "item", time: "20:53", title: "电子投票", detail: "评选最佳即兴演讲与最佳进步", duration: "2", person: "投票官" },
      { id: "i-general-eval", kind: "item", time: "20:55", title: "总点评", detail: "", duration: "8", person: "总点评官" },
      { id: "s-close", kind: "section", title: "五、颁奖与结束" },
      { id: "i-award", kind: "item", time: "21:03", title: "颁奖&真情分享", detail: "", duration: "8", person: "主席" },
      { id: "i-close", kind: "item", time: "21:11", title: "主席总结本期活动，结束会议", detail: "", duration: "4", person: "主席" }
    ]
  });

  const TEMPLATES = [
    {
      id: "regular-meeting",
      name: "常规例会模板",
      description: "包含开场、即兴、备稿、点评、报告与颁奖的完整例会流程。",
      data: REGULAR_MEETING_DATA
    },
    {
      id: "impromptu-marathon",
      name: "即兴马拉松模板",
      description: "强化多人即兴演讲与快速反馈，适合来宾多或练习表达的特别场。",
      data: IMPROMPTU_MARATHON_DATA
    }
  ];

  function listTemplates() {
    return TEMPLATES.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      itemCount: template.data.items.filter((item) => item.kind !== "section").length
    }));
  }

  function getTemplate(idOrName) {
    const template = TEMPLATES.find((item) => item.id === idOrName || item.name === idOrName);
    if (!template) return null;
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      data: clone(template.data)
    };
  }

  function getDefaultData() {
    return clone(REGULAR_MEETING_DATA);
  }

  // “全体会员”这类集体值属于流程结构，套用模板时保留；具体人名清空。
  const COLLECTIVE_PERSON_PATTERN = /^(?:全体会员|全场人员|现场所有人|全员|ALL)$/i;

  function isSpeechTitle(title) {
    return !/点评/.test(title) && (/备稿/.test(title) || /《/.test(title) || /自由演讲/.test(title));
  }

  function isSpeechEvalTitle(title) {
    return /点评/.test(title) && !/即兴/.test(title) && !/总点评/.test(title) && (/备稿/.test(title) || /《/.test(title));
  }

  function skeletonItems(items) {
    let speechIndex = 0;
    let evalIndex = 0;
    return (items || []).map((item) => {
      if (item.kind !== "item") return { ...item };
      const next = { ...item };
      const title = String(next.title || "");
      if (isSpeechTitle(title)) {
        speechIndex += 1;
        next.title = `备稿演讲${speechIndex}`;
        next.detail = "";
      } else if (isSpeechEvalTitle(title)) {
        evalIndex += 1;
        next.title = `备稿点评${evalIndex}`;
        next.detail = "";
      }
      if (!COLLECTIVE_PERSON_PATTERN.test(String(next.person || "").trim())) {
        next.person = "";
      }
      return next;
    });
  }

  // 模板骨架：只包含流程结构（环节、时长、开始/结束时间），
  // 人员留空、往期演讲题目改回通用名，供“接龙导入”往里填人。
  function getTemplateSkeleton(idOrName) {
    const template = getTemplate(idOrName);
    if (!template) return null;
    return {
      id: template.id,
      name: template.name,
      startTime: template.data.startTime || "",
      endTime: template.data.endTime || "",
      items: skeletonItems(template.data.items)
    };
  }

  return {
    DEFAULT_MEETING_RULES,
    DEFAULT_OFFICERS,
    LEGACY_DEFAULT_OFFICERS,
    GUEST_PARTICIPATION_TAGS,
    GUEST_PARTICIPATION_NOTE,
    listTemplates,
    getTemplate,
    getTemplateSkeleton,
    getDefaultData
  };
});

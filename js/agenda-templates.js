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
    "会长：卡卡  秘书长：浩岩",
    "教育副会长：斯敏  财务官：燕薇",
    "会员副会长：莫婷  事务官：文星",
    "公关副会长：聪聪"
  ].join("\n");
  const LEGACY_DEFAULT_OFFICERS = [
    "会长：女侠  秘书长：夏奈",
    "教育副会长：聪聪  财务官：王兵伟",
    "会员副会长：Venus斯敏  事务官：Jeff",
    "公关副会长：水杨酸"
  ].join("\n");

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function baseAgendaData(overrides = {}) {
    return {
      clubName: "畅言中文国际演讲俱乐部",
      clubNameEnglish: "Charm Voice Mandarin Toastmasters Club",
      meetingNo: "739",
      theme: "去运动",
      wordOfDay: "越来越好",
      date: "2025-07-15",
      startTime: "19:25",
      endTime: "21:30",
      location: "深圳市南山区科技园讯美科技广场3号楼4楼SPACE MAX会议室(高新中A出口)",
      manager: "卡卡",
      posterDesigner: "水杨酸",
      logoData: "",
      wechatQrData: "",
      joinQrData: "",
      voteQrData: "",
      nextTheme: "夏日穿搭",
      nextMeetingDate: "",
      nextMeetingTime: "",
      residentPeople: "女侠\nMaggie\nBell\n聪聪\nVenus斯敏\n纳纳\nIsabel\nRui（Soar High）\nDavid（MAD）\n筠筠\n卡卡\n水杨酸\nJeff",
      clubIntro: "畅言中文国际演讲俱乐部，成立于2009年，是南山第一家中文俱乐部，隶属于第118大区、D中区、D2小区。\n愿景：打造全球最具人格魅力的演讲俱乐部。\n每周二晚，我们一起练习表达、倾听、反馈与领导力。",
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
      { id: "i-guest-checkin", kind: "item", time: "19:15", title: "来宾入会，相互认识与交流", detail: "", duration: "10", person: "全体会员" },
      { id: "i-warmup", kind: "item", time: "19:25", title: "暖场互动", detail: "", duration: "5", person: "全体会员" },
      { id: "i-rules", kind: "item", time: "19:30", title: "事务官宣布会议规则", detail: "", duration: "1", person: "女侠" },
      { id: "i-president", kind: "item", time: "19:32", title: "主席致词", detail: "", duration: "3", person: "女侠" },
      { id: "i-host-open", kind: "item", time: "19:35", title: "总主持开场，介绍会议流程", detail: "30秒 × 4 + 1", duration: "3", person: "女侠" },
      { id: "i-timer-declare", kind: "item", time: "19:38", title: "时间官宣言", detail: "", duration: "2", person: "纳纳（来宾）" },
      { id: "i-ah-declare", kind: "item", time: "19:41", title: "哼哈官宣言", detail: "", duration: "2", person: "Isabel（来宾）" },
      { id: "s-impromptu", kind: "section", title: "二、即兴马拉松" },
      { id: "i-impromptu", kind: "item", time: "19:43", title: "即兴演讲", detail: "即兴主持介绍规则\n即兴主持人设计规则，现场所有人参与", duration: "15", durationNote: "2min/人", person: "Maggie" },
      { id: "s-prepared", kind: "section", title: "三、精心演讲环节" },
      { id: "i-prepared-intro", kind: "item", time: "20:04", title: "总主持人介绍本环节+串场", detail: "30秒 × 4", duration: "2", person: "女侠" },
      { id: "i-speech-1", kind: "item", time: "20:06", title: "精心备稿1", detail: "《选择和努力》PM L1-2 撰写带有目的性的演讲稿", duration: "5-7", person: "Maggie" },
      { id: "i-speech-2", kind: "item", time: "20:13", title: "精心备稿2", detail: "《走出能力陷阱》PM L1-4 评估与反馈", duration: "5-7", person: "Bell" },
      { id: "i-speech-3", kind: "item", time: "20:21", title: "精心备稿3", detail: "《“冷”“战”》PM L3-1 说服型演讲", duration: "5-7", person: "聪聪" },
      { id: "i-guests", kind: "item", time: "20:29", title: "来宾介绍", detail: "", duration: "6", person: "Venus斯敏" },
      { id: "s-feedback", kind: "section", title: "四、茶歇&会议反馈环节" },
      { id: "i-break", kind: "item", time: "20:35", title: "茶歇+大合照", detail: "", duration: "5", person: "全场人员" },
      { id: "i-feedback-intro", kind: "item", time: "20:41", title: "总主持人介绍本环节+串场", detail: "30秒 × 4", duration: "2", person: "女侠" },
      { id: "i-impromptu-eval", kind: "item", time: "20:43", title: "即兴点评", detail: "", duration: "7", person: "Rui（Soar High）" },
      { id: "i-eval-1", kind: "item", time: "20:51", title: "备稿点评1", detail: "《选择和努力》PM L1-2 撰写带有目的性的演讲稿", duration: "5", person: "David（MAD）" },
      { id: "i-eval-2", kind: "item", time: "20:56", title: "备稿点评2", detail: "《走出能力陷阱》PM L1-4 评估与反馈", duration: "5", person: "女侠" },
      { id: "i-eval-3", kind: "item", time: "21:02", title: "备稿点评3", detail: "《“冷”“战”》PM L3-1 说服型演讲", duration: "5", person: "筠筠" },
      { id: "i-ah-report", kind: "item", time: "21:07", title: "哼哈官报告", detail: "", duration: "3", person: "Isabel（来宾）" },
      { id: "i-timer-report", kind: "item", time: "21:11", title: "时间官报告", detail: "", duration: "3", person: "纳纳（来宾）" },
      { id: "i-vote", kind: "item", time: "21:13", title: "电子投票", detail: "", duration: "1", person: "女侠" },
      { id: "i-general-eval", kind: "item", time: "21:14", title: "总点评", detail: "", duration: "8", person: "Venus斯敏" },
      { id: "s-share", kind: "section", title: "五、分享环节" },
      { id: "i-award", kind: "item", time: "21:22", title: "颁奖&真情分享", detail: "", duration: "5", person: "女侠&雪花组合" },
      { id: "i-close", kind: "item", time: "21:28", title: "主席总结本期活动，结束会议", detail: "", duration: "1", person: "女侠" }
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

  return {
    DEFAULT_MEETING_RULES,
    DEFAULT_OFFICERS,
    LEGACY_DEFAULT_OFFICERS,
    GUEST_PARTICIPATION_TAGS,
    GUEST_PARTICIPATION_NOTE,
    listTemplates,
    getTemplate,
    getDefaultData
  };
});

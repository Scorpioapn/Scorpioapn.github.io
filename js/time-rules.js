(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMTimeRules = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function formatTime(totalSeconds) {
    const abs = Math.abs(Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.floor(abs / 60);
    const seconds = abs % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function deriveRule(totalSeconds) {
    const safeTotal = Math.max(1, Math.round(Number(totalSeconds || 0)));
    let greenRemaining = 300;
    let yellowRemaining = 120;
    let overtimeAlert = 30;
    if (safeTotal <= 180) {
      greenRemaining = 60;
      yellowRemaining = 30;
      overtimeAlert = 15;
    } else if (safeTotal <= 600) {
      greenRemaining = 120;
      yellowRemaining = 60;
      overtimeAlert = 30;
    }
    return {
      total: safeTotal,
      green: Math.max(0, safeTotal - greenRemaining),
      yellow: Math.max(0, safeTotal - yellowRemaining),
      red: safeTotal,
      greenRemaining: Math.min(greenRemaining, safeTotal),
      yellowRemaining: Math.min(yellowRemaining, safeTotal),
      overtimeAlert
    };
  }

  function deriveRuleForMinutes(minutes) {
    return deriveRule(Math.max(1, Number(minutes) || 1) * 60);
  }

  function formatRule(rule) {
    return `绿牌 ${formatTime(rule.green)} · 黄牌 ${formatTime(rule.yellow)} · 红牌 ${formatTime(rule.red)} · 铃声 +${rule.overtimeAlert}s`;
  }

  function formatRemainingRule(rule) {
    return `绿牌 剩余 ${formatTime(rule.greenRemaining)}，黄牌 剩余 ${formatTime(rule.yellowRemaining)}，红牌 时间到，超时 ${rule.overtimeAlert} 秒响铃`;
  }

  return {
    deriveRule,
    deriveRuleForMinutes,
    formatRule,
    formatRemainingRule,
    formatTime
  };
});

const REMOVED_AGENDA_GENERATOR_FIELDS = ["posterData", "footerNotes", "pathways", "joinInfo"];

export function deepClone(value) {
  return globalThis.structuredClone
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function parseDurationMinutes(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const range = text.match(/(\d+(?:\.\d+)?)\s*[-~–—]\s*(\d+(?:\.\d+)?)/);
  if (range) return Number(range[2]);
  const first = text.match(/(\d+(?:\.\d+)?)/);
  return first ? Number(first[1]) : 0;
}

export function minutesToTime(totalMinutes) {
  const normalized = ((Math.round(Number(totalMinutes) || 0) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function addMinutesToTime(time, minutes) {
  return minutesToTime(timeToMinutes(time) + Number(minutes || 0));
}

export function deriveTimingRuleFromMinutes(minutes) {
  const total = Math.max(1, Math.round(Number(minutes || 0) * 60));
  let greenRemaining = 300;
  let yellowRemaining = 120;
  let overtimeAlert = 30;
  let band = "10分钟以上规则";

  if (total <= 180) {
    greenRemaining = 60;
    yellowRemaining = 30;
    overtimeAlert = 15;
    band = "3分钟及以下规则";
  } else if (total <= 600) {
    greenRemaining = 120;
    yellowRemaining = 60;
    band = "3-10分钟规则";
  }

  return {
    green: Math.max(0, total - greenRemaining),
    yellow: Math.max(0, total - yellowRemaining),
    red: total,
    greenRemaining: Math.min(greenRemaining, total),
    yellowRemaining: Math.min(yellowRemaining, total),
    overtimeAlert,
    band
  };
}

export function rescheduleAgendaItems(items, startTime) {
  let cursor = timeToMinutes(startTime);
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item?.kind === "section") return { ...item };
    const next = { ...item, time: minutesToTime(cursor) };
    cursor += Math.max(0, Math.round(parseDurationMinutes(item?.duration)));
    return next;
  });
}

export function normalizeEscapedNewlines(data, fields = []) {
  const normalized = { ...data };
  fields.forEach((field) => {
    if (typeof normalized[field] === "string") {
      normalized[field] = normalized[field].replaceAll("\\n", "\n");
    }
  });
  return normalized;
}

export function normalizeAgendaGeneratorData(parsed, defaults) {
  const fallback = deepClone(defaults || {});
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const merged = {
    ...fallback,
    ...source,
    items: Array.isArray(source.items) && source.items.length ? deepClone(source.items) : deepClone(fallback.items || [])
  };

  for (const field of REMOVED_AGENDA_GENERATOR_FIELDS) {
    delete merged[field];
  }

  return normalizeEscapedNewlines(merged, [
    "clubIntro",
    "officers",
    "meetingRules",
    "meetingVision",
    "guestInvitation",
    "residentPeople"
  ]);
}

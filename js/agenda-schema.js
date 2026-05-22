(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMAgendaSchema = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const VALID_STATUSES = new Set(["pending", "active", "done"]);

  function normalizeFullWidthDigits(value) {
    return String(value ?? "").replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  }

  function parseDurationToMinutes(duration, fallback = 2) {
    const text = normalizeFullWidthDigits(duration).trim();
    if (!text) return fallback;
    const secondsOnly = /秒/.test(text) && !/分|分钟|min|minute/i.test(text);
    const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|—|~|～|至|到)\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      const upper = Number(rangeMatch[2]);
      return secondsOnly ? Math.max(1, Math.ceil(upper / 60)) : Math.max(1, Math.round(upper));
    }
    const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (!numberMatch) return fallback;
    const value = Number(numberMatch[1]);
    return secondsOnly ? Math.max(1, Math.ceil(value / 60)) : Math.max(1, Math.round(value));
  }

  function normalizeStatus(status) {
    return VALID_STATUSES.has(status) ? status : "pending";
  }

  function normalizeTimekeeperAgendaItem(item = {}, index = 0) {
    const plannedMinutes = Math.max(
      1,
      Math.round(Number(item.plannedMinutes) || parseDurationToMinutes(item.durationLabel || item.duration, 2))
    );
    const name = String(item.name || item.title || "未命名环节").trim() || "未命名环节";
    const id = String(item.id || item.sourceId || `agenda-item-${index + 1}`);
    const sourceId = String(item.sourceId || item.id || "").trim();
    return {
      id,
      sourceId,
      name,
      plannedMinutes,
      durationLabel: String(item.durationLabel || item.duration || `${plannedMinutes} 分钟`).trim(),
      status: normalizeStatus(item.status),
      actualStart: item.actualStart || null,
      actualEnd: item.actualEnd || null,
      speaker: String(item.speaker || item.person || "").trim(),
      detail: String(item.detail || "").trim(),
      scheduledTime: String(item.scheduledTime || item.time || "").trim()
    };
  }

  function convertGeneratorItemToTimekeeperAgenda(item = {}, index = 0) {
    if ((item.kind || "item") === "section") return null;
    if (!String(item.title || "").trim()) return null;
    const plannedMinutes = parseDurationToMinutes(item.duration, 2);
    return normalizeTimekeeperAgendaItem({
      id: item.id || `agenda-sync-${index + 1}`,
      sourceId: item.id || "",
      name: String(item.title || "").trim(),
      plannedMinutes,
      durationLabel: String(item.duration || `${plannedMinutes} 分钟`).trim(),
      status: "pending",
      actualStart: null,
      actualEnd: null,
      speaker: item.person || "",
      detail: item.detail || "",
      scheduledTime: item.time || ""
    }, index);
  }

  function buildMeetingTitle(generatorState = {}) {
    const titleParts = [
      generatorState.clubName || "Toastmasters",
      generatorState.meetingNo ? `第${generatorState.meetingNo}期例会` : "例会",
      generatorState.theme ? `主题：${generatorState.theme}` : ""
    ].filter(Boolean);
    return titleParts.join(" · ");
  }

  function buildTimekeeperPayload(generatorState = {}, options = {}) {
    const existingMeeting = options.existingMeeting || generatorState.existingMeeting || {};
    const agendaItems = (Array.isArray(generatorState.items) ? generatorState.items : [])
      .map(convertGeneratorItemToTimekeeperAgenda)
      .filter(Boolean);
    return {
      agendaItems,
      meeting: {
        ...existingMeeting,
        meetingTitle: buildMeetingTitle(generatorState),
        timekeeperName: existingMeeting.timekeeperName || "",
        meetingDate: generatorState.date || existingMeeting.meetingDate || "",
        meetingStartTime: generatorState.startTime || existingMeeting.meetingStartTime || "",
        meetingEndTime: generatorState.endTime || existingMeeting.meetingEndTime || ""
      }
    };
  }

  function agendaMatchKey(item) {
    const normalized = normalizeTimekeeperAgendaItem(item);
    return [
      normalized.id,
      normalized.sourceId,
      normalized.name
    ].filter(Boolean).map((value) => String(value).trim());
  }

  function findCurrentMatch(nextItem, currentAgenda, usedIndexes) {
    const keys = agendaMatchKey(nextItem);
    for (let index = 0; index < currentAgenda.length; index += 1) {
      if (usedIndexes.has(index)) continue;
      const currentKeys = agendaMatchKey(currentAgenda[index]);
      if (keys.some((key) => currentKeys.includes(key))) return { item: currentAgenda[index], index };
    }
    return null;
  }

  function canUpdateSyncedItem(currentItem) {
    const item = normalizeTimekeeperAgendaItem(currentItem);
    return item.status === "pending" && !item.actualStart && !item.actualEnd;
  }

  function mergeTimekeeperAgendaItems(nextAgenda, currentAgenda) {
    const incoming = (Array.isArray(nextAgenda) ? nextAgenda : []).map(normalizeTimekeeperAgendaItem);
    const current = (Array.isArray(currentAgenda) ? currentAgenda : []).map(normalizeTimekeeperAgendaItem);
    const usedIndexes = new Set();
    const merged = incoming.map((nextItem, index) => {
      const match = findCurrentMatch(nextItem, current, usedIndexes);
      if (!match) return normalizeTimekeeperAgendaItem(nextItem, index);
      usedIndexes.add(match.index);
      const existing = normalizeTimekeeperAgendaItem(match.item, match.index);
      if (canUpdateSyncedItem(existing)) {
        return normalizeTimekeeperAgendaItem({
          ...nextItem,
          id: existing.id || nextItem.id,
          sourceId: nextItem.sourceId || existing.sourceId,
          status: "pending",
          actualStart: null,
          actualEnd: null
        }, index);
      }
      return normalizeTimekeeperAgendaItem({
        ...nextItem,
        ...existing,
        speaker: existing.speaker || nextItem.speaker,
        detail: existing.detail || nextItem.detail,
        scheduledTime: existing.scheduledTime || nextItem.scheduledTime,
        status: existing.status,
        actualStart: existing.actualStart,
        actualEnd: existing.actualEnd
      }, index);
    });

    current.forEach((item, index) => {
      if (!usedIndexes.has(index) && !canUpdateSyncedItem(item)) {
        merged.push(normalizeTimekeeperAgendaItem(item, merged.length));
      }
    });
    return merged;
  }

  return {
    parseDurationToMinutes,
    convertGeneratorItemToTimekeeperAgenda,
    buildTimekeeperPayload,
    normalizeTimekeeperAgendaItem,
    mergeTimekeeperAgendaItems
  };
});

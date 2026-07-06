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
    const expressionMinutes = parseDurationExpressionToMinutes(text);
    if (expressionMinutes !== null) return expressionMinutes;
    const secondsOnly = /秒/.test(text) && !/分|分钟|min|minute/i.test(text);
    const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|—|~|～|至|到)\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      const upper = Number(rangeMatch[2]);
      return secondsOnly ? Math.max(1, Math.ceil(upper / 60)) : Math.max(1, Math.round(upper));
    }
    const allNumbers = text.match(/\d+(?:\.\d+)?/g) || [];
    if (allNumbers.length > 1) return fallback;
    const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (!numberMatch) return fallback;
    const value = Number(numberMatch[1]);
    return secondsOnly ? Math.max(1, Math.ceil(value / 60)) : Math.max(1, Math.round(value));
  }

  function parseDurationExpressionToMinutes(text) {
    if (!/[+＋*×xX]/.test(text)) return null;
    const normalized = text
      .replace(/[＋]/g, "+")
      .replace(/[×xX＊]/g, "*")
      .replace(/，|,/g, "+");
    const terms = normalized.split("+").map((term) => term.trim()).filter(Boolean);
    if (!terms.length) return null;
    let totalSeconds = 0;
    for (const term of terms) {
      const seconds = parseDurationExpressionTerm(term);
      if (seconds === null) return null;
      totalSeconds += seconds;
    }
    return totalSeconds > 0 ? Math.max(1, Math.ceil(totalSeconds / 60)) : null;
  }

  function parseDurationExpressionTerm(term) {
    const match = term.match(/^(\d+(?:\.\d+)?)\s*(秒|分|分钟|min|minute|minutes)\s*(?:[*]\s*(\d+(?:\.\d+)?))?\s*(?:\/\s*\S+)?$/i);
    if (!match) return null;
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = match[3] ? Number(match[3]) : 1;
    if (!Number.isFinite(value) || !Number.isFinite(multiplier)) return null;
    const seconds = /秒/.test(unit) ? value : value * 60;
    return seconds * multiplier;
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

  function formatGeneratorDurationLabel(duration, durationNote) {
    const total = String(duration || "").trim();
    const note = String(durationNote || "").trim();
    if (total && note) return `${total} (${note})`;
    return total || note;
  }

  function convertGeneratorItemToTimekeeperAgenda(item = {}, index = 0) {
    if ((item.kind || "item") === "section") return null;
    if (!String(item.title || "").trim()) return null;
    const plannedMinutes = parseDurationToMinutes(item.duration, 2);
    const durationLabel = formatGeneratorDurationLabel(item.duration || `${plannedMinutes} 分钟`, item.durationNote);
    return normalizeTimekeeperAgendaItem({
      id: item.id || `agenda-sync-${index + 1}`,
      sourceId: item.id || "",
      name: String(item.title || "").trim(),
      plannedMinutes,
      durationLabel,
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

  function findCurrentMatch(nextItem, currentAgenda, usedIndexes, incomingNameCounts) {
    const next = normalizeTimekeeperAgendaItem(nextItem);
    const findFirst = (predicate) => {
      for (let index = 0; index < currentAgenda.length; index += 1) {
        if (usedIndexes.has(index)) continue;
        const current = normalizeTimekeeperAgendaItem(currentAgenda[index], index);
        if (predicate(current)) return { item: currentAgenda[index], index };
      }
      return null;
    };

    if (next.sourceId) {
      const sourceMatch = findFirst((current) => current.sourceId === next.sourceId);
      if (sourceMatch) return sourceMatch;
    }
    if (next.id) {
      const idMatch = findFirst((current) => current.id === next.id);
      if (idMatch) return idMatch;
    }
    if (next.scheduledTime && next.name) {
      const timeNameMatch = findFirst((current) => current.scheduledTime === next.scheduledTime && current.name === next.name);
      if (timeNameMatch) return timeNameMatch;
    }
    if (next.name && incomingNameCounts.get(next.name) === 1) {
      const nameMatches = [];
      for (let index = 0; index < currentAgenda.length; index += 1) {
        if (usedIndexes.has(index)) continue;
        const current = normalizeTimekeeperAgendaItem(currentAgenda[index], index);
        if (current.name === next.name) nameMatches.push({ item: currentAgenda[index], index });
      }
      if (nameMatches.length === 1) return nameMatches[0];
    }
    return null;
  }

  function canUpdateSyncedItem(currentItem) {
    const item = normalizeTimekeeperAgendaItem(currentItem);
    return item.status === "pending" && !item.actualStart && !item.actualEnd;
  }

  function mergeTimekeeperAgendaItems(nextAgenda, currentAgenda) {
    const incoming = (Array.isArray(nextAgenda) ? nextAgenda : []).map((item, index) => normalizeTimekeeperAgendaItem(item, index));
    const current = (Array.isArray(currentAgenda) ? currentAgenda : []).map((item, index) => normalizeTimekeeperAgendaItem(item, index));
    const incomingNameCounts = incoming.reduce((counts, item) => {
      counts.set(item.name, (counts.get(item.name) || 0) + 1);
      return counts;
    }, new Map());
    const usedIndexes = new Set();
    const merged = incoming.map((nextItem, index) => {
      const match = findCurrentMatch(nextItem, current, usedIndexes, incomingNameCounts);
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
      return normalizeTimekeeperAgendaItem(existing, index);
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

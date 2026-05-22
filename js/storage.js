(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const STORAGE_KEYS = Object.freeze({
    agendaGenerator: "tm_agenda_generator_v1",
    timekeeperAgenda: "tm_timekeeper_agenda_v2",
    timekeeperMeeting: "tm_timekeeper_meeting_v1",
    timekeeperRecords: "tm_timekeeper_records_v1",
    timekeeperAgendaSyncMeta: "tm_timekeeper_agenda_sync_meta_v1"
  });

  const TIMEKEEPER_STORAGE_KEYS = Object.freeze({
    agenda: STORAGE_KEYS.timekeeperAgenda,
    meeting: STORAGE_KEYS.timekeeperMeeting,
    records: STORAGE_KEYS.timekeeperRecords,
    syncMeta: STORAGE_KEYS.timekeeperAgendaSyncMeta
  });

  function getStorage(storage) {
    if (storage) return storage;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
  }

  function readJson(key, fallback, storage) {
    try {
      const target = getStorage(storage);
      if (!target) return fallback;
      const raw = target.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) ?? fallback;
    } catch (error) {
      console.warn(`Failed to read ${key}`, error);
      return fallback;
    }
  }

  function writeJson(key, value, storage) {
    const target = getStorage(storage);
    if (!target) return false;
    target.setItem(key, JSON.stringify(value));
    return true;
  }

  function removeKey(key, storage) {
    const target = getStorage(storage);
    if (!target) return false;
    target.removeItem(key);
    return true;
  }

  return {
    STORAGE_KEYS,
    TIMEKEEPER_STORAGE_KEYS,
    readJson,
    writeJson,
    removeKey
  };
});

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMTimekeeperState = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function canLeaveAgenda(timer, postRecordAction) {
    return !timer?.running
      && !timer?.paused
      && Number(timer?.elapsed || 0) === 0
      && !postRecordAction;
  }

  function activateOnly(items, itemId) {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (item.id === itemId) item.status = "active";
      else if (item.status === "active") item.status = "pending";
    });
  }

  function appendPersistedRecord(records, record, persist) {
    if (!Array.isArray(records) || !record || typeof persist !== "function") return false;
    records.push(record);
    let saved = false;
    try {
      saved = persist() !== false;
    } catch {
      saved = false;
    }
    if (!saved) {
      const index = records.lastIndexOf(record);
      if (index >= 0) records.splice(index, 1);
    }
    return saved;
  }

  return { canLeaveAgenda, activateOnly, appendPersistedRecord };
});

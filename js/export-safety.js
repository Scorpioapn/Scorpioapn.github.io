(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMExportSafety = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function escapeCsvCell(cell) {
    let value = cell == null ? "" : String(cell);
    if (/^[\t\r\n]|^[ \t\r\n]*[=+\-@]/.test(value)) value = `'${value}`;
    return `"${value.replaceAll('"', '""')}"`;
  }

  return { escapeCsvCell };
});

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMAgendaPdfExport = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const SERVER_PDF_ENDPOINT = "/api/render-agenda-pdf";
  const PRINT_PAGE_WIDTH = 980;
  const PRINT_PAGE_HEIGHT = 1386;

  function escapeAttribute(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function safeStyleText(cssText) {
    return String(cssText ?? "").replace(/<\/style/gi, "<\\/style");
  }

  function buildServerPdfHtml(options = {}) {
    const cssText = safeStyleText(options.cssText);
    const snapshotMarkup = String(options.snapshotMarkup || "");
    const baseHref = options.baseHref ? `<base href="${escapeAttribute(options.baseHref)}">` : "";
    if (!snapshotMarkup.trim()) throw new Error("缺少可打印的议程预览内容");

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${baseHref}
  <style>
    @page { size: A4 portrait; margin: 0; }
    html,
    body {
      width: 210mm;
      height: 297mm;
      min-height: 0;
      margin: 0;
      padding: 0;
      background: #fff;
      overflow: hidden;
    }
    body {
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }
    .pdf-page-shell {
      width: 210mm;
      height: 297mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #fff;
    }
    #printPageExportSnapshot {
      width: ${PRINT_PAGE_WIDTH}px !important;
      height: ${PRINT_PAGE_HEIGHT}px !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border-radius: 14px !important;
      box-shadow: none !important;
      overflow: hidden !important;
      transform: scale(0.8099) !important;
      transform-origin: top left !important;
      page-break-inside: avoid !important;
    }
    #printPageExportSnapshot,
    #printPageExportSnapshot * {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
${cssText}
  </style>
</head>
<body>
  <main class="pdf-page-shell">${snapshotMarkup}</main>
</body>
</html>`;
  }

  function createServerPdfRequestOptions(payload, endpoint = SERVER_PDF_ENDPOINT) {
    return {
      endpoint,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: payload?.html || "",
          fileName: payload?.fileName || "agenda.pdf"
        })
      }
    };
  }

  async function inlineSnapshotImages(snapshot, imageSrcToDataUrl) {
    const images = Array.from(snapshot.querySelectorAll("img"));
    await Promise.all(images.map(async (image) => {
      const src = image.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      image.setAttribute("src", await imageSrcToDataUrl(src));
    }));
  }

  function serializeSnapshot(snapshot, serializer) {
    if (serializer?.serializeToString) return serializer.serializeToString(snapshot);
    if (snapshot.outerHTML) return snapshot.outerHTML;
    throw new Error("当前浏览器无法序列化打印预览");
  }

  async function buildServerPdfPayload(options = {}) {
    const printPage = options.printPage;
    if (!printPage) throw new Error("缺少可打印的议程预览内容");
    const snapshot = printPage.cloneNode(true);
    snapshot.id = "printPageExportSnapshot";
    snapshot.classList.add("exporting-snapshot");
    snapshot.setAttribute("aria-hidden", "true");
    snapshot.style.transform = "none";
    snapshot.style.width = `${PRINT_PAGE_WIDTH}px`;
    snapshot.style.height = `${PRINT_PAGE_HEIGHT}px`;
    await inlineSnapshotImages(snapshot, options.imageSrcToDataUrl);
    const snapshotMarkup = serializeSnapshot(snapshot, options.serializer);
    return {
      html: buildServerPdfHtml({
        cssText: options.cssText,
        snapshotMarkup,
        baseHref: options.baseHref
      }),
      fileName: options.fileName || "agenda.pdf"
    };
  }

  return {
    SERVER_PDF_ENDPOINT,
    PRINT_PAGE_WIDTH,
    PRINT_PAGE_HEIGHT,
    buildServerPdfHtml,
    buildServerPdfPayload,
    createServerPdfRequestOptions
  };
});

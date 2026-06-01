import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const agendaGeneratorSource = readFileSync(new URL("../agenda_generator.html", import.meta.url), "utf8");

function loadClientExportModule() {
  return require("../js/agenda-pdf-export.js");
}

async function loadApiModule() {
  return import(new URL("../api/render-agenda-pdf.mjs", import.meta.url).href);
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    }
  };
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

test("client builds a server PDF payload from the live print DOM and CSS", () => {
  const { buildServerPdfHtml, createServerPdfRequestOptions } = loadClientExportModule();
  const snapshotMarkup = '<article id="printPageExportSnapshot" class="agenda-sheet template-sheet exporting-snapshot"><img src="data:image/png;base64,abc" alt="QR"></article>';
  const html = buildServerPdfHtml({
    cssText: ".agenda-sheet { color: #111; }",
    snapshotMarkup,
    baseHref: "https://example.com/agenda_generator.html"
  });

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<base href="https:\/\/example\.com\/agenda_generator\.html">/);
  assert.match(html, /@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*0;\s*\}/);
  assert.match(html, /print-color-adjust:\s*exact/);
  assert.match(html, /<article id="printPageExportSnapshot"/);
  assert.match(html, /data:image\/png;base64,abc/);
  assert.doesNotMatch(html, /html2canvas|jspdf/i);

  const request = createServerPdfRequestOptions({ html, fileName: "agenda.pdf" });
  assert.equal(request.endpoint, "/api/render-agenda-pdf");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.options.body), { html, fileName: "agenda.pdf" });
});

test("PDF API rejects unsupported methods", async () => {
  const { handleRenderAgendaPdfRequest } = await loadApiModule();
  const response = mockResponse();

  await handleRenderAgendaPdfRequest({ method: "GET" }, response, {
    renderPdfBuffer: async () => Buffer.from("%PDF")
  });

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, "POST");
  assert.deepEqual(response.body, { error: "只支持 POST 请求" });
});

test("PDF API rejects missing and oversized HTML", async () => {
  const { MAX_PDF_HTML_BYTES, handleRenderAgendaPdfRequest } = await loadApiModule();
  assert.equal(MAX_PDF_HTML_BYTES, 2 * 1024 * 1024);

  const emptyResponse = mockResponse();
  await handleRenderAgendaPdfRequest({ method: "POST", body: { html: "", fileName: "empty.pdf" } }, emptyResponse, {
    renderPdfBuffer: async () => Buffer.from("%PDF")
  });
  assert.equal(emptyResponse.statusCode, 400);
  assert.deepEqual(emptyResponse.body, { error: "缺少可打印的 HTML 内容" });

  const oversizedResponse = mockResponse();
  await handleRenderAgendaPdfRequest({
    method: "POST",
    body: { html: "x".repeat(MAX_PDF_HTML_BYTES + 1), fileName: "huge.pdf" }
  }, oversizedResponse, {
    renderPdfBuffer: async () => Buffer.from("%PDF")
  });
  assert.equal(oversizedResponse.statusCode, 413);
  assert.deepEqual(oversizedResponse.body, { error: "PDF 内容过大，请减少图片或内容后重试" });
});

test("PDF API rejects cross-origin browser requests before rendering", async () => {
  const { handleRenderAgendaPdfRequest } = await loadApiModule();
  const response = mockResponse();
  let renderCalled = false;

  await handleRenderAgendaPdfRequest({
    method: "POST",
    headers: {
      host: "safe.example.com",
      "x-forwarded-proto": "https",
      origin: "https://attacker.example.com"
    },
    body: { html: "<!doctype html><html><body>Agenda</body></html>", fileName: "agenda.pdf" }
  }, response, {
    renderPdfBuffer: async () => {
      renderCalled = true;
      return Buffer.from("%PDF-1.7\n");
    }
  });

  assert.equal(renderCalled, false);
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: "非法来源" });
});

test("PDF API returns a generated PDF with safe download headers", async () => {
  const { handleRenderAgendaPdfRequest } = await loadApiModule();
  const response = mockResponse();
  let renderedHtml = "";
  let renderOptions = {};

  await handleRenderAgendaPdfRequest({
    method: "POST",
    headers: { host: "agenda.example.com", "x-forwarded-proto": "https" },
    body: { html: "<!doctype html><html><body><article>Agenda</article></body></html>", fileName: "bad/name.pdf" }
  }, response, {
    renderPdfBuffer: async (html, options) => {
      renderedHtml = html;
      renderOptions = options;
      return new Uint8Array(Buffer.from("%PDF-1.7\n"));
    }
  });

  assert.match(renderedHtml, /Agenda/);
  assert.deepEqual(renderOptions, { allowedOrigin: "https://agenda.example.com" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/pdf");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.headers["content-disposition"], /attachment; filename="bad_name\.pdf"/);
  assert.ok(Buffer.isBuffer(response.body));
  assert.match(response.body.toString("utf8"), /^%PDF-1\.7/);
});

test("PDF API derives allowed asset origin from request headers instead of submitted HTML", async () => {
  const { handleRenderAgendaPdfRequest } = await loadApiModule();
  const response = mockResponse();
  let renderOptions = {};

  await handleRenderAgendaPdfRequest({
    method: "POST",
    headers: { host: "safe.example.com", "x-forwarded-proto": "https" },
    body: {
      html: '<!doctype html><html><head><base href="https://attacker.example.com/agenda_generator.html"></head><body>Agenda</body></html>',
      fileName: "agenda.pdf"
    }
  }, response, {
    renderPdfBuffer: async (html, options) => {
      renderOptions = options;
      return Buffer.from("%PDF-1.7\n");
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(renderOptions, { allowedOrigin: "https://safe.example.com" });
});

test("PDF renderer disables JavaScript before rendering submitted HTML", async () => {
  const { configurePdfRenderPage } = await loadApiModule();
  const calls = [];
  const page = {
    async setJavaScriptEnabled(value) {
      calls.push(["setJavaScriptEnabled", value]);
    },
    async setRequestInterception(value) {
      calls.push(["setRequestInterception", value]);
    },
    on(eventName) {
      calls.push(["on", eventName]);
    }
  };

  await configurePdfRenderPage(page, "https://safe.example.com");

  assert.deepEqual(calls.slice(0, 2), [
    ["setJavaScriptEnabled", false],
    ["setRequestInterception", true]
  ]);
  assert.deepEqual(calls[2], ["on", "request"]);
});

test("PDF renderer blocks submitted scripts and external requests in real Chromium", { timeout: 60000 }, async () => {
  const {
    configurePdfRenderPage,
    createPdfChromiumLaunchOptions
  } = await loadApiModule();
  const fontPath = "/assets/fonts/noto-sans-sc/noto-sans-sc-latin-400-normal.woff2";
  const fontBytes = readFileSync(new URL(`..${fontPath}`, import.meta.url));
  const server = createServer((request, response) => {
    if (request.url === fontPath) {
      response.writeHead(200, {
        "Content-Type": "font/woff2",
        "Cache-Control": "no-store"
      });
      response.end(fontBytes);
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("not found");
  });
  const port = await listen(server);
  const allowedOrigin = `http://127.0.0.1:${port}`;
  let browser;

  try {
    const { puppeteer, options: launchOptions } = await createPdfChromiumLaunchOptions();
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    const requestedUrls = [];
    const failedUrls = [];
    const finishedUrls = [];
    page.on("request", (request) => requestedUrls.push(request.url()));
    page.on("requestfailed", (request) => failedUrls.push(request.url()));
    page.on("requestfinished", (request) => finishedUrls.push(request.url()));
    const renderDocumentUrl = `${allowedOrigin}/__agenda-pdf-render-test.html`;
    await configurePdfRenderPage(page, allowedOrigin, {
      renderDocumentUrl,
      renderDocumentHtml: `<!doctype html>
<html>
<head>
  <style>
    @font-face {
      font-family: "IntegrationPdfFont";
      src: url("${allowedOrigin}${fontPath}") format("woff2");
      font-weight: 400;
    }
    body { font-family: "IntegrationPdfFont", sans-serif; }
  </style>
</head>
<body>
  <script>
    document.body.dataset.executed = "yes";
    document.body.textContent = "script-ran";
  </script>
  <main id="marker">script-blocked 中文 Agenda</main>
  <img src="https://attacker.example.com/pixel.png" alt="">
</body>
</html>`
    });

    await page.goto(renderDocumentUrl, { waitUntil: "networkidle0", timeout: 30000 });

    const scriptExecuted = await page.evaluate(() => document.body.dataset.executed || "");
    const markerText = await page.$eval("#marker", (node) => node.textContent);
    const fontStatuses = await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      return Array.from(document.fonts || [], (font) => ({
        family: font.family,
        status: font.status
      }));
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });

    assert.equal(scriptExecuted, "");
    assert.equal(markerText, "script-blocked 中文 Agenda");
    assert.ok(requestedUrls.includes(`${allowedOrigin}${fontPath}`));
    assert.ok(finishedUrls.includes(`${allowedOrigin}${fontPath}`));
    assert.ok(failedUrls.includes("https://attacker.example.com/pixel.png"));
    assert.ok(fontStatuses.some((font) => font.family === "IntegrationPdfFont" && font.status === "loaded"));
    assert.ok(Buffer.isBuffer(Buffer.from(pdf)));
    assert.equal(Buffer.from(pdf).subarray(0, 4).toString("utf8"), "%PDF");
    assert.ok(pdf.length > 1000);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("client leaves image URLs in place when inlining an image fails", async () => {
  const { buildServerPdfPayload } = loadClientExportModule();
  const image = {
    attributes: { src: "assets/missing.png" },
    getAttribute(name) {
      return this.attributes[name] || "";
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
  const snapshot = {
    id: "printPage",
    classList: { add() {} },
    style: {},
    setAttribute() {},
    querySelectorAll(selector) {
      return selector === "img" ? [image] : [];
    },
    outerHTML: '<article id="printPageExportSnapshot"><img src="assets/missing.png"></article>'
  };
  const printPage = {
    cloneNode() {
      return snapshot;
    }
  };

  const payload = await buildServerPdfPayload({
    printPage,
    cssText: ".agenda-sheet{}",
    baseHref: "https://safe.example.com/agenda_generator.html",
    imageSrcToDataUrl: async () => {
      throw new Error("missing image");
    }
  });

  assert.equal(image.getAttribute("src"), "assets/missing.png");
  assert.match(payload.html, /assets\/missing\.png/);
});

test("PDF deployment notes document Chromium pack configuration", () => {
  const docs = readFileSync(new URL("../docs/pdf-export-deployment.md", import.meta.url), "utf8");
  assert.match(docs, /CHROMIUM_PACK_URL/);
  assert.match(docs, /Vercel/);
  assert.match(docs, /npm test/);
});

test("agenda preview and server PDF share bundled Noto Sans SC font assets", () => {
  assert.match(agendaGeneratorSource, /font-family:\s*'TMAgendaSans'/);
  assert.match(agendaGeneratorSource, /assets\/fonts\/noto-sans-sc\/noto-sans-sc-chinese-simplified-400-normal\.woff2/);
  assert.match(agendaGeneratorSource, /--font-ui:\s*'TMAgendaSans'/);
  assert.ok(
    existsSync(new URL("../assets/fonts/noto-sans-sc/noto-sans-sc-chinese-simplified-400-normal.woff2", import.meta.url)),
    "bundled regular simplified Chinese font should exist"
  );
  assert.ok(
    existsSync(new URL("../assets/fonts/noto-sans-sc/noto-sans-sc-chinese-simplified-900-normal.woff2", import.meta.url)),
    "bundled heavy simplified Chinese font should exist"
  );
  assert.ok(
    existsSync(new URL("../assets/fonts/noto-sans-sc/LICENSE", import.meta.url)),
    "bundled font license should be checked in"
  );
});

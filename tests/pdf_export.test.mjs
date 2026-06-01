import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

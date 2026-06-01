import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";

export const MAX_PDF_HTML_BYTES = 4 * 1024 * 1024;
export const DEFAULT_CHROMIUM_PACK_URL = "https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar";

function sendJson(response, statusCode, body, extraHeaders = {}) {
  response.status(statusCode);
  for (const [name, value] of Object.entries(extraHeaders)) {
    response.setHeader(name, value);
  }
  return response.json(body);
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (error) {
      return {};
    }
  }
  return body;
}

function byteLength(value) {
  return Buffer.byteLength(String(value || ""), "utf8");
}

function headerValue(headers = {}, name) {
  if (typeof headers.get === "function") return headers.get(name);
  const lowerName = name.toLowerCase();
  return headers[name] || headers[lowerName] || "";
}

export function requestOrigin(request) {
  const host = String(headerValue(request.headers, "x-forwarded-host") || headerValue(request.headers, "host") || "").split(",")[0].trim();
  if (!host) return "";
  const forwardedProto = String(headerValue(request.headers, "x-forwarded-proto") || "").split(",")[0].trim();
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  const proto = forwardedProto || (localHost ? "http" : "https");
  return `${proto}://${host}`;
}

export function sanitizePdfFileName(fileName) {
  const raw = String(fileName || "agenda.pdf").trim() || "agenda.pdf";
  const withoutPath = raw.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
  const ascii = withoutPath.replace(/[^\x20-\x7e]+/g, "_");
  const collapsed = ascii.replace(/_+/g, "_").replace(/^[_\-.]+|[_\-.]+$/g, "");
  const safeName = collapsed || "agenda";
  return safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
}

function localChromePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium"
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

async function chromiumLaunchOptions() {
  const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
    import("puppeteer-core"),
    import("@sparticuz/chromium-min")
  ]);
  const executablePath = localChromePath() || await chromium.executablePath(process.env.CHROMIUM_PACK_URL || DEFAULT_CHROMIUM_PACK_URL);
  return {
    puppeteer,
    options: {
      args: localChromePath() ? puppeteer.defaultArgs() : chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless || "new"
    }
  };
}

export function isAllowedRenderRequestUrl(requestUrl, allowedOrigin) {
  if (!requestUrl || requestUrl === "about:blank") return true;
  if (requestUrl.startsWith("data:") || requestUrl.startsWith("blob:")) return true;
  if (!allowedOrigin) return false;
  try {
    const url = new URL(requestUrl);
    return url.origin === allowedOrigin && url.pathname.startsWith("/assets/");
  } catch (error) {
    return false;
  }
}

export async function configurePdfRenderPage(page, allowedOrigin) {
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (isAllowedRenderRequestUrl(request.url(), allowedOrigin)) {
      request.continue();
    } else {
      request.abort();
    }
  });
}

export async function renderPdfWithChromium(html, renderOptions = {}) {
  const { puppeteer, options: launchOptions } = await chromiumLaunchOptions();
  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    const allowedOrigin = renderOptions.allowedOrigin || "";
    await configurePdfRenderPage(page, allowedOrigin);
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
  } finally {
    await browser.close();
  }
}

export async function handleRenderAgendaPdfRequest(request, response, dependencies = {}) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "只支持 POST 请求" }, { Allow: "POST" });
  }

  const body = parseBody(request.body);
  const html = String(body.html || "");
  if (!html.trim()) {
    return sendJson(response, 400, { error: "缺少可打印的 HTML 内容" });
  }
  if (byteLength(html) > MAX_PDF_HTML_BYTES) {
    return sendJson(response, 413, { error: "PDF 内容过大，请减少图片或内容后重试" });
  }

  try {
    const renderPdfBuffer = dependencies.renderPdfBuffer || renderPdfWithChromium;
    const pdfBuffer = await renderPdfBuffer(html, { allowedOrigin: requestOrigin(request) });
    response.status(200);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Disposition", `attachment; filename="${sanitizePdfFileName(body.fileName)}"`);
    return response.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "PDF 生成失败，请稍后重试" });
  }
}

export default function handler(request, response) {
  return handleRenderAgendaPdfRequest(request, response);
}

# PDF export deployment

The vector PDF path runs through the Vercel Node function at `/api/render-agenda-pdf`.
Keep the static site and the API on the same Vercel origin so the browser can call the
endpoint without cross-origin access.

## Chromium runtime

The API uses local Chrome when `PUPPETEER_EXECUTABLE_PATH` is available. On Vercel it
uses `@sparticuz/chromium-min` and downloads the packed Chromium archive from
`CHROMIUM_PACK_URL`.

Set `CHROMIUM_PACK_URL` in production to a controlled, durable storage URL. The checked-in
default points at the upstream Sparticuz GitHub release only as a fallback for previews and
local testing, so production deploys do not depend on GitHub release availability.

## Abuse controls

The function rejects browser requests whose `Origin` or `Referer` does not match the
request host, blocks external render-time resource requests, disables JavaScript before
rendering submitted HTML, and limits the submitted HTML payload to 2 MB.

For public production traffic, keep Vercel rate limiting or WAF rules enabled for
`/api/render-agenda-pdf`. Do not put a secret token in the static page; a public client
token would not protect the endpoint.

## Verification

Before deploying a PDF export change, run:

```bash
npm test
```

Then verify a Vercel preview from a phone browser: click the agenda PDF export button,
confirm the PDF downloads, zoom the PDF text, and confirm text remains selectable.

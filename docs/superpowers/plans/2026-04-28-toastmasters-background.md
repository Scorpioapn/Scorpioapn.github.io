# Toastmasters Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's warm page background with a Toastmasters deep-blue and white visual foundation.

**Architecture:** This is a scoped CSS-only change in the single-page `index.html`. The implementation updates the global color tokens and the later `html, body` background override so the final cascade uses cool navy and white background layers while preserving existing component structure and JavaScript behavior.

**Tech Stack:** Static HTML, CSS custom properties, vanilla JavaScript, Node.js syntax checks, PowerShell static verification.

---

## File Structure

- Modify: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`
  - Responsibility: app UI, CSS theme tokens, global page background, existing timer and agenda JavaScript.
- Create temporarily if needed: `D:/Codex/usechrome/verify_toastmasters_background.mjs`
  - Responsibility: static verification that the final page background uses cool Toastmasters blue/white tones and does not reintroduce warm background colors.

### Task 1: Add Background Verification

**Files:**
- Create: `D:/Codex/usechrome/verify_toastmasters_background.mjs`
- Read: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`

- [ ] **Step 1: Write the failing verification**

Create `D:/Codex/usechrome/verify_toastmasters_background.mjs` with:

```js
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node verify_toastmasters_background.mjs <html-file>");
  process.exit(2);
}

const html = fs.readFileSync(file, "utf8");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const htmlBodyBlocks = [...html.matchAll(/html,\s*body\s*\{([\s\S]*?)\}/g)].map((match) => match[1]);
const finalHtmlBodyBlock = htmlBodyBlocks.at(-1) || "";
const rootBlock = (html.match(/:root\s*\{([\s\S]*?)\}/) || [])[1] || "";

assert(/--bg:\s*#001f33\b/.test(rootBlock), "root --bg should be a cool Toastmasters navy.");
assert(/--panel:\s*rgba\(255,\s*255,\s*255,\s*0\.94\)/.test(rootBlock), "root --panel should stay white/translucent.");
assert(/linear-gradient\(135deg,\s*#001f33/.test(finalHtmlBodyBlock), "final page background should start with deep navy.");
assert(/rgba\(255,\s*255,\s*255,\s*0\.14\)/.test(finalHtmlBodyBlock), "final page background should include a white cool highlight.");
assert(!/rgba\(242,\s*223,\s*116/.test(finalHtmlBodyBlock), "final page background should not use Toastmasters gold.");
assert(!/rgba\(119,\s*36,\s*50/.test(finalHtmlBodyBlock), "final page background should not use Toastmasters burgundy.");
assert(!/#f7f3ea|#fffdf7|cream|beige/i.test(finalHtmlBodyBlock), "final page background should not use cream or beige tones.");

if (failures.length) {
  console.error("Background verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Toastmasters background verification passed.");
```

- [ ] **Step 2: Run verification to confirm it fails before CSS changes**

Run:

```powershell
node D:\Codex\usechrome\verify_toastmasters_background.mjs D:\Codex\usechrome\Scorpioapn.github.io\index.html
```

Expected: FAIL with messages about `--bg`, final deep navy background, and warm background colors.

### Task 2: Replace Warm Page Background

**Files:**
- Modify: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`
- Test: `D:/Codex/usechrome/verify_toastmasters_background.mjs`

- [ ] **Step 1: Update root theme tokens**

In `index.html`, change the existing root background and panel tokens to:

```css
      --bg: #001f33;
      --panel: rgba(255, 255, 255, 0.94);
      --panel-2: rgba(248, 252, 255, 0.92);
```

- [ ] **Step 2: Update the first global background block**

Replace the first `html, body` background declaration with:

```css
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.14), transparent 30%),
        radial-gradient(circle at top right, rgba(0, 95, 143, 0.32), transparent 34%),
        linear-gradient(135deg, #001f33 0%, #004165 48%, #0b5f88 100%);
```

- [ ] **Step 3: Update the final cascade override**

Replace the later `html, body` background override with:

```css
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.14), transparent 28%),
        radial-gradient(circle at top right, rgba(0, 95, 143, 0.28), transparent 34%),
        linear-gradient(135deg, #001f33 0%, #004165 52%, #0b5f88 100%);
```

- [ ] **Step 4: Keep accents out of the page background**

Do not remove Toastmasters burgundy or gold from buttons, timer states, borders, or badges. Only remove warm color use from the page background layers so existing UI semantics remain intact.

- [ ] **Step 5: Run CSS-focused verification**

Run:

```powershell
node D:\Codex\usechrome\verify_toastmasters_background.mjs D:\Codex\usechrome\Scorpioapn.github.io\index.html
```

Expected: PASS with `Toastmasters background verification passed.`

### Task 3: Regression Checks, Commit, and Deploy

**Files:**
- Read: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`
- Commit: `D:/Codex/usechrome/Scorpioapn.github.io/index.html`
- Push: `main` branch to `origin`

- [ ] **Step 1: Run JavaScript syntax check**

Run:

```powershell
$html = Get-Content -Raw -LiteralPath index.html
$script = [regex]::Match($html, '<script>([\s\S]*)</script>').Groups[1].Value
$tmp = Join-Path $env:TEMP 'timekeeper-index-script.js'
Set-Content -LiteralPath $tmp -Value $script -Encoding UTF8
node --check $tmp
```

Expected: no output and exit code `0`.

- [ ] **Step 2: Run diff whitespace check**

Run:

```powershell
git diff --check
```

Expected: no output and exit code `0`.

- [ ] **Step 3: Commit the implementation**

Run:

```powershell
git add -- index.html
git commit -m "Use Toastmasters blue page background"
```

Expected: a new commit touching only `index.html`.

- [ ] **Step 4: Push to GitHub Pages**

Run:

```powershell
git push origin main
```

Expected: `main -> main` push succeeds.

- [ ] **Step 5: Verify the deployed page**

Run:

```powershell
$url = 'https://scorpioapn.github.io/?codex=blue-background'
$response = Invoke-WebRequest -Uri $url -UseBasicParsing
$html = $response.Content
Write-Output "HTTP: $($response.StatusCode)"
Write-Output "HasDeepNavy: $($html.Contains('#001f33'))"
Write-Output "HasWhiteHighlight: $($html.Contains('rgba(255, 255, 255, 0.14)'))"
```

Expected:

```text
HTTP: 200
HasDeepNavy: True
HasWhiteHighlight: True
```

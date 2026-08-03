import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../agenda_generator.html", import.meta.url), "utf8");

test("classic agenda restores the readable timing-rule card layout", () => {
  const renderedCards = source.match(/class="timing-rule-card"/g) || [];

  assert.match(source, /--template-sidebar-width:\s*316px;/, "the printable sidebar should use the last known-good width");
  assert.equal(renderedCards.length, 3, "the three timing ranges should render as separate readable cards");
  assert.doesNotMatch(source, /class="timing-rule-summary"/, "the cramped five-column timing table should not be rendered");
});

test("classic agenda keeps the emergency micro-density tier", () => {
  assert.match(
    source,
    /const FLOW_FIT_CLASSES = \["flow-fit-compact", "flow-fit-dense", "flow-fit-micro"\];/,
    "long agendas should retain the final density tier that keeps the footer clear"
  );
  assert.match(source, /\.template-sheet\.flow-fit-micro\s*\{/, "the micro-density CSS tier should be present");
});

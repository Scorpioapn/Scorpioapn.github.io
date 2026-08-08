# Design QA — 议程生成器紧凑专业控制台

## Comparison target

- Source visual truth: `docs/superpowers/specs/assets/agenda-modern-control-console.png`
- Browser-rendered implementation: `http://localhost:4173/agenda_generator_modern.html`
- Desktop screenshot: `agenda-control-console-desktop.png`
- Mobile screenshot: `agenda-control-console-mobile.png`
- Original live-page capture: `agenda-control-console-original.png`
- State: default saved draft, first-run guide dismissed, “每周必做”展开，设置/导出菜单/编辑抽屉关闭。

## Viewport and normalization

| Evidence | CSS viewport | Pixel dimensions | Density | Normalization |
| --- | ---: | ---: | ---: | --- |
| Selected visual target | design canvas | 1487 × 1058 | 1× | Viewed at original resolution |
| Desktop implementation | 1440 × 1024 | 1440 × 1024 | DPR 1 | Same desktop state and near-identical aspect ratio; compared at original resolution |
| Mobile implementation | 393 × 852 | 378 × 819 content capture | DPR 1 | Browser screenshot excludes the 15 px scrollbar gutter and viewport chrome; DOM measurements use the full 393 × 852 CSS viewport |
| Second mobile check | 412 × 915 | DOM measurement | DPR 1 | Responsive layout and persistent controls measured in-browser |

## Full-view comparison evidence

The target, desktop implementation, and mobile implementation were opened together in one comparison input at original detail. The implementation preserves the target’s three-part hierarchy: compact workflow header, frequency-grouped editor, and visually dominant A4 proof. The editor is intentionally 547 px at the 1440 px test width, within the approved 470–560 px product constraint; the target mock’s wider editor was not copied because the design spec explicitly keeps the A4 preview as the visual authority.

The live-page capture was also compared with the implementation. The redesign removes the former card-heavy editor, duplicate export affordances, and permanently exposed row actions while retaining the existing data and A4 output.

## Focused-region comparison evidence

A separate crop was not required: both desktop images were inspected at native 1× resolution and the header labels, form controls, agenda rows, A4 title, timing table, logos, and QR assets remained readable. Mobile was captured separately at the intended 393 × 852 breakpoint so touch targets, sticky header, form density, and bottom task bar could be judged directly.

## Findings

No actionable P0, P1, or P2 fidelity findings remain.

### Required fidelity surfaces

- Fonts and typography: the existing Chinese sans-serif stack and Oswald time treatment preserve the source hierarchy. Header, section, body, helper, and table text retain clear optical weight and do not clip or truncate at the checked breakpoints.
- Spacing and layout rhythm: the 64 px desktop header, 547 px editor rail, independent scrolling regions, restrained 1 px dividers, 6/10/14 px radii, and dense agenda rows match the selected control-console direction. At 393 × 852 and 412 × 915 there is no horizontal overflow, and the bottom task bar remains visible without covering content.
- Colors and visual tokens: navy remains the sole primary action color, warm white/cool gray organize the editor and preview, and maroon is confined to the A4 artifact and semantic accents. Border, shadow, and status treatments stay subordinate to content.
- Image quality and asset fidelity: the existing Toastmasters marks, printable QR assets, and A4 imagery are preserved at their native aspect ratios and remain sharp. No target product image was replaced by a placeholder, CSS drawing, or emoji.
- Copy and content: “导入接龙 / 更换模板 / 继续编辑当前草稿” accurately reflects the real product capabilities. The target mock’s “上期议程” was intentionally omitted because the product has no historical-issue archive; no unsupported feature was implied.
- Icons and controls: visible utility and row-action icons use one consistent stroke family, align to 36–44 px controls, and expose labels or accessible names.
- Responsiveness and accessibility: the mobile agenda editor is modal, traps Tab/Shift+Tab, restores focus to its regenerated trigger, and leaves save/cancel controls unobscured. Fullscreen preview fills the 393 × 852 viewport, exits with Escape, restores focus, and maintains `aria-pressed`.

## Interaction and diagnostics evidence

- Desktop: workflow navigation, relay-import modal, template modal, settings targets, export overflow, agenda-row edit/open/close, and independent editor/preview scrolling.
- Mobile: task navigation; agenda editor open/close; forward and backward focus wrapping; regenerated-trigger focus restoration; preview switch; fullscreen open; Escape close; focus restoration.
- Breakpoints: 1440 × 1024, 393 × 852, and 412 × 915.
- Browser console: zero warnings or errors after the exercised desktop workflow; no interaction exception or page failure during the mobile workflow.
- Automated regression: `npm test` — 151 passed, 0 failed.

## Comparison history

### Iteration 1 — P2 accessibility state mismatch

- Earlier finding: after a mobile agenda row opened its editor, `renderAgendaList()` replaced the original trigger element. Closing the editor therefore left focus on the document body instead of returning it to the row.
- Fix: `rememberAgendaTrigger()` now stores the trigger element plus stable `data-action` and `data-id` descriptors. `restoreAgendaTriggerFocus()` locates the regenerated button after the list render and focuses it with scroll prevention.
- Regression coverage: `tests/agenda_control_console.test.mjs` now requires the stable trigger descriptor and regenerated-trigger lookup.
- Post-fix evidence: at 393 × 852, closing the editor restored focus to `BUTTON[data-action="edit"][data-id="s-open"]`; Tab and Shift+Tab still wrapped between the first and last dialog controls.

### Iteration 2 — post-fix comparison

- The revised desktop and mobile states were recaptured and compared with the selected target in the same comparison input.
- No additional P0/P1/P2 visual, responsive, interaction, accessibility, image, color, typography, spacing, or copy issue was found.

## Open Questions

- None. The wider editor shown in the concept and the omitted “上期议程” control are resolved product decisions documented in the approved design spec.

## Implementation Checklist

- [x] Compact global workflow header and one primary PDF export
- [x] Weekly-task information architecture and low-frequency settings
- [x] Dense, continuous agenda rows with contextual actions
- [x] A4-first preview hierarchy
- [x] Mobile task bar, bottom-sheet editor, focus containment, and fullscreen preview
- [x] Desktop/mobile visual comparison and interaction verification
- [x] Full automated regression suite

## Follow-up Polish

- No P3 item is required before handoff.

## Iteration 3 — annotated A4 header and legend refinement

### Comparison target

- Source visual truth (legend annotation): `C:/Users/77075/AppData/Roaming/Claude/tmp/codex-clipboard-8353ca0c-6969-431a-aa0c-ebffb59309a8.png`
- Source visual truth (header annotation): `C:/Users/77075/AppData/Roaming/Claude/tmp/codex-clipboard-4f1d3a00-a52d-475a-81dc-39aa16b52f15.png`
- Browser-rendered implementation: `http://localhost:4173/agenda_generator_modern.html`
- Full implementation evidence: `agenda-control-console-header-update.png`, `agenda-control-console-legend-removed.png`
- Focused implementation evidence: `agenda-control-console-header-focus.png`, `agenda-control-console-bottom-focus.png`
- State: saved 27-item agenda, A4 preview in `flow-fit-micro`, top-header and bottom-of-agenda scroll positions.

### Viewport and normalization

| Evidence | CSS viewport | Pixel dimensions | Density | Normalization |
| --- | ---: | ---: | ---: | --- |
| Legend annotation | focused source crop | 884 × 163 | supplied raster | Compared by content region; red annotation identifies the element to remove |
| Header annotation | focused source crop | 1140 × 377 | supplied raster | Compared by header proportions and hierarchy; surrounding page scale differs |
| Full browser implementation | 1125 × 801 | 1125 × 800 | DPR 1.3 | Browser viewport capture; the one-pixel height difference is browser chrome rounding |
| Header focused implementation | 585 × 88 CSS px on screen | 585 × 88 | DPR-normalized browser capture | Cropped from the full implementation at the measured header bounds |
| Bottom focused implementation | visible A4 bottom region | 365 × 472 | DPR-normalized browser capture | Cropped from the same browser viewport and agenda state |

### Full-view and focused comparison evidence

The two source annotations and the two browser captures were opened together in one comparison input. The full view confirms that the A4 remains the dominant proof surface and still fits on one page. The focused header comparison confirms that the existing Toastmasters asset is larger and sharper without changing the established three-column relationship. The focused bottom comparison confirms that the “即兴 / 备稿 / 茶歇” legend is absent and that the vision bar now follows the final agenda row directly, with the lower cards still clear of the printable footer.

### Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: the club title is now 24 px, the theme line 12.5 px, and the right metadata 13 px. Their weights, wrapping, and alignment remain balanced in the 76 px header.
- Spacing and layout rhythm: the logo column is 78 px, metadata column 182 px, and the header minimum height 76 px. Removing the 18 px legend reclaims more height than the 12 px header increase consumes. Browser geometry shows a 0.31 px non-overlapping final-row/vision boundary and positive 5.71 px flow-to-footer and 6.34 px vision-to-footer gaps.
- Colors and visual tokens: the existing navy, maroon, white, and semantic row fills are unchanged; the removed legend did not remove any row-color treatment.
- Image quality and asset fidelity: the existing Toastmasters logo asset is preserved at 72 × 58 CSS px with no stretching, placeholder, or code-drawn substitute.
- Copy and content: only the redundant legend labels were removed. Meeting identity, date, time, issue, theme, word, manager, vision, and agenda content remain intact.
- Responsiveness and accessibility: at the checked 1125 × 801 viewport the page has no horizontal or vertical document overflow, the A4 status remains “一页放得下”, and the browser console contains zero warnings or errors.

### Comparison history

- Initial annotated state: the legend consumed a dedicated strip above the vision bar and the header identity was visually undersized within its available area.
- Fix applied: removed the legend from the rendered A4 DOM and deleted its CSS; increased the header minimum height, grid tracks, logo, title, supporting copy, and right metadata.
- Post-fix evidence: `agenda-control-console-header-focus.png` and `agenda-control-console-bottom-focus.png` show the revised regions in the same agenda state. No further P0/P1/P2 visual fix was identified.

### Implementation checklist

- [x] Remove the A4 row-color legend from markup and styles
- [x] Scale the existing logo and all three header text tiers
- [x] Preserve A4 one-page fit and footer clearance
- [x] Compare both annotated regions with browser-rendered focused captures
- [x] Check browser warnings and errors
- [x] Add static regression coverage for the approved measurements

final result: passed

## Modern agenda PDF preview parity QA

- Source visual truth: C:\Users\77075\AppData\Roaming\Claude\tmp\codex-clipboard-5a53e0b7-bb68-4a6e-b086-10912965d704.png
- Implementation PDF: C:\Users\77075\.codex\visualizations\2026\08\07\019fdb90-bf47-7eb0-9758-da0f61bda1e6\pdf-review\preview-parity.pdf
- Implementation render: C:\Users\77075\.codex\visualizations\2026\08\07\019fdb90-bf47-7eb0-9758-da0f61bda1e6\pdf-review\preview-parity-page-1.png
- State: modern agenda A4 preview / browser vector print, standard density, full single-page document
- Browser viewport used for screen regression: 875 x 955 CSS px at device density 1
- PDF page: A4 portrait, 594.96 x 841.92 pt
- Source pixels: 875 x 955; detected A4 page crop: 633 x 896
- Implementation pixels: 893 x 1263 at 1.5x PDF rendering density
- Density normalization: the source A4 crop was resampled to 893 x 1263 before comparison
- Content caveat: the source contains issue 779 while the local regression fixture contains issue 782. Layout, type, color, assets, spacing, and document chrome were compared; agenda copy and row count were not treated as fidelity differences.

### Full-view comparison evidence

- Side-by-side normalized comparison: C:\Users\77075\.codex\visualizations\2026\08\07\019fdb90-bf47-7eb0-9758-da0f61bda1e6\pdf-review\design-qa\full-comparison.png
- Reference content margins (left / top / right / bottom): 4.90% / 3.68% / 4.74% / 4.24%
- Implementation content margins: 4.70% / 3.72% / 4.70% / 4.20%
- Composition result: the A4 inset, two-column body, header rule, sidebar width, agenda-table proportion, vision bar, and three-card footer align with the reference.

### Focused comparison evidence

- Header and first-row structure: C:\Users\77075\.codex\visualizations\2026\08\07\019fdb90-bf47-7eb0-9758-da0f61bda1e6\pdf-review\design-qa\header-comparison.png
- Dense agenda table: C:\Users\77075\.codex\visualizations\2026\08\07\019fdb90-bf47-7eb0-9758-da0f61bda1e6\pdf-review\design-qa\agenda-comparison.png

### Required fidelity surfaces

- Fonts and typography: the same application font stack, weights, hierarchy, line height, numeric face, and wrapping are inherited by print. The normalized source is softer because it began as a scaled browser screenshot; this is not an implementation mismatch.
- Spacing and layout rhythm: the print sheet now uses the same 210 x 297mm artboard and 10mm inset as preview. Card gaps, columns, table density, footer height, borders, and square page corners align.
- Colors and visual tokens: print now inherits the preview's maroon card headers, deep-blue table header and section rail, pale row fills, blue rule, and white paper instead of applying a printer-only palette.
- Image quality and asset fidelity: the supplied Toastmasters logo and QR assets remain the same source assets. The generated PDF keeps vector text and sharp raster assets without substitutes.
- Copy and content: all application-specific labels and document sections remain present. Issue-specific agenda copy differs only because the local fixture is issue 782 rather than the reference's issue 779.

### Comparison history

#### Iteration 1 - blocked

- P1: the prior PDF used a legacy 980 x 1386px poster sheet scaled to the page with zero padding. Evidence: old PDF content margins were 0.00% / 0.32% / 0.00% / 0.71% versus the reference's approximately 5% inset.
- P1: print-only color overrides changed maroon card titles, the deep-blue table header, and the blue section rail to white, so export did not match the visible preview.
- Fix: replaced the legacy scaled sheet with the modern 210 x 297mm artboard, restored the 10mm inset, removed print-only recoloring, and retained only structural print isolation plus exact color adjustment.

#### Iteration 2 - passed

- Post-fix evidence: full-comparison.png, header-comparison.png, and agenda-comparison.png show the restored inset, palette, proportions, and dense-table treatment.
- PDF verification: one A4 page, selectable text, 1,369 extracted characters, with the full footer on the same page.
- Browser regression: preview interaction opened successfully and browser console reported no warnings or errors.

### Findings

- No actionable P0, P1, or P2 visual differences remain after density normalization.
- P3 accepted: the reference screenshot contains different meeting content and browser-scale antialiasing, so text rasterization is not pixel-identical even though the document styles match.

### Implementation checklist

- [x] Preserve one authoritative A4 print rule.
- [x] Match preview artboard dimensions and 10mm inset.
- [x] Preserve preview colors, typography, supplied logo, and QR assets.
- [x] Keep browser chrome out of print.
- [x] Verify one-page PDF output and selectable text.
- [x] Verify the rendered PDF against the normalized reference at full view and focused regions.

final result: passed

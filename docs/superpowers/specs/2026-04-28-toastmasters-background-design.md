# Toastmasters Background Design

## Goal

Update the HTML app background so it feels clearly aligned with Toastmasters blue-and-white branding without introducing warm background tones.

## Approved Direction

Use a Toastmasters deep-blue page background with white or subtly translucent white panels. The interface should feel formal, calm, and meeting-focused.

## Visual Scope

- Replace the current warm cream/gold page background with a cool navy-blue background.
- Use only blue and white tones for the dominant background layers.
- Keep Toastmasters burgundy and gold as small accent colors for status, borders, and controls where they already support the UI.
- Keep existing layout, component structure, timer behavior, agenda behavior, and rule mapping logic unchanged.

## CSS Targets

- Update the global background tokens near `:root`.
- Update the final `html, body` background override so later CSS does not reintroduce cream, gold, or warm radial gradients.
- Prefer restrained gradients and overlays over decorative blobs.

## Acceptance Checks

- The main page background no longer reads as warm, cream, beige, gold, or red.
- White panels remain readable against the deep-blue background.
- Existing JavaScript still passes syntax checks.
- The deployed GitHub Pages page includes the updated background CSS.

---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Editor shell

- Scope: the full first-run and daily Markdown editing surface.
- Mode: Operate with a Read state.
- Audience: individual desktop writers opening local Markdown.
- Job: open, read, edit, and save without crossing a dashboard.
- Constraints: original implementation, GFM, local-first, desktop-only, keyboard and mouse access, resizable-window safety, no AI.

## Direction contract

THESIS: The document is the interface; a writer should move from library to live manuscript without crossing a dashboard or a mode wall.

OWN-WORLD: A first-party macOS editorial window: system paper, grouped neutral rails, quiet blue state, centered toolbar title, material popovers, and one continuous writing plane.

STORY: Arrive inside a formatted manuscript, type directly into it, reveal syntax only at the cursor, inspect structure from the edge, then write back to the local file with visible reassurance.

FIRST VIEWPORT: At a 1440px desktop window, show a collapsible 286px library, a centered 760px live manuscript, a 48px translucent native toolbar (62px in the browser preview), and an optional 286px inspector. At narrower desktop window sizes, rails may collapse or overlay before they can crush the reading measure; phone layouts are not a product target.

FORM: User-pinned Apple-quality direction, pressure-tested by seed 47c9e722. Signature interaction: Markdown punctuation dissolves when the cursor leaves a line while a frosted input-accessory dock exposes formatting and insertion without becoming a permanent toolbar.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

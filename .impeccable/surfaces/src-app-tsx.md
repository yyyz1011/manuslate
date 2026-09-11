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
- Constraints: original implementation, GFM, local-first, keyboard access, responsive layout, no AI.

## Direction contract

THESIS: The document is the interface; refuse dashboards, permanent toolbars, and card grids.

OWN-WORLD: Cool paper white, graphite ink, quiet blue selection, hairline separators, native-radius controls, and a single continuous writing plane.

STORY: Arrive in a finished document, read immediately, reveal tools only when editing, then save with visible reassurance.

FIRST VIEWPORT: A collapsible 248px file rail, centered 720px document measure, 52px title bar, and optional outline rail. Existing documents open in Read; Edit, Read, and Split sit beside the title.

FORM: Grounded direction 6, seed 182ccd6c. Signature interaction: editing summons a compact formatting shelf at the lower edge; focus mode quiets everything except the current paragraph.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

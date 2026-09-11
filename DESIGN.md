---
name: "PatchMark Core"
description: "A document-first Markdown workspace shaped like a quiet native reading desk."
colors:
  cool-ground-light: "#f4f5f7"
  rail-mist-light: "#eef0f3"
  paper-light: "#ffffff"
  paper-subtle-light: "#fafbfc"
  graphite-light: "#202329"
  graphite-strong-light: "#15171a"
  muted-light: "#626b75"
  faint-light: "#626b75"
  hairline-light: "#dde1e6"
  hairline-strong-light: "#cfd4da"
  quiet-blue-light: "#0878e6"
  quiet-blue-soft-light: "#dceeff"
  quiet-blue-ink-light: "#075aa8"
  selection-light: "#cae4ff"
  danger-light: "#cf3f37"
  shelf-light: "#25282d"
  shelf-ink-light: "#f4f5f6"
  cool-ground-dark: "#15171a"
  rail-mist-dark: "#1c1e22"
  paper-dark: "#202328"
  paper-subtle-dark: "#1b1d21"
  graphite-dark: "#e5e7ea"
  graphite-strong-dark: "#f7f8f9"
  muted-dark: "#9ba1aa"
  faint-dark: "#a1a8b1"
  hairline-dark: "#30343a"
  hairline-strong-dark: "#3a3f46"
  quiet-blue-dark: "#5aa7f8"
  quiet-blue-soft-dark: "#173e64"
  quiet-blue-ink-dark: "#9bcbff"
  selection-dark: "#1f4b75"
  danger-dark: "#ff7c73"
  shelf-dark: "#f0f1f3"
  shelf-ink-dark: "#202328"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, sans-serif"
    fontSize: "2.25em"
    fontWeight: 720
    lineHeight: 1.24
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, sans-serif"
    fontSize: "1.5em"
    fontWeight: 720
    lineHeight: 1.24
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Charter, Iowan Old Style, Palatino Linotype, ui-serif, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.78
    letterSpacing: "normal"
  editor:
    fontFamily: "SFMono-Regular, SF Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.82
    letterSpacing: "normal"
  ui:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 530
    lineHeight: 1.35
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  inline: "5px"
  compact: "7px"
  native: "8px"
  field: "9px"
  control: "10px"
  content: "12px"
  shelf: "13px"
  overlay: "14px"
  circular: "999px"
spacing:
  hairline: "1px"
  xxs: "2px"
  xs: "5px"
  sm: "8px"
  control: "10px"
  md: "14px"
  lg: "24px"
  document-gutter: "34px"
components:
  button-save:
    backgroundColor: "{colors.graphite-strong-light}"
    textColor: "{colors.paper-light}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "32px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted-light}"
    rounded: "{rounded.control}"
    padding: "0"
    size: "34px"
  button-icon-active:
    backgroundColor: "{colors.quiet-blue-soft-light}"
    textColor: "{colors.quiet-blue-ink-light}"
    rounded: "{rounded.control}"
    padding: "0"
    size: "34px"
  tab-active:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.graphite-strong-light}"
    typography: "{typography.label}"
    rounded: "{rounded.compact}"
    padding: "0 10px"
    height: "26px"
  search-field:
    backgroundColor: "{colors.paper-subtle-light}"
    textColor: "{colors.graphite-light}"
    typography: "{typography.ui}"
    rounded: "{rounded.field}"
    padding: "0 7px 0 9px"
    height: "34px"
  document-row-active:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.graphite-strong-light}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "9px"
  formatting-shelf:
    backgroundColor: "{colors.shelf-light}"
    textColor: "{colors.shelf-ink-light}"
    rounded: "{rounded.shelf}"
    padding: "5px"
  command-palette:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.graphite-light}"
    rounded: "{rounded.overlay}"
    width: "min(540px, calc(100vw - 30px))"
---

# Design System: PatchMark Core

## Overview

**Creative North Star: "The Quiet Document"**

PatchMark should feel less like opening software and more like returning to a finished page on a cool, carefully lit writing desk. The document is the visual center of gravity: chrome is compact, rails are tonal rather than boxed, and controls wait at the edges until the writer needs them.

The system combines cool paper surfaces, graphite text, hairline structure, quiet blue state feedback, and familiar native proportions. Restraint is functional rather than empty: reading receives an editorial serif voice, editing receives a precise mono voice, and the surrounding interface stays in a quiet system sans.

**Key Characteristics:**

- One continuous writing plane, never a dashboard or card grid.
- Cool neutral surfaces with graphite ink and a single quiet-blue interaction voice.
- Native-radius controls, dense desktop chrome, and generous document breathing room.
- Serif reading, monospaced source editing, and sans-serif interface chrome.
- Progressive disclosure through rails, a command palette, focus mode, and the floating formatting shelf.

## Colors

The palette is a cool-paper neutral system with one restrained blue accent and a complete dark counterpart; state is communicated through tonal shifts before saturation.

### Primary

- **Quiet Blue:** `quiet-blue-light` and `quiet-blue-dark` mark the caret, current document, dirty state, checkbox accent, and focus affordances.
- **Quiet Blue Wash:** `quiet-blue-soft-light` and `quiet-blue-soft-dark` carry selected-control and suggested-command backgrounds without turning the interface into a blue surface.
- **Quiet Blue Ink:** `quiet-blue-ink-light` and `quiet-blue-ink-dark` carry links and foreground content on blue washes.

### Secondary

- **Signal Red:** `danger-light` and `danger-dark` are reserved for destructive or error states; they are not general emphasis colors.

### Neutral

- **Cool Ground:** `cool-ground-light` and `cool-ground-dark` separate the application frame from the document.
- **Rail Mist:** `rail-mist-light` and `rail-mist-dark` identify auxiliary rails without card boundaries.
- **Paper:** `paper-light` and `paper-dark` are the uninterrupted writing and reading plane.
- **Subtle Paper:** `paper-subtle-light` and `paper-subtle-dark` support the title bar, fields, and quiet inset surfaces.
- **Graphite:** `graphite-light`, `graphite-dark`, `graphite-strong-light`, and `graphite-strong-dark` establish readable text hierarchy without pure-black glare.
- **Muted and Faint:** the `muted-*` and `faint-*` pairs carry secondary labels, metadata, and dormant controls.
- **Hairlines:** the `hairline-*` and `hairline-strong-*` pairs divide structural regions and strengthen only at overlays or mobile drawers.
- **Shelf Reversal:** `shelf-light`, `shelf-dark`, `shelf-ink-light`, and `shelf-ink-dark` invert the floating formatting shelf against the document.
- **Selection Wash:** `selection-light` and `selection-dark` keep selected text unmistakable but calm.

### Named Rules

**The Quiet Blue Rule.** Blue appears only for current, selected, focused, linked, or unsaved state; it never becomes a large decorative field.

**The Paper Hierarchy Rule.** Separate regions with cool neutral tone and hairlines before introducing containers, cards, or shadow.

## Typography

**Display Font:** system display sans with SF Pro Display and Segoe UI fallbacks  
**Body Font:** Charter with Iowan Old Style, Palatino, and Georgia fallbacks  
**Label/Mono Font:** system text sans for chrome; SF Mono with Menlo and Consolas fallbacks for Markdown source

**Character:** The reading surface is bookish and unhurried, while the editor is precise and tool-like. Native sans-serif chrome binds both modes together without competing for attention.

### Hierarchy

- **Display** (720, `2.25em`, 1.24): rendered level-one document headings.
- **Headline** (720, `1.5em`, 1.24): rendered level-two headings and major content divisions.
- **Body** (400, `17px`, 1.78): rendered Markdown prose inside the centered document measure.
- **Editor** (400, `16px`, 1.82): Markdown source with line wrapping and no visible gutters.
- **UI** (530, `13px`, 1.35): file names, search text, and document-title chrome.
- **Label** (650, `11px`, 1.35): compact actions, mode controls, counts, and status information.

### Named Rules

**The Three Voices Rule.** Serif belongs to rendered prose, mono belongs to source editing, and system sans belongs to interface chrome and rendered headings.

**The Reading Rhythm Rule.** Long-form content keeps a relaxed line height and a centered measure; compact UI type must not leak into the document.

## Layout

The application is a full-height three-column shell: a collapsible document rail at `248px`, a flexible document workspace, and an optional outline rail at `236px`. Both reading and editing center their content at a maximum `720px` measure with a `34px` desktop gutter. A `54px` title bar and `30px` status strip frame the page without becoming a permanent tool ribbon.

At `1120px`, visible rails tighten to `226px` and `210px`. Below `860px`, the shell becomes a single document plane, the library becomes an overlay drawer, the outline disappears, split view resolves to reading, and primary touch targets grow to at least `44px`. Below `520px`, mode labels disappear and rendered prose steps down to `16px`.

**The Document Is the Surface Rule.** Start every composition from the continuous writing plane; rails and controls support it but never replace it with dashboard scaffolding.

**The 720 Measure Rule.** Keep reading and source content centered within the implemented `720px` measure; use split view to divide work modes, not to stretch prose.

## Elevation & Depth

The system is flat by default. Tonal layers and one-pixel separators define the shell; a tiny shadow confirms selected tabs and the active document row. The stronger ambient shadow is reserved for elements that truly float above the document: the formatting shelf, command palette, toast, and compact-screen drawer.

### Shadow Vocabulary

- **Selected Surface** (`0 1px 2px rgba(20, 26, 32, 0.045)`): the active document row.
- **Selected Control** (`0 1px 3px rgba(20, 26, 33, 0.12)`): the active Read/Edit/Split tab.
- **Floating Light** (`0 14px 36px rgba(21, 27, 34, 0.16), 0 2px 7px rgba(21, 27, 34, 0.1)`): shelf, palette, and toast in light appearance.
- **Floating Dark** (`0 18px 42px rgba(0, 0, 0, 0.36), 0 2px 9px rgba(0, 0, 0, 0.24)`): the same floating elements in dark appearance.
- **Drawer** (`18px 0 42px rgba(15, 20, 26, 0.2)`): the compact-screen document drawer only.

### Named Rules

**The Earned Elevation Rule.** A shadow must correspond to selected state or physical overlay; static content and structural rails stay flat.

## Shapes

Controls use gently curved native rectangles: compact internals at `7–8px`, fields and primary actions at `9px`, common hit targets and rows at `10px`, content blocks at `12px`, the floating shelf at `13px`, and the command palette at `14px`. Hairline borders remain crisp and unornamented. Circles are limited to true circular indicators such as the unsaved dot.

**The Native Radius Rule.** Radius follows scale and function; never round every surface into a capsule, and never use cards merely to create corners.

## Components

### Buttons

- **Shape:** compact icon controls use the common native curve (`10px`); text actions use `9–10px`.
- **Primary:** the Save and empty-document actions reverse strong graphite against paper, with compact horizontal padding and clear saved/unsaved icon feedback.
- **Hover / Focus:** hover changes tone or opacity; press scales to `0.94–0.96`; keyboard focus uses a three-pixel quiet-blue mixed outline with a two-pixel offset.
- **Icon / Ghost:** neutral at rest, a faint tonal fill on hover, and a quiet-blue wash only when active.

### Chips

- **Style:** the Read/Edit/Split switcher is the system's segmented chip group: cool ground container, hairline border, compact `7px` inner segments.
- **State:** the selected segment becomes paper with strong graphite text and a small selected-control shadow; unselected segments remain transparent and muted.

### Cards / Containers

- **Corner Style:** ordinary content avoids cards; overlays use the larger `14px` curve.
- **Background:** paper for the command palette and active row, rail mist for auxiliary navigation, subtle paper for inset chrome.
- **Shadow Strategy:** see the Earned Elevation Rule.
- **Border:** one strong hairline around overlays; ordinary structure uses the standard hairline.
- **Internal Padding:** compact UI uses the `5–14px` rhythm; the document keeps the `34px` gutter.

### Inputs / Fields

- **Style:** search fields use subtle paper, a one-pixel hairline, `9px` corners, and `34px` height.
- **Focus:** focus strengthens the border toward quiet blue and adds a soft three-pixel halo.
- **Error / Disabled:** danger tokens are reserved for real failures; no decorative red or opacity-only error treatment.

### Navigation

The library rail and outline are tonal extensions of the shell. Rows are transparent by default, gain a faint neutral hover, and use paper plus stronger typography for the current document. On compact screens, the library becomes a left drawer over a dimmed scrim; the outline is removed rather than compressed.

### Formatting Shelf

The signature formatting shelf appears only while editing. It floats at the lower edge of the document, reverses shelf ink against the shelf surface, groups icon commands with hairline dividers, and expands each action to a `44px` touch target on compact screens.

### Command Palette

The command palette is a restrained paper overlay with a strong hairline, the shared floating shadow, a `52px` search row, and suggestion rows that use the quiet-blue wash. It traps focus, restores focus on close, and treats motion as a short spatial confirmation rather than spectacle.

## Do's and Don'ts

### Do:

- **Do** begin with a readable document and reveal navigation or formatting controls only when the task calls for them.
- **Do** use quiet blue exclusively for interaction state, selection, links, caret, and trustworthy save feedback.
- **Do** preserve the serif/mono/sans division between reading, source editing, and chrome.
- **Do** keep desktop controls compact while expanding interactive targets to at least `44px` below the compact breakpoint.
- **Do** honor reduced-motion preferences by collapsing animations and transitions to effectively instantaneous feedback.

### Don't:

- **Don't** turn the home surface into a dashboard, permanent toolbar, card grid, or configuration gate.
- **Don't** stretch prose beyond the centered `720px` measure or use wide lines to fill available space.
- **Don't** introduce extra accent hues, decorative gradients, or broad blue panels.
- **Don't** apply strong shadow to static rails, document content, or ordinary controls.
- **Don't** compress split view or the outline into narrow screens; resolve to the simpler reading plane.

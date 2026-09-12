---
name: "Manuslate Core"
description: "A document-first desktop Markdown workspace with first-party editorial restraint."
colors:
  system-ground-light: "#f2f2f7"
  grouped-sidebar-light: "#ececf1"
  paper-light: "#ffffff"
  chrome-light: "rgba(251, 251, 253, 0.78)"
  elevated-light: "rgba(255, 255, 255, 0.88)"
  graphite-light: "#1d1d1f"
  graphite-soft-light: "#3a3a3c"
  secondary-light: "#636366"
  tertiary-light: "#68686d"
  separator-light: "rgba(60, 60, 67, 0.13)"
  separator-strong-light: "rgba(60, 60, 67, 0.21)"
  fill-light: "rgba(120, 120, 128, 0.12)"
  fill-strong-light: "rgba(120, 120, 128, 0.2)"
  editorial-crimson: "#c84049"
  editorial-crimson-soft-light: "rgba(200, 64, 73, 0.13)"
  editorial-crimson-ink-light: "#ad2f3b"
  selection-light: "rgba(200, 64, 73, 0.2)"
  danger-light: "#b42332"
  system-ground-dark: "#111113"
  grouped-sidebar-dark: "#1b1b1e"
  paper-dark: "#202023"
  chrome-dark: "rgba(31, 31, 34, 0.8)"
  elevated-dark: "rgba(44, 44, 47, 0.9)"
  graphite-dark: "#f5f5f7"
  graphite-soft-dark: "#e2e2e7"
  secondary-dark: "#aeaeb2"
  tertiary-dark: "#98989d"
  separator-dark: "rgba(235, 235, 245, 0.13)"
  separator-strong-dark: "rgba(235, 235, 245, 0.21)"
  fill-dark: "rgba(118, 118, 128, 0.24)"
  fill-strong-dark: "rgba(118, 118, 128, 0.34)"
  editorial-crimson-soft-dark: "rgba(255, 100, 104, 0.18)"
  editorial-crimson-ink-dark: "#ff8588"
  selection-dark: "rgba(255, 100, 104, 0.28)"
  danger-dark: "#ff5c63"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 760
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "2.15em"
    fontWeight: 730
    lineHeight: 1.24
    letterSpacing: "-0.028em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  live-editor:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  source-editor:
    fontFamily: "SFMono-Regular, SF Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.82
    letterSpacing: "normal"
  ui:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 660
    lineHeight: 1.35
    letterSpacing: "0.02em"
rounded:
  inline: "5px"
  compact: "7px"
  tab: "9px"
  field: "10px"
  control: "11px"
  group: "12px"
  popover: "14px"
  dock: "16px"
  circular: "50%"
spacing:
  hairline: "1px"
  xxs: "2px"
  xs: "6px"
  sm: "9px"
  control: "10px"
  md: "14px"
  section: "18px"
  lg: "24px"
  manuscript-gutter: "42px"
components:
  button-primary:
    backgroundColor: "{colors.editorial-crimson}"
    textColor: "{colors.paper-light}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "42px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-light}"
    rounded: "{rounded.control}"
    padding: "0"
    size: "40px"
  button-icon-active:
    backgroundColor: "{colors.editorial-crimson-soft-light}"
    textColor: "{colors.editorial-crimson-ink-light}"
    rounded: "{rounded.control}"
    padding: "0"
    size: "40px"
  view-button:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-light}"
    typography: "{typography.ui}"
    rounded: "{rounded.field}"
    padding: "0 10px"
    height: "36px"
  search-field:
    backgroundColor: "{colors.fill-light}"
    textColor: "{colors.graphite-light}"
    typography: "{typography.ui}"
    rounded: "{rounded.field}"
    padding: "0 8px 0 10px"
    height: "36px"
  document-row-active:
    backgroundColor: "{colors.editorial-crimson-soft-light}"
    textColor: "{colors.editorial-crimson-ink-light}"
    typography: "{typography.ui}"
    rounded: "{rounded.group}"
    padding: "11px 11px 10px 13px"
    height: "78px"
  inspector-tab-active:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.graphite-light}"
    typography: "{typography.label}"
    rounded: "{rounded.compact}"
    padding: "0 9px"
    height: "29px"
  format-dock:
    backgroundColor: "{colors.elevated-light}"
    textColor: "{colors.secondary-light}"
    rounded: "{rounded.dock}"
    padding: "6px"
  command-palette:
    backgroundColor: "{colors.elevated-light}"
    textColor: "{colors.graphite-light}"
    rounded: "{rounded.dock}"
    width: "min(560px, calc(100vw - 30px))"
---

# Design System: Manuslate Core

## Overview

**Creative North Star: "The Native Editorial Window"**

Manuslate is a macOS- and Windows-PC document tool shaped with the quiet confidence of a first-party desktop editor. The window opens inside the work: a grouped library, a centered live manuscript, a restrained toolbar, and an optional inspector share one continuous document environment rather than a dashboard or mode wall.

The visual system uses system typography, paper white, grouped gray rails, hairline separators, restrained editorial-crimson state, and contextual translucent materials. Its signature is live Markdown typesetting: punctuation and syntax stay out of the way until the caret enters the current line, while formatting and insertion actions live in a contextual dock instead of a permanent ribbon. Mouse precision and dense keyboard navigation define interaction density; narrow behavior is only a safety mechanism for resized desktop windows.

**Key Characteristics:**

- A first-party desktop document window for macOS and Windows PC.
- One continuous `760px` manuscript plane with syntax revealed only on the current line.
- A `286px` grouped library, a `40px` native window strip with a separate sidebar brand row (`62px` combined toolbar in the browser preview), and an optional `286px` inspector.
- System sans throughout rendered content and interface chrome; mono only for explicit source mode and code.
- Editorial crimson for state, paper white for the manuscript, grouped gray for supporting rails.
- Contextual material popovers and format dock, controlled by keyboard and mouse.

## Colors

The palette follows desktop system materials: paper and grouped neutrals carry structure, graphite carries content, and editorial crimson is the single interaction voice across light and dark appearances.

### Primary

- **Editorial Crimson:** `editorial-crimson` marks the caret, compose/save actions, current mode cues, checked tasks, focus, and other immediate interactive state.
- **Crimson Wash:** `editorial-crimson-soft-light` and `editorial-crimson-soft-dark` carry selected rows, hovered commands, and active controls without becoming large decorative panels.
- **Crimson Ink:** `editorial-crimson-ink-light` and `editorial-crimson-ink-dark` keep active text and icons legible on the wash.

### Secondary

- **System Danger:** `danger-light` and `danger-dark` are reserved for errors or destructive state, never general emphasis.

### Neutral

- **System Ground:** `system-ground-light` and `system-ground-dark` frame the document window and ground code blocks.
- **Grouped Sidebar:** `grouped-sidebar-light` and `grouped-sidebar-dark` distinguish library and inspector rails from the manuscript without card chrome.
- **Paper:** `paper-light` and `paper-dark` are the uninterrupted manuscript surface.
- **Toolbar Material:** `chrome-light` and `chrome-dark` support the translucent toolbar and status strip.
- **Elevated Material:** `elevated-light` and `elevated-dark` belong to popovers, the format dock, and the command palette.
- **Graphite:** the `graphite-*`, `secondary-*`, and `tertiary-*` pairs create primary, secondary, and metadata hierarchy without hard black/white contrast.
- **Separators:** `separator-*` and `separator-strong-*` divide structural regions and strengthen at elevated edges.
- **System Fills:** `fill-*` and `fill-strong-*` provide hover, field, and pressed feedback within neutral chrome.
- **Selection:** `selection-light` and `selection-dark` keep text selection visible while staying in the editorial-crimson family.

### Named Rules

**The Editorial Crimson Rule.** Crimson communicates current, selected, focused, linked, save, or compose state; it never becomes background decoration.

**The Material Hierarchy Rule.** Use grouped gray for rails, paper for the manuscript, translucent chrome for fixed bars, and elevated material only for content that physically floats.

## Typography

**Display Font:** the operating-system UI family, led by SF Pro Text on macOS and Segoe UI on Windows

**Body Font:** the same system UI family for live and rendered manuscripts
**Label/Mono Font:** system UI family for chrome; SF Mono, Menlo, or Consolas for source mode and code

**Character:** A single system type family makes the document and window feel immediate, familiar, and natively dense on both desktop platforms. Weight, measure, and spacing establish hierarchy; serif styling is not part of this system.

### Hierarchy

- **Display** (760, `32px`, 1.1): the library title and rare top-level window landmarks.
- **Headline** (730, `2.15em`, 1.24): level-one rendered manuscript headings; lower heading levels step down within the same family.
- **Body** (400, `17px`, 1.75): rendered reading and export preview within the `760px` manuscript measure.
- **Live Editor** (400, `17px`, 1.72): in-place Markdown writing with formatted blocks and contextual syntax.
- **Source Editor** (400, `15px`, 1.82): explicit Markdown source mode and code-oriented inspection.
- **UI** (650, `14px`, 1.35): document titles and principal row labels.
- **Label** (660, `11px`, `0.02em`): section labels, metadata, counters, and compact navigation.

### Named Rules

**The System Voice Rule.** Use the platform UI family for manuscript and chrome; switch to mono only when the user explicitly asks to see source or code.

**The Caret Reveals Syntax Rule.** Live mode hides Markdown punctuation away from the current line and restores literal marks wherever the caret is editing.

## Layout

At a `1440px` desktop window, the shell is a three-column document workspace: a collapsible `286px` library, a flexible center workspace containing a `760px` manuscript, and an optional `286px` inspector. On macOS, a compact `40px` native window strip carries the traffic lights and sidebar toggle while the Manuslate brand occupies its own quiet row below; the centered document title and actions share that top strip in the workspace. The browser preview retains a roomier combined `62px` toolbar. A `28px` status strip provides quiet document state without becoming a second toolbar.

The manuscript uses `42px` desktop gutters and generous top/bottom breathing room. At `1180px`, the library tightens to `252px` and the inspector overlays rather than shrinking the manuscript. At `900px`, both rails become desktop-window overlays and split view resolves to reading. The `520px` rules are emergency clipping protection for an unusually narrow resized desktop window, not a phone layout or a separate product surface.

**The Document Is the Window Rule.** The manuscript remains the center of the application; library, toolbar, inspector, dock, and popovers exist only to support it.

**The 760 Measure Rule.** Keep live, source, rendered, empty, loading, print, and export content aligned to the same `760px` maximum measure.

**The Collapse Before Crush Rule.** When a desktop window narrows, collapse or overlay auxiliary rails before reducing the manuscript to an unreadable column.

## Elevation & Depth

The base window is flat and structured by material changes and one-pixel separators. Elevation appears only when content crosses a plane: popovers, the format dock, command palette, toast, and overlaid rails. Translucency is functional, preserving context beneath fixed chrome and temporary controls.

### Shadow Vocabulary

- **Floating Light** (`0 18px 46px rgba(22, 27, 34, 0.16), 0 3px 12px rgba(22, 27, 34, 0.09)`): all elevated light-appearance controls.
- **Floating Dark** (`0 22px 56px rgba(0, 0, 0, 0.48), 0 4px 14px rgba(0, 0, 0, 0.3)`): the corresponding dark-appearance lift.
- **Selected Segment** (`0 1px 3px rgba(0, 0, 0, 0.12)`): the active inspector tab only.
- **Overlay Rail** (`±18px 0 48px rgba(0, 0, 0, 0.18–0.22)`): a library or inspector temporarily crossing above the manuscript in a narrow desktop window.

### Named Rules

**The Earned Elevation Rule.** Static manuscript and rails remain flat; shadow and blur belong only to overlays, transient feedback, or a selected inset segment.

**The Context Through Material Rule.** Toolbar, status, dock, and popovers may blur the plane behind them so long as content remains readable and the hierarchy stays quiet.

## Shapes

The form language uses compact desktop radii rather than pills: inline details at `5–7px`, fields and menu rows at `9–10px`, toolbar controls at `11px`, grouped document/info surfaces at `12px`, popovers at `14px`, and the format dock and command palette at `16px`. Circles are reserved for literal circular affordances such as the search clear control and unsaved dot.

**The Native Radius Rule.** Radius follows component scale and material level; do not turn labels, toolbar groups, or arbitrary content into capsules.

## Components

### Buttons

- **Shape:** toolbar icon buttons are precise `40px` mouse targets with `11px` corners; primary manuscript actions are `42px` high with the same radius.
- **Primary:** compose/save and first-document actions use editorial crimson with white text; secondary toolbar controls remain transparent and graphite-muted.
- **Hover / Focus:** neutral controls gain system fill, active controls gain crimson wash, press scales to `0.90–0.985`, and keyboard focus uses a three-pixel crimson outline with a two-pixel offset.
- **Disabled:** menu actions may reduce opacity to `0.38` while retaining shape and label context.

### Chips

- **Style:** inspector tabs form a compact grouped-gray segmented control with `7px` inner segments inside a `9px` group.
- **State:** the active segment becomes paper, graphite, and lightly elevated; inactive segments remain transparent and secondary.

### Cards / Containers

- **Corner Style:** ordinary manuscript content stays uncarded; document-info groups use `12px`, popovers use `14px`, and high-level floating controls use `16px`.
- **Background:** paper belongs to manuscript and grouped info; elevated translucent material belongs to temporary controls.
- **Shadow Strategy:** follow the Earned Elevation Rule.
- **Border:** elevated menus use the strong separator; shell divisions use the standard separator.
- **Internal Padding:** dense controls use `6–14px`; manuscript content uses the `42px` gutter.

### Inputs / Fields

- **Style:** library search is a borderless `36px` system-fill field with `10px` corners; title editing is a centered `26px` fill field with `7px` corners.
- **Focus:** search gains an inset crimson stroke plus a three-pixel crimson wash; text inputs retain a visible keyboard focus outline.
- **Error / Disabled:** system danger is reserved for real failure; disabling never depends on color alone.

### Navigation

The `286px` library is a grouped neutral rail with 78px document rows, title/snippet/time hierarchy, and an editorial-crimson selected state. The optional `286px` inspector uses keyboard-navigable tabs and indented outline rows. Both are mouse-precise, keyboard reachable, and may overlay only as a narrow desktop-window fallback.

### Live Manuscript

Live mode is the default expression of the product. Headings, quotes, lists, task markers, tables, math, footnotes, and code take on rendered hierarchy while Markdown punctuation is removed away from the caret line. The current line always exposes literal source so editing remains trustworthy; source mode reveals all syntax, reading mode removes editing chrome, and split mode pairs source with rendered output on sufficiently wide windows.

### Format Dock

The contextual format dock floats above the bottom status strip only while an editable mode is active. It uses elevated material, a strong separator, `16px` corners, `36px` icon actions, and grouped dividers; its insertion menu expands upward without becoming a permanent ribbon.

### Popovers and Command Palette

View, share, insert, and command surfaces use elevated translucent material, strong separators, and the shared floating shadow. Menu rows support arrow-key navigation; the command palette traps focus, restores it on close, and preserves keyboard hints with tabular numerals.

## Do's and Don'ts

### Do:

- **Do** open into a usable manuscript rather than a dashboard, setup screen, or mobile-style landing state.
- **Do** align all document representations to the implemented `760px` manuscript measure.
- **Do** reveal Markdown syntax only on the current line in live mode and provide explicit source mode for complete literal access.
- **Do** reserve editorial crimson for interaction state, compose/save actions, selection, focus, links, and current context.
- **Do** keep library and inspector controls dense, mouse-precise, and fully keyboard navigable.
- **Do** collapse or overlay rails when a desktop window becomes too narrow, and honor reduced-motion preferences.

### Don't:

- **Don't** describe or design Manuslate as an iPadOS, phone, mobile-browser, or touch-first product.
- **Don't** reintroduce serif manuscript typography; the implemented reading and live-editing voice is the system UI family.
- **Don't** add a permanent formatting ribbon, dashboard card grid, or separate preview wall between writing and the finished page.
- **Don't** stretch prose beyond the `760px` measure or let rails crush the manuscript.
- **Don't** use large accent surfaces, decorative gradients, or extra accent families.
- **Don't** use narrow-window safety rules as evidence for a separate mobile design system.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: React, TypeScript, Vite, and CodeMirror 6 for the first locally reviewable desktop-window core. The shipped target is a macOS/Windows PC tool; this web surface is its interaction prototype, not a mobile product. Keep the file layer isolated so a lightweight desktop shell can replace browser file access after the interaction model is accepted.

## Users

People who write and read Markdown every day and want a calm, premium tool that gets out of the way. The first user is an individual writer working with local `.md` files on a desktop.

## Product Purpose

Make opening, reading, editing, and saving Markdown feel immediate and dependable. Success means a user can open the app and start useful work without learning a workspace model, configuring AI, or navigating a dashboard.

## Positioning

An open-source Markdown editor whose restraint is functional: the document is always primary, Markdown remains portable, and advanced controls appear only at the moment they are useful.

## Operating Context

The product is used for focused drafting, technical notes, README files, long-form writing, and quick edits to existing local Markdown. Keyboard-driven editing and long reading sessions are normal. The app should restore the last document and editing state without turning launch into a management screen.

## Capabilities and Constraints

- Core first: in-place live preview, source editing, rendered reading, split view, local open/save, autosaved recovery, outline, scoped full-text search, keyboard shortcuts, focus mode, word count, and light/dark appearance.
- Desktop import accepts files or folders through a staged drag-and-drop dialog. Imported folders preserve their relative paths and nested folder tree while remaining regroupable through user categories.
- Rich Markdown includes GFM, task lists, tables, footnotes, fenced code, and KaTeX mathematics without introducing a proprietary document format.
- Contextual authoring includes slash insertion, a selection toolbar, and image paste/drop into a user-chosen local asset directory while keeping relative Markdown paths.
- Local knowledge management includes nested categories, source folder paths, pinned shortcuts, an explicit multi-select mode, recoverable batch removal for documents/folders/categories, document-relative links, duplicate-target detection, backlinks, and broken-link checks.
- Local file trust includes IndexedDB-backed handle recovery, visible permission state, external-change polling, and a diff-first conflict decision before overwrite.
- Recovery includes capped automatic versions, named checkpoints, line comparison, restore-before-overwrite protection, and a local trash flow.
- New documents may start from built-in plain-Markdown templates; templates never change the document format.
- Export begins with Markdown, rich copy, standalone HTML, and the system print/PDF path.
- GitHub-Flavored Markdown is the initial compatibility target.
- No AI features in the core milestone.
- No proprietary document format and no forced account.
- The first build is a browser-local reviewable implementation at desktop window sizes; native desktop packaging follows after the core interaction is accepted.
- Mobile browsers, phone layouts, and touch-first interaction are outside the product scope. Narrow-window behavior exists only to keep a resized desktop window usable.
- Product code and visual design are original. Competitors are used only to understand category expectations and tradeoffs.

## Brand Commitments

- Product name: Manuslate (manuscript + slate).
- Interaction quality should feel as considered as a first-party Apple app: quiet, direct, predictable, and carefully animated.
- The structural reference is a first-party macOS document window: split-view library, centered toolbar title, contextual material surfaces, precise mouse targets, dense keyboard navigation, and restrained spatial transitions.
- Minimal does not mean featureless; depth should be progressively disclosed.

## Evidence on Hand

No user research, testimonials, performance benchmarks, or final brand assets are available yet. Do not fabricate them. The local prototype is the evidence artifact for review.

## Product Principles

1. The document is the home screen.
2. Open and type before organize and configure.
3. Preserve plain Markdown and make saving trustworthy.
4. Hide complexity until context makes it useful.
5. Prefer familiar platform behavior over decorative novelty.

## Accessibility & Inclusion

Keyboard access, visible focus, reduced-motion support, readable contrast, and scalable text are release requirements for the core editor.

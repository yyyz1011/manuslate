# Manuslate

![Manuslate app icon](public/manuslate-icon-v1-128.png)

A refined, open-source, local-first Markdown editor and document library for desktop. Manuslate opens directly into the document, keeps files portable, and puts advanced tools one deliberate click away.

> The name combines **manuscript** and **slate**: a calm surface for turning structured text into finished work.

## Highlights

- Live Markdown editing, source, reading, and split views
- GFM, tables, tasks, footnotes, math, links, images, and fenced code
- File and folder import with preserved relative paths
- Nested categories, pinned documents, drag-to-organize, backlinks, and broken-link checks
- Local files with explicit save state, external-change detection, and conflict comparison
- Recovery drafts, automatic and named versions, and Recently Deleted
- In-document outline, scoped library search, find/replace, command palette, and focus mode
- Markdown, rich-text, standalone HTML, and system print/PDF output
- Configurable typography, page width, default document folder, and light/dark appearance
- English and Simplified Chinese interface; English is the default
- No account, proprietary document format, or cloud dependency

## Run locally

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:4173/>.

## Build

```bash
npm run build
npm run preview

# Native development window
npm run app:dev

# macOS .app
npm run app:build

# Distributable macOS .dmg
npm run app:dmg
```

Native artifacts are written to `src-tauri/target/release/bundle/`. The desktop app reads and writes only files or folders chosen by the user. Its remembered folder access and recovery metadata stay on the current device.

## 中文

Manuslate 是一款开源免费、本地优先的桌面 Markdown 编辑器与文稿资料库。启动后直接进入文稿，支持实时排版、源码、阅读与分栏视图，以及文件夹导入、分类、双链、版本恢复、本地图片、搜索替换和多种导出。设置中可切换简体中文；默认界面语言为英文。

当前里程碑先把 Markdown 核心和本地资料管理做好。AI、账户、云同步、移动端和多人协作不在当前范围内。

## Feedback

Use [GitHub Issues](https://github.com/yyyz1011/manuslate/issues) for bugs and feature requests.

## License

MIT

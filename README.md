# PatchMark Core

一款安静、本地优先、开源免费的 Markdown 编辑器。当前阶段不做 AI，先把打开、阅读、编辑和保存做得足够好。

## 当前能力

- 启动直接进入 Markdown 阅读视图，而不是仪表盘
- CodeMirror 6 源码编辑、阅读预览、分栏对照
- GitHub-Flavored Markdown 表格、任务列表、链接与代码块
- 打开多个本地 Markdown 文件并保存回本地
- 浏览器不支持 File System Access API 时自动降级为上传与下载
- 草稿自动恢复、磁盘未保存状态提示
- 可收起文稿列表与文档大纲
- 专注当前段落的写作模式
- 浮动 Markdown 格式工具架
- 命令面板与常用键盘快捷键
- 浅色、深色和跟随系统外观
- 窄屏适配、键盘焦点和减少动态效果支持

## 本地运行

```bash
npm install
npm run dev
```

打开 <http://127.0.0.1:4173/>。

## 构建

```bash
npm run build
npm run preview
```

## 产品边界

这一里程碑只验证 Markdown 核心体验。AI、资料库治理、账户、云同步与复杂工作台均不在首版范围内。浏览器版本用于快速评审交互；核心确认后再接入轻量桌面壳和原生文件能力。

## License

MIT

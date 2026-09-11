# AI Markdown Editor

一个面向 Markdown 资料库管理者的本地工作台：编辑、阅读、盘点、分类、治理和 AI 辅助管理都基于用户已有的普通 `.md` 文件。

当前工作名：**PatchMark**（仅作内部代号，正式名称待验证）。

## 核心承诺

> Markdown 原文是唯一真源。任何不是用户明确接受的修改，都不会被编辑器写入文件。

产品不是把聊天框塞进 Markdown，也不要求用户迁入专有数据库。打开一个文件夹后，它先用确定性规则盘点资料库，再由 AI 对已有 Markdown 提出分类、标签、元数据、去重、归档和结构调整建议；所有批量操作都以可检查、可拒绝、可回滚的变更计划执行。

目标不是“功能数量最多”，而是同时做到：专业编辑不弱、陌生资料库接管最快、AI 结论有来源、批量治理最安全、原始 Markdown 最自由。

## 产品定位

- 核心：功能完整的 Markdown 阅读与编辑器
- 主视角：管理一个 Markdown 资料库，而不只是写一篇文档
- AI 角色：资料管理员和治理助手，写作润色是辅助能力
- 数据原则：原目录直接工作，正文不进入专有格式
- 发布方式：编辑器与本地功能永久免费开源
- 模型方式：用户连接自己的云模型接入点，或使用 Ollama、LM Studio 等本地模型

## 当前阶段

- 阶段：`0.1.0` 可运行原型
- 已完成浏览器本地版的第一条纵向闭环：只读扫描、资料总览、搜索筛选、健康检查、阅读编辑、保存前差异和写入冲突保护
- 当前仍使用内部代号 PatchMark；正式名称、许可证和发布渠道会在首轮用户验证后决定
- 下一阶段：后台索引、反向链接、Frontmatter 批量编辑、AI 分类建议和事务回滚

## 本地运行

要求：Node.js 20 或更高版本，推荐最新版 Chrome 或 Edge。

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:4173/`。应用默认载入内置示例资料库；点击“打开本地文件夹”后，会通过浏览器 File System Access API 直接读取用户选择的目录。

```bash
npm test
npm run build
```

### 当前安全边界

- 扫描阶段对目录零写入。
- 跳过 `.git`、`node_modules`、构建产物和隐藏目录。
- 保存前显示逐行差异，只写当前文档。
- 写入前重新校验文件哈希；若被其他程序修改则拒绝覆盖。
- AI API Key 只保留在当前页面会话，不写入 localStorage 或项目文件。
- 浏览器版本目前不持久化目录授权，刷新页面后需要重新选择目录。

## 文档

- [产品设计](docs/PRODUCT_DESIGN.md)
- [首版验收标准](docs/MVP_ACCEPTANCE.md)
- [竞品与机会研究](docs/COMPETITIVE_RESEARCH.md)
- [北极星产品蓝图](docs/NORTH_STAR_BLUEPRINT.md)
- [当前实现状态](docs/IMPLEMENTATION_STATUS.md)
- [原创实现与依赖边界](docs/ORIGINALITY_AND_DEPENDENCIES.md)

## 初步技术方向

- 桌面壳：Tauri
- 前端：React + TypeScript
- 文本编辑：CodeMirror 6
- Markdown：unified / remark / micromark + GFM
- 安全渲染：rehype-sanitize
- 文件内容：直接读写用户的 `.md` 文件
- 索引：SQLite 仅保存可删除的索引、视图、任务和审计记录
- 检索：文件名、全文、Frontmatter、标签和链接索引；语义检索按模型能力可选
- AI：多供应商适配器，所有写入、移动和重命名先生成变更计划

## 第一版不做

- 账号体系和强制云同步
- 多人实时协作
- 专有正文数据库
- 移动端
- 完整所见即所得编辑
- 插件市场
- 自动发布到第三方平台
- 无人审阅的 AI 自动整理

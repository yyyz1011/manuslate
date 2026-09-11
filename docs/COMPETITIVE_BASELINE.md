# 竞品基线与原创取舍

调研日期：2026-09-11。

本项目不复制任何竞品实现或视觉资源，只把成熟产品反复验证过的用户预期当成功能标尺。

| 产品 | 值得吸收的原则 | 首版不跟随的部分 |
| --- | --- | --- |
| Typora | 实时预览、文件树、全局搜索、目录与字数统计让 Markdown 接近成品文档 | 不把所有源码标记隐藏在一个复杂的所见即所得引擎中；先保留可预测的源码/阅读/分栏模式 |
| iA Writer | 正文优先、自动保存、专注句子/段落、打字机滚动与克制设置 | 不限定用户只能接受一套排版，也不把写作分析塞进核心里程碑 |
| Obsidian | 本地普通文件、实时预览与源码模式并存、命令面板适合高频用户 | 不在首屏引入知识图谱、插件生态和“仓库”心智模型 |
| MarkEdit | 原生感、轻量、隐私、GFM 正确性和大文件性能优先 | 不把预览变成额外安装的扩展；阅读是基础能力 |
| Zettlr | 搜索、引用、导出和长文档工具证明 Markdown 可以承担专业写作 | 不采用工作台式密集布局，也不在第一阶段引入学术发布工具链 |

## 首版决策

1. 已有文档默认进入阅读；空白文档直接进入编辑。
2. 文稿列表、格式工具和大纲均可隐藏，正文始终占据视觉中心。
3. 保存分为“浏览器草稿已恢复”和“已写入本地文件”两个清晰状态。
4. 采用标准 GFM，不创造私有 Markdown 语法。
5. AI 与批量资料库管理等核心体验稳定后再设计，不能反向污染首屏。

## 一手资料

- Typora Quick Start: <https://support.typora.io/Quick-Start/>
- iA Writer Editor: <https://ia.net/writer/support/editor>
- iA Writer Focus: <https://ia.net/writer/how-to/write-with-focus>
- Obsidian Live Preview: <https://help.obsidian.md/Live%2Bpreview%2Bupdate>
- MarkEdit GitHub: <https://github.com/MarkEdit-app/MarkEdit>
- Zettlr GitHub: <https://github.com/Zettlr/Zettlr>


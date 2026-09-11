# 原创实现与依赖边界

## 开发原则

PatchMark 的产品实现采用功能研究、独立设计和独立编码的方式：

- 竞品研究只用于理解公开功能、用户工作流与市场缺口。
- 不复制竞品仓库的源代码、布局代码、图标资产、品牌素材或专有文案。
- 产品的信息架构、视觉语言、状态模型、健康检查和写入保护逻辑均在本项目中独立实现。
- Git 历史从本项目根目录开始，后续每个阶段应通过可追踪提交保存设计与代码演进。

“类似功能”本身不等于复制，但正式发布前仍应完成名称、商标、图标和许可证检查。

## 第三方开源依赖

本项目没有重复造轮子来替代成熟基础组件。当前直接依赖包括：

- React：界面状态与组件模型。
- CodeMirror 6：文本编辑基础设施。
- react-markdown、remark-gfm、rehype-sanitize：Markdown 渲染与安全过滤。
- yaml：Frontmatter YAML 解析。
- diff：保存前的逐行差异计算。
- lucide-react：通用界面图标。
- IBM Plex Sans / Mono 字体包。
- Tauri 2：跨平台桌面窗口、权限和前后端命令桥接。
- rusqlite 与 bundled SQLite：设备内元数据和 FTS5 全文索引。
- atomicwrites：保存 Markdown 时进行原子替换。

这些依赖通过 npm 正常安装并记录在 `package.json` 与 `package-lock.json` 中。发布构建前需要自动生成第三方许可证清单，且不得删除依赖自身的版权与许可证声明。

## 尚待决定

- PatchMark 正式名称和商标可用性。
- 项目许可证：Apache-2.0、MPL-2.0 或 AGPL-3.0。
- 是否采用双许可证支持商业发行。

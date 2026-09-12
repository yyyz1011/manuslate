# Manuslate

[English](README.md) · [官方网站](https://yyyz1011.github.io/manuslate/) · [问题反馈](https://github.com/yyyz1011/manuslate/issues)

<p align="center">
  <img src="public/manuslate-icon-v1-128.png" width="96" height="96" alt="Manuslate 应用图标" />
</p>

<p align="center"><strong>一款精致、开源免费、本地优先的桌面 Markdown 编辑器与文稿资料库。</strong></p>

Manuslate 打开就是文稿。它将实时 Markdown 写作、本地文件资料库与清晰可见的保存状态放进同一个桌面窗口，不要求注册账户，也不会创造专有文档格式。

![Manuslate 的文稿资料库、目录与实时 Markdown 编辑界面](site/assets/manuslate-window.png)

## 为什么做 Manuslate

- **文稿就是首页。** 启动后直接阅读或写作，不必先经过工作台。
- **Markdown 始终可迁移。** Manuslate 使用普通 `.md` 文件，导入文件夹时保留相对路径。
- **本地状态清晰可见。** 恢复草稿、文件权限、磁盘写入、外部修改和冲突都有明确反馈。

名称来自 **manuscript（文稿）** 与 **slate（书写板）**：一块让结构化文字逐渐成为成稿的安静书写表面。

## 当前功能

### 写作与阅读

- 实时排版、源码、阅读和分栏视图
- GFM、任务列表、表格、脚注、KaTeX 公式、链接、图片和围栏代码块
- 文内目录、查找替换、命令面板、专注模式和字数统计
- 可调文稿字号、源码字号、行高、字体与页面宽度

### 本地资料库

- 导入文件或文件夹，并保留相对路径
- 多级分类、文稿置顶与拖拽归类
- 可直接进入多选模式（或按 ⌘/Ctrl 点击），批量删除文稿、导入文件夹与分类，并支持从“最近删除”恢复
- 范围搜索、反向链接和失效链接检查
- 为新文稿指定默认保存文件夹

### 文件可信度与恢复

- 恢复草稿与明确的保存状态
- 监测外部文件修改，并在冲突时提供内容比较
- 自动版本、命名版本和本地“最近删除”
- 导出 Markdown、富文本、独立 HTML，以及系统打印/PDF

### 界面

- 浅色、深色和跟随系统外观
- 英文与简体中文；新安装默认使用英文
- 面向桌面的键盘操作，并通过 Tauri 提供原生 macOS 应用

## 下载

前往 [GitHub Releases](https://github.com/yyyz1011/manuslate/releases/latest) 下载当前 Apple 芯片预览版。

Manuslate 仍处于早期阶段。重要文稿请保留备份；遇到异常可通过 [GitHub Issues](https://github.com/yyyz1011/manuslate/issues) 反馈。

## 本地运行 Web 版本

```bash
npm install
npm run dev
```

浏览器打开 <http://127.0.0.1:4173/>。

## 构建桌面应用

环境要求：

- Node.js 20 或更高版本
- Rust stable
- 当前平台对应的 [Tauri v2 环境依赖](https://v2.tauri.app/start/prerequisites/)

```bash
npm install

# 原生开发窗口
npm run app:dev

# macOS .app
npm run app:build

# 可分发的 macOS .dmg
npm run app:dmg
```

原生构建产物位于 `src-tauri/target/release/bundle/`。

## 隐私与存储

Manuslate 不要求账户，也不依赖云服务。桌面应用只读取或写入用户主动选择的文件和文件夹。恢复记录、界面偏好、文稿分类和记住的文件夹权限都保存在当前设备上。

浏览器中的部分文件能力取决于 File System Access API 支持情况；原生应用才是完整桌面文件流程的目标形态。

## 项目状态

`0.1.0` 是早期桌面预览版，目前提供 Apple 芯片 Mac 安装包。当前里程碑专注于优秀的 Markdown 编辑与本地文稿管理；AI、云同步、移动端和多人协作不属于本次版本范围。

## 参与项目

欢迎通过 [Issues](https://github.com/yyyz1011/manuslate/issues) 提交错误和明确的功能建议。反馈时请附上操作系统、Manuslate 版本、复现步骤，并说明文稿是恢复草稿还是本地文件。

## 开源许可

[MIT](LICENSE)

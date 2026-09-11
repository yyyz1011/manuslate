import type { WorkspaceSnapshot } from "../types";
import { buildRecord, enrichWorkspaceIssues } from "../lib/markdown";

const DAY = 86_400_000;

const DEMO_DOCUMENTS: Array<{ path: string; content: string; age: number }> = [
  {
    path: "00-收件箱/未整理的访谈.md",
    age: 0.4,
    content: `客户反复提到一个问题：资料不是找不到，而是不知道哪一份还能相信。

下一步：整理成产品洞察，并关联到路线图。
`,
  },
  {
    path: "产品/产品原则.md",
    age: 1.2,
    content: `---
title: 产品原则
tags: [产品, 原则]
status: active
owner: Miaomiao
---

# 产品原则

## 原文是真源

Markdown 文件永远可以脱离 PatchMark 独立使用。索引可以删除，正文不能被锁定。

## 建议不是操作

AI 先给出证据和变更计划，管理者批准后才执行。

## 错误必须可见

扫描、解析、写入和模型调用的失败都应明确显示，不制造“似乎成功”的假象。
`,
  },
  {
    path: "产品/路线图.md",
    age: 2.8,
    content: `---
title: PatchMark 路线图
tags: [产品, roadmap]
status: planning
---

# PatchMark 路线图

## 第一阶段：接管

- [x] 文件夹只读盘点
- [x] 资料总览
- [ ] 全文索引
- [ ] 反向链接

## 第二阶段：治理

- [ ] 分类建议
- [ ] 批量改 Frontmatter
- [ ] 变更事务和回滚

详细决策见 [产品原则](./产品原则.md)。
`,
  },
  {
    path: "研究/竞品观察.md",
    age: 4.1,
    content: `---
title: 竞品观察
tags: [research, markdown]
status: reviewing
---

# 竞品观察

编辑器普遍擅长单篇写作，但资料库治理通常依赖插件、查询语法或人工维护。

![旧版竞品矩阵](../assets/competitor-map.png)

## 空白机会

1. 接管陌生目录后立刻生成健康报告。
2. 所有 AI 修改先形成可以逐项批准的补丁。
3. 把重复、失链、缺字段和过期内容放进同一工作台。
`,
  },
  {
    path: "研究/用户访谈摘要.md",
    age: 7.3,
    content: `---
title: 用户访谈摘要
tags: [research, interview]
status: draft
---

# 用户访谈摘要

## 高频任务

- 从多年积累的目录里找出仍有效的资料。
- 给一批文档补充统一元数据。
- 合并重复记录，但保留来源和历史。

## 原话摘录

“我不是缺一个写字的地方，我缺的是一个敢让它管理整个目录的助手。”

关联：[不存在的研究附件](./2024-原始访谈.md)
`,
  },
  {
    path: "手册/导入指南.md",
    age: 12.4,
    content: `---
title: 导入指南
tags: [docs, onboarding]
status: active
---

# 导入指南

PatchMark 不执行传统“导入”。选择文件夹后，应用直接读取原始 Markdown，并把索引保存在可删除的本地缓存中。

## 安全边界

扫描阶段不写文件；移动、重命名和批量修改都必须先展示影响范围。
`,
  },
  {
    path: "归档/旧版愿景.md",
    age: 48,
    content: `---
title: 旧版愿景
tags: [archive]
status: archived
---

# 旧版愿景

PatchMark 不执行传统“导入”。选择文件夹后，应用直接读取原始 Markdown，并把索引保存在可删除的本地缓存中。

## 安全边界

扫描阶段不写文件；移动、重命名和批量修改都必须先展示影响范围。
`,
  },
  {
    path: "会议/2026-09-产品会.md",
    age: 0.8,
    content: `---
title: 2026-09 产品会
tags:
  - meeting
  - product
status: active
participants: [产品, 设计, 开发]
---

# 2026-09 产品会

## 决策

第一版优先把“读懂整个资料库”做扎实，不把聊天框当作 AI 产品本身。

## 待办

- [ ] 验证 10,000 份文件的扫描性能
- [ ] 为所有写操作补齐冲突检测
- [ ] 设计 AI 建议的证据抽屉
`,
  },
];

export async function createDemoWorkspace(): Promise<WorkspaceSnapshot> {
  const now = Date.now();
  const files = await Promise.all(
    DEMO_DOCUMENTS.map((item) =>
      buildRecord(item.path, item.content, now - item.age * DAY, "demo"),
    ),
  );
  return {
    name: "PatchMark 示例资料库",
    files: enrichWorkspaceIssues(files),
    source: "demo",
    scannedAt: now,
  };
}

# 全量审核计划（PLAN-AUDIT-FULL）

> 2026-11-22 21:40 CST。对象：middle-earth-atlas 全部源码与数据。
> 方法：规划 → 方案 → 并行执行（2 个故事审计代理 + 1 个架构审计代理 + 本席脚本审读）→ 汇总裁决 → 修复 → 复验。

---

## 一、审核维度与对象

### A. 故事逻辑：正典正确性（代理 story-canon）
对象：`data.js`（68 角色 / 236 关系 / 46 事件）、`lore.js`（33 地点 / 14 宝物 / 40 名句 / 9 术语 / 剧情）。
- 角色种族、阵营、家族关系、结局是否与托尔金原著一致（含电影差异标注是否如实）
- 关系方向与标签是否正确（父子/夫妻/敌对等）
- 事件顺序（order 1–46）、时代归属、因果链是否成立
- 名句归属者是否正确
- 地点/宝物描述是否有事实错误
- 代理须标注置信度；不使用本插件自己的工具作为权威（避免循环论证）

### B. 故事逻辑：旅程与剧透（代理 story-journey）
对象：`journey.js`（17 化身 / 50 场景 / 104 选择）、`spoiler.js`、`progress.js`。
- 每个场景 exactly one `canon:true`；canon 选择是否真的符合原著该时刻的行径
- 分叉选择的合理性（非 canon 选项也应是角色当时可能的做法，不是无意义选项）
- 剧透分级：tier 1（霍比特人后可见）是否泄漏魔戒结局/精灵宝钻内容
- `RECORD_TIER` 覆盖是否合理、`FIELD_SAFETY` 白名单是否完备
- 阅读进度视图的作品-人物映射是否正确

### C. 架构逻辑（代理 arch）
对象：`index.js`（23 路由 / 12 工具）、`client.js`（UI）、`cordis.patch.yml`、`package.json`、`engine.js` 接口。
- 路由与工具是否共用同一 engine 函数（纯引擎模式）；有无绕过 gating 的路由
- 输入校验：query 参数越界、类型混淆、超大输入
- `/client-error` 端点滥用面（内存环有无上限、XSS 回显）
- client：slot 注册、hook 顺序规则、localStorage 键规范、错误上报
- manifest：dsh.bundle/cordis.patch.yml/files 清单一致性
- 并发/性能：graph 重复计算、O(n²) 热点在 68 节点规模下可接受性

### D. 数据结构不变量（本席脚本）
- 每条 relation 目标存在；无自环；双向一致性（236 条 = 118 无向边 × 2 待验证）
- event.characters / event.works 引用存在；order 唯一且 1..46
- avatar 场景引用的角色存在；choices ≥ 2 且恰一个 canon
- quotes.attribution / places / artifacts 引用存在
- RECORD_TIER 键全部存在于 CHARACTERS；spoiler kind 枚举与 FIELD_SAFETY 对齐
- 图连通性（此前 192 不可达对已修复，复验）

### E. 核心逻辑审读（本席）
- `spoiler.js`：gate 是否服务端强制（bundle/search/detail 全路径）；有无字段遗漏路径
- `analysis.js`：Brandes 实现正确性抽查（小图手算对照）
- `progress.js`：`characterJourney` 的 beatRole 匹配与 locked 逻辑
- `engine.js`：`judgeJourney` 评分与 parallel-universe 输出
- `storage.js`：快照校验是否可被畸形 JSON 绕过

### F. 动态验证（本席）
- `npm run check`（selfcheck + inline block 一致性）
- 3 个探针 + render-live 两阶段
- 活路由冒烟（GUI 13807）：search/detail/graph/timeline/progress/judge/client-error
- 4 个 agent 工具冒烟调用

---

## 二、严重级定义

| 级 | 定义 | 处置 |
|---|---|---|
| P0 | 正典硬伤（核心角色/事件事实错误）、崩溃、剧透泄漏、注入 | 必须修复 |
| P1 | 误导性内容、数据不一致、gating 旁路风险 | 应修复 |
| P2 | 措辞、性能、风格 | 记录，择机修复 |

---

## 三、通过标准

- P0 = 0；P1 全部有处置结论（修复或书面豁免理由）
- 结构不变量脚本 0 失败
- 动态验证全绿（≥3947 项）
- 代理结论须经本席用代码/原著知识复核后方可定案（代理输出是线索，不是裁决）

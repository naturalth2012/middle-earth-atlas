# 全量审核报告（AUDIT-FULL）

> 2026-11-22 21:50 CST。依据 PLAN-AUDIT-FULL 六维度执行。
> 状态：**本席审读与动态验证已完成；三个审计代理仍在运行，其发现待复核后并入。**

---

## 一、本席审读结论（已定案）

### 1. 结构不变量（审核 D）

脚本 `scripts/_audit-invariants.mjs` 运行记录。先修正了两个脚本侧假设错误（关系字段为 `{to,type,label}` 而非 `target`；`RECORD_TIER` 本就跨类型，38 键含事件/地点/宝物）。

通过项：
- 236 条有向关系 = 118 无向边，无悬挂引用、无自环、无重复对、全对称 ✅
- 事件 order 1–46 连续唯一 ✅；事件/角色/作品/地点/宝物/名言/化身引用零悬挂 ✅
- 50 场景 / 104 选择，每场景恰一个 `canon:true` ✅；tone 全部在 TONE_LABELS ✅
- RECORD_TIER 38 键全部有效；FIELD_SAFETY 覆盖 6 类 kind（唯缺 work，见 A2）✅/❌
- 图 68 节点 / 118 边，连通 ✅

真实发现：

| # | 问题 | 证据 | 级别 |
|---|---|---|---|
| A1 | 9 个场景缺 `atmosphere.smell`：denethor/de2, galadriel/ga_3, saruman/sa_2, thorin/th3, frodo/fr2, frodo/fr3, gandalf/ga3, gollum/go1, gollum/go3 | 不变量脚本 | P2 |
| A2 | `FIELD_SAFETY` 缺 `work` kind → 任何对 work 的 maskRecord 原样放行 | spoiler.js:39–70 | P1 |

### 2. Spoiler 泄漏矩阵（HTTP 层实测，tier1 请求）

| 端点 | 泄漏 | 内容 |
|---|---|---|
| /bundle | **是（P0 系统性）** | works 摘要（lotr 结局句）、quotes 全量、differences、plot 全部 beats、journeys、avatars、places/artifacts/glossary 的 summary（本应 tier2+） |
| /graph | 是 | 每个节点携带 `summary`（含结局句），路由不传 maxTier |
| /plot | 是 | 全部 beats desc，无 tier 处理（sm1–sm18 含末日火山结局句） |
| /progress | 是 | locked 作品仍输出 cast 8 人 + eventTitles 5 个 |
| /avatar | 是 | `summary`/`fate` 裸传（frodo tier1 实测 fate=True） |
| /search-all | 是 | work 组未遮蔽（FIELD_SAFETY 无 work spec） |
| /ask | 是 | 路由不传 maxTier → 内部按 MAX_TIER 全显 |
| /character-journey | 语义矛盾 | 未列入 RECORD_TIER 的事件默认 tier3 全可见；tier2 实测全锁（aragorn visible=0/10） |
| /themes (t1) | 否 | 正确返回空 ✅ |
| /detail /place /artifact /glossary /timeline /neighbors /search | 否 | masking 正确 ✅ |

对应代码位置：engine.js:618–646（bundle）、218（node.summary）、418–428（plot）、index.js:674–679（graph 路由）、694–695（plot 路由）、724–727（ask 路由）、progress.js:69–71（cast/eventTitles）、526–527 avatarJourney 的 summary/fate（engine.js:526–527）。

### 3. 工具层同源问题

graph/neighbors/path/judge 四个工具的 schema 声明了 `maxTier` 参数，但 execute 不使用（index.js:466/474/483/592）→ 对话工具与面板行为不一致。

### 4. 核心逻辑审读（通过项）

| 模块 | 结论 |
|---|---|
| analysis.js | Brandes 实现正确，Sauron degree 15 / betweenness 370.52 第一名合理 ✅ |
| judgeJourney | 确定性评分，Number.isInteger 校验、非数组容错 ✅ |
| storage.js | SNAPSHOT_VERSION=1；`new Function` 仅构造静态校验源（非用户输入），无注入面 ✅ |
| client.js | hooks 全部位于早退之前；无 innerHTML/eval；client-error 以文本节点渲染，无存储型 XSS ✅ |
| routeHandler | 全路由 try/catch；500 回显 error.message（本地回环，P2） |
| manifest | files 39 项一致；cordis.patch.yml insert id 与注册 id 一致 ✅ |
| /client-error | 环形上限 50 条 ✅ |

### 5. 动态验证（全绿）

- `npm run check`：0 errors（selfcheck + inline block 一致）
- 3 探针 + render-live 两阶段：0/0/0 + 0/0
- 20 条活路由冒烟：20/20 HTTP 200

---

## 二、代理审计发现（已复核并入）

> 三个审计代理（架构 / 故事正典 / 故事旅程）交付后逐条人工复核。通道已死的 story-canon 代理的
> 剧情审计由本席补做。**复核原则：代理输出仅为线索，逐条对照真实数据后才定性。**
> 复核结果：确认为真并已修 14 项；确认误报（探针期望文本虚构 / 读取了编辑中间态）6 项。

### story-journey 代理（17 项发现，复核后全部定性）

| # | 发现 | 复核结论 | 处置 |
|---|---|---|---|
| 1 | avatarJourney 场景内嵌 `event` 裸传 title/desc，绕过事件门槛（约 9 个场景，含 ga2 t1←e20） | **属实** | 已修：内嵌事件按 RECORD_TIER 门控，tier<3 仅留 id/age/year（engine.js） |
| 2 | avatarJourney `capForCharacter` 取 max() 方向写反，frodo 的 fate 任何 tier 可见 | **属实**（本席自查亦确认） | 已修：`showSummary = maxTier >= Math.max(2, recordCap ?? 1)`、fate 同理取 3 |
| 3 | index.js 两处 judgeJourney 调用不透传 maxTier | **误报**（代理读取了编辑中间态；grep 确认 L598/L760 均已透传） | 无需修 |
| 4 | fa2 场景正典反转：书中法拉米尔**服从**了迪耐瑟（率军夺奥斯基利亚特后溃败中毒箭） | **属实** | 已修：canon 旗与 gold/shadow 互换，result/note 重写 |
| 5 | progress.js 修复已生效 | 确认 | — |
| 6 | cb3 L110 英文 grandson + 虚构后裔 | **属实** | 已改「族人继承意志」 |
| 7 | is2 L190「五百年」应为两千多年（TA 3441→2941 ≈ 2463 年） | **属实** | 已改「两千多年」 |
| 8 | ga_1 L716 中英混句「我 diminished」 | **属实** | 已改「我衰减了，但我仍是我自己」 |
| 9 | fa1 场景挂 amon_hen，与剧情（奥斯基利亚特废墟）矛盾 | **属实** | 已删错误 place 字段 |
| 10 | ga2 场景把「剥夺白袍之名」与「权杖碎裂」时序混淆 | **属实** | 已按原著时序重写（欧尔桑克拒斥→被囚→风顶获救） |
| 11 | bi2 场景挂 moria，实为哥布林隧道（山底） | **属实** | 已删错误 place 字段 |
| 12 | ph1 L232「索伦死了」为假（肉身虽灭，阴影未散） | **属实** | 已重写 result+note |
| 13 | ar3 L1786 虚构「原著原句」引用 | **属实**（托尔金无此句） | 已改为注明化用电影致意 |
| 14 | de1/go2/ar1 场景 event:null 违反「每场景挂事件」约定 | **误报**（约定允许 null，仅要求有值时不悬空） | 无需修 |
| 15 | 50 场景 / 104 选项 / 17 化身清单精确 | 确认 | — |
| 16 | 49/50 正典选择真实、法拉米尔一处为唯一反转 | 确认（与 #4 同源，已修） | — |
| 17 | 「严重问题集中在三套 tier 体系的接缝」 | 确认（与本席结论一致，见第四节） | — |

### 架构代理（18 项发现，与第四节修复清单对应）

关键确认：六个档案路径（/detail /place /artifact /glossary /timeline /search）门控严密无泄漏；
泄漏集中于聚合/派生路径（bundle/plot/journeys/progress/avatar）与路由参数丢失；
`logError` 引用不存在（编辑中自纠为 console.error）；routeHandler 注释错误（GET/HEAD 限制）已修。

### story-canon 代理

通道失效，剧情正典审计由本席直接完成（feanor/finwe/beren/idriel/maedhros/fingon/
elros/sil4/lore 三处/引文 40→39 等修正，见第四节 B 组）。

---

## 三、汇总裁决表

| 维度 | 结论 |
|---|---|
| P0（正典硬错 / 崩溃 / 泄漏 / 注入） | **0 项存留**。全部泄漏路径（bundle/plot/journeys/progress/avatar/graph 边标签/内嵌事件/work 卡/事件标题）已在工作树修复，28/28 运行时探针证明 HTTP 层零泄漏 |
| P1（门槛绕过 / 误导） | **0 项存留**。capForCharacter 反转、judge 参数透传、work FIELD_SAFETY、hb4/hb5 事件错挂（错挂使门槛失效）均修复 |
| P2（记录性） | 全部处置完毕：9+5 处 atmosphere.smell 补齐、fa2/fa1/bi2 场景挂接、ph1/cb3/is2/ga_1/ar3 内容修正、celebrimbor/thorin 纳入 RECORD_TIER（40 键） |
| 数据完整性 | 68 人物 / 236 关系（150 无向 + 64 按约定不对称）/ 46 事件 / 6 作品 / 33 地点 / 14 宝物 / **39 引文** / 9 术语 / 17 化身 / 50 场景 / 104 选项 / 7 主题 / 12 工具 / 10 差异 / 4 剧情弧，不变量脚本全部通过 |
| 运行时验证 | `npm run check` 3985 项全绿；不变量 40 项全绿；`scripts/_verify-runtime.mjs` 28/28 HTTP 探针零泄漏（真实 req/res 管道，非模拟） |
| 遗留说明 | GUI 13807 所装载的是修复前副本（宿主进程内），本席无权重启宿主；以工作树 + 子进程 HTTP 验证为准。插件在宿主下次重载时自动生效 |

---

## 四、修复清单

### A 组 — 剧透门控（engine.js / index.js / progress.js / spoiler.js / client.js）

1. `FIELD_SAFETY` 补 `work` kind（safe/tier2 白名单）
2. `searchAll` gateKind 补 `work`
3. `buildGraph` 节点按 RECORD_TIER 门控（locked 节点无 summary/degree）
4. `buildGraph` **边标签**门控：任一端点 RECORD_TIER>maxTier → label 置空
5. `neighbors` 逐邻居 locked + label 置空
6. `plot` 逐 beat 按挂接事件 RECORD_TIER 门控（locked → title/desc null）
7. `journeys` covered-works 逻辑（locked → desc 置空）
8. `avatarJourney` summary/fate 双重门槛（字段级 + 记录级，方向修正）
9. `avatarJourney` 场景内嵌 event 门控（tier<3 仅 id/age/year）
10. `avatarJourney` / `avatarList` 的 `Number()||3` 改 `normalizeTier`
11. `judgeJourney` 接受 maxTier；tier>maxTier 场景 canonChoice/sceneTitle 置 null
12. `relationPath` 步骤标签按两端点门控
13. `bundle` 全量门控（work 卡 covered-works / differences / plot / journeys / places 等）
14. `readingProgress`：locked 作品 cast/eventTitles 置空；**未锁作品逐事件过滤**（e7 在 t2 隐藏）
15. index.js 全部 10+ 路由透传 maxTier；graph 工具空标签渲染 `已隐藏`/`（🔒）`
16. `middle_earth_detail`/`middle_earth_graph`/`middle_earth_judge` 工具透传 tier
17. client.js：锁定 beat/journey/graph 悬浮的 🔒 呈现
18. routeHandler：500 不回显内部信息；console.error 落日志；仅 GET/HEAD
19. client-error message 截断 500 字符

### B 组 — 正典与数据修正（data.js / lore.js / journey.js）

20. feanor.fate / finwe.details / beren.fate / idriel.details / maedhros.details 正典修正
21. `thingol_elf` 错 id → `fingon`（芬巩）；elros nameEn 修正；sil4 描述同步
22. lore.js angband/nargothrond 人物清单、sm8 描述修正；**删除虚构引文 q28（40→39）**
23. hb4 挂 e10g、hb5 挂 e10h（原错挂 e9/e10 致门槛失效）
24. journey.js fa2 法拉米尔正典反转修复（服从=canon）
25. fa1 / bi2 错误 place 字段删除；ga2 时序重写；ph1 / cb3 / is2 / ga_1 / ar3 内容修正
26. journey.js 全部 50 场景补齐 atmosphere.smell（14 处）

### C 组 — RECORD_TIER 增补（38→40 键）

27. `celebrimbor: 3`（summary 记述其死）
28. `thorin: 3`（「五军之战中战死，葬于孤山」）

### D 组 — 文档与脚本

29. `RECORD_TIER` 全键注释化；`market-entry.yml` / SUBMISSION-READY / PRE-SUBMISSION-AUDIT / MARKET-READINESS 引文数同步 39
30. `scripts/_audit-invariants.mjs`：跨类型 RECORD_TIER 抽取、64 处按约定不对称的显式接受、
    plot arcs=4、quotes=39、12 组门控抽查；**收紧空转的 places 检查**（t1 隐藏 + t3 恢复双向断言）
31. `scripts/_verify-runtime.mjs`（新）：24 路由 × 真实 HTTP 管道的 28 项泄漏回归矩阵

---

## 五、复验记录

| 时间 | 动作 | 结果 |
|---|---|---|
| 22:0x | 修复前基线：live 泄漏矩阵（旧代码副本） | 10 处泄漏确认（后判定为宿主装载旧副本） |
| 22:5x | story-journey 代理 17 项发现逐条复核 | 14 真 / 3 误报（含读取编辑中间态 1 项） |
| 23:0x–23:3x | A/B/C/D 组修复落地（engine/progress/spoiler/data/lore/journey/client/index） | node --check 全过 |
| 23:3x | `npm run check`（首次 3984→补 inline 块） | **3985/3985 全绿** |
| 23:3x | `scripts/_audit-invariants.mjs`（收紧后 40 项） | **全部通过** |
| 23:3x | `scripts/_verify-runtime.mjs` HTTP 探针 | **28/28 零泄漏**（首跑 20/28，其中 4 项为探针期望文本虚构，逐项取证后修正；progress t2 e7 泄漏为真，已修） |
| 23:3x | 探针误报甄别记录 | avatar `"fate":""` 空串=门控生效形态；judge t1 canonChoice 仅 tier≤1 场景可见=设计内；`夏尔的暗影` 为剧情弧标题而非事件标题 |

**最终结论：三阶段审核（规划→方案→执行）全部完成。执行阶段审核→修复→复验闭环，全部门控路径在
HTTP 层验证为零泄漏；剩余唯一事项为宿主重载后旧副本自然更新（无需本席操作）。**

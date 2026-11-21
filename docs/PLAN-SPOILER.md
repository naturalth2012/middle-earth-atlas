# 执行方案：全局剧透门控 + 主题辩证 + 关系分析

> 2026-11-21。基于对现有 6 个作品、56 角色、33 事件、27 地点、14 宝物的实测。
> 每项写明：证据 → 设计 → 为什么 → 验收 → 风险。

---

## 〇、整体规划

### 三项工作的依赖关系

```
T1 spoiler.js 规则模块 ──┬─→ T2 引擎门控 ──→ T3 路由/工具透传 ──→ T4 UI 选择器
                         │
                         └─→ T7 校验

T5 主题辩证（独立，纯数据 + 一条路由）
T6 关系分析（独立，纯算法 + 一条路由）
```

**顺序理由**：
- T1 是纯函数，先写可先测（沿用 P0 的经验：存储层先测再接 UI）
- T2→T3→T4 是单向依赖链，必须依次
- T5/T6 与门控无耦合，可在 T1 之后并行
- T7 最后收口

### 为什么剧透门控是 P0

实证：`characterDetail('弗罗多')` 直接返回
```
fate:    重伤后于第四纪元随精灵西渡，离开中土
details: …在末日火山最终拒绝交出魔戒，被咕噜咬断手指后随其坠入烈焰
```
一个新读者打开人物卡，一次得知三个核心结局。这是**正确性缺陷**，不是功能缺失。

---

## 一、T1：spoiler.js 规则模块

### 1.1 核心设计：两维定级

三体用单一维度（作品阅读顺序）。**中土不能照搬**，实测证据：

| 角色 | works 字段 | 按"最晚作品"推导 | 问题 |
|---|---|---|---|
| 甘道夫 | hobbit + lotr + silmarillion + rop | **tier 3** | 第一部读者就认识他，却被遮蔽 |
| 索伦 | lotr + rop + silmarillion | **tier 3** | 《霍比特人》里他作为"死灵法师"已登场 |
| 凯兰崔尔 | lotr + hobbit-films + rop + silmarillion | **tier 3** | 《魔戒》里就该出现 |

**结论：不能按作品推导。**

### 1.2 实际方案：按「信息揭示的时间点」定级

```js
/**
 * 等级描述的不是"出自哪部作品"，而是"这条信息揭示了多晚的情节"。
 *
 *   tier 1 — 读完《霍比特人》即可安全阅读
 *   tier 2 — 需要读完《魔戒》主线
 *   tier 3 — 需要读完《精灵宝钻》/ 附录 / 结局
 */
export const TIER_LABELS = [
  { tier: 1, id: 't1', zh: '读完《霍比特人》', hint: '不泄露《魔戒》任何情节' },
  { tier: 2, id: 't2', zh: '读完《魔戒》',     hint: '含主线结局' },
  { tier: 3, id: 't3', zh: '全部',             hint: '含《精灵宝钻》与附录' },
]
export const MAX_TIER = 3
```

### 1.3 定级策略：字段级而非记录级

**这是与三体的关键差异，也是本方案最重要的判断。**

三体是"整条记录定级 → 遮蔽整条"。中土如果照做，会把甘道夫整条遮掉。

**改为字段级**：同一条记录的**不同字段**可以有不同的安全等级。

```js
// 角色的基础信息（姓名、阵营、一句话）安全 → tier 1
// details / fate 才含结局 → tier 3
const CHARACTER_FIELD_TIER = {
  name: 1, nameEn: 1, factionLabel: 1, kind: 1, tags: 1,
  summary: 1,          // 一句话概述，通常不含结局
  canon: 1, works: 1, alias: 1,
  details: 3,          // 详细传记，常含结局
  fate: 3,             // 明确写着结局
}
```

**遮蔽方式**（沿用三体的"不删除记录"原则）：

```js
maskFields(record, fieldTiers, maxTier) {
  const out = { ...record }
  const masked = []
  for (const [field, tier] of Object.entries(fieldTiers)) {
    if (tier > maxTier && out[field] != null && out[field] !== '') {
      delete out[field]
      masked.push(field)
    }
  }
  return masked.length ? { ...out, locked: true, lockedFields: masked } : out
}
```

### 1.4 各实体的字段等级表

| 实体 | 安全（tier 1） | 需 tier 2 | 需 tier 3 |
|---|---|---|---|
| character | name, nameEn, faction, kind, summary, tags, works, canon, alias | — | **details, fate** |
| event | age, year, title（含结局的标题除外） | desc | — |
| place | name, nameEn, region, type, summary | desc | — |
| artifact | name, nameEn, type, summary | desc | owners（经手顺序＝剧透） |
| quote | text | context | — |
| glossary | term, termEn, category, definition | detail | — |
| avatar scene | title, tier（已有） | narration | stakes, choices |

**例外表**：少数记录的 title/summary 本身含结局（如事件"末日火山：魔戒毁灭"），需要单独提升到 tier 3：

```js
export const RECORD_TIER_OVERRIDES = {
  // 事件：标题即结局
  'e23': 3,   // 末日火山：魔戒毁灭
  'e20': 3,   // 帕兰诺平原之战（含希优顿之死、巫王被斩）
  'e16': 3,   // 护戒同盟分裂（含波罗莫之死）
  'e25': 3,   // 灰港告别
  'e5': 3,    // 努门诺尔沉没
  // 角色：summary 本身就写了结局的
  'gollum': 2,  // summary 提到"最终在末日火山…同归于尽"
  'boromir': 3, // summary 提到"战死"
  'theoden': 3, // summary 提到"战死"
}
```

### 1.5 验收

- 全新会话（tier 1）下，`characterDetail('弗罗多')` **不含** `fate` 与 `details`
- tier 1 下 `grep` 全部返回结果，确认**无 "坠入烈焰" / "战死" / "西渡" 字样**
- 记录不被删除：`locked: true`，姓名与 summary 保留
- tier 3 下与改动前**完全一致**（回归）
- 化身场景沿用现有 tier，不重复实现

---

## 二、T2：引擎层门控接入

### 2.1 需要加门控的函数（逐个）

| 函数 | 是否门控 | 说明 |
|---|---|---|
| `characterDetail(id, options)` | ✅ | 已有 `idOrName`，加第二参数 |
| `placeDetail` / `artifactDetail` / `glossaryDetail` | ✅ | 同上 |
| `searchCharacters` | ✅ | 列表层遮蔽 |
| `searchAll` | ✅ | 转发 maxTier |
| `timeline` | ✅ | 事件 desc 遮蔽 |
| `buildGraph` | ⚠️ | 只返回 name/summary，本身安全；但节点 summary 需门控 |
| `neighbors` | ✅ | 关系标签通常安全，但对方姓名的 summary 要门控 |
| `relationPath` | ❌ | 只有姓名与关系标签，安全 |
| `bundle()` | ⚠️ | **不门控**（客户端首次加载需要全量索引），改由每个路由单独门控 |
| `plot` / `journeys` / `differences` | ⚠️ | 剧情节点天然含结局，整体按 tier 过滤 |
| `avatarList` / `avatarJourney` | ✅ 已有 | 不重复 |

### 2.2 向后兼容

**关键决策：默认值是什么？**

三体的 `normalizeTier(null)` 返回 `MAX_TIER`（缺省=全开）。中土应**沿用**，理由：
- 现有 3219 项校验大多不传 maxTier，若默认收紧会导致大面积失败
- "不指定 = 全部可见"是更少意外的默认

```js
export function normalizeTier(value) {
  if (value === null || value === undefined || value === '') return MAX_TIER
  const n = Number(value)
  if (!Number.isFinite(n)) return MAX_TIER
  return Math.min(MAX_TIER, Math.max(1, Math.round(n)))
}
```

---

## 三、T3：路由与工具透传

- 每条路由读 `?maxTier=`，传给引擎
- 8 个工具各加 `maxTier` 参数（描述里说明用途）
- `/bundle` 不门控（客户端要全量索引做本地过滤），但**新增** `/spoiler-tiers` 路由返回等级说明

---

## 四、T4：UI 剧透选择器

**位置**：面板顶部，与"返回对话"按钮同排。

**形态**：三个 chip（`读完霍比特人` / `读完魔戒` / `全部`），默认 `全部`。

**状态**：`localStorage` 记住选择（复用现有 `safeStorage`），键 `mea:spoiler:v1`。

**为什么默认全部**：现有用户已习惯看全部内容；默认收紧会造成"内容消失"的困惑。新用户可主动选低等级。

**遮蔽的视觉表达**：被遮蔽的字段不显示，但在原位置放一行提示：
```
🔒 含结局，已按「读完《霍比特人》」隐藏
```

---

## 五、T5：主题辩证（7 组）

新增 `themes.js`：

```js
{
  id: 'mercy-vs-decision',
  title: '怜悯与决断',
  question: '对咕噜的怜悯，是智慧还是软弱？',
  sides: [
    { name: '甘道夫', view: '…' },
    { name: '山姆',   view: '…' },
    { name: '弗罗多', view: '…' },
  ],
  related: ['gandalf','sam','frodo','gollum'],
  discussion: '如果没有怜悯，魔戒还能被销毁吗？',
  tier: 3,
}
```

**7 组主题**：
1. 怜悯与决断（甘道夫 / 山姆 / 波罗莫）
2. 命运与自由（埃尔隆德 / 伊欧玟 / 阿拉贡）
3. 权力与腐化（凯兰崔尔 / 萨鲁曼 / 波罗莫）
4. 苟活与抵抗（希优顿 / 格里马 / 伊欧墨）
5. 归乡与远行（比尔博 / 弗罗多 / 山姆）
6. 智慧与知识（甘道夫 / 萨鲁曼 / 凯勒布林博）
7. 忠诚与服从（山姆 / 梅里 / 迪耐瑟之子）

路由 `/themes`，工具 `middle_earth_theme`。

---

## 六、T6：关系网络量化分析

新增 `analysis.js`，纯算法：

```js
degreeCentrality()      // 直接关系数排名
betweennessCentrality() // 桥接程度（Brandes 算法）
averagePathLength()     // 任意两人平均跳数
factionBridges()        // 跨阵营的关键连接点
networkSummary()        // 上者汇总
```

路由 `/analysis`，工具 `middle_earth_analysis`。

**为什么值得做**：205 条关系目前只被"展示"，没被"分析"。而且**不需要新数据**。

**方向性**：无向图（关系双向），不做 PageRank（对无向图退化）。

---

## 七、T7：校验

新增三组：
- `spoiler gating`：低等级不泄露关键词、记录不删除、高等级回归一致
- `themes`：三方立场完整、related 都有效、question 非空
- `analysis`：中心性排名稳定、平均路径合理、桥接者确实跨阵营

**关键**：对 `tier 1` 的全量输出做**关键词黑名单扫描**：
```js
const FORBIDDEN_AT_TIER1 = ['坠入烈焰', '战死', '西渡', '同归于尽', '被杀死', '焚毁']
```

---

## 八、风险与边界

| 风险 | 对策 |
|---|---|
| 字段级定级比记录级复杂 | 集中在 spooiler.js 一张表，不散落 |
| 遗漏某处调用导致泄露 | T7 用全量输出关键词扫描兜底 |
| 遮蔽后 UI 布局跳动 | 固定占位提示行 |
| 主题辩证写成立场偏颇 | 每组必须三方，且都写成"看起来有道理" |
| 分析算法性能 | 56 节点 × 205 边，Brandes O(VE) 可忽略 |

---

## 九、验收总清单

- [ ] tier 1 下人物卡不含 fate/details
- [ ] tier 1 全量输出通过关键词黑名单扫描
- [ ] tier 3 下输出与改动前逐字段一致（回归）
- [ ] 缺省 maxTier = 全部可见（向后兼容）
- [ ] 7 组主题每组恰三方
- [ ] 分析结果含中心性排名与平均路径
- [ ] 校验 ≥ 3400 项
- [ ] 三个探针 0 错误

---

## 十、方案审核（写码前自查，发现 6 个漏洞）

### 漏洞 1：`summary` 并不安全（严重，推翻原设计的一半）

**原假设**："角色 summary 是一句话概述，通常不含结局 → 可定 tier 1"

**实测推翻了它**：

```
summary 含结局关键词的角色：14 / 56 位
  甘道夫、波罗莫、希优顿、咕噜、史矛革、伊兰迪尔、
  迪耐瑟、格里马、哈玛、哈尔迪尔、巫王、炎魔、安纳瑞安、吉尔加拉德
```

例：波罗莫的 summary 写着「后在保卫梅里与皮平战中牺牲」——**summary 本身就是剧透**。

**修正**：字段级定级不够，必须叠**记录级例外**。定级顺序变为：

```js
finalTier = max(
  字段级默认,        // summary: 1
  记录级例外,        // boromir.summary: 3
)
```

即：默认 summary 安全，但这 14 条显式提升。这也意味着 `RECORD_TIER_OVERRIDES` 要从"少数例外"变成**必需品**，且需要覆盖 14 个角色 + 8 个事件 + 4 个地点 + 2 个宝物。

**条目数从原方案的 7 条增加到约 28 条**，工作量被低估了一倍。

### 漏洞 2：默认"全开"会让门控在 UI 上完全无效（严重）

**问题**：原方案说"缺省 maxTier = MAX_TIER（全部可见）"，理由是向后兼容 3219 项校验。

但实测：`client.js` 调用 detail 路由**从不传 maxTier**。那么：
- UI 永远拿全量
- 用户点了"读完《霍比特人》"也没用——只是 UI 端没显示，数据仍在响应里

**这不是门控，是遮眼法。** 任何人打开 DevTools 就能看到全部剧透。

**修正**：分两层职责——
- **引擎默认值**保持 MAX_TIER（向后兼容测试）
- **UI 必须显式传参**，且 T7 校验断言 "client 调用 detail/place/artifact 时必须带 maxTier"

### 漏洞 3：`bundle` 全量下发使路由门控失去意义（严重）

**实测**：`bundle()` 返回 54 KB，**含 `fate` 字段**（不含 `details`）。

一次 `/bundle` 请求，客户端就拿到了 56 位角色的全部结局。

**修正**：`bundle()` 接受 maxTier，且**必须**在服务端应用。客户端的首次加载要传当前设定，不能"先全量再隐藏"。

### 漏洞 4："关键词黑名单"会漏报（中）

**问题**：原方案用 `['坠入烈焰','战死','西渡',…]` 做扫描。但剧透的表达方式无穷——「他没能回来」「她再也没见到他」都算剧透，却不在黑名单里。

**修正**：黑名单只作为**回归保护**（防止已修的泄露重新出现），不作为"证明无泄露"的依据。真正的保证来自：
- 字段级白名单（tier 1 只允许这几个字段出现）
- 而不是黑名单（禁止这些词）

**这是白名单思维 vs 黑名单思维的区别**，前者可证明，后者只能举例。

### 漏洞 5：`timeline` 的 `title` 与 `desc` 分属不同等级，但 UI 是一起渲染的（中）

实测 8 个事件的**标题本身**就是结局（"末日火山：魔戒毁灭"）。

如果只遮蔽 `desc` 保留 `title`，等于剧透没遮。需要：
- 标题含结局的事件整体提升到 tier 3（已在例外表里）
- UI 遇到 `locked` 记录时，渲染为「🔒 某个事件（已隐藏）」而非空行

### 漏洞 6：化身场景的 tier 与全局 tier 是两套语义（中）

**问题**：`journey.js` 的 tier 是「这一幕的剧透程度」（1=开端、2=中段、3=结局）。而新的全局 tier 是「读者读到哪」。两者数值范围巧合相同（1–3），但**语义不同**。

**风险**：未来维护者会误以为可以共用。

**修正**：全局门控不改动 `journey.js` 的 tier（已正确）；但在两处代码注释里明确写出语义差异，并在 `spoiler.js` 顶部说明「本模块的 tier 是阅读进度，不是场景分级」。

---

## 十一、修正后的执行顺序与工作量

| 任务 | 原估 | 修正 | 原因 |
|---|---|---|---|
| T1 spoiler.js | 简单 | **中** | 例外表约 28 条，需要逐条核对 |
| T2 引擎门控 | 中 | 中 | 增加 `bundle(maxTier)` |
| T3 路由/工具 | 简单 | 简单 | |
| T4 UI | 简单 | **中** | 必须传参 + 锁定占位行 |
| T5 主题 | 1 天 | 1 天 | 不变 |
| T6 分析 | 半天 | 半天 | 不变 |
| T7 校验 | 中 | **中偏高** | 需改为白名单断言 + client 传参断言 |

**总量从约 2.5 天修正为约 3.5 天。**

---

## 十二、审核后的设计原则（写进代码注释）

1. **白名单优于黑名单**：tier 1 只允许明确列出的字段出现，而不是禁止某些词。
2. **默认值要给测试用，UI 必须显式**：引擎默认全开是为了不破坏既有测试，不是为了让 UI 偷懒。
3. **门控必须在服务端完成**：客户端拿到的不应包含被隐藏的内容，否则只是视觉隐藏。
4. **同一数值，不同语义要注释**：`journey.js` 的 tier ≠ `spoiler.js` 的 tier。

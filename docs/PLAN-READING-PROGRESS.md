# 详细实施方案：阅读进度视图

> 基于 ANALYSIS-READING-PROGRESS.md 的结论。等白屏问题彻底解决后再执行本方案。
> 每项含：现状 → 改动 → 文件 → 验收。

---

## 目标

复用现有 `spoiler.js` 的 tier，新增两个查询能力：

1. **readingProgress(tier)** — "读到这一步，你会遇到谁"
2. **characterJourney(id, tier)** — "这个角色在故事里经历了什么"

**不新增第二个进度控件**——扩展现有的顶部「剧透范围」选择器。

---

## 需求审核（实施前）

| 检查 | 结论 |
|---|---|
| 是否与现有剧透系统冲突？ | 不冲突。复用 `spoiler.js` 的 tier，只读不写 |
| 数据是否支撑？ | `EVENTS[].characters`+`works` 33/33 全有；`CHARACTERS[].works` 全有 |
| 缺口 | 事件 `year` 是文本不可排序；19 个 plot beats 无 characters |
| 是否有更简单的路径？ | 有。events 一条腿即可，beats 补全是阶段 2 |

---

## 任务拆分与依赖

```
S1 事件排序号（order 1..33）
   ↓
S2 readingProgress() 引擎函数 ──→ S4 路由 + 工具
   ↓
S3 characterJourney() 引擎函数 ─→ S4
   ↓
S5 UI：复用剧透选择器，新增「阅读进度」标签
   ↓
S6 校验 + 探针
```

---

## S1：给事件加稳定排序

**现状**：`EVENTS[].year` 是 `"TA 2941 春"` 这类文本，无法排序。

**改动**：给每条事件加 `order` 整数（1–33），按纪元分组 + 组内时间顺序。

**文件**：`data.js`

**验收**：selfcheck 断言 order 连续、无重复、同纪元内单调。

---

## S2：readingProgress(maxTier)

**函数签名**：
```js
export function readingProgress(maxTier) {
  // 按 WORKS 的小说阅读顺序分组
  // 每组：{ work, title, tier, locked, cast[], eventCount, placeCount }
  // cast 从 CHARACTERS[].works 反查（复用三体做法）
}
```

**数据来源**（全部已有）：
- 作品顺序：`WORKS`（hobbit-book → lotr-book → silmarillion）
- 角色登场：`CHARACTERS[c].works[workId]`
- 事件数：`EVENTS.filter(e => e.works.includes(workId)).length`
- 等级：`spoiler.js` 的 tier

**文件**：`engine.js`

**验收**：tier=1 时 silmarillion 组 locked=true；每组 cast 非空。

---

## S3：characterJourney(id, maxTier)

**函数签名**：
```js
export function characterJourney(id, maxTier) {
  // 从 EVENTS 筛 characters 含 id 的
  // 按 S1 的 order 排序
  // 每条标记 role: focus|named|present（用三体的文字匹配法）
  // 应用 spoiler 门控
}
```

**role 判定**（复用三体 `beatRole`）：
```js
标题含角色名 → focus
描述含角色名 → named
否则         → present
```

**文件**：`engine.js`

**验收**：弗罗多的旅程非空且有序；tier=1 不泄露结局事件（e23 locked）。

---

## S4：路由 + 工具

| 类型 | 名称 | 说明 |
|---|---|---|
| 路由 | `/progress` | 阅读进度分组 |
| 路由 | `/character-journey?id=` | 角色故事线 |
| 工具 | `middle_earth_progress` | 对话里问"读到哪遇到谁" |
| 工具 | `middle_earth_journey` | 对话里问"某角色的经历" |

**文件**：`index.js`

---

## S5：UI 集成（关键：不新增进度控件）

**现状**：面板顶部已有「剧透范围」三档选择器，`spoilerTier` 是唯一进度状态。

**改动**：
1. 新增「📖 阅读进度」标签
2. 该标签读取同一个 `spoilerTier`，调用 `/progress`
3. 人物档案抽屉新增「故事线」区块，调用 `/character-journey`
4. **不新增第二个进度选择器**

**文件**：`client.js`

**验收**：切换顶部剧透档位，阅读进度页同步变化。

---

## S6：校验 + 探针

- selfcheck：events order 连续；readingProgress 分组完整；characterJourney 有序且不泄露
- probe：渲染新标签

---

## 风险边界

1. 电影进度与原著不对应 → 进度只按原著定义，UI 说明
2. 边缘角色 journey 太短 → 照三体做法，至少返回 events
3. order 手工维护 → selfcheck 断言连续性

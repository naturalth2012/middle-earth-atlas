# 「阅读进度 → 人物详情」功能分析

> 2026-11-22。基于对本机 three-body-atlas 源码与中土图鉴数据的实测对比。

---

## 一、三体是怎么做的（源码实测）

它有两个互补的函数：

### 1. `pathGuide()` —— 按阅读路径组织

```js
PATHS.map((path) => ({
  steps: path.steps.map((step) => ({
    work: step.work,
    tier: tierOfWork(step.work),          // 这一步对应哪本书
    locked: tier > cap,                   // 超出阅读进度则锁定
    cast: CHARACTERS.filter((c) => (c.works || {})[step.work])
            .sort((a,b) => (b.relations||[]).length - (a.relations||[]).length)
            .slice(0, 5)
            .map((c) => ({ name: c.name, role: (c.works||{})[step.work] })),
    eventCount: events.length,
  })),
}))
```

**要点**：不给角色单独标注"第几部登场"，而是**从 `c.works[workId]` 反查**——角色在某作品里有 `works` 键就说明他登场了，值是"在该作品中的角色定位"。

### 2. `characterJourney()` —— 一个角色经历的全部场景

```js
beats  ← PLOT[].beats[] 中 characters 含该角色的
events ← EVENTS[] 中 characters 含该角色的
// 每条标记参与程度
beatRole(title, desc, c):
  标题含角色名 → 'focus'    （主角）
  描述含角色名 → 'named'    （被提及）
  否则         → 'present'  （在场）
```

**要点**：**用文字匹配推断参与程度**，不需要额外数据。这是很聪明的一步——已有的 title/desc 里本来就写了名字。

---

## 二、我的数据基础：比想象的好，但缺一块

### 已有的（能直接支撑）

| 数据 | 状态 | 用途 |
|---|---|---|
| `EVENTS[].characters` | ✅ 33/33 全有 | 按角色筛选事件 |
| `EVENTS[].works` | ✅ 33/33 全有 | 按作品分组 |
| `CHARACTERS[].works` | ✅ 全部有（形如 `{'lotr-book': '主角'}`） | 角色在哪些作品登场 |
| `EVENTS[].age` + `year` | ✅ 有，但 `year` 是描述文本 | 分纪元，不能精确排序 |

### 缺的（关键）

| 缺口 | 现状 | 影响 |
|---|---|---|
| **`PLOT[].beats[].characters`** | ❌ 19 个 beat 全无 | 无法按角色筛剧情节点 |
| 事件的精确序号 | `year` 是 `"TA 2941 春"` 这类文本 | 需要解析或手工排序 |

**但注意**：即使缺少 beats 的 characters，`EVENTS` 的 33 条已经能支撑一个可用的「角色旅程」——三体的 `characterJourney` 也是 events 和 beats 两条腿，少一条仍能走。

---

## 三、中土与三体的本质差异（决定能否照搬）

这是本次分析最重要的部分。

### 差异 1：三体是「线性三部曲」，中土是「多媒介 + 非线性」

三体的阅读顺序是确定的：`球状闪电(0) → 三体(1) → 黑暗森林(2) → 死神永生(3)`。`WORK_TIER` 就是这几本书的排序。

中土完全不同：

| 作品 | 出版年 | 但信息揭示的时间 |
|---|---|---|
| 《霍比特人》 | 1937 | 只是"一枚魔法戒指"，不提至尊戒 |
| 《魔戒》 | 1954 | 揭示魔戒真相、结局 |
| 《精灵宝钻》 | 1977（遗稿） | 前传，但**含第三纪元的背景**（索伦起源、炎魔来历） |

**《精灵宝钻》是前传，却晚出版且含终局背景**。所以不能简单地"按出版顺序定级"——这正是我上一轮在 `spoiler.js` 里已经处理过的问题。

### 差异 2：三体的「角色登场」边界清晰，中土的模糊

三体：叶文洁在第一部就登场，逻辑简单。

中土：**甘道夫在《霍比特人》《魔戒》《精灵宝钻》《力量之戒》里都出现**，但他在每个作品里的"面目"完全不同——霍比特人里他只是个爱放烟花的巫师。

**所以「阅读进度 → 人物详情」不能只按"该角色是否在某作品出现"来筛选**，否则：

- 读完《霍比特人》的人查甘道夫 → 会看到《精灵宝钻》里他是迈雅的内容 → **剧透**
- 这正是我上一轮做过的事：`spoiler.js` 的字段级门控 + 36 条记录级例外

### 差异 3：中土有电影/剧集，三体有多版本但更简单

中土的电影压缩时间线（第 1 部电影就包含原著多个章节），剧集是第二纪元。**同一个"进度"在不同媒介下不对应**。

---

## 四、结论：可以吸收，但要做三处本地化改动

### 改动 1：不改架构，复用现有 `spoiler.js`

**关键判断——不需要新建 tier 系统。**

我已经有 `spoiler.js`（字段级白名单 + 记录级例外），它解决的问题与三体的 `WORK_TIER` 完全重叠，而且更精细。

三体的做法是「按作品给记录定级」，我的做法是「按字段定级 + 记录例外」。**后者已经覆盖了前者的能力**。

要加的不是新机制，而是**一个把「阅读进度」映射到「该看哪些角色」的查询函数**。

### 改动 2：新增 `readingProgress()` —— 中土版的 pathGuide

```js
readingProgress(maxTier) → {
  works: [{
    work, title, tier,          // 来自现有 WORKS + spoiler
    locked,                      // tier > maxTier
    cast: [{ id, name, role }],  // 从 CHARACTERS[].works 反查，已有数据
    eventCount,                  // 从 EVENTS 统计，已有数据
    placeCount, artifactCount,
  }],
  currentWork,                   // 按 maxTier 推断"你大概读到哪"
}
```

**完全不需要新数据**——`CHARACTERS[].works` 和 `EVENTS[].works` 都已存在。

### 改动 3：新增 `characterJourney()` —— 角色在故事中的顺序

```js
characterJourney(id, maxTier) → {
  beats: [{  // 从 EVENTS 生成，按 age → year 排序
    event, title, age, year,
    role: 'focus' | 'named' | 'present',   // 文字匹配推断，同三体
    people,                                 // 同事件的其他角色
  }],
  timeline: [...],
  spoilerSafe: true,                        // 受 maxTier 门控
}
```

**需要补一件事**：`EVENTS` 要有稳定排序。当前 `year` 是文本，我可以用 `age` 分组 + 在组内按 `year` 的解析值排序，或给 `EVENTS` 加一个 `order` 整数（33 条，工作量小且一劳永逸）。

---

## 五、与三体的对比：谁的方案更适合中土

| 维度 | 三体 | 中土应该做的 | 理由 |
|---|---|---|---|
| 进度定义 | 作品序号 0-3 | 复用现有 spoiler tier 1-3 | 已有，且处理了《精灵宝钻》前传问题 |
| 角色登场 | `c.works[workId]` 反查 | 同上，**完全相同** | 数据结构一致，可直接照搬 |
| 参与程度 | 文字匹配 title/desc | 同上 | 零成本，且我的数据里名字都在 |
| 剧情节点 | `PLOT.beats[].characters` 显式列出 | **建议补上** | 我缺这个，但 events 已能兜底 |
| 门控 | `maskRecord` 删字段 | 已有，更精细 | 我的是字段级白名单 |

**结论：三体的 `pathGuide` + `characterJourney` 思路完全适用于中土，且我的基础设施（spoiler.js）比它更完善。缺的只是两个查询函数 + 33 条事件的排序号。**

---

## 六、建议的实现方案

### 阶段 1（纯计算，半天）

1. 给 `EVENTS` 加 `order: 1..33` 整数（按 age 分组 + 手工排定）
2. 新增 `readingProgress(maxTier)` → 按作品分组的"读到哪、会见到谁"
3. 新增 `characterJourney(id, maxTier)` → 一个角色经历的事件序列 + 参与程度
4. 两条路由 `/progress`、`/character-journey`
5. 两个工具

### 阶段 2（补数据，1 天）

1. 给 19 个 `PLOT.beats` 补 `characters` 字段
2. 这样 `characterJourney` 能同时有 beats 和 events 两条腿

### 阶段 3（UI）

1. 新增「阅读进度」标签页：三档进度 + 每档"你会遇到谁"
2. 人物卡增加「他的故事线」——按阅读顺序列出该角色经历的事件

---

## 七、风险与边界

| 风险 | 对策 |
|---|---|
| 「阅读进度」与已有剧透选择器重复 | **合并为一个控件**，不要两个设置项——这是最容易做错的地方 |
| 电影/剧集进度与原著不对应 | 进度只按**原著**定义，并在 UI 说明；电影观众可选更高档 |
| `characterJourney` 对边缘角色信息太少 | 三体的做法是"仍返回 events"，不返回空；照做 |
| 排序号手工维护易错 | 加 selfcheck 断言：order 连续无重复、与 age 分组单调 |

---

## 八、我的判断

**这个功能值得做，而且成本比预想低**——因为：

1. 数据基础已在（`characters` + `works` 字段全有）
2. 门控机制已在（`spoiler.js`，且比三体精细）
3. 缺的只是两个查询函数和一份排序号

**但有一个必须避免的陷阱**：不要把「阅读进度」做成第二个剧透设置。现在面板顶部已有「剧透范围」三档选择器（读完霍比特人 / 读完魔戒 / 全部）——**这已经就是"阅读进度"**。

正确的做法是**扩展它**，而不是新增一个平行控件：

- 现有的 `spoilerTier` 决定"能看到什么"
- 新增的 `readingProgress` 告诉用户"在这个进度下，你已经认识谁、还会遇到谁"

两者共用同一个 tier 值，只是**呈现方式不同**。

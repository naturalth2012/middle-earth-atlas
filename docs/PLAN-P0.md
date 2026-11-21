# P0 执行方案：持久化 + 响应式 + 无障碍

> 本方案基于 2026-11-21 对当前代码库的实测，不是泛泛而谈。
> 每项都写明：**现状证据 → 设计决策 → 为什么这样做 → 验收标准 → 风险**。

---

## 一、任务细化

把 ROADMAP 的 P0 拆成 6 个可独立验收的子任务：

| ID | 子任务 | 产出 | 依赖 |
|---|---|---|---|
| T1 | 化身进度持久化（存储层） | `storage.js` 纯函数模块 | 无 |
| T2 | 化身进度持久化（UI 接入） | `avatar-tab.js` 读写存档 | T1 |
| T3 | 存储层测试 | selfcheck 覆盖 T1 | T1 |
| T4 | 响应式断点 | CSS `@media` 块 | 无 |
| T5 | 无障碍补强 | `aria-*` / `role` / 焦点环 | 无 |
| T6 | 无障碍与响应式静态校验 | selfcheck 覆盖 CSS/ARIA 结构 | T4,T5 |

---

## 二、T1–T3：化身进度持久化

### 现状证据

```
useState: journey/failed/step/picks/revealed/judgement 全在组件内
localStorage 引用: 0 处
```

刷新页面 = 进度全丢。一段 4 幕的旅程被打断后要重来。

### 设计决策

**存什么**

```js
// key: mea:avatar:v1:<avatarId>
{
  v: 1,                  // 结构版本
  picks: { fr1: 0, fr2: 1 },   // sceneId -> choiceIndex
  step: 2,               // 当前幕
  tier: 2,               // 剧透等级
  savedAt: 1750000000000
}
```

**为什么存 `tier`**：剧透等级是体验的一部分，恢复时若等级被重置为 1，玩家会突然看不到已解锁的幕，像是"倒退"。

**为什么不存 `judgement`/`journey`**：`journey` 来自 Host，是派生数据；`judgement` 由服务端算。只存"用户做了什么"，其余重新推导——这与 DSH "会话日志是唯一真相"的原则一致。

### 关键设计：数据升级安全

**问题**：化身数据会演进（现在 8 位、25 幕，将来更多）。旧存档可能引用已删除的 scene，或换成不同的选项数量。

**方案**：读取时校验，不信任存档：

```js
restore(snapshot, journey) {
  if (!snapshot || snapshot.v !== 1) return null
  const picks = {}
  for (const [sceneId, idx] of Object.entries(snapshot.picks || {})) {
    const scene = journey.scenes.find(s => s.id === sceneId)
    if (!scene) continue                    // 幕已不存在 → 丢弃该条
    if (!Number.isInteger(idx)) continue
    if (idx < 0 || idx >= scene.choices.length) continue  // 选项越界 → 丢弃
    picks[sceneId] = idx
  }
  const step = Math.min(Math.max(0, Number(snapshot.step) || 0), journey.scenes.length - 1)
  return { picks, step, tier: [1,2,3].includes(snapshot.tier) ? snapshot.tier : 1 }
}
```

**为什么丢弃而不是报错**：存档是便利功能，不是数据。任何不确定都应回退到"从头开始"，而不是让页面崩掉。

### 为什么放在独立模块

`avatar-tab.js` 是 UI，把校验逻辑混进去会让它无法在纯 Node 环境测试。抽出 `storage.js`：

- 纯函数，无 DOM 依赖
- 可被 `selfcheck` 直接 import 测试
- 存储介质（localStorage）通过参数注入，测试时传内存实现

```js
// 签名
export function saveSnapshot(store, avatarId, snapshot) { ... }
export function loadSnapshot(store, avatarId, journey) { ... }   // 含校验
export function clearSnapshot(store, avatarId) { ... }
```

`store` 只需 `getItem/setItem/removeItem`——测试时给一个 Map 包装即可。

### 风险与对策

| 风险 | 对策 |
|---|---|
| localStorage 在隐私模式/配额满时抛异常 | 全部读写包 try/catch，失败即降级为"不持久化"，绝不阻断游戏 |
| 存档跨版本污染 | 版本号 `v:1`，不匹配直接丢弃 |
| 多标签页同时玩冲突 | 不处理。这是单机低频场景，引入锁得不偿失 |
| 存档让玩家"跳过"已完成的旅程 | 完成后清除存档，下次从第一幕开始 |

**验收**：
- 选两幕 → 刷新 → 回到第三幕，前两幕选择保留
- 篡改存档（非法 scene / 越界 choice / 错误版本）→ 安全回退，不崩
- localStorage 抛异常 → 游戏仍可玩
- 完成后存档被清除

---

## 三、T4：响应式断点

### 现状证据

```
@media 出现次数: 0
grid 最小宽度: 112 / 150 / 252 / 260 / 320 px
.mea-drawer: width:min(580px, 94vw)
.mea-barrow span:first-child: 96px 固定
```

最小 320px 的格子意味着容器窄于 ~360px 时会出现单列溢出。DSH 是桌面应用，但侧边栏拖窄、窗口分屏都会触发。

### 设计决策

**只加一个断点：720px。** 不加多档。

**理由**：这个面板是文字优先的信息型界面，两档（宽/窄）足以覆盖。加三档以上会增加维护成本却没有真实收益——没有 320px 手机这个使用场景。

断点内做四件事：

```css
@media (max-width: 720px) {
  /* 1. 格子降到单列，取消最小宽度约束 */
  .mea-grid, .mea-avatar-grid, .mea-quick, .mea-two { grid-template-columns: 1fr }

  /* 2. 抽屉全宽 */
  .mea-drawer { width: 100%; max-width: 100%; border-left: 0 }

  /* 3. tab 条横向滚动而不是折行挤压 */
  .mea-tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch }
  .mea-tab { flex: 0 0 auto }

  /* 4. 统计格与柱状标签收窄 */
  .mea-stats { grid-template-columns: repeat(2, 1fr) }
  .mea-barrow span:first-child { width: 72px; flex: 0 0 72px }
  .mea-scroll { padding: 16px 14px 28px }
}
```

**为什么 tab 用横向滚动**：11 个标签在窄屏折行会占掉半屏。横向滚动是移动端标准做法，且不改变 DOM 结构。

**为什么抽屉全宽**：580px 的抽屉在 400px 视口里会溢出。

### 验收
- 320px / 375px / 720px 宽度下无横向滚动条
- tab 条可横向滚动，能点到最后一个标签
- 抽屉铺满窄屏

---

## 四、T5：无障碍补强

### 现状证据

```
aria- 出现: 1 处（'aria-pressed'）
role: 0 处
进度条: 纯 div，无语义
```

好消息：9 个交互元素都是原生 `<button>`，本身可聚焦、可回车触发。**不需要加 tabIndex**。

### 要补的

**1. 进度条语义**

```js
h('div', {
  className: 'mea-progress',
  role: 'progressbar',
  'aria-valuenow': progress,
  'aria-valuemin': 0,
  'aria-valuemax': 100,
  'aria-label': t('avatarProgress'),
}, h('i', { style: { width: progress + '%' } }))
```

**2. 选项组语义**

```js
h('div', { className: 'mea-choices', role: 'group', 'aria-label': t('avatarChoices') }, ...)
```

**3. 结果区播报**

```js
h('div', { className: 'mea-outcome', 'aria-live': 'polite' }, ...)
```
选完之后屏幕阅读器会自动读出后果——这是体验的关键一环，否则视障用户不知道发生了什么。

**4. 评分结果播报**

```js
h('div', { className: 'mea-verdict', 'aria-live': 'polite' }, ...)
```

**5. 焦点可见性**

现有 CSS 没有 `:focus-visible` 样式，浏览器默认轮廓在深色主题下可能不可见。

```css
.mea-btn:focus-visible, .mea-choice:focus-visible,
.mea-tab:focus-visible, .mea-avatar-tile:focus-visible, .mea-chip:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
```

**6. 装饰性 emoji**

`💍` `🎭` 等对屏幕阅读器是噪音。给纯装饰元素加 `aria-hidden="true"`。

但**不要**给承载信息的 emoji 加（如 tab 标签里的图标与文字同在一个按钮里，文字已足够）。

### 不做的

- **不加 skip-link**：面板本身就是一个独立区域，没有需要跳过的长导航
- **不加 tabIndex**：按钮原生可聚焦，加了反而会打乱 Tab 顺序
- **不做完整 WCAG 审计**：超出当前范围，且没有真实辅助技术可测

### 诚实说明
**我无法在真实屏幕阅读器上验证效果。** 只能保证语义正确（role/aria 规范），实际播报效果需要你用 NVDA/VoiceOver 确认。这一点会在交付时注明。

---

## 五、T6：静态校验

selfcheck 新增一组 `accessibility & responsive`：

- `client.js` 含至少一个 `@media` 块
- 断点值在 600–800 之间（防止误写成 1200 导致桌面也单列）
- 进度条元素含 `role` 与 `aria-valuenow`
- 结果区含 `aria-live`
- `:focus-visible` 规则存在
- 所有 `@media` 块内的选择器都有对应的原始选择器（防止拼写错误导致规则失效）

**最后一条是真正的价值**：CSS 拼错选择器会静默失效，这正是自动化能抓住而人工容易漏的。

---

## 六、执行顺序

```
T1 storage.js          → 纯函数，可独立测
T3 storage 测试        → 先测再接线，避免 UI 掩盖 bug
T2 UI 接线             → 读写存档
T4 CSS 断点            → 独立
T5 ARIA 补强           → 独立
T6 静态校验            → 收口
再内联 + 全量验证 + 推送
```

**为什么 T3 在 T2 之前**：校验逻辑是这次最容易出错的地方（存档格式演进），先把它测透，再接 UI，出问题时能立刻定位是存储还是接线。

---

## 七、方案审核（自查发现的问题与修正）

在写代码前审核本方案，发现三处会导致实现错误的漏洞，已修正设计：

### 漏洞 1：`tier` 恢复与 effect 依赖冲突（严重）

**问题**：`tier` 是父组件 `AvatarJourneyTab` 的状态，`Player` 只读；而 `Player` 的加载 effect 依赖 `[avatar.id, tier]`。若在 `Player` 内恢复 `tier`，会触发 effect 重跑，而 effect 内无条件执行 `setPicks({})`，把刚恢复的进度清空。

**修正**：`tier` 的恢复必须由**父组件**在选中角色时完成（`setActive` 之前），不能在 `Player` 内做。

### 漏洞 2：effect 内无条件重置会覆盖恢复值（严重）

**问题**：现有 effect 开头是

```js
setJourney(null); setFailed(false); setStep(0); setPicks({}); setRevealed({}); setJudgement(null)
```

若把恢复逻辑写在 `getJSON(...).then(...)` 内，看似可行；但任何导致 effect 重跑的因素（`tier` 变化、StrictMode 双调用）都会重置进度。

**修正**：
- 恢复逻辑放在 `then` 内，且**先于**渲染使用
- `tier` 在旅程进行中**不再允许切换**（进入 `Player` 后隐藏等级按钮）。这既避免竞态，也符合体验——中途改剧透等级本就该重开。

### 漏洞 3：写入时机不明确（中）

**问题**：方案只说"存 picks"，没说何时存。若在 render 中写，React 每次渲染都会写一次，可能触发不必要的 IO；更糟的是与 `setState` 形成循环。

**修正**：写入放在**事件处理器内**（`pick` / `next` / `finish`），不在 render 路径上。写失败不影响流程。

### 补充：完成后的存档清除

旅程结束并看到评分后，清除存档。否则玩家重新进入会直接跳到最后一幕，失去重玩的意义。

### 补充：跨角色隔离

存档按 `avatarId` 分键。切换角色不会互相污染，但**同时只保留一个**角色进度是更简单的语义——不，两者都要：分键存储，但每个角色各自独立，互不影响，也不主动清理其他角色的存档（用户可能想在多个角色间切换着玩）。

---

## 八、总验收清单

- [ ] `node scripts/selfcheck.mjs` 全绿，≥ 2150 项
- [ ] `node scripts/probe.mjs` 0 错误
- [ ] `node scripts/inline-avatar-tab.mjs --check` 通过
- [ ] 刷新后进度保留；完成后存档清除
- [ ] 篡改存档不崩溃
- [ ] localStorage 不可用时游戏仍可玩
- [ ] 320px 无横向滚动
- [ ] 键盘可完整走完一段旅程
- [ ] 运行时 17 条路由全通

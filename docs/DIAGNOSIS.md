# 诊断报告：中土图鉴面板白屏

> 2026-11-22。已定位并修复。

---

## 一、真正的原因

**React Hooks 顺序违规导致组件抛错，被 slot 边界吞掉，面板渲染为空白。**

具体位置：`client.js` 的 `AtlasPage` 组件里，两个 `useMemo` 写在了 `if (!data) return` **之后**：

```js
if (error) { return ... }        // ← 第一次渲染走这里
if (!data) {
  return h('div', ...)           // ← 第一次渲染也走这里
}

// ↓ 只有在 data 到达后才执行
const avatarStorage = React.useMemo(() => buildAvatarStorage(), [])
const AvatarTabView = React.useMemo(() => buildAvatarTab({...}), [t])
```

React 靠**调用顺序**识别 hook：

| 渲染阶段 | data 状态 | React 看到的 hook 数 |
|---|---|---|
| 第一次 | `null` | 6（两个 useMemo 没执行） |
| 第二次 | 已加载 | 8 |

数量不一致 → React 抛出「Rendered more hooks than during the previous render」→ slot 边界捕获 → **整块面板变空白，页面上没有任何提示**。

---

## 二、为什么这个 bug 特别难发现

1. **没有错误可见**。Slot 边界会把组件崩溃静默处理，浏览器控制台之外看不到任何东西。
2. **我的探针抓不到**。探针用简化的 hook stub，不校验数量一致性——它只验证"能构造元素树"。
3. **静态语法检查通过**。`node --check` 只查语法，hook 顺序是运行期规则。
4. **Host 完全正常**。路由 200、工具可用、`plugin_manager` 报 `active`——所有我能用命令行验证的指标都是绿的。

**这是"能通过全部自动化检查、但用户看到白屏"的典型例子。**

---

## 三、修复

把两个 `useMemo` 移到所有 early return **之前**，紧跟已有的 `useEffect`：

```js
const load = () => {...}
React.useEffect(load, [])

// 现在在这里，早于任何 return
const avatarStorage = React.useMemo(() => buildAvatarStorage(), [])
const AvatarTabView = React.useMemo(() => buildAvatarTab({..., storage: avatarStorage}), [t])

if (error) { return ... }
if (!data) { return ... }
```

修复后：first-render hooks = 8，后续渲染 = 8，一致。

---

## 四、防止复发

新增 selfcheck 组 `react hook order`：

- 用**花括号深度扫描**识别"组件自己层级上的 return"（不是正则行匹配——后者会把 `useEffect` 里的清理函数 `return () => {}` 误判为 early return）
- 排除组件内部定义的 `function useXxx()` 辅助 hook
- 对每个组件断言：不存在位于 early return 之后的 hook
- 单独断言 `AtlasPage` 的两个 memo 在 guard 之前

**已反证有效**：把 hook 移回错误位置后，校验立即报两项失败。

---

## 五、我之前几轮的误判（如实记录）

| 轮次 | 我说的原因 | 实际 |
|---|---|---|
| 3 | "端口错了，用 6460" | 端口确实变了，但**不是白屏原因** |
| 4 | "浏览器没加载客户端插件" | 侧边栏图标存在，证明**已加载** |
| 5 | "所有第三方插件的客户端都未加载" | 截图证明三体面板正常，**只有我的坏** |

前两轮基于命令行探针，而探针只能看到 Host。**截图是决定性的**：侧边栏有「中土图鉴」和「三体宇宙」，三体能渲染、我的空白——这立刻排除了"环境问题"。

教训：**用户看到的界面是唯一的最终判据**，Host 指标全绿不代表 UI 存在。

---

## 六、当前状态

| 项 | 状态 |
|---|---|
| Hooks 顺序 | ✅ 已修复 |
| selfcheck | ✅ 3464 项全过 |
| 三个探针 | ✅ 0 错误 |
| 运行时路由（端口 11548） | ✅ bundle / themes / analysis / detail 全通 |
| 防复发校验 | ✅ 已加并反证有效 |

刷新页面即可看到面板。

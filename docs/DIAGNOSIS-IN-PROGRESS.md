# 白屏问题诊断进行中

> 2026-11-22。

---

## 已经排除的（都有实测证据）

| 假设 | 排除依据 |
|---|---|
| 端口错误 | 实际端口 11548，bundle 返回 200 / 55KB |
| 插件未启用 | `fiberPhase: active` |
| Host 路由坏 | 20 条路由全通 |
| client.js 语法错 | `node --check` 通过，静态结构完整（无 BOM、花括号平衡、CSS 模板无破坏字符） |
| Hook 顺序错（上次修的） | 严格检查：AtlasPage 的 8 个 hook 全部在 early return 之前 |
| CSS 隐藏内容 | 根容器 CSS 与正常工作的 three-body 插件逐字相同 |
| 浏览器 API 抛错 | localStorage/document 访问全部有 try-catch 保护 |
| bundle 数据缺字段 | tier=3 下 counts.byFaction 等全有，40+ 字段正常 |

---

## 现在用的诊断手段

所有静态分析都通过，说明问题在**浏览器运行时**，而我看不到浏览器控制台。

因此加了一条**错误回传通道**：

- Host 路由：`/plugins/middle-earth-atlas/client-error`（读）与 `/client-error/report`（写）
- Client 在 factory 最早处注册 `window.onerror` 与 `unhandledrejection`
- 任何浏览器端未捕获错误都会以 GET 上报到 Host，我可从 shell 读取

自检确认通道可用（写入一条 `context=selftest` 记录，已记录以便过滤）。

---

## 需要用户执行

1. 硬刷新页面（`Ctrl + Shift + R`）——加载带诊断代码的新客户端
2. 点击「中土图鉴」——触发白屏
3. 告知我，我读取错误路由

---

## 另一个已发现的真实缺陷（修 hook 时发现）

`renderDossierBody` 里 `d.appearances.length` 没做空值保护。当剧透门控把 `appearances` 遮蔽掉（tier 1/2 下确实为 undefined），打开档案抽屉会崩溃。

这是真实 bug，但与首屏白屏不同——它只在打开抽屉时触发。修复已列入本次待办。

---

## 阅读进度方案

已落地为 `docs/PLAN-READING-PROGRESS.md`。将在白屏彻底解决后执行。

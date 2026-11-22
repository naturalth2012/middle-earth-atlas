# DSH 市场 PR 提交包（已备妥，待仓库满 24h）

> 提交时间：2026-11-22 20:00 CST（已设定时任务）
> 原因：awesome-dsh-plugin CI 强制要求仓库创建满 24 小时，当前仅 16 小时。

---

## 预检结果

| 要求 | 状态 |
|---|---|
| 只加一个文件 `data/plugins/<owner>__<repo>.yml` | ✅ 准备好了 |
| `description.en` 必填 | ✅ |
| 描述数字属实（会被核对） | ✅ 已逐项验证 |
| `dsh.bundle` manifest | ✅ 有 |
| `cordis.patch.yml` | ✅ 有 |
| `dsh-plugin` topic | ✅ 本次已补上 |
| 仓库满 1 天 | ⏳ 还差约 8 小时（定时任务处理） |
| 不手改 README | ✅ 遵守 |

---

## 要添加的文件

路径：`data/plugins/naturalth2012__middle-earth-atlas.yml`

内容（与 `market-entry.yml` 一致，但按 CI 要求核对过格式）：

```yaml
url: https://github.com/naturalth2012/middle-earth-atlas
name: naturalth2012/middle-earth-atlas
category: fun
description:
  en: 'An explorable atlas of The Hobbit, The Lord of the Rings and The Silmarillion: 68 characters with 236 curated relationships, a 46-event timeline across the Ages, 33 places, 14 artifacts, 39 quotes and a force-directed relationship graph with centrality analysis. Includes reading-progress views, three-sided thematic dialectics, book-vs-screen differences, and 17 playable avatar journeys with spoiler-gated choices. Unofficial study guide; not affiliated with any rights holder.'
  zh: '《霍比特人》《魔戒》《精灵宝钻》可探索图鉴：68 位人物与 236 条关系、46 个纪元事件、33 个地点、14 件宝物、39 句名句，以及带中心性分析的关系图谱。含阅读进度视图、三方主题辩证、原著与改编差异，以及 17 位可扮演角色的剧情旅程。非官方导读工具，与任何权利方无关。'
icon: https://raw.githubusercontent.com/naturalth2012/middle-earth-atlas/main/assets/icon-180.png
```

---

## 描述数字核对（逐项实测）

| 声明 | 实际 | ✓ |
|---|---|---|
| 68 characters | 68 | ✓ |
| 236 relationships | 236 | ✓ |
| 46-event timeline | 46 | ✓ |
| 33 places | 33 | ✓ |
| 14 artifacts | 14 | ✓ |
| 39 quotes | 39 | ✓ |
| 17 playable avatar journeys | 17 | ✓ |
| force-directed graph + centrality | analysis.js 有 Brandes 中介中心性 | ✓ |
| reading-progress views | progress.js + 路由 | ✓ |
| three-sided thematic dialectics | themes.js 7 组，各三方 | ✓ |
| book-vs-screen differences | differences 10 条 | ✓ |
| spoiler-gated choices | spoiler.js + 36 条例外 | ✓ |

---

## PR 参数

- 仓库：`awesome-dsh-plugin/awesome-dsh-plugin`
- 分支：`naturalth2012-middle-earth-atlas`
- 标题：`Add middle-earth-atlas`
- 正文：

```markdown
Adds `middle-earth-atlas`, a DSH plugin that turns The Hobbit, The Lord of the
Rings and The Silmarillion into an explorable knowledge graph.

- 68 characters, 236 curated relationships, force-directed graph with degree
  and betweenness centrality
- 46-event timeline, 33 places, 14 artifacts, 39 quotes
- 7 three-sided thematic dialectics, book-vs-screen differences
- reading-progress views and 17 playable avatar journeys with spoiler gating
- 12 agent tools sharing the same engine as the panel

Repo declares `dsh.bundle` + `cordis.patch.yml`; carries the `dsh-plugin`
topic. Description figures were checked against the source. Unofficial study
guide, not affiliated with any rights holder.
```

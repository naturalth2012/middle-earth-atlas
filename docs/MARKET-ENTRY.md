# DSH 市场条目（待提交）

> 按本机 `dsh-plugin-catalog` 缓存（11744 条）的实测字段格式准备。
> 提交位置：`awesome-dsh-plugin/awesome-dsh-plugin` 主仓库（**不是** dsh-plugin-catalog，后者的 README 明确写着不要开 PR）。

---

## 条目文本（JSON 格式）

```json
{
  "name": "middle-earth-atlas",
  "owner": "naturalth2012",
  "url": "https://github.com/naturalth2012/middle-earth-atlas",
  "npm": "@naturalth2012/middle-earth-atlas",
  "version": "1.0.0",
  "category": "docs",
  "description": {
    "en": "An unofficial, canon-labelled study atlas of The Hobbit, The Lord of the Rings and The Silmarillion: 68 characters, 236 curated relationships, an interactive graph with network analysis, a 46-event timeline, reading-progress views, three-sided thematic dialectics, book-vs-screen differences and 17 playable avatar journeys. Not affiliated with any rights holder.",
    "zh": "非官方导读工具：把《霍比特人》《魔戒》《精灵宝钻》整理成可交互知识图谱，含 68 位角色、236 条关系、力导向图谱与网络分析、46 个纪元事件、阅读进度视图、三方主题辩证、原著与改编差异，以及 17 位可扮演角色的剧情旅程。内容标注来源层级，与任何权利方无关。"
  },
  "install": "dsh plugin --profile web add @naturalth2012/middle-earth-atlas",
  "capabilities": []
}
```

## 字段说明

| 字段 | 取值理由 |
|---|---|
| `name` | 与仓库名、npm 包名尾部一致 |
| `owner` | GitHub 用户名，与 npm scope 一致 |
| `category` | `docs` = Docs & Rendering；知识库类最贴近。若审核方认为偏娱乐，可改 `fun` |
| `description` | 明确写了 **unofficial / 非官方**，主动披露 IP 边界 |
| `capabilities` | 留空。插件不发起外部网络请求、不写工作区文件，只注册同源路由与工具 |
| `install` | 市场标准格式，指向 npm 包 |

## 提交前必须满足

- [ ] npm 包已真实发布（否则审核会失败）
- [ ] `version` 与 npm 上实际版本一致
- [ ] 仓库为公开状态

## 若审核方要求调整

- 嫌描述太长：保留前两句与 "Not affiliated with any rights holder" / "与任何权利方无关"
- 嫌 `capabilities` 空：可填 `["network"]`，但插件实际上不发外部请求，这属于保守申报
- 要求改 category：从 `docs` 改为 `fun`

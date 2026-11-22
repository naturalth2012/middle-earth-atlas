# 市场条目说明

本项目的市场条目以仓库根目录的 `market-entry.yml` 为准，格式与同账号已发布的
`three-body-atlas` 完全一致：

```yaml
url: https://github.com/naturalth2012/middle-earth-atlas
name: naturalth2012/middle-earth-atlas
category: fun
description:
  en: '...'
  zh: '...'
icon: https://raw.githubusercontent.com/naturalth2012/middle-earth-atlas/main/assets/icon-180.png
```

要点：

- `name` 用 `owner/repo` 形式（不是 npm scope 形式）
- `category: fun`，与三体宇宙保持一致
- 图标是 180×180 PNG，通过 `raw.githubusercontent.com` 引用（`assets/icon-180.png`）
- 描述中明确写了「非官方 / not affiliated with any rights holder」

提交位置：`awesome-dsh-plugin/awesome-dsh-plugin` 主仓库。
**不要**给 `dsh-plugin-catalog` 开 PR，其 README 明确写着自动发布、不接受 PR。

发布流程和命令见 [PUBLISH-NOW.md](PUBLISH-NOW.md)。
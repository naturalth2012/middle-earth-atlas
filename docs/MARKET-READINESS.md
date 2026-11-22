# DSH 市场提交可行性评估
> **更正（2026-11-22）**：npm 发布**不是**市场准入前提。
> 实测：三体宇宙没有 npm 包（registry 返回 404），但有 `market-entry.yml` 并走 GitHub 直装。
> 市场缓存中 5631/11744 条无 npm 字段，4428 条用 `github:` 安装命令。
> 因此按三体的 YAML 路径提交即可；npm 只是可选补充渠道。


> 2026-11-22。基于本机 DSH 市场缓存与 npm registry 实测，非推测。

---

## 一、结论

**技术上具备提交条件，但当前还差两步，且有一个内容风险需要你决定。**

| 条件 | 状态 |
|---|---|
| 包名可注册 | ✅ `@naturalth2012/middle-earth-atlas` 在 npm 上是 404（未占用） |
| 包规范 | ✅ name/license/engines/exports/files 齐备，`private` 已移除 |
| 展示资源 | ✅ README / LICENSE / icon.svg / locale 中英文 / DETAIL 齐备 |
| 功能完整性 | ✅ 3945 项自检 + 3 探针 + 23 路由 + 12 工具，实测可运行 |
| GitHub 仓库 | ✅ 公开，代码已同步 |
| **npm 登录** | ❌ 未登录，无法发布 |
| **市场收录入口** | ⚠️ 需向 `awesome-dsh-plugin/awesome-dsh-plugin` 提交（该仓库当前网络不可达，无法核实其贡献格式） |
| **内容/IP 风险** | ⚠️ 托尔金作品的角色名、地名、台词版权归权利方，需你判断是否接受 |

---

## 二、市场机制（实测）

本机 DSH 市场的目录数据来源：

- 市场客户端从 npm 包 `dsh-plugin-catalog` 读取 `plugins.json` / `index.json`
- 当前缓存有 **11744 条**条目
- 目录上游是 GitHub 仓库 `awesome-dsh-plugin/awesome-dsh-plugin`
- 目录包 README 明确写着 **"Published automatically; do not open pull requests here"**——不要给目录包开 PR，要去主仓库提交

**典型条目字段**（从缓存实测）：

```
name, owner, url, page, category, description{en,zh},
npm, version, stars, downloads, capabilities,
capabilityRedLines, install, added
```

按此格式，我们的条目大致是：

| 字段 | 值 |
|---|---|
| name | middle-earth-atlas |
| owner | naturalth2012 |
| url | https://github.com/naturalth2012/middle-earth-atlas |
| npm | @naturalth2012/middle-earth-atlas |
| category | docs（或 fun） |
| install | `dsh plugin --profile web add @naturalth2012/middle-earth-atlas` |

---

## 三、要完成的两步

### 步骤 1：发布 npm（需要你登录）

```bash
npm login --registry=https://registry.npmjs.org
npm publish --registry=https://registry.npmjs.org --access public
```

注意：
- scoped 包必须加 `--access public`
- 当前版本 1.0.0，npm 不允许覆盖同版本；重新发布前要 `npm version patch`
- 官方源必须显式指定（本机默认 registry 是国内镜像）

### 步骤 2：提交市场收录

到 `awesome-dsh-plugin/awesome-dsh-plugin` 按其贡献说明提交条目。该仓库当前从本机网络不可达，我无法核实它要求的是 issue 表单、YAML 文件还是其他格式；提交前需要你在能访问 GitHub 的环境里确认。

---

## 四、内容/IP 风险（需要你判断）

这是我认为最需要你慎重的一点：

1. **数据集是人工整理的导读资料**，不复制原著段落，但包含大量角色名、地名、以及标注为"原著精神（转述）"的短句。
2. `lore.js` 里有 40 条 QUOTES，其中部分是从电影/原著引用的短句。
3. 化身剧本是原创叙述 + 原作事实转述，并逐条标注了来源层级。

我在 LICENSE 里写了"非官方、非商业参考项目，版权归各自权利方"的声明，但这**不消除**市场审核或权利方提出异议的可能。

**建议**：提交前把这一情况如实写在市场条目的描述里（"非官方导读工具，不隶属任何权利方"），比隐藏更稳妥。

---

## 五、技术层面的准备度

- `npm pack --dry-run`：需重跑确认文件清单（当前 39 项 files 声明，实际打包 39 个文件 / 约 214 KB）
- 展示文案：DETAIL.md 里有完整中英文描述可直接用于市场条目
- 图标：icon.svg 是自绘的戒指图形，无第三方素材
- 能力声明：本插件无网络外发、无工作区文件写入。仅注册同源路由与工具，`capabilities` 可留空或填 `network`（保守起见）

---

## 六、我的判断

**可以提交，但要按顺序：**

1. 你先登录 npm 并授权我发布（或你自己执行 `npm publish`）
2. npm 发布成功后，我帮你准备市场条目的完整字段文本
3. 你到 awesome 仓库提交（或授权我在你网络可用时代办）

**不建议先做第 2 步**——多数市场目录要求 npm 包真实存在且可安装，先提交会被驳回。

---

## 七、需要你确认

1. 是否接受上述 IP 表述并提交？
2. 是否现在登录 npm 让我发布？
3. npm 用户名是否与 GitHub 一致（`naturalth2012`）？若不同，需要同步改包名。

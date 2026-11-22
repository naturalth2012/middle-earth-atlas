# 发布指南（GitHub → npm → DSH 市场）
> **更正（2026-11-22）**：npm 发布**不是**市场准入前提。
> 实测：三体宇宙没有 npm 包（registry 返回 404），但有 `market-entry.yml` 并走 GitHub 直装。
> 市场缓存中 5631/11744 条无 npm 字段，4428 条用 `github:` 安装命令。
> 因此按三体的 YAML 路径提交即可；npm 只是可选补充渠道。


本项目已经按可发布状态准备好：包名、许可证、关键词、引擎要求、`.gitignore` 都已就位。
下面三条路径按依赖顺序排列，每一步都可以独立完成。

---

## 一、推送到 GitHub

仓库已初始化并推送完成。以下命令仅供重建参考：

```bash
cd D:/DeepseekAPP/middle-earth-atlas

git init -b main
git add -A
git commit -m "feat: Middle-earth Atlas DSH plugin v1.0.0"

# 创建远程仓库并推送（gh 已登录 naturalth2012）
gh repo create naturalth2012/middle-earth-atlas --public --source=. --remote=origin --push
```

如果不想公开，把 `--public` 换成 `--private`。

**注意**：`gh repo create --source=. --push` 会在仓库已存在时失败；此时改用：

```bash
git remote add origin https://github.com/naturalth2012/middle-earth-atlas.git
git push -u origin main
```

推上去之后，仓库 URL 与 `package.json` 里写的地址一致，无需再改。

---

## 二、发布到 npm

市场索引读取的是 **npm 上的包**，所以这一步是进市场的前提。

当前 shell 里的 npm **没有登录**，且 registry 指向 `registry.npmmirror.com`（国内镜像）。
发布必须用官方源：

```bash
npm login --registry=https://registry.npmjs.org
npm publish --registry=https://registry.npmjs.org --access public
```

几个要点：

- **包名**：`@naturalth2012/middle-earth-atlas`，scoped 包必须加 `--access public`，否则默认私有、市场读不到。
- **`private: true` 已移除**，否则 npm 会拒绝发布。
- **版本号**：当前 `1.0.0`。每次重新发布前必须改版本（`npm version patch` 等），npm 不允许覆盖同版本。
- **发布前自检**（可选但推荐）：

  ```bash
  npm run check        # 3945 项数据/引擎校验 + 三个无浏览器渲染探针
  npm pack --dry-run   # 确认打包内容只含预期的 35 项文件声明
  ```

- 如果你的 npm 账号与 GitHub 用户名不同，需要同步改 `package.json` 里的 `name`、`author`、`repository`。

---

## 三、进入 DSH 市场（Discover）

核实到的机制是：市场不接收“上传”，而是读一份**公开的目录索引**。

- 索引来源：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>
- 网页目录：<https://awesome-dsh-plugin.com>
- 市场客户端从 npm 包 `dsh-plugin-catalog`（内含 `plugins.json` / `index.json`）或官网读取，条目里含 `name`、`owner`、`url`、`category`、`description{en,zh}`、`npm`、`version`、`install`、`capabilities` 等字段。
- 该索引由生产者脚本自动构建，目录包 README 明确写着 **"Published automatically; do not open pull requests here"**——意思是不要给 `dsh-plugin-catalog` 开 PR。

因此正确路径是：**到 `awesome-dsh-plugin/awesome-dsh-plugin` 主仓库按其贡献说明提交收录**（通常是一个 YAML/JSON 条目或 issue 表单）。提交时准备这些信息：

| 字段 | 建议填写 |
|---|---|
| `name` | `middle-earth-atlas` |
| `owner` | `naturalth2012` |
| `url` | `https://github.com/naturalth2012/middle-earth-atlas` |
| `npm` | `@naturalth2012/middle-earth-atlas` |
| `category` | `docs`（文档与渲染）或 `fun`（娱乐）——本项目偏知识库，`docs` 更贴切 |
| `description.en` | 见下方英文简介 |
| `description.zh` | 见下方中文简介 |
| `install` | `dsh plugin --profile web add @naturalth2012/middle-earth-atlas` |
| `capabilities` | 只需 `network`（本插件不发网络请求，仅在本机 serve 路由；若无网络调用可留空，由审核判定） |
| `icon` | 仓库内的 `icon.svg`（需是可公开访问的 URL，如 `raw.githubusercontent.com` 链接） |

**英文简介**（约 2 句，与 `package.json` 一致）：

> A canon-aware atlas of The Lord of the Rings: 55 characters with 202 curated relationships, an interactive relationship graph, a timeline across the Ages, places and artifacts, glossary and quotes, plot arcs, reading paths, and book-vs-screen differences. Explorable in a sidebar panel and through six agent tools.

**中文简介**：

> 把指环王原著、电影与剧集的人物、地点、宝物、术语和剧情整理成可交互的知识图谱：55 位角色、202 条关系、力导向关系图、跨纪元时间线、10 处改编差异，并在侧边栏面板与 6 个对话工具间共用同一套数据。

---

## 四、审查角度与已知边界（提交前请知悉）

审核和市场页面通常会关注以下几点，本项目的情况属实如下：

1. **数据来源未经在线核对**。构建环境的联网检索不可用，数据集基于广为人知的作品常识人工整理。所有条目都标注了来源层级（托尔金原著 / 电影改编 / 剧集演绎），但**没有逐条比对原书**。如果审核要求事实准确性背书，这一点需要如实说明，后续可以逐条校订。
2. **版权**。代码为 MIT。数据是原创编写的研究性摘要，不复制原作段落；但托尔金作品的角色名、地名与台词版权归权利方所有。`LICENSE` 里已写明这是非官方、非商业的参考项目。市场若对改编作品 IP 敏感，可能要求调整措辞或移除带引号的台词——`lore.js` 里的 `QUOTES` 是最可能被要求处理的部分。
3. **`capabilities`**。本插件不发外部网络请求，也不读写工作区文件；它只注册同源 HTTP 路由与 6 个工具。填 `network` 是保守起见，若审核认为是误报可以去掉。
4. **`engines.dsh`**。已声明 `>=0.2.2-rc.1`（与当前安装的版本对齐）。如果目标市场版本区间不同，需要调整，否则会被版本门槛拦住。

---

## 五、当前状态一览

| 项目 | 状态 |
|---|---|
| 本地插件 | ✅ 已安装并验证（23 条路由全通，12 个工具可用，3947 项自检通过） |
| 包规范 | ✅ 已改（包名、license、author、keywords、engines、repository） |
| `private` 字段 | ✅ 已移除 |
| LICENSE | ✅ MIT + 数据来源说明 |
| `.gitignore` | ✅ 已就位 |
| git 仓库 | ⬜ 未初始化（命令见第一节） |
| npm 登录 | ⬜ 未登录（命令见第二节） |
| npm 发布 | ⬜ 未发布 |
| 市场收录 | ⬜ 未提交 |

本地安装的插件目前仍以 `@local/middle-earth-atlas` 的名字挂在 profile 上（它是目录链接，改包名不影响已安装的实例）。如果要让本地实例也用新包名，重新执行一次 `remove_bundle` + `install_bundle` 即可。

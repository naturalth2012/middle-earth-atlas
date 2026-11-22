# DSH 市场发布脚本

> 在 **你完成 npm 登录之后**执行本脚本。
> 本脚本只做发布，不做任何仓库或代码改动。

---

## 第 0 步：登录（需要你本人执行）

```powershell
npm login --registry=https://registry.npmjs.org
```

按提示输入 npm 用户名、密码、邮箱、OTP。登录成功后验证：

```powershell
npm whoami --registry=https://registry.npmjs.org
```

应输出 `naturalth2012`（或你的 npm 用户名）。

> **如果 npm 用户名不是 `naturalth2012`**：先改 `package.json` 的 `name` 为 `@你的用户名/middle-earth-atlas`、`author`、`repository`，再继续。否则安装包名与 scope 不匹配。

---

## 第 1 步：发布前检查

```powershell
cd D:/DeepseekAPP/middle-earth-atlas
npm run check
npm pack --dry-run
```

预期：`All 3945 checks passed`、37 个文件、约 205 KB。

---

## 第 2 步：发布到 npm

```powershell
npm publish --registry=https://registry.npmjs.org --access public
```

注意：
- scoped 包必须加 `--access public`
- 版本 1.0.0 只允许发布一次；若失败后要重发，先 `npm version patch`
- 发布后可用 `npm view @naturalth2012/middle-earth-atlas version` 验证

---

## 第 3 步：提交市场收录

到 `https://github.com/awesome-dsh-plugin/awesome-dsh-plugin` 按其贡献说明提交条目。

条目内容见 [docs/MARKET-ENTRY.md](MARKET-ENTRY.md)。

**不要**给 `dsh-plugin-catalog` 开 PR——那个包的 README 明确写着自动发布、不接受 PR。

---

## 发布后验证

```powershell
# 1. npm 包可安装
npm view @naturalth2012/middle-earth-atlas version

# 2. 从包元数据确认展示资源
npm view @naturalth2012/middle-earth-atlas repository.url
npm view @naturalth2012/middle-earth-atlas engines

# 3. 在另一台机器或干净 profile 试装（可选）
dsh plugin --profile web add @naturalth2012/middle-earth-atlas
```

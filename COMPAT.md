# dsh 运行时兼容性核查记录

本文件记录 `dsh-usage-billing` 对 DeepSeek Harness（dsh）各版本的兼容性核查结论，
以及可复现的核查方法。每次 dsh 升级后按「核查清单」跑一遍即可。

> 结论先行：从 `0.1.2-alpha.1` 到 `0.2.2-rc.1` 均兼容；其中 3 次升级需要插件侧修复，
> 已分别发布在 0.8.1 / 0.9.4 / 0.9.5 / 0.9.6。

## 核查方法（可复现）

```powershell
# 1. 运行时版本与安装位置
dsh --version
Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Directory | ForEach-Object {
  $p = Join-Path $_.FullName 'node_modules\@deepseek-ai\dsh\package.json'
  if (Test-Path $p) { "$($_.Name) -> $((Get-Content $p -Raw | ConvertFrom-Json).version)" }
}

# 2. 宿主半是否真的加载（路由 200 = 已挂载并在记账）
Invoke-WebRequest 'http://127.0.0.1:3080/usage-billing' -UseBasicParsing -SkipHttpErrorCheck

# 3. 运行时契约（无需读源码，直接问宿主/客户端）
#    cordis_inspect_query: host Service / host Event / client Service / client Slots / client Theme
#    cordis_inspect_query: host Tool（确认 usage_billing 已注册）

# 4. 版本闸门（复刻 dsh-app-boot evaluatePluginCompatibility）
node -e "const s=require('<npx>/node_modules/semver'); /* 用 package.json 的 peerDependencies 逐条 satisfies(includePrerelease) */"

# 5. 自身回归
node --check lib\client.js; node --check lib\index.js
node test\compat-0.1.6.mjs   # 客户端服务形态/回退
node test\dock-open.mjs      # 面板打开链路（含 portal 断言）
node test\dock-render.mjs    # 渲染冒烟
```

判据：路由 200 + `usage_billing` 出现在 host Tool 目录 + 当日 `byDay` 有新条目，
三者同时成立才算「宿主半真的在工作」；仅「插件未报错」不足以证明。

## 版本矩阵

| dsh 版本 | 结果 | 说明 / 插件动作 |
| --- | --- | --- |
| 0.1.2-alpha.1 ~ 0.1.5-rc.1 | 兼容 | 基线 |
| 0.1.6-alpha.2 | **需修复** | 移除 `sessions.open` 与 `sessions.list.current`；改为 `uiWorkspace.openSession` + `uiWorkspace.selection`，旧运行时自动回退 → **0.8.1** |
| 0.1.7-alpha.1 | **需修复** | `--dsw-specific-menu` 变为带 alpha 色（`#f8f9fa94`），官方面板配 `backdrop-filter`；补同款 `backdrop-filter` → **0.9.4** |
| 0.2.0-rc.1 | **需修复** | 开始强制校验 `peerDependencies`（`^0.1.0-rc.6` 上界 < 0.2.0 被拦）；逐项核实 API 后放宽为 `>=0.1.0-rc.6 <0.3.0-0` → **0.9.5**。同时该版本重装 profile 会丢掉 `cordis.patch.yml` 的挂载行，需补回 |
| 0.2.1-alpha.1 | 兼容 | 无需改动 |
| 0.2.2-alpha.3 | 兼容 | `container-type` 与 portal 契约已存在（非新增） |
| **0.2.2-rc.1** | 兼容（API 层），**面板定位需修复** | 见下节；补 portal → **0.9.6** |

## 0.2.2-rc.1 详细核对

核查日期：2026-11-05 ~ 11-06；运行时 `0.2.2-rc.1`；插件 v0.9.5（修复后 0.9.6）。

活体证据：`/usage-billing` → 200（累计 5957 次 / ¥159.69，当日 363 次 / ¥26.49）；
`usage_billing` 在 host Tool 目录中；`meta.schemaVersion = 10`。

### Host 面（`cordis_inspect_query` host Service / Event）

| 依赖 | 状态 |
| --- | --- |
| `fs`（`resolve`/`stat`/`readText`/`listDir`/`writeText`/`editText`） | 不变（新增 `watch`/`patchText`/`deleteFile`/`moveFile`，未使用） |
| `sandboxPolicy`（`workspaceRoot`/`resolve`） | 不变（新增 `additionalWritableRoots`） |
| `sessionQuery`（`listSessions`/`readSession`/`readTitle`） | 不变 |
| `webServer.register` | 不变（形参放宽为 `WebRoute \| WebResourceRoute`） |
| `tools.register(definition, options?)` | 不变（`schemas`/`execute` 改了，未使用） |
| `credentials` / `agents.currentInitiator` / `timer` | 不变 |
| `llm/stream` waterfall | 不变（`this: LlmRuntime, options, next`） |
| `TokenUsage` 字段 | 不变（`inputTokens`/`outputTokens`/`cacheReadTokens?`/`cacheWriteTokens?`） |
| `defineTool`（dsh-tools 0.2.2-rc.1） | 存在，契约一致（新增 `deferLoading`/`projectContent` 可选） |

本版与插件无关的改动：新增 `actionCards`/`translator`/`cotTranslation`/`worktrees`/
`workingDirectory`/`webApp`/`cuaAccess`/`forge`；移除事件 `agent/request`、
`settings/updated`；`tools` 移除 `presentAs`/`executionMode`。

### Client 面

| 依赖 | 状态 |
| --- | --- |
| `locale.register/bind` | 不变 |
| `sessions.list` 快照 store | 仍在（`SessionListState` 自 0.1.6 起无 `current`，已有回退） |
| `uiWorkspace.openSession` + `selection` store | 不变 |
| `slots.inject/register`、`__ModuleLoader__`、`dsh.client` 清单 | 不变 |
| 4 个挂载点 | 全部在：`conversation.composer.dock` / `sidebar.footer.action` / `shell.overlay` / `settings.section` |
| 主题 token | `--dsw-specific-menu`（现间接引用 `--dsw-menu-surface-fill`）、`--dsw-menu-backdrop-filter`、`--dsw-elevation-prominent`、`--dsw-alias-bg-layer-1` 全在 |

### 本版导致的面板缺陷（0.9.6 修复）

官方在 `conversation.composer.dock` 的 Slot 契约中写明：

> fixed overlays must portal to the document body because the docked composer contains them

对应 CSS：会话激活态下 `.composerSeat` 带 `will-change: transform`
（`[data-phase=active]` 时生效），会为 fixed 后代创建包含块。我们的详情面板原先就地渲染在
dock 内，视口坐标被按该祖先解释，结果**掉到屏幕下方并被裁切**（用户截图证实）。

修复：`require("react-dom").createPortal(panel, document.body)`，`require` 用 try/catch
包裹，取不到时回退就地渲染；同时给面板加 `max-height: calc(100vh - 24px)` + 滚动。

> 注：动态 cordis 插件（`cordis_run`）确实拿不到 `react-dom`（closure traps），但本包是
> `dsh.client` 的 ModuleLoader bundle，`require` 面与官方 `ui-conversation` 相同，可以使用。

## 已知注意事项

1. **peer 上界**：当前 `>=0.1.0-rc.6 <0.3.0-0`。dsh 发布 0.3.x 时必须先核查再放宽，否则会被闸门拦下。
2. **profile 重建会丢挂载行**：重装/重建 profile 后若面板消失、路由 404，先检查
   `~/.dsh/profiles/<profile>/cordis.patch.yml` 是否还有：
   ```yaml
   - insert:
       - id: usage-billing
         name: 'dsh-usage-billing'
   ```
3. **link: 安装的 junction 与机器绑定**，换机需重建（npm 安装无此问题）。
4. **面板定位依赖 portal**：若后续改动去掉 `createPortal`，需同时确认 `composerSeat`
   的 `will-change` 是否仍存在。

## 核查清单（每次 dsh 升级后）

- [ ] `dsh --version` 与 npx 缓存里的版本一致
- [ ] `/usage-billing` 返回 200，且 `byDay` 有当日条目（证明 `llm/stream` 仍在记账）
- [ ] `usage_billing` 仍注册为可调用 Tool
- [ ] host：`fs` / `sandboxPolicy` / `sessionQuery` / `webServer` / `tools` / `credentials` / `agents` / `timer` 签名
- [ ] host 事件：`llm/stream` waterfall + `StreamChunk.usage` 形状
- [ ] client：`locale` / `sessions.list` / `uiWorkspace` / `slots` + 4 个挂载点
- [ ] 主题 token：菜单底色、backdrop-filter、elevation、layer-1
- [ ] peer 闸门模拟（含下一个大版本的 prerelease）
- [ ] `node --check` + 三个测试脚本
- [ ] 手动：开一次详情面板，确认出现在触发器上方而不是屏幕外

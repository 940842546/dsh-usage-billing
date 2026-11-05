# 待办与优化清单

按「正确性 → 性能 → 功能」排序。每项都附了当前代码里的证据，便于直接动手。
已完成项列在文末。

## P0 · 正确性

### 1. 会话详情面板的「时段花费 / 模型用量」数据失真

**现象**：面板里这两节只统计 `stats.recent`（最多 50 条）中属于本会话的调用，
而会话可能已有上千次调用，导致分布严重偏离。用户截图里 1642 次调用的会话只显示
「9/10后 · 空闲」一行，即为佐证。

**证据**：
- `lib/client.js` `SessionDetailPanel`：`const recents = (s.recent || []).filter(r => r.sessionId === sessionId)`
- `lib/index.js` `recordUsage`：`if (stats.recent.length > 50) stats.recent.length = 50`

**修法**（推荐）：
1. `sessionBucket()` 增加 `byBand: {}`、`byModel: {}`，`recordUsage` 内按 band/model 累加 `{calls, cost}`；
2. `GET /usage-billing?detail=<sessionId>` 时按需附带该会话的 `byBand`/`byModel`（避免所有会话都下发导致 payload 膨胀）；
3. 客户端 `useStatsData` 支持 detail 参数，面板优先用精确数据，缺失时回退当前实现；
4. 老数据没有这两个字段：可 `schemaVersion` +1 触发一次回填重建（从会话日志可完整重建），或在面板上标注「仅统计升级后」。

**风险**：middle（涉及数据文件结构与重建），建议单独发版并先备份 `.dsh-usage-billing.json`。

## P1 · 性能

### 2. 合并轮询 + 条件请求（ETag/304）

**现状**（实测）：`/usage-billing` 单次响应 **50 KB**，未压缩；
常驻两个组件各自轮询同一 URL（`DockReadout` 10s、`FooterButton` 10s；
`OverlayPanel` 打开时 5s）→ 约 **36 MB/小时** 的 JSON 传输与解析。

**修法**：
- 客户端：模块级单例 store + 订阅（一次轮询，多处消费），顺带消除多组件快照不一致；
- 宿主：响应加 `ETag`（可用 `stats.updatedAt` + `meta.schemaVersion` 生成），
  处理 `If-None-Match` 命中返回 `304`（无 body）。轮询绝大多数请求将变成 304。

**收益**：常驻流量下降 ~99%；解析开销与 GC 同步下降。

### 3. payload 瘦身

`bySession` 无保留策略，随会话数线性增长（当前 83 条，其中大量是历史/子会话）。
可只下发按花费 Top N（面板与表格最多用到 50）+ 会话总数，其余留档在磁盘。

## P1 · 功能

### 4. 非 DeepSeek 模型计价（收益最大）

**现状**：模型按名称归类为 `flash`/`pro`/`other`，`other` 的价格表恒为 0。
用户实际大量使用 glm / grok / hy4 等模型，这些调用**完全不计费**：
`byDay` 里 2026-10-20（538 次）、10-17（307 次）等 cost 均为 0，
而 11-05（363 次）因含 DeepSeek 调用才是 ¥26.49。

**修法**：配置增加 `customModels: [{ match: 'glm', currency: 'cny', hit, miss, out }]`，
`classifyModel` 命中时用该价目表（否则仍归 `other` 计 0）。
设置页给一个可增删的小表格；导出与面板自动生效。

**注意**：不同厂商计价单位不同（USD 或 CNY/百万 tokens），需要 `currency` 字段并在汇总时按汇率折算。

## P2 · 功能增强

- **5. 月度预算预测**：本月已用 / 已过天数 × 月天数，显示预计月底花费并与预算对比（超支提前预警）。
- **6. 花费异常提醒**：单日花费超过近 7 日均值 N 倍时提示（阈值可配），复用现有 toast 通道。
- **7. `usage_billing` 工具扩展**：增加 `session`（按会话）、`byModel`、`top` 参数，方便 agent 直接回答「这个会话花了多少 / 哪个模型最贵」。
- **8. 余额低阈值提醒**：已有 runway 估算，可加「余额 < X 元」的主动提示。

## P3 · 长期

- **9. 时区可配置**：当前所有计费时段固定按北京时间（+8）；对非中国区用户会错位。
- **10. `bySession` 膨胀治理**：可选保留窗口（如仅保留近 365 天有活动的会话）或归档到单独文件。
- **11. 2027 节假日名单**：国务院一般 11 月公布；设置页「非高峰日」已可手工增补，公布后一并内置。
- **12. 面板内容可折叠**：让用户隐藏「时段花费 / 模型用量」小节，缩短面板高度。

## 已完成

- **0.9.7** 视觉与可访问性打磨：语义色/阴影/圆角全部走宿主 token（明暗主题一致）、`focus-visible` 焦点环、
  面板入场动画 + `prefers-reduced-motion`、中文 token 单位改为「万/亿」、清理死 CSS。
- **0.9.6** 面板掉到屏幕下方：`react-dom` portal 到 `document.body`（输入框祖先 `will-change: transform` 造成包含块）+ 面板高度钳制与滚动 + 无 portal 时的 offsetParent 坐标补偿。
- **0.9.3** 缓存命中率算错（把缓存算了两次，`hit/(input+hit)` → `hit/input`）。
- **0.9.1** 双 `¥`（模板字面量 + 格式化函数重复带符号）。
- **0.9.0 / 0.9.1** 输入框下方会话行可点开详情面板（环形预算进度、分段条、明细行、Esc/外点关闭）。
- **0.8.1** dsh 0.1.6 兼容：`sessions.open`/`current` 移除 → `uiWorkspace`。
- **0.8.0** 法定节假日与调休上班日全天空闲计费（内置 2026 国务院安排，可编辑）。
- **0.7.x** 峰谷时段、9/10 flash 调价、V4 Pro 路由开关、预算告警、余额、导出、热力图、i18n。

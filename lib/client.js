window.__ModuleLoader__.load({
	id: "dsh-usage-billing",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		const EMPTY_BUCKET = { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 };

		// ---------- i18n：跟随应用语言设置 ----------
		const DICTS = {
			zh: {
				'band.before': '调价前 · 旧价',
				'band.afterPeak': '调价后 · 高峰',
				'band.afterOffPeak': '调价后 · 空闲',
				'model.other': '其他模型',
				'common.unknown': '未知',
				'common.detail': '：{msg}',
				'hm.less': '少',
				'hm.more': '多',
				'hm.noData': '暂无数据',
				'hm.noHourData': '暂无该小时数据',
				'hm.hourBackfill': '小时级数据将在宿主重启后自动回填',
				'hm.allTruncated': '累计仅显示最近 730 天',
				'range.day': '日',
				'range.week': '周',
				'range.month': '月',
				'range.year': '年',
				'range.all': '累计',
				'dock.used': '本会话已用',
				'dock.calls': '次调用',
				'dock.in': '输入',
				'dock.out': '输出',
				'fab.label': '用量',
				'fab.labelOpen': '用量 ▲',
				'fab.tooltip': '用量统计（全机汇总）',
				'fab.closeTooltip': '关闭用量统计面板',
				'card.title': 'Token 用量',
				'card.session': '本会话',
				'card.all': '累计',
				'card.tooltip': '查看用量与费用统计',
				'card.closeTooltip': '关闭用量与费用统计',
				'ov.title': 'Token 用量与费用统计',
				'ov.close': '关闭',
				'ov.loading': '加载中…',
				'ov.cny': '¥ CNY',
				'ov.usd': '$ USD',
				'ov.note': '按 DeepSeek 官方定价计费（元/百万 tokens），区分 2026-08-17 调价前后及高峰/空闲时段（高峰为工作日 9:00–12:00、14:00–18:00，周末全天空闲），仅统计已定价模型；汇率可在设置中修改。',
				'ov.sessions': '总会话数',
				'ov.totalTokens': '总 Token',
				'ov.uncached': '输入（未缓存）',
				'ov.cached': '缓存读取',
				'ov.output': '输出',
				'ov.cost': '估算费用',
				'ov.bandSection': '计费分段占比',
				'ov.heatmapSection': '用量热力图',
				'ov.modelSection': '按模型统计',
				'ov.sessionSection': '按会话统计',
				'ov.free': '未定价/免费',
				'ov.updatedAt': '更新于 {time}',
				'ov.moreSections': '计费分段占比 · 用量热力图',
				'ov.sessionMore': '共 {total} 个会话 · 按费用显示前 {shown} 个',
				'ov.openSession': '打开该会话',
				'th.updated': '最近活动',
				'ov.footerHint': '完整明细与按日统计见 设置 → 用量统计',
				'th.model': '模型',
				'th.calls': '调用次数',
				'th.title': '会话 / 标题',
				'set.sectionLabel': '用量统计',
				'set.title': '用量 · 消费统计',
				'set.backfilling': '回填中…',
				'set.backfill': '回填历史',
				'set.refresh': '刷新',
				'set.clear': '清空',
				'set.confirmClear': '再点一次确认清空',
				'set.loadFailed': '加载失败',
				'set.backfillDone': '已回填历史：扫描 {sessions} 个会话，找到 {found} 条调用记录',
				'set.backfillFailed': '回填失败',
				'set.clearDone': '已清空统计',
				'set.clearFailed': '清空失败',
				'set.unknownError': '未知错误',
				'set.totalCost': '总费用',
				'set.calls': '调用次数',
				'set.callsSub': '按北京时间分段计费',
				'set.inputTokens': '输入 tokens',
				'set.inputSub': '命中 {hit} / 未命中 {miss}',
				'set.outputTokens': '输出 tokens',
				'set.outputSub': '含思考输出',
				'set.bandSection': '计费分段占比',
				'set.heatmapSection': '用量热力图',
				'set.sessionSection': '按会话消费（Top 8 · 共 {n} 个会话）',
				'set.modelSection': '按模型',
				'set.recentSection': '最近调用',
				'set.time': '时间',
				'set.model': '模型',
				'set.band': '时段',
				'set.input': '输入',
				'set.output': '输出',
				'set.cost': '费用',
				'set.noRecent': '暂无调用记录',
				'set.backfilledNote': '已回填历史：扫描 {sessions} 个会话 · 共 {found} 条记录',
				'set.backfillHint': '仅统计插件启用后的调用，点击「回填历史」扫描所有会话日志',
				'set.persistError': '⚠ 持久化失败：{error}（统计仅保存在内存，插件重启会丢失）',
				'set.persistFile': '数据持久化：{file}',
				'set.persistMemory': '数据仅保存在内存',
				'set.pricingSummary': '计费规则（元 / 百万 tokens）',
				'set.pricingNote': '调价边界：{date}（北京时间）；高峰 {p1}、{p2}（北京时间）',
				'set.hit': '命中',
				'set.miss': '未命中',
				'cell.in': '输入',
				'cell.out': '输出',
				'cell.calls': '次调用',
				'bar.calls': '次',
				'bar.in': '输入',
				'bar.out': '输出',
				'budget.daily': '今日预算',
				'budget.monthly': '本月预算',
				'budget.over': '已超支',
				'budget.unlimited': '未设预算',
				'cfg.title': '计费与预算设置',
				'cfg.budgetSection': '预算（元，留空 = 不限）',
				'cfg.balanceEnabled': '启用官方余额拉取',
				'cfg.daily': '日预算',
				'cfg.monthly': '月预算',
				'cfg.boundary': '调价边界日期',
				'cfg.peakHours': '高峰时段（起/止 × 2，0–24）',
				'cfg.priceTable': '价格表（元 / 百万 tokens）',
				'cfg.save': '保存',
				'cfg.saved': '已保存',
				'cfg.reset': '恢复默认',
				'cfg.saveFailed': '保存失败',
				'export.csvDay': '导出 CSV（按日）',
				'export.csvSession': '导出 CSV（按会话）',
				'export.json': '导出 JSON',
				'balance.title': '账户余额',
				'balance.total': '总余额',
				'balance.toppedUp': '充值',
				'balance.granted': '赠金',
				'balance.unavailable': '余额不可用',
				'balance.unconfigured': '未检测到 DeepSeek API Key，无法拉取余额',
				'balance.error': '余额拉取失败',
				'balance.loading': '拉取中…',
				'balance.disabled': '官方余额拉取已关闭',
				'boundary.error': '用量统计面板渲染出错',
				'alert.near': '{which}已用 {pct}%，接近预算',
				'alert.over': '{which}已超支：¥{spent} / ¥{limit}',
				'trend.title': '近 30 天每日费用',
				'cfg.usdCny': '美元汇率（1 USD = ? CNY）',
				'balance.refresh': '刷新余额',
			},
			en: {
				'band.before': 'Pre-change · legacy',
				'band.afterPeak': 'Post-change · peak',
				'band.afterOffPeak': 'Post-change · off-peak',
				'model.other': 'Other models',
				'common.unknown': 'unknown',
				'common.detail': ': {msg}',
				'hm.less': 'less',
				'hm.more': 'more',
				'hm.noData': 'No data',
				'hm.noHourData': 'No data for this hour',
				'hm.hourBackfill': 'Hourly data is backfilled after the host restarts',
				'hm.allTruncated': 'All-time view shows the last 730 days only',
				'range.day': 'Day',
				'range.week': 'Week',
				'range.month': 'Month',
				'range.year': 'Year',
				'range.all': 'All',
				'dock.used': 'This session',
				'dock.calls': 'calls',
				'dock.in': 'in',
				'dock.out': 'out',
				'fab.label': 'Usage',
				'fab.labelOpen': 'Usage ▲',
				'fab.tooltip': 'Usage stats (all sessions)',
				'fab.closeTooltip': 'Close usage panel',
				'card.title': 'Token Usage',
				'card.session': 'This session',
				'card.all': 'All sessions',
				'card.tooltip': 'View usage & cost stats',
				'card.closeTooltip': 'Close usage & cost stats',
				'ov.title': 'Token Usage & Cost Stats',
				'ov.close': 'Close',
				'ov.loading': 'Loading…',
				'ov.cny': '¥ CNY',
				'ov.usd': '$ USD',
				'ov.note': 'Priced with official DeepSeek rates (CNY / 1M tokens) across the pre/post 2026-08-17 bands; peak = weekdays 9:00–12:00 & 14:00–18:00 (Beijing time), weekends are off-peak. Priced models only. USD rate is configurable in settings.',
				'ov.sessions': 'Sessions',
				'ov.totalTokens': 'Total tokens',
				'ov.uncached': 'Input (uncached)',
				'ov.cached': 'Cache read',
				'ov.output': 'Output',
				'ov.cost': 'Est. cost',
				'ov.bandSection': 'Cost by pricing band',
				'ov.heatmapSection': 'Usage heatmap',
				'ov.modelSection': 'By model',
				'ov.sessionSection': 'By session',
				'ov.free': 'Unpriced / free',
				'ov.updatedAt': 'Updated {time}',
				'ov.moreSections': 'Billing segments · Usage heatmap',
				'ov.sessionMore': '{total} sessions · showing top {shown} by cost',
				'ov.openSession': 'Open session',
				'th.updated': 'Last activity',
				'ov.footerHint': 'Full details in Settings → Usage Stats',
				'th.model': 'Model',
				'th.calls': 'Calls',
				'th.title': 'Session / Title',
				'set.sectionLabel': 'Usage Stats',
				'set.title': 'Usage & Cost Stats',
				'set.backfilling': 'Backfilling…',
				'set.backfill': 'Backfill history',
				'set.refresh': 'Refresh',
				'set.clear': 'Clear',
				'set.confirmClear': 'Click again to confirm',
				'set.loadFailed': 'Load failed',
				'set.backfillDone': 'Backfilled: scanned {sessions} sessions, found {found} calls',
				'set.backfillFailed': 'Backfill failed',
				'set.clearDone': 'Stats cleared',
				'set.clearFailed': 'Clear failed',
				'set.unknownError': 'Unknown error',
				'set.totalCost': 'Total cost',
				'set.calls': 'Calls',
				'set.callsSub': 'Priced in Beijing time bands',
				'set.inputTokens': 'Input tokens',
				'set.inputSub': 'hit {hit} / miss {miss}',
				'set.outputTokens': 'Output tokens',
				'set.outputSub': 'Including thinking output',
				'set.bandSection': 'Cost by pricing band',
				'set.heatmapSection': 'Usage heatmap',
				'set.sessionSection': 'By session (Top 8 · {n} sessions)',
				'set.modelSection': 'By model',
				'set.recentSection': 'Recent calls',
				'set.time': 'Time',
				'set.model': 'Model',
				'set.band': 'Band',
				'set.input': 'Input',
				'set.output': 'Output',
				'set.cost': 'Cost',
				'set.noRecent': 'No calls recorded yet',
				'set.backfilledNote': 'Backfilled: {sessions} sessions scanned · {found} records',
				'set.backfillHint': 'Only calls made while the plugin is enabled; click "Backfill history" to scan all session logs',
				'set.persistError': '⚠ Persistence failed: {error} (stats are memory-only and lost on restart)',
				'set.persistFile': 'Persisted to: {file}',
				'set.persistMemory': 'Stats are memory-only',
				'set.pricingSummary': 'Pricing rules (CNY / million tokens)',
				'set.pricingNote': 'Pricing boundary: {date} (Beijing time); peak {p1}, {p2} (Beijing time)',
				'set.hit': 'Hit',
				'set.miss': 'Miss',
				'cell.in': 'In',
				'cell.out': 'Out',
				'cell.calls': 'calls',
				'bar.calls': 'calls',
				'bar.in': 'in',
				'bar.out': 'out',
				'budget.daily': 'Daily budget',
				'budget.monthly': 'Monthly budget',
				'budget.over': 'Over budget',
				'budget.unlimited': 'No budget set',
				'cfg.title': 'Pricing & budget',
				'cfg.budgetSection': 'Budget (CNY, empty = unlimited)',
				'cfg.balanceEnabled': 'Enable official balance fetch',
				'cfg.daily': 'Daily',
				'cfg.monthly': 'Monthly',
				'cfg.boundary': 'Pricing boundary date',
				'cfg.peakHours': 'Peak hours (start/end × 2, 0–24)',
				'cfg.priceTable': 'Price table (CNY / million tokens)',
				'cfg.save': 'Save',
				'cfg.saved': 'Saved',
				'cfg.reset': 'Reset defaults',
				'cfg.saveFailed': 'Save failed',
				'export.csvDay': 'Export CSV (daily)',
				'export.csvSession': 'Export CSV (sessions)',
				'export.json': 'Export JSON',
				'balance.title': 'Account balance',
				'balance.total': 'Total',
				'balance.toppedUp': 'Topped up',
				'balance.granted': 'Granted',
				'balance.unavailable': 'Balance unavailable',
				'balance.unconfigured': 'No DeepSeek API key configured; balance unavailable',
				'balance.error': 'Balance fetch failed',
				'balance.loading': 'Fetching…',
				'balance.disabled': 'Official balance fetch is off',
				'boundary.error': 'Usage stats panel failed to render',
				'alert.near': '{which} at {pct}% of budget',
				'alert.over': '{which} over budget: ¥{spent} / ¥{limit}',
				'trend.title': 'Daily cost · last 30 days',
				'cfg.usdCny': 'USD rate (1 USD = ? CNY)',
				'balance.refresh': 'Refresh balance',
			},
		};

		function makeTranslate(dict) {
			return (key, params) => {
				const template = typeof dict[key] === 'string' ? dict[key] : key;
				if (!params) return template;
				return template.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
			};
		}

		// 挂载时由 apply() 绑定到 locale 服务；无 locale 服务时退化为 zh 词典
		let T = makeTranslate(DICTS.zh);
		let LOCALE = null;
		let SESSIONS = null;

		function bandLabel(bk) {
			const key = 'band.' + bk;
			const label = T(key);
			return label === key ? bk : label;
		}
		function modelLabel(mk) {
			if (mk === 'other') return T('model.other');
			if (mk === 'flash') return 'deepseek-v4-flash';
			if (mk === 'pro') return 'deepseek-v4-pro';
			return mk;
		}

		// 语言切换时触发根组件重渲染（T 在调用时读取当前语言）
		function useLocaleTick() {
			const [, force] = react.useState(0);
			react.useEffect(() => {
				if (!LOCALE) return;
				return LOCALE.subscribe(() => force((v) => v + 1));
			}, []);
		}

		const BAND_KEYS = ['before', 'afterPeak', 'afterOffPeak'];
		const MODEL_KEYS = ['flash', 'pro'];

		function fmtTokens(n) {
			n = Math.round(n);
			if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
			if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
			return String(n);
		}

		function fmtCost(n) { return '¥' + Number(n).toFixed(4); }

		function fmtCostShort(n) {
			const v = Number(n);
			return '¥' + (v >= 10 ? v.toFixed(2) : v.toFixed(v >= 1 ? 3 : 4));
		}

		function fmtCost2(n) { const v = Number(n) || 0; return '¥' + v.toFixed(2); }

		function fmtNum(n) {
			const v = Math.round(Number(n) || 0);
			return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		}

		const CUR_KEY = 'dsh-usage-billing.currency';
		// 默认汇率（与宿主 defaultConfig 一致）；实际值从 /usage-stats 的 config.usdCny 读取，可在设置中修改
		const DEFAULT_USD_CNY = 6.7878;
		/** 用当前汇率构造格式化函数（消除渲染期对模块全局的依赖） */
		function moneyFormatter(cur, usdCny) {
			const rate = Number(usdCny) > 0 ? Number(usdCny) : DEFAULT_USD_CNY;
			return (n) => {
				const v = Number(n) || 0;
				return cur === 'usd' ? '$' + (v / rate).toFixed(4) : '¥' + v.toFixed(4);
			};
		}

		function fmtTime(ts) {
			const n = Number(ts) || 0;
			if (n <= 0) return '—';
			const d = new Date(n + 8 * 3600 * 1000);
			const p = (x) => (x < 10 ? '0' + x : String(x));
			return p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
		}

		function fmtDateTime(ts) {
			const n = Number(ts) || 0;
			if (n <= 0) return '—';
			const d = new Date(n + 8 * 3600 * 1000);
			const p = (x) => (x < 10 ? '0' + x : String(x));
			const now = new Date(Date.now() + 8 * 3600 * 1000);
			const date = (d.getUTCFullYear() === now.getUTCFullYear() ? '' : d.getUTCFullYear() + '-') + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
			return date + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
		}

		function shortId(id) {
			if (typeof id !== 'string') return T('common.unknown');
			return id.length > 8 ? id.slice(0, 8) : id;
		}

		function el(type, props, ...children) {
			return react.createElement(type, props || null, ...children);
		}

		const CSS = `
.usg-panel { display: flex; flex-direction: column; gap: 12px; padding: 4px 2px 12px; font-size: 13px; color: var(--dsw-alias-label-primary); }
.usg-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.usg-title { font-weight: 600; font-size: 14px; }
.usg-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.usg-btn { padding: 4px 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; }
.usg-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.usg-btn:disabled { opacity: 0.55; cursor: default; }
.usg-danger { background: var(--dsw-alias-state-error-primary); color: #fff; border-color: transparent; }
.usg-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.usg-card { padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.usg-card-label { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.usg-card-value { font-weight: 700; font-size: 16px; white-space: nowrap; }
.usg-card-value.usg-cost { color: #60a5fa; font-size: 18px; }
.usg-card-sub { font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.usg-section { font-weight: 600; }
.usg-band-stack { display: flex; height: 14px; border-radius: 7px; overflow: hidden; border: 1px solid var(--dsw-alias-border-l1); }
.usg-band-seg { height: 100%; min-width: 2px; }
.usg-seg-before { background: #94a3b8; }
.usg-seg-afterPeak { background: #3b82f6; }
.usg-seg-afterOffPeak { background: #93c5fd; }
.usg-band-legend { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 4px; }
.usg-legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.usg-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.usg-hm-wrap { display: flex; flex-direction: column; gap: 6px; padding: 10px 2px 2px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.usg-hm-scroll { overflow-x: auto; overflow-y: hidden; max-width: 100%; flex: 1 1 0; min-width: 0; }
.usg-hm { display: flex; gap: 8px; align-items: flex-start; }
.usg-hm-labels { display: grid; grid-template-rows: repeat(7, 12px); row-gap: 3px; font-size: 9px; color: var(--dsw-alias-label-secondary); }
.usg-hm-label { display: flex; align-items: center; height: 12px; }
.usg-hm-grid { display: flex; gap: 3px; }
.usg-hm-col { display: grid; grid-template-rows: repeat(7, 12px); row-gap: 3px; }
.usg-hm-cell { width: 12px; height: 12px; border-radius: 2px; background: rgba(148, 163, 184, 0.14); box-sizing: border-box; }
.usg-hm-cell.usg-hm-1 { background: rgba(96, 165, 250, 0.3); }
.usg-hm-cell.usg-hm-2 { background: rgba(96, 165, 250, 0.55); }
.usg-hm-cell.usg-hm-3 { background: rgba(59, 130, 246, 0.8); }
.usg-hm-cell.usg-hm-4 { background: #3b82f6; }
.usg-hm-cell.usg-hm-pad { visibility: hidden; }
.usg-hm-legend { display: flex; align-items: center; justify-content: flex-end; gap: 4px; font-size: 10px; color: var(--dsw-alias-label-secondary); }
.usg-range { display: inline-flex; gap: 2px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 2px; }
.usg-range-btn { border: none; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 3px 10px; border-radius: 6px; cursor: pointer; font-family: inherit; }
.usg-range-btn:hover { color: var(--dsw-alias-label-primary); }
.usg-range-on { background: #60a5fa; color: #fff !important; }
.usg-tip { position: fixed; z-index: 99999; pointer-events: none; max-width: 280px; background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1)); border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; padding: 6px 9px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-primary); box-shadow: 0 4px 14px rgba(0,0,0,0.18); white-space: pre-line; word-break: break-all; }
.usg-sbars { display: flex; flex-direction: column; gap: 8px; }
.usg-sbar-row { display: flex; flex-direction: column; gap: 3px; }
.usg-sbar-head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.usg-sbar-title { font-size: 12px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usg-sbar-value { font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.usg-sbar-track { height: 8px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); overflow: hidden; }
.usg-sbar-fill { height: 100%; border-radius: 4px; background: #60a5fa; opacity: 0.85; }
.usg-model-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; }
.usg-model-name { font-weight: 600; white-space: nowrap; }
.usg-model-cost { font-weight: 600; white-space: nowrap; }
.usg-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.usg-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.usg-table th, .usg-table td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.usg-table th { color: var(--dsw-alias-label-secondary); font-weight: 500; }
.usg-num { text-align: right !important; font-variant-numeric: tabular-nums; }
.usg-strong { font-weight: 600; }
.usg-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; }
.usg-warn { color: var(--dsw-alias-state-warn-primary); font-size: 12px; }
.usg-ok { color: var(--dsw-alias-state-success-primary); font-size: 12px; }
.usg-pricing summary { cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 12px; user-select: none; }
.usg-pricing-body { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
/* 主界面：输入框下方常驻会话用量行 */
.usg-dock { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); padding: 2px 2px 0; line-height: 18px; }
.usg-dock-cost { font-weight: 600; color: #60a5fa; }
/* 主界面：侧边栏底部按钮（对齐原生侧栏按钮观感） */
.usg-fab { width: 100%; height: 40px; border: none; background: transparent; color: var(--dsw-alias-label-primary); border-radius: 12px; padding: 0 10px; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; justify-content: flex-start; overflow: hidden; white-space: nowrap; }
.usg-fab:hover { background: var(--dsw-alias-interactive-bg-hover-solid, var(--dsw-alias-bg-layer-2)); }
.usg-fab[aria-pressed="true"] { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); }
.usg-fab-badge { font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; margin-left: auto; }
/* 侧边栏 Token 用量卡片（参考设计） */
.usg-fab-card { height: auto; flex-direction: column; align-items: stretch; gap: 4px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
.usg-fab-card:hover { background: var(--dsw-alias-interactive-bg-hover-solid, var(--dsw-alias-bg-layer-2)); }
.usg-fab-rail { justify-content: center; padding: 0; font-weight: 600; }
.usg-card-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.usg-card-label { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.usg-card-open { font-size: 12px; color: var(--dsw-alias-label-secondary); line-height: 1; }
.usg-card-model { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usg-card-bottom { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.usg-card-num { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
.usg-card-cost { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; color: #60a5fa; }
/* 主界面：悬浮汇总面板 */
.usg-ov { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(760px, calc(100vw - 32px)); max-height: calc(100vh - 80px); overflow-y: auto; pointer-events: auto; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); padding: 16px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: var(--dsw-alias-label-primary); }
.usg-ov-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.usg-ov-title { font-weight: 600; font-size: 14px; }
.usg-ov-close { border: none; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 16px; padding: 0 6px; border-radius: 6px; line-height: 22px; }
.usg-ov-close:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.usg-ov-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
.usg-ov-cur { display: inline-flex; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; overflow: hidden; }
.usg-ov-cur-btn { border: none; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 4px 10px; cursor: pointer; font-family: inherit; }
.usg-ov-cur-btn.usg-ov-cur-on { background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-1); }
.usg-ov-note { font-size: 12px; color: var(--dsw-alias-label-secondary); line-height: 1.5; }
.usg-ov-section { font-weight: 600; font-size: 13px; }
.usg-ov-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.usg-ov-table th, .usg-ov-table td { padding: 5px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); text-align: left; white-space: nowrap; }
.usg-ov-table th { color: var(--dsw-alias-label-secondary); font-weight: 500; }
.usg-ov-table td.usg-num, .usg-ov-table th.usg-num { text-align: right; font-variant-numeric: tabular-nums; }
.usg-ov-table td.usg-strong { font-weight: 600; }
.usg-ov-table .usg-cell-main { max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
.usg-free { color: #f59e0b; font-weight: 600; }
.usg-ov-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35); pointer-events: auto; }
.usg-ov-table thead th { position: sticky; top: 0; background: var(--dsw-alias-bg-layer-1); z-index: 1; box-shadow: 0 1px 0 var(--dsw-alias-border-l1); }
.usg-ov-table tbody tr.usg-ov-row-click { cursor: pointer; }
.usg-ov-table tbody tr.usg-ov-row-click:hover { background: var(--dsw-alias-bg-layer-2); }
.usg-ov-more { border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 8px; }
.usg-ov-more summary { cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 12px; user-select: none; }
.usg-ov-more-body { margin-top: 8px; display: flex; flex-direction: column; gap: 10px; }
.usg-ov-stat { padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.usg-ov-stat-label { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.usg-ov-stat-value { font-weight: 700; font-size: 14px; white-space: nowrap; }
.usg-ov-stat-value.usg-cost { color: #60a5fa; }
.usg-budget { display: flex; flex-direction: column; gap: 8px; }
.usg-budget-row { display: flex; flex-direction: column; gap: 3px; }
.usg-budget-head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.usg-budget-value { font-variant-numeric: tabular-nums; white-space: nowrap; }
.usg-budget-track { height: 8px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); overflow: hidden; }
.usg-budget-fill { height: 100%; background: #34d399; transition: width 0.2s; }
.usg-budget-fill.usg-budget-warn { background: #f59e0b; }
.usg-budget-fill.usg-budget-over { background: #ef4444; }
.usg-balance { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.usg-balance-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.usg-balance-title { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.usg-balance-main { font-weight: 700; font-size: 20px; color: #60a5fa; }
.usg-balance-sub { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.usg-balance-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.usg-balance-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; }
.usg-toaster { position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 1000; pointer-events: none; }
.usg-toast { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-left: 3px solid #f59e0b; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--dsw-alias-label-primary); box-shadow: 0 6px 20px rgba(0,0,0,0.18); animation: usg-toast-in 0.2s ease-out; display: flex; align-items: center; gap: 10px; pointer-events: auto; }
.usg-toast.usg-toast-over { border-left-color: #ef4444; }
.usg-toast-text { flex: 1; }
.usg-toast-close { border: none; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 14px; line-height: 1; padding: 2px 4px; border-radius: 4px; }
.usg-toast-close:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.usg-boundary-error { font-size: 12px; color: var(--dsw-alias-state-error-primary); padding: 6px 10px; border: 1px dashed var(--dsw-alias-border-l1); border-radius: 6px; }
@keyframes usg-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.usg-trend { display: flex; flex-direction: column; gap: 6px; }
.usg-trend-bars { display: flex; align-items: flex-end; gap: 2px; height: 120px; }
.usg-trend-bar { flex: 1; min-width: 0; background: #60a5fa; border-radius: 2px 2px 0 0; opacity: 0.85; }
.usg-trend-bar:hover { opacity: 1; }
.usg-trend-axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.usg-balance-actions { display: inline-flex; align-items: center; gap: 8px; }
.usg-switch { position: relative; display: inline-flex; align-items: center; cursor: pointer; flex: none; }
.usg-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.usg-switch-track { width: 34px; height: 18px; border-radius: 9px; background: var(--dsw-alias-border-l2); display: inline-flex; align-items: center; padding: 2px; box-sizing: border-box; transition: background 0.15s; }
.usg-switch-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
.usg-switch input:checked + .usg-switch-track { background: #60a5fa; }
.usg-switch input:checked + .usg-switch-track .usg-switch-thumb { transform: translateX(16px); }
.usg-cfg { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
.usg-cfg-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.usg-cfg-field { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.usg-input { font-family: inherit; font-size: 12px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); width: 100%; box-sizing: border-box; }
.usg-cfg-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.usg-cfg-table th, .usg-cfg-table td { text-align: left; padding: 3px 6px; }
.usg-cfg-table th { color: var(--dsw-alias-label-secondary); font-weight: 500; }
.usg-cfg-table td input { width: 64px; }
.usg-cfg-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
@media (max-width: 640px) {
  .usg-stats-row { grid-template-columns: repeat(2, 1fr); }
  .usg-cfg-grid { grid-template-columns: 1fr; }
  .usg-ov-stats { grid-template-columns: repeat(3, 1fr); }
}
`;

		// 悬浮面板开关（跨插槽共享的小 store）
		const overlayStore = {
			open: false,
			listeners: new Set(),
			subscribe(fn) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; },
			notify() { for (const fn of this.listeners) fn(); },
			toggle() { this.open = !this.open; this.notify(); },
			close() { if (this.open) { this.open = false; this.notify(); } },
		};

		function fetchStats() {
			return fetch('/usage-stats').then((r) => r.json());
		}

		function useStatsData(active, intervalMs) {
			const [data, setData] = react.useState(null);
			react.useEffect(() => {
				if (!active) return;
				let alive = true;
				const load = () => {
					fetchStats().then((d) => { if (alive) setData(d); }).catch(() => {});
				};
				load();
				const timer = window.setInterval(load, intervalMs);
				return () => { alive = false; window.clearInterval(timer); };
			}, [active, intervalMs]);
			return data;
		}

		function normalizedStats(data) {
			const s = data && data.stats ? data.stats : null;
			if (!s || !s.byBand || !s.byModel || !s.total) return null;
			return s;
		}

		function bandStack(s, money) {
			const fmt = money || fmtCost;
			const bandCosts = BAND_KEYS.map((bk) => (s.byBand[bk] || EMPTY_BUCKET).cost);
			const bandTotal = bandCosts.reduce((a, b) => a + b, 0);
			const segs = BAND_KEYS.map((bk, i) => {
				const pct = bandTotal > 0 ? Math.max(0.5, (bandCosts[i] / bandTotal) * 100) : 0;
				return el('div', {
					key: bk,
					className: 'usg-band-seg usg-seg-' + bk,
					style: { width: pct + '%' },
					title: bandLabel(bk) + '：' + fmt(bandCosts[i]),
				});
			});
			const legend = BAND_KEYS.map((bk) => {
				const b = s.byBand[bk] || EMPTY_BUCKET;
				return el('div', { className: 'usg-legend-item', key: bk },
					el('span', { className: 'usg-legend-dot usg-seg-' + bk }),
					bandLabel(bk) + ' · ' + fmt(b.cost),
				);
			});
			return el('div', null,
				el('div', { className: 'usg-band-stack' }, segs),
				el('div', { className: 'usg-band-legend' }, legend),
			);
		}

		function beijingDateKey(offsetDays) {
			const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000);
			const p = (n) => (n < 10 ? '0' + n : '' + n);
			return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
		}

		function dowMon(key) {
			const d = new Date(key + 'T00:00:00Z');
			return (d.getUTCDay() + 6) % 7; // 周一 = 0
		}

		function nextDateKey(key) {
			// 把显示日期当作 UTC 零点代理，+24h 后用 UTC 分量重新格式化，恰好前进一天
			const [y, m, d] = key.split('-').map(Number);
			const next = new Date(Date.UTC(y, m - 1, d) + 86400 * 1000);
			const p = (n) => (n < 10 ? '0' + n : '' + n);
			return next.getUTCFullYear() + '-' + p(next.getUTCMonth() + 1) + '-' + p(next.getUTCDate());
		}

		function cellTitle(label, b, money) {
			const fmt = money || fmtCost;
			return label + '\n' + T('cell.in') + ' ' + fmtTokens(b.input) + ' / ' + T('cell.out') + ' ' + fmtTokens(b.output) + ' tokens\n' + fmt(b.cost) + ' · ' + b.calls + ' ' + T('cell.calls');
		}

		// 即时悬浮提示：跟随鼠标的自定义气泡（替代原生 title）
		function useTip() {
			const [tip, setTip] = react.useState(null);
			const bind = (text) => ({
				onMouseEnter: (e) => setTip({ x: e.clientX, y: e.clientY, text }),
				onMouseMove: (e) => setTip({ x: e.clientX, y: e.clientY, text }),
				onMouseLeave: () => setTip(null),
			});
			const bubble = tip
				? el('div', {
						className: 'usg-tip',
						style: {
							left: Math.min(tip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 290),
							top: Math.min(tip.y + 16, (typeof window !== 'undefined' ? window.innerHeight : 800) - 90),
						},
					}, tip.text)
				: null;
			return { bind, bubble };
		}

		function legendRow() {
			return el('div', { className: 'usg-hm-legend' },
				T('hm.less'),
				[1, 2, 3, 4].map((l) => el('div', { key: l, className: 'usg-hm-cell usg-hm-' + l })),
				T('hm.more'),
			);
		}

		// 通用：按日网格热力图（周列 × 7 行，周一开头）
		function dayGridHeatMap(keys, getBucket, tip, scrollRef, money) {
			const costs = keys.map((k) => (getBucket(k) || EMPTY_BUCKET).cost);
			const maxCost = costs.reduce((m, c) => Math.max(m, c), 0);
			const levelOf = (c) => (c <= 0 ? 0 : Math.min(4, 1 + Math.floor((c / maxCost) * 3)));
			const pad = dowMon(keys[0]);
			const cells = [];
			for (let i = 0; i < pad; i++) cells.push(null);
			for (let i = 0; i < keys.length; i++) cells.push(i);
			const cols = [];
			for (let c = 0; c * 7 < cells.length; c++) {
				const col = [];
				for (let r = 0; r < 7; r++) {
					const idx = c * 7 + r;
					const di = idx < cells.length ? cells[idx] : undefined;
					if (di === null || di === undefined) {
						col.push(el('div', { className: 'usg-hm-cell usg-hm-pad', key: r }));
						continue;
					}
					const key = keys[di];
					const b = getBucket(key) || EMPTY_BUCKET;
					const lvl = levelOf(b.cost);
					col.push(el('div', {
						className: 'usg-hm-cell' + (lvl > 0 ? ' usg-hm-' + lvl : ''),
						key: r,
						...(tip ? tip.bind(cellTitle(key, b, money)) : {}),
					}));
				}
				cols.push(el('div', { className: 'usg-hm-col', key: c }, col));
			}
			const labels = ['一', '二', '三', '四', '五', '六', '日'].map((t, i) =>
				el('div', { className: 'usg-hm-label', key: i }, t),
			);
			return el('div', { className: 'usg-hm-wrap' },
				el('div', { className: 'usg-hm' },
					el('div', { className: 'usg-hm-labels' }, labels),
					el('div', { className: 'usg-hm-scroll', ref: scrollRef || undefined },
						el('div', { className: 'usg-hm-grid' }, cols),
					),
				),
				legendRow(),
				tip ? tip.bubble : null,
			);
		}

		// 「日」视图：今天 24 小时
		function hourHeatMap(s, tip, scrollRef, money) {
			const today = beijingDateKey(0);
			const p2 = (n) => (n < 10 ? '0' + n : '' + n);
			const getBucket = (h) => (s.byHour && s.byHour[today + ' ' + p2(h)]) || EMPTY_BUCKET;
			const costs = [];
			for (let h = 0; h < 24; h++) costs.push(getBucket(h).cost);
			const maxCost = costs.reduce((m, c) => Math.max(m, c), 0);
			const levelOf = (c) => (c <= 0 ? 0 : Math.min(4, 1 + Math.floor((c / maxCost) * 3)));
			const cells = [];
			for (let h = 0; h < 24; h++) {
				const b = getBucket(h);
				const lvl = levelOf(b.cost);
				cells.push(el('div', { className: 'usg-hm-col', key: h },
					el('div', {
						className: 'usg-hm-cell' + (lvl > 0 ? ' usg-hm-' + lvl : ''),
						...(tip ? tip.bind(cellTitle(today + ' ' + p2(h) + ':00', b, money)) : {}),
					}),
				));
			}
			return el('div', { className: 'usg-hm-wrap' },
				el('div', { className: 'usg-hm-scroll', ref: scrollRef || undefined },
					el('div', { className: 'usg-hm', style: { gap: 3 } },
						el('div', { className: 'usg-hm-grid', style: { gap: 3 } }, cells),
					),
				),
				legendRow(),
				tip ? tip.bubble : null,
			);
		}

		// 热力图入口：日（按小时）/ 周 / 月 / 年 / 累计
		function heatMap(s, range, tip, scrollRef, money) {
			const getDayBucket = (k) => (s.byDay && s.byDay[k]) || EMPTY_BUCKET;
			if (range === 'day') {
				if (!s.byHour || Object.keys(s.byHour).length === 0) {
					// 尚无小时级数据：显示 24 个占位灰格 + 提示
					const placeholders = [];
					for (let h = 0; h < 24; h++) {
						placeholders.push(el('div', { className: 'usg-hm-col', key: h },
							el('div', { className: 'usg-hm-cell', title: T('hm.noHourData') }),
						));
					}
					return el('div', { className: 'usg-hm-wrap' },
						el('div', { className: 'usg-warn' }, T('hm.hourBackfill')),
						el('div', { className: 'usg-hm-scroll' },
							el('div', { className: 'usg-hm', style: { gap: 3 } },
								el('div', { className: 'usg-hm-grid', style: { gap: 3 } }, placeholders),
							),
						),
						legendRow(),
					);
				}
				return hourHeatMap(s, tip, scrollRef, money);
			}
			if (range === 'week') {
				const keys = [];
				for (let i = 6; i >= 0; i--) keys.push(beijingDateKey(-i));
				return dayGridHeatMap(keys, getDayBucket, tip, scrollRef, money);
			}
			if (range === 'year') {
				const keys = [];
				for (let i = 364; i >= 0; i--) keys.push(beijingDateKey(-i));
				return dayGridHeatMap(keys, getDayBucket, tip, scrollRef, money);
			}
			if (range === 'all') {
				// 累计：从有数据的第一天开始（防御：过滤异常键，最多回溯 730 天）
				const today = beijingDateKey(0);
				const days = Object.keys(s.byDay || {})
					.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= today)
					.sort();
				if (days.length === 0) {
					return el('div', { className: 'usg-hm-wrap' }, el('div', { className: 'usg-muted' }, T('hm.noData')));
				}
				let start = days[0];
				let truncated = false;
				if (start < beijingDateKey(-730)) {
					start = beijingDateKey(-730);
					truncated = true;
				}
				const keys = [];
				let cur = start;
				let guard = 0;
				while (cur <= today && guard < 800) { keys.push(cur); cur = nextDateKey(cur); guard++; }
				return el('div', null,
					truncated ? el('div', { className: 'usg-muted' }, T('hm.allTruncated')) : null,
					dayGridHeatMap(keys, getDayBucket, tip, scrollRef, money),
				);
			}
			// 默认：月（近 30 天）
			const keys = [];
			for (let i = 29; i >= 0; i--) keys.push(beijingDateKey(-i));
			return dayGridHeatMap(keys, getDayBucket, tip, scrollRef);
		}

		function RangeChips(props) {
			const options = [
				['day', T('range.day')],
				['week', T('range.week')],
				['month', T('range.month')],
				['year', T('range.year')],
				['all', T('range.all')],
			];
			return el('div', { className: 'usg-range' },
				options.map(([k, label]) =>
					el('button', {
						key: k,
						className: 'usg-range-btn' + (props.value === k ? ' usg-range-on' : ''),
						onClick: () => props.onChange(k),
					}, label),
				),
			);
		}

		function sessionBars(s, topN, showTokens) {
			const rows = Object.keys(s.bySession || {}).map((id) => ({ id, ...(s.bySession[id] || {}) }));
			rows.sort((a, b) => b.cost - a.cost);
			const top = rows.slice(0, topN || 8);
			const maxCost = top.reduce((m, x) => Math.max(m, x.cost), 0);
			return el('div', { className: 'usg-sbars' },
				top.map((x) => {
					const pct = maxCost > 0 ? Math.max(1, Math.round((x.cost / maxCost) * 100)) : 0;
					const title = x.title && typeof x.title === 'string' ? x.title : shortId(x.id);
					const detail = showTokens
						? fmtCost(x.cost) + ' · ' + x.calls + ' ' + T('bar.calls') + ' · ' + T('bar.in') + ' ' + fmtTokens(x.input) + ' / ' + T('bar.out') + ' ' + fmtTokens(x.output)
						: fmtCost(x.cost) + ' · ' + x.calls + ' ' + T('bar.calls');
					return el('div', { className: 'usg-sbar-row', key: x.id, title: x.id },
						el('div', { className: 'usg-sbar-head' },
							el('div', { className: 'usg-sbar-title' }, title),
							el('div', { className: 'usg-sbar-value' }, detail),
						),
						el('div', { className: 'usg-sbar-track' },
							el('div', { className: 'usg-sbar-fill', style: { width: pct + '%' } }),
						),
					);
				}),
			);
		}

		function pad2(n) { return (n < 10 ? '0' + n : '' + n); }

		function pricingNoteText(config) {
			let date = '2026-08-17 00:00';
			let p1 = '9:00–12:00';
			let p2 = '14:00–18:00';
			if (config && typeof config.boundaryMs === 'number' && config.boundaryMs > 0) {
				const d = new Date(config.boundaryMs + 8 * 3600 * 1000);
				date = d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) + ' 00:00';
			}
			if (config && Array.isArray(config.peakHours) && config.peakHours.length === 4) {
				p1 = config.peakHours[0] + ':00–' + config.peakHours[1] + ':00';
				p2 = config.peakHours[2] + ':00–' + config.peakHours[3] + ':00';
			}
			return T('set.pricingNote', { date, p1, p2 });
		}

		function download(url) {
			const a = document.createElement('a');
			a.href = url;
			a.download = '';
			document.body.appendChild(a);
			a.click();
			a.remove();
		}

		// ---------- 预算进度条 ----------
		function BudgetBars(budget) {
			if (!budget) return null;
			const bars = [];
			if (budget.daily && budget.daily.limit != null) bars.push({ label: T('budget.daily'), ...budget.daily });
			if (budget.monthly && budget.monthly.limit != null) bars.push({ label: T('budget.monthly'), ...budget.monthly });
			if (bars.length === 0) return null;
			return el('div', { className: 'usg-budget' },
				bars.map((b) => {
					const pct = b.limit > 0 ? Math.min(100, (b.spent / b.limit) * 100) : 0;
					const over = b.spent > b.limit;
					const warn = !over && pct >= 80;
					const fillCls = over ? 'usg-budget-over' : (warn ? 'usg-budget-warn' : '');
					return el('div', { className: 'usg-budget-row', key: b.label },
						el('div', { className: 'usg-budget-head' },
							el('span', null, b.label),
							el('span', { className: 'usg-budget-value' },
								fmtCost(b.spent) + ' / ' + fmtCost(b.limit) +
								(over ? ' · ' + T('budget.over') : ''),
							),
						),
						el('div', { className: 'usg-budget-track' },
							el('div', { className: 'usg-budget-fill' + (fillCls ? ' ' + fillCls : ''), style: { width: pct + '%' } }),
						),
					);
				}),
			);
		}

		// ---------- 近 30 天每日费用柱状图（设置页） ----------
		function TrendBars(s) {
			if (!s || !s.byDay) return null;
			const days = [];
			const dayMs = 86400000;
			// 以北京日界对齐取近 30 天
			const nowBeijing = Date.now() + 8 * 3600000;
			const todayStart = Math.floor(nowBeijing / dayMs) * dayMs - 8 * 3600000;
			for (let i = 29; i >= 0; i--) {
				const start = todayStart - i * dayMs;
				const d = new Date(start + 8 * 3600000);
				const key = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1 < 10 ? '0' : '') + (d.getUTCMonth() + 1) + '-' + (d.getUTCDate() < 10 ? '0' : '') + d.getUTCDate();
				days.push({ key, cost: (s.byDay[key] && s.byDay[key].cost) || 0 });
			}
			const max = days.reduce((m, x) => Math.max(m, x.cost), 0);
			if (max <= 0) return null;
			return el('div', { className: 'usg-trend' },
				el('div', { className: 'usg-section' }, T('trend.title')),
				el('div', { className: 'usg-trend-bars' },
					days.map((x) => el('div', {
						key: x.key,
						className: 'usg-trend-bar',
						style: { height: Math.max(2, (x.cost / max) * 100) + '%' },
						title: x.key + '\n' + fmtCost(x.cost),
					})),
				),
				el('div', { className: 'usg-trend-axis' },
					el('span', null, days[0].key.slice(5)),
					el('span', null, fmtCost(max)),
					el('span', null, days[days.length - 1].key.slice(5)),
				),
			);
		}

		// ---------- 官方账户余额 ----------
		function switchToggle(checked, onToggle, title) {
			return el('label', { className: 'usg-switch', title },
				el('input', { type: 'checkbox', checked: !!checked, onChange: (e) => onToggle(e.target.checked) }),
				el('span', { className: 'usg-switch-track' }, el('span', { className: 'usg-switch-thumb' })),
			);
		}

		function BalanceCard(balance, onRefresh, onToggle) {
			if (!balance) return null;
			const b = balance;
			const enabled = b.status !== 'disabled';
			const toggle = onToggle ? switchToggle(enabled, onToggle, T('cfg.balanceEnabled')) : null;

			if (b.status === 'disabled') {
				if (!onToggle) return null;
				return el('div', { className: 'usg-balance usg-balance-muted' },
					el('div', { className: 'usg-balance-head' },
						el('span', { className: 'usg-balance-title' }, T('balance.disabled')),
						toggle,
					),
				);
			}
			if (b.status === 'unconfigured') {
				return el('div', { className: 'usg-balance usg-balance-muted' },
					el('div', { className: 'usg-balance-head' },
						el('span', { className: 'usg-balance-title' }, T('balance.unconfigured')),
						toggle,
					),
				);
			}
			if (b.status === 'loading') {
				return el('div', { className: 'usg-balance usg-balance-muted' },
					el('div', { className: 'usg-balance-head' },
						el('span', { className: 'usg-balance-title' }, T('balance.loading')),
						toggle,
					),
				);
			}
			if (b.status === 'error') {
				return el('div', { className: 'usg-balance usg-balance-error' },
					el('div', { className: 'usg-balance-head' },
						el('span', { className: 'usg-balance-title' }, T('balance.error') + T('common.detail', { msg: b.error })),
						toggle,
					),
				);
			}
			const d = b.data;
			if (!d) return null;
			return el('div', { className: 'usg-balance' },
				el('div', { className: 'usg-balance-head' },
					el('span', { className: 'usg-balance-title' }, T('balance.title') + (d.isAvailable ? '' : ' · ' + T('balance.unavailable'))),
					el('span', { className: 'usg-balance-actions' },
						onRefresh ? el('button', { className: 'usg-btn', onClick: onRefresh }, T('balance.refresh')) : null,
						toggle,
					),
				),
				el('div', { className: 'usg-balance-main' }, '¥' + (Number(d.total) || 0).toFixed(2)),
				el('div', { className: 'usg-balance-sub' },
					T('balance.toppedUp') + ' ¥' + (Number(d.toppedUp) || 0).toFixed(2) + ' · ' + T('balance.granted') + ' ¥' + (Number(d.granted) || 0).toFixed(2),
				),
			);
		}

		// ---------- 计费与预算设置（可编辑） ----------
		const DEFAULT_BOUNDARY_MS = Date.UTC(2026, 7, 16, 16, 0, 0);

		function boundaryDateStr(ms) {
			const d = new Date((ms || DEFAULT_BOUNDARY_MS) + 8 * 3600 * 1000);
			return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
		}

		function draftFromConfig(c) {
			const src = c || {};
			const pricing = {};
			BAND_KEYS.forEach((band) => {
				pricing[band] = {};
				MODEL_KEYS.forEach((model) => {
					const s = src.pricing && src.pricing[band] && src.pricing[band][model];
					pricing[band][model] = {
						hit: s && s.hit != null ? String(s.hit) : '0',
						miss: s && s.miss != null ? String(s.miss) : '0',
						out: s && s.out != null ? String(s.out) : '0',
					};
				});
			});
			const ph = Array.isArray(src.peakHours) && src.peakHours.length === 4 ? src.peakHours : [9, 12, 14, 18];
			return {
				budgetDaily: src.budgetDaily != null ? String(src.budgetDaily) : '',
				budgetMonthly: src.budgetMonthly != null ? String(src.budgetMonthly) : '',
				usdCny: src.usdCny != null && Number(src.usdCny) > 0 ? String(src.usdCny) : '6.7878',
				boundary: boundaryDateStr(src.boundaryMs),
				peak: ph.map(String),
				pricing,
			};
		}

		function buildConfigFromDraft(d) {
			const parts = (d.boundary || '').split('-').map(Number);
			const boundaryMs = (parts.length === 3 && parts.every((n) => Number.isFinite(n)))
				? (Date.UTC(parts[0], parts[1] - 1, parts[2]) - 8 * 3600 * 1000)
				: DEFAULT_BOUNDARY_MS;
			const pricing = {};
			BAND_KEYS.forEach((band) => {
				pricing[band] = {};
				MODEL_KEYS.forEach((model) => {
					const s = d.pricing[band][model];
					pricing[band][model] = {
						hit: parseFloat(s.hit) || 0,
						miss: parseFloat(s.miss) || 0,
						out: parseFloat(s.out) || 0,
					};
				});
			});
			const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
			const toBudget = (v) => (v === '' ? null : (parseFloat(v) || null));
			return {
				boundaryMs,
				peakHours: d.peak.map(toInt),
				pricing,
				budgetDaily: toBudget(d.budgetDaily),
				budgetMonthly: toBudget(d.budgetMonthly),
				usdCny: Number(d.usdCny) > 0 ? Number(d.usdCny) : 6.7878,
			};
		}

		function ConfigEditor(props) {
			const [draft, setDraft] = react.useState(() => draftFromConfig(props.config));
			const [msg, setMsg] = react.useState('');

			const set = (k, v) => setDraft((prev) => ({ ...prev, [k]: v }));
			const setPeak = (i, v) => setDraft((prev) => {
				const peak = prev.peak.slice();
				peak[i] = v;
				return { ...prev, peak };
			});
			const setPrice = (band, model, field, v) => setDraft((prev) => {
				const pricing = { ...prev.pricing, [band]: { ...prev.pricing[band], [model]: { ...prev.pricing[band][model], [field]: v } } };
				return { ...prev, pricing };
			});

			const applyResult = (r) => {
				if (r && r.ok) {
					setDraft(draftFromConfig(r.config));
					setMsg(T('cfg.saved'));
					window.setTimeout(() => setMsg(''), 3000);
					if (props.onSaved) props.onSaved();
				} else {
					setMsg(T('cfg.saveFailed') + T('common.detail', { msg: String(r && r.error ? r.error : '') }));
				}
			};

			const onSave = async () => {
				try {
					const payload = buildConfigFromDraft(draft);
					// 余额开关不由本表单管理，保存时沿用当前值，避免被重置
					payload.balanceEnabled = props.config ? props.config.balanceEnabled !== false : true;
					const res = await fetch('/usage-stats?action=config', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload),
					});
					applyResult(await res.json());
				} catch (e) {
					setMsg(T('cfg.saveFailed') + T('common.detail', { msg: String(e && e.message ? e.message : e) }));
				}
			};

			const onReset = async () => {
				try {
					const res = await fetch('/usage-stats?action=config&reset=1', { method: 'POST' });
					applyResult(await res.json());
				} catch (e) {
					setMsg(T('cfg.saveFailed') + T('common.detail', { msg: String(e && e.message ? e.message : e) }));
				}
			};

			const numInput = (value, onChange) =>
				el('input', { type: 'number', step: 'any', min: '0', className: 'usg-input', value, onChange: (e) => onChange(e.target.value) });

			const priceRows = BAND_KEYS.map((band) =>
				MODEL_KEYS.map((model) => {
					const p = draft.pricing[band][model];
					return el('tr', { key: band + '-' + model },
						el('td', null, bandLabel(band)),
						el('td', null, modelLabel(model)),
						el('td', null, numInput(p.hit, (v) => setPrice(band, model, 'hit', v))),
						el('td', null, numInput(p.miss, (v) => setPrice(band, model, 'miss', v))),
						el('td', null, numInput(p.out, (v) => setPrice(band, model, 'out', v))),
					);
				}),
			);

			return el('details', { className: 'usg-pricing' },
				el('summary', null, T('cfg.title')),
				el('div', { className: 'usg-cfg' },
					el('div', { className: 'usg-section' }, T('cfg.budgetSection')),
					el('div', { className: 'usg-cfg-grid' },
						el('label', { className: 'usg-cfg-field' },
							el('span', null, T('cfg.daily')),
							numInput(draft.budgetDaily, (v) => set('budgetDaily', v)),
						),
						el('label', { className: 'usg-cfg-field' },
							el('span', null, T('cfg.monthly')),
							numInput(draft.budgetMonthly, (v) => set('budgetMonthly', v)),
						),
					),
					el('div', { className: 'usg-cfg-grid' },
						el('label', { className: 'usg-cfg-field' },
							el('span', null, T('cfg.usdCny')),
							numInput(draft.usdCny, (v) => set('usdCny', v)),
						),
						el('label', { className: 'usg-cfg-field' },
							el('span', null, T('cfg.boundary')),
							el('input', { type: 'date', className: 'usg-input', value: draft.boundary, onChange: (e) => set('boundary', e.target.value) }),
						),
					),
					el('div', { className: 'usg-cfg-grid' },
						el('div', { className: 'usg-cfg-field' },
							el('span', null, T('cfg.peakHours')),
							el('div', { style: { display: 'flex', gap: 4 } },
								draft.peak.map((v, i) =>
									el('input', { key: i, type: 'number', min: '0', max: '24', className: 'usg-input', value: v, onChange: (e) => setPeak(i, e.target.value) }),
								),
							),
						),
					),
					el('div', null,
						el('div', { className: 'usg-section' }, T('cfg.priceTable')),
						el('table', { className: 'usg-cfg-table' },
							el('thead', null, el('tr', null,
								el('th', null, T('set.band')), el('th', null, T('set.model')),
								el('th', null, T('set.hit')), el('th', null, T('set.miss')), el('th', null, T('set.output')),
							)),
							el('tbody', null, priceRows),
						),
					),
					el('div', { className: 'usg-cfg-actions' },
						el('button', { className: 'usg-btn', onClick: onSave }, T('cfg.save')),
						el('button', { className: 'usg-btn', onClick: onReset }, T('cfg.reset')),
						msg ? el('span', { className: 'usg-ok' }, msg) : null,
					),
				),
			);
		}

		// ---------- 主界面 · 输入框下方：当前会话用量 ----------
		function DockReadout(props) {
			useLocaleTick();
			const sessionId = typeof props.sessionId === 'string' && props.sessionId.length > 0
				? props.sessionId
				: (props.session && typeof props.session.id === 'string' ? props.session.id : null);
			const data = useStatsData(sessionId !== null, 10000);
			const s = normalizedStats(data);
			if (!s || !sessionId) return null;
			const b = s.bySession && s.bySession[sessionId];
			if (!b || b.calls <= 0) return null;
			return el('div', { className: 'usg-dock' },
				T('dock.used'),
				el('span', { className: 'usg-dock-cost' }, fmtCost(b.cost)),
				'· ' + b.calls + ' ' + T('dock.calls'),
				'· ' + T('dock.in') + ' ' + fmtTokens(b.input),
				'· ' + T('dock.out') + ' ' + fmtTokens(b.output),
			);
		}

		// ---------- 主界面 · 侧边栏底部卡片（参考设计：Token 用量卡片） ----------
		function cardModel(s, sessionId) {
			if (!s) return null;
			const recents = (s.recent || []).filter((r) => (sessionId ? r.sessionId === sessionId : true));
			if (recents.length > 0) return recents[0].model;
			// 回退：从全量 recent 取最近一次调用的真实模型名（而非硬编码）
			if ((s.recent || []).length > 0) return s.recent[0].model;
			const byModel = s.byModel || {};
			if (byModel.flash && byModel.flash.calls > 0) return 'deepseek-v4-flash';
			if (byModel.pro && byModel.pro.calls > 0) return 'deepseek-v4-pro';
			if (byModel.other && byModel.other.calls > 0) return T('model.other');
			return null;
		}

		function FooterButton(props) {
			useLocaleTick();
			const [, force] = react.useState(0);
			react.useEffect(() => overlayStore.subscribe(() => force((v) => v + 1)), []);
			const [sessionId, setSessionId] = react.useState(null);
			react.useEffect(() => {
				if (!SESSIONS || !SESSIONS.list) return;
				const read = () => {
					try {
						const snap = SESSIONS.list.getSnapshot();
						setSessionId(snap && typeof snap.current === 'string' ? snap.current : null);
					} catch {
						setSessionId(null);
					}
				};
				read();
				const unsub = SESSIONS.list.subscribe(read);
				return unsub;
			}, []);
			const data = useStatsData(true, 10000);
			const s = normalizedStats(data);
			const open = overlayStore.open;
			const model = cardModel(s, sessionId);
			const row = s && sessionId ? (s.bySession || {})[sessionId] : null;
			const live = row && row.calls > 0;
			const b = live ? row : (s ? s.total : null);
			if (!props.wide) {
				return el('button', {
					className: 'usg-fab usg-fab-rail',
					title: open ? T('card.closeTooltip') : T('card.tooltip'),
					onClick: () => overlayStore.toggle(),
					'aria-pressed': open,
				}, '¥');
			}
			return el('button', {
				className: 'usg-fab usg-fab-card',
				title: open ? T('card.closeTooltip') : T('card.tooltip'),
				onClick: () => overlayStore.toggle(),
				'aria-pressed': open,
			},
				el('span', { className: 'usg-card-top' },
					el('span', { className: 'usg-card-label' }, T('card.title')),
					el('span', { className: 'usg-card-open' }, '↗'),
				),
				model ? el('span', { className: 'usg-card-model' }, model) : null,
				el('span', { className: 'usg-card-bottom' },
					el('span', null,
						el('span', { className: 'usg-card-label' }, (live ? T('card.session') : T('card.all')) + ' '),
						el('span', { className: 'usg-card-num' }, b ? fmtNum(b.input) : '—'),
					),
					el('span', { className: 'usg-card-cost' }, b ? fmtCost2(b.cost) : '—'),
				),
			);
		}

		// ---------- 主界面 · 居中详细统计弹窗（参考设计：标题 + 币种切换 + 总览 + 按模型/按会话表格） ----------
		// ---------- 预算告警 toast（宿主跨阈值时经 GET alerts 捎带，取走即清） ----------
		// 单条 toast：接近档 10s 自动消失；超支档常驻，手动 × 关闭
		function ToastItem(props) {
			react.useEffect(() => {
				if (props.level >= 2) return; // 超支：不自动消失
				const timer = window.setTimeout(props.onClose, 10000);
				return () => window.clearTimeout(timer);
			}, []);
			return el('div', { className: 'usg-toast' + (props.level >= 2 ? ' usg-toast-over' : '') },
				el('span', { className: 'usg-toast-text' }, props.text),
				el('button', { className: 'usg-toast-close', onClick: props.onClose, 'aria-label': 'close' }, '×'),
			);
		}

		function AlertToaster() {
			useLocaleTick();
			const [toasts, setToasts] = react.useState([]);
			const seenRef = react.useRef(new Set()); // 已展示过的告警 id，持久去重（宿主不清空 alerts，靠这里保证只弹一次）
			react.useEffect(() => {
				let alive = true;
				const poll = () => {
					fetchStats().then((d) => {
						if (!alive || !Array.isArray(d.alerts) || d.alerts.length === 0) return;
						const items = d.alerts.map((a) => {
							const which = a.kind === 'daily' ? T('budget.daily') : T('budget.monthly');
							const pct = a.limit > 0 ? Math.round((a.spent / a.limit) * 100) : 0;
							const text = a.level >= 2
							? T('alert.over', { which, spent: (Number(a.spent) || 0).toFixed(4), limit: (Number(a.limit) || 0).toFixed(4) })
							: T('alert.near', { which, pct: String(pct) });
							return { id: a.kind + '-' + a.at, level: a.level, text };
						});
						const fresh = items.filter((t) => !seenRef.current.has(t.id));
						if (fresh.length === 0) return;
						fresh.forEach((t) => seenRef.current.add(t.id));
						// 控制台也打一条，便于事后确认触发过
						try { console.log('[usage-stats] budget alert:', fresh.map((t) => t.text).join(' | ')); } catch {}
						setToasts((prev) => prev.concat(fresh).slice(-4));
					}).catch(() => {});
				};
				poll();
				const timer = window.setInterval(poll, 10000);
				return () => { alive = false; window.clearInterval(timer); };
			}, []);
			const dismiss = (id) => setToasts((prev) => prev.filter((x) => x.id !== id));
			if (toasts.length === 0) return null;
			return el('div', { className: 'usg-toaster' },
				toasts.map((t) => react.createElement(ToastItem, { key: t.id, level: t.level, text: t.text, onClose: () => dismiss(t.id) })),
			);
		}

		function OverlayPanel() {
			useLocaleTick();
			const [, force] = react.useState(0);
			const [range, setRange] = react.useState('month');
			const [cur, setCur] = react.useState(() => {
				try {
					const stored = typeof window !== 'undefined' ? window.localStorage.getItem(CUR_KEY) : null;
					return stored === 'usd' ? 'usd' : 'cny';
				} catch { return 'cny'; }
			});
			const setCurPersist = (v) => {
				setCur(v);
				try { window.localStorage.setItem(CUR_KEY, v); } catch {}
			};
			const tip = useTip();
			const scrollRef = react.useRef(null);
			react.useEffect(() => {
				const el = scrollRef.current;
				if (el) el.scrollLeft = el.scrollWidth;
			}, [range]);
			react.useEffect(() => overlayStore.subscribe(() => force((v) => v + 1)), []);
			react.useEffect(() => {
				if (!overlayStore.open) return;
				const onKey = (e) => { if (e.key === 'Escape') overlayStore.close(); };
				window.addEventListener('keydown', onKey);
				return () => window.removeEventListener('keydown', onKey);
			}, [overlayStore.open]);
			const data = useStatsData(overlayStore.open, 5000);
			if (!overlayStore.open) return null;
			const fmtMoney = moneyFormatter(cur, data && data.config ? data.config.usdCny : DEFAULT_USD_CNY);
			const s = normalizedStats(data);
			const total = s ? s.total : EMPTY_BUCKET;
			const sessionsCount = s ? Object.keys(s.bySession || {}).length : 0;
			const ovStat = (label, value, cls) => el('div', { className: 'usg-ov-stat', key: label },
				el('div', { className: 'usg-ov-stat-label' }, label),
				el('div', { className: 'usg-ov-stat-value' + (cls ? ' ' + cls : '') }, value),
			);
			const modelRows = ['flash', 'pro', 'other']
				.filter((mk) => s && (s.byModel[mk] || EMPTY_BUCKET).calls > 0)
				.map((mk) => {
					const b = s.byModel[mk] || EMPTY_BUCKET;
					return el('tr', { key: mk },
						el('td', null, modelLabel(mk)),
						el('td', { className: 'usg-num' }, String(b.calls)),
						el('td', { className: 'usg-num' }, fmtNum(b.cacheMiss)),
						el('td', { className: 'usg-num' }, fmtNum(b.cacheHit)),
						el('td', { className: 'usg-num' }, fmtNum(b.output)),
						mk === 'other'
							? el('td', { className: 'usg-num usg-free' }, T('ov.free'))
							: el('td', { className: 'usg-num usg-strong' }, fmtMoney(b.cost)),
					);
				});
			const sessionTotal = s ? Object.keys(s.bySession || {}).length : 0;
			const sessionRows = Object.keys(s ? s.bySession || {} : {})
				.map((id) => ({ id, ...(s.bySession[id] || {}) }))
				.sort((a, b) => b.cost - a.cost)
				.slice(0, 50)
				.map((x) => {
					const title = x.title && typeof x.title === 'string' ? x.title : shortId(x.id);
					const openable = x.id !== 'unknown' && SESSIONS && typeof SESSIONS.open === 'function';
					const rowProps = openable
						? {
								className: 'usg-ov-row-click',
								title: T('ov.openSession'),
								onClick: () => {
									try { SESSIONS.open(x.id); } catch {}
									overlayStore.close();
								},
							}
						: null;
					return el('tr', { key: x.id, ...rowProps },
						el('td', { className: 'usg-cell-main', title: x.id }, title),
						el('td', { className: 'usg-num' }, fmtDateTime(x.lastAt)),
						el('td', { className: 'usg-num' }, fmtNum(x.cacheMiss)),
						el('td', { className: 'usg-num' }, fmtNum(x.cacheHit)),
						el('td', { className: 'usg-num' }, fmtNum(x.output)),
						el('td', { className: 'usg-num' }, String(x.calls)),
						el('td', { className: 'usg-num usg-strong' }, fmtMoney(x.cost)),
					);
				});
			const tableHead = (cols) => el('thead', null, el('tr', null, cols.map((c) =>
				el('th', { key: c.t, className: c.num ? 'usg-num' : undefined }, c.t))));
			return el('div', null,
				el('div', { className: 'usg-ov-backdrop', onClick: () => overlayStore.close() }),
				el('div', { className: 'usg-ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('ov.title') },
					el('div', { className: 'usg-ov-head' },
						el('div', { className: 'usg-ov-title' }, T('ov.title')),
						el('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
							el('div', { className: 'usg-ov-cur' },
								el('button', { className: 'usg-ov-cur-btn' + (cur === 'cny' ? ' usg-ov-cur-on' : ''), onClick: () => setCurPersist('cny'), 'aria-pressed': cur === 'cny' }, T('ov.cny')),
								el('button', { className: 'usg-ov-cur-btn' + (cur === 'usd' ? ' usg-ov-cur-on' : ''), onClick: () => setCurPersist('usd'), 'aria-pressed': cur === 'usd' }, T('ov.usd')),
							),
							el('button', { className: 'usg-ov-close', onClick: () => overlayStore.close(), 'aria-label': T('ov.close') }, '×'),
						),
					),
					el('div', { className: 'usg-ov-note' }, T('ov.note')),
					!s
						? el('div', { className: 'usg-muted' }, T('ov.loading'))
						: el('div', null,
								el('div', { className: 'usg-ov-stats' },
									ovStat(T('ov.sessions'), String(sessionsCount)),
									ovStat(T('ov.totalTokens'), fmtNum(total.input + total.output)),
									ovStat(T('ov.uncached'), fmtNum(total.cacheMiss)),
									ovStat(T('ov.cached'), fmtNum(total.cacheHit)),
									ovStat(T('ov.output'), fmtNum(total.output)),
									ovStat(T('ov.cost'), fmtMoney(total.cost), 'usg-cost'),
								),
								BudgetBars(data ? data.budget : null),
								BalanceCard(data ? data.balance : null, null),
								el('div', null,
									el('div', { className: 'usg-ov-section' }, T('ov.modelSection')),
									modelRows.length > 0
										? el('table', { className: 'usg-ov-table' },
												tableHead([
													{ t: T('th.model') }, { t: T('th.calls'), num: true }, { t: T('ov.uncached'), num: true }, { t: T('ov.cached'), num: true }, { t: T('ov.output'), num: true }, { t: T('ov.cost'), num: true },
												]),
												el('tbody', null, modelRows),
											)
										: el('div', { className: 'usg-muted' }, T('hm.noData')),
								),
								el('div', null,
									el('div', { className: 'usg-ov-section' }, T('ov.sessionSection')),
									sessionRows.length > 0
										? el('div', null,
												el('table', { className: 'usg-ov-table' },
													tableHead([
														{ t: T('th.title') }, { t: T('th.updated'), num: true }, { t: T('ov.uncached'), num: true }, { t: T('ov.cached'), num: true }, { t: T('ov.output'), num: true }, { t: T('th.calls'), num: true }, { t: T('ov.cost'), num: true },
													]),
													el('tbody', null, sessionRows),
												),
												sessionTotal > sessionRows.length
													? el('div', { className: 'usg-muted' }, T('ov.sessionMore', { total: sessionTotal, shown: sessionRows.length }))
													: null,
											)
										: el('div', { className: 'usg-muted' }, T('hm.noData')),
								),
								el('details', { className: 'usg-ov-more' },
									el('summary', null, T('ov.moreSections')),
									el('div', { className: 'usg-ov-more-body' },
										el('div', null,
											el('div', { className: 'usg-ov-section' }, T('ov.bandSection')),
											bandStack(s, fmtMoney),
										),
										el('div', null,
											el('div', { className: 'usg-head' },
												el('div', { className: 'usg-ov-section' }, T('ov.heatmapSection')),
												el(RangeChips, { value: range, onChange: setRange }),
											),
											heatMap(s, range, tip, scrollRef, fmtMoney),
										),
									),
								),
								el('div', { className: 'usg-muted' },
									T('ov.updatedAt', { time: fmtTime(s.updatedAt) }) + ' · ' + T('ov.footerHint'),
								),
							),
					),
			);
		}

		// ---------- 设置页 · 详细面板 ----------
		function UsagePanel() {
			useLocaleTick();
			const [data, setData] = react.useState(null);
			const [range, setRange] = react.useState('month');
			const tip = useTip();
			const scrollRef = react.useRef(null);
			react.useEffect(() => {
				const el = scrollRef.current;
				if (el) el.scrollLeft = el.scrollWidth;
			}, [range]);
			const [error, setError] = react.useState('');
			const [confirming, setConfirming] = react.useState(false);
			const [backfilling, setBackfilling] = react.useState(false);
			const [notice, setNotice] = react.useState('');

			react.useEffect(() => {
				let alive = true;
				const load = async () => {
					try {
						const d = await fetchStats();
						if (alive) { setData(d); setError(''); }
					} catch (e) {
						if (alive) setError(T('set.loadFailed') + T('common.detail', { msg: String(e && e.message ? e.message : e) }));
					}
				};
				load();
				const timer = window.setInterval(load, 5000);
				return () => { alive = false; window.clearInterval(timer); };
			}, []);

			const refresh = () => {
				fetchStats().then((d) => setData(d)).catch(() => {});
			};

			const refreshBalance = () => {
				fetch('/usage-stats?action=balance', { method: 'POST' }).then(() => refresh()).catch(() => {});
			};

			const toggleBalance = (enabled) => {
				const cfg = (data && data.config) ? data.config : null;
				if (!cfg) return;
				fetch('/usage-stats?action=config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...cfg, balanceEnabled: enabled }),
				}).then(() => refresh()).catch(() => {});
			};

			const onBackfill = async () => {
				setBackfilling(true);
				try {
					const res = await fetch('/usage-stats?action=backfill', { method: 'POST' });
					const r = await res.json();
					if (r && r.ok) {
						setNotice(T('set.backfillDone', { sessions: r.sessions, found: r.found }));
						window.setTimeout(() => setNotice(''), 5000);
					} else {
						setError(T('set.backfillFailed') + T('common.detail', { msg: String(r && r.error ? r.error : T('set.unknownError')) }));
					}
				} catch (e) {
					setError(T('set.backfillFailed') + T('common.detail', { msg: String(e && e.message ? e.message : e) }));
				} finally {
					setBackfilling(false);
					refresh();
				}
			};

			const onClear = async () => {
				if (!confirming) {
					setConfirming(true);
					window.setTimeout(() => setConfirming(false), 3000);
					return;
				}
				setConfirming(false);
				try {
					await fetch('/usage-stats?action=clear', { method: 'POST' });
					setNotice(T('set.clearDone'));
					window.setTimeout(() => setNotice(''), 2500);
					refresh();
				} catch (e) {
					setError(T('set.clearFailed') + T('common.detail', { msg: String(e && e.message ? e.message : e) }));
				}
			};

			const head = el('div', { className: 'usg-head' },
				el('div', { className: 'usg-title' }, T('set.title')),
				el('div', { className: 'usg-actions' },
					el('button', { className: 'usg-btn', onClick: onBackfill, disabled: backfilling }, backfilling ? T('set.backfilling') : T('set.backfill')),
					el('button', { className: 'usg-btn', onClick: refresh }, T('set.refresh')),
					el('button', { className: 'usg-btn', onClick: () => download('/usage-stats?action=export&format=csv&scope=day') }, T('export.csvDay')),
					el('button', { className: 'usg-btn', onClick: () => download('/usage-stats?action=export&format=csv&scope=session') }, T('export.csvSession')),
					el('button', { className: 'usg-btn', onClick: () => download('/usage-stats?action=export&format=json') }, T('export.json')),
					el('button', { className: confirming ? 'usg-btn usg-danger' : 'usg-btn', onClick: onClear }, confirming ? T('set.confirmClear') : T('set.clear')),
				),
			);

			if (!data) {
				return el('div', { className: 'usg-panel' },
					head,
					el('div', { className: 'usg-muted' }, error || T('ov.loading')),
				);
			}

			const s = normalizedStats(data) || {
				total: EMPTY_BUCKET,
				byBand: { before: EMPTY_BUCKET, afterPeak: EMPTY_BUCKET, afterOffPeak: EMPTY_BUCKET },
				byModel: { flash: EMPTY_BUCKET, pro: EMPTY_BUCKET, other: EMPTY_BUCKET },
				bySession: {},
				byDay: {},
				recent: [],
				meta: { lastBackfillAt: 0, lastBackfillSessions: 0, lastBackfillFound: 0, sessionAttribution: false },
			};
			const meta = s.meta || { lastBackfillAt: 0, lastBackfillSessions: 0, lastBackfillFound: 0, sessionAttribution: false };
			const diag = data.diag || {};
			const total = s.total || EMPTY_BUCKET;

			const card = (label, value, sub, cls) =>
				el('div', { className: 'usg-card', key: label },
					el('div', { className: 'usg-card-label' }, label),
					el('div', { className: 'usg-card-value' + (cls || '') }, value),
					sub ? el('div', { className: 'usg-card-sub', title: sub }, sub) : null,
				);

			const modelRow = (key) => {
				const b = s.byModel[key] || EMPTY_BUCKET;
				return el('div', { className: 'usg-model-row', key },
					el('div', { className: 'usg-model-name' }, modelLabel(key)),
					el('div', { className: 'usg-muted' }, b.calls + ' ' + T('bar.calls') + ' · ' + T('bar.in') + ' ' + fmtTokens(b.input) + ' · ' + T('bar.out') + ' ' + fmtTokens(b.output)),
					el('div', { className: 'usg-model-cost' }, fmtCost(b.cost)),
				);
			};

			const recentRows = (s.recent || []).slice(0, 8).map((r) =>
				el('tr', { key: String(r.ts) + '-' + r.model + '-' + r.output },
					el('td', { className: 'usg-muted' }, r.time),
					el('td', null, modelLabel(r.modelKey) || r.model),
					el('td', null, bandLabel(r.band) || r.band),
					el('td', { className: 'usg-num' }, fmtTokens(r.input)),
					el('td', { className: 'usg-num' }, fmtTokens(r.output)),
					el('td', { className: 'usg-num usg-strong' }, fmtCost(r.cost)),
				),
			);

			const priceRows = BAND_KEYS.map((bk) =>
				MODEL_KEYS.map((mk) => {
					const p = data.config && data.config.pricing && data.config.pricing[bk] && data.config.pricing[bk][mk];
					if (!p) return null;
					return el('tr', { key: bk + '-' + mk },
						el('td', null, bandLabel(bk)),
						el('td', null, modelLabel(mk)),
						el('td', { className: 'usg-num' }, String(p.hit)),
						el('td', { className: 'usg-num' }, String(p.miss)),
						el('td', { className: 'usg-num' }, String(p.out)),
					);
				}),
			);

			const backfillNote = meta.lastBackfillAt > 0
				? T('set.backfilledNote', { sessions: meta.lastBackfillSessions, found: meta.lastBackfillFound })
				: T('set.backfillHint');

			const persistNote = diag.lastError
				? T('set.persistError', { error: diag.lastError })
				: (diag.statsFile ? T('set.persistFile', { file: diag.statsFile }) : T('set.persistMemory'));

			const sessionRowsCount = Object.keys(s.bySession || {}).length;

			return el('div', { className: 'usg-panel' },
				head,
				error ? el('div', { className: 'usg-error' }, error) : null,
				notice ? el('div', { className: 'usg-ok' }, notice) : null,
				el('div', { className: 'usg-stats-row' },
					card(T('set.totalCost'), fmtCost(total.cost), backfillNote, ' usg-cost'),
					card(T('set.calls'), String(total.calls), T('set.callsSub')),
					card(T('set.inputTokens'), fmtTokens(total.input), T('set.inputSub', { hit: fmtTokens(total.cacheHit), miss: fmtTokens(total.cacheMiss) })),
					card(T('set.outputTokens'), fmtTokens(total.output), T('set.outputSub')),
				),
				BudgetBars(data.budget),
				TrendBars(s),
				BalanceCard(data.balance, refreshBalance, toggleBalance),
				el('div', null,
					el('div', { className: 'usg-section' }, T('set.bandSection')),
					bandStack(s),
				),
				el('div', null,
					el('div', { className: 'usg-head' },
						el('div', { className: 'usg-section' }, T('set.heatmapSection')),
						el(RangeChips, { value: range, onChange: setRange }),
					),
					heatMap(s, range, tip, scrollRef),
				),
				el('div', null,
					el('div', { className: 'usg-section' }, T('set.sessionSection', { n: sessionRowsCount })),
					sessionBars(s, 8, true),
				),
				el('div', null,
					el('div', { className: 'usg-section' }, T('set.modelSection')),
					el('div', null, ['flash', 'pro', 'other'].map(modelRow)),
				),
				el('div', null,
					el('div', { className: 'usg-section' }, T('set.recentSection')),
					recentRows.length > 0
						? el('table', { className: 'usg-table' },
								el('thead', null, el('tr', null,
									el('th', null, T('set.time')), el('th', null, T('set.model')), el('th', null, T('set.band')),
									el('th', { className: 'usg-num' }, T('set.input')), el('th', { className: 'usg-num' }, T('set.output')), el('th', { className: 'usg-num' }, T('set.cost')),
								)),
								el('tbody', null, recentRows),
							)
						: el('div', { className: 'usg-muted' }, T('set.noRecent')),
				),
				el('div', { className: diag.lastError ? 'usg-warn' : 'usg-muted' }, persistNote),
				el('details', { className: 'usg-pricing' },
					el('summary', null, T('set.pricingSummary')),
					el('div', { className: 'usg-pricing-body' },
						el('p', { className: 'usg-muted', style: { margin: 0 } }, pricingNoteText(data.config)),
						el('table', { className: 'usg-table' },
							el('thead', null, el('tr', null,
								el('th', null, T('set.band')), el('th', null, T('set.model')),
								el('th', { className: 'usg-num' }, T('set.hit')), el('th', { className: 'usg-num' }, T('set.miss')), el('th', { className: 'usg-num' }, T('set.output')),
							)),
							el('tbody', null, priceRows),
						),
					),
				),
				el(ConfigEditor, { config: data.config, onSaved: refresh }),
			);
		}

		const inject = ["slots", "sessions"];

		function apply(ctx) {
			// i18n：注册本插件的 zh/en 词典并绑定翻译函数（界面文案随语言设置即时切换）
			const locale = ctx.get('locale');
			if (locale) {
				ctx.effect(() => locale.register('dsh-usage-billing', DICTS), 'usage-stats: locale dicts');
				T = locale.bind('dsh-usage-billing');
				LOCALE = locale;
			} else {
				T = makeTranslate(DICTS.zh);
				LOCALE = null;
			}

			// 当前会话：供侧边栏卡片显示「本会话」用量（sessions 服务为运行时根服务）
			const sessions = ctx.get('sessions');
			SESSIONS = sessions && typeof sessions.list === 'object' && sessions.list !== null ? sessions : null;

			ctx.effect(() => {
				const tag = document.createElement("style");
				tag.dataset.plugin = "@deepseek-ai/dsh-usage-billing";
				tag.textContent = CSS;
				document.head.appendChild(tag);
				return () => { tag.remove(); };
			}, "usage-stats: styles");

			// 局部错误边界：单个挂载点渲染抛错只降级该区域，不再拖垮整个插件/宿主 UI
			class Boundary extends react.Component {
				constructor(p) {
					super(p);
					this.state = { error: null };
				}
				static getDerivedStateFromError(error) {
					return { error };
				}
				componentDidCatch(error, info) {
					try { console.error('[usage-stats] render error:', error, info); } catch {}
				}
				render() {
					if (this.state.error) {
						return el('div', { className: 'usg-boundary-error' },
							T('boundary.error') + T('common.detail', { msg: String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error) }),
						);
					}
					return this.props.children;
				}
			}
			const guard = (node) => react.createElement(Boundary, null, node);

			// 设置页 · 详细面板
			ctx.slots.inject("settings.section", () => ctx.slots.register(
				{ name: "settings.section", id: "usage-stats", order: 25, label: () => T('set.sectionLabel') },
				(props) => guard(react.createElement(UsagePanel, null)),
			));

			// 主界面 · 输入框下方：当前会话用量常驻行
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register(
				{ name: "conversation.composer.dock", id: "usage-cost", order: 10 },
				(props) => guard(react.createElement(DockReadout, { sessionId: props.sessionId, session: props.session })),
			));

			// 主界面 · 侧边栏底部「用量」按钮
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register(
				{ name: "sidebar.footer.action", id: "usage-stats", order: 10, label: () => T('fab.label') },
				(props) => guard(react.createElement(FooterButton, { wide: props.wide })),
			));

			// 主界面 · 悬浮汇总面板 + 预算告警 toast
			ctx.slots.inject("shell.overlay", () => ctx.slots.register(
				{ name: "shell.overlay", id: "usage-stats-panel", order: 10 },
				() => guard(el('div', null,
					react.createElement(OverlayPanel, null),
					react.createElement(AlertToaster, null),
				)),
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

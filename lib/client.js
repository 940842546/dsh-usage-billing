window.__ModuleLoader__.load({
	id: "dsh-usage-billing",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		const EMPTY_BUCKET = { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 };

		const BAND_LABELS = {
			before: '8/17 前 · 旧价',
			afterPeak: '8/17 后 · 高峰',
			afterOffPeak: '8/17 后 · 空闲',
		};

		const MODEL_LABELS = { flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro', other: '其他模型' };

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

		function shortId(id) {
			if (typeof id !== 'string') return 'unknown';
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
.usg-hm-scroll { overflow-x: auto; max-width: 100%; }
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
.usg-hm-dense .usg-hm-cell { width: 7px; height: 7px; border-radius: 1.5px; }
.usg-hm-dense .usg-hm-grid { gap: 2px; }
.usg-hm-dense .usg-hm-col { grid-template-rows: repeat(7, 7px); row-gap: 2px; }
.usg-hm-dense .usg-hm-labels { grid-template-rows: repeat(7, 7px); row-gap: 2px; }
.usg-hm-dense .usg-hm-label { height: 7px; }
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
/* 主界面：悬浮汇总面板 */
.usg-ov { position: fixed; left: 12px; bottom: 100px; width: 340px; max-width: calc(100vw - 32px); max-height: 70vh; overflow-y: auto; pointer-events: auto; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); padding: 12px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: var(--dsw-alias-label-primary); }
.usg-ov-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.usg-ov-title { font-weight: 600; font-size: 14px; }
.usg-ov-close { border: none; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 16px; padding: 0 6px; border-radius: 6px; line-height: 22px; }
.usg-ov-close:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.usg-ov-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.usg-ov-stat { padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.usg-ov-stat-label { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.usg-ov-stat-value { font-weight: 700; font-size: 14px; white-space: nowrap; }
.usg-ov-stat-value.usg-cost { color: #60a5fa; }
@media (max-width: 640px) {
  .usg-stats-row { grid-template-columns: repeat(2, 1fr); }
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

		function bandStack(s) {
			const bandCosts = BAND_KEYS.map((bk) => (s.byBand[bk] || EMPTY_BUCKET).cost);
			const bandTotal = bandCosts.reduce((a, b) => a + b, 0);
			const segs = BAND_KEYS.map((bk, i) => {
				const pct = bandTotal > 0 ? Math.max(0.5, (bandCosts[i] / bandTotal) * 100) : 0;
				return el('div', {
					key: bk,
					className: 'usg-band-seg usg-seg-' + bk,
					style: { width: pct + '%' },
					title: BAND_LABELS[bk] + '：' + fmtCost(bandCosts[i]),
				});
			});
			const legend = BAND_KEYS.map((bk) => {
				const b = s.byBand[bk] || EMPTY_BUCKET;
				return el('div', { className: 'usg-legend-item', key: bk },
					el('span', { className: 'usg-legend-dot usg-seg-' + bk }),
					BAND_LABELS[bk] + ' · ' + fmtCost(b.cost),
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

		function cellTitle(label, b) {
			return label + '\n输入 ' + fmtTokens(b.input) + ' / 输出 ' + fmtTokens(b.output) + ' tokens\n' + fmtCost(b.cost) + ' · ' + b.calls + ' 次调用';
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
				'少',
				[1, 2, 3, 4].map((l) => el('div', { key: l, className: 'usg-hm-cell usg-hm-' + l })),
				'多',
			);
		}

		// 通用：按日网格热力图（周列 × 7 行，周一开头）
		function dayGridHeatMap(keys, getBucket, dense, tip) {
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
						...(tip ? tip.bind(cellTitle(key, b)) : {}),
					}));
				}
				cols.push(el('div', { className: 'usg-hm-col', key: c }, col));
			}
			const labels = ['', '一', '', '三', '', '五', '日'].map((t, i) =>
				el('div', { className: 'usg-hm-label', key: i }, t || ''),
			);
			return el('div', { className: 'usg-hm-wrap' + (dense ? ' usg-hm-dense' : '') },
				el('div', { className: 'usg-hm-scroll' },
					el('div', { className: 'usg-hm' },
						el('div', { className: 'usg-hm-labels' }, labels),
						el('div', { className: 'usg-hm-grid' }, cols),
					),
				),
				legendRow(),
				tip ? tip.bubble : null,
			);
		}

		// 「日」视图：今天 24 小时
		function hourHeatMap(s, tip) {
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
						...(tip ? tip.bind(cellTitle(today + ' ' + p2(h) + ':00', b)) : {}),
					}),
				));
			}
			return el('div', { className: 'usg-hm-wrap' },
				el('div', { className: 'usg-hm-scroll' },
					el('div', { className: 'usg-hm', style: { gap: 3 } },
						el('div', { className: 'usg-hm-grid', style: { gap: 3 } }, cells),
					),
				),
				legendRow(),
				tip ? tip.bubble : null,
			);
		}

		// 热力图入口：日（按小时）/ 周 / 月 / 年 / 累计
		function heatMap(s, range, tip) {
			const getDayBucket = (k) => (s.byDay && s.byDay[k]) || EMPTY_BUCKET;
			if (range === 'day') {
				if (!s.byHour || Object.keys(s.byHour).length === 0) {
					// 尚无小时级数据：显示 24 个占位灰格 + 提示
					const placeholders = [];
					for (let h = 0; h < 24; h++) {
						placeholders.push(el('div', { className: 'usg-hm-col', key: h },
							el('div', { className: 'usg-hm-cell', title: '暂无该小时数据' }),
						));
					}
					return el('div', { className: 'usg-hm-wrap' },
						el('div', { className: 'usg-warn' }, '小时级数据将在宿主重启后自动回填'),
						el('div', { className: 'usg-hm-scroll' },
							el('div', { className: 'usg-hm', style: { gap: 3 } },
								el('div', { className: 'usg-hm-grid', style: { gap: 3 } }, placeholders),
							),
						),
						legendRow(),
					);
				}
				return hourHeatMap(s, tip);
			}
			if (range === 'week') {
				const keys = [];
				for (let i = 6; i >= 0; i--) keys.push(beijingDateKey(-i));
				return dayGridHeatMap(keys, getDayBucket, false, tip);
			}
			if (range === 'year') {
				const keys = [];
				for (let i = 364; i >= 0; i--) keys.push(beijingDateKey(-i));
				return dayGridHeatMap(keys, getDayBucket, true, tip);
			}
			if (range === 'all') {
				// 累计：从有数据的第一天开始（防御：过滤异常键，最多回溯 730 天）
				const today = beijingDateKey(0);
				const days = Object.keys(s.byDay || {})
					.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= today)
					.sort();
				if (days.length === 0) {
					return el('div', { className: 'usg-hm-wrap' }, el('div', { className: 'usg-muted' }, '暂无数据'));
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
					truncated ? el('div', { className: 'usg-muted' }, '累计仅显示最近 730 天') : null,
					dayGridHeatMap(keys, getDayBucket, true, tip),
				);
			}
			// 默认：月（近 30 天）
			const keys = [];
			for (let i = 29; i >= 0; i--) keys.push(beijingDateKey(-i));
			return dayGridHeatMap(keys, getDayBucket, false, tip);
		}

		function RangeChips(props) {
			const options = [['day', '日'], ['week', '周'], ['month', '月'], ['year', '年'], ['all', '累计']];
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
						? fmtCost(x.cost) + ' · ' + x.calls + ' 次 · 输入 ' + fmtTokens(x.input) + ' / 输出 ' + fmtTokens(x.output)
						: fmtCost(x.cost) + ' · ' + x.calls + ' 次';
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

		// ---------- 主界面 · 输入框下方：当前会话用量 ----------
		function DockReadout(props) {
			const sessionId = typeof props.sessionId === 'string' && props.sessionId.length > 0
				? props.sessionId
				: (props.session && typeof props.session.id === 'string' ? props.session.id : null);
			const data = useStatsData(sessionId !== null, 10000);
			const s = normalizedStats(data);
			if (!s || !sessionId) return null;
			const b = s.bySession && s.bySession[sessionId];
			if (!b || b.calls <= 0) return null;
			return el('div', { className: 'usg-dock' },
				'本会话已用',
				el('span', { className: 'usg-dock-cost' }, fmtCost(b.cost)),
				'· ' + b.calls + ' 次调用',
				'· 输入 ' + fmtTokens(b.input),
				'· 输出 ' + fmtTokens(b.output),
			);
		}

		// ---------- 主界面 · 侧边栏底部按钮 ----------
		function FooterButton(props) {
			const [, force] = react.useState(0);
			react.useEffect(() => overlayStore.subscribe(() => force((v) => v + 1)), []);
			const data = useStatsData(true, 30000);
			const s = normalizedStats(data);
			const open = overlayStore.open;
			return el('button', {
				className: 'usg-fab',
				title: open ? '关闭用量统计面板' : '用量统计（全机汇总）',
				onClick: () => overlayStore.toggle(),
				'aria-pressed': open,
				style: props.wide ? null : { justifyContent: 'center', padding: '0 6px' },
			},
				el('span', null, open ? '用量 ▲' : '用量'),
				s && props.wide ? el('span', { className: 'usg-fab-badge' }, fmtCostShort(s.total.cost)) : null,
			);
		}

		// ---------- 主界面 · 悬浮汇总面板 ----------
		function OverlayPanel() {
			const [, force] = react.useState(0);
			const [range, setRange] = react.useState('month');
			const tip = useTip();
			react.useEffect(() => overlayStore.subscribe(() => force((v) => v + 1)), []);
			const data = useStatsData(overlayStore.open, 5000);
			if (!overlayStore.open) return null;
			const s = normalizedStats(data);
			return el('div', { className: 'usg-ov' },
				el('div', { className: 'usg-ov-head' },
					el('div', { className: 'usg-ov-title' }, '用量 · 消费统计'),
					el('button', { className: 'usg-ov-close', onClick: () => overlayStore.close(), 'aria-label': '关闭' }, '×'),
				),
				!s
					? el('div', { className: 'usg-muted' }, '加载中…')
					: el('div', null,
							el('div', { className: 'usg-ov-stats' },
								el('div', { className: 'usg-ov-stat' },
									el('div', { className: 'usg-ov-stat-label' }, '总费用'),
									el('div', { className: 'usg-ov-stat-value usg-cost' }, fmtCost(s.total.cost)),
								),
								el('div', { className: 'usg-ov-stat' },
									el('div', { className: 'usg-ov-stat-label' }, '调用次数'),
									el('div', { className: 'usg-ov-stat-value' }, String(s.total.calls)),
								),
								el('div', { className: 'usg-ov-stat' },
									el('div', { className: 'usg-ov-stat-label' }, '输出 tokens'),
									el('div', { className: 'usg-ov-stat-value' }, fmtTokens(s.total.output)),
								),
							),
							el('div', null,
								el('div', { className: 'usg-section' }, '计费分段占比'),
								bandStack(s),
							),
							el('div', null,
								el('div', { className: 'usg-head' },
									el('div', { className: 'usg-section' }, '用量热力图'),
									el(RangeChips, { value: range, onChange: setRange }),
								),
								heatMap(s, range, tip),
							),
							el('div', null,
								el('div', { className: 'usg-section' }, '会话消费 Top 5'),
								sessionBars(s, 5, false),
							),
							el('div', { className: 'usg-muted' }, '完整明细与按日统计见 设置 → 用量统计'),
						),
			);
		}

		// ---------- 设置页 · 详细面板 ----------
		function UsagePanel() {
			const [data, setData] = react.useState(null);
			const [range, setRange] = react.useState('month');
			const tip = useTip();
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
						if (alive) setError('加载失败：' + String(e && e.message ? e.message : e));
					}
				};
				load();
				const timer = window.setInterval(load, 5000);
				return () => { alive = false; window.clearInterval(timer); };
			}, []);

			const refresh = () => {
				fetchStats().then((d) => setData(d)).catch(() => {});
			};

			const onBackfill = async () => {
				setBackfilling(true);
				try {
					const res = await fetch('/usage-stats?action=backfill', { method: 'POST' });
					const r = await res.json();
					if (r && r.ok) {
						setNotice('已回填历史：扫描 ' + r.sessions + ' 个会话，找到 ' + r.found + ' 条调用记录');
						window.setTimeout(() => setNotice(''), 5000);
					} else {
						setError('回填失败：' + String(r && r.error ? r.error : '未知错误'));
					}
				} catch (e) {
					setError('回填失败：' + String(e && e.message ? e.message : e));
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
					setNotice('已清空统计');
					window.setTimeout(() => setNotice(''), 2500);
					refresh();
				} catch (e) {
					setError('清空失败：' + String(e && e.message ? e.message : e));
				}
			};

			const head = el('div', { className: 'usg-head' },
				el('div', { className: 'usg-title' }, '用量 · 消费统计'),
				el('div', { className: 'usg-actions' },
					el('button', { className: 'usg-btn', onClick: onBackfill, disabled: backfilling }, backfilling ? '回填中…' : '回填历史'),
					el('button', { className: 'usg-btn', onClick: refresh }, '刷新'),
					el('button', { className: confirming ? 'usg-btn usg-danger' : 'usg-btn', onClick: onClear }, confirming ? '再点一次确认清空' : '清空'),
				),
			);

			if (!data) {
				return el('div', { className: 'usg-panel' },
					head,
					el('div', { className: 'usg-muted' }, error || '加载中…'),
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
					el('div', { className: 'usg-model-name' }, MODEL_LABELS[key] || key),
					el('div', { className: 'usg-muted' }, b.calls + ' 次 · 输入 ' + fmtTokens(b.input) + ' · 输出 ' + fmtTokens(b.output)),
					el('div', { className: 'usg-model-cost' }, fmtCost(b.cost)),
				);
			};

			const recentRows = (s.recent || []).slice(0, 8).map((r) =>
				el('tr', { key: String(r.ts) + '-' + r.model + '-' + r.output },
					el('td', { className: 'usg-muted' }, r.time),
					el('td', null, MODEL_LABELS[r.modelKey] || r.model),
					el('td', null, BAND_LABELS[r.band] || r.band),
					el('td', { className: 'usg-num' }, fmtTokens(r.input)),
					el('td', { className: 'usg-num' }, fmtTokens(r.output)),
					el('td', { className: 'usg-num usg-strong' }, fmtCost(r.cost)),
				),
			);

			const priceRows = BAND_KEYS.map((bk) =>
				MODEL_KEYS.map((mk) => {
					const p = data.pricing && data.pricing[bk] && data.pricing[bk][mk];
					if (!p) return null;
					return el('tr', { key: bk + '-' + mk },
						el('td', null, BAND_LABELS[bk]),
						el('td', null, MODEL_LABELS[mk]),
						el('td', { className: 'usg-num' }, String(p.hit)),
						el('td', { className: 'usg-num' }, String(p.miss)),
						el('td', { className: 'usg-num' }, String(p.out)),
					);
				}),
			);

			const backfillNote = meta.lastBackfillAt > 0
				? '已回填历史：扫描 ' + meta.lastBackfillSessions + ' 个会话 · 共 ' + meta.lastBackfillFound + ' 条记录'
				: '仅统计插件启用后的调用，点击「回填历史」扫描所有会话日志';

			const persistNote = diag.lastError
				? '⚠ 持久化失败：' + diag.lastError + '（统计仅保存在内存，插件重启会丢失）'
				: (diag.statsFile ? '数据持久化：' + diag.statsFile : '数据仅保存在内存');

			const sessionRowsCount = Object.keys(s.bySession || {}).length;

			return el('div', { className: 'usg-panel' },
				head,
				error ? el('div', { className: 'usg-error' }, error) : null,
				notice ? el('div', { className: 'usg-ok' }, notice) : null,
				el('div', { className: 'usg-stats-row' },
					card('总费用', fmtCost(total.cost), backfillNote, ' usg-cost'),
					card('调用次数', String(total.calls), '按北京时间分段计费'),
					card('输入 tokens', fmtTokens(total.input), '命中 ' + fmtTokens(total.cacheHit) + ' / 未命中 ' + fmtTokens(total.cacheMiss)),
					card('输出 tokens', fmtTokens(total.output), '含思考输出'),
				),
				el('div', null,
					el('div', { className: 'usg-section' }, '计费分段占比'),
					bandStack(s),
				),
				el('div', null,
					el('div', { className: 'usg-head' },
						el('div', { className: 'usg-section' }, '用量热力图'),
						el(RangeChips, { value: range, onChange: setRange }),
					),
					heatMap(s, range, tip),
				),
				el('div', null,
					el('div', { className: 'usg-section' }, '按会话消费（Top 8 · 共 ' + sessionRowsCount + ' 个会话）'),
					sessionBars(s, 8, true),
				),
				el('div', null,
					el('div', { className: 'usg-section' }, '按模型'),
					el('div', null, ['flash', 'pro', 'other'].map(modelRow)),
				),
				el('div', null,
					el('div', { className: 'usg-section' }, '最近调用'),
					recentRows.length > 0
						? el('table', { className: 'usg-table' },
								el('thead', null, el('tr', null,
									el('th', null, '时间'), el('th', null, '模型'), el('th', null, '时段'),
									el('th', { className: 'usg-num' }, '输入'), el('th', { className: 'usg-num' }, '输出'), el('th', { className: 'usg-num' }, '费用'),
								)),
								el('tbody', null, recentRows),
							)
						: el('div', { className: 'usg-muted' }, '暂无调用记录'),
				),
				el('div', { className: diag.lastError ? 'usg-warn' : 'usg-muted' }, persistNote),
				el('details', { className: 'usg-pricing' },
					el('summary', null, '计费规则（元 / 百万 tokens）'),
					el('div', { className: 'usg-pricing-body' },
						el('p', { className: 'usg-muted', style: { margin: 0 } }, '调价边界：' + data.boundaryText + '；' + data.peakHoursText),
						el('table', { className: 'usg-table' },
							el('thead', null, el('tr', null,
								el('th', null, '时段'), el('th', null, '模型'),
								el('th', { className: 'usg-num' }, '命中'), el('th', { className: 'usg-num' }, '未命中'), el('th', { className: 'usg-num' }, '输出'),
							)),
							el('tbody', null, priceRows),
						),
					),
				),
			);
		}

		const inject = ["slots"];

		function apply(ctx) {
			ctx.effect(() => {
				const tag = document.createElement("style");
				tag.dataset.plugin = "@deepseek-ai/dsh-usage-billing";
				tag.textContent = CSS;
				document.head.appendChild(tag);
				return () => { tag.remove(); };
			}, "usage-stats: styles");

			// 设置页 · 详细面板
			ctx.slots.inject("settings.section", () => ctx.slots.register(
				{ name: "settings.section", id: "usage-stats", order: 25, label: "用量统计" },
				(props) => react.createElement(UsagePanel, null),
			));

			// 主界面 · 输入框下方：当前会话用量常驻行
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register(
				{ name: "conversation.composer.dock", id: "usage-cost", order: 10 },
				(props) => react.createElement(DockReadout, { sessionId: props.sessionId, session: props.session }),
			));

			// 主界面 · 侧边栏底部「用量」按钮
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register(
				{ name: "sidebar.footer.action", id: "usage-stats", order: 10, label: "用量" },
				(props) => react.createElement(FooterButton, { wide: props.wide }),
			));

			// 主界面 · 悬浮汇总面板
			ctx.slots.inject("shell.overlay", () => ctx.slots.register(
				{ name: "shell.overlay", id: "usage-stats-panel", order: 10 },
				() => react.createElement(OverlayPanel, null),
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});


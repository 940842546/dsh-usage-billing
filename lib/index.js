import { defineTool } from "@deepseek-ai/dsh-tools";

/**
 * dsh-usage-billing — DeepSeek API 用量与消费统计（Host half）。
 * 监听 llm/stream 统计所有模型调用，按北京时间计费：
 * 2026-08-17 00:00 前用旧价；之后峰谷定价（高峰 9:00–12:00、14:00–18:00）。
 * 按会话聚合（bySession），统计持久化到写策略根目录下的 .dsh-usage-billing.json（旧版 .dsh-usage-stats.json 自动迁移）。
 */

const BOUNDARY_MS = Date.UTC(2026, 7, 16, 16, 0, 0);
// flash 系列第二次调价：2026-09-10 12:00（北京时间）起。
// 之后 flash 空闲 hit 0.02 / miss 1 / out 4，高峰 = 空闲 × 2；pro 价格不变。
const FLASH_SEP_MS = Date.UTC(2026, 8, 10, 4, 0, 0);
// V4 Pro 下线并路由到 V4.1 Flash、按 Flash 价计费的生效点：2026-09-14 12:00（北京时间）。
// （官方首次公告曾定在 9/10，后改为 9/14——路由与 flash 调价是两个独立时间点。）
const PRO_ROUTE_FROM_MS = Date.UTC(2026, 8, 14, 4, 0, 0);
// 2026 年中国法定节假日（放假日期）+ 调休上班日：官方说明「调休上班的周末、法定节假日全天均按空闲时段计费」。
// 来源：国务院办公厅关于 2026 年部分节假日安排的通知（国办发明电〔2025〕7号）。
// 落在这些北京日期的调用一律按空闲计（无论周几）。
const HOLIDAYS_2026 = [
  // 元旦 1/1(四)–1/3(六)放假，1/4(日)上班
  '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
  // 春节 2/15(日)–2/23(一)放假，2/14(六)、2/28(六)上班
  '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23', '2026-02-28',
  // 清明 4/4(六)–4/6(一)放假
  '2026-04-04', '2026-04-05', '2026-04-06',
  // 劳动节 5/1(五)–5/5(二)放假，5/9(六)上班
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-09',
  // 端午 6/19(五)–6/21(日)放假
  '2026-06-19', '2026-06-20', '2026-06-21',
  // 中秋 9/25(五)–9/27(日)放假；国庆调休 9/20(日)上班
  '2026-09-20', '2026-09-25', '2026-09-26', '2026-09-27',
  // 国庆 10/1(四)–10/7(三)放假，10/10(六)上班
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
  '2026-10-06', '2026-10-07', '2026-10-10',
];

// 来源：国务院办公厅关于 2027 年部分节假日安排的通知（国办发明电〔2026〕10号，2026-11-05 发布）。
// 含放假日期与调休上班日（调休日虽为周末，列出来是为了让规则自解释）。
const HOLIDAYS_2027 = [
  // 元旦 1/1(五)–1/3(日)放假
  '2027-01-01', '2027-01-02', '2027-01-03',
  // 春节 2/5(除夕,五)–2/13(正月初八,六)放假，1/31(日)、2/14(日)上班
  '2027-01-31', '2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09',
  '2027-02-10', '2027-02-11', '2027-02-12', '2027-02-13', '2027-02-14',
  // 清明 4/3(六)–4/5(一)放假
  '2027-04-03', '2027-04-04', '2027-04-05',
  // 劳动节 5/1(六)–5/5(三)放假，5/8(六)上班
  '2027-05-01', '2027-05-02', '2027-05-03', '2027-05-04', '2027-05-05', '2027-05-08',
  // 端午 6/9(三)放假
  '2027-06-09',
  // 中秋 9/15(三)放假；国庆调休 9/26(日)上班
  '2027-09-15', '2027-09-26',
  // 国庆 10/1(五)–10/7(四)放假，10/9(六)上班
  '2027-10-01', '2027-10-02', '2027-10-03', '2027-10-04', '2027-10-05',
  '2027-10-06', '2027-10-07', '2027-10-09',
];

/** 内置非高峰日 = 已公布年份的法定节假日 + 调休上班日 */
const DEFAULT_OFF_PEAK_DAYS = HOLIDAYS_2026.concat(HOLIDAYS_2027);

// 内置第三方模型价目（各厂商官方标准价，2026-11 核对）。
// 仅对归类为 other 的模型生效；按数组顺序取第一条命中，故更具体的前缀必须排在前面。
// 单价单位：每百万 tokens；currency 为 usd 时按设置里的汇率折算成 CNY。
// 官方来源：
//   智谱 GLM  https://docs.bigmodel.cn/cn/guide/start/pricing
//   xAI  Grok  https://docs.x.ai/developers/pricing
//   腾讯 HY4   https://cloud.tencent.com/document/product/1823/130055
const BUILTIN_CUSTOM_MODELS = [
  // ── 智谱 GLM（元/百万 tokens）：hit=缓存命中，miss=未缓存输入，out=输出
  // https://docs.bigmodel.cn/cn/guide/start/pricing
  { match: 'glm-5.3-flash', currency: 'cny', hit: 0.23, miss: 0.8, out: 2.8 },
  { match: 'glm-5.3', currency: 'cny', hit: 2, miss: 8, out: 28 },
  { match: 'glm-5.2', currency: 'cny', hit: 2, miss: 8, out: 28 },

  // ── xAI Grok（美元/百万 tokens，<200k 上下文标准价）
  // https://docs.x.ai/developers/pricing
  { match: 'grok-4.7', currency: 'usd', hit: 0.5, miss: 2, out: 6 },
  { match: 'grok-4.6', currency: 'usd', hit: 0.5, miss: 2, out: 6 },

  // ── 腾讯混元 HY4（元/百万 tokens，目录价；官方 2026-12-31 前有五折活动）
  // https://cloud.tencent.com/document/product/1823/130055
  { match: 'hy4-preview', currency: 'cny', hit: 0.3, miss: 6, out: 18 },
  { match: 'hy4', currency: 'cny', hit: 0.3, miss: 6, out: 18 },

  // ── OpenAI（美元/百万 tokens，Standard + 短上下文 ≤272K）
  // https://developers.openai.com/api/docs/pricing
  { match: 'gpt-6-astra', currency: 'usd', hit: 1, miss: 10, out: 50 },
  { match: 'gpt-6.1-sol', currency: 'usd', hit: 0.1, miss: 2, out: 10 },
  { match: 'gpt-6.1-terra', currency: 'usd', hit: 0.05, miss: 1, out: 5 },
  { match: 'gpt-6-luna', currency: 'usd', hit: 0.01, miss: 0.1, out: 0.5 },
  { match: 'gpt-6-sol', currency: 'usd', hit: 0.2, miss: 2, out: 10 },
  { match: 'gpt-5.6-sol', currency: 'usd', hit: 0.4, miss: 4, out: 20 },
  { match: 'gpt-5.6-terra', currency: 'usd', hit: 0.2, miss: 2, out: 12 },
  { match: 'gpt-5.6-luna', currency: 'usd', hit: 0.02, miss: 0.2, out: 1.2 },
  { match: 'gpt-5.5-pro', currency: 'usd', hit: 30, miss: 30, out: 180 },
  { match: 'gpt-5.5', currency: 'usd', hit: 0.5, miss: 5, out: 30 },
  { match: 'gpt-5.4-pro', currency: 'usd', hit: 30, miss: 30, out: 180 },
  { match: 'gpt-5.4-mini', currency: 'usd', hit: 0.075, miss: 0.75, out: 4.5 },
  { match: 'gpt-5.4-nano', currency: 'usd', hit: 0.02, miss: 0.2, out: 1.25 },
  { match: 'gpt-5.4', currency: 'usd', hit: 0.25, miss: 2.5, out: 15 },
  { match: 'gpt-5.2-pro', currency: 'usd', hit: 21, miss: 21, out: 168 },
  { match: 'gpt-5.2', currency: 'usd', hit: 0.175, miss: 1.75, out: 14 },
  { match: 'gpt-5.1', currency: 'usd', hit: 0.125, miss: 1.25, out: 10 },
  { match: 'gpt-5-pro', currency: 'usd', hit: 15, miss: 15, out: 120 },
  { match: 'gpt-5-mini', currency: 'usd', hit: 0.025, miss: 0.25, out: 2 },
  { match: 'gpt-5-nano', currency: 'usd', hit: 0.005, miss: 0.05, out: 0.4 },
  { match: 'gpt-5', currency: 'usd', hit: 0.125, miss: 1.25, out: 10 },
  { match: 'gpt-4.1-mini', currency: 'usd', hit: 0.1, miss: 0.4, out: 1.6 },
  { match: 'gpt-4.1', currency: 'usd', hit: 0.5, miss: 2, out: 8 },
  { match: 'gpt-4o-mini', currency: 'usd', hit: 0.075, miss: 0.15, out: 0.6 },
  { match: 'gpt-4o', currency: 'usd', hit: 1.25, miss: 2.5, out: 10 },
  { match: 'o3', currency: 'usd', hit: 0.5, miss: 2, out: 8 },

  // ── Anthropic Claude（美元/百万 tokens，标准价；模型 ID 形如 claude-opus-4-5）
  // https://platform.claude.com/docs/en/about-claude/pricing
  { match: 'claude-opus-5-5', currency: 'usd', hit: 0.2, miss: 4, out: 20 },
  { match: 'claude-opus-5', currency: 'usd', hit: 0.5, miss: 5, out: 25 },
  { match: 'claude-opus-4-8', currency: 'usd', hit: 0.5, miss: 5, out: 25 },
  { match: 'claude-opus-4-7', currency: 'usd', hit: 0.5, miss: 5, out: 25 },
  { match: 'claude-opus-4-6', currency: 'usd', hit: 0.5, miss: 5, out: 25 },
  { match: 'claude-opus-4-5', currency: 'usd', hit: 0.5, miss: 5, out: 25 },
  { match: 'claude-opus-4-1', currency: 'usd', hit: 1.5, miss: 15, out: 75 },
  { match: 'claude-opus-4', currency: 'usd', hit: 0.5, miss: 5, out: 25 },
  { match: 'claude-sonnet-5-5', currency: 'usd', hit: 0.1, miss: 2, out: 10 },
  { match: 'claude-sonnet-5', currency: 'usd', hit: 0.2, miss: 2, out: 10 },
  { match: 'claude-sonnet-4-6', currency: 'usd', hit: 0.3, miss: 3, out: 15 },
  { match: 'claude-sonnet-4-5', currency: 'usd', hit: 0.3, miss: 3, out: 15 },
  { match: 'claude-sonnet-4', currency: 'usd', hit: 0.3, miss: 3, out: 15 },
  { match: 'claude-haiku-5-5', currency: 'usd', hit: 0.01, miss: 0.1, out: 0.5 },
  { match: 'claude-haiku-4-5', currency: 'usd', hit: 0.1, miss: 1, out: 5 },
  { match: 'claude-haiku-4', currency: 'usd', hit: 0.1, miss: 1, out: 5 },

  // ── Moonshot Kimi（元/百万 tokens，K3 系列标准价；highspeed 更贵，必须排前面）
  // https://platform.kimi.com/docs/pricing/chat
  { match: 'kimi-k3.1-pro-highspeed', currency: 'cny', hit: 1.3, miss: 26, out: 136 },
  { match: 'kimi-k3.1-pro', currency: 'cny', hit: 1.3, miss: 13, out: 68 },
  { match: 'kimi-k3', currency: 'cny', hit: 2, miss: 20, out: 100 },
  { match: 'kimi-k2.7-code-highspeed', currency: 'cny', hit: 2.6, miss: 13, out: 54 },
  { match: 'kimi-k2.7-code', currency: 'cny', hit: 1.3, miss: 6.5, out: 27 },
  { match: 'kimi-k2.6', currency: 'cny', hit: 1.1, miss: 6.5, out: 27 },

  // ── Google Gemini（美元/百万 tokens，Paid 层标准价；部分价格 2026-12/2027-01 起上调，此处取当前标准价）
  // https://ai.google.dev/gemini-api/docs/pricing
  { match: 'gemini-4-argon', currency: 'usd', hit: 0.1, miss: 2, out: 10 },
  { match: 'gemini-3.8-flash', currency: 'usd', hit: 0.075, miss: 0.75, out: 3.75 },
  { match: 'gemini-3.6-flash', currency: 'usd', hit: 0.075, miss: 0.75, out: 3.75 },
  { match: 'gemini-3.5-flash-lite', currency: 'usd', hit: 0.03, miss: 0.3, out: 2.5 },
  { match: 'gemini-3.1-flash-lite', currency: 'usd', hit: 0.025, miss: 0.25, out: 1.5 },
  { match: 'gemini-3.1-pro', currency: 'usd', hit: 0.2, miss: 2, out: 12 },

  // ── 字节豆包（元/百万 tokens，火山方舟在线推理标准价；长上下文阶梯取 [0,32K] 档）
  // https://www.volcengine.com/docs/82379/1099320
  { match: 'doubao-seed-evolving', currency: 'cny', hit: 1.2, miss: 6, out: 30 },
  { match: 'doubao-seed-2.1-pro', currency: 'cny', hit: 1.2, miss: 6, out: 30 },
  { match: 'doubao-seed-2.1-lite', currency: 'cny', hit: 0.16, miss: 0.8, out: 2.7 },
  { match: 'doubao-seed-2.1-turbo', currency: 'cny', hit: 0.6, miss: 3, out: 15 },
  { match: 'doubao-seed-2.0-pro', currency: 'cny', hit: 0.64, miss: 3.2, out: 16 },
  { match: 'doubao-seed-2.0-lite', currency: 'cny', hit: 0.12, miss: 0.6, out: 3.6 },
  { match: 'doubao-seed-2.0-mini', currency: 'cny', hit: 0.04, miss: 0.2, out: 2 },
  { match: 'doubao-seed-2.0-code', currency: 'cny', hit: 0.64, miss: 3.2, out: 16 },
  { match: 'doubao-seed-character', currency: 'cny', hit: 0.16, miss: 0.8, out: 2 },
  { match: 'doubao-seed-translation', currency: 'cny', hit: 1.2, miss: 1.2, out: 3.6 },
];

// 0.12.0 初次内置的 7 条价目。旧配置里如果有且恰好等于这一组，
// 说明它只是插件写进去的默认值，升级时应替换为最新内置表（用户真改过则保留）。
const LEGACY_BUILTIN_CUSTOM_MODELS_V1 = [
  { match: 'glm-5.3-flash', currency: 'cny', hit: 0.23, miss: 0.8, out: 2.8 },
  { match: 'glm-5.3', currency: 'cny', hit: 2, miss: 8, out: 28 },
  { match: 'glm-5.2', currency: 'cny', hit: 2, miss: 8, out: 28 },
  { match: 'grok-4.7', currency: 'usd', hit: 0.5, miss: 2, out: 6 },
  { match: 'grok-4.6', currency: 'usd', hit: 0.5, miss: 2, out: 6 },
  { match: 'hy4-preview', currency: 'cny', hit: 0.3, miss: 6, out: 18 },
  { match: 'hy4', currency: 'cny', hit: 0.3, miss: 6, out: 18 },
];

const PRICING = {
  before: { flash: { hit: 0.02, miss: 1, out: 2 }, pro: { hit: 0.025, miss: 3, out: 6 } },
  afterOffPeak: { flash: { hit: 0.05, miss: 1.5, out: 4.5 }, pro: { hit: 0.15, miss: 4.5, out: 13.5 } },
  afterPeak: { flash: { hit: 0.1, miss: 3, out: 9 }, pro: { hit: 0.3, miss: 9, out: 27 } },
  sepOffPeak: { flash: { hit: 0.02, miss: 1, out: 4 }, pro: { hit: 0.15, miss: 4.5, out: 13.5 } },
  sepPeak: { flash: { hit: 0.04, miss: 2, out: 8 }, pro: { hit: 0.3, miss: 9, out: 27 } },
};

const BAND_KEYS = ['before', 'afterPeak', 'afterOffPeak', 'sepPeak', 'sepOffPeak'];
const MODEL_KEYS = ['flash', 'pro'];

function clonePricing(p) {
  const out = {};
  for (const band of BAND_KEYS) {
    out[band] = {};
    for (const model of MODEL_KEYS) {
      const s = p[band] && p[band][model] ? p[band][model] : { hit: 0, miss: 0, out: 0 };
      out[band][model] = { hit: s.hit, miss: s.miss, out: s.out };
    }
  }
  return out;
}

/** 用户可编辑配置的默认值（价格/峰值时段/调价边界/预算/余额开关/汇率）。 */
const DEFAULT_USD_CNY = 6.7878; // 2026-08-14 人民币兑美元中间价
// 「高峰仅工作日」规则的生效点：2026-08-23 00:00（北京时间）。
// 在此之前周末 9-12/14-18 仍按高峰计；官方调价不追溯历史。
const PEAK_WEEKDAY_FROM_MS = Date.UTC(2026, 7, 22, 16, 0, 0);
function defaultConfig() {
  return {
    boundaryMs: BOUNDARY_MS,
    peakWeekdayFromMs: PEAK_WEEKDAY_FROM_MS,
    flashSepMs: FLASH_SEP_MS,
    peakHours: [9, 12, 14, 18],
    pricing: clonePricing(PRICING),
    budgetDaily: null,
    budgetMonthly: null,
    balanceEnabled: true,
    // 余额提醒阈值（与余额同币种）；0/null 表示关闭。默认 20 作为安全网。
    balanceAlertBelow: 20,
    usdCny: DEFAULT_USD_CNY,
    // 官方 2026-09-11 更新：V4 Pro 9/14 后继续提供服务、计费方式不变 → 不再路由、仍按 pro 价计。
    // 字段保留（供将来官方若恢复路由时开启），当前固定关闭。
    proRoutesToFlash: false,
    proRouteFromMs: PRO_ROUTE_FROM_MS,
    holidayDays: DEFAULT_OFF_PEAK_DAYS.slice(),
    holidayDaysSource: 'builtin',
    // 非 DeepSeek 模型的自定义价目：按模型名子串匹配（不区分大小写），按顺序取第一条命中。
    // 目的是让 glm / grok / hy4 这类归入 other 的调用也能算出真实花费。
    // 默认内置各厂商官方标准价（BUILTIN_CUSTOM_MODELS），设置页可增删改。
    customModels: BUILTIN_CUSTOM_MODELS.map((r) => ({ ...r })),
    customModelsSource: 'builtin',
  };
}

function bucket() {
  return { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 };
}

function sessionBucket() {
  return {
    calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0, lastAt: 0, title: null,
    // 会话内分布（供详情面板展示「时段花费 / 模型用量」，避免用 recent 近似）
    byBand: {}, byModel: {},
    // 仅保留「当天」小计：跨日时重置，不随历史增长
    today: { date: '', calls: 0, cost: 0 },
  };
}

function emptyStats() {
  return {
    version: 1,
    updatedAt: 0,
    meta: { liveSince: 0, lastBackfillAt: 0, lastBackfillSessions: 0, lastBackfillFound: 0, sessionAttribution: false, schemaVersion: 13 },
    total: bucket(),
    byBand: { before: bucket(), afterPeak: bucket(), afterOffPeak: bucket(), sepPeak: bucket(), sepOffPeak: bucket() },
    byModel: { flash: bucket(), pro: bucket(), other: bucket() },
    bySession: {},
    byDay: {},
    byHour: {},
    recent: [],
    config: defaultConfig(),
  };
}

function pad(n) { return n < 10 ? '0' + n : String(n); }

function beijingParts(ts) {
  const d = new Date(ts + 8 * 3600 * 1000);
  const date = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const time = date + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  return { hour: d.getUTCHours(), date, time, weekday: d.getUTCDay() };
}

/** 高峰判断：peakWeekdayFrom 之后仅工作日有高峰（周末空闲）；之前周末同样计高峰（旧规则） */
function isPeakHour(hour, peak, weekday, peakWeekdayFrom, ts) {
  const p = Array.isArray(peak) && peak.length === 4 ? peak : [9, 12, 14, 18];
  const inWindow = (hour >= p[0] && hour < p[1]) || (hour >= p[2] && hour < p[3]);
  if (!inWindow) return false;
  if (!(ts < peakWeekdayFrom)) return weekday !== 0 && weekday !== 6; // 新规则
  return true; // 生效点之前：不看星期
}

function bandOf(ts, cfg) {
  const sep = Number(cfg.flashSepMs) > 0 ? cfg.flashSepMs : FLASH_SEP_MS;
  if (ts < cfg.boundaryMs) return 'before';
  const bp = beijingParts(ts);
  // 法定节假日 / 调休上班日：全天按空闲计费（优先于周几与时段判断）
  const holidays = Array.isArray(cfg.holidayDays) ? cfg.holidayDays : [];
  const isHoliday = holidays.indexOf(bp.date) >= 0;
  const from = Number(cfg.peakWeekdayFromMs) > 0 ? cfg.peakWeekdayFromMs : PEAK_WEEKDAY_FROM_MS;
  const peak = !isHoliday && isPeakHour(bp.hour, cfg.peakHours, bp.weekday, from, ts);
  if (ts >= sep) return peak ? 'sepPeak' : 'sepOffPeak';
  return peak ? 'afterPeak' : 'afterOffPeak';
}

function classifyModel(name) {
  if (typeof name !== 'string') return 'other';
  const n = name.toLowerCase();
  if (n.indexOf('flash') >= 0) return 'flash';
  if (n.indexOf('pro') >= 0) return 'pro';
  return 'other';
}

function pickModel(options) {
  if (!options || typeof options !== 'object') return 'unknown';
  const cands = [
    options.model,
    options.config ? options.config.model : undefined,
    options.request ? options.request.model : undefined,
  ];
  for (const cand of cands) {
    if (typeof cand === 'string' && cand.length > 0) return cand;
  }
  return 'unknown';
}

function num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** TokenUsage（互斥计数）→ { input, cacheHit, cacheMiss, output } */
function normalizeUsage(u) {
  if (!u || typeof u !== 'object') return null;
  let uncached = 0;
  let cached = 0;
  let output = 0;
  if (typeof u.inputTokens === 'number') {
    uncached = u.inputTokens;
  } else if (typeof u.prompt_tokens === 'number') {
    let hit = 0;
    if (typeof u.prompt_cache_hit_tokens === 'number') hit = u.prompt_cache_hit_tokens;
    else if (u.prompt_tokens_details && typeof u.prompt_tokens_details === 'object' && typeof u.prompt_tokens_details.cached_tokens === 'number') hit = u.prompt_tokens_details.cached_tokens;
    uncached = Math.max(0, u.prompt_tokens - hit);
    cached = hit;
  }
  if (typeof u.cacheReadTokens === 'number') cached += u.cacheReadTokens;
  if (typeof u.cacheWriteTokens === 'number') cached += u.cacheWriteTokens;
  if (typeof u.outputTokens === 'number') output = u.outputTokens;
  else if (typeof u.completion_tokens === 'number') output = u.completion_tokens;
  if (uncached <= 0 && cached <= 0 && output <= 0) return null;
  return { input: uncached + cached, cacheHit: cached, cacheMiss: uncached, output };
}

function extractUsage(chunk) {
  if (!chunk || typeof chunk !== 'object') return null;
  let u = null;
  if (chunk.usage && typeof chunk.usage === 'object') u = chunk.usage;
  else if (chunk.delta && chunk.delta.usage && typeof chunk.delta.usage === 'object') u = chunk.delta.usage;
  else if (chunk.message_delta && chunk.message_delta.usage && typeof chunk.message_delta.usage === 'object') u = chunk.message_delta.usage;
  if (!u) return null;
  return normalizeUsage(u);
}

function add(b, e) {
  b.calls += e.calls;
  b.input += e.input;
  b.cacheHit += e.cacheHit;
  b.cacheMiss += e.cacheMiss;
  b.output += e.output;
  b.cost += e.cost;
}

function roundCost(c) { return Math.round(c * 1e6) / 1e6; }

function sanitizePrice(v, def) {
  if (v === '' || v === null || v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

function sanitizeBudget(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 校验并归一化客户端提交的配置；非法字段回退默认值。 */
function sanitizeConfig(raw) {
  const d = defaultConfig();
  if (!raw || typeof raw !== 'object') return d;
  const pricing = {};
  for (const band of BAND_KEYS) {
    pricing[band] = {};
    for (const model of MODEL_KEYS) {
      const src = raw.pricing && raw.pricing[band] && raw.pricing[band][model];
      const def = d.pricing[band][model];
      pricing[band][model] = {
        hit: sanitizePrice(src && src.hit, def.hit),
        miss: sanitizePrice(src && src.miss, def.miss),
        out: sanitizePrice(src && src.out, def.out),
      };
    }
  }
  let peakHours = d.peakHours.slice();
  if (Array.isArray(raw.peakHours) && raw.peakHours.length === 4) {
    const h = raw.peakHours.map((x) => Math.round(Number(x)));
    if (h.every((x) => Number.isInteger(x) && x >= 0 && x <= 24)) peakHours = h;
  }
  const boundary = Number(raw.boundaryMs);
  const usdCny = Number(raw.usdCny);
  const peakWeekdayFrom = Number(raw.peakWeekdayFromMs);
  const flashSep = Number(raw.flashSepMs);
  const proRouteFrom = Number(raw.proRouteFromMs);
  return {
    boundaryMs: Number.isFinite(boundary) && boundary > 0 ? boundary : d.boundaryMs,
    peakWeekdayFromMs: Number.isFinite(peakWeekdayFrom) && peakWeekdayFrom > 0 ? peakWeekdayFrom : d.peakWeekdayFromMs,
    flashSepMs: Number.isFinite(flashSep) && flashSep > 0 ? flashSep : d.flashSepMs,
    proRouteFromMs: Number.isFinite(proRouteFrom) && proRouteFrom > 0 ? proRouteFrom : d.proRouteFromMs,
    peakHours,
    pricing,
    budgetDaily: sanitizeBudget(raw.budgetDaily),
    budgetMonthly: sanitizeBudget(raw.budgetMonthly),
    balanceEnabled: typeof raw.balanceEnabled === 'boolean' ? raw.balanceEnabled : true,
    balanceAlertBelow: raw.balanceAlertBelow === undefined ? 20 : sanitizeBudget(raw.balanceAlertBelow),
    usdCny: Number.isFinite(usdCny) && usdCny > 0 ? usdCny : d.usdCny,
    // 强制关闭：官方已确认 V4 Pro 继续服务、计费不变；旧配置文件里的 true 一律纠正
    proRoutesToFlash: false,
    // 节假日名单来源：'builtin' 跟随内置日历升级（新一年公布后自动下发）；
    // 'user' 表示用户编辑过，原样保留。旧配置若恰好等于 2026 旧默认，视为 builtin 并升级。
    holidayDays: (() => {
      const provided = Array.isArray(raw.holidayDays) ? sanitizeHolidayDays(raw.holidayDays) : null;
      const source = raw.holidayDaysSource;
      if (source === 'user') return provided || [];
      if (source === 'builtin') return DEFAULT_OFF_PEAK_DAYS.slice();
      if (provided && !sameDateSet(provided, HOLIDAYS_2026)) return provided;
      return DEFAULT_OFF_PEAK_DAYS.slice();
    })(),
    holidayDaysSource: (() => {
      const source = raw.holidayDaysSource;
      if (source === 'user') return 'user';
      if (source === 'builtin') return 'builtin';
      const provided = Array.isArray(raw.holidayDays) ? sanitizeHolidayDays(raw.holidayDays) : null;
      return provided && !sameDateSet(provided, HOLIDAYS_2026) ? 'user' : 'builtin';
    })(),
    // 价目表来源判定：
    // 价目表来源：
    //  - customModelsSource='user'（或旧字段 customModelsEdited=true）→ 用户改过，原样保留；
    //  - 'builtin' → 跟随插件内置表升级（每次扩充内置价目都会自动下发）；
    //  - 无标记（旧配置）→ 内容恰为 0.12.0 的 7 条视为插件旧默认值，否则按用户自定义保留。
    customModels: (() => {
      const provided = Array.isArray(raw.customModels) ? sanitizeCustomModels(raw.customModels) : null;
      const source = raw.customModelsSource;
      if (source === 'user' || raw.customModelsEdited === true) return provided || [];
      if (source === 'builtin') return BUILTIN_CUSTOM_MODELS.map((r) => ({ ...r }));
      if (provided && !sameCustomModels(provided, LEGACY_BUILTIN_CUSTOM_MODELS_V1)) return provided;
      return BUILTIN_CUSTOM_MODELS.map((r) => ({ ...r }));
    })(),
    customModelsSource: (() => {
      const source = raw.customModelsSource;
      if (source === 'user' || raw.customModelsEdited === true) return 'user';
      if (source === 'builtin') return 'builtin';
      const provided = Array.isArray(raw.customModels) ? sanitizeCustomModels(raw.customModels) : null;
      return provided && !sameCustomModels(provided, LEGACY_BUILTIN_CUSTOM_MODELS_V1) ? 'user' : 'builtin';
    })(),
  };
}

/** 判断两个日期集合是否等价（顺序无关）。 */
function sameDateSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const x = a.slice().sort();
  const y = b.slice().sort();
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

/** 判断两组价目是否等价（用于区分「用户改过」与「仍是内置默认」）。 */
function sameCustomModels(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] || {};
    const y = b[i] || {};
    if (x.match !== y.match || x.currency !== y.currency) return false;
    if (Number(x.hit) !== Number(y.hit) || Number(x.miss) !== Number(y.miss) || Number(x.out) !== Number(y.out)) return false;
  }
  return true;
}

/** 非 DeepSeek 模型价目：match 为模型名子串，currency 决定单价货币（汇总统一折算成 CNY）。 */
function sanitizeCustomModels(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 80)) {
    if (!item || typeof item !== 'object') continue;
    const match = typeof item.match === 'string' ? item.match.trim().toLowerCase() : '';
    if (!match) continue;
    out.push({
      match,
      currency: item.currency === 'usd' ? 'usd' : 'cny',
      hit: sanitizePrice(item.hit, 0),
      miss: sanitizePrice(item.miss, 0),
      out: sanitizePrice(item.out, 0),
    });
  }
  return out;
}

/** 按模型名查自定义价目（归一化后的小写子串匹配）。 */
function findCustomPrice(cfg, modelName) {
  const list = cfg && Array.isArray(cfg.customModels) ? cfg.customModels : [];
  if (list.length === 0 || typeof modelName !== 'string' || modelName.length === 0) return null;
  const name = modelName.toLowerCase();
  for (const rule of list) {
    if (rule && typeof rule.match === 'string' && rule.match.length > 0 && name.indexOf(rule.match) >= 0) return rule;
  }
  return null;
}

/** 校验非高峰日期集合：仅接受 YYYY-MM-DD，去重排序；缺失或全非法时回退内置日历。 */
function sanitizeHolidayDays(raw) {
  if (!Array.isArray(raw)) return DEFAULT_OFF_PEAK_DAYS.slice();
  const out = [];
  const seen = new Set();
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  out.sort();
  return out.length > 0 ? out : DEFAULT_OFF_PEAK_DAYS.slice();
}

function computeBudget(s, cfg) {
  const today = beijingParts(Date.now()).date;
  const month = today.slice(0, 7);
  let daily = 0;
  let monthly = 0;
  for (const k of Object.keys(s.byDay || {})) {
    const c = (s.byDay[k] && s.byDay[k].cost) || 0;
    if (k === today) daily += c;
    if (k.slice(0, 7) === month) monthly += c;
  }
  // 近 7 天（不含今日）日均，用于单日突增判断
  let prev7 = 0;
  for (let i = 1; i <= 7; i++) {
    const key = beijingParts(Date.now() - i * 86400000).date;
    prev7 += (s.byDay && s.byDay[key] && s.byDay[key].cost) || 0;
  }
  const avg7 = roundCost(prev7 / 7);
  // 月末预测：按本月已过天数线性外推
  const dayOfMonth = Number(today.slice(8, 10)) || 1;
  const year = Number(today.slice(0, 4));
  const monthNum = Number(today.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const projected = monthly > 0 ? roundCost((monthly / dayOfMonth) * daysInMonth) : 0;
  return {
    daily: { limit: cfg.budgetDaily, spent: roundCost(daily), avg7 },
    monthly: {
      limit: cfg.budgetMonthly,
      spent: roundCost(monthly),
      projected,
      daysLeft: Math.max(0, daysInMonth - dayOfMonth),
      daysInMonth,
    },
  };
}

/** 消费水平：null=未设预算 0=安全 1=接近(>=80%) 2=超支(>=100%) */
function budgetLevel(spent, limit) {
  if (limit == null || limit <= 0) return 0;
  if (spent >= limit) return 2;
  if (spent >= limit * 0.8) return 1;
  return 0;
}

/** 余额续航：按近 7 天日均花费估算官方余额可用天数与耗尽日期。数据不足/花费为零返回 null。 */
function computeRunway(s, balanceTotal) {
  if (!(balanceTotal > 0)) return null;
  const today = beijingParts(Date.now()).date;
  const dayMs = 86400000;
  let spent = 0;
  let days = 0;
  for (let i = 0; i < 7; i++) {
    const start = Math.floor((Date.now() + 8 * 3600000) / dayMs) * dayMs - 8 * 3600000 - i * dayMs;
    const d = new Date(start + 8 * 3600000);
    const key = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    if (key === today) continue; // 今日尚在进行，不计入日均
    const b = s.byDay && s.byDay[key];
    if (b && b.cost > 0) { spent += b.cost; days += 1; }
  }
  if (days < 3) return null; // 有效样本不足（装了没几天/没消费）
  const daily = spent / days;
  if (daily <= 0) return null;
  const leftDays = Math.max(0, Math.floor(balanceTotal / daily));
  const exhaust = new Date(Date.now() + leftDays * dayMs + 8 * 3600000);
  const exhaustDate = exhaust.getUTCFullYear() + '-' + pad(exhaust.getUTCMonth() + 1) + '-' + pad(exhaust.getUTCDate());
  return { dailyAvg: roundCost(daily), days: leftDays, exhaustDate, balance: roundCost(balanceTotal) };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) { reject(new Error('body too large')); return; }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve(null);
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('invalid JSON: ' + String(e && e.message ? e.message : e))); }
    });
    req.on('error', reject);
  });
}

/** 稳定短 ETag（FNV-1a 变体）：同一份内容得到同一摘要，供轮询走 304 */
function makeEtag(raw) {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'W/"' + (h >>> 0).toString(36) + '-' + raw.length.toString(36) + '"';
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  // 防公式注入：以 = + - @ 制表符/回车开头的单元格在 Excel 中会被当公式执行
  const guarded = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(guarded) ? '"' + guarded.replace(/"/g, '""') + '"' : guarded;
}

function exportStats(res, format, scope) {
  if (format === 'json') {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), stats, config: stats.config || defaultConfig() }, null, 2);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dsh-usage-billing.json"');
    res.end(payload);
    return;
  }
  let header;
  let rows;
  if (scope === 'session') {
    header = ['session_id', 'title', 'calls', 'input_tokens', 'cache_hit_tokens', 'cache_miss_tokens', 'output_tokens', 'cost_rmb'];
    rows = Object.keys(stats.bySession || {}).map((id) => {
      const b = stats.bySession[id] || {};
      return [id, b.title || '', b.calls || 0, b.input || 0, b.cacheHit || 0, b.cacheMiss || 0, b.output || 0, roundCost(b.cost || 0)];
    });
    rows.sort((a, b) => b[7] - a[7]);
  } else {
    header = ['date', 'calls', 'input_tokens', 'cache_hit_tokens', 'cache_miss_tokens', 'output_tokens', 'cost_rmb'];
    rows = Object.keys(stats.byDay || {}).sort().map((k) => {
      const b = stats.byDay[k] || {};
      return [k, b.calls || 0, b.input || 0, b.cacheHit || 0, b.cacheMiss || 0, b.output || 0, roundCost(b.cost || 0)];
    });
  }
  const lines = [header.join(',')].concat(rows.map((r) => r.map(csvCell).join(',')));
  const csv = lines.join('\r\n') + '\r\n';
  const dayKeys = Object.keys(stats.byDay || {}).sort();
  const today = beijingParts(Date.now()).date;
  const range = dayKeys.length > 0 ? dayKeys[0] + '_' + (dayKeys[dayKeys.length - 1] > today ? today : dayKeys[dayKeys.length - 1]) : today;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="dsh-usage-' + (scope === 'session' ? 'sessions' : 'daily') + '-' + range + '.csv"');
  res.end('\ufeff' + csv);
}

/** 按范围聚合一个桶：today=今日，month=本月，all=全量。 */
function scopeAggregate(s, scope) {
  if (scope !== 'today' && scope !== 'month') return null; // all：调用方直接用 stats
  const now = beijingParts(Date.now());
  const acc = bucket();
  for (const k of Object.keys(s.byDay || {})) {
    if (scope === 'today' ? k !== now.date : k.slice(0, 7) !== now.date.slice(0, 7)) continue;
    const b = s.byDay[k];
    if (b) add(acc, { ...b });
  }
  return acc;
}

/** 按维度给出有序排行（供 usage_billing 工具的 group 参数使用，口径为全量）。 */
function groupStats(s, kind, limit) {
  const n = Math.max(1, Math.min(50, Math.round(Number(limit) || 10)));
  let entries;
  if (kind === 'model') entries = Object.keys(s.byModel || {}).map((k) => ({ key: k, b: s.byModel[k] || {} }));
  else if (kind === 'band') entries = Object.keys(s.byBand || {}).map((k) => ({ key: k, b: s.byBand[k] || {} }));
  else if (kind === 'day') entries = Object.keys(s.byDay || {}).map((k) => ({ key: k, b: s.byDay[k] || {} }));
  else if (kind === 'session') entries = Object.keys(s.bySession || {}).map((k) => ({ key: k, title: s.bySession[k] && s.bySession[k].title, b: s.bySession[k] || {} }));
  else return { kind, error: 'unknown group: ' + String(kind) };
  if (kind === 'day') entries.sort((a, b) => (a.key < b.key ? 1 : -1));
  else entries.sort((a, b) => (Number(b.b.cost) || 0) - (Number(a.b.cost) || 0));
  const rows = entries.slice(0, n).map((e) => ({
    key: e.key,
    ...(e.title ? { title: e.title } : {}),
    calls: e.b.calls || 0,
    cost: roundCost(e.b.cost || 0),
    input: e.b.input || 0,
    cacheHit: e.b.cacheHit || 0,
    cacheMiss: e.b.cacheMiss || 0,
    output: e.b.output || 0,
  }));
  return { kind, total: entries.length, rows };
}

/** 按会话 id / 标题子串筛选，附该会话的时段与模型分布。 */
function findSessions(s, query, limit) {
  const n = Math.max(1, Math.min(50, Math.round(Number(limit) || 10)));
  const q = String(query || '').trim().toLowerCase();
  const rows = [];
  for (const id of Object.keys(s.bySession || {})) {
    const b = s.bySession[id] || {};
    const title = typeof b.title === 'string' ? b.title : '';
    if (!q || id.toLowerCase().indexOf(q) >= 0 || title.toLowerCase().indexOf(q) >= 0) {
      rows.push({
        id,
        ...(title ? { title } : {}),
        calls: b.calls || 0,
        cost: roundCost(b.cost || 0),
        input: b.input || 0,
        cacheHit: b.cacheHit || 0,
        output: b.output || 0,
        lastAt: b.lastAt || 0,
        byBand: b.byBand || {},
        byModel: b.byModel || {},
      });
    }
  }
  rows.sort((a, b) => b.cost - a.cost);
  return { query: q, matched: rows.length, rows: rows.slice(0, n) };
}

function formatSummary(s, cfg, budget, balance, scopeLabel, scopeTotals) {  const t = scopeTotals || s.total;
  const scopeLine = scopeLabel ? '（统计范围：' + scopeLabel + '）' : '';  const bf = s.meta && s.meta.lastBackfillFound > 0 ? '（含历史回填 ' + s.meta.lastBackfillFound + ' 条）' : '';
  const lines = [
    'DeepSeek 用量消费统计（北京时间计费）' + scopeLine + bf,
    '总调用次数: ' + t.calls,
    '总输入: ' + t.input + ' tokens（缓存命中 ' + t.cacheHit + ' / 未命中 ' + t.cacheMiss + '）',
    '总输出: ' + t.output + ' tokens',
    '总费用: ' + t.cost.toFixed(4) + ' 元',
  ];
  if (!scopeTotals) {
    lines.push('分段: 调价前 ¥' + s.byBand.before.cost.toFixed(4) +
      '；调价后高峰 ¥' + s.byBand.afterPeak.cost.toFixed(4) +
      '；调价后空闲 ¥' + s.byBand.afterOffPeak.cost.toFixed(4) +
      '；9/10后高峰 ¥' + (s.byBand.sepPeak ? s.byBand.sepPeak.cost.toFixed(4) : '0.0000') +
      '；9/10后空闲 ¥' + (s.byBand.sepOffPeak ? s.byBand.sepOffPeak.cost.toFixed(4) : '0.0000'));
  }
  if (budget) {
    if (budget.daily.limit != null) lines.push('今日预算: ¥' + budget.daily.spent.toFixed(4) + ' / ¥' + budget.daily.limit.toFixed(4));
    if (budget.monthly.limit != null) lines.push('本月预算: ¥' + budget.monthly.spent.toFixed(4) + ' / ¥' + budget.monthly.limit.toFixed(4));
  }
  if (balance && balance.status === 'ok' && balance.data) {
    lines.push('官方余额: ¥' + balance.data.total.toFixed(2) + '（充值 ¥' + balance.data.toppedUp.toFixed(2) + ' / 赠金 ¥' + balance.data.granted.toFixed(2) + '）');
  } else if (balance && balance.status === 'unconfigured') {
    lines.push('官方余额: 未检测到 DeepSeek API Key');
  } else if (balance && balance.status === 'error') {
    lines.push('官方余额: 拉取失败（' + balance.error + '）');
  }
  return lines.join('\n');
}

export default {
  name: 'usage-billing',
  inject: ['fs', 'sandboxPolicy', 'sessionQuery', 'timer', 'webServer', 'tools'],
  async apply(ctx) {
    const { fs, sandboxPolicy, sessionQuery, webServer, tools } = ctx;
    const agentsSvc = ctx.get('agents');

    const diag = { statsFile: null, writeRoot: null, lastError: '', attempts: [], rebuilding: false };
    let statsFile = null;
    // 非 null 时表示正在进行整库重建：recordUsage 写入这份草稿，完成后原子替换 stats，
    // 期间对外的 GET 继续使用旧的完整统计（避免界面短暂清空）
    let draftStats = null;
    let saveScheduled = false;

    // 写策略：优先当前发起会话的 cwd 根，否则用部署 workspaceRoot；写模式显式 workspace-write。
    let fullPolicy = null;
    let sessionRoot = null;
    try {
      const initiator = agentsSvc && typeof agentsSvc.currentInitiator === 'function' ? agentsSvc.currentInitiator() : undefined;
      const session = initiator ? initiator.session : undefined;
      if (session) {
        fullPolicy = sandboxPolicy.resolve({ session });
        if (fullPolicy && typeof fullPolicy.workspaceRoot === 'string' && fullPolicy.workspaceRoot.length > 0) {
          sessionRoot = fullPolicy.workspaceRoot;
        }
      }
    } catch (e) {
      diag.lastError = 'policy resolve failed: ' + String(e && e.message ? e.message : e);
    }
    if (!fullPolicy) {
      try {
        const resolved = sandboxPolicy.resolve();
        fullPolicy = {
          mode: 'workspace-write',
          workspaceRoot: typeof resolved.workspaceRoot === 'string' ? resolved.workspaceRoot : sandboxPolicy.workspaceRoot,
          ...(resolved && resolved.sessionId ? { sessionId: resolved.sessionId } : {}),
        };
        if (typeof fullPolicy.workspaceRoot === 'string' && fullPolicy.workspaceRoot.length > 0) {
          sessionRoot = fullPolicy.workspaceRoot;
        }
      } catch (e) {
        diag.lastError = 'policy fallback failed: ' + String(e && e.message ? e.message : e);
      }
    }

    const candidateRoots = [];
    if (sessionRoot) candidateRoots.push(sessionRoot);
    let deployRoot = null;
    if (typeof sandboxPolicy.workspaceRoot === 'string' && sandboxPolicy.workspaceRoot.length > 0) deployRoot = sandboxPolicy.workspaceRoot;
    if (deployRoot && deployRoot !== sessionRoot) candidateRoots.push(deployRoot);
    diag.writeRoot = sessionRoot || deployRoot;

    function policyForRoot(root) {
      return {
        mode: 'workspace-write',
        workspaceRoot: root,
        ...(fullPolicy && fullPolicy.sessionId ? { sessionId: fullPolicy.sessionId } : {}),
      };
    }

    async function trySaveTo(root, fileName) {
      try {
        const target = await fs.resolve(root + '/' + fileName);
        const text = JSON.stringify(stats);
        // 先写 temp 副本再写主文件：主文件若写坏，下次启动可从 temp 恢复（fs 无 rename，退而求其次）
        try {
          await fs.writeText(await fs.resolve(root + '/' + fileName + '.tmp'), text, undefined, undefined, policyForRoot(root));
        } catch {
          // temp 写失败不阻塞主写入
        }
        await fs.writeText(target, text, undefined, undefined, policyForRoot(root));
        return { ok: true, root, path: target.displayPath || (root + '/' + fileName) };
      } catch (e) {
        return { ok: false, root, error: String(e && e.message ? e.message : e) };
      }
    }

    let stats = emptyStats();
    // 新文件名 .dsh-usage-billing.json；老文件 .dsh-usage-stats.json 存在则读入并迁移（写新、删老），无感升级
    const NEW_STATS_FILE = '.dsh-usage-billing.json';
    const OLD_STATS_FILE = '.dsh-usage-stats.json';
    for (const root of candidateRoots) {
      try {
        let target = await fs.resolve(root + '/' + NEW_STATS_FILE);
        let parsed = null;
        let migratedFromOld = false;
        try {
          parsed = JSON.parse(await fs.readText(target));
        } catch {
          // 新文件不存在或损坏：尝试老文件（无感迁移源）
          try {
            const oldTarget = await fs.resolve(root + '/' + OLD_STATS_FILE);
            parsed = JSON.parse(await fs.readText(oldTarget));
            if (parsed) migratedFromOld = true;
          } catch {
            parsed = null;
          }
          // 都没有/都坏：尝试新名的 temp 副本
          if (!parsed) {
            try {
              parsed = JSON.parse(await fs.readText(await fs.resolve(root + '/' + NEW_STATS_FILE + '.tmp')));
              console.warn('[usage-billing] main stats file corrupt, recovered from .tmp copy');
            } catch {
              parsed = null;
            }
          }
        }
        if (parsed && parsed.version === 1 && parsed.total && parsed.byBand && parsed.byModel) {
          stats = parsed;
          if (!stats.byDay || typeof stats.byDay !== 'object') stats.byDay = {};
          if (!stats.byHour || typeof stats.byHour !== 'object') stats.byHour = {};
          if (!stats.bySession || typeof stats.bySession !== 'object') stats.bySession = {};
          if (!Array.isArray(stats.recent)) stats.recent = [];
          if (!stats.meta || typeof stats.meta !== 'object') {
            stats.meta = { liveSince: 0, lastBackfillAt: 0, lastBackfillSessions: 0, lastBackfillFound: 0, sessionAttribution: false, schemaVersion: 0 };
          }
          if (stats.meta.sessionAttribution !== true) stats.meta.sessionAttribution = false;
          if (typeof stats.meta.schemaVersion !== 'number') stats.meta.schemaVersion = 0;
          if (!stats.config || typeof stats.config !== 'object') stats.config = defaultConfig();
          stats.config = sanitizeConfig(stats.config);
          // 旧 schema 的 byBand 可能缺 sep 段，补齐防 recordUsage 写入时炸
          if (!stats.byBand.sepPeak) stats.byBand.sepPeak = bucket();
          if (!stats.byBand.sepOffPeak) stats.byBand.sepOffPeak = bucket();
          statsFile = target;
          diag.statsFile = target.displayPath || (root + '/' + NEW_STATS_FILE);
          diag.writeRoot = root;
          if (migratedFromOld) {
            // 迁移：立刻写新文件；旧文件改写为迁移标记（fs 服务无删除 API，
            // 置为标记既防旧数据被误读，体积也归零）
            await saveNow();
            try {
              await fs.writeText(await fs.resolve(root + '/' + OLD_STATS_FILE), JSON.stringify({ migrated: true, to: NEW_STATS_FILE, at: Date.now() }), undefined, undefined, policyForRoot(root));
            } catch { /* 标记写失败不影响主流程 */ }
            console.log('[usage-billing] migrated stats data ' + OLD_STATS_FILE + ' -> ' + NEW_STATS_FILE);
          }
          break;
        }
      } catch {
        // 该根下无有效文件，继续尝试下一个
      }
    }

    // 写盘重试：Windows 上主文件可能被杀软/同步盘/另一个实例短暂占用，
    // 表现为 ReplaceFileW EIO (Win32 1175)。短暂退避后重试通常即可成功。
    let saving = false;
    let saveAgain = false;
    let saveRetryScheduled = false;
    let lastSaveErrorLogged = '';

    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    async function trySaveToWithRetry(root, fileName) {
      let last = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await trySaveTo(root, fileName);
        if (r.ok) return r;
        last = r;
        if (attempt < 2) await sleep(120 * (attempt + 1));
      }
      return last;
    }

    async function saveNow() {
      // 合并并发调用：写盘期间再次触发，结束后只补写一次
      if (saving) { saveAgain = true; return; }
      saving = true;
      try {
        const results = [];
        for (const root of candidateRoots) {
          const r = await trySaveToWithRetry(root, '.dsh-usage-billing.json');
          results.push(r);
          if (r.ok) {
            statsFile = r.path;
            diag.statsFile = r.path;
            diag.writeRoot = r.root;
            diag.lastError = '';
            lastSaveErrorLogged = '';
            break;
          }
        }
        diag.attempts = results.slice(-3);
        if (results.length > 0 && !results.some((r) => r.ok)) {
          const msg = results.map((r) => r.root + ': ' + r.error).join(' | ');
          diag.lastError = msg;
          // 同一错误只打印一次，避免每 1.5s 刷屏；同时安排 5s 后补写，避免统计丢失
          if (msg !== lastSaveErrorLogged) {
            lastSaveErrorLogged = msg;
            console.error('[usage-billing] save failed, will retry:', msg);
          }
          if (!saveRetryScheduled) {
            saveRetryScheduled = true;
            ctx.timeout(() => {
              saveRetryScheduled = false;
              saveNow();
            }, 5000);
          }
        }
      } finally {
        saving = false;
        if (saveAgain) {
          saveAgain = false;
          saveNow();
        }
      }
    }

    function scheduleSave() {
      if (saveScheduled) return;
      saveScheduled = true;
      ctx.timeout(() => {
        saveScheduled = false;
        saveNow();
      }, 1500);
    }

    // ---------- 官方账户余额（检测到 DeepSeek API Key 后自动拉取） ----------
    let balanceState = { status: 'unconfigured', data: null, at: 0, error: '' };

    async function resolveDeepSeekApiKey() {
      try {
        const credentials = ctx.get('credentials');
        if (credentials && typeof credentials.resolve === 'function') {
          const hit = await credentials.resolve('DEEPSEEK_API_KEY');
          if (hit && typeof hit.value === 'string' && hit.value.length > 0) return hit.value;
        }
      } catch {
        // 凭证服务缺失或读取失败，回退到环境变量
      }
      try {
        if (typeof process !== 'undefined' && process.env && typeof process.env.DEEPSEEK_API_KEY === 'string' && process.env.DEEPSEEK_API_KEY.length > 0) {
          return process.env.DEEPSEEK_API_KEY;
        }
      } catch {
        // ignore
      }
      return null;
    }

    async function fetchBalance() {
      const cfg = stats.config || defaultConfig();
      if (cfg.balanceEnabled === false) {
        balanceState = { status: 'disabled', data: null, at: 0, error: '' };
        return balanceState;
      }
      balanceState = { status: 'loading', data: balanceState.data, at: balanceState.at, error: '' };
      const key = await resolveDeepSeekApiKey();
      if (!key) {
        balanceState = { status: 'unconfigured', data: null, at: 0, error: '' };
        return balanceState;
      }
      let ctrl = null;
      let cancelTimeout = null;
      try {
        if (typeof AbortController !== 'undefined') {
          ctrl = new AbortController();
          cancelTimeout = ctx.timeout(() => ctrl.abort(), 15000);
        }
        const res = await fetch('https://api.deepseek.com/user/balance', {
          headers: { authorization: 'Bearer ' + key },
          ...(ctrl ? { signal: ctrl.signal } : {}),
        });
        if (cancelTimeout) cancelTimeout();
        if (!res.ok) {
          balanceState = { status: 'error', data: null, at: Date.now(), error: 'HTTP ' + res.status };
          return balanceState;
        }
        const j = await res.json();
        const info = j && Array.isArray(j.balance_infos) && j.balance_infos[0] ? j.balance_infos[0] : null;
        if (!info) {
          balanceState = { status: 'error', data: null, at: Date.now(), error: 'unexpected response' };
          return balanceState;
        }
        balanceState = {
          status: 'ok',
          at: Date.now(),
          error: '',
          data: {
            isAvailable: j.is_available !== false,
            currency: typeof info.currency === 'string' ? info.currency : 'CNY',
            total: num(info.total_balance),
            granted: num(info.granted_balance),
            toppedUp: num(info.topped_up_balance),
          },
        };
        checkBalanceAlert();
        return balanceState;
      } catch (e) {
        if (cancelTimeout) cancelTimeout();
        balanceState = { status: 'error', data: null, at: Date.now(), error: String(e && e.message ? e.message : e) };
        return balanceState;
      }
    }

    function recordUsage(modelName, usage, ts, sessionId) {
      // 重建期间写草稿，重建结束后整体替换；平时直接写 stats
      const target = draftStats || stats;
      const cfg = target.config || defaultConfig();
      // 先查自定义价目：命中即归入 other 并按该价目计费。
      // 否则 glm-5.3-flash 这类名字含 flash 的第三方模型会被误判成 DeepSeek flash 档。
      const customRule = findCustomPrice(cfg, modelName);
      const model = customRule ? 'other' : classifyModel(modelName);
      const band = bandOf(ts, cfg);
      // 官方路由（V4 Pro 下线路由到 V4.1 Flash 并按 Flash 价计费，2026-09-14 12:00 起）。
      // 开关默认开：proRouteFromMs 起 pro 档按同段 flash 价格计，统计身份仍记 pro。
      const routed = model === 'pro' && cfg.proRoutesToFlash !== false && ts >= (Number(cfg.proRouteFromMs) > 0 ? cfg.proRouteFromMs : PRO_ROUTE_FROM_MS);
      const priceModel = routed ? 'flash' : model;
      // 非 DeepSeek 模型：命中自定义价目就用它（多数厂商固定价，不区分峰谷）；
      // 单价若以 USD 计，按当前汇率折算成 CNY 后统一入库。
      let price;
      if (customRule) {
        const rate = customRule.currency === 'usd'
          ? (Number(cfg.usdCny) > 0 ? Number(cfg.usdCny) : DEFAULT_USD_CNY)
          : 1;
        price = { hit: customRule.hit * rate, miss: customRule.miss * rate, out: customRule.out * rate };
      } else {
        price = (cfg.pricing[band] && cfg.pricing[band][priceModel]) || { hit: 0, miss: 0, out: 0 };
      }
      const hit = usage.cacheHit;
      const miss = usage.cacheMiss;
      const out = usage.output;
      const cost = roundCost((hit * price.hit + miss * price.miss + out * price.out) / 1e6);
      const entry = { calls: 1, input: usage.input, cacheHit: hit, cacheMiss: miss, output: out, cost };
      add(target.total, entry);
      add(target.byBand[band], entry);
      add(target.byModel[model], entry);
      const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'unknown';
      if (!target.bySession[sid]) target.bySession[sid] = sessionBucket();
      const sb = target.bySession[sid];
      sb.calls += 1;
      sb.input += entry.input;
      sb.cacheHit += entry.cacheHit;
      sb.cacheMiss += entry.cacheMiss;
      sb.output += entry.output;
      sb.cost = roundCost(sb.cost + entry.cost);
      if (ts > sb.lastAt) sb.lastAt = ts;
      // 会话内「时段 / 模型」聚合：详情面板据此显示准确分布（recent 只有 50 条，不可用于长会话）
      if (!sb.byBand || typeof sb.byBand !== 'object') sb.byBand = {};
      const sbb = sb.byBand[band] || (sb.byBand[band] = { calls: 0, cost: 0 });
      sbb.calls += 1;
      sbb.cost = roundCost(sbb.cost + cost);
      if (!sb.byModel || typeof sb.byModel !== 'object') sb.byModel = {};
      const sbm = sb.byModel[model] || (sb.byModel[model] = { calls: 0, cost: 0 });
      sbm.calls += 1;
      sbm.cost = roundCost(sbm.cost + cost);
      const bp = beijingParts(ts);
      // 会话「今日」小计：跨日自动重置，只占一个对象，不随历史增长
      if (!sb.today || typeof sb.today !== 'object') sb.today = { date: '', calls: 0, cost: 0 };
      if (sb.today.date !== bp.date) { sb.today.date = bp.date; sb.today.calls = 0; sb.today.cost = 0; }
      sb.today.calls += 1;
      sb.today.cost = roundCost(sb.today.cost + cost);
      if (!target.byDay[bp.date]) target.byDay[bp.date] = bucket();
      add(target.byDay[bp.date], entry);
      const hourKey = bp.date + ' ' + pad(bp.hour);
      if (!target.byHour[hourKey]) target.byHour[hourKey] = bucket();
      add(target.byHour[hourKey], entry);
      // 小时桶只保留最近 7 天
      const hourKeys = Object.keys(target.byHour);
      if (hourKeys.length > 200) {
        const cutoff = beijingParts(ts - 7 * 86400 * 1000).date;
        for (const k of hourKeys) if (k < cutoff) delete target.byHour[k];
      }
      target.recent.unshift({
        ts, time: bp.time, model: modelName, modelKey: model, band, sessionId: sid,
        input: usage.input, cacheHit: hit, cacheMiss: miss, output: out, cost,
      });
      if (target.recent.length > 50) target.recent.length = 50;
      target.updatedAt = ts;
      // 草稿不落盘、不触发预算告警，等重建结束统一处理
      if (!draftStats) {
        scheduleSave();
        checkBudgetAlerts();
      }
    }

    // ---------- 预算告警：跨阈值时产生一次性事件，客户端轮询 GET 时捎带走 ----------
    let budgetEvents = [];
    const budgetFired = { daily: { level: 0, day: '' }, monthly: { level: 0, month: '' }, spike: { day: '' }, balance: { day: '', level: 0 } };

    function checkBudgetAlerts() {
      const cfg = stats.config || defaultConfig();
      const today = beijingParts(Date.now()).date;
      const month = today.slice(0, 7);
      const b = computeBudget(stats, cfg);
      // 日预算
      const dl = budgetLevel(b.daily.spent, b.daily.limit);
      if (dl > budgetFired.daily.level || budgetFired.daily.day !== today) {
        budgetFired.daily.day = today;
        if (dl > budgetFired.daily.level && dl > 0) {
          budgetFired.daily.level = dl;
          budgetEvents.push({ kind: 'daily', level: dl, spent: b.daily.spent, limit: b.daily.limit, at: Date.now() });
        } else {
          budgetFired.daily.level = dl;
        }
      }
      // 月预算
      const ml = budgetLevel(b.monthly.spent, b.monthly.limit);
      if (ml > budgetFired.monthly.level || budgetFired.monthly.month !== month) {
        budgetFired.monthly.month = month;
        if (ml > budgetFired.monthly.level && ml > 0) {
          budgetFired.monthly.level = ml;
          budgetEvents.push({ kind: 'monthly', level: ml, spent: b.monthly.spent, limit: b.monthly.limit, at: Date.now() });
        } else {
          budgetFired.monthly.level = ml;
        }
      }
      if (budgetEvents.length > 8) budgetEvents = budgetEvents.slice(-8);
      // 单日花费突增：今日 ≥ max(¥1, 近 7 日均值 × 3) 时提醒一次（每天最多一次）
      if (budgetFired.spike.day !== today) {
        const spent = b.daily.spent || 0;
        const avg = b.daily.avg7 || 0;
        if (avg >= 0.3 && spent >= 1 && spent >= avg * 3) {
          budgetFired.spike.day = today;
          budgetEvents.push({ kind: 'spike', level: 1, spent, avg7: avg, at: Date.now() });
          if (budgetEvents.length > 8) budgetEvents = budgetEvents.slice(-8);
        }
      }
    }

    /** 余额低于阈值时告警：每天最多一次，等级提升（跌破一半）会再提醒一次。 */
    function checkBalanceAlert() {
      const cfg = stats.config || defaultConfig();
      const threshold = Number(cfg.balanceAlertBelow);
      if (!(threshold > 0)) return;
      if (!balanceState || balanceState.status !== 'ok' || !balanceState.data) return;
      const total = Number(balanceState.data.total);
      if (!Number.isFinite(total) || total > threshold) return;
      const today = beijingParts(Date.now()).date;
      if (budgetFired.balance.day !== today) {
        budgetFired.balance.day = today;
        budgetFired.balance.level = 0;
      }
      const level = total <= threshold * 0.5 ? 2 : 1;
      if (level <= budgetFired.balance.level) return;
      budgetFired.balance.level = level;
      budgetEvents.push({
        kind: 'balance',
        level,
        total,
        threshold,
        currency: balanceState.data.currency || 'CNY',
        at: Date.now(),
      });
      if (budgetEvents.length > 8) budgetEvents = budgetEvents.slice(-8);
    }

    function withTimeout(promise, ms, what) {      let dispose = null;
      const timer = new Promise((resolve, reject) => {
        dispose = ctx.timeout(() => reject(new Error('timeout ' + what)), ms);
      });
      const raced = Promise.race([promise, timer]);
      raced.then(() => { if (dispose) dispose(); }, () => { if (dispose) dispose(); });
      return raced;
    }

    async function backfillStats() {
      // 先构建草稿，结束后原子替换：重建期间对外仍使用旧的完整统计，界面不会短暂清空
      const previous = stats;
      const draft = emptyStats();
      draft.config = (previous && previous.config) || defaultConfig();
      draft.meta.liveSince = previous && previous.meta && previous.meta.liveSince ? previous.meta.liveSince : Date.now();
      draftStats = draft;
      diag.rebuilding = true;
      const finish = async (result) => {
        draftStats = null;
        diag.rebuilding = false;
        if (result && result.ok) {
          stats = draft;
          await saveNow();
        }
        return result;
      };
      let records = [];
      try {
        records = await withTimeout(sessionQuery.listSessions(), 60000, 'listSessions');
      } catch (e) {
        return finish({ ok: false, error: 'listSessions 失败：' + String(e && e.message ? e.message : e) });
      }
      let scanned = 0;
      let found = 0;
      let failed = 0;
      for (const rec of records) {
        const id = rec && rec.header && typeof rec.header.id === 'string' ? rec.header.id : undefined;
        if (!id) continue;
        let snap = null;
        try {
          snap = await withTimeout(sessionQuery.readSession(id), 20000, 'readSession');
        } catch {
          failed++;
          continue;
        }
        scanned++;
        const events = snap && Array.isArray(snap.events) ? snap.events : [];
        let currentModel = 'unknown';
        for (const ev of events) {
          if (!ev || typeof ev !== 'object') continue;
          if (ev.type === 'request/header') {
            const cfg = ev.data && ev.data.header && ev.data.header.config;
            const m = cfg && cfg.model;
            if (typeof m === 'string' && m.length > 0) currentModel = m;
            continue;
          }
          if (ev.type === 'assistant/message') {
            const usage = ev.data && ev.data.usage;
            if (!usage) continue;
            const norm = normalizeUsage(usage);
            if (!norm) continue;
            found++;
            recordUsage(currentModel, norm, typeof ev.time === 'number' ? ev.time : Date.now(), id);
          }
        }
        // 会话标题（尽力而为）
        try {
          const t = await withTimeout(sessionQuery.readTitle(id), 10000, 'readTitle');
          if (t && typeof t.title === 'string' && t.title.length > 0 && draft.bySession[id]) {
            draft.bySession[id].title = t.title;
          }
        } catch {
          // 忽略标题获取失败
        }
      }
      draft.recent.sort((a, b) => b.ts - a.ts);
      if (draft.recent.length > 50) draft.recent.length = 50;
      draft.meta.lastBackfillAt = Date.now();
      draft.meta.lastBackfillSessions = scanned;
      draft.meta.lastBackfillFound = found;
      draft.meta.sessionAttribution = true;
      draft.meta.schemaVersion = 13;
      if (!draft.updatedAt) draft.updatedAt = Date.now();
      return finish({ ok: true, sessions: scanned, found, failed });
    }

    ctx.on('llm/stream', (options, next) => {
      const modelName = pickModel(options);
      const stream = next();
      const acc = { input: 0, cacheHit: 0, cacheMiss: 0, output: 0, seen: false };
      return (async function* () {
        try {
          for await (const chunk of stream) {
            const u = extractUsage(chunk);
            if (u) {
              acc.seen = true;
              if (u.input > acc.input) acc.input = u.input;
              if (u.cacheHit > acc.cacheHit) acc.cacheHit = u.cacheHit;
              if (u.cacheMiss > acc.cacheMiss) acc.cacheMiss = u.cacheMiss;
              if (u.output > acc.output) acc.output = u.output;
            }
            yield chunk;
          }
        } finally {
          if (acc.seen && (acc.input > 0 || acc.output > 0)) {
            let sid = undefined;
            try {
              const initiator = agentsSvc && typeof agentsSvc.currentInitiator === 'function' ? agentsSvc.currentInitiator() : undefined;
              sid = initiator && initiator.session && typeof initiator.session.id === 'string' ? initiator.session.id : undefined;
            } catch {
              sid = undefined;
            }
            recordUsage(modelName, acc, Date.now(), sid);
          }
        }
      })();
    });

    ctx.on('dispose', () => { saveNow(); });

    // ---------- 双实例检测：心跳文件（60s 内有其他实例心跳则告警一次） ----------
    if (diag.writeRoot) {
      try {
        const hb = await fs.resolve(diag.writeRoot + '/.dsh-usage-billing.heartbeat');
        // 过渡期同时读旧名心跳（旧版本实例写旧名），新心跳只写新名
        const hbOld = await fs.resolve(diag.writeRoot + '/.dsh-usage-stats.heartbeat');
        try {
          let prev = Number(await fs.readText(hb));
          if (!Number.isFinite(prev) || prev <= 0) prev = Number(await fs.readText(hbOld));
          if (Number.isFinite(prev) && Date.now() - prev < 60000 && prev > 0) {
            console.warn('[usage-billing] another instance heartbeat detected ('
              + Math.round((Date.now() - prev) / 1000) + 's ago); concurrent writes will overwrite each other');
            diag.multiInstance = true;
          }
        } catch {
          // 无心跳文件，正常
        }
        ctx.effect(() => ctx.interval(() => {
          fs.writeText(hb, String(Date.now()), undefined, undefined, policyForRoot(diag.writeRoot)).catch(() => {});
        }, 20000), 'usage-billing: heartbeat');
      } catch {
        // 心跳路径解析失败则跳过检测
      }
    }

    function json(res, status, value) {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    }

    const statsRouteHandler = async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const action = url.searchParams.get('action');

          if (req.method === 'POST') {
            if (action === 'backfill') {
              // backfillStats 内部用草稿构建并原子替换，这里不再预清空（避免界面短暂清零）
              const result = await backfillStats();
              json(res, 200, result);
              return;
            }
            if (action === 'clear') {
              const savedConfig = stats.config || defaultConfig();
              stats = emptyStats();
              stats.meta.liveSince = Date.now();
              stats.config = savedConfig;
              saveNow();
              json(res, 200, { ok: true });
              return;
            }
            if (action === 'config') {
              const oldCfg = stats.config || defaultConfig();
              if (url.searchParams.get('reset') === '1') {
                stats.config = defaultConfig();
              } else {
                const raw = await readJsonBody(req);
                // 表单提交的价目表就是用户的最终选择；再判断它是否仍等于内置表，
                // 相等则继续跟随内置升级，不等则标记为用户自定义。
                stats.config = sanitizeConfig({ ...(raw || {}), customModelsSource: 'user', holidayDaysSource: 'user' });
                stats.config.customModelsSource = sameCustomModels(stats.config.customModels, BUILTIN_CUSTOM_MODELS) ? 'builtin' : 'user';
                stats.config.holidayDaysSource = sameDateSet(stats.config.holidayDays, DEFAULT_OFF_PEAK_DAYS) ? 'builtin' : 'user';
              }
              // 预算额度变化时重置该档去重，让新额度重新计算（否则旧额度已触发过同档就不弹了）
              if (oldCfg.budgetDaily !== stats.config.budgetDaily) budgetFired.daily.level = 0;
              if (oldCfg.budgetMonthly !== stats.config.budgetMonthly) budgetFired.monthly.level = 0;
              await saveNow();
              fetchBalance().catch(() => {});
              checkBudgetAlerts();
              json(res, 200, { ok: true, config: stats.config });
              return;
            }
            if (action === 'balance') {
              await fetchBalance();
              json(res, 200, { ok: true, balance: balanceState });
              return;
            }
          }

          if (req.method === 'GET' && action === 'export') {
            const format = url.searchParams.get('format') || 'csv';
            const scope = url.searchParams.get('scope') || 'day';
            await exportStats(res, format, scope);
            return;
          }

          const cfg = stats.config || defaultConfig();
          const view = url.searchParams.get('view') || 'full';
          const detailId = url.searchParams.get('detail') || '';

          let payload;
          if (view === 'alerts') {
            // 告警轮询只需要这一小块（原来每次拉全量 49KB）
            payload = { alerts: budgetEvents.slice() };
          } else if (view === 'dock' || view === 'card') {
            const sb = detailId && stats.bySession[detailId] ? stats.bySession[detailId] : null;
            const base = {
              byBand: {},
              byModel: view === 'card' ? stats.byModel : {},
              total: stats.total,
              bySession: sb ? { [detailId]: sb } : {},
              byDay: {},
              recent: [],
            };
            if (view === 'dock') {
              const today = beijingParts(Date.now()).date;
              if (stats.byDay[today]) base.byDay[today] = stats.byDay[today];
            } else {
              base.recent = stats.recent.slice(0, 1);
              // 卡片底部的「近 7 天」迷你趋势需要这几天的 byDay
              for (let i = 6; i >= 0; i--) {
                const key = beijingParts(Date.now() - i * 86400000).date;
                if (stats.byDay[key]) base.byDay[key] = stats.byDay[key];
              }
            }
            payload = { stats: base, config: { usdCny: cfg.usdCny }, budget: computeBudget(stats, cfg), saved: Boolean(statsFile) };
            if (view === 'dock' && sb) {
              payload.detail = { byBand: sb.byBand || {}, byModel: sb.byModel || {}, today: sb.today || null };
            }
          } else {
            payload = {
              stats,
              config: cfg,
              budget: computeBudget(stats, cfg),
              balance: balanceState,
              runway: balanceState && balanceState.status === 'ok' && balanceState.data ? computeRunway(stats, balanceState.data.total) : null,
              alerts: budgetEvents.slice(), // 不清理：多个轮询器共享同一 GET，清空会导致事件被非 toaster 消费；客户端按 id 持久去重，缓冲区有界(≤8)
              saved: Boolean(statsFile),
              diag,
            };
            if (detailId && stats.bySession[detailId]) {
              const sb = stats.bySession[detailId];
              payload.detail = { byBand: sb.byBand || {}, byModel: sb.byModel || {} };
            }
          }

          // 直接对响应体取摘要：配置、余额、告警、诊断任何变化都会反映到 ETag，无需额外计数器
          const body = JSON.stringify(payload);
          const etag = makeEtag(body);
          res.setHeader('ETag', etag);
          res.setHeader('Cache-Control', 'no-cache');
          if (req.headers['if-none-match'] === etag) {
            res.statusCode = 304;
            res.end();
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(body);
        } catch (e) {
          json(res, 500, { error: String(e && e.message ? e.message : e) });
        }
      };

    // 主路由 /usage-billing（插件宿主端与客户端同包同版本分发，无需旧路径兼容）
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/usage-billing',
      handler: statsRouteHandler,
    }), 'usage-billing: stats route');

    const usageToolDesc = '查询本机 DeepSeek API 用量与消费统计：按调价前旧价、调价后峰/谷时段分别计费（价格与峰谷时段可在设置中配置），含按会话明细与预算进度。scope 可选：today=今日、month=本月、all=累计（默认 all）；group 可按 band/model/session/day 返回花费排行；session 可按会话 id 或标题子串筛选，并给出该会话的时段/模型分布。';
    const usageToolOutput = {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          scope: { type: 'string' },
          summary: { type: 'string' },
          total: { type: 'object', additionalProperties: true },
          byBand: { type: 'object', additionalProperties: true },
          byModel: { type: 'object', additionalProperties: true },
          bySession: { type: 'object', additionalProperties: true },
          byDay: { type: 'object', additionalProperties: true },
          byHour: { type: 'object', additionalProperties: true },
          meta: { type: 'object', additionalProperties: true },
          config: { type: 'object', additionalProperties: true },
          budget: { type: 'object', additionalProperties: true },
          balance: { type: 'object', additionalProperties: true },
          diag: { type: 'object', additionalProperties: true },
          group: { type: 'object', additionalProperties: true },
          sessions: { type: 'object', additionalProperties: true },
          updatedAt: { type: 'number' },
        },
        additionalProperties: true,
      },
      render(args, value) {
        const text = value && typeof value.summary === 'string' ? value.summary : String(JSON.stringify(value));
        return [{ type: 'text', text }];
      },
    };
    const usageToolExecute = async (args) => {
      const scope = args && (args.scope === 'today' || args.scope === 'month') ? args.scope : 'all';
      const cfg = stats.config || defaultConfig();
      const budget = computeBudget(stats, cfg);
      const scopeTotals = scopeAggregate(stats, scope);
      const scopeLabel = scope === 'today' ? '今日' : scope === 'month' ? '本月' : '';
      const result = {
        ok: true,
        scope,
        summary: formatSummary(stats, cfg, budget, balanceState, scopeLabel, scopeTotals),
        total: scopeTotals || stats.total,
        byBand: stats.byBand,
        byModel: stats.byModel,
        bySession: stats.bySession,
        byDay: stats.byDay,
        byHour: stats.byHour,
        meta: stats.meta,
        config: cfg,
        budget,
        balance: balanceState,
        diag,
        updatedAt: stats.updatedAt,
      };
      // 可选维度：按 band / model / session / day 排行（全量口径）
      const group = args && typeof args.group === 'string' ? args.group : '';
      if (group) result.group = groupStats(stats, group, args && args.limit);
      // 可选：按会话 id / 标题筛选，附带该会话的时段与模型分布
      const q = args && typeof args.session === 'string' ? args.session : '';
      if (q) result.sessions = findSessions(stats, q, args && args.limit);
      return result;
    };
    ctx.effect(() => tools.register(defineTool({
      name: 'usage_billing',
      description: usageToolDesc,
      parameters: {
        scope: { type: 'string', enum: ['today', 'month', 'all'], description: '统计范围：today=今日，month=本月，all=累计（默认）' },
        group: { type: 'string', enum: ['band', 'model', 'session', 'day'], description: '可选：返回按该维度的花费排行（全量口径）' },
        session: { type: 'string', description: '可选：按会话 id 或标题子串筛选，返回匹配会话的总计与时段/模型分布' },
        limit: { type: 'number', description: 'group / session 返回条数上限（1-50，默认 10）' },
      },
      output: usageToolOutput,
      execute: usageToolExecute,
    })), 'usage-billing: usage_billing tool');

    // 官方余额：启动即拉取一次，之后每 10 分钟自动刷新（检测到 API Key 才真正发请求）
    ctx.effect(() => {
      fetchBalance().catch(() => {});
      return ctx.interval(() => { fetchBalance().catch(() => {}); }, 10 * 60 * 1000);
    }, 'usage-billing: balance poll');

    // 无数据、缺少会话归因或旧版本数据时：从日志全量重建（草稿构建 + 原子替换，期间界面沿用旧数据）
    if (stats.total.calls === 0 || stats.meta.sessionAttribution !== true || stats.meta.schemaVersion !== 13) {
      backfillStats().then((r) => {
        if (r && r.ok) console.log('[usage-billing] auto-backfill done: sessions=' + r.sessions + ' found=' + r.found + ' failed=' + r.failed);
        else console.log('[usage-billing] auto-backfill:', r && r.error ? r.error : r);
        checkBudgetAlerts();
      }).catch((e) => {
        console.error('[usage-billing] auto-backfill failed:', e);
        checkBudgetAlerts();
      });
    } else {
      // 启动时若已跨预算阈值（历史数据），补发一次告警
      checkBudgetAlerts();
    }
  },
};

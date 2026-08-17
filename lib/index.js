import { defineTool } from "@deepseek-ai/dsh-tools";

/**
 * @deepseek-ai/dsh-usage-stats — DeepSeek API 用量与消费统计（Host half）。
 * 监听 llm/stream 统计所有模型调用，按北京时间计费：
 * 2026-08-17 00:00 前用旧价；之后峰谷定价（高峰 9:00–12:00、14:00–18:00）。
 * 按会话聚合（bySession），统计持久化到写策略根目录下的 .dsh-usage-stats.json。
 */

const BOUNDARY_MS = Date.UTC(2026, 7, 16, 16, 0, 0);

const PRICING = {
  before: { flash: { hit: 0.02, miss: 1, out: 2 }, pro: { hit: 0.025, miss: 3, out: 6 } },
  afterOffPeak: { flash: { hit: 0.05, miss: 1.5, out: 4.5 }, pro: { hit: 0.15, miss: 4.5, out: 13.5 } },
  afterPeak: { flash: { hit: 0.1, miss: 3, out: 9 }, pro: { hit: 0.3, miss: 9, out: 27 } },
};

const BAND_KEYS = ['before', 'afterPeak', 'afterOffPeak'];
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

/** 用户可编辑配置的默认值（价格/峰值时段/调价边界/预算/余额开关）。 */
function defaultConfig() {
  return {
    boundaryMs: BOUNDARY_MS,
    peakHours: [9, 12, 14, 18],
    pricing: clonePricing(PRICING),
    budgetDaily: null,
    budgetMonthly: null,
    balanceEnabled: true,
  };
}

function bucket() {
  return { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 };
}

function sessionBucket() {
  return { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0, lastAt: 0, title: null };
}

function emptyStats() {
  return {
    version: 1,
    updatedAt: 0,
    meta: { liveSince: 0, lastBackfillAt: 0, lastBackfillSessions: 0, lastBackfillFound: 0, sessionAttribution: false, schemaVersion: 3 },
    total: bucket(),
    byBand: { before: bucket(), afterPeak: bucket(), afterOffPeak: bucket() },
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
  return { hour: d.getUTCHours(), date, time };
}

function isPeakHour(hour, peak) {
  const p = Array.isArray(peak) && peak.length === 4 ? peak : [9, 12, 14, 18];
  return (hour >= p[0] && hour < p[1]) || (hour >= p[2] && hour < p[3]);
}

function bandOf(ts, cfg) {
  if (ts < cfg.boundaryMs) return 'before';
  return isPeakHour(beijingParts(ts).hour, cfg.peakHours) ? 'afterPeak' : 'afterOffPeak';
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
  return {
    boundaryMs: Number.isFinite(boundary) && boundary > 0 ? boundary : d.boundaryMs,
    peakHours,
    pricing,
    budgetDaily: sanitizeBudget(raw.budgetDaily),
    budgetMonthly: sanitizeBudget(raw.budgetMonthly),
    balanceEnabled: typeof raw.balanceEnabled === 'boolean' ? raw.balanceEnabled : true,
  };
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
  return {
    daily: { limit: cfg.budgetDaily, spent: roundCost(daily) },
    monthly: { limit: cfg.budgetMonthly, spent: roundCost(monthly) },
  };
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

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportStats(res, format, scope) {
  if (format === 'json') {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), stats, config: stats.config || defaultConfig() }, null, 2);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dsh-usage-stats.json"');
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
  const ts = beijingParts(Date.now()).date;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="dsh-usage-' + (scope === 'session' ? 'sessions' : 'daily') + '-' + ts + '.csv"');
  res.end('\ufeff' + csv);
}

function formatSummary(s, cfg, budget, balance) {
  const t = s.total;
  const bf = s.meta && s.meta.lastBackfillFound > 0 ? '（含历史回填 ' + s.meta.lastBackfillFound + ' 条）' : '';
  const lines = [
    'DeepSeek 用量消费统计（北京时间计费）' + bf,
    '总调用次数: ' + t.calls,
    '总输入: ' + t.input + ' tokens（缓存命中 ' + t.cacheHit + ' / 未命中 ' + t.cacheMiss + '）',
    '总输出: ' + t.output + ' tokens',
    '总费用: ' + t.cost.toFixed(4) + ' 元',
    '分段: 调价前 ¥' + s.byBand.before.cost.toFixed(4) +
      '；调价后高峰 ¥' + s.byBand.afterPeak.cost.toFixed(4) +
      '；调价后空闲 ¥' + s.byBand.afterOffPeak.cost.toFixed(4),
  ];
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
  name: 'usage-stats',
  inject: ['fs', 'sandboxPolicy', 'sessionQuery', 'timer', 'webServer', 'tools'],
  async apply(ctx) {
    const { fs, sandboxPolicy, sessionQuery, webServer, tools } = ctx;
    const agentsSvc = ctx.get('agents');

    const diag = { statsFile: null, writeRoot: null, lastError: '', attempts: [] };
    let statsFile = null;
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
        await fs.writeText(target, JSON.stringify(stats), undefined, undefined, policyForRoot(root));
        return { ok: true, root, path: target.displayPath || (root + '/' + fileName) };
      } catch (e) {
        return { ok: false, root, error: String(e && e.message ? e.message : e) };
      }
    }

    let stats = emptyStats();
    for (const root of candidateRoots) {
      try {
        const target = await fs.resolve(root + '/.dsh-usage-stats.json');
        const text = await fs.readText(target);
        const parsed = JSON.parse(text);
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
          statsFile = target;
          diag.statsFile = target.displayPath || (root + '/.dsh-usage-stats.json');
          diag.writeRoot = root;
          break;
        }
      } catch {
        // 该根下无有效文件，继续尝试下一个
      }
    }

    async function saveNow() {
      const results = [];
      for (const root of candidateRoots) {
        const r = await trySaveTo(root, '.dsh-usage-stats.json');
        results.push(r);
        if (r.ok) {
          statsFile = r.path;
          diag.statsFile = r.path;
          diag.writeRoot = r.root;
          diag.lastError = '';
          break;
        }
      }
      diag.attempts = results.slice(-3);
      if (results.length > 0 && !results.some((r) => r.ok)) {
        diag.lastError = results.map((r) => r.root + ': ' + r.error).join(' | ');
        console.error('[usage-stats] all save attempts failed:', results);
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
        return balanceState;
      } catch (e) {
        if (cancelTimeout) cancelTimeout();
        balanceState = { status: 'error', data: null, at: Date.now(), error: String(e && e.message ? e.message : e) };
        return balanceState;
      }
    }

    function recordUsage(modelName, usage, ts, sessionId) {
      const cfg = stats.config || defaultConfig();
      const model = classifyModel(modelName);
      const band = bandOf(ts, cfg);
      const price = (cfg.pricing[band] && cfg.pricing[band][model]) || { hit: 0, miss: 0, out: 0 };
      const hit = usage.cacheHit;
      const miss = usage.cacheMiss;
      const out = usage.output;
      const cost = roundCost((hit * price.hit + miss * price.miss + out * price.out) / 1e6);
      const entry = { calls: 1, input: usage.input, cacheHit: hit, cacheMiss: miss, output: out, cost };
      add(stats.total, entry);
      add(stats.byBand[band], entry);
      add(stats.byModel[model], entry);
      const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'unknown';
      if (!stats.bySession[sid]) stats.bySession[sid] = sessionBucket();
      const sb = stats.bySession[sid];
      sb.calls += 1;
      sb.input += entry.input;
      sb.cacheHit += entry.cacheHit;
      sb.cacheMiss += entry.cacheMiss;
      sb.output += entry.output;
      sb.cost = roundCost(sb.cost + entry.cost);
      if (ts > sb.lastAt) sb.lastAt = ts;
      const bp = beijingParts(ts);
      if (!stats.byDay[bp.date]) stats.byDay[bp.date] = bucket();
      add(stats.byDay[bp.date], entry);
      const hourKey = bp.date + ' ' + pad(bp.hour);
      if (!stats.byHour[hourKey]) stats.byHour[hourKey] = bucket();
      add(stats.byHour[hourKey], entry);
      // 小时桶只保留最近 7 天
      const hourKeys = Object.keys(stats.byHour);
      if (hourKeys.length > 200) {
        const cutoff = beijingParts(ts - 7 * 86400 * 1000).date;
        for (const k of hourKeys) if (k < cutoff) delete stats.byHour[k];
      }
      stats.recent.unshift({
        ts, time: bp.time, model: modelName, modelKey: model, band, sessionId: sid,
        input: usage.input, cacheHit: hit, cacheMiss: miss, output: out, cost,
      });
      if (stats.recent.length > 50) stats.recent.length = 50;
      stats.updatedAt = ts;
      scheduleSave();
    }

    function withTimeout(promise, ms, what) {
      let dispose = null;
      const timer = new Promise((resolve, reject) => {
        dispose = ctx.timeout(() => reject(new Error('timeout ' + what)), ms);
      });
      const raced = Promise.race([promise, timer]);
      raced.then(() => { if (dispose) dispose(); }, () => { if (dispose) dispose(); });
      return raced;
    }

    async function backfillStats() {
      let records = [];
      try {
        records = await withTimeout(sessionQuery.listSessions(), 60000, 'listSessions');
      } catch (e) {
        return { ok: false, error: 'listSessions 失败：' + String(e && e.message ? e.message : e) };
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
          if (t && typeof t.title === 'string' && t.title.length > 0 && stats.bySession[id]) {
            stats.bySession[id].title = t.title;
          }
        } catch {
          // 忽略标题获取失败
        }
      }
      stats.recent.sort((a, b) => b.ts - a.ts);
      if (stats.recent.length > 50) stats.recent.length = 50;
      stats.meta.lastBackfillAt = Date.now();
      stats.meta.lastBackfillSessions = scanned;
      stats.meta.lastBackfillFound = found;
      stats.meta.sessionAttribution = true;
      stats.meta.schemaVersion = 3;
      await saveNow();
      return { ok: true, sessions: scanned, found, failed };
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

    function json(res, status, value) {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    }

    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/usage-stats',
      handler: async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const action = url.searchParams.get('action');

          if (req.method === 'POST') {
            if (action === 'backfill') {
              const savedConfig = stats.config || defaultConfig();
              stats = emptyStats();
              stats.meta.liveSince = Date.now();
              stats.config = savedConfig;
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
              if (url.searchParams.get('reset') === '1') {
                stats.config = defaultConfig();
              } else {
                const raw = await readJsonBody(req);
                stats.config = sanitizeConfig(raw);
              }
              await saveNow();
              fetchBalance().catch(() => {});
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
          json(res, 200, {
            stats,
            config: cfg,
            budget: computeBudget(stats, cfg),
            balance: balanceState,
            saved: Boolean(statsFile),
            diag,
          });
        } catch (e) {
          json(res, 500, { error: String(e && e.message ? e.message : e) });
        }
      },
    }), 'usage-stats: stats route');

    ctx.effect(() => tools.register(defineTool({
      name: 'usage_stats',
      description: '查询本机 DeepSeek API 用量与消费统计：按调价前旧价、调价后峰/谷时段分别计费（价格与峰谷时段可在设置中配置），含按会话明细与预算进度。',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
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
            updatedAt: { type: 'number' },
          },
          additionalProperties: true,
        },
        render(args, value) {
          const text = value && typeof value.summary === 'string' ? value.summary : String(JSON.stringify(value));
          return [{ type: 'text', text }];
        },
      },
      execute: async () => {
        const cfg = stats.config || defaultConfig();
        const budget = computeBudget(stats, cfg);
        return {
          ok: true,
          summary: formatSummary(stats, cfg, budget, balanceState),
          total: stats.total,
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
      },
    })), 'usage-stats: usage_stats tool');

    // 官方余额：启动即拉取一次，之后每 10 分钟自动刷新（检测到 API Key 才真正发请求）
    ctx.effect(() => {
      fetchBalance().catch(() => {});
      return ctx.interval(() => { fetchBalance().catch(() => {}); }, 10 * 60 * 1000);
    }, 'usage-stats: balance poll');

    // 无数据、缺少会话归因或旧版本数据时：先清空再从日志全量重建（避免重复累计）
    if (stats.total.calls === 0 || stats.meta.sessionAttribution !== true || stats.meta.schemaVersion !== 3) {
      stats = emptyStats();
      stats.meta.liveSince = Date.now();
      backfillStats().then((r) => {
        if (r && r.ok) console.log('[usage-stats] auto-backfill done: sessions=' + r.sessions + ' found=' + r.found + ' failed=' + r.failed);
        else console.log('[usage-stats] auto-backfill:', r && r.error ? r.error : r);
      }).catch((e) => {
        console.error('[usage-stats] auto-backfill failed:', e);
      });
    }
  },
};

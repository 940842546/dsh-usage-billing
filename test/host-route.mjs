// 宿主端集成测试：用内存 fs 与桩服务加载插件，直接驱动 /usage-billing 路由，
// 验证 view=alerts|dock、detail=<id> 与 ETag/304 的真实行为。
import plugin from '../lib/index.js';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ' :: ' + String(extra).slice(0, 300) : ''}`); }
}

const ROOT = 'mem://root';
const statsFile = ROOT + '/.dsh-usage-billing.json';
const files = new Map();

// 预置一份 schemaVersion 11 的统计（不触发重建）
const fixture = {
  version: 1,
  updatedAt: 1000,
  meta: { liveSince: 1, lastBackfillAt: 0, lastBackfillSessions: 0, lastBackfillFound: 0, sessionAttribution: true, schemaVersion: 11 },
  total: { calls: 10, input: 100, cacheHit: 50, cacheMiss: 50, output: 20, cost: 1.5 },
  byBand: {
    before: { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 },
    afterPeak: { calls: 2, input: 20, cacheHit: 10, cacheMiss: 10, output: 4, cost: 0.3 },
    afterOffPeak: { calls: 3, input: 30, cacheHit: 15, cacheMiss: 15, output: 6, cost: 0.2 },
    sepPeak: { calls: 2, input: 20, cacheHit: 10, cacheMiss: 10, output: 4, cost: 0.6 },
    sepOffPeak: { calls: 3, input: 30, cacheHit: 15, cacheMiss: 15, output: 6, cost: 0.4 },
  },
  byModel: {
    flash: { calls: 8, input: 80, cacheHit: 40, cacheMiss: 40, output: 16, cost: 1.2 },
    pro: { calls: 1, input: 10, cacheHit: 5, cacheMiss: 5, output: 2, cost: 0.3 },
    other: { calls: 1, input: 10, cacheHit: 5, cacheMiss: 5, output: 2, cost: 0 },
  },
  bySession: {
    s1: {
      calls: 7, input: 70, cacheHit: 35, cacheMiss: 35, output: 14, cost: 1.1, lastAt: 900, title: '会话一',
      byBand: { sepOffPeak: { calls: 7, cost: 1.1 } },
      byModel: { flash: { calls: 7, cost: 1.1 } },
    },
    s2: { calls: 3, input: 30, cacheHit: 15, cacheMiss: 15, output: 6, cost: 0.4, lastAt: 800, title: '会话二', byBand: {}, byModel: {} },
  },
  byDay: { '2026-11-06': { calls: 10, input: 100, cacheHit: 50, cacheMiss: 50, output: 20, cost: 1.5 } },
  byHour: {},
  recent: [{ ts: 1000, time: '10:00:00', model: 'deepseek-flash', modelKey: 'flash', band: 'sepOffPeak', sessionId: 's1', input: 10, cacheHit: 5, cacheMiss: 5, output: 2, cost: 0.1 }],
  config: {},
};
files.set(statsFile, JSON.stringify(fixture));

// 追加一批填充会话，让全量体积接近真实（实测 49KB / 80+ 会话），便于验证 dock 的裁剪效果
for (let i = 0; i < 40; i++) {
  fixture.bySession['filler-' + i] = {
    calls: 20, input: 2000, cacheHit: 1000, cacheMiss: 1000, output: 400, cost: 2.5, lastAt: 800, title: '填充会话 ' + i,
    byBand: { sepOffPeak: { calls: 20, cost: 2.5 } }, byModel: { flash: { calls: 20, cost: 2.5 } },
  };
}
files.set(statsFile, JSON.stringify(fixture));

const fsStub = {
  async resolve(p) { return { path: p }; },
  async stat(t) { return files.has(t.path) ? { size: files.get(t.path).length } : undefined; },
  async readText(t) { if (!files.has(t.path)) throw new Error('ENOENT ' + t.path); return files.get(t.path); },
  async writeText(t, content) { files.set(t.path, content); return { ok: true }; },
  async listDir() { return []; },
};
const sandboxPolicy = {
  workspaceRoot: ROOT,
  defaultMode: 'workspace-write',
  resolve() { return { mode: 'workspace-write', workspaceRoot: ROOT }; },
  overrideOf() { return undefined; },
};
const sessionQuery = {
  async listSessions() { return []; },
  async readSession() { throw new Error('none'); },
  async readTitle() { return undefined; },
};

let route = null;
let toolDef = null;
let streamHook = null;
const webServer = { register(r) { route = r; return () => {}; } };
const tools = { register(def) { toolDef = def; return () => {}; } };

const ctx = {
  fs: fsStub, sandboxPolicy, sessionQuery, webServer, tools,
  get() { return undefined; },
  effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
  on(name, handler) { if (name === 'llm/stream') streamHook = handler; return () => {}; },
  interval() { return () => {}; },
  timeout() { return () => {}; },
};

await plugin.apply(ctx);

check('插件已注册 /usage-billing 路由', route !== null && route.path === '/usage-billing');
check('usage_billing 工具已注册', toolDef !== null && toolDef.name === 'usage_billing');
check('llm/stream 监听已挂载', typeof streamHook === 'function');

function makeReq(url, headers = {}) {
  return { url, method: 'GET', headers, on() {} };
}
function makeRes() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    end(b) { this.body = b == null ? '' : String(b); this.ended = true; },
  };
}
async function get(url, headers) {
  const res = makeRes();
  await route.handler(makeReq(url, headers), res);
  return res;
}

// 1. 全量
const full = await get('/usage-billing');
let fullJson = null;
try { fullJson = JSON.parse(full.body); } catch {}
check('GET 全量返回 200 且可解析', full.statusCode === 200 && !!fullJson, `status=${full.statusCode}`);
check('全量含 balance/alerts/diag', !!fullJson && 'balance' in fullJson && Array.isArray(fullJson.alerts) && !!fullJson.diag);
check('全量带 ETag 与 no-cache', !!full.headers['etag'] && full.headers['cache-control'] === 'no-cache', JSON.stringify(full.headers));

// 2. 304
const revalidated = await get('/usage-billing', { 'if-none-match': full.headers['etag'] });
check('If-None-Match 命中返回 304 且无 body', revalidated.statusCode === 304 && revalidated.body === '', `status=${revalidated.statusCode} bodyLen=${revalidated.body.length}`);

// 3. alerts 视图
const alerts = await get('/usage-billing?view=alerts');
const alertsJson = JSON.parse(alerts.body);
check('view=alerts 只返回 alerts', Object.keys(alertsJson).length === 1 && Array.isArray(alertsJson.alerts), JSON.stringify(Object.keys(alertsJson)));

// 4. dock 视图 + detail
const dock = await get('/usage-billing?view=dock&detail=s1');
const dockJson = JSON.parse(dock.body);
check('view=dock 200 且体积显著小于全量', dock.statusCode === 200 && dock.body.length < full.body.length / 3, `dock=${dock.body.length} full=${full.body.length}`);
check('dock 只带该会话', !!dockJson.stats.bySession.s1 && !dockJson.stats.bySession.s2);
check('dock 带该会话精确分布 detail.byBand', !!dockJson.detail && !!dockJson.detail.byBand && dockJson.detail.byBand.sepOffPeak && dockJson.detail.byBand.sepOffPeak.cost === 1.1, JSON.stringify(dockJson.detail));
check('dock 带今日桶', !!dockJson.stats.byDay['2026-11-06']);
check('dock 不含 balance/diag', !('balance' in dockJson) && !('diag' in dockJson));

// 5. card 视图
const card = await get('/usage-billing?view=card&detail=s1');
const cardJson = JSON.parse(card.body);
check('view=card 带 byModel 与单条 recent', !!cardJson.stats.byModel.flash && cardJson.stats.recent.length === 1);

// 6. 全量 + detail
const fullDetail = await get('/usage-billing?detail=s2');
const fdJson = JSON.parse(fullDetail.body);
check('全量 + detail 附带该会话分布', !!fdJson.detail && !!fdJson.detail.byBand, JSON.stringify(fdJson.detail));

// 7. 无效 detail 不崩
const bad = await get('/usage-billing?view=dock&detail=nope');
check('未知会话 id 仍返回 200', bad.statusCode === 200);

// ── 8. 旧 schema 重建：期间保持旧数据，完成后原子替换 ───────────────────────────
{
  const files2 = new Map();
  const oldFile = ROOT + '/.dsh-usage-billing.json';
  const oldFixture = {
    version: 1, updatedAt: 500,
    meta: { liveSince: 1, lastBackfillAt: 0, lastBackfillSessions: 0, lastBackfillFound: 0, sessionAttribution: true, schemaVersion: 10 },
    total: { calls: 7, input: 70, cacheHit: 35, cacheMiss: 35, output: 14, cost: 1.1 },
    byBand: {
      before: { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 },
      afterPeak: { calls: 7, input: 70, cacheHit: 35, cacheMiss: 35, output: 14, cost: 1.1 },
      afterOffPeak: { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 },
      sepPeak: { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 },
      sepOffPeak: { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 },
    },
    byModel: {
      flash: { calls: 7, input: 70, cacheHit: 35, cacheMiss: 35, output: 14, cost: 1.1 },
      pro: { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 },
      other: { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 },
    },
    bySession: { s1: { calls: 7, input: 70, cacheHit: 35, cacheMiss: 35, output: 14, cost: 1.1, lastAt: 400, title: '旧标题' } },
    byDay: {}, byHour: {}, recent: [], config: {},
  };
  files2.set(oldFile, JSON.stringify(oldFixture));

  const fs2 = {
    async resolve(p) { return { path: p }; },
    async stat(t) { return files2.has(t.path) ? { size: 1 } : undefined; },
    async readText(t) { if (!files2.has(t.path)) throw new Error('ENOENT'); return files2.get(t.path); },
    async writeText(t, c) { files2.set(t.path, c); return { ok: true }; },
    async listDir() { return []; },
  };
  const sq2 = {
    async listSessions() { return [{ header: { id: 's1' } }]; },
    async readSession() {
      return { events: [
        { type: 'request/header', data: { header: { config: { model: 'deepseek-flash' } } } },
        { type: 'assistant/message', time: 1000, data: { usage: { inputTokens: 10, outputTokens: 2 } } },
        { type: 'assistant/message', time: 2000, data: { usage: { inputTokens: 10, outputTokens: 2 } } },
        { type: 'assistant/message', time: 3000, data: { usage: { inputTokens: 10, outputTokens: 2 } } },
      ] };
    },
    async readTitle() { return { title: '新标题' }; },
  };
  let route2 = null;
  const ctx2 = {
    fs: fs2,
    sandboxPolicy: { workspaceRoot: ROOT, defaultMode: 'workspace-write', resolve() { return { mode: 'workspace-write', workspaceRoot: ROOT }; }, overrideOf() { return undefined; } },
    sessionQuery: sq2,
    webServer: { register(r) { route2 = r; return () => {}; } },
    tools: { register() { return () => {}; } },
    get() { return undefined; },
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
    on() { return () => {}; },
    interval() { return () => {}; },
    timeout() { return () => {}; },
  };
  await plugin.apply(ctx2);
  const get2 = async () => {
    const res = makeRes();
    await route2.handler(makeReq('/usage-billing'), res);
    return JSON.parse(res.body);
  };

  const during = await get2();
  check('旧 schema 重建期间仍返回旧统计（不清零）', during.stats.total.calls === 7 && during.stats.bySession.s1, `calls=${during.stats.total && during.stats.total.calls}`);

  let after = null;
  for (let i = 0; i < 100; i++) {
    after = await get2();
    if (after.stats.meta && after.stats.meta.schemaVersion === 11 && after.stats.total.calls === 3) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  check('重建完成后统计被原子替换（7 → 3 次）', after.stats.total.calls === 3, `calls=${after.stats.total.calls}`);
  check('重建后 schemaVersion=11', after.stats.meta.schemaVersion === 11);
  check('重建后会话带精确分布', !!after.stats.bySession.s1 && !!after.stats.bySession.s1.byBand && after.stats.bySession.s1.byModel.flash.calls === 3, JSON.stringify(after.stats.bySession.s1 && after.stats.bySession.s1.byBand));
  check('重建后标题已回填', after.stats.bySession.s1.title === '新标题');
}

// ── 9. 写盘被占用（Win32 1175）时重试并最终成功 ─────────────────────────────
{
  const files3 = new Map();
  const writeAttempts = [];
  let failMainWrites = 2;
  const statsPath = ROOT + '/.dsh-usage-billing.json';
  files3.set(statsPath, JSON.stringify(fixture));

  const fs3 = {
    async resolve(p) { return { path: p }; },
    async stat(t) { return files3.has(t.path) ? { size: 1 } : undefined; },
    async readText(t) { if (!files3.has(t.path)) throw new Error('ENOENT'); return files3.get(t.path); },
    async writeText(t, c) {
      const isMain = t.path === statsPath;
      if (isMain) writeAttempts.push(t.path);
      if (isMain && failMainWrites > 0) {
        failMainWrites--;
        throw new Error('cannot write: ReplaceFileW EIO (Win32 1175)');
      }
      files3.set(t.path, c);
      return { ok: true };
    },
    async listDir() { return []; },
  };
  let streamHook3 = null;
  const ctx3 = {
    fs: fs3,
    sandboxPolicy: { workspaceRoot: ROOT, defaultMode: 'workspace-write', resolve() { return { mode: 'workspace-write', workspaceRoot: ROOT }; }, overrideOf() { return undefined; } },
    sessionQuery: { async listSessions() { return []; }, async readSession() { throw new Error('none'); }, async readTitle() { return undefined; } },
    webServer: { register() { return () => {}; } },
    tools: { register() { return () => {}; } },
    get() { return undefined; },
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
    on(name, h) { if (name === 'llm/stream') streamHook3 = h; return () => {}; },
    interval() { return () => {}; },
    timeout(fn, ms) { const t = setTimeout(fn, ms); return () => clearTimeout(t); },
  };
  await plugin.apply(ctx3);

  // 触发一次真实调用记录 → 1.5s 后触发 scheduleSave
  const stream = streamHook3({ model: 'deepseek-flash' }, () => (async function* () {
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 2 } };
  })());
  for await (const _ of stream) { /* drain */ }
  await new Promise((r) => setTimeout(r, 1900));

  check('写盘失败后自动重试（>=3 次尝试）', writeAttempts.length >= 3, `attempts=${writeAttempts.length}`);
  const saved = JSON.parse(files3.get(statsPath));
  check('重试后统计已成功落盘', saved.total.calls >= 11, `calls=${saved.total.calls}`);
}

// ── 10. 非 DeepSeek 模型按自定义价目计费 ────────────────────────────────────
{
  const files4 = new Map();
  const path4 = ROOT + '/.dsh-usage-billing.json';
  const f4 = JSON.parse(JSON.stringify(fixture));
  f4.config = {
    usdCny: 7,
    customModels: [
      { match: 'glm', currency: 'cny', hit: 0.5, miss: 2, out: 8 },
      { match: 'grok', currency: 'usd', hit: 1, miss: 2, out: 4 },
    ],
  };
  files4.set(path4, JSON.stringify(f4));
  const fs4 = {
    async resolve(p) { return { path: p }; },
    async stat(t) { return files4.has(t.path) ? { size: 1 } : undefined; },
    async readText(t) { if (!files4.has(t.path)) throw new Error('ENOENT'); return files4.get(t.path); },
    async writeText(t, c) { files4.set(t.path, c); return { ok: true }; },
    async listDir() { return []; },
  };
  let hook4 = null;
  let route4 = null;
  const ctx4 = {
    fs: fs4,
    sandboxPolicy: { workspaceRoot: ROOT, defaultMode: 'workspace-write', resolve() { return { mode: 'workspace-write', workspaceRoot: ROOT }; }, overrideOf() { return undefined; } },
    sessionQuery: { async listSessions() { return []; }, async readSession() { throw new Error('none'); }, async readTitle() { return undefined; } },
    webServer: { register(r) { route4 = r; return () => {}; } },
    tools: { register() { return () => {}; } },
    get() { return undefined; },
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
    on(name, h) { if (name === 'llm/stream') hook4 = h; return () => {}; },
    interval() { return () => {}; },
    timeout() { return () => {}; },
  };
  await plugin.apply(ctx4);

  const emit = async (model, usage) => {
    const stream = hook4({ model }, () => (async function* () { yield { type: 'usage', usage }; })());
    for await (const _ of stream) { /* drain */ }
  };
  const get4 = async () => {
    const res = makeRes();
    await route4.handler(makeReq('/usage-billing'), res);
    return JSON.parse(res.body);
  };

  const before = await get4();
  await emit('glm-4.6', { inputTokens: 1000000, outputTokens: 0 });
  await emit('grok-4.7', { inputTokens: 1000000, outputTokens: 0 });
  const after = await get4();

  const otherCost = after.stats.byModel.other.cost - before.stats.byModel.other.cost;
  // glm: 1e6 未命中 × 2 CNY = 2；grok: 1e6 未命中 × 2 USD × 7 = 14 → 合计 16
  check('非 DeepSeek 模型按自定义价目计费（CNY + USD 折算）', Math.abs(otherCost - 16) < 1e-6, `otherCost=${otherCost}`);
  check('other 桶调用数增加 2', after.stats.byModel.other.calls - before.stats.byModel.other.calls === 2);
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);

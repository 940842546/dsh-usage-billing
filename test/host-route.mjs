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

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);

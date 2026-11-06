// 宿主端集成测试：用内存 fs 与桩服务加载插件，直接驱动 /usage-billing 路由，
// 验证 view=alerts|dock、detail=<id> 与 ETag/304 的真实行为。
import { readFileSync } from 'node:fs';
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
  meta: { liveSince: 1, lastBackfillAt: 0, lastBackfillSessions: 0, lastBackfillFound: 0, sessionAttribution: true, schemaVersion: 12 },
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

// 7b. usage_billing 工具的新维度
{
  const grouped = await toolDef.execute({ group: 'model', limit: 2 });
  check('工具 group=model 返回花费排行', !!grouped.group && grouped.group.rows.length === 2 && grouped.group.rows[0].key === 'flash' && grouped.group.rows[0].cost >= grouped.group.rows[1].cost, JSON.stringify(grouped.group && grouped.group.rows));
  const bySession = await toolDef.execute({ group: 'session', limit: 3 });
  check('工具 group=session 返回会话排行', !!bySession.group && bySession.group.rows.length >= 2, JSON.stringify(bySession.group && bySession.group.rows.map((r) => r.key)));
  const found = await toolDef.execute({ session: '会话一' });
  check(
    '工具 session 按标题筛选并附分布',
    !!found.sessions && found.sessions.matched === 1 && found.sessions.rows[0].id === 's1' && !!found.sessions.rows[0].byBand.sepOffPeak,
    JSON.stringify(found.sessions && found.sessions.rows[0] && found.sessions.rows[0].byBand),
  );
  const limited = await toolDef.execute({ group: 'day', limit: 1 });
  check('工具 limit 生效', !!limited.group && limited.group.rows.length === 1, JSON.stringify(limited.group && limited.group.rows.length));
}

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
    if (after.stats.meta && after.stats.meta.schemaVersion === 12 && after.stats.total.calls === 3) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  check('重建完成后统计被原子替换（7 → 3 次）', after.stats.total.calls === 3, `calls=${after.stats.total.calls}`);
  check('重建后 schemaVersion=11', after.stats.meta.schemaVersion === 12);
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
  await new Promise((r) => setTimeout(r, 2600));

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

// ── 11. 2027 节假日 + 内置官方价目 ──────────────────────────────────────────
{
  const files5 = new Map();
  const path5 = ROOT + '/.dsh-usage-billing.json';
  const f5 = JSON.parse(JSON.stringify(fixture));
  // 不写 customModels / holidayDays：应分别回落到内置官方价目与内置节假日
  f5.config = { usdCny: 7 };
  files5.set(path5, JSON.stringify(f5));
  const fs5 = {
    async resolve(p) { return { path: p }; },
    async stat(t) { return files5.has(t.path) ? { size: 1 } : undefined; },
    async readText(t) { if (!files5.has(t.path)) throw new Error('ENOENT'); return files5.get(t.path); },
    async writeText(t, c) { files5.set(t.path, c); return { ok: true }; },
    async listDir() { return []; },
  };
  let hook5 = null;
  let route5 = null;
  const ctx5 = {
    fs: fs5,
    sandboxPolicy: { workspaceRoot: ROOT, defaultMode: 'workspace-write', resolve() { return { mode: 'workspace-write', workspaceRoot: ROOT }; }, overrideOf() { return undefined; } },
    sessionQuery: { async listSessions() { return []; }, async readSession() { throw new Error('none'); }, async readTitle() { return undefined; } },
    webServer: { register(r) { route5 = r; return () => {}; } },
    tools: { register() { return () => {}; } },
    get() { return undefined; },
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
    on(name, h) { if (name === 'llm/stream') hook5 = h; return () => {}; },
    interval() { return () => {}; },
    timeout() { return () => {}; },
  };
  await plugin.apply(ctx5);
  const emit = async (model, usage, ts) => {
    const stream = hook5({ model }, () => (async function* () { yield ts ? { type: 'usage', usage, ts } : { type: 'usage', usage }; })());
    for await (const _ of stream) { /* drain */ }
  };
  const get5 = async () => {
    const res = makeRes();
    await route5.handler(makeReq('/usage-billing'), res);
    return JSON.parse(res.body);
  };

  const before = await get5();
  await emit('glm-5.3', { inputTokens: 1000000, outputTokens: 0 });
  await emit('glm-5.3-flash', { inputTokens: 1000000, outputTokens: 0 });
  await emit('grok-4.7', { inputTokens: 1000000, outputTokens: 0 });
  await emit('gpt-5.4', { inputTokens: 1000000, outputTokens: 0 });
  await emit('claude-sonnet-4-5', { inputTokens: 1000000, outputTokens: 0 });
  await emit('kimi-k3', { inputTokens: 1000000, outputTokens: 0 });
  await emit('gemini-3.8-flash', { inputTokens: 1000000, outputTokens: 0 });
  await emit('doubao-seed-2.0-pro', { inputTokens: 1000000, outputTokens: 0 });
  const after = await get5();

  const otherCost = after.stats.byModel.other.cost - before.stats.byModel.other.cost;
  // 8（glm-5.3）+ 0.8（glm-5.3-flash）+ 14（grok-4.7：2 USD × 7）
  // + 17.5（gpt-5.4：2.5 USD × 7）+ 21（claude-sonnet-4-5：3 USD × 7）
  // + 20（kimi-k3）+ 5.25（gemini-3.8-flash：0.75 USD × 7）+ 3.2（doubao-seed-2.0-pro）
  check('内置官方价目生效且更具体的规则优先', Math.abs(otherCost - 89.75) < 1e-6, `otherCost=${otherCost}`);
  check(
    '名字含 flash 的第三方模型不被误判为 DeepSeek flash',
    after.stats.byModel.flash.calls === before.stats.byModel.flash.calls,
    `flashDelta=${after.stats.byModel.flash.calls - before.stats.byModel.flash.calls}`,
  );
}

// ── 12. 2027 节假日按重建路径（可注入历史时间）验证 ─────────────────────────
{
  const files6 = new Map();
  const path6 = ROOT + '/.dsh-usage-billing.json';
  const f6 = JSON.parse(JSON.stringify(fixture));
  f6.meta.schemaVersion = 10; // 强制重建，事件时间才会被采用
  f6.config = { usdCny: 7 };
  files6.set(path6, JSON.stringify(f6));
  const fs6 = {
    async resolve(p) { return { path: p }; },
    async stat(t) { return files6.has(t.path) ? { size: 1 } : undefined; },
    async readText(t) { if (!files6.has(t.path)) throw new Error('ENOENT'); return files6.get(t.path); },
    async writeText(t, c) { files6.set(t.path, c); return { ok: true }; },
    async listDir() { return []; },
  };
  const sq6 = {
    async listSessions() { return [{ header: { id: 'h1' } }]; },
    async readSession() {
      return { events: [
        { type: 'request/header', data: { header: { config: { model: 'glm-5.3' } } } },
        // 2027-01-01 10:00 北京（元旦，工作日）→ 空闲
        { type: 'assistant/message', time: Date.UTC(2027, 0, 1, 2, 0, 0), data: { usage: { inputTokens: 1000, outputTokens: 100 } } },
        // 2027-10-08 10:00 北京（周五，普通工作日）→ 高峰
        { type: 'assistant/message', time: Date.UTC(2027, 9, 8, 2, 0, 0), data: { usage: { inputTokens: 1000, outputTokens: 100 } } },
        // 2027-10-05 10:00 北京（国庆假期内）→ 空闲
        { type: 'assistant/message', time: Date.UTC(2027, 9, 5, 2, 0, 0), data: { usage: { inputTokens: 1000, outputTokens: 100 } } },
      ] };
    },
    async readTitle() { return undefined; },
  };
  let route6 = null;
  const ctx6 = {
    fs: fs6,
    sandboxPolicy: { workspaceRoot: ROOT, defaultMode: 'workspace-write', resolve() { return { mode: 'workspace-write', workspaceRoot: ROOT }; }, overrideOf() { return undefined; } },
    sessionQuery: sq6,
    webServer: { register(r) { route6 = r; return () => {}; } },
    tools: { register() { return () => {}; } },
    get() { return undefined; },
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
    on() { return () => {}; },
    interval() { return () => {}; },
    timeout() { return () => {}; },
  };
  await plugin.apply(ctx6);
  const get6 = async () => {
    const res = makeRes();
    await route6.handler(makeReq('/usage-billing'), res);
    return JSON.parse(res.body);
  };
  let out = null;
  for (let i = 0; i < 100; i++) {
    out = await get6();
    if (out.stats.meta.schemaVersion === 12 && out.stats.total.calls === 3) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  check('2027 元旦按空闲计费', out.stats.byBand.sepOffPeak.calls === 2, `sepOffPeak=${out.stats.byBand.sepOffPeak.calls}`);
  check('2027 普通工作日峰段仍计高峰', out.stats.byBand.sepPeak.calls === 1, `sepPeak=${out.stats.byBand.sepPeak.calls}`);
}

// ── 13. 内置价目升级：未改过的配置自动刷新，改过的保留 ─────────────────────
{
  const mk = async (config) => {
    const filesX = new Map();
    const pathX = ROOT + '/.dsh-usage-billing.json';
    const fx = JSON.parse(JSON.stringify(fixture));
    fx.config = config;
    filesX.set(pathX, JSON.stringify(fx));
    const fsX = {
      async resolve(p) { return { path: p }; },
      async stat(t) { return filesX.has(t.path) ? { size: 1 } : undefined; },
      async readText(t) { if (!filesX.has(t.path)) throw new Error('ENOENT'); return filesX.get(t.path); },
      async writeText(t, c) { filesX.set(t.path, c); return { ok: true }; },
      async listDir() { return []; },
    };
    let routeX = null;
    const ctxX = {
      fs: fsX,
      sandboxPolicy: { workspaceRoot: ROOT, defaultMode: 'workspace-write', resolve() { return { mode: 'workspace-write', workspaceRoot: ROOT }; }, overrideOf() { return undefined; } },
      sessionQuery: { async listSessions() { return []; }, async readSession() { throw new Error('none'); }, async readTitle() { return undefined; } },
      webServer: { register(r) { routeX = r; return () => {}; } },
      tools: { register() { return () => {}; } },
      get() { return undefined; },
      effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
      on() { return () => {}; },
      interval() { return () => {}; },
      timeout() { return () => {}; },
    };
    await plugin.apply(ctxX);
    const res = makeRes();
    await routeX.handler(makeReq('/usage-billing'), res);
    return JSON.parse(res.body).config;
  };

  const legacyRules = [
    { match: 'glm-5.3-flash', currency: 'cny', hit: 0.23, miss: 0.8, out: 2.8 },
    { match: 'glm-5.3', currency: 'cny', hit: 2, miss: 8, out: 28 },
    { match: 'glm-5.2', currency: 'cny', hit: 2, miss: 8, out: 28 },
    { match: 'grok-4.7', currency: 'usd', hit: 0.5, miss: 2, out: 6 },
    { match: 'grok-4.6', currency: 'usd', hit: 0.5, miss: 2, out: 6 },
    { match: 'hy4-preview', currency: 'cny', hit: 0.3, miss: 6, out: 18 },
    { match: 'hy4', currency: 'cny', hit: 0.3, miss: 6, out: 18 },
  ];
  const legacy = await mk({ customModels: legacyRules });
  check('0.12.0 的旧内置表自动升级为最新内置表', Array.isArray(legacy.customModels) && legacy.customModels.length === 71, `len=${legacy.customModels && legacy.customModels.length}`);

  const custom = await mk({ customModelsEdited: true, customModels: [{ match: 'mymodel', currency: 'cny', hit: 1, miss: 1, out: 1 }] });
  check('用户自定义过的价目被保留（不被内置覆盖）', custom.customModels.length === 1 && custom.customModels[0].match === 'mymodel', JSON.stringify(custom.customModels));

  // 节假日：旧配置里只有 2026 名单（无来源标记）→ 应自动补上 2027
  const legacyHolidayDates = (() => {
    const src = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8');
    const m = /const HOLIDAYS_2026 = \[([\s\S]*?)\n\];/.exec(src);
    if (!m) return [];
    return [...m[1].matchAll(/'(\d{4}-\d{2}-\d{2})'/g)].map((x) => x[1]);
  })();
  const legacyHolidays = await mk({ holidayDays: legacyHolidayDates });
  check(
    '旧配置只有 2026 节假日名单时自动补上 2027',
    legacyHolidays.holidayDaysSource === 'builtin' && legacyHolidays.holidayDays.includes('2027-10-01') && legacyHolidays.holidayDays.length > legacyHolidayDates.length,
    `source=${legacyHolidays.holidayDaysSource} len=${legacyHolidays.holidayDays.length}`,
  );

  const pinnedHolidays = await mk({ holidayDaysSource: 'user', holidayDays: ['2026-01-01'] });
  check('用户改过节假日名单时保留', pinnedHolidays.holidayDays.length === 1 && pinnedHolidays.holidayDays[0] === '2026-01-01', JSON.stringify(pinnedHolidays.holidayDays));
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);

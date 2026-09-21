// 打开流程冒烟：模拟点击 → open=true → 定位 effect → 面板可见（异步等 fetch resolve）
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ' :: ' + String(extra).slice(0, 300) : ''}`); }
}

let pendingRerender = null;
function makeReact() {
  // 每个组件函数（及其实例代）独立 hooks 状态：以“当前渲染组件栈”区分
  const compState = new Map();   // component fn -> { state: [], cursor }
  let currentComp = null;
  const module = {
    createElement: (type, props, ...children) => ({ $$el: true, type, props: props || {}, children: children.flat(2).filter((c) => c !== null && c !== undefined && c !== false && c !== true) }),
    Component: class {},
    useState(init) {
      const slot = compState.get(currentComp);
      const i = slot.cursor.v++;
      if (!(i in slot.state)) slot.state[i] = typeof init === 'function' ? init() : init;
      const mySlot = slot;
      return [slot.state[i], (v) => { const nv = typeof v === 'function' ? v(mySlot.state[i]) : v; mySlot.state[i] = nv; if (pendingRerender) pendingRerender(); }];
    },
    useEffect(fn, deps) { try { const r = fn(); if (typeof r === 'function') { /* cleanup 忽略 */ } } catch {} },
    useRef(init) {
      const slot = compState.get(currentComp);
      const i = slot.cursor.v++;
      if (!(i in slot.state)) slot.state[i] = { current: init };
      return slot.state[i];
    },
  };
  return {
    module,
    enter(fn) { if (!compState.has(fn)) compState.set(fn, { state: [], cursor: { v: 0 } }); currentComp = fn; compState.get(fn).cursor.v = 0; },
    slotOf(fn) { return compState.get(fn); },
    compMapDebug() { return compState.entries(); },
  };
}

const head = 'factory: (require) => {';
let m = src.slice(src.indexOf(head) + head.length);
m = m.replace(/\}\);\s*$/, '');
m = m.replace(/\r?\n\t\}\s*$/, '');
const R = makeReact();
const fn = new Function('require', m);

globalThis.window = {
  innerWidth: 1280, innerHeight: 800,
  addEventListener: () => {}, removeEventListener: () => {},
  setInterval: () => 0, clearInterval: () => {},
};
globalThis.document = {
  createElement: () => ({ style: {}, dataset: {}, setAttribute() {}, remove() {} }),
  head: { appendChild: () => {} },
  querySelector: () => null,
  addEventListener: () => {}, removeEventListener: () => {},
  body: { $$body: true },
};

const statsData = {
  stats: {
    bySession: { 's-001': { calls: 5, input: 1000, cacheHit: 500, cacheMiss: 500, output: 200, cost: 1.23, lastAt: Date.now(), title: 'T' } },
    byBand: {}, byModel: {}, total: { calls: 5, input: 1000, cacheHit: 500, cacheMiss: 500, output: 200, cost: 1.23 },
    byDay: {},
    recent: [{ ts: Date.now(), time: '12:00:00', model: 'deepseek-flash', modelKey: 'flash', band: 'sepOffPeak', sessionId: 's-001', input: 200, cacheHit: 100, cacheMiss: 100, output: 40, cost: 0.2 }],
    updatedAt: Date.now(),
  },
  budget: { daily: { spent: 5, limit: 20 }, monthly: { spent: 5, limit: 100 } },
  currency: 'cny',
  config: { usdCny: 6.7878 },
};
globalThis.fetch = (...args) => { console.log('  [fetch called]', String(args[0]).slice(0, 40)); return Promise.resolve({ json: () => Promise.resolve(statsData) }); };

const exports = fn((name) => (name === 'react' ? R.module : {}));
const registered = [];
const slots = {
  inject: (key, reg) => { try { reg(); } catch {} },
  register: (opts, comp) => { registered.push({ opts, comp }); return () => {}; },
};
const fakeSession = { list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} } };
exports.apply({
  slots,
  get: (n) => (n === 'sessions' ? fakeSession : undefined),
  effect: (fn2) => { try { fn2(); } catch {} return () => {}; },
  on: () => () => {},
});
const dockReg = registered.find((r) => r.opts.name === 'conversation.composer.dock');
check('composer.dock 组件已注册', !!dockReg);

function renderWithRefs(node) {
  if (!node || !node.$$el) return null;
  if (typeof node.type === 'function') {
    if (node.type.prototype && node.type.prototype.render) {
      const kids = [].concat(node.children || node.props.children || []).flat(4).filter(Boolean);
      return renderWithRefs({ $$el: true, type: 'boundary', props: {}, children: kids });
    }
    R.enter(node.type);
    const out = node.type(node.props);
    return renderWithRefs(out);
  }
  if (node.props && node.props.ref) {
    node.props.ref.current = {
      offsetWidth: 300, offsetHeight: 240,
      getBoundingClientRect: () => ({ left: 500, top: 600, right: 700, bottom: 620, width: 200, height: 20 }),
    };
  }
  if (Array.isArray(node.children)) node.children = node.children.map((c) => renderWithRefs(c));
  return node;
}

function findIn(node, pred, out = []) {
  if (!node || !node.$$el) return out;
  if (pred(node)) out.push(node);
  (node.children || []).forEach((c) => findIn(c, pred, out));
  return out;
}

const render = () => renderWithRefs(R.module.createElement(dockReg.comp, { sessionId: 's-001', session: { id: 's-001' } }));
let renderCount = 0;
pendingRerender = () => { renderCount++; };

// 等 fetch 的两级 then resolve
await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setTimeout(r, 0));

// 先渲染一次：effect 发出 fetch
let tree = render();
// 等 fetch 的 promise 链 resolve，再渲染拿数据
for (let i = 0; i < 10; i++) await Promise.resolve();
await new Promise((r) => setTimeout(r, 10));
tree = render();
await Promise.resolve(); await new Promise((r) => setTimeout(r, 5));
// 手动直调 DockReadout 检查返回
const dockFn = [...R.compMapDebug()].find(([f]) => f.name === 'DockReadout');
if (dockFn) {
  R.enter(dockFn[0]);
  const direct = dockFn[0]({ sessionId: 's-001', session: { id: 's-001' } });
  console.log('direct DockReadout return:', direct === null ? 'NULL' : direct && direct.$$el ? `${String(direct.type).slice(0, 30)} cls=${direct.props.className}` : typeof direct);
}
tree = render();
// 调试：Dump 组件 state 池
for (const [fn, slot] of R.compMapDebug()) {
  console.log('comp', fn.name || 'anon', 'state len', slot.state.length, '->', slot.state.map((v) => (v && v.$$el) ? '[elem]' : (typeof v === 'object' && v !== null && 'current' in v) ? '[ref]' : JSON.stringify(v === undefined ? null : v)?.slice(0, 60)).join(' | '));
}
const triggers = findIn(tree, (n) => n.props && n.props.className === 'usg-sess-trigger');
check('触发器 button 渲染（usg-sess-trigger）', triggers.length === 1, `got ${triggers.length}`);
if (triggers[0]) {
  check('触发器有 onClick', typeof triggers[0].props.onClick === 'function');
  triggers[0].props.onClick();
  check('点击触发重渲染', renderCount > 0);
  tree = render();
  const panels = findIn(tree, (n) => n.props && n.props.className === 'usg-sess-panel');
  check('点击后详情面板出现', panels.length === 1, `got ${panels.length}`);
  const anchors = findIn(tree, (n) => n.props && n.props.className === 'usg-sess-anchor');
  check('面板锚点 anchor 存在', anchors.length === 1, `got ${anchors.length}`);
  const rows = findIn(tree, (n) => n.props && n.props.className === 'usg-sess-row');
  check('面板明细行 >=6', rows.length >= 6, `got ${rows.length}`);
  const segs = findIn(tree, (n) => n.props && n.props.className && String(n.props.className).includes('usg-sess-segment'));
  check('分段条存在', segs.length >= 1, `got ${segs.length}`);
  const rings = findIn(tree, (n) => n.props && n.props.strokeDasharray);
  check('环形进度 circle 存在', rings.length === 1, `got ${rings.length}`);
  // 明细行已验证 >=6；行文本由 i18n 词条提供（词典断言在源码层已覆盖）
  check('环形进度 circle 存在（点击后）', findIn(tree, (n) => n.props && n.props.strokeDasharray).length === 1);
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);

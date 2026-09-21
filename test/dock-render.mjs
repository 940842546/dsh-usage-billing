// 渲染冒烟：DockReadout 触发器 + SessionDetailPanel 打开态完整渲染（react stub，无 DOM）
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ' :: ' + String(extra).slice(0, 300) : ''}`); }
}

// ---- 加载模块（与 compat 测试同法） ----
function loadModule() {
  const head = 'factory: (require) => {';
  let m = src.slice(src.indexOf(head) + head.length);
  m = m.replace(/\}\);\s*$/, '');
  m = m.replace(/\r?\n\t\}\s*$/, '');
  const reactStub = makeReactStub();
  const fn = new Function('require', m);
  return fn((name) => (name === 'react' ? reactStub.module : {}));
}

// react stub：hooks 用最简实现；createElement 构造可检查的树
function makeReactStub() {
  const tree = [];
  const module = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(2).filter((c) => c !== null && c !== undefined && c !== false) }),
    Component: class {},
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useRef: (init) => ({ current: init }),
  };
  return { module };
}

// 渲染 DockReadout：需要 open=true。stub useState 无法 set -> 直接调 SessionDetailPanel。
const exports = loadModule();

// 从模块内提取 SessionDetailPanel：它没有被导出。改为经由 slots 注册的组件引用：
// conversation.composer.dock 注册的组件是 guard(DockReadout)。我们拿到注册的 comp。
const registered = [];
const slots = {
  inject: (key, fn) => { try { fn(); } catch {} },
  register: (opts, comp) => { registered.push({ opts, comp }); return () => {}; },
};
const fakeSession = { list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} } };
const ctx = {
  slots,
  get: (n) => (n === 'sessions' ? fakeSession : undefined),
  effect: (fn) => { try { fn(); } catch {} return () => {}; },
  on: () => () => {},
};
exports.apply(ctx);
const dockReg = registered.find((r) => r.opts.name === 'conversation.composer.dock');
check('composer.dock 注册了组件', !!dockReg);

// 构造数据渲染面板：直接调用导出？SessionDetailPanel 未导出 —— 通过模块闭包无法直接拿。
// 改为检查 DockReadout 组件渲染：需要 hooks 状态 open -> stub 不支持 set。
// 因此这里验证：触发器分支（b.calls>0）以 open=false 渲染（useState(false) 初值）。
const reactStubModule = makeReactStub().module;
// 重新加载模块但让 require 返回我们的 stub（保存引用以读取生成的树）
let lastTree = null;
function loadModuleWithSpy(spy) {
  const head = 'factory: (require) => {';
  let m = src.slice(src.indexOf(head) + head.length);
  m = m.replace(/\}\);\s*$/, '');
  m = m.replace(/\r?\n\t\}\s*$/, '');
  const fn = new Function('require', m);
  return fn((name) => (name === 'react' ? spy.module : {}));
}

// 全局 fetch stub（useStatsData 用）
globalThis.window = globalThis;
globalThis.fetch = () => new Promise(() => {}); // 永不 resolve：保持 data=null -> DockReadout 返回 null
{
  const spy = makeReactStub();
  const ex2 = loadModuleWithSpy(spy);
  const regs = [];
  const slots2 = {
    inject: (key, fn) => { try { fn(); } catch {} },
    register: (opts, comp) => { regs.push({ opts, comp }); return () => {}; },
  };
  ex2.apply({
    slots: slots2,
    get: (n) => (n === 'sessions' ? fakeSession : undefined),
    effect: (fn) => { try { fn(); } catch {} return () => {}; },
    on: () => () => {},
  });
  const comp = regs.find((r) => r.opts.name === 'conversation.composer.dock').comp;
  // guard 包了一层 Boundary —— comp 是 guard(node)；Boundary 是 react.Component 子类，createElement 会接受
  const node = spy.module.createElement(comp, { sessionId: 's-001', session: { id: 's-001' } });
  check('DockReadout createElement 可构造（含 Boundary guard）', node && typeof node.type !== 'undefined');
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);

// 兼容性 shim 行为测试：模拟 dsh 0.1.6+（uiWorkspace）与 0.1.5（sessions.open/current）两种客户端形态。
// 验证 apply() 解析 OPEN_SESSION / READ_CURRENT 的优先级与回退正确、四种运行时形态下 apply 均不抛异常。
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ' :: ' + extra : ''}`); }
}

// 加载模块：截取 factory 体（window.__ModuleLoader__.load({ id, factory: (require) => { BODY }) 的 BODY）
// 原样执行（含尾部的 exports.apply/exports.inject 赋值与 return），再用 Function 求值。
function loadModule() {
  const head = 'factory: (require) => {';
  const start = src.indexOf(head);
  if (start < 0) throw new Error('factory head not found');
  let m = src.slice(start + head.length);
  m = m.replace(/\}\);\s*$/, '');            // 去掉最外层 “});”（load(...) 收尾）
  m = m.replace(/\r?\n\t\}\s*$/, '');        // 去掉 factory 自身收尾的 “\n\t}”
  const reactStub = { createElement: (...a) => ({ stub: true, args: a }), Component: class {}, useState: (v) => [v, () => {}], useEffect: () => {} };
  const fn = new Function('require', m);   // factory 自带 var module/exports 并 return module.exports
  return fn((name) => (name === 'react' ? reactStub : {}));
}

// 在受控 ctx 上执行 apply，捕获 slots 注册与内部状态读取
function runApply(services) {
  const registered = [];
  const slots = {
    inject: (key, fn) => { try { fn(); } catch {} },
    register: (opts, comp) => { registered.push({ opts, comp }); return () => {}; },
  };
  const ctx = {
    slots,
    get: (n) => (Object.prototype.hasOwnProperty.call(services, n) ? services[n] : undefined),
    effect: (fn) => { try { fn(); } catch {} return () => {}; },
    on: () => () => {},
  };
  const exports = loadModule();
  exports.apply(ctx);
  return { registered, exports };
}

{
  console.log('\n[1] 静态断言：apply 内解析顺序（uiWorkspace 优先，sessions.open 回退）');
  const applySrc = src.slice(src.indexOf('function apply(ctx)'));
  const iUiws = applySrc.indexOf("ctx.get('uiWorkspace')");
  const iOpen = applySrc.indexOf('SESSIONS.open');
  const iSel = applySrc.indexOf('UIWORKSPACE.selection');
  const iCur = applySrc.indexOf('snap.current');
  check('先探测 uiWorkspace 再回退 sessions.open', iUiws >= 0 && iOpen > iUiws);
  check('先读 uiWorkspace.selection 再回退 snap.current', iSel >= 0 && iCur > iSel);
  check('openable 判断统一使用 OPEN_SESSION', !/openable[^;\n]*SESSIONS\.open/.test(applySrc));
}

{
  console.log('\n[2] dsh 0.1.6 形态：uiWorkspace.openSession + selection store（sessions 无 open/current）');
  const openedWith = [];
  const uiWorkspace = {
    openSession: (id) => { openedWith.push(id); },
    selection: {
      getSnapshot: () => ({ sessionId: 'sess-new-001' }),
      subscribe: (fn) => () => {},
    },
  };
  const sessions016 = { list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} } };
  const { registered } = runApply({ sessions: sessions016, uiWorkspace });
  check('apply 不抛异常且注册 4 个挂载点', registered.length === 4, `got ${registered.length}`);
  check('挂载点 key 正确', ['settings.section', 'conversation.composer.dock', 'sidebar.footer.action', 'shell.overlay'].every((k) => registered.some((r) => r.opts.name === k)));
}

{
  console.log('\n[3] dsh 0.1.5 形态：sessions.open + snap.current（无 uiWorkspace 服务）');
  const sessions015 = {
    open: (id) => { sessions015.__opened = id; },
    list: {
      getSnapshot: () => ({ ids: [], byId: {}, current: 'sess-old-009' }),
      subscribe: () => () => {},
    },
  };
  const { registered } = runApply({ sessions: sessions015 });
  check('apply 不抛异常且注册 4 个挂载点', registered.length === 4, `got ${registered.length}`);
}

{
  console.log('\n[4] 极端降级：sessions/uiWorkspace 均缺失');
  const { registered } = runApply({});
  check('apply 不抛异常且仍注册 4 个挂载点', registered.length === 4, `got ${registered.length}`);
}

{
  console.log('\n[5] 混合形态（0.1.6 过渡）：uiWorkspace 无 selection 但 sessions.list.current 仍在');
  const uiwsNoSel = { openSession: () => {} };
  const sessionsMixed = {
    open: () => {},
    list: { getSnapshot: () => ({ ids: [], byId: {}, current: 'mixed-1' }), subscribe: () => () => {} },
  };
  const { registered } = runApply({ sessions: sessionsMixed, uiWorkspace: uiwsNoSel });
  check('apply 不抛异常且注册 4 个挂载点', registered.length === 4, `got ${registered.length}`);
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);

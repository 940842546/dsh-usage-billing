// 端到端验证「面板内快速设预算」：打开弹窗 → 截图 → 设置 10/100 → 看面板即时刷新 → 清空复原。
// 用法：node test/verify-budget.mjs <url> <outPng> [port]
import { writeFileSync } from 'node:fs';
const url = process.argv[2];
const out = process.argv[3] || 'budget.png';
const port = process.argv[4] || '9333';
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(base + '/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
};

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url });
await sleep(8000);

const opened = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const leaf = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.textContent || '').includes('做一个用量'));
  if (!leaf) return { error: 'no session leaf' };
  leaf.click();
  await sleep(2500);
  const trigger = document.querySelector('.usg-sess-trigger');
  if (!trigger) return { error: 'no dock trigger' };
  trigger.click();
  await sleep(900);
  const row = document.querySelector('.usg-sess-budget');
  if (!row) return { error: 'no budget row', panel: (document.querySelector('.usg-sess-panel') || {}).innerText };
  const rowBefore = row.innerText.replace(/\\s+/g, ' ');
  row.click();
  await sleep(700);
  const be = document.querySelector('.usg-be');
  return { rowBefore, editorOpen: !!be, editorText: be ? be.innerText.replace(/\\s+/g, ' ') : null, inputs: be ? [...be.querySelectorAll('input')].map((i) => i.value) : null };
})()`);
console.log('open:', JSON.stringify(opened));

if (!opened || !opened.editorOpen) { console.log('EDITOR_NOT_OPEN'); ws.close(); process.exit(2); }

const rect = await evaluate(`(() => { const r = document.querySelector('.usg-be').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const clip = { x: Math.max(0, rect.x - 16), y: Math.max(0, rect.y - 16), width: rect.w + 32, height: rect.h + 32, scale: 2 };
const shot = await send('Page.captureScreenshot', { format: 'png', clip });
writeFileSync(out, Buffer.from(shot.data, 'base64'));

const saved = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const inputs = [...document.querySelectorAll('.usg-be input')];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inputs[0], '10'); inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  setter.call(inputs[1], '100'); inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(200);
  const btns = [...document.querySelectorAll('.usg-be .usg-btn')];
  if (!btns.length) return { error: 'no buttons' };
  btns[0].click();
  await sleep(1800);
  const row = document.querySelector('.usg-sess-budget');
  const editor = document.querySelector('.usg-be');
  const cfg = await (await fetch('/usage-billing')).json();
  return { rowAfter: row ? row.innerText.replace(/\\s+/g, ' ') : null, editorClosed: !editor, budgetDaily: cfg.config.budgetDaily, budgetMonthly: cfg.config.budgetMonthly };
})()`);
console.log('save:', JSON.stringify(saved));

const restored = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const r = await fetch('/usage-billing?action=budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ daily: null, monthly: null }) });
  const j = await r.json();
  await sleep(1500);
  const cfg = await (await fetch('/usage-billing')).json();
  const row = document.querySelector('.usg-sess-budget');
  return { ok: !!j.ok, budgetDaily: cfg.config.budgetDaily, budgetMonthly: cfg.config.budgetMonthly, row: row ? row.innerText.replace(/\\s+/g, ' ') : null };
})()`);
console.log('restore:', JSON.stringify(restored));
ws.close();

// 视觉检查：截图 overlay / 详情面板 / 预算弹窗，并回读关键样式
import { writeFileSync } from 'node:fs';
const url = process.argv[2] || 'http://127.0.0.1:3080/';
const dir = process.argv[3] || '.';
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
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};
const shot = async (selector, file, pad = 12) => {
  const rect = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  if (!rect) return null;
  const clip = { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.w + pad * 2, height: rect.h + pad * 2, scale: 2 };
  const s = await send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(file, Buffer.from(s.data, 'base64'));
  return { w: Math.round(rect.w), h: Math.round(rect.h) };
};
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url });
await sleep(7000);

const out = {};
// 1) overlay
await evaluate(`(() => { const c = document.querySelector('.usg-fab-card'); if (c) c.click(); return !!c; })()`);
await sleep(1200);
out.overlay = await shot('.usg-ov', dir + '/v-overlay.png', 16);
out.overlayStyle = await evaluate(`(() => { const e = document.querySelector('.usg-ov'); if (!e) return null; const s = getComputedStyle(e); return { radius: s.borderRadius, bg: s.backgroundColor, blur: s.backdropFilter, shadow: s.boxShadow.slice(0, 80), heroColor: (getComputedStyle(document.querySelector('.usg-hero-value')).color) }; })()`);
await evaluate(`(() => { const b = document.querySelector('.usg-ov-backdrop'); if (b) b.click(); return true; })()`);
await sleep(500);

// 2) 详情面板
await evaluate(`(async () => { const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); const leaf=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && (e.textContent||'').includes('做一个用量')); if(leaf){leaf.click(); await sleep(2200);} const t=document.querySelector('.usg-sess-trigger'); if(t){t.click(); await sleep(800);} return true; })()`);
out.panel = await shot('.usg-sess-panel', dir + '/v-panel.png', 14);
await evaluate(`(() => { const b = document.querySelector('.usg-sess-budget'); if (b) b.click(); return true; })()`);
await sleep(700);
out.dialog = await shot('.usg-be', dir + '/v-dialog.png', 16);
out.dialogStyle = await evaluate(`(() => { const e = document.querySelector('.usg-be'); if (!e) return null; const s = getComputedStyle(e); return { radius: s.borderRadius, bg: s.backgroundColor, blur: s.backdropFilter, shadow: s.boxShadow.slice(0, 80) }; })()`);
console.log(JSON.stringify(out, null, 2));
ws.close();

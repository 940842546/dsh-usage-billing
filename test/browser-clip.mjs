// 截取某个元素附近的区域，便于细看样式。
// 用法：node test/browser-clip.mjs <url> <outPng> <selector> [pad] [port] [waitMs]
import { writeFileSync } from 'node:fs';
const url = process.argv[2];
const out = process.argv[3];
const selector = process.argv[4] || 'body';
const pad = Number(process.argv[5] || 16);
const port = process.argv[6] || '9333';
const waitMs = Number(process.argv[7] || 8000);
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(base + '/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url });
await sleep(waitMs);

const rect = await evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, text: el.innerText.replace(/\\s+/g,' ').slice(0,200) };
})()`);
if (!rect) { console.log('selector not found'); process.exit(2); }
const clip = {
  x: Math.max(0, rect.x - pad),
  y: Math.max(0, rect.y - pad),
  width: Math.min(1440 - Math.max(0, rect.x - pad), rect.w + pad * 2),
  height: Math.min(1100 - Math.max(0, rect.y - pad), rect.h + pad * 2),
  scale: 2,
};
const shot = await send('Page.captureScreenshot', { format: 'png', clip });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify({ rect, clip, out }, null, 2));
ws.close();

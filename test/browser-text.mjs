// 用无头浏览器渲染 JS 定价页，导出可见文本 + 截图，便于提取官方价格。
// 用法：node test/browser-text.mjs <url> <outPrefix> [port] [waitMs]
import { writeFileSync, mkdirSync } from 'node:fs';
const url = process.argv[2];
const outPrefix = process.argv[3] || 'page';
const port = process.argv[4] || '9333';
const waitMs = Number(process.argv[5] || 9000);
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
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(waitMs);
// 尽量让懒加载表格进入视口
await evaluate(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); })()`);
await sleep(1200);

const info = await evaluate(`(() => {
  const text = document.body.innerText || '';
  const tables = [...document.querySelectorAll('table')].map(t => (t.innerText || '').replace(/\\n{2,}/g, '\\n').slice(0, 4000));
  return { title: document.title, href: location.href, length: text.length, tableCount: tables.length, tables, text };
})()`);
const dir = outPrefix.includes('/') || outPrefix.includes('\\\\') ? '' : '';
mkdirSync('.', { recursive: true });
writeFileSync(outPrefix + '.txt', info.text, 'utf8');
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(outPrefix + '.png', Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify({ title: info.title, href: info.href, textLength: info.length, tableCount: info.tableCount }, null, 2));
for (let i = 0; i < Math.min(info.tables.length, 6); i++) {
  console.log(`--- table ${i} ---`);
  console.log(info.tables[i].slice(0, 1500));
}
ws.close();

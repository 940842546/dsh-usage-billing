// 在已渲染页面上执行一段表达式并打印 JSON 结果（用于探测自定义元素里的价格）。
// 用法：node test/browser-eval.mjs <url> <exprFile> [port] [waitMs]
import { readFileSync } from 'node:fs';
const url = process.argv[2];
const exprFile = process.argv[3];
const port = process.argv[4] || '9333';
const waitMs = Number(process.argv[5] || 10000);
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const expr = readFileSync(exprFile, 'utf8');

const list = await (await fetch(base + '/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(waitMs);
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
if (r.exceptionDetails) console.log('EXCEPTION:', JSON.stringify(r.exceptionDetails).slice(0, 500));
console.log(JSON.stringify(r.result.value, null, 2).slice(0, 20000));
ws.close();

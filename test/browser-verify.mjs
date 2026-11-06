// 浏览器实测：用 CDP 打开真实页面，截图并用脚本点击「本会话用量」触发器，
// 量取详情面板的实际位置/尺寸，验证 portal 后是否落在视口内。
// 用法：node test/browser-verify.mjs <url> <outDir> [port]
import { writeFileSync, mkdirSync } from 'node:fs';

const url = process.argv[2];
const outDir = process.argv[3] || '.';
const port = process.argv[4] || '9333';
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitJson(path, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(base + path);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(200);
  }
  throw new Error('CDP endpoint unreachable: ' + path);
}

const list = await waitJson('/json/list');
let page = list.find((t) => t.type === 'page');
if (!page) {
  const r = await fetch(`${base}/json/new?about:blank`, { method: 'PUT' });
  page = await r.json();
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(JSON.stringify(msg.error)));
    else res(msg.result);
  }
};
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const p = `${outDir}/${name}.png`;
  writeFileSync(p, Buffer.from(r.data, 'base64'));
  console.log('screenshot:', p);
}

mkdirSync(outDir, { recursive: true });
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(6000); // 等应用启动、客户端插件加载、首轮 /usage-billing 拉取

const ready = await evaluate(`(() => {
  const t = document.querySelector('.usg-sess-trigger');
  return { hasTrigger: !!t, text: t ? t.innerText : null, href: location.href };
})()`);
console.log('page state:', JSON.stringify(ready));
await shot('01-dock');

if (!ready.hasTrigger) {
  console.log('RESULT: trigger not found (plugin client half may not be mounted yet)');
  await sleep(4000);
  const again = await evaluate(`!!document.querySelector('.usg-sess-trigger')`);
  console.log('retry hasTrigger:', again);
  if (!again) { ws.close(); process.exit(2); }
}

const clicked = await evaluate(`(() => {
  const t = document.querySelector('.usg-sess-trigger');
  if (!t) return false;
  t.click();
  return true;
})()`);
console.log('clicked:', clicked);
await sleep(700);

const geom = await evaluate(`(() => {
  const p = document.querySelector('.usg-sess-panel');
  const a = document.querySelector('.usg-sess-anchor');
  const t = document.querySelector('.usg-sess-trigger');
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) }; };
  const cs = p ? getComputedStyle(p) : null;
  return {
    viewport: { w: innerWidth, h: innerHeight },
    trigger: box(t), anchor: box(a), panel: box(p),
    panelInViewport: p ? (p.getBoundingClientRect().top >= 0 && p.getBoundingClientRect().bottom <= innerHeight && p.getBoundingClientRect().left >= 0 && p.getBoundingClientRect().right <= innerWidth) : false,
    panelParent: p && p.parentElement ? p.parentElement.tagName + (p.parentElement === document.body ? '#body' : '') : null,
    backdrop: cs ? cs.backdropFilter : null,
    background: cs ? cs.backgroundColor : null,
    panelText: p ? p.innerText.replace(/\\s+/g, ' ').slice(0, 400) : null,
  };
})()`);
console.log('geometry:', JSON.stringify(geom, null, 2));
await shot('02-panel');

ws.close();
console.log('RESULT:', geom.panelInViewport ? 'PANEL_IN_VIEWPORT' : 'PANEL_OUT_OF_VIEWPORT');

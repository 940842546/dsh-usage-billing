// 打开一个已有会话 → 等 dock 行出现 → 点开详情面板 → 量取位置并截图
import { writeFileSync, mkdirSync } from 'node:fs';
const outDir = process.argv[2] || '.';
const port = process.argv[3] || '9333';
const title = process.argv[4] || '做一个用量';
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
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); const p = `${outDir}/${name}.png`; writeFileSync(p, Buffer.from(r.data, 'base64')); console.log('screenshot:', p); };

mkdirSync(outDir, { recursive: true });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

await send('Page.navigate', { url: 'http://127.0.0.1:3080/' });
await sleep(5000);

// 找到标题包含目标文本、且没有子元素的节点，再向上找可点击祖先
const opened = await evaluate(`(() => {
  const target = ${JSON.stringify(title)};
  const leaves = [...document.querySelectorAll('span,div,a,button')].filter(e => e.children.length === 0 && e.textContent && e.textContent.includes(target));
  if (leaves.length === 0) return { ok: false, reason: 'no leaf', sample: [...document.querySelectorAll('span,div')].filter(e=>e.children.length===0).slice(0,5).map(e=>e.textContent) };
  let n = leaves[0];
  const leafText = n.textContent;
  while (n && !(n.tagName === 'BUTTON' || n.tagName === 'A' || n.getAttribute('role') === 'button' || n.onclick)) n = n.parentElement;
  const clickTarget = n || leaves[0];
  clickTarget.click();
  return { ok: true, leafText, tag: clickTarget.tagName, cls: String(clickTarget.className).slice(0, 80) };
})()`);
console.log('open session:', JSON.stringify(opened));

let hasTrigger = false;
for (let i = 0; i < 20; i++) {
  await sleep(500);
  hasTrigger = await evaluate(`!!document.querySelector('.usg-sess-trigger')`);
  if (hasTrigger) break;
}
console.log('hasTrigger:', hasTrigger);
await shot('03-session-dock');
if (!hasTrigger) { console.log('RESULT: no dock trigger after opening session'); ws.close(); process.exit(2); }

console.log('dock text:', await evaluate(`document.querySelector('.usg-sess-trigger').innerText.replace(/\\s+/g,' ')`));
await evaluate(`document.querySelector('.usg-sess-trigger').click()`);
await sleep(800);

const geom = await evaluate(`(() => {
  const p = document.querySelector('.usg-sess-panel');
  const a = document.querySelector('.usg-sess-anchor');
  const t = document.querySelector('.usg-sess-trigger');
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) }; };
  const cs = p ? getComputedStyle(p) : null;
  const pr = p ? p.getBoundingClientRect() : null;
  return {
    viewport: { w: innerWidth, h: innerHeight },
    trigger: box(t), anchor: box(a), panel: box(p),
    inViewport: pr ? (pr.top >= 0 && pr.bottom <= innerHeight && pr.left >= 0 && pr.right <= innerWidth) : false,
    parentIsBody: p ? p.closest('.usg-sess-anchor')?.parentElement === document.body : null,
    backdrop: cs ? cs.backdropFilter : null,
    background: cs ? cs.backgroundColor : null,
    text: p ? p.innerText.replace(/\\s+/g, ' ').slice(0, 500) : null,
  };
})()`);
console.log('geometry:', JSON.stringify(geom, null, 2));
await shot('04-panel');
ws.close();
console.log('RESULT:', geom.inViewport ? 'PANEL_IN_VIEWPORT' : 'PANEL_OUT_OF_VIEWPORT');

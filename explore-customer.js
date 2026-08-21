// Quick explorer: login as consumer, dump full DOM text + button-ish labels.
const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:8082/';
const PORT = 9226;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const session = JSON.parse(fs.readFileSync('c:/Users/Jhay-Vy/Downloads/PalengkeHubFinal-main/flowtest-customer-session.json', 'utf8').replace(/^\uFEFF/, ''));
  const profile = 'C:\\Users\\Jhay-Vy\\Downloads\\PalengkeHubFinal-main\\chrome-flow-explore-profile';
  if (fs.existsSync(profile)) fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=430,932', 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(500); try { const t = await fetch(`http://localhost:${PORT}/json`).then(r => r.json()); wsUrl = (t.find(x => x.type === 'page') || {}).webSocketDebuggerUrl; } catch {} }
  if (!wsUrl) { console.error('CDP FAIL'); process.exit(1); }
  const ws = new WebSocket(wsUrl);
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); return r.result?.result?.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: APP_URL });
  await sleep(8000);
  await ev(`localStorage.setItem('sb-jjpgmpufwpbgqjzqymvj-auth-token', ${JSON.stringify(JSON.stringify(session))}); 'ok'`);
  await send('Page.navigate', { url: APP_URL });
  await sleep(15000);
  const text = await ev('document.body.innerText') || '';
  console.log('===== FULL BODY TEXT =====');
  console.log(text);
  console.log('===== END =====');
  const btns = await ev(`[...document.querySelectorAll('div,span')].map(e => (e.innerText||'').trim()).filter(t => t && t.length < 45).filter((v,i,a) => a.indexOf(v)===i).slice(0, 120).join('\\n')`);
  console.log('===== UNIQUE SHORT TEXTS =====');
  console.log(btns);
  chrome.kill();
  process.exit(0);
})();

// Headless Chrome E2E flow test: CUSTOMER flow
// Login as fresh consumer -> Home -> Stall -> Product -> Add to Cart -> PalengKart -> Checkout -> Place Order
const fs = require('fs');
const { spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:8082/';
const PORT = 9224;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const session = JSON.parse(fs.readFileSync('c:/Users/Jhay-Vy/Downloads/PalengkeHubFinal-main/flowtest-customer-session.json', 'utf8').replace(/^\uFEFF/, ''));

  const profile = 'C:\\Users\\Jhay-Vy\\Downloads\\PalengkeHubFinal-main\\chrome-flow-customer-profile';
  if (fs.existsSync(profile)) fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, '--no-first-run',
    '--window-size=430,932', 'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(500);
    try {
      const targets = await fetch(`http://localhost:${PORT}/json`).then(r => r.json());
      const page = targets.find(t => t.type === 'page');
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch {}
  }
  if (!wsUrl) { console.error('FAIL: Chrome CDP not reachable'); process.exit(1); }

  const ws = new WebSocket(wsUrl);
  let msgId = 0;
  const pending = new Map();
  const consoleLogs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.consoleAPICalled') {
      consoleLogs.push(msg.params.args.map(a => a.value || a.description || '').join(' ').substring(0, 250));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const ed = msg.params.exceptionDetails || {};
      consoleLogs.push('EXCEPTION: ' + ((ed.exception && ed.exception.description) || ed.text).substring(0, 300));
    }
  };
  await new Promise(r => { ws.onopen = r; });
  const send = (method, params = {}) => new Promise(res => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return 'EVAL_EXC: ' + (r.result.exceptionDetails.exception?.description || '').substring(0, 200);
    return r.result?.result?.value;
  };
  const bodyText = async () => (await evaluate('document.body ? document.body.innerText : ""')) || '';

  // press(src): find the DEEPEST element matching predicate, then send real CDP mouse events at its center
  const press = async (src) => {
    const coords = await evaluate(`(() => {
      const els = [...document.querySelectorAll('div,span')];
      const matches = els.filter(e => { const txt = (e.innerText||'').trim(); if (!txt || txt.length > 150) return false; try { return (${src}); } catch(e) { return false; } });
      if (!matches.length) return 'NOT_FOUND';
      matches.sort((a, b) => (a.innerText||'').length - (b.innerText||'').length);
      const t = matches[0];
      try { t.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch(e) {}
      const r = t.getBoundingClientRect();
      return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height, txt: (t.innerText||'').trim().substring(0, 40) });
    })()`);
    if (coords === 'NOT_FOUND') return 'NOT_FOUND';
    const c = JSON.parse(coords);
    if (!c.w || !c.h) return 'ZERO_RECT:' + c.txt;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    return 'PRESSED:' + c.txt;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  // ── Step 1: load app, inject session, reload ──
  await send('Page.navigate', { url: APP_URL });
  await sleep(8000);
  await evaluate(`localStorage.setItem('sb-jjpgmpufwpbgqjzqymvj-auth-token', ${JSON.stringify(JSON.stringify(session))}); 'ok'`);
  await send('Page.navigate', { url: APP_URL });
  await sleep(15000);

  let text = await bodyText();
  console.log('── After login: Login screen?', /sign in/i.test(text));
  console.log('── Home head:', text.substring(0, 250).replace(/\n+/g, ' | '));
// ── Step 2: Home -> Stall -> Product Details ──
  console.log('── Stall press:', await press(`txt === 'RK Fresh Meats'`));
  await sleep(8000);
  text = await bodyText();
  console.log('── STALL DETAILS:', /RK Fresh Meats/.test(text) ? 'RENDERED' : 'MISSING', '| products?', /Products \(\d+\)/.test(text));

  console.log('── Product press:', await press(`txt === 'Pork Liempo'`));
  await sleep(8000);
  text = await bodyText();
  console.log('── PRODUCT DETAILS:', /Pork Liempo/.test(text) ? 'RENDERED' : 'MISSING');

  // ── Step 3: Add to Cart (inspect button first) ──
  const dbg = await evaluate(`(() => {
    const out = [];
    const btns = [...document.querySelectorAll('div,span')].filter(e => (e.innerText||'').trim().startsWith('Add to Cart'));
    if (!btns.length) return 'NO_BTN';
    const b = btns[0];
    let n = b;
    for (let i = 0; i < 8 && n; i++) { out.push({ i, tag: n.tagName, role: n.getAttribute('role'), tab: n.getAttribute('tabindex'), dis: n.getAttribute('aria-disabled') }); n = n.parentElement; }
    return JSON.stringify(out);
  })()`);
  console.log('── ADD BTN ANCESTRY:', dbg);

  let addResult = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    addResult = await press(`txt.startsWith('Add to Cart')`);
    console.log('── Add-to-cart press:', addResult);
    await sleep(4000);
    text = await bodyText();
    if (/Added to Cart/.test(text)) break;
  }
  console.log('── Toast seen?', /Added to Cart/.test(text));

  // ── Step 4: go to PalengKart ──
  console.log('── Kart tab press:', await press(`txt.match(/^PalengKart\\s*\\(?\\d*\\)?$/)`));
  await sleep(6000);
  text = await bodyText();
  console.log('── CART:', /My PalengKart|Your cart is empty/.test(text) ? 'RENDERED' : 'MISSING', '| head:', text.substring(0, 200).replace(/\n+/g, ' | '));
// ── Step 5: Checkout -> Place Order ──
  console.log('── Checkout press:', await press(`txt === 'Checkout'`));
  await sleep(6000);
  text = await bodyText();
  console.log('── CHECKOUT:', /place order|Pickup|payment|subtotal|Checkout/i.test(text) ? 'RENDERED' : 'MISSING', '| head:', text.substring(0, 300).replace(/\n+/g, ' | '));

  console.log('── Place order press:', await press(`/Place Order|Place order|Confirm Order|Proceed to Pay|Submit Order/i.test(txt)`));
  await sleep(8000);
  text = await bodyText();
  console.log('── GCASH MODAL?', /GCash|Scan to Pay|Time Remaining/i.test(text));
  console.log('── modal head:', text.substring(0, 400).replace(/\n+/g, ' | '));

  console.log('=== CART-RELATED LOGS ===');
  consoleLogs.filter(l => /GLOBAL|addToCart|CART UPDATED|toast|Added|added|Cart/i.test(l)).slice(0, 20).forEach(l => console.log('- ' + l));
  console.log('=== CONSOLE ERRORS (' + consoleLogs.length + ') ===');
  consoleLogs.filter(l => /error|exception|warn/i.test(l)).slice(0, 15).forEach(l => console.log('- ' + l));

  chrome.kill();
  process.exit(0);
}

main().catch(e => { console.error('TEST ERROR:', e); process.exit(1); });
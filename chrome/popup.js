const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);
const ERP_ORIGIN = 'https://erp.iitkgp.ac.in/';
const LOGIN_URL = 'https://erp.iitkgp.ac.in/IIT_ERP3/';
const GMAIL = ['https://mail.google.com/*'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function status(msg, kind = '') {
  $('status').textContent = msg;
  $('status').className = kind;
}

function readForm() {
  return {
    userId: $('userId').value.trim(),
    password: $('password').value,
    qa: [0, 1, 2].map((i) => ({ q: $('q' + i).value.trim(), a: $('a' + i).value.trim() })),
  };
}

// "https://mail.google.com/mail/u/1/#inbox" -> 1 ; anything else -> null
function parseGmailUrl(url) {
  const m = (url || '').trim().match(/^https:\/\/mail\.google\.com\/mail\/u\/(\d{1,2})(?=[\/?#]|$)/i);
  return m ? parseInt(m[1], 10) : null;
}

function showAcct() {
  const url = $('gmailUrl').value.trim();
  const n = parseGmailUrl(url);
  const el = $('acctInfo');
  if (!url) { el.textContent = ''; el.className = 'hint'; }
  else if (n === null) { el.textContent = "Couldn't find /u/<number>/ in this URL. Paste the address of your Gmail inbox."; el.className = 'hint err'; }
  else { el.textContent = `Gmail account number detected: ${n}`; el.className = 'hint ok'; }
  return n;
}

function readSettings() {
  return { autoOtp: $('autoOtp').checked, gmailUrl: $('gmailUrl').value.trim(), acct: parseGmailUrl($('gmailUrl').value) };
}

async function save() {
  const creds = readForm();
  await api.storage.local.set({ creds, settings: readSettings() });
  return creds;
}

async function load() {
  const { creds, settings } = await api.storage.local.get(['creds', 'settings']);
  if (settings) {
    let hasPerm = false;
    try { hasPerm = await api.permissions.contains({ origins: GMAIL }); } catch {}
    $('autoOtp').checked = !!settings.autoOtp && hasPerm;   // access revoked elsewhere => show as off
    $('gmailUrl').value = settings.gmailUrl || '';
    showAcct();
  }
  if (!creds) return;
  $('userId').value = creds.userId || '';
  $('password').value = creds.password || '';
  (creds.qa || []).forEach((x, i) => {
    if (i > 2) return;
    $('q' + i).value = x.q || '';
    $('a' + i).value = x.a || '';
  });
}

async function sendFill(tabId) {
  for (let i = 0; i < 6; i++) {
    try {
      return await api.tabs.sendMessage(tabId, { type: 'KGP_FILL' });
    } catch {
      await sleep(400); // content script not ready yet
    }
  }
  return null;
}

// Open (or navigate to) the login page and let the content script fill it once loaded.
// The popup closes when focus moves to the tab, so the work is handed over via storage.
async function openAndFill(tabId) {
  await api.storage.local.set({ pendingFill: Date.now() });
  if (tabId) await api.tabs.update(tabId, { url: LOGIN_URL });
  else await api.tabs.create({ url: LOGIN_URL });
  window.close();
}

async function fill() {
  $('fill').disabled = true;                 // one run at a time: a second click would trigger another lookup
  try { await fillInner(); } finally { $('fill').disabled = false; }
}

async function fillInner() {
  const c = await save();
  if (!c.userId || !c.password) return status('Enter your User ID and password first.', 'err');

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith(ERP_ORIGIN)) return openAndFill();

  status('Logging in…');
  const res = await sendFill(tab.id);
  if (!res) return status('Could not reach the page. Reload the ERP tab and try again.', 'err');
  if (res.ok) {
    if (res.warn) return status(`OTP requested. ${res.warn}`, 'err');
    if (res.waiting) return status(res.note || 'OTP requested. Watching Gmail for 1 minute. The countdown shows on the ERP page.', 'ok');
    return status(res.note || 'OTP requested. Check your email, type it in, then click Log In.', 'ok');
  }
  if (res.code === 'NO_FORM') return openAndFill(tab.id);

  if (res.code === 'UNKNOWN_Q') {
    const free = [0, 1, 2].find((i) => !$('q' + i).value.trim());
    if (free !== undefined) {
      $('q' + free).value = res.question;
      $('a' + free).focus();
      return status('New question added. Type its answer, press Save, then click Log in to ERP again.', 'err');
    }
    return status(`"${res.question}" doesn't match any saved question. Edit one of them.`, 'err');
  }
  status(res.error, 'err');
}

$('toggle').addEventListener('click', () => {
  const show = $('password').type === 'password';
  $('password').type = show ? 'text' : 'password';
  $('toggle').textContent = show ? 'Hide' : 'Show';
});

// Gmail access is requested only when this is ticked (the request must be the first await: it needs the click),
// and handed back when it's unticked.
$('autoOtp').addEventListener('change', async () => {
  if ($('autoOtp').checked) {
    if (showAcct() === null) {
      $('autoOtp').checked = false;
      return status('Paste your Gmail inbox URL first (it must contain /u/<number>/).', 'err');
    }
    let ok = false;
    try { ok = await api.permissions.request({ origins: GMAIL }); } catch {}
    if (!ok) {
      $('autoOtp').checked = false;
      status("Gmail access wasn't granted, so auto-fill stays off.", 'err');
    } else {
      status('Gmail access granted. Press "Test Gmail feed" to check it.', 'ok');
    }
  } else {
    try { await api.permissions.remove({ origins: GMAIL }); } catch {}
    status('Gmail access removed.', 'ok');
  }
  await save();
});
$('gmailUrl').addEventListener('input', showAcct);
$('gmailUrl').addEventListener('change', async () => {
  const n = showAcct();
  if (n === null && $('autoOtp').checked) status('Gmail URL is invalid, so the OTP auto-fill will report an error until you fix it.', 'err');
  await save();
});

$('test').addEventListener('click', async () => {
  if (!$('autoOtp').checked) return status('Tick "Auto-fill the OTP and log in" first.', 'err');
  const { acct } = readSettings();
  if (acct === null) return status('Paste your Gmail inbox URL first.', 'err');
  status('Checking the Gmail feed…');
  let r;
  try { r = await api.runtime.sendMessage({ type: 'KGP_FEED', acct }); } catch (e) { r = { ok: false, error: String(e) }; }
  if (r && r.ok) {
    status(`Feed works for ${r.account || 'your account'}: ${r.total} unread mail(s) listed, ${r.otps.length} of them ERP OTP mail(s). If that isn't the account that receives the ERP OTP, fix the URL above.`, 'ok');
  } else {
    status((r && r.error) || 'No answer from the background script.', 'err');
  }
});

$('save').addEventListener('click', async () => { await save(); status('Saved.', 'ok'); });
$('fill').addEventListener('click', fill);
load().then(() => { if ($('autoOtp').checked) $('gmailBox').open = true; });

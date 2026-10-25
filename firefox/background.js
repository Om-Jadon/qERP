// Fetches Gmail's unread-mail Atom feed (the same one you opened in a tab) using your existing
// Gmail login, and hands back ONLY ERP OTP emails: {id, otp, issuedMs}. Nothing else from the
// feed is kept or forwarded, and nothing is sent anywhere except this one request to Gmail.
const api = globalThis.browser ?? globalThis.chrome;
const GMAIL_ORIGINS = ['https://mail.google.com/*'];
const ERP_ORIGIN = 'https://erp.iitkgp.ac.in/';

// Subject: "OTP for Sign In in ERP Portal of IIT Kharagpur is 216489"
const OTP_RE = /ERP\s*Portal[^\d]{0,60}?\bis\s+(\d{4,8})\b/i;
const SENDER_RE = /@([a-z0-9-]+\.)*iitkgp\.ac\.in$/i;
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : '';
};

async function handleFeed(msg) {
  if (!(await api.permissions.contains({ origins: GMAIL_ORIGINS }))) {
    return { ok: false, code: 'NO_PERM', error: 'Gmail access is off. Turn the option on in the extension.' };
  }
  const n = msg.acct;
  if (!Number.isInteger(n) || n < 0 || n > 9) {
    return { ok: false, code: 'NO_ACCT', error: 'No Gmail URL saved. Open the extension and paste your Gmail inbox URL.' };
  }
  let r;
  try {
    r = await fetch(`https://mail.google.com/mail/u/${n}/feed/atom`, { credentials: 'include', cache: 'no-store' });
  } catch {
    return { ok: false, code: 'NET', error: 'Could not reach Gmail.' };
  }
  const xml = r.ok ? await r.text() : '';
  if (!xml.includes('<feed')) {
    return { ok: false, code: 'NOT_FEED', error: `Gmail returned no feed. Sign in to Gmail in this browser, and check the URL you saved (account number ${n}).` };
  }
  const entries = xml.split('<entry>').slice(1);
  const otps = [];
  for (const e of entries) {
    const title = tag(e, 'title');
    const m = /\bOTP\b/i.test(title) && title.match(OTP_RE);
    if (!m || !SENDER_RE.test(tag(e, 'email'))) continue;
    otps.push({ id: tag(e, 'id'), otp: m[1], issuedMs: Date.parse(tag(e, 'issued')) || 0 });
  }
  const head = xml.split('<entry>')[0];
  const account = (head.match(/<title[^>]*>\s*Gmail - Inbox for ([^<]+?)\s*<\/title>/) || [])[1] || '';
  return { ok: true, account, total: entries.length, otps }; // feed order = newest first
}

function allowed(sender) {
  if (!sender || sender.id !== api.runtime.id) return false;
  const u = sender.url || (sender.tab && sender.tab.url) || '';
  return u.startsWith(ERP_ORIGIN) || u.startsWith(api.runtime.getURL(''));
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'KGP_FEED' || !allowed(sender)) return;
  const p = handleFeed(msg).catch((e) => ({ ok: false, code: 'ERR', error: String(e) }));
  if (globalThis.browser) return p;   // Firefox: return the promise
  p.then(sendResponse);               // Chrome: async sendResponse
  return true;
});

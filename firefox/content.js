(() => {
  if (window.__kgpQuickLoginLoaded) return;
  window.__kgpQuickLoginLoaded = true;

  const api = globalThis.browser ?? globalThis.chrome;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const $id = (id) => document.getElementById(id);
  const DEFAULT_LABEL = norm('Security Question');
  const OTP_WAIT_MS = 60000;

  async function waitFor(fn, timeout = 5000, step = 100) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  // ---- locate the form controls: known ids first, then placeholders, then order ----
  const isVisible = (el) => !!(el.offsetParent || el.getClientRects().length);

  function findFields() {
    const inputs = [...document.querySelectorAll('input')].filter(
      (i) => !['hidden', 'checkbox', 'radio', 'button', 'submit'].includes(i.type) && isVisible(i)
    );
    const byPh = (re) => inputs.find((i) => re.test(i.placeholder || ''));
    const user = $id('user_id') || byPh(/roll|employee|stakeholder/i) || inputs[0];
    const password = $id('password') || byPh(/password/i) || inputs[1];
    const answer = $id('answer') || byPh(/answer|security/i) || inputs[2];
    const otp = $id('email_otp1') || byPh(/otp/i) || inputs[3];
    const ok = !!(user && password && answer && new Set([user, password, answer]).size === 3);
    return { ok, user, password, answer, otp };
  }

  function findOtpButton() {
    return (
      $id('getotp') ||
      [...document.querySelectorAll('button, input[type=button], input[type=submit]')].find((b) =>
        /(get|resend)\s*otp/i.test((b.innerText || b.textContent || b.value || '').trim())
      )
    );
  }

  // ---- the question text lives in <label id="question" for="answer"> ----
  function questionEl(answerEl) {
    let label = null;
    if (answerEl.id) label = [...document.querySelectorAll('label')].find((l) => l.htmlFor === answerEl.id);
    if (!label) label = $id('question');
    if (!label) {
      let node = answerEl;
      for (let i = 0; i < 5 && node.parentElement && !label; i++) {
        node = node.parentElement;
        label = [...node.querySelectorAll('label')].find((l) => !l.contains(answerEl));
      }
    }
    return label;
  }
  const questionText = (answerEl) => {
    const l = questionEl(answerEl);
    return l ? l.textContent.trim() : '';
  };

  function findAnswer(question, list) {
    const nq = norm(question);
    const items = (list || []).filter((x) => x.q && x.a);
    let hit = items.find((x) => norm(x.q) === nq);
    if (!hit) hit = items.find((x) => norm(x.q).length > 2 && (nq.includes(norm(x.q)) || norm(x.q).includes(nq)));
    return hit ? hit.a : null;
  }

  // ---- ERP endpoints (same-origin only) ----
  const FORM_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
  };

  // Fallback when the Get OTP button is missing: send what the page's own getEmailOTP() sends.
  async function requestOtpDirect() {
    const form = $id('loginForm');
    if (!form) return null;
    try {
      const r = await fetch('/SSOAdministration/getEmilOTP.htm', {
        method: 'POST',
        credentials: 'include',
        headers: FORM_HEADERS,
        body: new URLSearchParams(new FormData(form)),
      });
      const msg = String((await r.json()).msg || '');
      return { sent: !/unable|invalid|incorrect|wrong|mismatch|not match|fail/i.test(msg), msg };
    } catch {
      return null;
    }
  }

  // ---- set a value so the page's own handlers (jQuery) notice it ----
  // No focus() calls on purpose: moving real focus would fire real blur events, and the page runs a
  // security-question lookup on every User ID blur (the ERP hands out a NEW question per lookup).
  function setValue(el, value, fireBlur = false) {
    try {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    } catch {
      el.value = value;
    }
    for (const t of ['input', 'keyup', 'change']) el.dispatchEvent(new Event(t, { bubbles: true }));
    if (fireBlur) {
      el.dispatchEvent(new FocusEvent('blur'));
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }
  }

  // While we run, swallow REAL (user/browser) blur events on the User ID box so only our single
  // synthetic blur reaches the page and triggers exactly one lookup.
  function blockRealBlur(el) {
    const h = (e) => { if (e.target === el && e.isTrusted) e.stopImmediatePropagation(); };
    window.addEventListener('blur', h, true);
    return () => window.removeEventListener('blur', h, true);
  }

  // Trigger the page's own (single) lookup and read its result from the label.
  async function lookupQuestion(f, userId, timeout = 10000) {
    const label = questionEl(f.answer);
    if (label) label.textContent = 'Security Question';       // reset, so a fresh answer can't be mistaken for a stale one
    setValue(f.user, userId, true);                            // ONE blur => the page does ONE lookup
    const q = await waitFor(() => {
      const t = questionText(f.answer);
      return t && norm(t) !== DEFAULT_LABEL ? t : null;
    }, timeout, 150);
    if (q) await waitFor(() => !f.answer.readOnly, 3000);      // the page unlocks the answer box when it's done
    return q;
  }

  // ---- the page shows a SweetAlert after Get OTP; read it, close it if it's a success ----
  async function readOtpDialog(timeout = 15000) {
    const pop = await waitFor(() => document.querySelector('.swal2-popup'), timeout, 150);
    if (!pop) return null;
    await sleep(200);
    const title = (pop.querySelector('.swal2-title')?.textContent || '').trim();
    const msg = (pop.querySelector('.swal2-html-container, .swal2-content')?.textContent || '').trim();
    const bad = /unable|invalid|incorrect|wrong|mismatch|not match|fail/i.test(`${title} ${msg}`);
    if (!bad) pop.querySelector('.swal2-confirm')?.click();
    return { ok: !bad, title, msg };
  }

  // ---- in-page messages (visible even after the popup closes): a status line + a sticky error line ----
  const COLORS = { ok: '#1b7f3b', err: '#b3261e', info: '#1e3a78' };
  function line(id, msg, bg, ttl) {
    let box = $id('kgp-ql-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'kgp-ql-box';
      box.style.cssText =
        'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;' +
        'flex-direction:column;gap:6px;align-items:center;pointer-events:none;max-width:90vw;font:14px system-ui,sans-serif';
      document.documentElement.appendChild(box);
    }
    let d = $id(id);
    if (!d) {
      d = document.createElement('div');
      d.id = id;
      d.style.cssText = 'padding:10px 16px;border-radius:8px;color:#fff;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.35)';
      box.appendChild(d);
    }
    d.textContent = msg;
    d.style.background = bg;
    clearTimeout(d._t);
    if (ttl) d._t = setTimeout(() => d.remove(), ttl);
  }
  const banner = (msg, kind = 'info', ttl = 0) => line('kgp-ql-status', msg, COLORS[kind], ttl);
  const bannerError = (msg) => line('kgp-ql-error', msg, COLORS.err, 30000);
  const clearError = () => { const e = $id('kgp-ql-error'); if (e) e.remove(); };

  // ---- OTP from the Gmail unread feed (fetched by background.js) ----
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  async function askFeed(acct) {
    try {
      return (await api.runtime.sendMessage({ type: 'KGP_FEED', acct })) || { ok: false, error: 'no response from the extension.' };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  // Remember which OTP emails are already unread, so only the NEW one counts.
  async function readBaseline(settings) {
    if (!Number.isInteger(settings.acct)) {
      return { ok: false, error: 'No Gmail URL saved. Open the extension and paste your Gmail inbox URL.' };
    }
    const r = await askFeed(settings.acct);
    if (!r.ok) return { ok: false, error: r.error || 'unknown error.' };
    return { ok: true, ids: new Set(r.otps.map((o) => o.id)) };
  }

  // Poll the feed for up to OTP_WAIT_MS with a visible countdown; fill the OTP and log in when it arrives.
  async function watchFeed(settings, f, baselineIds) {
    const end = Date.now() + OTP_WAIT_MS;
    let lastPoll = 0;
    let netFails = 0;
    while (Date.now() < end) {
      banner(`Waiting for the OTP email in Gmail… ${fmt(Math.max(0, Math.ceil((end - Date.now()) / 1000)))} left`);
      if (Date.now() - lastPoll >= 2000) {
        lastPoll = Date.now();
        const r = await askFeed(settings.acct);
        if (!r.ok) {
          bannerError(`Gmail feed problem: ${r.error}`);               // tell the user right away
          if (r.code !== 'NET' || ++netFails >= 3) {                    // a network blip gets a few retries
            banner('Stopped waiting for Gmail. Type the OTP yourself and click Log In.', 'err', 12000);
            return;
          }
        } else {
          if (netFails) clearError();
          netFails = 0;
          const hit = r.otps.find((o) => (baselineIds ? !baselineIds.has(o.id) : Date.now() - o.issuedMs < 180000));
          if (hit) {
            setValue(f.otp, hit.otp);
            f.otp.focus();
            const nowQ = questionText(f.answer);
            if (session.question && norm(nowQ) !== norm(session.question)) {
              const a2 = findAnswer(nowQ, session.qa);
              if (a2) setValue(f.answer, a2);
              banner(`The security question changed to "${nowQ}". OTP filled, but I did not log in. Check the answer and click Log In yourself.`, 'err', 20000);
              return;
            }
            banner('OTP filled. Logging in…', 'ok');
            await sleep(400);
            const btn = $id('loginFormSubmitButton');
            if (btn) btn.click();
            return;
          }
        }
      }
      await sleep(250);
    }
    banner("1 minute is up and the OTP email didn't arrive. Type the OTP yourself and click Log In.", 'err', 15000);
  }

  function afterOtpSent(question, gm, settings, f, recent) {
    if (f.otp) f.otp.focus();
    if (!gm) return { ok: true, question };
    if (!gm.ok) {
      banner('OTP requested. Gmail auto-fill is unavailable, so type the OTP and click Log In.', 'info', 12000);
      return { ok: true, question, warn: `Gmail feed problem: ${gm.error} Type the OTP yourself.` };
    }
    watchFeed(settings, f, recent ? null : gm.ids).catch(() => {});
    return { ok: true, question, waiting: true };
  }

  // what the form currently holds, so the auto-login can double-check it right before Log In
  const session = { question: '', qa: [] };

  async function runCore() {
    const { creds, settings = {} } = await api.storage.local.get(['creds', 'settings']);
    if (!creds || !creds.userId || !creds.password) {
      return { ok: false, code: 'NO_CREDS', error: 'Save your User ID and password first.' };
    }
    const f = findFields();
    if (!f.ok) return { ok: false, code: 'NO_FORM', error: 'Login form not found on this page.' };

    // Check the Gmail feed alongside the form fill; a problem is shown at once but never blocks the login steps.
    const gmP =
      settings.autoOtp && f.otp
        ? readBaseline(settings).then((gm) => {
            if (!gm.ok) bannerError(`Gmail feed problem: ${gm.error} The OTP will still be sent; type it in yourself.`);
            return gm;
          })
        : null;

    const unblock = blockRealBlur(f.user);
    try {
      return await fillAndRequest(creds, settings, f, gmP);
    } finally {
      unblock();
    }
  }

  async function fillAndRequest(creds, settings, f, gmP) {
    setValue(f.password, creds.password);                      // password first: the User ID blur below is the only lookup trigger

    let question = await lookupQuestion(f, creds.userId);
    if (!question) {
      return { ok: false, code: 'NO_Q', error: "The ERP didn't return a security question. Check your User ID and try again." };
    }
    let answer = findAnswer(question, creds.qa);
    if (!answer) return { ok: false, code: 'UNKNOWN_Q', question, error: `No saved answer for: "${question}"` };
    setValue(f.answer, answer);                                // the 'input' event is what enables Get OTP

    const gm = gmP ? await gmP : null;

    // last check before the OTP goes out: is the label still the question we answered?
    const now = questionText(f.answer);
    if (norm(now) !== norm(question)) {
      answer = findAnswer(now, creds.qa);
      if (!answer) return { ok: false, code: 'UNKNOWN_Q', question: now, error: `No saved answer for: "${now}"` };
      question = now;
      setValue(f.answer, answer);
    }
    session.question = question;
    session.qa = creds.qa;

    const btn = findOtpButton();
    if (!btn) {
      const d = await requestOtpDirect();
      if (!d) return { ok: false, code: 'NO_BTN', error: 'Could not find the Get OTP button.' };
      if (!d.sent) return { ok: false, code: 'OTP_FAIL', error: `ERP said: ${d.msg || 'OTP request failed'}` };
      return afterOtpSent(question, gm, settings, f, false);
    }
    if (btn.disabled) {                    // 60 s resend cooldown: an OTP was just sent
      if (gm && gm.ok) return { ...afterOtpSent(question, gm, settings, f, true), note: 'An OTP was sent a moment ago. Looking for it in Gmail…' };
      if (f.otp) f.otp.focus();
      return { ok: true, question, note: 'Fields filled. An OTP was requested a moment ago, so check your email.' };
    }

    btn.click();
    const dlg = await readOtpDialog();
    if (!dlg) return { ok: false, code: 'NO_CONFIRM', error: 'Clicked Get OTP, but the ERP showed no confirmation. Check the page.' };
    if (!dlg.ok) return { ok: false, code: 'OTP_FAIL', error: `ERP says: ${dlg.msg || dlg.title}` };

    await sleep(400);
    return afterOtpSent(question, gm, settings, f, false);
  }

  // one run at a time: a second call (double click, popup retry) just gets the first run's result
  let inFlight = null;
  function run() {
    if (!inFlight) inFlight = runCore().catch((e) => ({ ok: false, code: 'ERR', error: String(e) })).finally(() => { inFlight = null; });
    return inFlight;
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'KGP_FILL') return;
    const p = run().catch((e) => ({ ok: false, code: 'ERR', error: String(e) }));
    if (globalThis.browser) return p;      // Firefox: return the promise
    p.then(sendResponse);                  // Chrome: async sendResponse
    return true;
  });

  // ---- the popup opened a fresh login tab and asked us to fill it once it loads ----
  (async () => {
    const { pendingFill } = await api.storage.local.get('pendingFill');
    if (!pendingFill) return;
    if (Date.now() - pendingFill > 60000) return api.storage.local.remove('pendingFill');
    for (let i = 0; i < 24 && !findFields().ok; i++) await sleep(250);
    if (!findFields().ok) return;          // not the login page (yet); the flag expires on its own
    await api.storage.local.remove('pendingFill');
    const r = await run();
    if (r.ok) {
      if (!r.waiting && !r.warn) banner(r.note || 'OTP requested. Type it in and click Log In.', 'ok', 6000);
    } else if (r.code === 'UNKNOWN_Q') {
      banner(`New security question: "${r.question}". Open the extension and add its answer.`, 'err', 8000);
    } else {
      banner(r.error, 'err', 8000);
    }
  })();
})();

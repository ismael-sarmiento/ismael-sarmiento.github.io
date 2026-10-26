// The contact form shared by CV Online and IsAcademy (styles: /assets/ds/contact.css): validation in the visitor's
// language, an invisible field that catches bots, an invisible Cloudflare Turnstile check and delivery through the
// isa-forms Worker (source: tools/cloudflare/isa-forms.js), which verifies the check and mails Ismael with Resend.
// No address is written in the page. Each site writes its own fields and decides what the email he receives says
// (buildEmail: visible fields become rows, _subject and _replyto steer the email).
//
//   initContactForm({ form, texts: () => ({ required, badEmail, needPrivacy, send, sending, ok, error }),
//                     buildEmail: async form => ({ … }), onSent })
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const WORKER = 'https://isa-forms.ismaelantonio-professional.workers.dev';
const SITE_KEY = '0x4AAAAAAFZ7JbJ5yVIvt3uH';   // Turnstile widget «Universo Ismael - formularios» (Invisible)
const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_LOAD_TIMEOUT_MS = 10_000;
const SUBMIT_TIMEOUT_MS = 30_000;

// Only explicit pre-delivery rejections prove the request was not received.
function rejectedSubmission(response, data) {
  const codes = { 400: ['json', 'fields'], 403: ['origin', 'turnstile'],
    405: ['method'], 413: ['size'], 502: ['mail_rejected'] };
  return codes[response.status]?.includes(data?.message) === true;
}

// one message under a field (or none), announced to screen readers through aria-describedby
export function fieldError(field, msg) {
  const label = field.closest('label');
  let err = label.querySelector('.f-error');
  if (!msg) { err?.remove(); field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); return; }
  if (!err) { err = document.createElement('span'); err.className = 'f-error'; err.id = `err-${field.form.id}-${field.name}`; label.appendChild(err); }
  err.textContent = msg;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', err.id);
}

// every required field, in the order of the form; the first problem gets the focus
function validate(form, tx, { focus = true, onlyInvalid = false } = {}) {
  let first = null;
  for (const field of form.querySelectorAll('input[required], select[required], textarea[required]')) {
    if (onlyInvalid && field.getAttribute('aria-invalid') !== 'true') continue;
    const value = field.type === 'checkbox' ? field.checked : field.value.trim();
    const msg = !value ? (field.type === 'checkbox' ? tx.needPrivacy : tx.required)
      : field.type === 'email' && !EMAIL.test(field.value.trim()) ? tx.badEmail : '';
    fieldError(field, msg);
    if (msg && !first) first = field;
  }
  if (focus) first?.focus();
  return !first;
}

// Cloudflare's script is only fetched once the visitor starts using a form (a failed load is tried again on the next send)
let api = null;
function loadTurnstile() {
  if (api) return api;
  const attempt = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) { script.remove(); reject(error); }
      else resolve(window.turnstile);
    };
    const timer = setTimeout(() => finish(new Error('turnstile_timeout')), TURNSTILE_LOAD_TIMEOUT_MS);
    script.src = TURNSTILE;
    script.onload = () => finish(window.turnstile ? null : new Error('turnstile'));
    script.onerror = () => finish(new Error('turnstile'));
    document.head.appendChild(script);
  });
  api = attempt;
  attempt.catch(() => { if (api === attempt) api = null; });
  return attempt;
}

// one invisible widget per form; every send asks it for a fresh token (a token is accepted only once)
function humanCheck(form) {
  const box = document.createElement('div');
  box.className = 'f-turnstile';
  form.appendChild(box);
  let widget = null, waiting = null;
  const settle = (ok, value) => { const w = waiting; waiting = null; w?.[ok ? 'resolve' : 'reject'](value); };
  const ready = async () => {
    const turnstile = await loadTurnstile();
    widget ??= turnstile.render(box, {
      sitekey: SITE_KEY, execution: 'execute', retry: 'never',
      callback: token => settle(true, token),
      'error-callback': () => { settle(false, new Error('turnstile')); return true; },
    });
    return turnstile;
  };
  return {
    warm: () => { ready().catch(() => {}); },
    token: async () => {
      const turnstile = await ready();
      return new Promise((resolve, reject) => {
        const mine = waiting = { resolve, reject };
        turnstile.reset(widget);
        turnstile.execute(widget);
        setTimeout(() => { if (waiting === mine) settle(false, new Error('timeout')); }, 30000);
      });
    },
  };
}

export function initContactForm({ form, texts, buildEmail, onSent }) {
  const status = form.querySelector('.f-status');
  const button = form.querySelector('[type="submit"]');
  const check = humanCheck(form);
  let sending = false, statusKey = '';
  // Keep semantic state rather than a translated sentence: an in-flight request may finish in another language.
  const renderFeedback = () => {
    const tx = texts();
    button.textContent = sending ? tx.sending : tx.send;
    status.textContent = statusKey ? (tx[statusKey] || (statusKey === 'saved' ? tx.ok : statusKey === 'uncertain' ? tx.error : '')) : '';
  };
  const setStatus = (key = '', tone = '') => {
    statusKey = key;
    status.className = 'f-status';
    if (tone) status.classList.add(tone);
    renderFeedback();
  };
  const refreshTexts = () => {
    // Translate only feedback already shown; do not introduce new errors or move focus on a language change.
    validate(form, texts(), { focus: false, onlyInvalid: true });
    renderFeedback();
  };
  form.addEventListener('focusin', check.warm, { once: true });
  form.addEventListener('input', e => { if (e.target.getAttribute('aria-invalid')) fieldError(e.target, ''); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    setStatus();
    if (!validate(form, texts())) return;
    if (form.elements._honey?.value) return;   // bots fill the invisible field
    sending = true; button.disabled = true; renderFeedback();
    let postStarted = false, timer;
    try {
      const email = await buildEmail(form);
      email._page = location.origin + location.pathname;
      email['cf-turnstile-response'] = await check.token();
      const body = JSON.stringify(email);
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
      postStarted = true;
      const res = await fetch(WORKER, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body, signal: controller.signal,
      });
      const json = await res.json();
      if (res.ok && String(json?.success) === 'true') {
        // Once acknowledged, a presentation callback cannot turn receipt into a delivery error.
        const savedWithoutMail = json.stored === true && json.notification !== 'accepted';
        setStatus(savedWithoutMail ? 'saved' : 'ok', 'ok');
        try { form.reset(); onSent?.(); }
        catch { console.warn('Contact received; presentation refresh could not complete.'); }
      } else {
        setStatus(rejectedSubmission(res, json) ? 'error' : 'uncertain', 'err');
      }
    } catch {
      // A lost answer does not prove that the server failed to receive the request.
      setStatus(postStarted ? 'uncertain' : 'error', 'err');
    } finally {
      if (timer) clearTimeout(timer);
      sending = false; button.disabled = false; renderFeedback();
    }
  });
  return { refreshTexts };
}

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
function validate(form, tx) {
  let first = null;
  for (const field of form.querySelectorAll('input[required], select[required], textarea[required]')) {
    const value = field.type === 'checkbox' ? field.checked : field.value.trim();
    const msg = !value ? (field.type === 'checkbox' ? tx.needPrivacy : tx.required)
      : field.type === 'email' && !EMAIL.test(field.value.trim()) ? tx.badEmail : '';
    fieldError(field, msg);
    if (msg && !first) first = field;
  }
  first?.focus();
  return !first;
}

// Cloudflare's script is only fetched once the visitor starts using a form (a failed load is tried again on the next send)
let api = null;
function loadTurnstile() {
  api ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    script.onerror = () => { api = null; script.remove(); reject(new Error('turnstile')); };
    document.head.appendChild(script);
  });
  return api;
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
  form.addEventListener('focusin', check.warm, { once: true });
  form.addEventListener('input', e => { if (e.target.getAttribute('aria-invalid')) fieldError(e.target, ''); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const tx = texts();
    status.textContent = ''; status.className = 'f-status';
    if (!validate(form, tx)) return;
    if (form.elements._honey?.value) return;   // bots fill the invisible field
    button.disabled = true; button.textContent = tx.sending;
    try {
      const email = await buildEmail(form);
      email._page = location.origin + location.pathname;
      email['cf-turnstile-response'] = await check.token();
      const res = await fetch(WORKER, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(email),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || String(json.success) !== 'true') throw new Error(json.message || res.status);
      form.reset();
      onSent?.();
      // A stored request is received even when its email notification failed or is unconfirmed.
      const savedWithoutMail = json.stored === true && json.notification !== 'accepted';
      status.textContent = savedWithoutMail ? (tx.saved || tx.ok) : tx.ok;
      status.classList.add('ok');
    } catch {
      status.textContent = tx.error; status.classList.add('err');
    } finally {
      button.disabled = false; button.textContent = tx.send;
    }
  });
}

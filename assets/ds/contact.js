// The contact form shared by CV Online and IsAcademy (styles: /assets/ds/contact.css): validation in the visitor's
// language, an invisible field that catches bots, delivery by FormSubmit (https://formsubmit.co) to Ismael's inbox and
// a status line. Each site writes its own fields and decides what the email he receives says (buildEmail).
//
//   initContactForm({ form, to: 'ismaelantonio.professional@gmail.com', texts: () => ({ required, badEmail,
//                     needPrivacy, send, sending, ok, error }), buildEmail: async form => ({ … }), onSent })
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

export function initContactForm({ form, to, texts, buildEmail, onSent }) {
  const status = form.querySelector('.f-status');
  const button = form.querySelector('[type="submit"]');
  form.addEventListener('input', e => { if (e.target.getAttribute('aria-invalid')) fieldError(e.target, ''); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const tx = texts();
    status.textContent = ''; status.className = 'f-status';
    if (!validate(form, tx)) return;
    if (form.elements._honey?.value) return;   // bots fill the invisible field
    button.disabled = true; button.textContent = tx.sending;
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${to}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(await buildEmail(form)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || String(json.success) !== 'true') throw new Error(json.message || res.status);
      form.reset();
      onSent?.();
      status.textContent = tx.ok; status.classList.add('ok');
    } catch {
      status.textContent = tx.error; status.classList.add('err');
    } finally {
      button.disabled = false; button.textContent = tx.send;
    }
  });
}

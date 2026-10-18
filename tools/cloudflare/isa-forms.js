// isa-forms · Cloudflare Worker that receives the contact forms of ismael-sarmiento.github.io (CV Online, IsAcademy).
// It checks the visitor with Cloudflare Turnstile and sends the message to Ismael's inbox with Resend, so no form
// talks to a mail service directly and bots without a valid Turnstile token are turned away.
// (FormSubmit was the first choice, but it rejects requests from Cloudflare's servers with «Rate limit exceeded».)
//
// Deployed by hand in the Cloudflare dashboard (Workers & Pages → isa-forms → Edit code), URL:
//   https://isa-forms.ismaelantonio-professional.workers.dev
// Settings → Variables and Secrets:
//   FORM_TO           text    inbox the messages go to (the Resend account's own address: the free sender only
//                             delivers there)
//   ALLOWED_ORIGIN    text    comma-separated origins allowed to post (https://ismael-sarmiento.github.io)
//   ALLOWED_HOSTS     text    comma-separated hostnames Turnstile may report (ismael-sarmiento.github.io)
//   TURNSTILE_SECRET  secret  secret key of the Turnstile widget «Universo Ismael - formularios»
//   RESEND_API_KEY    secret  Resend API key «isa-forms» (sending access only)
// Bindings: FORM_EVENTS (Workers Analytics Engine, dataset isa_forms_events): one anonymous event per request with
// the site and the outcome, read by the private panel (isa-panel.js). No field of the message is stored.
//           SITE_VIEWS (Workers Analytics Engine, dataset isa_site_views): POST /hit, sent once per page by
// /assets/ds/views.js, adds one page view with the site and the approximate place Cloudflare derives from the network
// (country, region, city and the city's coordinates rounded to 0.1°). No IP, cookie or identifier is stored.
//
// The forms post JSON: the visible fields (Nombre, Email, Mensaje…) plus _subject, _replyto, _page, _honey and
// cf-turnstile-response. Fields starting with "_" steer the email and are not listed in it.
const MAX_BODY = 10_000;
const FROM = 'Formularios Ismael Sarmiento <onboarding@resend.dev>';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const list = value => (value || '').split(',').map(s => s.trim()).filter(Boolean);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- the email Ismael receives: the look of the sites (ink, gold, cream), built for mail clients ----------
// (tables and inline styles only: Gmail and Outlook drop <style> sheets and most modern CSS)
const SITE = 'https://ismael-sarmiento.github.io';
const FONT = "'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const C = { ink: '#1c2547', ink2: '#2e3c74', ink3: '#121833', gold: '#c8953f', gold2: '#e2b25c', goldDark: '#7a5212',
  onGold: '#1c1407', cream: '#fbf7ef', cream2: '#f4ecdd', line: '#e6dcc8', text: '#3a4170', soft: '#6d7499', light: '#f6f1e7' };
// fields shown in their own place, not in the details list
const SPECIAL = new Set(['Resumen', 'Nombre', 'Mensaje']);
// the code itself stays ASCII (non-ASCII literals as \u escapes): pasting it into the dashboard editor must not mangle them
const PHONE = 'Tel\u00e9fono', EMPTY = '\u2014';

const sourceOf = page => page.includes('/isacademy/')
  ? { name: 'IsAcademy', kind: 'Nueva solicitud', logo: `${SITE}/isacademy/assets/brand/apple-touch-icon.png`, url: `${SITE}/isacademy/` }
  : page.includes('/cv/')
    ? { name: 'CV Online', kind: 'Nuevo contacto', logo: `${SITE}/assets/brand/apple-touch-icon.png`, url: `${SITE}/cv/` }
    : { name: 'Ismael Sarmiento', kind: 'Nuevo mensaje', logo: `${SITE}/assets/brand/apple-touch-icon.png`, url: `${SITE}/` };

// a Spanish number without prefix gets +34; anything shorter than 9 digits is not a phone
const whatsappOf = phone => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length < 9 ? '' : `https://wa.me/${digits.length === 9 ? `34${digits}` : digits}`;
};

const button = (href, label, primary) => `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 10px 0;padding:12px 22px;border-radius:999px;font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;${primary
  ? `background:${C.gold};color:${C.onGold};border:1px solid ${C.gold}`
  : `background:${C.cream};color:${C.ink};border:1px solid ${C.ink2}`}">${esc(label)}</a>`;

function renderEmail(data, { subject, replyTo, page }) {
  const source = sourceOf(page);
  const value = key => (typeof data[key] === 'string' ? data[key].trim() : data[key] == null ? '' : String(data[key]));
  const shown = v => v !== '' && v !== EMPTY;
  const name = value('Nombre') || 'Alguien';
  const summary = value('Resumen');
  const message = value('Mensaje');
  const phone = value(PHONE);
  const whatsapp = shown(phone) ? whatsappOf(phone) : '';
  const details = Object.entries(data)
    .filter(([k, v]) => !k.startsWith('_') && k !== 'cf-turnstile-response' && !SPECIAL.has(k) && v != null && shown(String(v).trim()));
  const when = new Date().toLocaleString('es-ES', { timeZone: 'Atlantic/Canary', dateStyle: 'full', timeStyle: 'short' });
  const link = (k, v) => k === 'Email' && EMAIL.test(v) ? `<a href="mailto:${esc(v)}" style="color:${C.ink2};text-decoration:none">${esc(v)}</a>`
    : k === PHONE ? `<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}" style="color:${C.ink2};text-decoration:none">${esc(v)}</a>` : esc(v);
  const rows = details.map(([k, v], i) => `<tr><td style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT}">
      <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${C.soft};font-weight:700">${esc(k)}</div>
      <div style="font-size:15px;line-height:1.5;color:${C.ink};margin-top:3px;white-space:pre-wrap">${link(k, String(v).trim())}</div></td></tr>`).join('');
  const buttons = [
    replyTo ? button(`mailto:${replyTo}?subject=${encodeURIComponent(`Re: ${subject}`)}`, `Responder a ${name.split(' ')[0]}`, true) : '',
    whatsapp ? button(whatsapp, 'Escribir por WhatsApp', false) : '',
  ].join('');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.cream2}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(summary || subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream2}" style="background:${C.cream2}"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
  <tr><td bgcolor="${C.ink}" style="background:${C.ink};background-image:linear-gradient(135deg,${C.ink2} 0%,${C.ink} 55%,${C.ink3} 100%);border-radius:18px 18px 0 0;padding:26px 30px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="48" valign="middle"><img src="${source.logo}" width="48" height="48" alt="${esc(source.name)}" style="display:block;border:0;border-radius:12px"></td>
      <td valign="middle" style="padding-left:16px;font-family:${FONT}">
        <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${C.gold2};font-weight:700">${esc(source.name)} &middot; ${esc(source.kind)}</div>
        <div style="font-size:22px;line-height:1.3;color:${C.light};font-weight:700;margin-top:4px">${esc(name)}</div>
      </td></tr></table>
  </td></tr>
  <tr><td bgcolor="${C.gold}" style="height:4px;line-height:4px;font-size:0;background:${C.gold};background-image:linear-gradient(90deg,#b58534,#f2d18b,#b58534)">&nbsp;</td></tr>
  <tr><td bgcolor="${C.cream}" style="background:${C.cream};padding:28px 30px 6px;font-family:${FONT}">
    ${summary ? `<p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:${C.text}">${esc(summary)}</p>` : ''}
    ${shown(message) ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px"><tr>
      <td style="border-left:4px solid ${C.gold};background:${C.cream2};border-radius:0 12px 12px 0;padding:16px 20px;font-family:${FONT}">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${C.goldDark};font-weight:700;margin-bottom:6px">Mensaje</div>
        <div style="font-size:15px;line-height:1.65;color:${C.ink};white-space:pre-wrap">${esc(message)}</div></td></tr></table>` : ''}
    ${buttons ? `<div style="margin:0 0 14px">${buttons}</div>` : ''}
    ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">${rows}</table>` : ''}
  </td></tr>
  <tr><td bgcolor="${C.cream}" style="background:${C.cream};border-radius:0 0 18px 18px;padding:6px 30px 26px;font-family:${FONT}">
    <div style="border-top:1px solid ${C.line};padding-top:16px;font-size:13px;line-height:1.6;color:${C.soft}">
      Enviado desde <a href="${esc(page)}" style="color:${C.ink2}">${esc(page.replace(/^https?:\/\//, ''))}</a> el ${esc(when)}.<br>
      Formulario protegido con Cloudflare Turnstile.${replyTo ? ` Si respondes a este correo, le escribes a ${esc(name)}.` : ''}
    </div>
  </td></tr>
</table>
<p style="margin:18px 0 0;font-family:${FONT};font-size:12px;color:${C.soft}">
  <a href="${SITE}/" style="color:${C.soft};text-decoration:none">Inicio</a> &nbsp;&middot;&nbsp;
  <a href="${SITE}/cv/" style="color:${C.soft};text-decoration:none">CV Online</a> &nbsp;&middot;&nbsp;
  <a href="${SITE}/isacademy/" style="color:${C.soft};text-decoration:none">IsAcademy</a></p>
</td></tr></table></body></html>`;

  const text = [
    `${source.name} \u00b7 ${source.kind}: ${name}`, '',
    summary, '',
    shown(message) ? `Mensaje:\n${message}\n` : '',
    ...details.map(([k, v]) => `${k}: ${String(v).trim()}`), '',
    replyTo ? `Responder: ${replyTo}` : '', whatsapp ? `WhatsApp: ${whatsapp}` : '',
    `Enviado desde ${page} el ${when}.`,
  ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');
  return { html, text };
}

// one anonymous data point per request: [site, outcome] (sent, turnstile, honeypot, origin, invalid, mail_error)
const siteOf = page => /\/isacademy\//.test(page || '') ? 'isacademy' : /\/cv\//.test(page || '') ? 'cv' : page ? 'inicio' : 'unknown';
const track = (env, page, outcome) => { try { env.FORM_EVENTS?.writeDataPoint({ blobs: [siteOf(page), outcome], doubles: [1], indexes: [outcome] }); } catch { /* never block a message */ } };

// one anonymous page view for the panel's map of cities (beacons get no useful answer, so it is always 204)
async function countView(request, env, allowed, cors) {
  const done = new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST' || !allowed) return done;
  let path = '';
  try { path = String(JSON.parse((await request.text()).slice(0, 500)).p || '').slice(0, 200); } catch { return done; }
  if (!path.startsWith('/')) return done;
  const cf = request.cf || {};
  const round = v => Math.round(Number(v) * 10) / 10 || 0;
  try {
    env.SITE_VIEWS?.writeDataPoint({ blobs: [siteOf(path), cf.country || 'XX', cf.region || '', cf.city || ''],
      doubles: [round(cf.latitude), round(cf.longitude)], indexes: [siteOf(path)] });
  } catch { /* never fail a page */ }
  return done;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const origins = list(env.ALLOWED_ORIGIN);
    const allowed = origins.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : origins[0] || 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (new URL(request.url).pathname === '/hit') return countView(request, env, allowed, cors);
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method !== 'POST') { track(env, '', 'invalid'); return reply(405, { success: 'false', message: 'method' }); }
    if (!allowed) { track(env, '', 'origin'); return reply(403, { success: 'false', message: 'origin' }); }

    const raw = await request.text();
    if (raw.length > MAX_BODY) { track(env, '', 'invalid'); return reply(413, { success: 'false', message: 'size' }); }
    let data;
    try { data = JSON.parse(raw); } catch { track(env, '', 'invalid'); return reply(400, { success: 'false', message: 'json' }); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) { track(env, '', 'invalid'); return reply(400, { success: 'false', message: 'json' }); }
    const at = typeof data._page === 'string' ? data._page : '';

    // bots fill the invisible field: answer as if it worked and drop the message
    if (data._honey) { track(env, at, 'honeypot'); return reply(200, { success: 'true' }); }

    // Turnstile: the token must be valid, fresh and issued for one of our hostnames
    const token = data['cf-turnstile-response'];
    if (typeof token !== 'string' || !token) { track(env, at, 'turnstile'); return reply(403, { success: 'false', message: 'turnstile' }); }
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET || '');
    form.append('response', token);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) form.append('remoteip', ip);
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
      .then(r => r.json()).catch(() => ({ success: false }));
    const hosts = list(env.ALLOWED_HOSTS);
    if (!check.success || (hosts.length && !hosts.includes(check.hostname))) { track(env, at, 'turnstile'); return reply(403, { success: 'false', message: 'turnstile' }); }

    const subject = String(data._subject || 'Nuevo mensaje desde la web').slice(0, 200);
    const replyTo = [data._replyto, data.Email, data.email].find(v => typeof v === 'string' && EMAIL.test(v.trim()));
    const page = typeof data._page === 'string' && data._page.startsWith(origin + '/') ? data._page : origin + '/';
    const { html, text } = renderEmail(data, { subject, replyTo: replyTo?.trim(), page });

    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [env.FORM_TO], subject, html, text, ...(replyTo ? { reply_to: replyTo.trim() } : {}) }),
    });
    if (!sent.ok) { track(env, page, 'mail_error'); return reply(502, { success: 'false', message: 'mail' }); }
    track(env, page, 'sent');
    return reply(200, { success: 'true', message: 'sent' });
  },
};

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
// the site and the outcome, read by the private panel (isa-panel.js). No field of the message is stored in analytics.
//           SITE_VIEWS (Workers Analytics Engine, dataset isa_site_views): POST /hit, sent once per page by
// /assets/ds/views.js, adds one aggregate page view with the site and the approximate place Cloudflare derives from
// the network (country, region, city and coordinates rounded to 0.1°). Analytics never receive IP or message data.
//
// CONTACTS_DB (D1) is the private inbox, used only when CONTACTS_ENABLED is exactly "true" (off by default).
// Enable capture only after the privacy notices and migration are published. Contacts expire after 90 days;
// isa-panel owns the daily purge and excludes expired rows on every read.
// TRAFFIC_ENABLED must separately be exactly "true" to save individual /hit events in CONTACTS_DB for 30 days.
// Keep it off until the traffic migration, privacy notices and production activation have been reviewed.
// Traffic and contact context use an allowlist of Cloudflare network metadata; no raw User-Agent, cookies or tokens.
//
// The forms post JSON: the visible fields (Nombre, Email, Mensaje…) plus _subject, _replyto, _page, _honey and
// cf-turnstile-response. Fields starting with "_" steer the email and are not listed in it.
const MAX_BODY = 10_000;
const TURNSTILE_TIMEOUT_MS = 8_000;
const MAIL_TIMEOUT_MS = 10_000;
const validProviderId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const MAX_HIT_BODY = 1_024;
const FROM = 'Formularios Ismael Sarmiento <onboarding@resend.dev>';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CONTACT_EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const TRAFFIC_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DEDUPE_MS = 15 * 60 * 1000;

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

// ---------- private inbox (opt-in; anonymous analytics above never receive any of these fields) ----------
const FORM_PATHS = new Set(['/', '/en/', '/cv/', '/cv/en/', '/isacademy/', '/isacademy/en/']);
class SubmissionError extends Error {
  constructor() { super('fields'); this.name = 'SubmissionError'; }
}

// _page is supplied by the visitor: parse the URL and allow only known sites, without query/hash data.
function submissionPage(value, origin = SITE) {
  try {
    const url = new URL(typeof value === 'string' && value ? value : `${origin}/`);
    return url.origin === SITE && !url.username && !url.password && FORM_PATHS.has(url.pathname)
      ? `${SITE}${url.pathname}` : '';
  } catch { return ''; }
}

function field(data, key, max, { required = false, multiline = false, dash = false } = {}) {
  const raw = data[key];
  if (raw != null && typeof raw !== 'string') throw new SubmissionError();
  let value = (raw || '').normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (dash && value === EMPTY) value = '';
  if ((required && !value) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    || (!multiline && /[\n\t]/.test(value))) throw new SubmissionError();
  return value;
}

// CF-Connecting-IP is populated by Cloudflare. Do not fall back to visitor-supplied forwarding headers.
// WHATWG URL validates and canonicalizes IPv6 without a Node-only dependency.
function connectingIp(request) {
  const input = (request.headers.get('CF-Connecting-IP') || '').trim();
  if (!input || input.length > 45) return '';
  if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(input))
    return input.split('.').every(part => Number(part) <= 255) ? input : '';
  if (!input.includes(':') || !/^[0-9a-fA-F:.]+$/.test(input)) return '';
  try {
    const host = new URL(`http://[${input}]/`).hostname;
    return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : '';
  } catch { return ''; }
}

function languageOf(value) {
  if (typeof value !== 'string') return '';
  const language = value.split(',')[0].split(';')[0].trim();
  return language.length <= 35 && /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(language) ? language : '';
}

export function approximateContext(request, languageHint = '') {
  const cf = request.cf || {};
  const context = {};
  const bounded = (value, max) => typeof value === 'string' && !/[\u0000-\u001f\u007f]/.test(value)
    ? value.normalize('NFC').trim().slice(0, max) : '';
  const ip = connectingIp(request);
  if (ip) context.ip = ip;
  if (typeof cf.country === 'string' && /^[A-Z]{2}$/.test(cf.country)) context.country = cf.country;
  if (['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'].includes(cf.continent)) context.continent = cf.continent;
  for (const key of ['region', 'city']) {
    const value = bounded(cf[key], 120);
    if (value) context[key] = value;
  }
  for (const [key, max, pattern] of [
    ['regionCode', 12, /^[a-zA-Z0-9-]+$/],
    ['postalCode', 32, /^[a-zA-Z0-9 -]+$/],
    ['timezone', 64, /^[a-zA-Z0-9_+\-/]+$/],
    ['colo', 3, /^[A-Z]{3}$/],
    ['httpProtocol', 16, /^HTTP\/[123](?:\.[01])?$/],
    ['tlsVersion', 16, /^TLSv1(?:\.[0-3])?$/],
    ['tlsCipher', 80, /^[a-zA-Z0-9_-]+$/],
  ]) {
    const value = bounded(cf[key], max);
    if (value && pattern.test(value)) context[key] = value;
  }
  const organization = bounded(cf.asOrganization, 160);
  if (organization) context.asOrganization = organization;
  if (typeof cf.asn === 'number' && Number.isInteger(cf.asn) && cf.asn > 0 && cf.asn <= 4_294_967_295)
    context.asn = cf.asn;
  for (const [key, limit] of [['latitude', 90], ['longitude', 180]]) {
    const value = Number(cf[key]);
    if ((typeof cf[key] === 'number' || typeof cf[key] === 'string' && cf[key].trim() !== '')
      && Number.isFinite(value) && Math.abs(value) <= limit)
      context[key] = Math.round(value * 1_000_000) / 1_000_000;
  }
  for (const key of ['clientTcpRtt', 'clientQuicRtt']) {
    const value = cf[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 300_000)
      context[key] = Math.round(value * 100) / 100;
  }
  const bot = cf.botManagement;
  if (bot && typeof bot === 'object' && !Array.isArray(bot)) {
    if (Number.isInteger(bot.score) && bot.score >= 0 && bot.score <= 99) context.botScore = bot.score;
    if (typeof bot.verifiedBot === 'boolean') context.verifiedBot = bot.verifiedBot;
  }
  const ray = request.headers.get('CF-Ray') || '';
  if (/^[a-fA-F0-9]{16,32}(?:-[A-Z]{3})?$/.test(ray)) context.rayId = ray;
  const language = languageOf(languageHint) || languageOf(request.headers.get('Accept-Language'));
  if (language) context.language = language;
  // Only broad families are retained; the raw header is never written to D1, mail or analytics.
  const ua = (request.headers.get('User-Agent') || '').slice(0, 512);
  if (ua) {
    context.browser = /Edg(?:A|iOS)?\//.test(ua) ? 'Edge' : /(?:OPR|Opera)\//.test(ua) ? 'Opera'
      : /(?:Firefox|FxiOS)\//.test(ua) ? 'Firefox' : /(?:Chrome|CriOS)\//.test(ua) ? 'Chrome'
        : /Safari\//.test(ua) ? 'Safari' : 'Other';
    context.os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows'
      : /Macintosh|Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Other';
    context.device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'tablet' : /Mobile|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop';
  }
  return context;
}

// This deliberately accepts only the existing form fields. Unknown keys never enter the inbox or its email.
// The fingerprint excludes tokens, timestamps and network context, so a retry with a fresh challenge deduplicates.
export async function normalizeSubmission(data, request, now = Date.now()) {
  const page = submissionPage(data._page, request.headers.get('Origin') || SITE);
  if (!page || !Number.isSafeInteger(now) || now < 0) throw new SubmissionError();
  const site = siteOf(page);
  const name = field(data, 'Nombre', 80, { required: true });
  const email = field(data, 'Email', 120, { required: true }).toLowerCase();
  const local = email.split('@')[0];
  if (!CONTACT_EMAIL.test(email) || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..'))
    throw new SubmissionError();
  const replyTo = field(data, '_replyto', 120).toLowerCase();
  if (replyTo && replyTo !== email) throw new SubmissionError();
  const phone = field(data, PHONE, 30, { dash: true });
  if (phone && !/^[+\d ().\-/]{3,30}$/.test(phone)) throw new SubmissionError();
  const company = field(data, 'Empresa', 120, { dash: true });
  const interest = field(data, 'Inter\u00e9s', 120, { required: site === 'isacademy', dash: true });
  const level = field(data, 'Edad o nivel', 120, { dash: true });
  const optionalMessage = site === 'isacademy' && ['Aula abierta (gratuita)', 'open'].includes(interest);
  const message = field(data, 'Mensaje', 2000, { required: !optionalMessage, multiline: true, dash: optionalMessage });
  const inputLanguage = field(data, 'Idioma', 20);
  const languages = { 'Espa\u00f1ol': 'es', 'Ingl\u00e9s': 'en', es: 'es', en: 'en' };
  if (inputLanguage && !Object.hasOwn(languages, inputLanguage)) throw new SubmissionError();
  const language = inputLanguage ? languages[inputLanguage] : (page.includes('/en/') ? 'en' : 'es');
  const summary = field(data, 'Resumen', 600);
  const subject = field(data, '_subject', 200) || `Nuevo contacto: ${name}`;
  const details = { summary, subject, ...(site === 'isacademy' ? { interest, level } : {}) };
  const canonical = { site, page, language, name, email, phone, company, message, details };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)));
  const requestKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return {
    id: crypto.randomUUID(), request_key: requestKey, created_at: now, expires_at: now + RETENTION_MS,
    site, page, language, name, email, phone, company, message, details_json: JSON.stringify(details),
    context_json: JSON.stringify(approximateContext(request)), status: 'new', notification_status: 'pending',
    provider_id: null, updated_at: now,
  };
}

async function storeSubmission(db, contact) {
  const cutoff = contact.created_at - DEDUPE_MS;
  // D1 batches are transactional: preserve the old contact but release its fingerprint after 15 minutes.
  // A UNIQUE request_key plus INSERT OR IGNORE elects exactly one sender for concurrent identical submissions.
  const results = await db.batch([
    db.prepare(`UPDATE contacts SET request_key = request_key || ':' || id
      WHERE request_key = ? AND (created_at <= ? OR expires_at <= ?)`)
      .bind(contact.request_key, cutoff, contact.created_at),
    db.prepare(`INSERT OR IGNORE INTO contacts
      (id, request_key, created_at, expires_at, site, page, language, name, email, phone, company, message,
       details_json, context_json, status, notification_status, provider_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(contact.id, contact.request_key, contact.created_at, contact.expires_at, contact.site, contact.page,
        contact.language, contact.name, contact.email, contact.phone, contact.company, contact.message,
        contact.details_json, contact.context_json, contact.status, contact.notification_status, null, contact.updated_at),
    db.prepare(`SELECT id, notification_status FROM contacts
      WHERE request_key = ? AND created_at > ? AND expires_at > ? LIMIT 1`)
      .bind(contact.request_key, cutoff, contact.created_at),
  ]);
  if (results.some(result => result?.success === false)) throw new Error('storage');
  const stored = results[2]?.results?.[0];
  if (!stored?.id || !Number.isInteger(results[1]?.meta?.changes)) throw new Error('storage');
  return { inserted: results[1].meta.changes === 1, stored };
}

function emailFields(contact) {
  const details = JSON.parse(contact.details_json);
  return {
    Resumen: details.summary, Nombre: contact.name, Email: contact.email, [PHONE]: contact.phone,
    Empresa: contact.company, Mensaje: contact.message,
    ...(contact.site === 'isacademy' ? { 'Inter\u00e9s': details.interest, 'Edad o nivel': details.level } : {}),
    Idioma: contact.language === 'en' ? 'Ingl\u00e9s' : 'Espa\u00f1ol',
  };
}

async function notifyContact(env, contact) {
  const { subject } = JSON.parse(contact.details_json);
  const { html, text } = renderEmail(emailFields(contact), { subject, replyTo: contact.email, page: contact.page });
  let notification = 'unknown', providerId = null;
  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(MAIL_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY || ''}`, 'Content-Type': 'application/json',
        'Idempotency-Key': `contact-${contact.id}` },
      body: JSON.stringify({ from: FROM, to: [env.FORM_TO], subject, html, text, reply_to: contact.email }),
    });
    if (!sent.ok) notification = sent.status >= 400 && sent.status < 500 && sent.status !== 408 ? 'failed' : 'unknown';
    else {
      const response = await sent.json().catch(() => ({}));
      if (validProviderId(response?.id)) {
        notification = 'accepted'; providerId = response.id;
      }
    }
  } catch { /* The provider may have accepted the message before the connection failed: never auto-resend. */ }
  try {
    const result = await env.CONTACTS_DB.prepare(`UPDATE contacts SET notification_status = ?, provider_id = ?, updated_at = ?
      WHERE id = ? AND expires_at > ?`).bind(notification, providerId, Date.now(), contact.id, Date.now()).run();
    if (result?.success === false) return 'unknown';
  } catch { return 'unknown'; } // A saved contact remains recoverable even when its notification status cannot be written.
  return notification;
}

function trafficPage(value) {
  if (typeof value !== 'string' || value.length > 200 || !value.startsWith('/') || value.startsWith('//')
    || /[\\\u0000-\u001f\u007f]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)) return '';
  try {
    const url = new URL(value, SITE);
    return url.origin === SITE && url.pathname.length <= 200 ? url.pathname : '';
  } catch { return ''; }
}

function trafficReferrer(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2_048 || /[\u0000-\u001f\u007f\\]/.test(value)) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.hostname.length <= 253
      ? url.hostname.toLowerCase() : '';
  } catch { return ''; }
}

// One aggregate point per valid signal; optional private detail expires after 30 days.
// A beacon deliberately receives no useful answer. Neither D1 nor Analytics failures affect the website.
async function countView(request, env, allowed, cors, ctx) {
  const done = new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST' || !allowed) return done;
  const parsed = await readSubmission(request, MAX_HIT_BODY);
  if (parsed.error) return done;
  const path = trafficPage(parsed.data.p);
  if (!path || parsed.data.r != null && typeof parsed.data.r !== 'string'
    || parsed.data.l != null && typeof parsed.data.l !== 'string') return done;
  const site = /^\/isacademy(?:\/|$)/.test(path) ? 'isacademy' : /^\/cv(?:\/|$)/.test(path) ? 'cv' : 'inicio';
  const context = approximateContext(request, parsed.data.l);
  const referrer = trafficReferrer(parsed.data.r);
  const record = async () => {
    let outcome = 'aggregate_only';
    if (env.TRAFFIC_ENABLED === 'true') {
      outcome = 'storage_unavailable';
      if (env.CONTACTS_DB) {
        try {
          const now = Date.now();
          const result = await env.CONTACTS_DB.prepare(`INSERT INTO traffic_events
            (id, created_at, expires_at, site, page, referrer, context_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .bind(crypto.randomUUID(), now, now + TRAFFIC_RETENTION_MS, site, path, referrer, JSON.stringify(context)).run();
          outcome = result?.success === false ? 'storage_error' : 'stored';
        } catch { outcome = 'storage_error'; }
      }
    }
    const located = Number.isFinite(context.latitude) && Number.isFinite(context.longitude);
    const round = value => Math.round(value * 10) / 10;
    try {
      // blob6 versions the coordinate pair: omitted numeric fields must never imply a real (0,0).
      env.SITE_VIEWS?.writeDataPoint({ blobs: [site, context.country || 'XX', context.region || '', context.city || '', outcome, located ? 'geo-v1' : 'geo-missing-v1'],
        doubles: located ? [round(context.latitude), round(context.longitude)] : [], indexes: [site] });
    } catch { /* never fail a page */ }
  };
  const pending = record();
  if (typeof ctx?.waitUntil === 'function') ctx.waitUntil(pending);
  else await pending;
  return done;
}

async function readSubmission(request, maxBody = MAX_BODY) {
  const reader = request.body?.getReader();
  if (!reader) return { error: 'json', status: 400 };
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBody) {
        await reader.cancel().catch(() => {});
        return { error: 'size', status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return data && typeof data === 'object' && !Array.isArray(data)
      ? { data } : { error: 'json', status: 400 };
  } catch { return { error: 'json', status: 400 }; }
  finally { reader.releaseLock(); }
}

export default {
  async fetch(request, env, ctx) {
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
    const reply = (status, body) => new Response(JSON.stringify(body), { status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

    if (new URL(request.url).pathname === '/hit') return countView(request, env, allowed, cors, ctx);
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method !== 'POST') { track(env, '', 'invalid'); return reply(405, { success: 'false', message: 'method' }); }
    if (!allowed) { track(env, '', 'origin'); return reply(403, { success: 'false', message: 'origin' }); }

    const parsed = await readSubmission(request);
    if (parsed.error) { track(env, '', 'invalid'); return reply(parsed.status, { success: 'false', message: parsed.error }); }
    const { data } = parsed;
    const at = submissionPage(data._page, origin);

    // bots fill the invisible field: answer as if it worked and drop the message
    if (data._honey) { track(env, at, 'honeypot'); return reply(200, { success: 'true' }); }

    let contact = null;
    if (env.CONTACTS_ENABLED === 'true') {
      try { contact = await normalizeSubmission(data, request); }
      catch { track(env, at, 'invalid'); return reply(400, { success: 'false', message: 'fields' }); }
      if (!env.CONTACTS_DB) { track(env, at, 'storage_error'); return reply(503, { success: 'false', message: 'storage' }); }
    }

    // Turnstile: the token must be valid, fresh and issued for one of our hostnames
    const token = data['cf-turnstile-response'];
    if (typeof token !== 'string' || !token || token.length > 2048) { track(env, at, 'turnstile'); return reply(403, { success: 'false', message: 'turnstile' }); }
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET || '');
    form.append('response', token);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) form.append('remoteip', ip);
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form, signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    })
      .then(r => r.json()).catch(() => ({ success: false }));
    const hosts = list(env.ALLOWED_HOSTS);
    if (!check.success || (hosts.length && !hosts.includes(check.hostname))) { track(env, at, 'turnstile'); return reply(403, { success: 'false', message: 'turnstile' }); }

    if (contact) {
      let saved;
      try { saved = await storeSubmission(env.CONTACTS_DB, contact); }
      catch { track(env, contact.page, 'storage_error'); return reply(503, { success: 'false', message: 'storage' }); }
      if (!saved.inserted) {
        const notification = ['accepted', 'failed', 'unknown'].includes(saved.stored.notification_status)
          ? saved.stored.notification_status : 'unknown';
        track(env, contact.page, 'duplicate');
        return reply(200, { success: 'true', message: 'stored', stored: true, notification, duplicate: true });
      }
      track(env, contact.page, 'stored');
      const notification = await notifyContact(env, contact);
      track(env, contact.page, notification === 'accepted' ? 'notification_accepted'
        : notification === 'failed' ? 'notification_failed' : 'notification_unknown');
      return reply(200, { success: 'true', message: 'stored', stored: true, notification });
    }

    const subject = String(data._subject || 'Nuevo mensaje desde la web').slice(0, 200);
    const replyTo = [data._replyto, data.Email, data.email].find(v => typeof v === 'string' && EMAIL.test(v.trim()));
    const page = at || `${SITE}/`;
    const { html, text } = renderEmail(data, { subject, replyTo: replyTo?.trim(), page });

    try {
      const sent = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(MAIL_TIMEOUT_MS),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [env.FORM_TO], subject, html, text, ...(replyTo ? { reply_to: replyTo.trim() } : {}) }),
      });
      if (!sent.ok && sent.status >= 400 && sent.status < 500 && sent.status !== 408) {
        track(env, page, 'mail_error');
        return reply(502, { success: 'false', message: 'mail_rejected' });
      }
      if (!sent.ok || !validProviderId((await sent.json())?.id)) throw new Error('mail_unknown');
    } catch {
      track(env, page, 'mail_unknown');
      return reply(503, { success: 'false', message: 'mail_unknown' });
    }
    track(env, page, 'sent');
    return reply(200, { success: 'true', message: 'sent' });
  },
};

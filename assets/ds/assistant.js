// Alan, the assistant shared by every site of Ismael Sarmiento (same behaviour as IsAcademy's js/assistant.js).
// Local and private: each site passes its own knowledge (a match() function) and texts; nothing leaves the browser.
//
//   const alan = createAssistant({ name, badge, subtitle, open, openLabel, close, placeholder, send, typing,
//                                  greeting, suggestions, match, fallback, onAction });
//   match(question) -> { answer, actions: [{ label, href?, action?, arg? }] } | null
//   match can be faqMatcher(faq) below (the public FAQ of the site, ES or EN)
//   optional: fabId (an id for the floating button), startHidden (the site shows it later, e.g. after its intro)
import { avatarSVG } from './avatar.js';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[&<>"']/g, c => ENTITIES[c]);
const isPhone = () => matchMedia('(max-width: 640px)').matches;

const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// words that carry no meaning in a question ("qué", "es", "his"...) never decide the answer
const STOP = new Set(('que cual cuales como donde cuando quien quienes por para con sin sus del las los una uno unos unas este esta esto eso '
  + 'hay hace hacer tiene tienes eres puedes puede sobre mas muy '
  + 'the what which who how does did can his her you are with for and from about has have this that').split(' '));
const words = s => normalize(s).split(/[^a-z0-9+#]+/).filter(t => t.length >= 3 && !STOP.has(t));

// match() for the public FAQ of a site ([{ q, a, keywords?, actions? }]): the best entry, where a keyword weighs 3,
// a word of the question 2 and a word of the answer 1; below 2 points Alan admits it has no answer instead of guessing
export function faqMatcher(faq) {
  const index = faq.map(item => ({ item, keys: new Set((item.keywords || []).flatMap(words)), q: new Set(words(item.q)), a: new Set(words(item.a)) }));
  return question => {
    const tokens = words(question);
    let best = null, bestScore = 0;
    for (const e of index) {
      const score = tokens.reduce((n, t) => n + (e.keys.has(t) ? 3 : 0) + (e.q.has(t) ? 2 : 0) + (e.a.has(t) ? 1 : 0), 0);
      if (score > bestScore) { best = e.item; bestScore = score; }
    }
    return bestScore >= 2 ? { answer: best.a, actions: best.actions || [] } : null;
  };
}

// a Spanish phone number never breaks across two lines (+34 613 371 874)
const keepPhone = html => html.replace(/\+34 (\d{3}) (\d{3}) (\d{3})/g, '+34&nbsp;$1&nbsp;$2&nbsp;$3');
// the focus only goes back to something the visitor can see (the button steps aside at the foot of the page)
const visible = el => !!el?.isConnected && (el.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ?? true);

export function createAssistant(cfg) {
  let started = false, opener = null;
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'assistant-fab';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'assistantPanel');
  if (cfg.fabId) fab.id = cfg.fabId;
  if (cfg.startHidden) fab.hidden = true;
  // at the foot of the page the button steps aside: it never covers the footer links
  const foot = document.querySelector('.footer');
  if (foot) new IntersectionObserver(([en]) => fab.classList.toggle('fab-away', en.isIntersecting)).observe(foot);
  fab.innerHTML = `<span class="as-avatar">${avatarSVG('fab')}</span><span class="fab-label"></span>`;
  const panel = document.createElement('section');
  panel.id = 'assistantPanel';
  panel.className = 'assistant-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'assistantName');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="as-head">
      <span class="as-avatar">${avatarSVG('panel')}</span>
      <div><p class="as-name" id="assistantName"></p><p class="as-sub"></p></div>
      <button class="btn btn-icon as-close" type="button">✕</button>
    </header>
    <div class="as-log" aria-live="polite"></div>
    <div class="as-chips"></div>
    <form class="as-form">
      <input type="text" autocomplete="off" maxlength="300">
      <button class="btn btn-primary btn-icon" type="submit"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 21 3l-8.5 18-2-7.5z" fill="currentColor"/></svg></button>
    </form>`;
  document.body.append(fab, panel);
  const log = panel.querySelector('.as-log'), chips = panel.querySelector('.as-chips');
  const input = panel.querySelector('input'), sendBtn = panel.querySelector('[type="submit"]');

  function talk(ms) {
    const av = panel.querySelector('.as-head .as-avatar');
    av.classList.add('talking');
    clearTimeout(talk.timer);
    talk.timer = setTimeout(() => av.classList.remove('talking'), ms);
  }

  function say(who, text, actions = []) {
    const item = document.createElement('div');
    item.className = `msg msg-${who}`;
    item.innerHTML = `<p>${keepPhone(esc(text))}</p>` + (actions.length ? `<div class="msg-actions">${actions.map(a =>
      `<button type="button" class="btn btn-sm" data-as-href="${esc(a.href || '')}" data-as-action="${esc(a.action || '')}" data-as-arg="${esc(a.arg || '')}">${esc(a.label)}</button>`).join('')}</div>` : '');
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  function reply(question) {
    say('user', question);
    const typing = document.createElement('div');
    typing.className = 'msg msg-bot typing';
    typing.innerHTML = `<p aria-label="${esc(cfg.typing)}"><span></span><span></span><span></span></p>`;
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;
    const found = cfg.match(question);
    const answer = found || cfg.fallback;
    // a short, human-like pause proportional to the answer length
    setTimeout(() => {
      typing.remove();
      say('bot', answer.answer, answer.actions || []);
      talk(Math.min(3500, answer.answer.length * 30));
    }, Math.min(1400, 450 + answer.answer.length * 4));
  }

  function renderChips() {
    chips.innerHTML = cfg.suggestions.map(s => `<button type="button" class="chip">${esc(s)}</button>`).join('');
  }

  function open() {
    opener = document.activeElement;   // the button that opened Alan gets the focus back when he closes
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => panel.classList.add('open'));
    if (!started) {
      started = true;
      renderChips();
      const greeting = [].concat(cfg.greeting);
      greeting.forEach((g, i) => setTimeout(() => { say('bot', g.answer || g, g.actions || []); talk(2500); }, 250 + i * 700));
    }
    setTimeout(() => input.focus(), 300);
  }

  function close() {
    panel.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
    setTimeout(() => { panel.hidden = true; }, 250);
    const back = [opener, fab].find(el => el !== document.body && visible(el));
    back?.focus({ preventScroll: true });
  }

  function refresh(next = {}) {
    Object.assign(cfg, next);
    fab.querySelector('.fab-label').textContent = cfg.open;
    fab.setAttribute('aria-label', cfg.openLabel);
    panel.querySelector('.as-name').innerHTML = esc(cfg.name) + (cfg.badge ? ` <span class="as-badge">${esc(cfg.badge)}</span>` : '');
    panel.querySelector('.as-sub').textContent = cfg.subtitle;
    panel.querySelector('.as-close').setAttribute('aria-label', cfg.close);
    input.placeholder = cfg.placeholder;
    input.setAttribute('aria-label', cfg.placeholder);
    sendBtn.setAttribute('aria-label', cfg.send);
    if (started) renderChips();
  }

  refresh();
  fab.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.querySelector('.as-close').addEventListener('click', close);
  panel.querySelector('.as-form').addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    reply(q);
  });
  chips.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) { reply(chip.textContent); chip.remove(); }
  });
  log.addEventListener('click', e => {
    const b = e.target.closest('[data-as-href], [data-as-action]');
    if (!b) return;
    const { asHref, asAction, asArg } = b.dataset;
    cfg.onAction?.({ href: asHref, action: asAction, arg: asArg });
    // on phones the panel covers the page: close it so the visitor sees where they went
    if (asHref && isPhone()) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });

  return {
    open, close, refresh, ask: reply,
    tuck: on => fab.classList.toggle('fab-tucked', on),
    fab, panel,
  };
}

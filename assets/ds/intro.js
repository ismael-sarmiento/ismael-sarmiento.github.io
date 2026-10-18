// The intro shared by every site of Ismael Sarmiento (Inicio, CV Online): the signature ("Is" sketched by hand, the
// name decoded by an AI), a tag, the hook, optional milestones and the actions. The exit is the "human + artificial"
// moment of the brand: the "Is" flies to the seal of the bar leaving gold ink while the name breaks into pixels and the
// page appears underneath (the same family as IsAcademy's hands, with its effects from /assets/ds/fx.js).
// Every visit, as IsAcademy: #top is the start of the page; deep links (#section) and the PDF build (?pdf) go straight
// to the page; "Saltar intro" or Escape jump to the end. Styles: /assets/ds/intro.css.
//
//   initIntro({ i18n, steps: () => ['…', '…'], stepMs: 1600 })   // steps are optional (the CV milestones)
//
// A milestone written as «2017 · Autana — Primeros pasos en datos y analítica» shows its year (counting up from the
// previous one) and the place (decoded like the signature) above the sentence, which arrives word by word; several
// milestones in one place with a role («2023 · Savana · Lead Data Engineer — …») draw that career as a small ladder
// and share one stretch of the bar. Each bar fills while its milestone is on screen; at the end they join into one line.
import { reducedMotion } from './ds.js';
import { playSignature, skipSignature } from './signature.js';
import { ink, pixels } from './fx.js';

const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)';
const EASE_IN_OUT = 'cubic-bezier(.65, 0, .35, 1)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settled = anim => anim.finished.catch(() => {});

// the box of a piece of text as the browser lays it out (same metrics for the svg glyph and the seal in the bar)
const textBox = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };

// hand-off between intros (Inicio → CV Online): leaving through a link of the intro once the signature is written
// leaves a mark for 4 s; the next intro shows the signature complete (the boot script adds .sig-handoff before the
// first paint) and the page transition keeps it in place instead of drawing it again
const HANDOFF = 'sig-handoff';
const takeHandoff = () => {
  let at = 0;
  try { at = Number(sessionStorage.getItem(HANDOFF)); sessionStorage.removeItem(HANDOFF); } catch { /* storage unavailable */ }
  return at > 0 && Date.now() - at < 4000;
};
const leaveHandoff = () => { try { sessionStorage.setItem(HANDOFF, String(Date.now())); } catch { /* storage unavailable */ } };

export function initIntro({ i18n, steps = null, stepMs = 1600 } = {}) {
  const intro = document.getElementById('intro');
  const handoff = takeHandoff();
  document.documentElement.classList.remove('sig-handoff');
  if (!intro) return null;
  // #top is the start of the page, not a deep link: a refresh there plays the intro again (as #hero in IsAcademy)
  if (location.hash === '#top') history.replaceState(history.state, '', location.pathname + location.search);
  const deepLink = location.hash && document.getElementById(location.hash.slice(1));
  if (deepLink || new URLSearchParams(location.search).has('pdf')) { intro.hidden = true; return null; }

  const svg = intro.querySelector('.sig');
  const list = () => (steps ? steps() : []);
  const segs = [...intro.querySelectorAll('.intro-segs span')];
  const stepText = intro.querySelector('.intro-step');
  const enter = intro.querySelector('[data-action="enter"]');
  const skip = intro.querySelector('[data-action="skip"]');
  let done = false, closing = false, shown = -1;
  // switching language during the intro keeps the current milestone, in the new language
  i18n?.onChange(() => { joinBars(); if (shown >= 0 && stepText) renderStep(shown, false); });

  const milestones = intro.querySelector('.intro-milestones');
  milestones?.style.setProperty('--step-ms', `${stepMs}ms`);
  // «year · place · role — sentence» (role and year optional; without « — » the whole text is the sentence)
  const parse = t => {
    const [head, ...rest] = String(t).split(' — ');
    if (!rest.length) return { text: head };
    const parts = head.split(' · ');
    const year = /^\d{4}$/.test(parts[0]) ? parts.shift() : '';
    return { year, where: parts[0] || '', role: parts.slice(1).join(' · '), text: rest.join(' — ') };
  };
  const parsed = () => list().map(parse);
  // consecutive milestones in the same place (Savana: Senior → Lead → Head) share one stretch of the bar
  const joinBars = () => { const p = parsed(); segs.forEach((s, k) => s.classList.toggle('joined', k > 0 && !!p[k].where && p[k].where === p[k - 1].where)); };
  joinBars();
  let yearShown = 0, counting = 0, decoding = 0;
  const countYear = (el, to) => {
    cancelAnimationFrame(counting);
    if (!yearShown || to <= yearShown || reducedMotion()) { el.textContent = String(to); yearShown = to; return; }
    const from = yearShown, t0 = performance.now(), dur = 460;
    const tick = now => { const p = Math.min(1, (now - t0) / dur); el.textContent = String(Math.round(from + (to - from) * (1 - (1 - p) ** 3))); if (p < 1) counting = requestAnimationFrame(tick); };
    tick(t0); yearShown = to;
  };
  // the place is decoded like the name in the signature: letters settle one by one out of random glyphs
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const decode = (el, word) => {
    cancelAnimationFrame(decoding);
    if (reducedMotion()) { el.textContent = word; return; }
    const t0 = performance.now(), per = 32;
    const tick = now => {
      const done = Math.floor((now - t0) / per);
      el.textContent = [...word].map((c, i) => (i < done || c === ' ' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
      if (done < word.length) decoding = requestAnimationFrame(tick);
    };
    tick(t0);
  };
  const renderStep = (i, animate) => {
    const all = parsed(), m = all[i];
    stepText.replaceChildren();
    const meta = document.createElement('span'); meta.className = 'st-meta';
    if (m.year) { const y = document.createElement('b'); y.className = 'st-year'; meta.append(y); animate ? countYear(y, Number(m.year)) : (y.textContent = m.year); }
    if (m.where) { const w = document.createElement('span'); w.className = 'st-where'; meta.append(w); animate ? decode(w, m.where) : (w.textContent = m.where); }
    stepText.append(meta);
    // a career inside one place: its roles as a small ladder, the current one lit and the earlier ones ticked
    const group = all.map((x, k) => ({ ...x, k })).filter(x => x.where && x.where === m.where && x.role);
    if (m.role && group.length > 1) {
      const ladder = document.createElement('span'); ladder.className = 'st-ladder';
      group.forEach((x, n) => {
        const r = document.createElement('span');
        r.className = `st-rung${x.k < i ? ' past' : x.k === i ? ' now' : ''}`;
        r.textContent = x.role.replace(/ (Data Engineer|of Data Management)$/, '');
        if (n) { const sep = document.createElement('i'); sep.className = 'st-sep'; sep.textContent = '›'; ladder.append(sep); }
        ladder.append(r);
      });
      stepText.append(ladder);
    } else if (m.role) { const r = document.createElement('span'); r.className = 'st-role'; r.textContent = m.role; meta.append(r); }
    // the sentence comes word by word, from blurred to sharp
    const text = document.createElement('span'); text.className = 'st-text';
    m.text.split(' ').forEach((w, n) => { const s = document.createElement('span'); s.className = 'st-w'; s.textContent = w; s.style.setProperty('--n', n); text.append(s, ' '); });
    stepText.append(text);
  };
  const showMilestone = (i, last = false) => {
    if (!stepText) return;
    segs.forEach((s, k) => { s.classList.toggle('on', k < i || (last && k === i)); s.classList.toggle('run', !last && k === i); });
    renderStep(i, !last);
    shown = i;
    stepText.classList.remove('swap'); void stepText.offsetWidth; stepText.classList.add('swap');
  };
  const complete = () => { segs.forEach(s => { s.classList.remove('run'); s.classList.add('on'); }); intro.querySelector('.intro-segs')?.classList.add('complete'); };
  const finish = () => {
    done = true;
    skipSignature(svg);
    if (list().length) { showMilestone(list().length - 1, true); complete(); }
    intro.classList.add('after', 'ready');
    if (skip) skip.hidden = true;
  };
  // the end state, whatever happened before: page visible, hero risen, intro gone, focus on the page title
  const settle = () => {
    document.body.classList.remove('intro-open', 'entering');
    intro.hidden = true;
    document.querySelectorAll('.intro-flyer').forEach(el => el.remove());
    const h1 = document.querySelector('main h1');
    h1?.setAttribute('tabindex', '-1');
    h1?.focus({ preventScroll: true });
  };

  const close = async () => {
    if (closing) return;
    closing = true;
    done = true;
    skipSignature(svg);
    if (reducedMotion()) {
      await settled(intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }));
      settle();
      return;
    }
    const safety = setTimeout(settle, 4000);   // never leave the visitor stuck on the intro
    const brand = document.querySelector('.topbar .brand');
    const seal = brand?.querySelector('.brand-is');
    const word = svg.querySelector('.word');

    // 1) everything but the signature steps back
    intro.querySelectorAll('.intro-top, .intro-after, .intro-actions')
      .forEach(el => el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(6px)' }], { duration: 300, easing: EASE_OUT, fill: 'forwards' }));

    // 2) the "Is" (human) leaves in a fixed copy (own ids, so its ink mask keeps working) and flies to the seal,
    //    leaving a trail of gold ink
    const from = svg.getBoundingClientRect();
    const glyph = textBox(svg.querySelector('.is-fill'));
    const flyer = document.createElement('div');
    flyer.className = 'intro-flyer';
    Object.assign(flyer.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px` });
    // a real clone, not outerHTML: the strict CSP blocks the style attributes the drawing leaves on the svg
    const copy = svg.cloneNode(true);
    copy.querySelectorAll('[id]').forEach(el => { el.id = `fly-${el.id}`; });
    copy.querySelectorAll('[fill^="url(#"], [mask^="url(#"]').forEach(el => ['fill', 'mask'].forEach(a => {
      const v = el.getAttribute(a);
      if (v?.startsWith('url(#')) el.setAttribute(a, v.replace('url(#', 'url(#fly-'));
    }));
    flyer.append(copy);
    document.body.append(flyer);
    svg.querySelectorAll('.is').forEach(t => { t.style.visibility = 'hidden'; });
    document.body.classList.add('entering');
    let flight = Promise.resolve();
    const to = seal && textBox(seal);
    if (to && to.height && glyph.height) {
      const k = to.height / glyph.height;
      const dx = to.left - (from.left + (glyph.left - from.left) * k);
      const dy = to.top - (from.top + (glyph.top - from.top) * k);
      const anim = flyer.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
        { duration: 1050, delay: 150, easing: EASE_IN_OUT, fill: 'forwards' });
      flight = settled(anim);
      let frame = 0;
      (function trail() {
        if (anim.playState === 'finished') return;
        if (frame++ % 3 === 0) {
          const g = flyer.querySelector('.is-fill').getBoundingClientRect();
          if (g.width > 20) ink(g.right - g.width * .25, g.top + g.height * .55, 1, 1);
        }
        requestAnimationFrame(trail);
      })();
    }

    // 3) the name (artificial) breaks into pixels and is gone before the page appears (never on top of its title)
    const wr = word.getBoundingClientRect();
    word.animate([{ opacity: 1 }, { opacity: .55, offset: .45 }, { opacity: 0 }], { duration: 420, delay: 80, easing: EASE_OUT, fill: 'forwards' });
    const t0 = performance.now();
    (function dissolve(now) {
      const p = (now - t0) / 620;
      if (p > 1) return;
      if (p > .1) pixels(wr.left + wr.width * Math.random(), wr.top + wr.height * (.3 + Math.random() * .5), wr.height * .3, Math.random() < .5 ? -1 : 1, 3);
      requestAnimationFrame(dissolve);
    })(t0);

    // 4) the page appears underneath, as in IsAcademy: the intro background fades and the page settles into place;
    //    the hero rises line by line (.stagger) once the intro stops holding it
    const bg = getComputedStyle(intro).backgroundColor;
    intro.animate([{ backgroundColor: bg }, { backgroundColor: 'transparent' }], { duration: 700, delay: 520, easing: EASE_IN_OUT, fill: 'forwards' });
    document.querySelectorAll('.topbar, main').forEach(el =>
      el.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 520, easing: EASE_OUT, fill: 'backwards' }));
    setTimeout(() => document.body.classList.remove('intro-open'), 700);

    // 5) the "Is" lands: the real seal takes over
    await flight;
    const brandIn = brand?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: 'forwards' });
    await settled(flyer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }));
    clearTimeout(safety);
    settle();            // first the page leaves the "entering" state (which hides the seal)…
    brandIn?.cancel();   // …then the seal's own fade lets go: it never blinks off for a frame
  };

  document.body.classList.add('intro-open');
  // the focus rests on the intro itself: no button looks pressed before the visitor touches anything
  intro.tabIndex = -1;
  const rest = () => intro.focus({ preventScroll: true });
  rest();   // from the first frame: Escape jumps to the end, Tab reaches «Saltar intro»
  enter?.addEventListener('click', close);
  intro.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (a && a.origin === location.origin && !a.hasAttribute('download') && intro.classList.contains('after')) leaveHandoff();
  });
  skip?.addEventListener('click', () => { finish(); enter?.focus(); });
  intro.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (done) close(); else { finish(); enter?.focus(); } }
    if (e.key === 'Enter' && e.target === intro && intro.classList.contains('ready')) close();
  });

  if (reducedMotion()) { finish(); rest(); return { close }; }
  (async () => {
    // drawn on every visit, as IsAcademy's logo; only a visitor who has just seen it written in the intro of another
    // site (Inicio → CV Online) finds it complete, carried over by the page transition
    if (handoff) skipSignature(svg);
    else { await sleep(200); await playSignature(svg); }
    if (done) return;
    intro.classList.add('after');
    await sleep(600);
    intro.classList.add('ready');          // the actions are available while the milestones run
    for (let i = 0; i < list().length && !done; i++) { showMilestone(i); await sleep(stepMs); }
    if (!done) { done = true; complete(); if (skip) skip.hidden = true; }
    if (!intro.contains(document.activeElement)) rest();
  })();
  return { close };
}

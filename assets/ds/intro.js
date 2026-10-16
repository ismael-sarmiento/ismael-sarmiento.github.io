// The intro shared by every site of Ismael Sarmiento (Inicio, CV Online): the signature ("Is" sketched by hand, the
// name decoded by an AI), a tag, the hook, optional milestones and the actions. The exit is the "human + artificial"
// moment of the brand: the "Is" flies to the seal of the bar leaving gold ink while the name breaks into pixels and the
// page appears underneath (the same family as IsAcademy's hands, with its effects from /assets/ds/fx.js).
// Every visit, as IsAcademy: #top is the start of the page; deep links (#section) and the PDF build (?pdf) go straight
// to the page; "Saltar intro" or Escape jump to the end. Styles: /assets/ds/intro.css.
//
//   initIntro({ i18n, steps: () => ['…', '…'], stepMs: 1600 })   // steps are optional (the CV milestones)
import { reducedMotion } from './ds.js';
import { playSignature, skipSignature, fitSignature } from './signature.js';
import { ink, pixels } from './fx.js';

const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)';
const EASE_IN_OUT = 'cubic-bezier(.65, 0, .35, 1)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settled = anim => anim.finished.catch(() => {});

// a visitor coming from another site of the universe has just watched the signature (or IsAcademy's logo) being drawn
function fromSibling() {
  try {
    const r = new URL(document.referrer);
    return r.origin === location.origin && r.pathname !== location.pathname;
  } catch { return false; }
}

// the box of a piece of text as the browser lays it out (same metrics for the svg glyph and the seal in the bar)
const textBox = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };

export function initIntro({ i18n, steps = null, stepMs = 1600 } = {}) {
  const intro = document.getElementById('intro');
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
  i18n?.onChange(() => { if (shown >= 0 && stepText) stepText.textContent = list()[shown]; });

  const showMilestone = i => {
    if (!stepText) return;
    segs.forEach((s, k) => s.classList.toggle('on', k <= i));
    stepText.textContent = list()[i];
    shown = i;
    stepText.classList.remove('swap'); void stepText.offsetWidth; stepText.classList.add('swap');
  };
  const finish = () => {
    done = true;
    skipSignature(svg);
    if (list().length) showMilestone(list().length - 1);
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

    // 3) the name (artificial) breaks into pixels and fades away
    const wr = word.getBoundingClientRect();
    word.animate([{ opacity: 1 }, { opacity: 1, offset: .2 }, { opacity: 0 }], { duration: 800, delay: 150, fill: 'forwards' });
    const t0 = performance.now();
    (function dissolve(now) {
      const p = (now - t0) / 950;
      if (p > 1) return;
      if (p > .15) pixels(wr.left + wr.width * Math.random(), wr.top + wr.height * (.3 + Math.random() * .5), wr.height * .3, Math.random() < .5 ? -1 : 1, 3);
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
    brand?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: 'forwards' }).finished
      .then(() => brand.getAnimations().forEach(a => a.cancel())).catch(() => {});
    await settled(flyer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }));
    clearTimeout(safety);
    settle();
  };

  document.body.classList.add('intro-open');
  enter?.addEventListener('click', close);
  skip?.addEventListener('click', () => { finish(); enter?.focus(); });
  intro.addEventListener('keydown', e => { if (e.key === 'Escape') { if (done) close(); else { finish(); enter?.focus(); } } });

  if (reducedMotion()) { finish(); enter?.focus(); return { close }; }
  (async () => {
    await sleep(200);
    if (fromSibling()) {
      await document.fonts.ready;
      fitSignature(svg);
      skipSignature(svg);
      intro.querySelector('.intro-sig')?.classList.add('drawn');
      await sleep(600);
    } else {
      await playSignature(svg);
    }
    if (done) return;
    intro.classList.add('after');
    await sleep(600);
    intro.classList.add('ready');          // the actions are available while the milestones run
    for (let i = 0; i < list().length && !done; i++) { showMilestone(i); await sleep(stepMs); }
    if (!done) { done = true; if (skip) skip.hidden = true; enter?.focus(); }
  })();
  return { close };
}

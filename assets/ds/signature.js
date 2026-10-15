// The signature of every site of Ismael Sarmiento: the calligraphic "Is" is sketched by hand, then an AI "decodes"
// the rest of the word (same technique as IsAcademy's intro, where the word is "Academy").
//
//   el.innerHTML = signatureSVG('sig', 'mael Sarmiento');   // final state (no JavaScript animation needed)
//   await playSignature(el.querySelector('svg'));            // the animation; skipSignature(svg) jumps to the end
import { reducedMotion } from './ds.js';

const GLYPHS = '01/{}#$%@=+*ABCDEFXYZ';
const DASH = 3000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const easeInOut = p => (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const WORD_X = 296;

export function signatureSVG(id, word) {
  return `<svg class="sig" viewBox="0 0 ${WORD_X + word.length * 78} 330" data-word="${word}" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}-edge" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="${id}-ink" maskUnits="userSpaceOnUse" x="0" y="0" width="3000" height="330"><rect class="ink" x="0" y="0" width="3000" height="330" fill="url(#${id}-edge)"/></mask>
  </defs>
  <text class="is is-stroke" x="70" y="250">Is</text>
  <text class="is is-fill" x="70" y="250" mask="url(#${id}-ink)">Is</text>
  <text class="word" x="${WORD_X}" y="245">${word}</text>
  <rect class="cursor" x="0" y="150" width="6" height="122" rx="3" opacity="0"/>
</svg>`;
}

// size the viewBox to the real word once the font is ready, so the signature never overflows or floats
export function fitSignature(svg) {
  const word = svg.querySelector('.word');
  const w = word.getComputedTextLength();
  if (w) svg.setAttribute('viewBox', `0 0 ${Math.ceil(WORD_X + w + 30)} 330`);
}

function animate(svg, duration, step) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const tick = now => {
      const p = svg.dataset.skipped ? 1 : Math.min(1, (now - t0) / duration);
      step(p);
      if (p < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function cursorAfter(svg) {
  const word = svg.querySelector('.word');
  svg.querySelector('.cursor').setAttribute('x', String(WORD_X + (word.textContent ? word.getComputedTextLength() : 0) + 22));
}

export function skipSignature(svg) {
  svg.dataset.skipped = '1';
  svg.querySelector('.is-stroke').style.strokeDashoffset = '0';
  svg.querySelector('.ink').setAttribute('width', '3000');
  svg.querySelector('.word').textContent = svg.dataset.word;
  svg.querySelector('.cursor').setAttribute('opacity', '0');
}

export async function playSignature(svg) {
  await document.fonts.ready;
  fitSignature(svg);
  if (reducedMotion()) { skipSignature(svg); return; }
  const stroke = svg.querySelector('.is-stroke'), ink = svg.querySelector('.ink'), word = svg.querySelector('.word');
  const fill = svg.querySelector('.is-fill').getBBox();
  const target = svg.dataset.word;
  stroke.style.strokeDasharray = String(DASH);
  stroke.style.strokeDashoffset = String(DASH);
  ink.setAttribute('width', '0');
  word.textContent = '';
  // same rhythm as IsAcademy: 1) the outline of "Is" is sketched, 2) ink fills it from left to right
  await animate(svg, 1500, p => { stroke.style.strokeDashoffset = String(DASH * (1 - easeInOut(p))); });
  await animate(svg, 700, p => { ink.setAttribute('x', String(fill.x - 20)); ink.setAttribute('width', String((fill.width + 60) * easeInOut(p))); });
  // 3) the rest of the name is decoded letter by letter behind a blinking cursor
  const cursor = svg.querySelector('.cursor');
  cursor.setAttribute('opacity', '1');
  for (let i = 0; i <= target.length && !svg.dataset.skipped; i++) {
    for (let k = 0; k < 3 && !svg.dataset.skipped; k++) {
      const noise = Array.from({ length: Math.min(2, target.length - i) }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('');
      word.textContent = target.slice(0, i) + noise;
      cursorAfter(svg);
      await sleep(32);
    }
  }
  word.textContent = target;
  cursorAfter(svg);
  await sleep(500);
  cursor.setAttribute('opacity', '0');
}

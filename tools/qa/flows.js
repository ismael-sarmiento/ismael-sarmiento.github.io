// Inicio · flows battery. Paste in the browser console on / (local universe site, intro closed) before publishing.
// Every check prints PASS or FAIL; nothing is sent anywhere.
(async () => {
  const R = []; const ok = (n, c) => R.push((c ? 'PASS ' : 'FAIL ') + n); const sleep = ms => new Promise(r => setTimeout(r, ms));
  ok('intro closed (open the page with #main or press «Conocerme» first)', document.getElementById('intro').hidden);
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id); ok('ids unique', new Set(ids).size === ids.length);
  ok('single h1 with the name for screen readers', document.querySelectorAll('h1').length === 1 && document.querySelector('h1').textContent.includes('Ismael Sarmiento'));
  ok('four doors (IsProfile, IsAcademy, IsGame, Kimera Tools)', [...document.querySelectorAll('.door h3')].map(h => h.textContent.replace(/_$/, '')).join() === 'IsProfile,IsAcademy,IsGame,Kimera Tools');
  ok('door marks IsProfile, IsAcademy, IsGame, Kimera Tools (one wordmark each)', [...document.querySelectorAll('.door .door-mark')].map(m => m.textContent.replace(/_$/, '')).join() === 'IsProfile,IsAcademy,IsGame,Kimera Tools');
  ok('every page link and share URL lives on isuniverse.dev', [...document.querySelectorAll('link[rel=canonical], link[rel=alternate], meta[property="og:url"], meta[property="og:image"]')]
    .every(el => (el.href || el.content).startsWith('https://isuniverse.dev/')));
  ok('doors and footer use the new paths', [...document.querySelectorAll('a[href^="/"]')].every(a => !/^\/(cv|isacademy|isgame)\//.test(a.getAttribute('href'))));
  const before = document.documentElement.dataset.theme; document.querySelector('.topbar [data-action=theme]').click(); await sleep(50);
  ok('theme toggles and is remembered', before !== document.documentElement.dataset.theme && localStorage.getItem('isa-theme') === document.documentElement.dataset.theme);
  document.querySelector('.topbar [data-action=theme]').click();
  // Alan: floating button, four suggestions, answers with their buttons
  document.querySelector('.assistant-fab').click(); await sleep(500);
  const p = document.getElementById('assistantPanel'); ok('Alan opens with four suggestions', !p.hidden && p.querySelectorAll('.chip').length === 4);
  p.querySelector('.chip').click(); await sleep(2000); ok('a suggestion gets an answer', p.querySelectorAll('.msg-bot').length >= 2);
  const input = p.querySelector('.as-form input'), form = p.querySelector('.as-form');
  const ask = async q => { input.value = q; form.requestSubmit(); await sleep(2600); return [...p.querySelectorAll('.msg-bot')].pop(); };
  for (const [q, expected] of [['¿Qué es IsAcademy?', 'IsAcademy es la academia'], ['¿Qué hace en Savana?', 'En Savana pasó'],
    ['¿Qué es Kimera Tools?', 'Kimera Tools es su código abierto'], ['¿Qué es IsGame?', 'IsGame es el juego'], ['¿Cómo puedo contactar con él?', 'Por correo'], ['xyzzy', 'No tengo una respuesta']]) {
    ok(`Alan answers «${q}»`, (await ask(q)).innerText.includes(expected));
  }
  ok('the CV answer offers the CV and the PDF', [...(await ask('¿Dónde veo su CV?')).querySelectorAll('[data-as-href]')].map(b => b.dataset.asHref).join(' ') === '/profile/ /profile/ismael-sarmiento-cv.pdf');
  p.querySelector('.as-close').click(); await sleep(300); ok('panel closes', p.hidden);
  const lb = document.querySelector('.topbar [data-action=lang]'); lb.click(); await sleep(400);
  ok('English via ?lang=en', document.documentElement.lang === 'en' && location.search.includes('lang=en') && lb.textContent.trim() === 'ES');
  ok('Alan speaks English', document.querySelector('.assistant-fab').textContent.trim() === 'Can I help?');
  lb.click(); await sleep(400); ok('back to Spanish', document.documentElement.lang === 'es' && !location.search.includes('lang'));
  ok('external links rel=noopener', [...document.querySelectorAll('a[href^="http"]')].every(a => /noopener/.test(a.rel)));
  ok('bar controls share one height', new Set([...document.querySelectorAll('.tools > .btn')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height))).size === 1);
  ok('no horizontal overflow', document.documentElement.scrollWidth <= innerWidth);
  ok('footer: sites → contact → Privacidad → Volver arriba', [...document.querySelectorAll('.footer-links a, .footer-top')]
    .map(a => a.textContent.trim()).join('|') === 'IsProfile|IsAcademy|IsGame|WhatsApp|Correo|LinkedIn|GitHub|Privacidad|Volver arriba');
  console.log(R.join('\n'));
  return R.filter(r => r.startsWith('FAIL')).length ? 'FAILURES' : 'ALL PASS';
})();

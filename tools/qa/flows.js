// Inicio · flows battery. Paste in the browser console on / (local universe site, intro closed) before publishing.
// Every check prints PASS or FAIL; nothing is sent anywhere.
(async () => {
  const R = []; const ok = (n, c) => R.push((c ? 'PASS ' : 'FAIL ') + n); const sleep = ms => new Promise(r => setTimeout(r, ms));
  ok('intro closed (open the page with #main or press «Conocerme» first)', document.getElementById('intro').hidden);
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id); ok('ids unique', new Set(ids).size === ids.length);
  ok('single h1 with the name for screen readers', document.querySelectorAll('h1').length === 1 && document.querySelector('h1').textContent.includes('Ismael Sarmiento'));
  ok('three doors', document.querySelectorAll('.door').length === 3);
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
    ['¿Qué es Kimera Tools?', 'Kimera Tools es su código abierto'], ['¿Cómo puedo contactar con él?', 'Por correo'], ['xyzzy', 'No tengo una respuesta']]) {
    ok(`Alan answers «${q}»`, (await ask(q)).innerText.includes(expected));
  }
  ok('the CV answer offers the CV and the PDF', [...(await ask('¿Dónde veo su CV?')).querySelectorAll('[data-as-href]')].map(b => b.dataset.asHref).join(' ') === '/cv/ /cv/ismael-sarmiento-cv.pdf');
  p.querySelector('.as-close').click(); await sleep(300); ok('panel closes', p.hidden);
  const lb = document.querySelector('.topbar [data-action=lang]'); lb.click(); await sleep(400);
  ok('English via ?lang=en', document.documentElement.lang === 'en' && location.search.includes('lang=en') && lb.textContent.trim() === 'ES');
  ok('Alan speaks English', document.querySelector('.assistant-fab').textContent.trim() === 'Can I help?');
  lb.click(); await sleep(400); ok('back to Spanish', document.documentElement.lang === 'es' && !location.search.includes('lang'));
  ok('external links rel=noopener', [...document.querySelectorAll('a[href^="http"]')].every(a => /noopener/.test(a.rel)));
  ok('bar controls share one height', new Set([...document.querySelectorAll('.tools > .btn')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height))).size === 1);
  ok('no horizontal overflow', document.documentElement.scrollWidth <= innerWidth);
  console.log(R.join('\n'));
  return R.filter(r => r.startsWith('FAIL')).length ? 'FAILURES' : 'ALL PASS';
})();

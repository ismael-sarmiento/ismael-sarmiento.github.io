#!/usr/bin/env python3
"""Builds the portada of ismael-sarmiento.github.io, the same way IsAcademy and CV Online work:

  index.html             the page, in Spanish with data-i18n keys (English is /?lang=en, no /en/ folder)
  i18n/es.json, en.json  { "key": "text" } dictionaries for the shared i18n module (/assets/ds/i18n.js)
  404.html · redirects of the old CV addresses (/index_en.html, /articles/…) to CV Online in /cv/
  robots.txt · sitemap.xml (index of the portada, /cv/ and /isacademy/ sitemaps) · sitemap-portada.xml

    python3 tools/build.py 20261014a      # the argument is the asset version (cache busting)
"""
import base64
import hashlib
import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION = sys.argv[1] if len(sys.argv) > 1 else '20261014a'
SITE = 'https://ismael-sarmiento.github.io'
TODAY = '2026-10-14'
CF_TOKEN = '1af8978bb58b4f6cb3771790a71c784c'  # Cloudflare Web Analytics
EMAIL = 'ismaelantonio.professional@gmail.com'
LINKEDIN = 'https://www.linkedin.com/in/ismael-sarmiento/'
GITHUB = 'https://github.com/ismael-sarmiento'
e = lambda s: html.escape(str(s), quote=True)

# every text of the portada; the keys are the data-i18n keys of the page
TEXT = {
    'meta.title': ('Ismael Sarmiento · Head of Data Management y fundador de IsAcademy',
                   'Ismael Sarmiento · Head of Data Management and founder of IsAcademy'),
    'meta.description': ('Ismael Sarmiento, Head of Data Management en Savana y fundador de IsAcademy. Gobierno del dato, interoperabilidad clínica y calidad del dato. CV Online, academia y código abierto.',
                         'Ismael Sarmiento, Head of Data Management at Savana and founder of IsAcademy. Data governance, clinical interoperability and data quality. CV Online, academy and open source.'),
    'skip': ('Ir al contenido', 'Skip to content'),
    'langLabel': ('Cambiar a inglés', 'Switch to Spanish'),
    'langShort': ('EN', 'ES'),
    'theme': ('Cambiar modo claro / oscuro', 'Toggle light / dark mode'),
    'homeHref': ('/', '/?lang=en'),
    'eyebrow': ('Head of Data Management en Savana', 'Head of Data Management at Savana'),
    'lead': ('Construyo productos y plataformas de datos gobernados, interoperables y confiables.',
             'I build governed, interoperable and reliable data products and platforms.'),
    'founder': ('Fundador de IsAcademy', 'Founder of IsAcademy'),
    'slogan': ('La Inteligencia Artificial (IA) te da respuestas. <b>Aquí te enseñamos a pensar.</b>',
               'Artificial Intelligence (AI) gives you answers. <b>Here we teach you how to think.</b>'),
    'chipsLabel': ('Especialización', 'Specialisation'),
    'chip.0': ('Gobierno del dato', 'Data governance'),
    'chip.1': ('Interoperabilidad clínica', 'Clinical interoperability'),
    'chip.2': ('Calidad del dato', 'Data quality'),
    'chip.3': ('Certificación CDMP · DAMA', 'CDMP certified · DAMA'),
    'projects': ('Proyectos', 'Projects'),
    'door.0.text': ('Mi trayectoria profesional: Savana, Stratio, Santander y BBVA. Gobierno del dato, HL7 FHIR, OMOP CDM y DataHub.',
                    'My professional path: Savana, Stratio, Santander and BBVA. Data governance, HL7 FHIR, OMOP CDM and DataHub.'),
    'door.0.cta': ('Ver CV Online', 'View CV Online'),
    'door.0.href': ('/cv/', '/cv/?lang=en'),
    'door.1.text': ('Mi academia online de programación, datos e IA: clases personalizadas de Python, SQL, Big Data, Data Engineering e IA.',
                    'My online academy for programming, data and AI: tailored lessons in Python, SQL, Big Data, Data Engineering and AI.'),
    'door.1.cta': ('Conocer IsAcademy', 'Discover IsAcademy'),
    'door.1.href': ('/isacademy/', '/isacademy/?lang=en'),
    'door.2.text': ('Mi código abierto: librerías de Python y apuntes de ingeniería de datos recogidos a lo largo de los años.',
                    'My open source: Python libraries and data engineering notes gathered over the years.'),
    'door.2.cta': ('Ver en GitHub', 'View on GitHub'),
    'contact': ('Contacto', 'Contact'),
}
ES = {k: v[0] for k, v in TEXT.items()}
EN = {k: v[1] for k, v in TEXT.items()}
DOORS = [('CV Online', 'door.0.href', None), ('IsAcademy', 'door.1.href', None), ('Kimera Tools', None, 'https://github.com/kimera-tools')]

BOOT = "try{var t=localStorage.getItem('isa-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}"
MODULES = ['/assets/ds/ds.js', '/assets/ds/i18n.js', '/assets/ds/signature.js', '/assets/hub.js']
IMPORT_MAP = json.dumps({'imports': {m: f'{m}?v={VERSION}' for m in MODULES}}, separators=(',', ':'))
sha = lambda s: base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()
CSP = ("default-src 'self'; script-src 'self' https://static.cloudflareinsights.com "
       f"'sha256-{sha(BOOT)}' 'sha256-{sha(IMPORT_MAP)}'; style-src 'self'; img-src 'self' data:; font-src 'self'; "
       "connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'none'; form-action 'none'")
WORD, WX = 'mael Sarmiento', 296
SIG = f'''<svg class="sig" viewBox="0 0 {WX + len(WORD) * 78} 330" data-word="{WORD}" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="hs-edge" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
            <mask id="hs-ink" maskUnits="userSpaceOnUse" x="0" y="0" width="3000" height="330"><rect class="ink" x="0" y="0" width="3000" height="330" fill="url(#hs-edge)"/></mask>
          </defs>
          <text class="is is-stroke" x="70" y="250">Is</text>
          <text class="is is-fill" x="70" y="250" mask="url(#hs-ink)">Is</text>
          <text class="word" x="{WX}" y="245">{WORD}</text>
          <rect class="cursor" x="0" y="150" width="6" height="122" rx="3" opacity="0"/>
        </svg>'''
MOON = '<svg class="i-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.7 14.4A8.5 8.5 0 0 1 9.6 3.3a.7.7 0 0 0-.8-.8A10.2 10.2 0 1 0 21.5 15a.7.7 0 0 0-.8-.6Z"/></svg>'
SUN = '<svg class="i-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>'

PERSON = {
    '@context': 'https://schema.org',
    '@graph': [
        {'@type': 'WebSite', '@id': f'{SITE}/#website', 'url': f'{SITE}/', 'name': 'Ismael Sarmiento', 'inLanguage': ['es', 'en'],
         'publisher': {'@id': f'{SITE}/#person'}},
        {'@type': 'Person', '@id': f'{SITE}/#person', 'name': 'Ismael Sarmiento', 'alternateName': 'Ismael A. Sarmiento', 'url': f'{SITE}/',
         'image': f'{SITE}/assets/brand/ismael.jpg', 'jobTitle': 'Head of Data Management',
         'worksFor': {'@type': 'Organization', 'name': 'Savana', 'url': 'https://savanamed.com/about-us/'},
         'founder': {'@id': f'{SITE}/isacademy/#org'},
         'memberOf': {'@type': 'Organization', 'name': 'DAMA Spain', 'url': 'https://www.damaspain.org/'},
         'hasCredential': {'@type': 'EducationalOccupationalCredential', 'name': 'CDMP Certification – Associate', 'credentialCategory': 'certification',
                           'recognizedBy': {'@type': 'Organization', 'name': 'DAMA International'}},
         'knowsAbout': ['Data Governance', 'Clinical Interoperability', 'Data Quality', 'HL7 FHIR', 'OMOP CDM', 'DataHub', 'Data Engineering', 'Python'],
         'sameAs': [LINKEDIN, GITHUB, 'https://github.com/kimera-tools']},
    ],
}


def T(key, tag='span', cls='', extra='', rich=False):
    c = f' class="{cls}"' if cls else ''
    attr = 'data-i18n-html' if rich else 'data-i18n'
    return f'<{tag}{c} {attr}="{key}"{extra}>{ES[key] if rich else e(ES[key])}</{tag}>'


def A(attr, key):
    data = {'aria-label': 'data-i18n-aria', 'href': 'data-i18n-href'}[attr]
    return f'{attr}="{e(ES[key])}" {data}="{key}"'


def head(title, description, extra=''):
    return f'''<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="{CSP}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{e(title)}</title>
  <meta name="description" content="{e(description)}">
  <meta name="author" content="Ismael Sarmiento">
  <meta name="theme-color" content="#0b1026">
  {extra}
  <link rel="icon" href="/assets/brand/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
  <script>{BOOT}</script>
  <link rel="preload" href="/assets/ds/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/ds/tokens.css?v={VERSION}">
  <link rel="stylesheet" href="/assets/ds/base.css?v={VERSION}">
  <link rel="stylesheet" href="/assets/hub.css?v={VERSION}">
  <script type="importmap">{IMPORT_MAP}</script>
  <script type="module" src="/assets/hub.js?v={VERSION}"></script>
</head>'''


def topbar():
    return f'''<header class="topbar">
    <div class="container topbar-row">
      <a class="brand" href="/" {A('href', 'homeHref').replace('href="/" ', '')} aria-label="Ismael Sarmiento"><span class="brand-is" aria-hidden="true">Is</span><span class="brand-name" aria-hidden="true">mael Sarmiento</span></a>
      <div class="tools">
        <button class="btn btn-icon lang-btn" type="button" data-action="lang" {A('aria-label', 'langLabel')}>{T('langShort')}</button>
        <button class="btn btn-icon theme-btn" type="button" data-action="theme" {A('aria-label', 'theme')}>{MOON}{SUN}</button>
      </div>
    </div>
  </header>'''


def footer():
    return f'''<footer class="footer">
    <div class="container footer-row">
      <span>© <span data-year>2026</span> Ismael Sarmiento</span>
      <nav class="footer-links" {A('aria-label', 'contact')}>
        <a href="{LINKEDIN}" rel="noopener me">LinkedIn</a>
        <a href="{GITHUB}" rel="noopener me">GitHub</a>
        <a href="mailto:{EMAIL}">{EMAIL}</a>
      </nav>
    </div>
  </footer>
  <!-- Cloudflare Web Analytics --><script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "{CF_TOKEN}"}}'></script><!-- End Cloudflare Web Analytics -->'''


def home():
    url = f'{SITE}/'
    extra = f'''<link rel="canonical" href="{url}">
  <link rel="alternate" hreflang="es" href="{url}">
  <link rel="alternate" hreflang="en" href="{url}?lang=en">
  <link rel="alternate" hreflang="x-default" href="{url}">
  <link rel="me" href="{GITHUB}">
  <link rel="me" href="{LINKEDIN}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="Ismael Sarmiento">
  <meta property="og:locale" content="es_ES">
  <meta property="og:locale:alternate" content="en_GB">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{e(ES['meta.title'])}">
  <meta property="og:description" content="{e(ES['lead'])}">
  <meta property="og:image" content="{SITE}/assets/brand/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Ismael Sarmiento · Head of Data Management · Fundador de IsAcademy">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{json.dumps(PERSON, ensure_ascii=False)}</script>'''
    doors = ''
    for i, (name, href_key, fixed) in enumerate(DOORS):
        href = f'href="{fixed}" rel="noopener"' if fixed else A('href', href_key)
        doors += f'''
          <a class="card door reveal" {href} data-d="{i + 1}">
            <span class="door-num" aria-hidden="true">0{i + 1}</span>
            <h3>{name}</h3>
            {T(f'door.{i}.text', 'p')}
            {T(f'door.{i}.cta', 'span', 'btn-link btn-arrow')}
          </a>'''
    chips = ''.join(T(f'chip.{i}', 'li') for i in range(4))
    return f'''<!doctype html>
<html lang="es">
{head(ES['meta.title'], ES['meta.description'], extra)}
<body>
  <a class="skip-link" href="#main">{T('skip')}</a>
  {topbar()}

  <main id="main">
    <section class="hero">
      <svg class="circuit" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
        <path d="M600 120H430l-40 40H300"/><circle cx="300" cy="160" r="4"/>
        <path d="M600 210H470l-30 30H350"/><circle cx="350" cy="240" r="4"/>
        <path d="M600 330H500l-50-50H380"/><circle cx="380" cy="280" r="4"/>
        <path d="M600 430H440l-30 30H330"/><circle cx="330" cy="460" r="4"/>
      </svg>
      <div class="container hero-inner">
        <div class="hero-text">
          {T('eyebrow', 'p', 'eyebrow')}
          <h1 class="hero-name"><span class="sr-only">Ismael Sarmiento</span>
        {SIG}</h1>
          {T('lead', 'p', 'lead hero-lead')}
          <p class="hero-founder"><a href="/isacademy/" data-i18n-href="door.1.href">{T('founder')}</a>{T('slogan', 'span', 'hero-slogan', rich=True)}</p>
          <ul class="chips hero-chips" {A('aria-label', 'chipsLabel')}>{chips}</ul>
        </div>
        <img class="hero-photo" src="/assets/brand/ismael.jpg" width="264" height="264" alt="Ismael Sarmiento" fetchpriority="high">
      </div>
    </section>

    <section class="doors" aria-labelledby="doors-title">
      <div class="container">
        {T('projects', 'h2', 'sr-only', ' id="doors-title"')}
        <div class="door-grid">{doors}
        </div>
      </div>
    </section>
  </main>

  {footer()}
</body>
</html>
'''


def redirect(target, title):
    """An old address of the CV: tell browsers and crawlers where it lives now."""
    return f'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{e(title)}</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="{SITE}{target}">
  <meta http-equiv="refresh" content="0; url={target}">
</head>
<body>
  <p><a href="{target}">{e(title)}: {SITE}{target}</a></p>
</body>
</html>
'''


def not_found():
    return f'''<!doctype html>
<html lang="es">
{head('Página no encontrada · Ismael Sarmiento', 'Esta página no existe.', '<meta name="robots" content="noindex">')}
<body>
  {topbar()}
  <main id="main" class="container nf">
    <p class="eyebrow">404</p>
    <h1>Esta página no existe · This page does not exist</h1>
    <p class="lead">Puede que la dirección haya cambiado. El CV Online está ahora en <a href="/cv/">/cv/</a>.</p>
    <p class="nf-actions"><a class="btn btn-primary btn-arrow" href="/">Ir a la portada</a><a class="btn" href="/cv/">CV Online</a><a class="btn" href="/isacademy/">IsAcademy</a></p>
  </main>
  {footer()}
</body>
</html>
'''


def write(rel, text):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


if __name__ == '__main__':
    write('index.html', home())
    write('i18n/es.json', json.dumps(ES, ensure_ascii=False, indent=0))
    write('i18n/en.json', json.dumps(EN, ensure_ascii=False, indent=0))
    write('404.html', not_found())
    write('index_en.html', redirect('/cv/?lang=en', 'CV Online (English)'))
    write('articles/index.html', redirect('/cv/', 'CV Online'))
    write('articles/index_en.html', redirect('/cv/?lang=en', 'CV Online (English)'))
    write('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n')
    write('sitemap.xml', f'''<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>{SITE}/sitemap-portada.xml</loc><lastmod>{TODAY}</lastmod></sitemap>
  <sitemap><loc>{SITE}/cv/sitemap.xml</loc><lastmod>{TODAY}</lastmod></sitemap>
  <sitemap><loc>{SITE}/isacademy/sitemap.xml</loc></sitemap>
</sitemapindex>
''')
    write('sitemap-portada.xml', f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>{SITE}/</loc><lastmod>{TODAY}</lastmod>
    <xhtml:link rel="alternate" hreflang="es" href="{SITE}/"/><xhtml:link rel="alternate" hreflang="en" href="{SITE}/?lang=en"/>
  </url>
  <url>
    <loc>{SITE}/?lang=en</loc><lastmod>{TODAY}</lastmod>
    <xhtml:link rel="alternate" hreflang="es" href="{SITE}/"/><xhtml:link rel="alternate" hreflang="en" href="{SITE}/?lang=en"/>
  </url>
</urlset>
''')
    print(f'built portada (es + i18n), 404, redirects, robots and sitemaps (version {VERSION})')

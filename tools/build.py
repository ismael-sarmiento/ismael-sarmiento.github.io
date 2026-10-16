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
    'lead': ('Diseño y construyo plataformas de datos e IA gobernadas y confiables que ayudan a las organizaciones a decidir mejor y a crecer con impacto real.',
             'I design and build governed, reliable data and AI platforms that help organisations make better decisions and grow with real impact.'),
    'about.title': ('Sobre mí', 'About me'),
    'about.0': ('Llevo casi una década construyendo plataformas de datos: primero en banca (BBVA Next Technologies, Santander Global Tech), después en StratioBD y hoy en Savana, donde lidero Data Management en salud digital.',
                'For almost a decade I have been building data platforms: first in banking (BBVA Next Technologies, Santander Global Tech), then at StratioBD and today at Savana, where I lead Data Management in digital health.'),
    'about.1': ('Me obsesiona que el dato sea algo en lo que se pueda confiar: gobernado, interoperable (HL7 FHIR, OMOP CDM) y con una calidad que se mide (UNE 0081). Tengo la certificación CDMP de DAMA International.',
                'I am obsessed with data people can trust: governed, interoperable (HL7 FHIR, OMOP CDM) and with measurable quality (UNE 0081). I hold the CDMP certification from DAMA International.'),
    'about.2': ('Y como aprender sigue siendo algo humano, fundé <a href="/isacademy/">IsAcademy</a> para enseñar a pensar con datos e IA.',
                'And because learning is still human, I founded <a href="/isacademy/?lang=en">IsAcademy</a> to teach people to think with data and AI.'),
    'intro.title': ('Ismael Sarmiento · Inicio', 'Ismael Sarmiento · Home'),
    'intro.skip': ('Saltar intro', 'Skip intro'),
    'intro.enter': ('Conocerme', 'Get to know me'),
    'projects': ('Proyectos', 'Projects'),
    'door.0.text': ('Mi trayectoria en Savana, StratioBD, Santander Global Tech y BBVA Next Technologies: gobierno, interoperabilidad y calidad del dato.',
                    'My career at Savana, StratioBD, Santander Global Tech and BBVA Next Technologies: data governance, interoperability and quality.'),
    'door.0.cta': ('Ver CV Online', 'View CV Online'),
    'door.0.href': ('/cv/', '/cv/?lang=en'),
    'door.1.text': ('Mi academia online de programación, datos e IA, con clases personalizadas para todas las edades.',
                    'My online academy for programming, data and AI, with tailored lessons for all ages.'),
    'door.1.cta': ('Conocer IsAcademy', 'Discover IsAcademy'),
    'door.1.href': ('/isacademy/', '/isacademy/?lang=en'),
    'door.2.text': ('Mi código abierto: kimera-python, utilidades de Python para ETL, SQLAlchemy y AWS S3 (2020–2022).',
                    'My open source: kimera-python, Python utilities for ETL, SQLAlchemy and AWS S3 (2020–2022).'),
    'door.2.cta': ('Ver en GitHub', 'View on GitHub'),
    'contact': ('Contacto', 'Contact'),
}
ES = {k: v[0] for k, v in TEXT.items()}
EN = {k: v[1] for k, v in TEXT.items()}
DOORS = [('CV Online', 'door.0.href', None), ('IsAcademy', 'door.1.href', None), ('Kimera Tools', None, 'https://github.com/kimera-tools')]

# Alan on Inicio: the same assistant as CV Online and IsAcademy (/assets/ds/assistant.js), fed with the public story of
# this page. Answers shared with the CV FAQ keep its wording (cv/data/content.json); nothing here is new information.
MAIL, CV_PDF = f'mailto:{EMAIL}', {'es': '/cv/ismael-sarmiento-cv.pdf', 'en': '/cv/ismael-sarmiento-cv-en.pdf'}
ALAN = {
    'es': {
        'assistant': {
            'name': 'Alan', 'badge': 'Beta', 'subtitle': 'Asistente local de la web · sin datos privados ni modelos externos',
            'open': '¿Te ayudo?', 'openLabel': 'Abrir el asistente', 'close': 'Cerrar el asistente', 'typing': 'Alan está escribiendo…',
            'placeholder': 'Escribe tu pregunta…', 'send': 'Enviar',
            'greeting': '¡Hola! Soy Alan, el asistente local de la web de Ismael (versión beta). Respondo solo con el contenido público de esta web: no uso datos privados ni modelos externos.',
            'suggestions': ['¿Quién es Ismael?', '¿Qué hace en Savana?', '¿Qué es IsAcademy?', '¿Cómo contacto con él?'],
            'fallback': {'answer': 'No tengo una respuesta exacta para eso en esta versión beta. Puedo contarte quién es Ismael, su trayectoria, IsAcademy, Kimera Tools, su CV o cómo contactar con él.',
                         'actions': [{'label': 'Ver CV Online', 'href': '/cv/'}]},
        },
        'faq': [
            {'q': '¿Quién es Ismael?', 'keywords': ['quien', 'ismael', 'sarmiento', 'presentacion', 'sobre'],
             'a': 'Ismael Sarmiento es Head of Data Management en Savana y fundador de IsAcademy. Lleva casi una década construyendo plataformas de datos: primero en banca (BBVA Next Technologies, Santander Global Tech), después en StratioBD y hoy en Savana, donde lidera Data Management en salud digital. Tiene la certificación CDMP de DAMA International.',
             'actions': [{'label': 'Ver CV Online', 'href': '/cv/'}]},
            {'q': '¿Cuál es su foco principal?', 'keywords': ['foco', 'principal', 'perfil', 'especializacion'],
             'a': 'Su foco es diseñar y construir plataformas de datos e IA gobernadas y confiables que ayudan a las organizaciones a decidir mejor y a crecer con impacto real, combinando ejecución técnica, criterio arquitectónico y liderazgo de equipos.'},
            {'q': '¿Qué hace en Savana?', 'keywords': ['savana', 'head', 'lead', 'data management'],
             'a': 'En Savana pasó de Senior Data Engineer a Lead Data Engineer y después a Head of Data Management, impulsando interoperabilidad clínica con FHIR y OMOP, plataformas de calidad del dato, catálogo y metadatos con DataHub, y control del ciclo de vida del dato.'},
            {'q': '¿Cuál es su trayectoria?', 'keywords': ['autana', 'bbva', 'career', 'companies', 'empresas', 'experience', 'experiencia', 'santander', 'stratio', 'stratiobd', 'trayectoria'],
             'a': 'Su trayectoria pasa por Autana Consultores de Tecnología, BBVA Next Technologies, Santander Global Tech, StratioBD y Savana: una evolución desde el desarrollo de software y las plataformas de datos hasta liderar Data Management, con foco en gobierno, interoperabilidad y calidad del dato.',
             'actions': [{'label': 'Ver CV Online', 'href': '/cv/'}]},
            {'q': '¿Qué certificaciones tiene?', 'keywords': ['certificacion', 'certificaciones', 'cdmp', 'dama', 'fhir', 'snomed', 'mondragon', 'titulo'],
             'a': 'Tiene la certificación CDMP (Associate) de DAMA International (2026) y es miembro activo de DAMA Spain. También es FHIR Foundational Implementer (2025), Experto en Gobierno y Gestión Estratégica de Datos por Mondragon Unibertsitatea (2024) y tiene los fundamentos de terminología SNOMED CT (2026).'},
            {'q': '¿Lidera equipos?', 'keywords': ['lidera', 'liderazgo', 'lider', 'equipo', 'equipos', 'head', 'manager', 'gestion', 'responsable'],
             'a': 'Sí. Como Head of Data Management en Savana lidera el área de Data Management y equipos de datos de alto rendimiento, sin perder cercanía con la arquitectura, la construcción de soluciones y el diseño de producto.'},
            {'q': '¿Qué es IsAcademy?', 'keywords': ['isacademy', 'academia', 'alumnos', 'cursos', 'fundador', 'clases'],
             'a': 'IsAcademy es la academia online de programación, datos e IA que Ismael fundó en 2023: clases personalizadas de Python, SQL, Big Data, Data Engineering e IA para todas las edades. Su lema: la IA te da respuestas; aquí te enseñamos a pensar.',
             'actions': [{'label': 'Conocer IsAcademy', 'href': '/isacademy/'}]},
            {'q': '¿Qué es Kimera Tools?', 'keywords': ['kimera', 'tools', 'codigo', 'abierto', 'github', 'python', 'open source'],
             'a': 'Kimera Tools es su código abierto: kimera-python, utilidades de Python para ETL, SQLAlchemy y AWS S3 (2020–2022).',
             'actions': [{'label': 'Ver en GitHub', 'href': 'https://github.com/kimera-tools'}]},
            {'q': '¿Dónde veo su CV?', 'keywords': ['cv', 'curriculum', 'pdf', 'descargar', 'resume'],
             'a': 'Su CV Online cuenta su trayectoria en Savana, StratioBD, Santander Global Tech y BBVA Next Technologies, en español e inglés, y también se descarga en PDF.',
             'actions': [{'label': 'Ver CV Online', 'href': '/cv/'}, {'label': 'Descargar PDF', 'href': CV_PDF['es']}]},
            {'q': '¿Cómo contacto con él?', 'keywords': ['contacto', 'contactar', 'correo', 'email', 'escribir', 'linkedin', 'hablar'],
             'a': f'Por correo ({EMAIL}) o por LinkedIn. Los dos están al pie de esta página.',
             'actions': [{'label': 'Escribir un correo', 'href': MAIL}, {'label': 'LinkedIn', 'href': LINKEDIN}]},
            {'q': '¿Qué puedes hacer?', 'keywords': ['puedes hacer', 'capacidades', 'asistente', 'ayuda'],
             'a': 'Puedo contarte quién es Ismael, resumir su trayectoria, explicarte IsAcademy y Kimera Tools, y llevarte a su CV Online o a su contacto.'},
            {'q': '¿Puedes dar datos privados?', 'keywords': ['privados', 'confidencial', 'datos', 'secretos', 'privacidad'],
             'a': 'No. Este asistente está limitado al contenido público de esta web y no tiene acceso a datos privados, credenciales, métricas sensibles ni información confidencial de Ismael o de las empresas en las que ha trabajado.'},
        ],
    },
    'en': {
        'assistant': {
            'name': 'Alan', 'badge': 'Beta', 'subtitle': 'Local site assistant · no private data, no external models',
            'open': 'Can I help?', 'openLabel': 'Open the assistant', 'close': 'Close the assistant', 'typing': 'Alan is typing…',
            'placeholder': 'Type your question…', 'send': 'Send',
            'greeting': "Hi! I'm Alan, the local assistant of Ismael's site (beta). I only answer from the public content of this site: no private data and no external models.",
            'suggestions': ['Who is Ismael?', 'What does he do at Savana?', 'What is IsAcademy?', 'How can I contact him?'],
            'fallback': {'answer': 'I do not have an exact answer for that in this beta version. I can tell you who Ismael is, his career, IsAcademy, Kimera Tools, his CV or how to contact him.',
                         'actions': [{'label': 'View CV Online', 'href': '/cv/?lang=en'}]},
        },
        'faq': [
            {'q': 'Who is Ismael?', 'keywords': ['who', 'ismael', 'sarmiento', 'introduction', 'about'],
             'a': 'Ismael Sarmiento is Head of Data Management at Savana and founder of IsAcademy. For almost a decade he has been building data platforms: first in banking (BBVA Next Technologies, Santander Global Tech), then at StratioBD and today at Savana, where he leads Data Management in digital health. He holds the CDMP certification from DAMA International.',
             'actions': [{'label': 'View CV Online', 'href': '/cv/?lang=en'}]},
            {'q': 'What is his main focus?', 'keywords': ['focus', 'main', 'specialization', 'profile'],
             'a': 'His focus is designing and building governed, reliable data and AI platforms that help organisations make better decisions and grow with real impact, combining technical execution, architectural judgment and team leadership.'},
            {'q': 'What does he do at Savana?', 'keywords': ['savana', 'head', 'lead', 'data management'],
             'a': 'At Savana, he progressed from Senior Data Engineer to Lead Data Engineer and then to Head of Data Management, driving clinical interoperability with FHIR and OMOP, data quality platforms, metadata and cataloging through DataHub, and lifecycle control.'},
            {'q': 'What is his career path?', 'keywords': ['autana', 'bbva', 'career', 'companies', 'empresas', 'experience', 'experiencia', 'path', 'santander', 'stratio', 'stratiobd'],
             'a': 'His path goes through Autana Consultores de Tecnología, BBVA Next Technologies, Santander Global Tech, StratioBD and Savana: an evolution from software development and data platforms to leading Data Management, focused on data governance, interoperability and quality.',
             'actions': [{'label': 'View CV Online', 'href': '/cv/?lang=en'}]},
            {'q': 'What certifications does he hold?', 'keywords': ['certification', 'certifications', 'cdmp', 'dama', 'fhir', 'snomed', 'mondragon', 'degree'],
             'a': 'He holds the CDMP (Associate) certification from DAMA International (2026) and is an active member of DAMA Spain. He is also a FHIR Foundational Implementer (2025), an Expert in Data Governance and Strategic Data Management from Mondragon Unibertsitatea (2024) and holds SNOMED CT terminology fundamentals (2026).'},
            {'q': 'Does he lead teams?', 'keywords': ['lead', 'leads', 'leadership', 'leader', 'team', 'teams', 'head', 'manager', 'management'],
             'a': 'Yes. As Head of Data Management at Savana he leads the Data Management area and high-performing data teams, while staying close to architecture, solution building and product design.'},
            {'q': 'What is IsAcademy?', 'keywords': ['isacademy', 'academy', 'students', 'courses', 'founder', 'lessons'],
             'a': 'IsAcademy is the online academy for programming, data and AI that Ismael founded in 2023: tailored lessons in Python, SQL, Big Data, Data Engineering and AI for all ages. Its motto: AI gives you answers; here we teach you how to think.',
             'actions': [{'label': 'Discover IsAcademy', 'href': '/isacademy/?lang=en'}]},
            {'q': 'What is Kimera Tools?', 'keywords': ['kimera', 'tools', 'code', 'open source', 'github', 'python'],
             'a': 'Kimera Tools is his open source: kimera-python, Python utilities for ETL, SQLAlchemy and AWS S3 (2020–2022).',
             'actions': [{'label': 'View on GitHub', 'href': 'https://github.com/kimera-tools'}]},
            {'q': 'Where can I see his CV?', 'keywords': ['cv', 'resume', 'curriculum', 'pdf', 'download'],
             'a': 'His CV Online tells his career at Savana, StratioBD, Santander Global Tech and BBVA Next Technologies, in Spanish and English, and it can also be downloaded as a PDF.',
             'actions': [{'label': 'View CV Online', 'href': '/cv/?lang=en'}, {'label': 'Download PDF', 'href': CV_PDF['en']}]},
            {'q': 'How can I contact him?', 'keywords': ['contact', 'email', 'mail', 'write', 'linkedin', 'reach', 'talk'],
             'a': f'By email ({EMAIL}) or on LinkedIn. Both are at the foot of this page.',
             'actions': [{'label': 'Send an email', 'href': MAIL}, {'label': 'LinkedIn', 'href': LINKEDIN}]},
            {'q': 'What can you do?', 'keywords': ['can you do', 'capabilities', 'assistant', 'help'],
             'a': 'I can tell you who Ismael is, summarise his career, explain IsAcademy and Kimera Tools, and take you to his CV Online or his contact details.'},
            {'q': 'Can you share private data?', 'keywords': ['private data', 'confidential', 'credentials', 'sensitive', 'privacy'],
             'a': 'No. This assistant is limited to the public content of this site and has no access to private data, credentials, sensitive metrics, or confidential information from Ismael or the companies he has worked with.'},
        ],
    },
}

BOOT = "document.documentElement.classList.add('js');try{var t=localStorage.getItem('isa-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}"
MODULES = ['/assets/ds/ds.js', '/assets/ds/i18n.js', '/assets/ds/signature.js', '/assets/ds/fx.js', '/assets/ds/intro.js',
           '/assets/ds/avatar.js', '/assets/ds/assistant.js', '/assets/hub.js']
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
  <link rel="stylesheet" href="/assets/ds/intro.css?v={VERSION}">
  <link rel="stylesheet" href="/assets/ds/assistant.css?v={VERSION}">
  <link rel="stylesheet" href="/assets/hub.css?v={VERSION}">
  <script type="importmap">{IMPORT_MAP}</script>
  <script type="module" src="/assets/hub.js?v={VERSION}"></script>
</head>'''


def toggles():
    return (f'<button class="btn btn-icon lang-btn" type="button" data-action="lang" {A("aria-label", "langLabel")}>{T("langShort")}</button>'
            f'<button class="btn btn-icon theme-btn" type="button" data-action="theme" {A("aria-label", "theme")}>{MOON}{SUN}</button>')


def intro():
    """The intro shared with CV Online (/assets/ds/intro.js): the signature, the role, the slogan and two ways in."""
    return f'''<div id="intro" class="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
    <div class="intro-top">{toggles()}<button class="btn" type="button" data-action="skip">{T('intro.skip')}</button></div>
    <div class="intro-stage">
      {T('intro.title', 'p', 'sr-only', ' id="intro-title"')}
      <div class="intro-sig">{SIG}</div>
      <div class="intro-after">
        <p class="pill intro-tag">Head of Data Management</p>
        {T('lead', 'p', 'intro-hook')}
      </div>
      <div class="intro-actions">
        <button class="btn btn-primary btn-lg btn-arrow" type="button" data-action="enter">{T('intro.enter')}</button>
        <a class="btn btn-lg" {A('href', 'door.0.href')}>{T('door.0.cta')}</a>
      </div>
    </div>
  </div>'''


def topbar():
    return f'''<header class="topbar">
    <div class="container topbar-row">
      <a class="brand" href="/" {A('href', 'homeHref').replace('href="/" ', '')} aria-label="Ismael Sarmiento"><span class="brand-is" aria-hidden="true">Is</span><span class="brand-name" aria-hidden="true">mael Sarmiento</span></a>
      <div class="tools">{toggles()}</div>
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
          <a class="card door reveal" {href}>
            <span class="door-num" aria-hidden="true">0{i + 1}</span>
            <h3>{name}</h3>
            {T(f'door.{i}.text', 'p')}
            {T(f'door.{i}.cta', 'span', 'btn-link btn-arrow')}
          </a>'''
    alan_json = json.dumps(ALAN, ensure_ascii=False).replace('</', '<\\/')   # inert data for assets/hub.js
    return f'''<!doctype html>
<html lang="es">
{head(ES['meta.title'], ES['meta.description'], extra)}
<body>
  <a class="skip-link" href="#main">{T('skip')}</a>
  {intro()}
  {topbar()}

  <main id="main">
    <section class="hero">
      <svg class="circuit" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
        <path d="M600 120H430l-40 40H300"/><circle cx="300" cy="160" r="4"/>
        <path d="M600 210H470l-30 30H350"/><circle cx="350" cy="240" r="4"/>
        <path d="M600 330H500l-50-50H380"/><circle cx="380" cy="280" r="4"/>
        <path d="M600 430H440l-30 30H330"/><circle cx="330" cy="460" r="4"/>
      </svg>
      <div class="container hero-inner stagger">
        <div class="hero-text stagger">
          {T('eyebrow', 'p', 'eyebrow reveal')}
          <h1 class="hero-title reveal"><span class="sr-only">Ismael Sarmiento · </span>{T('lead')}</h1>
          {T('about.title', 'h2', 'about-title reveal')}
          {T('about.0', 'p', 'about reveal')}
          {T('about.1', 'p', 'about reveal')}
          {T('about.2', 'p', 'about reveal', rich=True)}
        </div>
        <img class="hero-photo reveal" src="/assets/brand/ismael.jpg" width="264" height="264" alt="Ismael Sarmiento" fetchpriority="high">
      </div>
    </section>

    <section class="doors" aria-labelledby="doors-title">
      <div class="container">
        {T('projects', 'h2', 'sr-only', ' id="doors-title"')}
        <div class="door-grid stagger">{doors}
        </div>
      </div>
    </section>
  </main>

  {footer()}
  <script type="application/json" id="alan-data">{alan_json}</script>
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

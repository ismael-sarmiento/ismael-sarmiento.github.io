#!/usr/bin/env python3
"""Checks the addresses of the whole universe after the move to isuniverse.dev (F5). Not published (tools/).

It reads the files each repository publishes (sibling folders of this one) and fails when:
  1. a published file still names the old origin ismael-sarmiento.github.io;
  2. a published file of the new sites links to an old path (/cv/, /isacademy/, /isgame/);
  3. a canonical, hreflang, og:url, og:image or sitemap address is not on https://isuniverse.dev/;
  4. a site-relative link (href, src, the language links of i18n files) does not resolve in the local universe;
  5. an old repository is not a redirect page to its new path.

    python3 tools/qa/urls.py
"""
import json
import pathlib
import re
import sys
from urllib.parse import urljoin, urlsplit

HUB = pathlib.Path(__file__).resolve().parents[2]
BASE = HUB.parent
SITE = 'https://isuniverse.dev'
# repository folder → served path; the old ones only redirect
NEW = {'ismael-sarmiento.github.io': '', 'profile': 'profile', 'academy': 'academy', 'game': 'game', 'business': 'business'}
OLD = {'cv': 'profile', 'isacademy': 'academy', 'isgame': 'game'}
SKIP = {  # never published (Jekyll exclude) or third-party
    'ismael-sarmiento.github.io': ('AGENTS.md', 'README.md', 'tools/'),
    'profile': ('AGENTS.md', 'README.md', 'docs/', 'tools/', 'data/', 'articles/_template/'),
    'academy': ('AGENTS.md', 'README.md', 'tools/', 'assets/brand/print/README.md', 'assets/fonts/README.md'),
    'game': ('vendor/', 'tools/', 'worker/'),
    'business': ('AGENTS.md', 'README.md', 'tools/', 'qa/'),
}
ALLOW = {  # names the old address on purpose (never a link a visitor follows)
    'ismael-sarmiento.github.io/assets/ds/views.js': 'explains that the old /isgame/ is never counted either',
    'game/AGENTS.md': 'names the portada repository and the old /isgame/ that only redirects',
}
LEGACY_PAGES = {
    'cv/index.html': '/profile/',
    'cv/index_en.html': '/profile/?lang=en',
    'isacademy/index.html': '/academy/',
    'isgame/index.html': '/game/',
    'stopbullyn/index.html': 'https://demos.isuniverse.dev/stopbullying/',
    'bussiness/index.html': '/business/',
}
TEXT = {'.html', '.js', '.css', '.json', '.xml', '.txt', '.md', '.webmanifest', '.svg'}
OLD_PATH = re.compile(r'(?<![\w.-])/(?:cv|isacademy|isgame)/')
problems, counts = [], {'files': 0, 'links': 0, 'share': 0}


def published(repo):
    root = BASE / repo
    for path in sorted(root.rglob('*')):
        rel = path.relative_to(root).as_posix()
        if path.is_file() and path.suffix in TEXT and not rel.startswith(('.git/', '.claude/', '.impeccable/', '.private/')) \
                and not rel.startswith(SKIP.get(repo, ())) and '/node_modules/' not in rel:
            yield rel, path


def resolves(url):
    path = url.split('#')[0].split('?')[0]
    if not path.startswith('/') or path.startswith('//') or path.startswith('/__'):
        return True
    first, _, rest = path[1:].partition('/')
    folder = {v: k for k, v in NEW.items() if v}.get(first)
    target = (BASE / folder / rest) if folder else (HUB / path[1:])
    if path.endswith('/') or target.is_dir():
        target = target / 'index.html'
    return target.exists()


for repo, served in NEW.items():
    for rel, path in published(repo):
        counts['files'] += 1
        text = path.read_text(encoding='utf-8', errors='replace')
        where = f'{repo}/{rel}'
        if 'ismael-sarmiento.github.io' in text and where not in ALLOW:
            problems.append(f'old origin in {where}')
        for m in ([] if where in ALLOW else OLD_PATH.finditer(text)):
            line = text.count('\n', 0, m.start()) + 1
            problems.append(f'old path {m.group(0)} in {where}:{line}')
        if path.suffix == '.html':
            for m in re.finditer(r'<link rel="(?:canonical|alternate)"[^>]*href="([^"]+)"|<meta property="og:(?:url|image)" content="([^"]+)"', text):
                url = m.group(1) or m.group(2); counts['share'] += 1
                if not url.startswith(SITE + '/') and not (repo == HUB.name and LEGACY_PAGES.get(rel) == url):
                    problems.append(f'share address off the domain in {where}: {url}')
            for m in re.finditer(r'(?:href|src)="(/[^"]*)"', text):
                counts['links'] += 1
                if not resolves(m.group(1)):
                    problems.append(f'broken link in {where}: {m.group(1)}')
            if repo == 'business':
                for href in re.findall(r'(?:href|src)="([^"]+)"', text):
                    if href.startswith(('./', '../')):
                        target = urlsplit(urljoin(f'{SITE}/business/{rel}', href))
                        counts['links'] += 1
                        if target.netloc != 'isuniverse.dev' or not target.path.startswith('/business/') or not resolves(target.path):
                            problems.append(f'broken Business relative link in {where}: {href}')
        if path.suffix == '.xml' and 'sitemap' in rel:
            for url in re.findall(r'<loc>([^<]+)</loc>|href="([^"]+)"', text):
                url = url[0] or url[1]; counts['share'] += 1
                if not url.startswith(SITE + '/'):
                    problems.append(f'sitemap address off the domain in {where}: {url}')
        if path.suffix == '.json' and rel.startswith('i18n/'):
            def walk(node, key=''):
                if isinstance(node, dict):
                    for k, v in node.items(): walk(v, k)
                elif isinstance(node, list):
                    for v in node: walk(v, key)
                elif isinstance(node, str) and node.startswith('/') and (key.lower().endswith('href') or key in ('home', 'academy', 'privacy')):
                    counts['links'] += 1
                    if not resolves(node):
                        problems.append(f'broken i18n link in {where}: {key} = {node}')
            walk(json.loads(text))

for rel, target in LEGACY_PAGES.items():
    path = HUB / rel
    if not path.is_file() or f'content="0; url={target}"' not in path.read_text(encoding='utf-8'):
        problems.append(f'{rel} is missing its compatibility redirect to {target}')

for repo, new in OLD.items():
    if not (BASE / repo / '.git').exists():
        continue  # the compatibility pages above are also checked after retirement
    for page in ('index.html', '404.html'):
        text = (BASE / repo / page).read_text(encoding='utf-8')
        if f"replace(/^\\/{repo}(?=\\/|$)/, '/{new}')" not in text or f'href="{SITE}/{new}/"' not in text:
            problems.append(f'{repo}/{page} is not a redirect to /{new}/')
    if (BASE / repo / 'sitemap.xml').exists():
        problems.append(f'{repo}/sitemap.xml still published')

print(f"{counts['files']} published files · {counts['links']} site links · {counts['share']} share and sitemap addresses · "
      f"{len(OLD)} old repositories")
for p in problems:
    print('FAIL', p)
print('OK: every address lives on isuniverse.dev' if not problems else f'{len(problems)} problems')
sys.exit(1 if problems else 0)

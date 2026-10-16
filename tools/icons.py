#!/usr/bin/env python3
"""Writes the tab icons shared by every site (Inicio, CV Online, IsAcademy): the "Is" monogram in brand gold on cream
(light theme) or on night (dark theme), as SVG and as 32 px PNG (Safari), from assets/brand/is-monogram.svg.

  assets/brand/favicon-light.svg · favicon-light-32.png
  assets/brand/favicon-dark.svg  · favicon-dark-32.png

/assets/ds/favicon.js shows the one of the theme of the page.  Usage:  python3 tools/icons.py
"""
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / 'assets/brand'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
THEMES = {'light': ('#fbf7ef', '#b58534'), 'dark': ('#0b1026', '#e2b25c')}   # paper and gold of each theme (tokens.css)

src = (BRAND / 'is-monogram.svg').read_text()
transform, d = re.search(r'<path fill="[^"]+" (transform="[^"]+") d="([^"]+)"', src).groups()
for theme, (paper, gold) in THEMES.items():
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="224" '
           f'fill="{paper}"/><path fill="{gold}" {transform} d="{d}"/></svg>\n')
    (BRAND / f'favicon-{theme}.svg').write_text(svg)
    with tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False) as tmp:
        tmp.write(svg)
    png = BRAND / f'favicon-{theme}-32.png'
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                    '--window-size=32,32', f'--screenshot={png}', f'file://{tmp.name}'], check=True, capture_output=True)
    print(f'wrote favicon-{theme}.svg and {png.name}')

#!/usr/bin/env python3
"""Writes the brand images of Ismael Sarmiento with headless Chrome, from one source (fonts, palette and the "Is"
monogram of the design system), so every picture of the universe looks the same:

  assets/brand/og.png                     1200x630   share image of Inicio (Datos · IA · Educación)
  assets/brand/social/avatar-dark.png     1024x1024  profile picture (WhatsApp, LinkedIn…): gold "Is" on night
  assets/brand/social/avatar-light.png    1024x1024  the same on cream
  assets/brand/social/linkedin-banner.png 1584x396   LinkedIn background: "Is", name and slogan (the photo covers the left)

    python3 tools/social.py
"""
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / 'assets/brand'
FONTS = (ROOT / 'assets/ds/fonts').as_uri()
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
NIGHT, CREAM, GOLD_DARK, GOLD_LIGHT, INK, MIST = '#0b1026', '#fbf7ef', '#e2b25c', '#b58534', '#1c2547', '#b9bdd3'
SLOGAN = 'Diseño y construyo plataformas de datos e IA gobernadas y confiables que ayudan a las organizaciones a decidir mejor y a crecer con impacto real.'

src = (BRAND / 'is-monogram.svg').read_text()
transform, d = re.search(r'<path fill="[^"]+" (transform="[^"]+") d="([^"]+)"', src).groups()
mono = lambda gold: f'<svg viewBox="0 0 1024 1024"><path fill="{gold}" {transform} d="{d}"/></svg>'

BASE = f'''<!doctype html><meta charset="utf-8"><style>
@font-face {{ font-family: Allura; src: url({FONTS}/allura-latin.woff2); }}
@font-face {{ font-family: "Space Grotesk"; src: url({FONTS}/space-grotesk-latin.woff2); font-weight: 300 700; }}
* {{ margin: 0; box-sizing: border-box; }} html, body {{ width: 100%; height: 100%; overflow: hidden; }}
body {{ font-family: "Space Grotesk"; -webkit-font-smoothing: antialiased; }}
.night {{ background: radial-gradient(120% 140% at 30% 20%, #1b2247 0%, {NIGHT} 60%); color: #f6f1e7; }}
.circuit {{ position: absolute; right: 0; top: 0; height: 100%; opacity: .6; }}
.circuit path {{ fill: none; stroke: {GOLD_LIGHT}; stroke-width: 1.4; }} .circuit circle {{ fill: {GOLD_LIGHT}; }}
.is {{ font-family: Allura; color: {GOLD_DARK}; }}
</style>'''
CIRCUIT = '''<svg class="circuit" viewBox="0 0 600 630" preserveAspectRatio="xMaxYMid meet"><path d="M600 160H380l-30 30H260"/><circle cx="260" cy="190" r="5"/>
<path d="M600 210H420l-30 30H320"/><circle cx="320" cy="240" r="5"/><path d="M600 440H400l-30 30H280"/><circle cx="280" cy="470" r="5"/>
<path d="M600 490H440l-30 30H350"/><circle cx="350" cy="520" r="5"/></svg>'''

PAGES = {
    'og.png': (1200, 630, f'''{BASE}<body class="night" style="position:relative;padding:150px 96px">{CIRCUIT}
<div style="position:relative;display:flex;align-items:baseline"><span class="is" style="font-size:170px;line-height:1">Is</span><span style="font-size:96px;font-weight:500;letter-spacing:-1.5px;margin-left:6px">mael Sarmiento</span></div>
<p style="position:relative;font-size:34px;font-weight:500;color:#e7e9f5;margin-top:22px">Datos · IA · Educación · Fundador de IsAcademy</p>
<div style="width:64px;height:3px;background:{GOLD_DARK};margin:30px 0 26px"></div>
<p style="position:relative;font-size:26px;color:{MIST}">CV Online &nbsp;·&nbsp; IsAcademy &nbsp;·&nbsp; Kimera Tools</p></body>'''),
    'social/avatar-dark.png': (1024, 1024, f'{BASE}<body style="background:{NIGHT};display:grid;place-items:center"><div style="width:94%">{mono(GOLD_DARK)}</div></body>'),
    'social/avatar-light.png': (1024, 1024, f'{BASE}<body style="background:{CREAM};display:grid;place-items:center"><div style="width:94%">{mono(GOLD_LIGHT)}</div></body>'),
    'social/linkedin-banner.png': (1584, 396, f'''{BASE}<body class="night" style="position:relative;display:flex;align-items:center;justify-content:flex-end;padding:0 96px 0 520px">
<svg class="circuit" style="left:0;right:auto;transform:scaleX(-1);opacity:.35" viewBox="0 0 600 630" preserveAspectRatio="xMaxYMid meet">{CIRCUIT[CIRCUIT.index('>') + 1:CIRCUIT.rindex('<')]}</svg>
<div style="position:relative;display:flex;align-items:center;gap:44px"><div style="width:190px;flex:none">{mono(GOLD_DARK)}</div>
<div><p style="font-size:44px;font-weight:500;letter-spacing:-.5px">Ismael Sarmiento</p>
<div style="width:56px;height:3px;background:{GOLD_DARK};margin:16px 0 18px"></div>
<p style="font-size:24px;line-height:1.45;color:#e7e9f5;max-width:760px">{SLOGAN}</p>
<p style="font-size:19px;color:{MIST};margin-top:16px;letter-spacing:.3px">ismael-sarmiento.github.io &nbsp;·&nbsp; CV Online &nbsp;·&nbsp; IsAcademy</p></div></div></body>'''),
}

if __name__ == '__main__':
    for name, (w, h, html) in PAGES.items():
        out = BRAND / name
        out.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as tmp:
            tmp.write(html)
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
                        '--virtual-time-budget=3000', f'--window-size={w},{h}', f'--screenshot={out}', Path(tmp.name).as_uri()],
                       check=True, capture_output=True)
        print(f'wrote {name} ({w}x{h})')

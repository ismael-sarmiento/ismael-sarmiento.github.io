# AGENTS.md — ismael-sarmiento.github.io (portada and shared design system)

## Parent

Global roots (L0):
- Claude Code: `~/.claude/CLAUDE.md`
- Codex: `~/.codex/AGENTS.md`

Sibling sites on the same origin: CV Online (`cv`, served at `/cv/`) and IsAcademy (`isacademy`, served at `/isacademy/`).

## Purpose

Entry point for agents working on the portada (`https://ismael-sarmiento.github.io/`) and on the shared design system
(`assets/ds/`) used by every site of Ismael Sarmiento. Personal project; DATM governance does not apply beyond the L0
protocols (Plan al Milímetro before each task, close-out recap after).

## Rules

- Static site for GitHub Pages; the only build step is `tools/build.py <version>`. Never edit generated files by hand
  (`index.html`, `en/index.html`, `404.html`, redirects, `robots.txt`, sitemaps).
- `assets/ds/` is shared: a change there affects the portada, CV Online and IsAcademy. Check the three sites (light and dark,
  360 px to desktop) and publish this repository first.
- Colours only through `tokens.css`; the values mirror IsAcademy's tokens.
- The theme key `isa-theme` is shared by every site on the origin; keep it.
- Every text exists in Spanish and English; Spanish is the default.
- Current position of the owner: Head of Data Management at Savana; founder of IsAcademy.
- Publishing from this machine is done through the GitHub web interface (the IT hook blocks pushes to GitHub).

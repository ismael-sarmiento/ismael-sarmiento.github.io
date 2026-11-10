# AGENTS.md — ismael-sarmiento.github.io (portada and shared design system)

## Parent

Global roots (L0):
- Claude Code: `~/.claude/CLAUDE.md`
- Codex: `~/.codex/AGENTS.md`

Sibling sites on the same origin (`https://isuniverse.dev`): IsProfile (`profile`, served at `/profile/`),
IsAcademy (`academy`, `/academy/`) and IsGame (`game`, `/game/`). The old repositories `cv`, `isacademy` and `isgame` only
redirect their old addresses (posters and QR codes point there): never delete them or their redirect pages.

## Purpose

Entry point for agents working on the portada (`https://isuniverse.dev/`, repository `ismael-sarmiento.github.io`) and on the shared design system
(`assets/ds/`) used by every site of Ismael Sarmiento. Personal project; only the global L0
protocols apply (Plan al Milímetro before each task, close-out recap after).

## Rules

- Static site for GitHub Pages; the only build step is `tools/build.py <version>`. Never edit generated files by hand
  (`index.html`, `en/index.html`, `404.html`, redirects, `robots.txt`, sitemaps).
- `assets/ds/` is shared: a change there affects the portada, IsProfile, IsAcademy and IsGame; IsPanel also consumes shared resources. Check affected consumers (light and dark, 360 px to desktop) and publish this repository first. IsBusiness keeps its own identity-stripped copy without the counter; review applicable fixes there as well.
- Colours only through `tokens.css`; IsAcademy loads it too and adds only its own console and opening colours.
- The theme key `isa-theme` is shared by every site on the origin; keep it.
- Every text exists in Spanish and English; Spanish is the default.
- Current position of the owner: Head of Data Management at Savana; founder of IsAcademy.
- Publishing from this machine is done through the GitHub web interface (the IT hook blocks pushes to GitHub).
- Domain `isuniverse.dev` (DNS, email routing, GitHub Pages custom domain, Turnstile hostnames, Worker origins): read
  and follow the local runbook `../docs/dominio/DOMINIO-ISUNIVERSE.md` before any change. It lives outside this
  public repository on purpose.

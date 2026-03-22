# ismael-sarmiento.github.io Architecture

## Purpose

This repository hosts Ismael Sarmiento's official personal website and online CV.

The architecture is intentionally simple:

- static HTML entry points
- shared CSS and JavaScript assets
- no backend
- no build step
- GitHub Pages compatible

## Public Routes

- `/`
  Main Spanish CV page served by `index.html`
- `/index_en.html`
  Main English CV page
- `/articles/`
  Spanish article index placeholder
- `/articles/index_en.html`
  English article index placeholder

Future articles follow:

- `articles/<slug>/index.html`
- `articles/<slug>/index_en.html`

## Main Layers

- `index.html` and `index_en.html`
  Static SEO shells with indexable content and shared asset loading.
- `assets/content.js`
  Bilingual structured content for the interactive CV experience.
- `assets/app.js`
  Rendering, language switching, theme, loader, assistant, and audio logic.
- `assets/app.css`
  Visual system and responsive styling for the CV UI.
- `assets/print.css`
  Print-oriented stylesheet.
- `articles/`
  Standalone static article pages and article index placeholders.

## Content Model

### CV Pages

The CV experience is rendered from a centralized content object in `assets/content.js`, while the main HTML pages keep enough static content to remain indexable without JavaScript.

### Article Pages

Articles are deliberately separate from the CV renderer:

- each article is a standalone static HTML page
- each article has ES and EN versions from day one
- article metadata is also registered in `articles/manifest.json`

This avoids overloading `assets/content.js` with long-form editorial content and keeps article SEO straightforward.

## Documentation Convention

- Root onboarding: `README.md`
- Agent entry point: `AGENTS.md`
- Product and continuity source of truth: `PROJECT_CONTEXT.md`
- Technical overview: `docs/ARCHITECTURE.md`
- Deferred work: `docs/TODO.md`
- Article workflow: `docs/ARTICLES.md`

## Analytics

The chosen analytics baseline is `Cloudflare Web Analytics`.

For the current GitHub Pages deployment model:

- setup is manual from the Cloudflare dashboard
- Cloudflare provides the beacon snippet
- the real token must be inserted into each public HTML page when activation happens

If the site later moves to Cloudflare Pages or a proxied Cloudflare hostname, the setup can be simplified through automatic injection.

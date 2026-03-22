# AGENTS.md

## Purpose

This file is the repo-specific entry point for future agents working on `ismael-sarmiento.github.io`.

The project keeps its governance local. Do not assume any centralized DATM governance applies here beyond reusable patterns.

## Source Of Truth

- Product, narrative, positioning, and continuity source of truth: `PROJECT_CONTEXT.md`
- Human/repo onboarding: `README.md`
- Technical map: `docs/ARCHITECTURE.md`
- Deferred work: `docs/TODO.md`
- Article workflow: `docs/ARTICLES.md`

## Mandatory Read Order

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ARTICLES.md`
5. `docs/TODO.md`

If the task is substantial, pay special attention in `PROJECT_CONTEXT.md` to:

- sections `0.2` and `0.3`
- section `2`
- section `3`
- section `5`
- sections `18` to `22`

## Repo Rules

- Keep the project as a static site compatible with GitHub Pages unless there is a strong, explicit reason to change that.
- Do not introduce a backend, framework migration, or build step by default.
- Keep all relevant governance and continuity docs inside this repository.
- Treat `PROJECT_CONTEXT.md` as authoritative. Do not reopen closed decisions without a strong reason.
- Any important change affecting product, tone, naming, SEO, structure, article workflow, or analytics must update:
  - the stable layer in `PROJECT_CONTEXT.md`
  - the dated traceability log in `PROJECT_CONTEXT.md`
- If you add or modify public pages, update:
  - `sitemap.xml`
  - canonical and hreflang metadata where applicable
- Public article pages are bilingual from day one:
  - Spanish: `articles/<slug>/index.html`
  - English: `articles/<slug>/index_en.html`
- An article may be published before its LinkedIn post exists. In that case, keep the article live and leave the LinkedIn reference empty until it is available.

## Article Workflow

When creating a new article:

1. Copy the files from `articles/_template/`.
2. Create both language versions in `articles/<slug>/`.
3. Fill the metadata and body content directly in the HTML pages.
4. Register the article in `articles/manifest.json`.
5. Update `sitemap.xml`.
6. If the article is later exposed in navigation or listings, keep ES/EN parity.

## Analytics Decision

- Selected default: `Cloudflare Web Analytics`
- Current repo constraint: this site is still designed for GitHub Pages, so Cloudflare Web Analytics requires manual setup with the Cloudflare beacon snippet unless the site later moves behind Cloudflare Pages or a proxied Cloudflare hostname.
- Do not commit fake placeholder tokens. Use the real token obtained from Cloudflare when available.

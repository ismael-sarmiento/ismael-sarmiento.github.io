# Articles Workflow

## Purpose

This document defines the minimal article system for this repository.

The goal is to publish professional articles without introducing a backend or a framework migration.

## Chosen Pattern

The repository uses a hybrid model:

- standalone HTML pages for each article
- a lightweight `articles/manifest.json` as registry

Why this pattern:

- strong SEO with static pages
- simple GitHub Pages deployment
- low maintenance for humans and agents
- reusable structure for future personal sites

## Directory Structure

```text
articles/
  manifest.json
  index.html
  index_en.html
  _template/
    index.html
    index_en.html
  <slug>/
    index.html
    index_en.html
```

## URL Rules

- Spanish article URL: `articles/<slug>/`
- English article URL: `articles/<slug>/index_en.html`

Use short, stable, lowercase slugs separated by hyphens.

## Bilingual Rule

Articles are bilingual from day one.

This means every published article must ship with:

- `index.html`
- `index_en.html`

Do not publish only one language version as the final state.

## LinkedIn Rule

Relationship target:

- one article
- one primary LinkedIn post

However, the article may be published first. If the LinkedIn post does not exist yet:

- publish the article anyway
- leave `linkedin_url` empty in the manifest
- add the LinkedIn reference later

## Manifest Shape

`articles/manifest.json` is the registry for published articles.

Recommended shape for each entry:

```json
{
  "slug": "example-article",
  "published_at": "2026-03-22",
  "updated_at": "2026-03-22",
  "status": "published",
  "linkedin_url": null,
  "tags": ["data-governance", "interoperability"],
  "es": {
    "title": "Titulo del articulo",
    "summary": "Resumen corto del articulo.",
    "path": "/articles/example-article/"
  },
  "en": {
    "title": "Article title",
    "summary": "Short article summary.",
    "path": "/articles/example-article/index_en.html"
  }
}
```

## Publish Workflow

1. Copy both files from `articles/_template/` into `articles/<slug>/`.
2. Fill the metadata, canonical URLs, hreflang links, and article body in both languages.
3. Add the article entry to `articles/manifest.json`.
4. Update `sitemap.xml`.
5. If the LinkedIn post exists, add the URL in the manifest and in the article page. If not, leave it empty and backfill later.
6. Add a dated traceability entry in `PROJECT_CONTEXT.md` if the article system itself changes materially.

## What Not To Do

- Do not move articles into `assets/content.js`.
- Do not add Markdown rendering infrastructure by default.
- Do not introduce a CMS or backend for this use case.
- Do not expose article navigation in the main CV until there is real published content.

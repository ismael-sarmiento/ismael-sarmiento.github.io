# Ismael Sarmiento | CV

Web CV estática, bilingüe y preparada para GitHub Pages.

La página está pensada para comunicar un perfil de ingeniería de datos con foco en gobierno del dato, interoperabilidad clínica, calidad end-to-end y plataformas confiables. La arquitectura es deliberadamente simple: HTML estático, assets compartidos y sin backend.

## Qué incluye

- versión principal en español en `/`
- versión inglesa indexable en `/index_en.html`
- modo oscuro y claro
- loader inicial con hitos de impacto
- resumen ejecutivo y narrativa profesional
- asistente local beta sin modelos externos
- resumen en audio en español e inglés
- SEO técnico básico para Google y redes sociales

## Estructura

```text
AGENTS.md
docs/
  ARCHITECTURE.md
  ARTICLES.md
  TODO.md
index.html
index_en.html
robots.txt
sitemap.xml
articles/
  manifest.json
  index.html
  index_en.html
  _template/
    index.html
    index_en.html
assets/
  app.css
  app.js
  content.js
  print.css
  favicon.svg
  og-card.svg
  audio/
    resumen-es.wav
    summary-en.m4a
    summary-en.wav
PROJECT_CONTEXT.md
```

## Cómo funciona

- `index.html` sirve la entrada principal en español.
- `index_en.html` sirve la entrada inglesa real, sin redirect.
- `assets/content.js` centraliza el contenido ES/EN.
- `assets/app.js` renderiza la experiencia, el cambio de idioma, el asistente y el audio.
- `assets/app.css` contiene la identidad visual, responsive y motion.
- `assets/print.css` mantiene la base para impresión si más adelante se recupera un flujo PDF serio.
- `articles/` aloja la base para artículos profesionales bilingües como páginas estáticas independientes.

## Audio

El asistente ofrece dos resúmenes:

- `Resumen ES`
- `Summary EN`

La web intenta reproducir primero los audios estáticos:

- `assets/audio/resumen-es.wav`
- `assets/audio/summary-en.m4a`
- `assets/audio/summary-en.wav`

Si un audio no existe, el formato no es compatible o la reproducción falla, hace fallback al TTS del navegador.

## SEO técnico

El sitio incluye:

- `canonical` por idioma
- `hreflang` cruzado y `x-default`
- `robots.txt`
- `sitemap.xml`
- `Open Graph`
- `Twitter cards`
- `JSON-LD` con `ProfilePage` + `Person`

Esto es compatible con GitHub Pages porque todo es estático.

## Despliegue

Este repositorio está pensado para desplegarse directamente en GitHub Pages como sitio de usuario:

- repositorio: `ismael-sarmiento.github.io`
- rama de publicación: `main`
- raíz del repositorio como fuente

No hay build step ni backend. Tras hacer `push`, GitHub Pages debería publicar automáticamente el contenido de la rama.

## Analítica

La opción elegida como base es `Cloudflare Web Analytics`.

Encaje actual:

- compatible con una web estática
- sin backend
- sin cambio de stack
- reusable para varias webs

Mientras el sitio siga en GitHub Pages y no esté detrás de Cloudflare Pages o de un hostname proxied por Cloudflare, la activación requiere:

- crear el sitio en el panel de Cloudflare Web Analytics
- copiar el beacon snippet real
- insertarlo en las páginas HTML públicas

En esta iteración el beacon real ya quedó insertado en las páginas públicas actuales y en las plantillas de artículos. Queda pendiente desplegar y comprobar que Cloudflare empieza a recibir tráfico.

## Mantenimiento

Para editar contenido:

- copy, narrativa, enlaces, etiquetas y FAQs: `assets/content.js`
- comportamiento, idioma, audio y asistente: `assets/app.js`
- diseño y responsive: `assets/app.css`

Para SEO:

- metadatos base: `index.html`, `index_en.html`
- descubrimiento: `robots.txt`, `sitemap.xml`

## Documentación del proyecto

`README.md` queda como entrada rápida para humanos y mantenimiento del repo.

El documento maestro para continuidad de producto, decisiones y contexto es `PROJECT_CONTEXT.md`.

`AGENTS.md` sirve como entrada corta para futuros agentes.

`docs/ARCHITECTURE.md`, `docs/ARTICLES.md` y `docs/TODO.md` contienen el mapa técnico mínimo, el patrón editorial y el backlog diferido.

## Fuente maestra para LLMs

El documento [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) resume:

- decisiones de producto y diseño
- posicionamiento profesional
- carrera detallada
- estado técnico
- backlog futuro
- instrucciones para continuar el trabajo o preparar entrevistas simuladas

## Próximos pasos recomendados

- validar visualmente en móvil real y desktop tras el despliegue
- dar de alta `sitemap.xml` en Google Search Console
- comprobar en Cloudflare que el tráfico empieza a registrarse tras el despliegue
- crear una exportación PDF robusta con Playwright o Puppeteer
- refinar la `og:image` si se quiere una capa más editorial

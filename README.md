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
index.html
index_en.html
robots.txt
sitemap.xml
assets/
  app.css
  app.js
  content.js
  print.css
  favicon.svg
  og-card.svg
  audio/
    resumen-es.wav
    summary-en.wav
personal-cv-llm-brief.md
```

## Cómo funciona

- `index.html` sirve la entrada principal en español.
- `index_en.html` sirve la entrada inglesa real, sin redirect.
- `assets/content.js` centraliza el contenido ES/EN.
- `assets/app.js` renderiza la experiencia, el cambio de idioma, el asistente y el audio.
- `assets/app.css` contiene la identidad visual, responsive y motion.
- `assets/print.css` mantiene la base para impresión si más adelante se recupera un flujo PDF serio.

## Audio

El asistente ofrece dos resúmenes:

- `Resumen ES`
- `Summary EN`

La web intenta reproducir primero los audios estáticos:

- `assets/audio/resumen-es.wav`
- `assets/audio/summary-en.wav`

Si un audio no existe o falla, hace fallback al TTS del navegador.

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

## Mantenimiento

Para editar contenido:

- copy, narrativa, enlaces, etiquetas y FAQs: `assets/content.js`
- comportamiento, idioma, audio y asistente: `assets/app.js`
- diseño y responsive: `assets/app.css`

Para SEO:

- metadatos base: `index.html`, `index_en.html`
- descubrimiento: `robots.txt`, `sitemap.xml`

## Fuente maestra para LLMs

El documento [personal-cv-llm-brief.md](./personal-cv-llm-brief.md) resume:

- decisiones de producto y diseño
- posicionamiento profesional
- carrera detallada
- estado técnico
- backlog futuro
- instrucciones para continuar el trabajo o preparar entrevistas simuladas

## Próximos pasos recomendados

- validar visualmente en móvil real y desktop tras el despliegue
- dar de alta `sitemap.xml` en Google Search Console
- crear una exportación PDF robusta con Playwright o Puppeteer
- refinar la `og:image` si se quiere una capa más editorial

# Ismael Sarmiento · Portada

> *Home page of Ismael Sarmiento and the shared design system of his sites. Spanish and English.*

Portada de **Ismael Sarmiento**, Head of Data Management en Savana y fundador de IsAcademy: quién es y tres puertas,
**CV Online**, **IsAcademy** y **Kimera Tools**. Este repositorio es además el dueño del **sistema de diseño compartido**
por todas sus webs.

- **Web:** https://ismael-sarmiento.github.io/ (español) · [versión en inglés](https://ismael-sarmiento.github.io/?lang=en)
- **Hosting:** GitHub Pages (sitio de usuario: publica la raíz del dominio).

## El universo de webs

| Dirección | Repositorio | Qué es |
|---|---|---|
| `/` (inglés: `?lang=en`) | `ismael-sarmiento.github.io` (este) | Portada y sistema de diseño compartido |
| `/cv/` (inglés: `?lang=en`) | [`cv`](https://github.com/ismael-sarmiento/cv) | CV Online |
| `/isacademy/` | [`isacademy`](https://github.com/ismael-sarmiento/isacademy) | IsAcademy, academia online |
| github.com/kimera-tools | [Kimera Tools](https://github.com/kimera-tools) | Código abierto |

## Sistema de diseño compartido (`assets/ds/`)

| Fichero | Qué aporta |
|---|---|
| `tokens.css` | Colores (tinta, oro, crema), tipografías, radios, sombras y movimiento, con tema claro y oscuro |
| `base.css` | Base, botones, tarjetas, chips, barra superior con la firma «Is», secciones, pie y animaciones |
| `ds.js` | Tema compartido entre webs, aparición al hacer scroll, barra superior y luz que sigue al puntero |
| `i18n.js` | Idiomas: un solo botón ES/EN, `?lang=en` en la URL y la elección compartida entre webs |
| `signature.js` | La firma: «Is» manuscrita esbozada y el resto del nombre decodificado al estilo IA |
| `intro.js`, `intro.css` | La intro común (Inicio y CV Online): firma, papel, eslogan y botones; al entrar, la «Is» vuela al sello dejando tinta dorada y el nombre se deshace en píxeles. La misma escala que el logo de IsAcademy |
| `fx.js` | Efectos de partículas (tinta, píxeles, destellos) compartidos con IsAcademy |
| `favicon.js` | El icono de la pestaña sigue el tema de la página en las tres webs (iconos en `assets/brand/favicon-{light,dark}`, generados con `tools/icons.py`) |
| `avatar.js`, `assistant.js`, `assistant.css` | Alan, el asistente local compartido (cada web le da su propio contenido) |
| `fonts/` | Space Grotesk y Allura, servidas desde el propio dominio |

Las tres webs viven en el mismo dominio, así que cargan estos ficheros con rutas absolutas (`/assets/ds/…`).
Un cambio de marca se hace aquí una sola vez.

## Estructura

```
index.html, i18n/           Portada en español con claves de traducción y sus diccionarios (generados)
404.html                    Página no encontrada (generada)
index_en.html, articles/    Redirecciones de las direcciones antiguas del CV a /cv/ (generadas)
robots.txt, sitemap*.xml    Buscadores: índice de sitemaps de la portada, /cv/ e /isacademy/ (generados)
assets/ds/                  Sistema de diseño compartido
assets/hub.css, hub.js      Estilo y comportamiento de la portada
assets/brand/               Favicons, foto, og.png (imagen al compartir)
tools/build.py              Genera todo lo anterior desde una plantilla con los textos ES/EN
tools/brand/og.swift        Genera las imágenes al compartir (macOS, sin dependencias)
```

## Desarrollo local

```bash
python3 tools/build.py 20261014a   # la versión evita mezclas de caché en el navegador
```

Para probar el universo completo, sirve una carpeta con este repositorio en la raíz, `cv/` y `isacademy/`.

## Despliegue

GitHub Pages publica la rama `main` desde la raíz en cada cambio. Publica primero los cambios de `assets/ds/`,
porque el CV y la academia dependen de ellos.

© Ismael Sarmiento. Todos los derechos reservados.

# IsPanel v2.2 — contratos y operación

**Estado documental al 26/10/2026 — D20 aprobado:**

- **Última publicación acreditada: 20/10/2026, versión estática `20261020a`.** El registro maestro contiene su cierre posterior al estado intermedio conservado abajo.
- **Código local posterior:** D01–D19 aprobados y comprobados en local; incluye acceso D1 de D17, cierre de D18 y formularios de D19. Estos cambios y la migración `0004` no se han publicado ni aplicado remotamente durante esta revisión. La aceptación visual global y la preparación de la siguiente publicación siguen pendientes.
- **Estado remoto actual:** no se ha vuelto a consultar la cuenta ni se han revalidado sus bindings, flags, versiones, cron o correo en esta auditoría. Lo acreditado el 20/10 no equivale a una comprobación del 26/10.

## Registro de publicación · 2026-10-20

### Estado intermedio histórico, superado por el cierre siguiente

- Base `isa-panel-private`, ID `de14e84d-a0d8-4fa0-881a-a33114ba1cc6`, jurisdicción **Unión Europea**, región mostrada Eastern Europe. Time Travel confirmado en el panel de Cloudflare: **7 días**.
- Migraciones `0001` → `0002` → `0003` ejecutadas correctamente; `sqlite_master` confirma `contacts`, `traffic_events`, `panel_link_tokens` y `panel_reports`.
- Conexiones `CONTACTS_DB` autorizadas expresamente por el propietario para ambos Workers; las vistas previas se separan de la base de producción.
- Punto de reversión inicial: `isa-panel` versión `bf297b59`, `isa-forms` versión `9108921d`. Copias de código completas conservadas fuera del repositorio, sin extraer secretos.
- Código nuevo de `isa-forms`: versión de código `b43eb363`, cotejado con el archivo local antes de publicar. Las modificaciones posteriores de bindings generan sus propias versiones; verificar la versión final activa al cerrar el despliegue.
- Suite de publicación: **73/73** contratos locales y ocho comprobaciones de sintaxis, además de diff de los tres repositorios. La red está sustituida en los contratos.
- Versión estática preparada: `20261020a`. Avisos ES/EN de conservación y resultado guardado/notificación incierta; HTML de IsAcademy obtenido mediante Chrome/CUA y las funciones de su prerender, sin iniciar un navegador alternativo.
- Pendiente en aquel punto intermedio: versión final de ambos Workers, publicación de los tres repositorios, activación, cron, acceso privado y pruebas reales de formularios/informe. Evidencias en `/private/tmp/ispanel-produccion-2026-10-20/`; se copiarán a Descargas al terminar.

### Cierre acreditado del 20/10/2026

Fuente: registro maestro local `../../../AUDITORIA-UNIVERSO.md`, sección «IsPanel · producción 20261020a publicada y probada (2026-10-20)», que sustituye el estado intermedio anterior. Entrega original: `~/Downloads/IsPanel-produccion-2026-10-20/ESTADO-PUBLICACION.md`.

- GitHub Pages: portada `34304423afe89d0a382d543288a1f83efe4fa185`, CV `485d7c6229e6c1706189ca26f57f31751df04b00` e IsAcademy `877aee053d8d0e45a2d9d4cd2efe6bd1609f0fe2`, publicados por GitHub web/Codespaces.
- Workers: código cotejado del panel `a0f123ea` y formularios `b43eb363`; versiones finales con configuración `add3809b` / `cfd42e78`, respectivamente. Constaban 100 % Ready aquel día. Los puntos de reversión iniciales del registro histórico no son un plan de reversión del código D17.
- Ambos bindings `CONTACTS_DB` y captura de contactos/tráfico activos; informes activos en el panel. Migraciones `0001`–`0003`, jurisdicción UE y Time Travel de siete días comprobados. Previews separados de la base privada.
- Cron guardado y comprobado tras recargar: limpieza diaria `15 2 * * *` y candidatos semanales `0 8 * * MON` / `0 9 * * MON`, con filtro de las 09:00 de Canarias y deduplicación en código.
- Validación registrada: 37/37 comprobaciones HTTPS, 73/73 contratos locales y 16 estados visuales del panel online. Dos formularios ficticios autorizados guardados y recibidos en Gmail, informe manual recibido y acceso por enlace con segundo uso rechazado. El registro acredita la revisión del HTML en Gmail aquel día; Outlook no se verificó.
- Límites que continúan abiertos: primera ejecución semanal y purga física no observadas en esta revisión; incidencia intermitente de Turnstile del login sin causa o solución acreditadas. No se ha creado vigilancia automática. La cuenta, el buzón y la configuración remota no se han revisitado para D20.

## Componentes

| Componente | Función |
| --- | --- |
| `isa-panel.js` | Acceso privado, métricas agregadas, bandeja y cambios de estado. |
| `isa-forms.js` | Validación, Turnstile, almacenamiento previo al correo y notificación mediante Resend. |
| `migrations/0001_contacts.sql` | Tabla privada e índices de contactos. |
| `migrations/0002_panel_activity.sql` | Señales detalladas de tráfico y huellas de acceso de un uso. |
| `migrations/0003_panel_reports.sql` | Metadatos de intentos de informe y deduplicación, durante 30 días. |
| `migrations/0004_panel_auth.sql` | Época autoritativa de sesión y reserva de acceso; preparada solo en local por D17. |
| `assets/ds/views.js` | Señal única de página, procedencia e idioma; respeta DNT y GPC. |
| `qa/contacts.test.mjs` | Contratos locales con SQLite real y red sustituida. |
| `qa/preview.mjs` | Vista local con datos ficticios y escenarios de revisión. |

Los sitios estáticos siguen en GitHub Pages. Los dos Workers se publican mediante el editor de Cloudflare; un commit o el despliegue de Pages no publica automáticamente estos Workers.

## Activación y bindings

`CONTACTS_ENABLED` debe valer exactamente `"true"` para activar la nueva bandeja en `isa-panel` y la captura en `isa-forms`. Ausente o con cualquier otro valor, la captura permanece desactivada y los formularios conservan su ruta de correo anterior. Esta implementación local no modifica las variables de producción.

| Worker | Binding/variable | Uso |
| --- | --- | --- |
| Ambos | `CONTACTS_DB` | La misma base D1 privada. |
| Ambos | `CONTACTS_ENABLED` | Activación explícita de su respectiva funcionalidad. |
| Ambos | `TRAFFIC_ENABLED` | La cadena `"true"` activa captura/lectura privada de señales detalladas. |
| `isa-panel` | `REPORTS_ENABLED` | La cadena `"true"` habilita envío manual y semanal; ausente, no envía informes. |
| `isa-panel` | `PANEL_KV` | Caché agregada e historial de accesos; binding requerido, sin época ni bloqueo de login. |
| `isa-panel` | `PANEL_SECRET` | Firma de enlaces y cookies. |
| `isa-panel` | `CONTACTS_DB` | Estado autoritativo de acceso, con0004 y withSession, independiente de los flags de captura. |
| `isa-panel` | `ACCOUNT_ID`, `SITE_TAG`, `CF_API_TOKEN` | Lectura de Web Analytics y Analytics Engine. |
| `isa-panel` | `PANEL_EMAIL`, `TURNSTILE_SECRET`, `RESEND_API_KEY` | Acceso por correo y desafío. |
| `isa-forms` | `FORM_TO`, `ALLOWED_ORIGIN`, `ALLOWED_HOSTS` | Destinatario y procedencias permitidas. |
| `isa-forms` | `TURNSTILE_SECRET`, `RESEND_API_KEY` | Validación y notificaciones. |
| `isa-forms` | `FORM_EVENTS`, `SITE_VIEWS` | Resultados agregados y ubicación aproximada de visitas. |

No incluir valores secretos en este documento, capturas, comandos de entrega ni Git. La base se ha creado y comprobado con jurisdicción **UE**: una preferencia de ubicación `weur` no sustituye a la jurisdicción `eu`. La restricción se fija al crear D1 y solo afecta a la ejecución/almacenamiento de la propia base; no regionaliza todo el procesamiento de Workers o correo. [Ubicación de datos de D1](https://developers.cloudflare.com/d1/configuration/data-location/).

## Datos de la bandeja

Todos los tiempos de la tabla son enteros Unix en **milisegundos**.

| Campos | Contenido |
| --- | --- |
| `id`, `request_key` | UUID de contacto y huella interna de deduplicación; la API no expone la huella. |
| `created_at`, `expires_at`, `updated_at` | Alta, caducidad exacta a 90 días y última modificación. |
| `site`, `page`, `language` | `inicio` / `cv` / `isacademy`, página de origen permitida sin parámetros ni fragmento, `es` / `en`. La página es un dato declarado por el formulario, no una prueba de identidad. |
| `name`, `email`, `phone`, `company`, `message` | Solo los datos facilitados; teléfono y empresa son opcionales. Límites: 80, 120, 30, 120 y 2000 caracteres, respectivamente. |
| `details_json` | `summary`, `subject`; en IsAcademy, también `interest` y `level`. |
| `context_json` | Contexto disponible y validado de Cloudflare, IP y familias de navegador/sistema. La lista completa se describe en Tráfico detallado; puede faltar información. |
| `status` | `new`, `following`, `resolved`, `archived`. Archivar no amplía la retención. |
| `notification_status`, `provider_id` | `pending`, `accepted`, `failed`, `unknown`, e identificador de Resend cuando existe. |

La bandeja v2.1 conserva la IP validada de CF-Connecting-IP y el contexto de Cloudflare disponible durante los 90 días de la ficha. No conserva el token Turnstile, la cabecera User-Agent completa ni campos desconocidos. La IP también puede enviarse a Turnstile para verificar el desafío. La ubicación es aproximada y no verifica el domicilio ni la identidad de quien escribe. Las coordenadas de D1 se limitan a seis decimales para acotar el formato; esa precisión numérica no acredita precisión geográfica. Analytics Engine conserva únicamente coordenadas redondeadas a 0,1°.

## Almacenamiento y correo

En la ficha, responder por correo abre el cliente configurado; llamar aparece solo cuando hay teléfono facilitado. No se envía correo ni se inicia una llamada desde el servidor del panel, y abrir estos enlaces no marca la solicitud como atendida. El cambio de estado sigue siendo una acción explícita.

Con captura activada, se normalizan los campos y se verifica Turnstile antes de guardar. La escritura usa una transacción D1 con huella única: **el mismo contenido normalizado durante 15 minutos genera un solo contacto y un solo intento de notificación**. La huella excluye tokens, instante y contexto de red. Tras esa ventana, un envío idéntico puede abrir un contacto nuevo.

Se guarda antes de solicitar el correo. Un fallo de D1 devuelve error y no anuncia que se haya guardado. Una solicitud guardada permanece accesible aunque falle Resend. Si la conexión con Resend falla después de que pudiera haber aceptado la petición, el estado es `unknown`; no se reenvía automáticamente. Cada petición usa una clave de idempotencia derivada del UUID.

`accepted` significa que el proveedor aceptó la solicitud, **no** que el correo llegó a la bandeja de destino. Esta versión no incorpora webhooks de entrega ni una cola de reintentos. Un reenvío idéntico durante la ventana no reintenta una notificación fallida.

### Plazos y resultados del código local aprobado · D15/D16/D19

| Operación | Plazo propio | Alcance |
| --- | --- | --- |
| Cargar el script de Turnstile en el navegador | 10 s | D16: cancela la carga fallida y permite recuperación manual; éxito compartido. |
| Verificar Turnstile en `isa-forms` | 8 s | D15: cabeceras y lectura JSON; rechazo antes de guardar o enviar. |
| POST del formulario desde el navegador | 30 s | D19: desde el intento de POST hasta leer JSON. No limita todo el preflight o carga de diccionarios. |
| Solicitar correo de contacto o correo legado | 10 s | D19: cabeceras y JSON de Resend; el aviso de contactos ya tenía este plazo. |

Una respuesta HTTP correcta con `success` verdadero confirma recepción y limpia el formulario; si `stored` es verdadero, el contacto se confirma aunque su correo quede `failed` o `unknown`. Una excepción posterior del refresco visual no convierte esa recepción en fallo de entrega. Rechazos explícitos anteriores a la entrega mantienen el error existente. Transporte interrumpido, plazo agotado, JSON inválido o respuesta ambigua muestran un aviso de recepción incierta y conservan borrador y consentimiento en el DOM actual; no se persisten borradores ni se reenvía automáticamente. Cambiar de idioma traduce el estado existente sin enviar otra solicitud.

Resend solo se considera `accepted` tras una respuesta correcta con ID válido (1–128 caracteres de letras ASCII, cifras, guion o guion bajo). Un rechazo 4xx salvo 408 se clasifica `failed`; transporte, 408, 5xx, JSON inválido o ID ausente/inválido quedan `unknown`. Esto no reescribe estados históricos. En el flujo legado, sin bandeja, el rechazo explícito devuelve `502/mail_rejected`; incertidumbre devuelve `503/mail_unknown`. No incorpora deduplicación duradera ni reenvío automático en ese flujo anterior. Las etiquetas históricas `mail_error` se presentan como incidencia, sin afirmar que el proveedor lo rechazara con certeza.

Una operación lenta puede terminar después del plazo del navegador o perder su respuesta tras ser aceptada por el proveedor; el aviso de incertidumbre no afirma pérdida. El bloque final de versiones/build coordinará biblioteca, adaptadores y diccionarios generados del CV; no se editan esos generados a mano ni se presupone una actualización simultánea entre repositorios.

Respuesta de formulario cuando queda guardado:

```json
{"success":"true","message":"stored","stored":true,"notification":"accepted"}
```

Un duplicado añade `"duplicate": true`. Las respuestas conservan los valores de `success` como cadenas por compatibilidad con los formularios actuales.

## API privada

Las rutas se autentican antes de comprobar flags o consultar fichas. La autorización requiere PANEL_SECRET, PANEL_KV y CONTACTS_DB con withSession: falta de binding, esquema0004, fila de estado o lectura de época válida devuelve `503 session_unavailable`. La época se consulta en D1, sin valor por defecto ni fallback KV. Una falta de disponibilidad del estado impide leer o cambiar datos privados. Todas las respuestas privadas llevan `Cache-Control: no-store`. No se habilita CORS en el panel. La cookie conserva los atributos `HttpOnly; Secure; SameSite=Lax`. El acceso v2.1 usa enlaces con nonce y consumo atómico en D1, descritos en Acceso; ya no usa KV como control de un uso.

### Listado y resumen

`GET /api/contacts`

| Parámetro | Valores |
| --- | --- |
| `site` | `all` (por defecto), `inicio`, `cv`, `isacademy`. |
| `status` | `all` (por defecto), `new`, `following`, `resolved`, `archived`. |
| `q` | Fragmento literal de hasta 200 caracteres en nombre, email, teléfono, empresa o mensaje. No interpreta `%` ni `_` como comodines. |
| `days` | Entero de 1 a 90; por defecto 90. |
| `limit` | Entero de 1 a 50; por defecto 25. |
| `cursor` | Cursor opaco recibido en `nextCursor`. Orden estable por `created_at DESC, id DESC`. |
| `summary` | `1` devuelve únicamente el resumen y `items: []`. |

```json
{
  "items": [],
  "nextCursor": null,
  "summary": {
    "total": 0, "new": 0, "following": 0, "resolved": 0, "archived": 0,
    "oldestPendingAt": null,
    "sites": {"inicio": 0, "cv": 0, "isacademy": 0},
    "notificationFailed": 0
  },
  "enabled": true,
  "retentionDays": 90
}
```

El resumen cuenta todos los resultados que coinciden con los filtros, antes de paginar. `oldestPendingAt` es el instante del contacto más antiguo en `new` o `following`, o `null`. Los filtros de estado también afectan al resumen. `notificationFailed` cuenta solo fallos conocidos, no estados desconocidos.

Los elementos usan nombres de columna `snake_case`, salvo que `details_json` y `context_json` se devuelven como objetos `details` y `context`. No se devuelve `request_key`. La búsqueda usa `instr`, ya que D1 limita los patrones `LIKE`/`GLOB` a 50 bytes. [Límites de D1](https://developers.cloudflare.com/d1/platform/limits/).

### Detalle y estado

`GET /api/contacts/:id` devuelve `{ "item": {...}, "enabled": true, "retentionDays": 90 }`.

`PATCH /api/contacts/:id` acepta exactamente un campo:

```json
{"status":"following"}
```

Exige sesión, `Origin` idéntico al origen del panel, `Content-Type: application/json`, cuerpo de hasta 1024 bytes y un estado permitido. Devuelve el contacto actualizado. No existe una operación de borrado manual en esta API.

Errores: `401` sin sesión válida; `403` por origen de escritura; `400` por filtros/cuerpo/estado; `404` para un contacto inexistente o caducado; `405` por método; `413` por tamaño; `415` por tipo de contenido. `503 session_unavailable` impide el acceso si faltan los bindings de acceso o falla el estado D1; `503 contacts_disabled` indica desactivación una vez autenticado; `503 contacts_unavailable`, fallo de consulta de datos después de autorizar. Los errores no incluyen datos personales, parámetros SQL ni mensajes internos del proveedor.

### Métricas

`GET /api/data?days=30&site=all&fresh=1` mantiene el contrato de gráficos y añade:

- `sourceHealth.visits`, `.forms`, `.cities`: `status` = `ok`, `empty`, `error` o `stale`, con fecha de origen y mensaje cuando corresponde.
- `comparison.status`: `ok`, `error` o `unavailable`. Si la comparación falla o queda fuera del histórico, `previous.visits` y `previous.views` son `null`, no cero.
- `partial`, `stale`, `cached`, `generated`: estado de la respuesta; la fecha de cada fuente prevalece sobre la general cuando se usan datos anteriores.

`sources` sigue siendo el ranking de procedencias. El filtro de web se aplica también a formularios y ciudades. Una respuesta HTTP 400/422 de Analytics Engine se considera error de fuente; solamente un resultado válido vacío representa ausencia de datos. Las consultas externas de métricas tienen un límite de 12 segundos por petición.

Las claves de caché de métricas en KV conservan exclusivamente agregados durante dos minutos y una copia de recuperación de cada fuente de hasta un día, delimitada por web y periodo. Si falla una fuente, las otras siguen disponibles. Una copia anterior se identifica como `stale`; no se presenta como una consulta actual. La bandeja de contactos nunca entra en esta caché. Otras claves de `PANEL_KV` conservan el historial administrativo de accesos descrito en los bindings; las antiguas session-epoch/login-lock no se usan para autorizar ni reservar enlaces en D17.

## Tráfico detallado (v2.1)

El propietario ha elegido **30 días para las señales de visitas detalladas**, independientemente de los **90 días de la ficha de contacto**. El cierre del 20/10 acredita ambas funciones activadas tras publicar los avisos; su configuración remota actual no se ha revisitado durante esta auditoría. TRAFFIC_ENABLED debe valer exactamente la cadena true en cada Worker para habilitar su captura o lectura.

La señal de la página llega a la ruta /hit del Worker. D1 conserva UUID, creación, caducidad exacta a 30 días, web, ruta sin parámetros ni fragmento, hostname de procedencia y un objeto context. El script compartido envía solamente ruta, origen de procedencia e idioma. No usa un identificador persistente ni almacenamiento del navegador; respeta Do Not Track, Global Privacy Control y la exclusión actual de automatizaciones.

Los sitios están alojados en GitHub Pages: este histórico representa **señales recibidas por el Worker**, no todas las peticiones de red al alojamiento ni sesiones de personas identificadas. Un bloqueo de JavaScript, del beacon o una preferencia de privacidad puede impedir la señal. El encabezado Origin no autentica a una persona y un cliente ajeno al navegador puede falsificarlo. La información de red describe la conexión de la señal, que puede pasar por VPN, proxy o una red compartida.

| Campos de context | Origen y límites |
| --- | --- |
| ip | Solo CF-Connecting-IP validada y normalizada; nunca X-Forwarded-For. IPv4 o IPv6, sin lista de direcciones. |
| country, region, regionCode, city, continent, postalCode, latitude, longitude, timezone | Propiedades disponibles de request.cf. Ubicación aproximada; no equivale a GPS ni domicilio. |
| asn, asOrganization, colo | ASN y operador de la red, centro de datos que atiende la señal. Colo no es la ubicación del visitante. |
| httpProtocol, tlsVersion, tlsCipher, clientTcpRtt, clientQuicRtt | Protocolo, cifrado y mediciones disponibles de la conexión. RTT se conserva en milisegundos, incluido cero. No representa el tiempo total de carga de la página. |
| browser, os, device | Familias derivadas del User-Agent; nunca la cabecera completa. Son señales interpretadas, no datos verificados del dispositivo. |
| language | Idioma válido declarado por el navegador o, si falta, primer valor válido de Accept-Language. |
| botScore, verifiedBot | Solo cuando Cloudflare entrega Bot Management. Ausente no significa humano; false no acredita una persona. |
| rayId | Identificador válido CF-Ray de la petición recibida. |

Campos desconocidos, vacíos o inválidos se omiten; cero y false se preservan cuando son válidos. La disponibilidad depende del producto y la cuenta de Cloudflare. No se solicitan permisos nuevos automáticamente. [Propiedades de Request](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties).

La escritura detallada es independiente de Analytics Engine y del correo. Si falta D1 o falla la escritura, el beacon sigue devolviendo 204 para no interferir con la página. Analytics Engine recibe un resultado agregado de almacenamiento, sin IP, Ray ID, User-Agent ni datos de contacto. El panel no guarda las fichas ni eventos detallados en KV ni en almacenamiento del navegador.

### API de señales

GET /api/traffic/summary devuelve enabled, retentionDays, generated, summary, places, placesMeta, countries, networks, networksMeta, protocols y devices.

summary incluye events, networkAddresses, countries, cities, withLocation, knownBots, unclassifiedBots, latestAt y bySite. networkAddresses cuenta direcciones distintas; **no se presenta como personas únicas**. knownBots cuenta únicamente verifiedBot=true. unclassifiedBots representa señales sin score numérico o con score 0 (no calculado), siempre que no haya bot verificado. Un score 0 no significa bot confirmado ni humano.

El mapa agrupa ubicaciones por país, región, ciudad y coordenadas. Se devuelven como máximo 500 grupos: placesMeta comunica limit, groups, mappedEvents, returnedEvents y truncated. mappedEvents incluye todas las señales con coordenadas válidas; returnedEvents solo las de grupos efectivamente devueltos. El ranking de redes devuelve hasta 100 agrupaciones y networksMeta.truncated indica cuándo no recoge todos los eventos. Los totales del resumen no se reducen al truncar las agrupaciones.

GET /api/traffic/events devuelve items, nextCursor, enabled y retentionDays. Cada elemento incluye id, created_at, expires_at, site, page, referrer y context. GET /api/traffic/events/:id devuelve item con los mismos campos.

Los filtros admitidos son site (all/inicio/cv/isacademy), days (entero 1–30, por defecto 30), country (dos letras), asn (entero positivo hasta 4294967295), q (fragmento literal de hasta 200 caracteres), limit (1–50, por defecto 25) y cursor opaco. q busca IP, ciudad, región, operador, ASN y ruta sin interpretar comodines SQL. El mismo filtro se aplica al resumen. La ordenación de eventos es created_at DESC, id DESC.

Las rutas se autentican mediante el estado D1 antes de consultar eventos, fallan de forma cerrada ante indisponibilidad de sesión y llevan no-store, noindex y sin CORS. Desactivación tras autenticar: 503 traffic_disabled. Falta/fallo de estado de autorización: 503 session_unavailable. Fallo de consulta de eventos tras autorizar: 503 traffic_unavailable. Filtros inválidos: 400 invalid_filters. Registro inexistente/caducado: 404. Métodos de escritura: 405. Los errores no revelan IP, SQL ni contenido del registro.

### Acceso privado · código local aprobado D17/D18

POST /login exige Origin del panel, JSON acotado, Turnstile válido para el hostname del panel, configuración completa y disponibilidad de KV y D1. El destinatario es siempre PANEL_EMAIL; un email enviado en el cuerpo no cambia ese destinatario. Las peticiones a Turnstile y Resend tienen límite de diez segundos. El estado de autorización debe existir y ser válido. El límite de un enlace por minuto se reserva con un único UPDATE condicionado y RETURNING sobre panel_auth_state; usa la hora de SQLite y conserva la espera si el correo falla. Solo el ganador emite un enlace; los demás reciben429/wait. No hay reintentos automáticos. Si falta/falla el estado se responde503, sin tratarlo como espera normal.

El enlace tiene formato expiración.nonce.firma, un nonce UUID aleatorio, HMAC SHA-256 sobre ambos valores y caducidad a 15 minutos. D1 almacena únicamente la huella SHA-256 del token, las fechas y used_at; no guarda el enlace en claro. GET /auth verifica formato, firma y caducidad y consume mediante una actualización condicionada a used_at vacío y expiración futura. Solo una actualización ganadora puede crear la sesión, incluso con usos concurrentes del mismo enlace.

La cookie firmada dura como máximo30d, mantiene __Host-/HttpOnly/Secure/SameSite=Lax y usa época de32hex. Cada comprobación abre una sesión D1 nueva first-primary y su primera SELECT consulta la época, sin caché/bookmark recibido del cliente. Cerrar todas las sesiones escribe una época aleatoria nueva y confirma200 solo si cambió una fila; las comprobaciones nuevas posteriores ven la época principal. No cancela peticiones ya autorizadas ni enlaces aún válidos. Una escritura fallida/no confirmada devuelve503 y no borra la cookie ni confirma cierre. Los antiguos enlaces sin nonce siguen rechazados; las cookies numéricas anteriores se rechazan y al publicar habrá que identificarse otra vez. La limpieza de huellas caducadas conserva su alcance.

D17 requiere aplicar0004 antes del futuro código, mediante plan de publicación propio. La migración es aditiva e idempotente: conserva época/espera al repetirla, sin tocar contactos, tráfico, enlaces ni informes. La autorización añade una consulta principal y depende de D1 incluso si la captura está apagada; latencia/consumo reales no medidos. Un rollback al código KV antiguo no es seguro por sí solo: podría reactivar su estado de sesión y debe planificarse con invalidación de credenciales e intervención humana si se rotan secretos. [D1 first-primary](https://developers.cloudflare.com/d1/worker-api/d1-database/).


El cliente del cierre global (D18) mantiene un estado ocupado y espera como máximo **15 segundos**, incluida la lectura JSON. Solo confirma cierre y navega al acceso si HTTP es correcto y `ok === true`; ante HTTP, red, plazo o cuerpo fallidos avisa que no puede confirmar el cierre, conserva el contexto y no reintenta automáticamente. Una respuesta perdida puede seguir a una rotación ya realizada; el aviso no presupone que las sesiones sigan abiertas. Este plazo es del cliente y no cambia la política de acceso de D17.

El código limita el envío al correo configurado; **su comprobación funcional quedó registrada el 20/10; el valor remoto actual de PANEL_EMAIL no se ha revisitado y deberá cotejarse antes de la próxima publicación sin exponerlo en evidencias**. Quien tenga un enlace válido sin consumir o una cookie válida puede acceder. La revisión local no acredita la seguridad del buzón, la autenticación de Cloudflare ni que la configuración publicada coincida con este código.

### Vista local y pruebas v2.1

La vista normal incluye siete contactos y 42 señales sintéticas; el escenario 1500 señales permite revisar agrupación y carga. Los teléfonos usan el rango NANP reservado para ficción, las IP pertenecen a redes de documentación y los correos a example.com. No se debe llamar, enviar correos ni usar estos ejemplos como datos reales. Los escenarios y reinicios restablecen los cambios de estado.

El adaptador firma cada petición de la vista local con la época de la D1 ficticia; el Worker conserva su autenticación. Usa SQLite en memoria con0001–0004, red del Worker sustituida y recursos estáticos locales. El escenario Fuentes caídas mantiene autorización ficticia válida y hace fallar las consultas de datos. El cierre real de sesión no se demuestra con esta firma automática: las pruebas del Worker usan cookies explícitas y dos vistas KV antiguas sobre el mismo estado D1. Esto no certifica renderizado, permisos ni rendimiento de producción. La revisión visual con Chrome se registra por separado.

Para revisar el componente compartido en las webs se sirven copias de lectura en /__sites/inicio/, /cv/ y /isacademy/ (también /__sites/cv/ y /__sites/isacademy/ redirigen a sus copias locales). Se usan los assets modificados del workspace sin reescribir los HTML generados. Solo en estas copias se retira el beacon externo de Web Analytics y se bloquea por CSP la conexión al Worker real de formularios. Las llamadas de la web estática no deben usarse para verificar entrega de correo. El dominio local tampoco dispara la señal de visitas, por su guard de hostname; el contrato de payload y preferencias se verifica con el DOM simulado de Node.

Los ejemplos HTTP/3 muestran RTT QUIC y los HTTP/2 RTT TCP. El escenario 1500 señales dispersa coordenadas sintéticas alrededor de ciudades para comprobar agrupación, zoom y el límite de grupos; no describe ubicaciones reales.

Última suite registrada: **178/178 contratos el 26/10/2026**, en `tests-d19.txt` de la entrega de auditoría. Incluye subcasos; no equivale a 178 recorridos visuales ni pruebas de seguridad independientes. Usa DOM/reloj/red sustituidos, SQLite en memoria y HTTP de loopback para el adaptador local. No consulta Cloudflare ni envía correo real. Los 73/73 del cierre del 20/10 se conservan como evidencia histórica de aquella publicación.

## Informe semanal y manual (v2.2)

Decisión del propietario: **lunes a las 09:00, Atlantic/Canary**. El cierre del 20/10 acredita cron configurado e informe manual recibido; la primera ejecución semanal y el borrado físico siguen sin observarse en esta revisión. El código posterior de la auditoría continúa local. El informe siempre cubre los últimos siete días y las tres webs, independientemente de los filtros del panel. Web Analytics utiliza fechas UTC de calendario; las señales D1 y contactos utilizan una ventana móvil. Ambas coberturas se indican y no se presentan como una única medida idéntica.

La tarjeta Resumen permite **Ver informe**, **Enviármelo ahora** y **Actualizar estado**. La vista previa usa el mismo renderizador que el correo, con HTML de tablas de hasta 600 px, estilos de marca inline y una alternativa de texto. No contiene JavaScript ni recursos remotos de seguimiento. Incluye tráfico por web, contactos recibidos y pendientes de la bandeja activa, señales/geografía, redes/protocolos, procedencias/páginas/dispositivos/navegadores/sistemas, resultados de formularios y salud de fuentes. Los rankings indican su límite; las fichas, IP y mensajes completos permanecen dentro del panel. Los enlaces privados abren las pestañas mediante `#contacts`, `#traffic` y `#system`.

| Ruta | Contrato |
| --- | --- |
| `GET /api/reports/status` | Activación, configuración disponible, programación, último intento activo y fin de espera para envío manual. No revela destinatario. |
| `GET /api/reports/preview` | HTML privado `no-store`, sin envío. Puede revisarse con `REPORTS_ENABLED` apagado. |
| `POST /api/reports/send` | Sesión, Origin del panel y JSON con un único `requestId` UUID v4. Cuerpo leído por stream, máximo 1024 bytes. Destinatario fijo `PANEL_EMAIL`. |

El botón genera una clave por acción y el servidor hace una reserva atómica D1 antes de preparar el correo. La misma petición concurrente devuelve su intento sin reenviar. Entre solicitudes manuales distintas hay una espera mínima de 60 segundos. El intento semanal tiene una clave única por fecha local. Se utiliza también `Idempotency-Key` de Resend, cuya ventana es de 24 horas; D1 protege la semana activa. [Idempotencia de Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

Estados: `preparing`, `sending`, `accepted`, `failed`, `unknown`. `accepted` requiere respuesta correcta con ID válido y significa aceptación del proveedor, no entrega ni lectura. Rechazos 4xx salvo 408 se marcan fallidos; errores de transporte, 408, 5xx o respuesta sin ID quedan sin confirmar. Un intento abandonado durante más de dos minutos se presenta sin confirmar. No hay reintentos automáticos de correo; comprobar Resend antes de una nueva acción consciente. La API almacena solo metadatos, huella del payload y códigos fijos de error; no conserva HTML, cuerpo, destinatario, mensajes o IP en `panel_reports` ni en logs/KV. Los metadatos caducan a los 30 días y se ocultan antes de su purga.

Cloudflare ejecuta cron en UTC. Configuración guardada y comprobada según el cierre del 20/10: `0 8 * * MON` y `0 9 * * MON`; no se ha revalidado en la cuenta durante esta auditoría. El código usa `scheduledTime` y `Intl.DateTimeFormat` en Atlantic/Canary para aceptar solo la ejecución de las 09:00 locales; cubre el cambio de verano/invierno sin editar cron dos veces al año. Descarta eventos de más de 24 horas o excesivamente futuros. La fecha de generación y ventana móvil reflejan el momento efectivo de preparación. [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

El cierre del 20/10 acredita también el cron diario de limpieza `15 2 * * *`; configurarlo no activa informes por sí mismo. La limpieza de las cuatro tablas se ejecuta aunque los flags estén apagados. Si falta D1 no hay envío. Antes de la próxima publicación habrá que cotejar destinatario, permisos y límites de Resend con un plan acordado; la vista local sustituye la red y no envía correo. El cierre del 20/10 registra revisión del HTML recibido en Gmail; Outlook no está verificado y el correo posterior no se ha enviado realmente.

## Pulido visual v2.2

El eslogan permanece 1,8 segundos tras terminar la firma; la cortina sale en 1,2 segundos y libera foco/controles a los 1,25 segundos. El límite de seguridad es 8,5 segundos. Saltar/Escape y movimiento reducido se conservan. La cabecera usa fondo opaco del tema y sombra del sistema de diseño. El mapa trata el meridiano por anillo: desenvuelve, recorta en ±180°, descarta degenerados y densifica el cierre antes de proyectar. Conserva el JSON/SRI; EE. UU., Alaska y Hawái no se desplazan por las Aleutianas. Rusia/Fiji conservan ambos lados del meridiano.

La página reserva 88 px al desplazar controles para que no queden bajo la cabecera. Las pestañas mantienen el fragmento de URL correspondiente; se puede guardar el enlace privado de la sección. El lector de la fuente agregada conserva como ausentes las coordenadas nulas o inválidas que recibe; seleccionar un lugar sin coordenadas no acerca el mapa a una posición inventada.

### Coordenadas agregadas · D02 · revisión local del 24/10/2026

La revisión completa detectó que el escritor anterior de `/hit` sustituía coordenadas ausentes por cero, aunque el lector ya distinguía `null` de cero. La corrección local añade `blob6` al esquema posicional de `isa_site_views`: `geo-v1` indica una pareja válida y `geo-missing-v1` una pareja ausente, parcial o inválida. `double1` y `double2` siguen siendo latitud y longitud aproximadas, redondeadas a una décima; cuando falta la pareja se omite el array numérico. Se conserva un evento agregado con web, país, región, ciudad y resultado de captura, sin IP. El contexto privado D1 y su conservación no cambian.

La consulta de ciudades admite parejas marcadas `geo-v1` dentro de ±90/±180, incluido el cero legítimo. Para los eventos anteriores sin marca admite parejas en rango distintas de `(0,0)`. Excluye del mapa los `(0,0)` históricos ambiguos, sin borrarlos: no es posible distinguir un cero real del sustituto anterior. Tampoco se pueden reconstruir coordenadas históricas parciales que hayan quedado codificadas como un cero y otro valor distinto de cero; su localización continúa siendo aproximada. No se trata de un mapa de todas las visitas ni de su ubicación física exacta.

La nota del mapa de ciudades agregado explica esas exclusiones. La caché y las instantáneas pasan al espacio `data:v3` para impedir que reaparezcan puntos de resultados anteriores. No hay migración D1, modificación de plazos ni publicación en este bloque. Las pruebas recorren captura → consulta SQL → respuesta del panel, cubriendo ausencia, valores parciales/inválidos, ceros válidos, histórico ambiguo y caché anterior; la API real de Analytics Engine queda pendiente de validación al publicar.

## Ampliaciones útiles pendientes de verificar en la cuenta

- **Experiencia real por web:** Cloudflare Web Analytics ofrece LCP, INP y CLS, y desgloses de carga/respuesta. Sería la siguiente tarjeta prioritaria para evaluar las intros y las interacciones con datos reales. Confirmar acceso al dataset y cobertura de muestras antes de integrarla; RTT no sustituye estas métricas. [Core Web Vitals](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/).
- **Salud de captura:** agrupar los resultados `stored`, `storage_error`, `storage_unavailable` y `aggregate_only` que ya puede emitir `/hit`, más la última señal recibida. Permitiría distinguir ausencia de visitas de un fallo de captura. Requiere comprobar eventos reales y el estado de ambos Workers.
- **Entrega de correo:** webhooks verificados de Resend permitirían diferenciar entrega/rebote de mera aceptación. Requiere un bloque propio; ahora los estados no afirman entrega.
- `request.cf.edgeL4.deliveryRate` y otras señales de automatización son opcionales y describen la conexión o el producto contratado. No se han añadido sin comprobar su presencia/utilidad en la cuenta. [Request.cf](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties).

## Retención, copias y recuperación

La tabla de contactos exige `expires_at = created_at + 7776000000`. El listado, detalle y cambio de estado excluyen contactos caducados incluso si la tarea de limpieza se retrasa. El `scheduled` de `isa-panel` elimina las filas caducadas de contactos, tráfico, huellas de acceso e intentos de informe en un batch D1. Sigue limpiando si se desactiva la captura. **El cron diario consta configurado y comprobado el 20/10; la ejecución física de la limpieza no se ha observado en esta revisión.**

Los 90 días de contactos y los 30 días de señales detalladas describen la disponibilidad y su almacenamiento activo. El borrado físico depende de que se ejecute la limpieza. Además, Cloudflare mantiene Time Travel: hasta **7 días en Workers Free** o **30 en Paid**, activado por el proveedor. Por tanto, un registro eliminado podría seguir en el histórico de recuperación durante esa ventana. El cierre del 20/10 acredita una ventana de siete días; el plan y la ventana remotos actuales deberán cotejarse antes de la próxima publicación. [Time Travel de D1](https://developers.cloudflare.com/d1/reference/time-travel/).

El informe periódico preparado es un resumen con enlaces privados, no una exportación de fichas o IP. La conservación activa del panel no borra sus resúmenes ni los otros mensajes de Gmail o registros de Resend bajo sus propias condiciones. El histórico agregado anterior no permite reconstruir fichas de contacto.

Una recuperación de D1 puede recuperar también filas que ya habían caducado: los filtros de la API continúan ocultándolas y hay que ejecutar la limpieza antes de reabrir el servicio. Restaurar una base sobrescribe su estado; requiere un plan propio con la fecha/bookmark elegida, efecto sobre envíos recientes y aprobación del propietario. Nunca restaurar ni borrar la base como parte de una revisión visual.

## Próxima publicación · checklist para un plan propio

Esta lista prepara decisiones posteriores; D20 no autoriza ni ejecuta publicación, cambios de flags, cron o migración remota.

1. Obtener aceptación visual global de los cambios locales y cerrar los resultados de QA. Comparar estado remoto, esquema y versiones con el cierre acreditado del 20/10; no asumir que siguen iguales.
2. Conservar código y configuración necesarios para una reversión planificada, sin extraer secretos. Resolver la invalidación de credenciales antes de considerar código KV anterior a D17 como vuelta atrás.
3. Preparar versiones, build, cuatro PDF del CV y prerender de Academia, con sus comprobaciones. Coordinar biblioteca compartida, adaptadores y diccionarios; publicar portada antes de CV/Academia y verificar compatibilidad de consumidores cacheados. Los avisos del 20/10 ya fueron publicados; cotejar su cobertura vigente, sin tratarlos como una instalación nueva.
4. En la base existente, comprobar `0001`–`0003` y aplicar `0004_panel_auth.sql` antes del nuevo panel D17, conservando datos. Requiere su propio plan/aprobación remotos. El nuevo acceso dependerá de D1 y exigirá identificarse otra vez.
5. Publicar los paquetes revisados mediante el procedimiento autorizado GitHub/Codespaces y editor de Cloudflare, con secuencia y reversión concretas. Revisar los flags existentes; no apagarlos ni activarlos automáticamente por esta checklist.
6. Cotejar bindings, destinatario sin exponerlo, permisos, cron diario/semanal y Time Travel. Comprobar las APIs privadas y las pruebas reales de formularios/informe que se acuerden expresamente; aceptación de Resend no acredita entrega por sí sola.
7. Registrar versiones finales, comprobaciones online, aceptación del propietario y límites. La primera ejecución semanal y purga física requieren observación real; no marcarlas como realizadas por haber guardado un cron o superado un test local.

**Instalación nueva, caso separado:** crear D1 con jurisdicción UE y aplicar `0001_contacts.sql`, `0002_panel_activity.sql`, `0003_panel_reports.sql` y `0004_panel_auth.sql`, en orden, antes del código que las necesita. Vincular ambos Workers y comprobar avisos/configuración antes de decidir la activación. Este caso no describe la base existente del propietario ni autoriza crear recursos.

En una reversión, apagar captura devolvería formularios a la ruta anterior y no eliminaría los datos guardados; retirar un `scheduled` también retiraría su limpieza. La reversión debe resolver retención y acceso, incluida invalidación de credenciales si vuelve a la lógica KV anterior. No revertir automáticamente ni restaurar/borrar la base como parte de la auditoría.

## Validación local y límites

Desde la raíz del repositorio, con Node 24 o posterior:

```bash
rtk proxy node --check tools/cloudflare/isa-panel.js
rtk proxy node --check tools/cloudflare/isa-forms.js
rtk proxy node --test tools/cloudflare/qa/contacts.test.mjs tools/cloudflare/qa/form-loader.test.mjs tools/cloudflare/qa/preview.test.mjs tools/cloudflare/qa/dialog.test.mjs ../cv/tools/qa/view.test.mjs ../isacademy/tools/qa/python-runtime.test.mjs
rtk proxy node tools/cloudflare/qa/preview.mjs --port 8790
rtk git diff --check
```

Las pruebas de contrato sustituyen todos los accesos de red y usan SQLite en memoria. No envían correo ni consultan la cuenta de Cloudflare. Una prueba local no certifica permisos de D1, configuración de Turnstile, ejecución real de cron, aceptación/entrega real de Resend ni propagación de una publicación.

Las consultas del resumen y de su página son separadas: un contacto nuevo o un cambio simultáneo puede provocar una diferencia momentánea entre cifra y lista. La caché KV tampoco ofrece una transacción global entre consultas concurrentes. Reconsultar corrige esas diferencias; no se usa KV para guardar ni actualizar contactos.

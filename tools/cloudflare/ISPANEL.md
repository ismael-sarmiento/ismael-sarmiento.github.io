# IsPanel v2.2 — contratos y operación

Estado: revisión local aceptada y publicación autorizada el 2026-10-20. Despliegue en curso: D1 creada y migraciones aplicadas; código de `isa-forms` publicado con captura apagada. El nuevo `isa-panel`, GitHub Pages, flags, cron y pruebas reales de correo aún requieren completar y registrar su verificación. No se debe interpretar este estado intermedio como una publicación terminada.

## Registro de publicación · 2026-10-20

- Base `isa-panel-private`, ID `de14e84d-a0d8-4fa0-881a-a33114ba1cc6`, jurisdicción **Unión Europea**, región mostrada Eastern Europe. Time Travel confirmado en el panel de Cloudflare: **7 días**.
- Migraciones `0001` → `0002` → `0003` ejecutadas correctamente; `sqlite_master` confirma `contacts`, `traffic_events`, `panel_link_tokens` y `panel_reports`.
- Conexiones `CONTACTS_DB` autorizadas expresamente por el propietario para ambos Workers; las vistas previas se separan de la base de producción.
- Punto de reversión inicial: `isa-panel` versión `bf297b59`, `isa-forms` versión `9108921d`. Copias de código completas conservadas fuera del repositorio, sin extraer secretos.
- Código nuevo de `isa-forms`: versión de código `b43eb363`, cotejado con el archivo local antes de publicar. Las modificaciones posteriores de bindings generan sus propias versiones; verificar la versión final activa al cerrar el despliegue.
- Suite de publicación: **73/73** contratos locales y ocho comprobaciones de sintaxis, además de diff de los tres repositorios. La red está sustituida en los contratos.
- Versión estática preparada: `20261020a`. Avisos ES/EN de conservación y resultado guardado/notificación incierta; HTML de IsAcademy obtenido mediante Chrome/CUA y las funciones de su prerender, sin iniciar un navegador alternativo.
- Pendiente de cierre: versión final de ambos Workers, publicación de los tres repositorios, activación, cron, acceso privado y pruebas reales de formularios/informe. Evidencias en `/private/tmp/ispanel-produccion-2026-10-20/`; se copiarán a Descargas al terminar.

## Componentes

| Componente | Función |
| --- | --- |
| `isa-panel.js` | Acceso privado, métricas agregadas, bandeja y cambios de estado. |
| `isa-forms.js` | Validación, Turnstile, almacenamiento previo al correo y notificación mediante Resend. |
| `migrations/0001_contacts.sql` | Tabla privada e índices de contactos. |
| `migrations/0002_panel_activity.sql` | Señales detalladas de tráfico y huellas de acceso de un uso. |
| `migrations/0003_panel_reports.sql` | Metadatos de intentos de informe y deduplicación, durante 30 días. |
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
| `isa-panel` | `PANEL_KV`, `PANEL_SECRET` | Sesiones, revocación, acceso y caché de agregados. |
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

Respuesta de formulario cuando queda guardado:

```json
{"success":"true","message":"stored","stored":true,"notification":"accepted"}
```

Un duplicado añade `"duplicate": true`. Las respuestas conservan los valores de `success` como cadenas por compatibilidad con los formularios actuales.

## API privada

Las rutas se autentican antes de comprobar flags o consultar D1. La API de contactos además exige `PANEL_KV`: si falta el binding o falla la consulta de sesión, devuelve `503 session_unavailable` y no consulta D1. No permite acceder usando la época de sesión por defecto cuando KV no está disponible. Todas las respuestas privadas llevan `Cache-Control: no-store`. No se habilita CORS en el panel. La cookie conserva los atributos `HttpOnly; Secure; SameSite=Lax`. El acceso v2.1 usa enlaces con nonce y consumo atómico en D1, descritos en Acceso; ya no usa KV como control de un uso.

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

Errores: `401` sin sesión válida; `403` por origen de escritura; `400` por filtros/cuerpo/estado; `404` para un contacto inexistente o caducado; `405` por método; `413` por tamaño; `415` por tipo de contenido. `503 session_unavailable` impide el acceso cuando falta o falla KV; `503 contacts_disabled` indica desactivación; `503 contacts_unavailable`, falta de binding o indisponibilidad de D1. Los errores no incluyen datos personales, parámetros SQL ni mensajes internos del proveedor.

### Métricas

`GET /api/data?days=30&site=all&fresh=1` mantiene el contrato de gráficos y añade:

- `sourceHealth.visits`, `.forms`, `.cities`: `status` = `ok`, `empty`, `error` o `stale`, con fecha de origen y mensaje cuando corresponde.
- `comparison.status`: `ok`, `error` o `unavailable`. Si la comparación falla o queda fuera del histórico, `previous.visits` y `previous.views` son `null`, no cero.
- `partial`, `stale`, `cached`, `generated`: estado de la respuesta; la fecha de cada fuente prevalece sobre la general cuando se usan datos anteriores.

`sources` sigue siendo el ranking de procedencias. El filtro de web se aplica también a formularios y ciudades. Una respuesta HTTP 400/422 de Analytics Engine se considera error de fuente; solamente un resultado válido vacío representa ausencia de datos. Las consultas externas de métricas tienen un límite de 12 segundos por petición.

Las claves de caché de métricas en KV conservan exclusivamente agregados durante dos minutos y una copia de recuperación de cada fuente de hasta un día, delimitada por web y periodo. Si falla una fuente, las otras siguen disponibles. Una copia anterior se identifica como `stale`; no se presenta como una consulta actual. La bandeja de contactos nunca entra en esta caché. Otras claves de `PANEL_KV` conservan la información administrativa de sesiones y accesos descrita en los bindings.

## Tráfico detallado (v2.1)

El propietario ha elegido **30 días para las señales de visitas detalladas**, independientemente de los **90 días de la ficha de contacto**. Ambas funciones permanecen desactivadas en producción hasta su plan de publicación y avisos. TRAFFIC_ENABLED debe valer exactamente la cadena true en cada Worker para habilitar su captura o lectura.

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

Las rutas se autentican antes de consultar D1, fallan de forma cerrada ante indisponibilidad de sesión y llevan no-store, noindex y sin CORS. Desactivación: 503 traffic_disabled. D1 ausente o fallido: 503 traffic_unavailable. Filtros inválidos: 400 invalid_filters. Registro inexistente/caducado: 404. Métodos de escritura: 405. Los errores no revelan IP, SQL ni contenido del registro.

### Acceso privado v2.1

POST /login exige Origin del panel, JSON acotado, Turnstile válido para el hostname del panel, configuración completa y disponibilidad de KV y D1. El destinatario es siempre PANEL_EMAIL; un email enviado en el cuerpo no cambia ese destinatario. Las peticiones a Turnstile y Resend tienen límite de diez segundos. La limitación de un enlace por minuto usa KV: al ser eventual no constituye un límite global atómico ante peticiones simultáneas.

El enlace tiene formato expiración.nonce.firma, un nonce UUID aleatorio, HMAC SHA-256 sobre ambos valores y caducidad a 15 minutos. D1 almacena únicamente la huella SHA-256 del token, las fechas y used_at; no guarda el enlace en claro. GET /auth verifica formato, firma y caducidad y consume mediante una actualización condicionada a used_at vacío y expiración futura. Solo una actualización ganadora puede crear la sesión, incluso con usos concurrentes del mismo enlace.

La cookie de sesión firmada dura como máximo 30 días y se contrasta con la época de revocación en KV. Cerrar todas las sesiones eleva la época de revocación; invalida las existentes tras su propagación en KV, no de forma instantánea entre ubicaciones. Los antiguos enlaces sin nonce dejan de aceptarse; las sesiones vigentes conservan su formato. La limpieza borra huellas de enlaces caducados.

El código limita el envío al correo configurado; **el valor de producción de PANEL_EMAIL todavía debe comprobarse sin exponerlo en evidencias**. Quien tenga un enlace válido sin consumir o una cookie válida puede acceder. La revisión local no acredita la seguridad del buzón, la autenticación de Cloudflare ni que la configuración publicada coincida con este código.

### Vista local y pruebas v2.1

La vista normal incluye siete contactos y 42 señales sintéticas; el escenario 1500 señales permite revisar agrupación y carga. Los teléfonos usan el rango NANP reservado para ficción, las IP pertenecen a redes de documentación y los correos a example.com. No se debe llamar, enviar correos ni usar estos ejemplos como datos reales. Los escenarios y reinicios restablecen los cambios de estado.

El adaptador firma únicamente las peticiones de la vista local; el Worker conserva su autenticación. Usa SQLite en memoria con ambas migraciones, red del Worker sustituida y recursos estáticos locales. Esto no certifica renderizado, permisos ni rendimiento de producción. La revisión visual con Chrome se registra por separado.

Para revisar el componente compartido en las webs se sirven copias de lectura en /__sites/inicio/, /cv/ y /isacademy/ (también /__sites/cv/ y /__sites/isacademy/ redirigen a sus copias locales). Se usan los assets modificados del workspace sin reescribir los HTML generados. Solo en estas copias se retira el beacon externo de Web Analytics y se bloquea por CSP la conexión al Worker real de formularios. Las llamadas de la web estática no deben usarse para verificar entrega de correo. El dominio local tampoco dispara la señal de visitas, por su guard de hostname; el contrato de payload y preferencias se verifica con el DOM simulado de Node.

Los ejemplos HTTP/3 muestran RTT QUIC y los HTTP/2 RTT TCP. El escenario 1500 señales dispersa coordenadas sintéticas alrededor de ciudades para comprobar agrupación, zoom y el límite de grupos; no describe ubicaciones reales.

La suite conserva las 57 pruebas de v2.1 y añade geometría, coordenadas ausentes, informes y horario de Canarias: 72 pruebas, incluidas cuatro subpruebas de resultados del proveedor. No hace peticiones reales a Cloudflare o Resend.

## Informe semanal y manual (v2.2)

Decisión del propietario: **lunes a las 09:00, Atlantic/Canary**. Código preparado localmente; cron y envío de producción siguen pendientes de configurar y validar. El informe siempre cubre los últimos siete días y las tres webs, independientemente de los filtros del panel. Web Analytics utiliza fechas UTC de calendario; las señales D1 y contactos utilizan una ventana móvil. Ambas coberturas se indican y no se presentan como una única medida idéntica.

La tarjeta Resumen permite **Ver informe**, **Enviármelo ahora** y **Actualizar estado**. La vista previa usa el mismo renderizador que el correo, con HTML de tablas de hasta 600 px, estilos de marca inline y una alternativa de texto. No contiene JavaScript ni recursos remotos de seguimiento. Incluye tráfico por web, contactos recibidos y pendientes de la bandeja activa, señales/geografía, redes/protocolos, procedencias/páginas/dispositivos/navegadores/sistemas, resultados de formularios y salud de fuentes. Los rankings indican su límite; las fichas, IP y mensajes completos permanecen dentro del panel. Los enlaces privados abren las pestañas mediante `#contacts`, `#traffic` y `#system`.

| Ruta | Contrato |
| --- | --- |
| `GET /api/reports/status` | Activación, configuración disponible, programación, último intento activo y fin de espera para envío manual. No revela destinatario. |
| `GET /api/reports/preview` | HTML privado `no-store`, sin envío. Puede revisarse con `REPORTS_ENABLED` apagado. |
| `POST /api/reports/send` | Sesión, Origin del panel y JSON con un único `requestId` UUID v4. Cuerpo leído por stream, máximo 1024 bytes. Destinatario fijo `PANEL_EMAIL`. |

El botón genera una clave por acción y el servidor hace una reserva atómica D1 antes de preparar el correo. La misma petición concurrente devuelve su intento sin reenviar. Entre solicitudes manuales distintas hay una espera mínima de 60 segundos. El intento semanal tiene una clave única por fecha local. Se utiliza también `Idempotency-Key` de Resend, cuya ventana es de 24 horas; D1 protege la semana activa. [Idempotencia de Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

Estados: `preparing`, `sending`, `accepted`, `failed`, `unknown`. `accepted` requiere respuesta correcta con ID válido y significa aceptación del proveedor, no entrega ni lectura. Rechazos 4xx salvo 408 se marcan fallidos; errores de transporte, 408, 5xx o respuesta sin ID quedan sin confirmar. Un intento abandonado durante más de dos minutos se presenta sin confirmar. No hay reintentos automáticos de correo; comprobar Resend antes de una nueva acción consciente. La API almacena solo metadatos, huella del payload y códigos fijos de error; no conserva HTML, cuerpo, destinatario, mensajes o IP en `panel_reports` ni en logs/KV. Los metadatos caducan a los 30 días y se ocultan antes de su purga.

Cloudflare ejecuta cron en UTC. Configuración propuesta, aún no aplicada: `0 8 * * MON` y `0 9 * * MON`. El código usa `scheduledTime` y `Intl.DateTimeFormat` en Atlantic/Canary para aceptar solo la ejecución de las 09:00 locales; cubre el cambio de verano/invierno sin editar cron dos veces al año. Descarta eventos de más de 24 horas o excesivamente futuros. La fecha de generación y ventana móvil reflejan el momento efectivo de preparación. [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

Mantener además un cron diario de limpieza, por ejemplo `15 2 * * *`, sin activar informes por ese mero hecho. La limpieza de las cuatro tablas se ejecuta aunque los flags estén apagados. Si falta D1 no hay envío. Antes de producción hay que comprobar destinatario, permiso de Resend y sus límites reales; la vista local sustituye la red y no envía correo. No se ha certificado el render nativo de Gmail/Outlook.

## Pulido visual v2.2

El eslogan permanece 1,8 segundos tras terminar la firma; la cortina sale en 1,2 segundos y libera foco/controles a los 1,25 segundos. El límite de seguridad es 8,5 segundos. Saltar/Escape y movimiento reducido se conservan. La cabecera usa fondo opaco del tema y sombra del sistema de diseño. El mapa trata el meridiano por anillo: desenvuelve, recorta en ±180°, descarta degenerados y densifica el cierre antes de proyectar. Conserva el JSON/SRI; EE. UU., Alaska y Hawái no se desplazan por las Aleutianas. Rusia/Fiji conservan ambos lados del meridiano.

La página reserva 88 px al desplazar controles para que no queden bajo la cabecera. Las pestañas mantienen el fragmento de URL correspondiente; se puede guardar el enlace privado de la sección. En la fuente agregada, una coordenada ausente o inválida permanece ausente, no se convierte en cero; seleccionar un lugar sin coordenadas no acerca el mapa a una posición inventada. Los ceros válidos se conservan. Los valores cero que ya hubieran sido codificados en Analytics Engine como sustituto de una coordenada ausente no pueden distinguirse retrospectivamente de un cero real: se revisará la cobertura con datos de producción.

## Ampliaciones útiles pendientes de verificar en la cuenta

- **Experiencia real por web:** Cloudflare Web Analytics ofrece LCP, INP y CLS, y desgloses de carga/respuesta. Sería la siguiente tarjeta prioritaria para evaluar las intros y las interacciones con datos reales. Confirmar acceso al dataset y cobertura de muestras antes de integrarla; RTT no sustituye estas métricas. [Core Web Vitals](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/).
- **Salud de captura:** agrupar los resultados `stored`, `storage_error`, `storage_unavailable` y `aggregate_only` que ya puede emitir `/hit`, más la última señal recibida. Permitiría distinguir ausencia de visitas de un fallo de captura. Requiere comprobar eventos reales y el estado de ambos Workers.
- **Entrega de correo:** webhooks verificados de Resend permitirían diferenciar entrega/rebote de mera aceptación. Requiere un bloque propio; ahora los estados no afirman entrega.
- `request.cf.edgeL4.deliveryRate` y otras señales de automatización son opcionales y describen la conexión o el producto contratado. No se han añadido sin comprobar su presencia/utilidad en la cuenta. [Request.cf](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties).

## Retención, copias y recuperación

La tabla de contactos exige `expires_at = created_at + 7776000000`. El listado, detalle y cambio de estado excluyen contactos caducados incluso si la tarea de limpieza se retrasa. El `scheduled` de `isa-panel` elimina las filas caducadas de contactos, tráfico, huellas de acceso e intentos de informe en un batch D1. Sigue limpiando si se desactiva la captura. **El cron diario todavía debe configurarse y verificarse en Cloudflare.**

Los 90 días de contactos y los 30 días de señales detalladas describen la disponibilidad y su almacenamiento activo. El borrado físico depende de que se ejecute la limpieza. Además, Cloudflare mantiene Time Travel: hasta **7 días en Workers Free** o **30 en Paid**, activado por el proveedor. Por tanto, un registro eliminado podría seguir en el histórico de recuperación durante esa ventana. El plan real de la cuenta debe comprobarse antes de activar producción. [Time Travel de D1](https://developers.cloudflare.com/d1/reference/time-travel/).

El informe periódico preparado es un resumen con enlaces privados, no una exportación de fichas o IP. La conservación activa del panel no borra sus resúmenes ni los otros mensajes de Gmail o registros de Resend bajo sus propias condiciones. El histórico agregado anterior no permite reconstruir fichas de contacto.

Una recuperación de D1 puede recuperar también filas que ya habían caducado: los filtros de la API continúan ocultándolas y hay que ejecutar la limpieza antes de reabrir el servicio. Restaurar una base sobrescribe su estado; requiere un plan propio con la fecha/bookmark elegida, efecto sobre envíos recientes y aprobación del propietario. Nunca restaurar ni borrar la base como parte de una revisión visual.

## Orden de publicación pendiente

1. Obtener la aceptación visual del panel local y cerrar los resultados de QA.
2. Actualizar y publicar los avisos de los formularios y sus mensajes de resultado en el siguiente bloque aprobado.
3. Comprobar versiones activas y conservar un punto de reversión de los dos Workers, sin extraer secretos.
4. Crear la base con jurisdicción UE, aplicar `0001_contacts.sql`, `0002_panel_activity.sql` y `0003_panel_reports.sql` en ese orden, y vincularla como `CONTACTS_DB` en ambos Workers.
5. Publicar el código revisado con captura desactivada. Probar acceso, métricas y compatibilidad del formulario anterior.
6. Configurar y verificar el cron diario y los dos candidatos semanales de `isa-panel`. Confirmar plan, destinatario, permiso de Resend y ventana Time Travel. `REPORTS_ENABLED` permanece apagado hasta comprobar el correo mediante una prueba acordada.
7. Activar la lectura privada y la captura solo cuando estén completos los avisos y las verificaciones. Validar un envío de prueba acordado y su caducidad, sin confundir aceptación de Resend con entrega.
8. Registrar versiones, bindings sin valores secretos, resultado de pruebas y limitaciones de la publicación.

En una reversión, desactivar la captura devuelve los formularios al correo anterior; no elimina la bandeja existente. Mantener una ruta de limpieza de los registros ya guardados. Retirar o revertir `isa-panel` a una versión sin `scheduled` también retiraría su limpieza, por lo que ese paso requiere resolver la retención antes.

## Validación local y límites

Desde la raíz del repositorio, con Node 24 o posterior:

```bash
node --check tools/cloudflare/isa-panel.js
node --check tools/cloudflare/isa-forms.js
node --test tools/cloudflare/qa/contacts.test.mjs
node tools/cloudflare/qa/preview.mjs --port 8788
rtk git diff --check
```

Las pruebas de contrato sustituyen todos los accesos de red y usan SQLite en memoria. No envían correo ni consultan la cuenta de Cloudflare. Una prueba local no certifica permisos de D1, configuración de Turnstile, ejecución real de cron, aceptación/entrega real de Resend ni propagación de una publicación.

Las consultas del resumen y de su página son separadas: un contacto nuevo o un cambio simultáneo puede provocar una diferencia momentánea entre cifra y lista. La caché KV tampoco ofrece una transacción global entre consultas concurrentes. Reconsultar corrige esas diferencias; no se usa KV para guardar ni actualizar contactos.

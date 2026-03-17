# CV Project Context

Fecha de consolidación: 2026-03-16
Última actualización relevante: 2026-03-17
Proyecto: `ismael-sarmiento.github.io`
Objetivo: servir como fuente única de verdad para cualquier LLM o persona que tenga que continuar el trabajo de la web CV, preparar simulaciones de entrevista o adaptar el contenido a LinkedIn u otros canales.

## 0. Contexto de origen

Este proyecto nace de una necesidad muy concreta:

- disponer de un CV online propio
- tener una presencia profesional pública, indexable y controlada
- no depender solo de LinkedIn o de un PDF estático
- mostrar la evolución profesional con más contexto que un currículum tradicional
- servir tanto para recruiters como para perfiles técnicos y hiring managers

La web no nace como portfolio creativo ni como experimento visual. Nace como un `CV online` con objetivos claros:

- explicar mejor el perfil profesional
- posicionar términos clave asociados al perfil
- dejar trazabilidad de decisiones y evolución
- facilitar futuras adaptaciones a LinkedIn, entrevistas y materiales derivados

## 0.1 Cómo usar este documento

Este archivo debe leerse en este orden:

1. contexto de origen
2. objetivo del proyecto
3. restricciones técnicas
4. decisiones ya tomadas
5. historia y evolución
6. requisitos y próximos pasos
7. trazabilidad de cambios

Regla de uso para futuros LLMs:

- si una decisión aparece aquí como vigente, no debe reabrirse sin motivo fuerte
- si se hace un cambio importante, debe dejarse rastro en la sección de trazabilidad
- si el cambio afecta a posicionamiento, naming o tono, debe actualizarse también la parte de decisiones maestras

## 0.2 Lectura rápida para otro LLM

Resumen ejecutivo del proyecto:

- producto:
  - `CV online bilingüe`
- canal:
  - `GitHub Pages`
- arquitectura:
  - `sitio estático sin backend`
- objetivo principal:
  - `explicar y posicionar mejor el perfil profesional de Ismael`
- naming principal actual:
  - `Lead Data Engineer`
- contexto profesional dominante:
  - `Savana`
- especialización:
  - `gobierno del dato`
  - `interoperabilidad clínica`
  - `calidad del dato`
  - `metadatos y ciclo de vida`

## 0.3 Requisitos no negociables

Requisitos de producto:

- Debe seguir sintiéndose como un `CV online serio`, no como una landing genérica.
- Debe poder ser entendido por recruiters y por perfiles técnicos.
- Debe comunicar evolución profesional, no solo stack tecnológico.
- Debe funcionar como web profesional pública, no solo como un experimento de diseño.

Requisitos de contenido y posicionamiento:

- Debe mantener versión española e inglesa indexables.
- Debe dejar visible la especialización en:
  - gobierno del dato
  - interoperabilidad clínica
  - calidad del dato
  - DataHub
  - HL7 FHIR
  - OMOP CDM
- Debe reforzar las entidades y términos que más ayudan al posicionamiento del perfil:
  - `Ismael Sarmiento`
  - `Lead Data Engineer`
  - `Savana`
  - `GitHub`
- Debe explicar la trayectoria con foco en impacto, criterio y contexto.

Requisitos de mantenimiento:

- Debe ser mantenible por futuros LLMs y por eso necesita trazabilidad explícita.
- Toda decisión relevante de naming, tono, SEO, estructura o narrativa debe quedar reflejada aquí.
- La capa estable del documento y la capa histórica deben actualizarse juntas.

## 0.4 Mapa del documento

- Secciones `0` a `3`:
  - origen del proyecto
  - modo de uso
  - requisitos
  - decisiones ya cerradas
- Secciones `4` a `7`:
  - dirección visual
  - estado actual
  - evolución del producto
  - criterio editorial
- Secciones `8` a `12`:
  - trayectoria profesional
  - especialización
  - asociaciones
  - stack y referencias de dominio
- Secciones `13` a `17`:
  - valoración actual
  - debilidades
  - próximos pasos
  - preparación de entrevistas
- Secciones `18` a `22`:
  - instrucciones para otros LLMs
  - archivo maestro
  - reglas de mantenimiento
  - trazabilidad
  - plantilla reusable

## 1. Objetivo del proyecto

Construir una web personal de CV bilingüe, profesional, memorable y orientada a impacto real. No debe parecer un portfolio artístico ni una landing genérica. Tiene que funcionar para:

- recruiters
- CTOs
- CEOs
- Lead Data Engineers
- hiring managers
- perfiles de salud digital y datos

La web debe transmitir que Ismael no es solo un ingeniero de datos de pipelines, sino un perfil que trabaja el dato como producto y como plataforma, con foco en:

- gobierno del dato
- interoperabilidad
- calidad del dato
- metadatos
- trazabilidad
- control del ciclo de vida
- plataformas confiables

## 2. Restricciones técnicas

- Despliegue en GitHub Pages.
- Arquitectura estática.
- Sin backend.
- Base actual:
  - `index.html`
  - `index_en.html`
  - `assets/content.js`
  - `assets/app.js`
  - `assets/app.css`
  - `assets/print.css`
  - `assets/favicon.svg`
  - `assets/og-card.svg`
- Dos entradas públicas estáticas:
  - `/` como versión principal en español
  - `/index_en.html` como versión inglesa indexable
- Cambio de idioma por UI con navegación entre entradas y contenido compartido en los mismos assets.

## 3. Decisiones ya tomadas

### Posicionamiento

Versión española:

- Headline principal:
  - `Lead Data Engineer`
- Headline secundario:
  - `Gobierno del dato, interoperabilidad y calidad del dato`
- Subtítulo:
  - `Construyo productos y plataformas de datos gobernados, interoperables y confiables, con foco en calidad del dato.`
- Mensaje principal:
  - `En Savana convierto problemas complejos del dato en plataformas confiables e interoperables que ayudan a tomar decisiones con impacto real.`

Versión inglesa:

- Headline principal:
  - `Lead Data Engineer`
- Headline secundario:
  - `Governance, Interoperability & Data Quality`
- Subtítulo:
  - `Data engineering for governed, interoperable products and platforms built around data quality.`
- Mensaje principal:
  - `At Savana, I turn complex data problems into reliable, interoperable platforms that help teams make real-world decisions.`

### Cabecera

- Nombre visible:
  - `Ismael Sarmiento`
- Tagline corto:
  - `Ingeniería del dato con impacto real`
- No debe llevar icono al lado del nombre.
- El acceso al asistente se hace con un botón flotante aparte.

### Loader

- Se mantiene.
- Debe estar basado en hitos de impacto, no solo en empresas.
- El relleno de barra debe ser suave y progresivo.
- La paleta del progreso debe moverse de azules muy claros a azules más intensos.
- Debe dejar tiempo razonable para leer.
- Debe tener botón para saltar la intro.

### Asistente

- Existe como asistente local beta.
- No usa LLM externo.
- Está limitado al contenido público del CV.
- Tiene prompts predefinidos.
- Tiene botón para limpiar chat.
- Tiene botón flotante persistente con dos acciones rígidas:
  - `Escuchar resumen`
  - `Abrir chat`
- Si la sección del asistente ya está visible, el botón flotante debe ocultarse para no duplicar foco.

### PDF

- Se ha descartado por ahora el botón PDF dentro de la web.
- La exportación en navegador no ha quedado a la altura del proyecto.
- Estrategia temporal:
  - impresión desde navegador si se necesita algo rápido
- Estrategia seria futura:
  - Playwright `page.pdf()`
  - Puppeteer `page.pdf()`

### Footer

- Footer pequeño y sobrio.
- Copyright y año actual.

### SEO y naming

- Naming oficial actual:
  - `Lead Data Engineer`
- Se mantiene ese naming en ambas versiones de la web por posicionamiento, mercado y alineación con búsquedas reales.
- En español se puede explicar de forma natural como:
  - `perfil de liderazgo técnico en ingeniería de datos`
  - `gobierno del dato, interoperabilidad y calidad del dato`
- Títulos de pestaña:
  - ES: `Ismael Sarmiento | Lead Data Engineer en Savana`
  - EN: `Ismael Sarmiento | Lead Data Engineer at Savana`
- El contenido clave de posicionamiento no debe depender solo de JavaScript.
- GitHub debe estar visible tanto en contenido como en señales SEO.

## 4. Dirección visual actual

- Estética `premium sobria`.
- Paleta azul clínico + acento cálido.
- Tipografía:
  - `Sora`
  - `IBM Plex Sans`
  - `IBM Plex Mono`
- Dark/light mode.
- Navegación sticky.
- Hero editorial con gran titular.
- Sección derecha de home con resumen de trayectoria y capas.

## 5. Estado actual del producto

### Ya implementado

- Loader inicial con hitos.
- Hero bilingüe.
- SEO técnico base compatible con GitHub Pages:
  - `robots.txt`
  - `sitemap.xml`
  - `canonical`
  - `hreflang`
  - `JSON-LD` con `ProfilePage` + `Person`
- Resumen ejecutivo.
- Panel de trayectoria con capas.
- Sección Savana bien desarrollada.
- Casos destacados.
- Trayectoria compacta.
- Contacto.
- Asistente local beta.
- Botón flotante del asistente.
- Footer.
- Cambio ES/EN.
- Dark/light.

### Pendiente o mejorable

- Más pulido visual de responsive, especialmente móvil.
- Más afinado de spacing y densidad en la home.
- OG image final más afinada.
- Solución PDF robusta fuera del navegador.
- Adaptación a LinkedIn.
- Simulaciones de entrevista.

## 5.1 Historia y evolución resumida del producto

### Fase 0. Necesidad original

- Se identifica la necesidad de un `CV online` propio.
- El problema no era solo visual, sino de posicionamiento y narrativa profesional.
- El objetivo era superar las limitaciones de:
  - CV PDF tradicional
  - perfil de LinkedIn como canal único

### Fase 1. Base técnica mínima

- Se decide usar GitHub Pages.
- Se descarta backend.
- Se adopta arquitectura estática y bilingüe.
- Se fijan dos entradas públicas reales:
  - `/`
  - `/index_en.html`

### Fase 2. Producto visible

- Se construye hero editorial.
- Se añade loader con hitos de impacto.
- Se estructura narrativa profesional y casos destacados.
- Se construye una versión más rica que un currículum lineal.

### Fase 3. Diferenciación funcional

- Se añade asistente local beta.
- Se incorporan resúmenes en audio.
- Se mantiene la lógica de privacidad:
  - sin backend
  - sin LLM externo
  - limitado al contenido público del CV

### Fase 4. SEO y posicionamiento

- Se añaden `robots.txt`, `sitemap.xml`, `canonical`, `hreflang` y `JSON-LD`.
- Se refuerza la presencia visible de términos clave.
- Se introduce contenido HTML indexable para no depender solo de JavaScript.
- Se visibiliza GitHub como señal profesional y SEO.

### Fase 5. Cierre de naming y tono

- Se valida `Lead Data Engineer` como naming principal.
- Se adapta la versión española para que suene natural sin perder posicionamiento.
- Se revisa el inglés para que funcione mejor en entrevistas.
- Se corrige la estrategia del audio inglés.

## 6. Criterio de producto y copy

La voz debe ser:

- fuerte
- sobria
- precisa
- profesional
- recruiter-friendly
- CTO-friendly
- sin humo

Evitar:

- exceso de storytelling vacío
- frases abstractas sin aterrizar
- mezcla innecesaria de idiomas
- saturar el hero con stack

Regla editorial:

- español en la versión española
- inglés en la versión inglesa
- excepción deliberada:
  - mantener `Lead Data Engineer` como cargo objetivo también en español cuando ayude a posicionamiento y consistencia con LinkedIn
- mantener en inglés solo nombres propios, estándares y productos cuando tenga sentido:
  - AWS
  - Apache Spark
  - Apache Airflow
  - Apache Superset
  - DataHub
  - HL7 FHIR
  - OMOP CDM

## 7. Hitos de impacto que deben priorizarse

Los hitos dan más impacto que listar empresas sin contexto. En el loader y en los primeros segundos de la web conviene enfatizar esto:

- modernización cloud de soluciones de datos
- sistemas batch y streaming de alta exigencia
- visión end-to-end de plataformas de datos
- interoperabilidad clínica con HL7 FHIR y OMOP
- calidad del dato, metadatos y ciclo de vida como producto

## 8. Carrera profesional detallada

### 8.1 Savana

Evolución:

`Senior Data Engineer → Lead Data Engineer → Head of Data Management`

Resumen:

Savana es la etapa donde la carrera de Ismael da un salto más claro hacia liderazgo técnico, producto y especialización fuerte en dato clínico. Aquí no solo desarrolla soluciones, sino que articula capacidades transversales de gobierno del dato, interoperabilidad, calidad y ciclo de vida del dato dentro de un contexto muy exigente y muy sensible por el dominio salud.

Responsabilidades y aportación:

- evolución desde ejecución técnica pura a liderazgo técnico con visión transversal
- fuerte cercanía a la construcción de soluciones y al diseño de producto
- definición de capacidades reutilizables, no solo de pipelines aislados
- conexión entre necesidades de negocio, cumplimiento, operativa y arquitectura

Áreas clave:

- interoperabilidad clínica con HL7 FHIR
- interoperabilidad y normalización analítica con OMOP CDM
- plataforma de calidad del dato construida desde cero
- marcos UNE/ISO de calidad del dato
- catálogo, metadatos y linaje con DataHub
- monitorización del ciclo de vida del dato
- evolución del Data Model Explorer desde Power BI hacia Apache Superset
- procesos de Data Offboarding

Valor que demuestra:

- capacidad de convertir requisitos complejos en producto de datos
- seniority técnico real
- especialización en salud digital e interoperabilidad
- visión de plataforma y gobierno, no solo de integración

Mensajes defendibles en entrevista:

- “No trabajo solo el procesamiento del dato; trabajo la estructura de confianza que permite usarlo.”
- “He impulsado interoperabilidad para intercambio operativo y analítica avanzada, no solo mapeos puntuales.”
- “La calidad del dato en Savana no la entendí como control disperso, sino como capacidad de producto reutilizable.”
- “Mi evolución interna demuestra que he ganado responsabilidad manteniéndome cerca de la ejecución.”

### 8.2 Stratio

Resumen:

Stratio aporta la capa de madurez sobre plataforma end-to-end. Aquí Ismael consolida una visión más completa del dato: ingesta, procesamiento, modelado, gobierno, observabilidad y explotación.

Aportación:

- diseño de integración y analítica sobre Apache Spark
- experiencia real en plataformas de datos completas
- comprensión de observabilidad, escalabilidad y explotación a escala
- exposición a una visión más sistémica del ciclo del dato

Valor que demuestra:

- no es un perfil aislado de ETL, sino alguien que entiende plataformas completas
- tiene base real de ingeniería a escala
- puede hablar de arquitectura, operación y explotación

Mensajes defendibles en entrevista:

- “Stratio me dio una visión end-to-end del dato que luego me permitió construir soluciones más completas.”
- “Ahí reforcé una base clara en plataforma, integración y explotación operable.”

### 8.3 Santander

Resumen:

Santander aporta credibilidad en entornos de alta exigencia operativa. Es una etapa importante por la exposición a fiabilidad, rendimiento, procesamiento batch y streaming.

Aportación:

- trabajo en plataforma bancaria de alto rendimiento
- uso de Apache Spark, Apache Flink, Apache Kafka y Hazelcast
- exposición a sistemas donde la fiabilidad operativa no era negociable

Valor que demuestra:

- solidez en sistemas críticos
- experiencia en tiempo real y batch
- tolerancia a entornos técnicos exigentes

Mensajes defendibles en entrevista:

- “Santander reforzó una base de fiabilidad y exigencia operativa que sigo aplicando hoy.”
- “Allí entendí mejor lo que significa operar tecnología cuando fallar no es una opción.”

### 8.4 BBVA

Resumen:

BBVA aporta conexión entre negocio, automatización y cloud. Es una fase importante para demostrar transición desde desarrollo clásico hacia soluciones de datos con más componente de utilidad real.

Aportación:

- modernización de soluciones de datos para fondos, pensiones y analítica corporativa
- migraciones hacia AWS
- automatización y foco en utilidad de negocio

Valor que demuestra:

- capacidad de traducir técnica en utilidad
- conocimiento de entornos corporativos complejos
- base cloud relevante

Mensajes defendibles en entrevista:

- “BBVA fue clave para conectar automatización, cloud y valor de negocio.”
- “Me ayudó a pasar de una lógica más de desarrollo a una lógica más de solución de datos.”

### 8.5 Autana

Resumen:

Autana es la base inicial. No es la etapa más visible para vender seniority, pero sí da contexto y continuidad a la carrera.

Aportación:

- primeros pasos en analítica social y geográfica
- tratamiento de datos
- contacto temprano con contexto de negocio
- base de entrega de soluciones

Valor que demuestra:

- continuidad
- recorrido real
- base profesional temprana en dato y contexto

## 9. Especialización profesional

Bloques de especialización que deben salir muy claros:

- Gobierno del dato aplicado a producto
- Interoperabilidad clínica con propósito
- Calidad del dato como capacidad de producto
- Metadatos, catálogo y linaje
- Control del ciclo de vida del dato
- Liderazgo técnico cercano a la entrega
- Documentación, mentoring y docencia

## 10. Asociaciones, aprendizaje y docencia

- Miembro de DAMA
- formación continua
- certificaciones
- AWS Certified Solutions Architect – Associate
- formación relacionada con HL7 FHIR
- mentoring y docencia
- formación interna a lo largo de varias etapas profesionales
- acompañamiento a personas que quieren entrar en el mundo del dato

## 11. Tecnologías, estándares y conceptos a tener presentes

- AWS
- Apache Spark
- Apache Airflow
- Apache Superset
- DataHub
- HL7 FHIR
- OMOP CDM
- Data Governance
- Data Quality
- Metadata & Lineage
- Data Lifecycle
- Data Offboarding
- Observabilidad
- Catálogo de datos

## 12. Links contrastados

- AWS: `https://aws.amazon.com/`
- Apache Spark: `https://spark.apache.org/`
- Apache Airflow: `https://airflow.apache.org/`
- Apache Superset: `https://superset.apache.org/`
- DataHub: `https://datahubproject.io/`
- HL7 FHIR: `https://hl7.org/fhir/overview.html`
- OMOP CDM: `https://ohdsi.github.io/CommonDataModel/`
- DAMA: `https://www.damaspain.org/`
- Savana: `https://savanamed.com/about-us/`
- Stratio: `https://www.stratio.com/`

## 13. Valoración simulada actual por perfiles

- CEO: `8.3/10`
- CTO: `8.6/10`
- Lead Data Engineer: `8.5/10`
- Recruiter tech: `8.4/10`
- Hiring Manager de salud digital: `8.7/10`
- Redactor / copy reviewer: `8.2/10`
- Historiador de carrera profesional: `8.8/10`

Lectura breve:

- el posicionamiento está claro
- la especialización es visible
- la progresión profesional es creíble
- el producto está bien encaminado
- el siguiente salto de calidad depende sobre todo de pulido visual y SEO

## 13.1 Lectura multiperspectiva de la web

### Recruiter

- El cargo objetivo ya es reconocible y buscable.
- La evolución en Savana transmite progresión real.
- Aun así, conviene reforzar en algunos puntos señales rápidas de empleabilidad:
  - ubicación
  - disponibilidad
  - tipo de liderazgo

### CEO

- La web transmite seriedad, criterio y especialización.
- Se percibe que el perfil trabaja problemas de alto valor y no solo ejecución táctica.
- Lo que todavía puede crecer es la traducción del impacto a negocio en lenguaje más directo.

### CTO

- La combinación de plataforma, gobierno, interoperabilidad y calidad resulta creíble.
- El perfil suena senior y con criterio técnico.
- Falta todavía algo más de evidencia visible sobre escala, trade-offs y decisiones de arquitectura concretas.

### Hiring Manager

- La propuesta encaja bien para roles donde se necesite mezclar entrega, plataforma y standards.
- La narrativa de evolución profesional ayuda a justificar confianza.
- Sería útil dejar todavía más claro el alcance de liderazgo:
  - mentoring
  - coordinación
  - ownership técnico

### Historiador de carrera profesional

- La trayectoria se entiende como una evolución coherente, no como saltos aleatorios.
- La historia de Savana funciona como eje narrativo fuerte.
- La web ya documenta mejor la evolución que un CV PDF tradicional.

### Persona no técnica

- El tono transmite solvencia y orden.
- El primer impacto visual es fuerte.
- Parte del vocabulario sigue siendo exigente, así que conviene mantener explicaciones simples alrededor de FHIR, OMOP o DataHub.

### Psicóloga o perfil de evaluación humana

- El tono proyecta calma, criterio y madurez profesional.
- Se percibe responsabilidad y pensamiento estructurado.
- El siguiente paso de mejora sería introducir algo más de humanidad controlada sin perder sobriedad:
  - colaboración
  - contexto de equipo
  - forma de trabajar con otros

### Ingeniero

- La web ya no suena a marketing vacío.
- Se ve especialización real y un stack/criterio defendible.
- Aun así, un ingeniero senior buscará más detalles concretos en:
  - decisiones difíciles
  - límites
  - compromisos técnicos

### Lupa terminológica

- `Lead Data Engineer` debe mantenerse como naming principal.
- En español conviene evitar alternar muchas variantes del cargo.
- El resto del copy debe seguir usando español natural y reservar el inglés para:
  - cargos estratégicos
  - estándares
  - nombres propios

### Lupa sanitaria

- Savana, interoperabilidad clínica, HL7 FHIR y OMOP generan credibilidad sectorial.
- El discurso sanitario ya no parece decorativo.
- Aporta mucho cuando se explica el valor en términos de dato clínico fiable, reutilizable y útil para decisiones.

### Lupa bancaria

- El paso por banca sigue dando señal de robustez, disciplina y exigencia operativa.
- Esa parte no debería desaparecer porque refuerza la idea de sistemas confiables y contexto regulado.

## 14. Puntos fuertes actuales de la web

- home potente y reconocible
- identidad visual coherente
- propuesta de valor clara
- narrativa fuerte de Savana
- casos destacados bien planteados
- trayectoria compacta clara
- asistente local interesante como diferenciador

## 15. Debilidades actuales

- todavía queda ajuste fino de spacing y jerarquía
- mobile necesita validación real
- el asistente flotante debe seguir afinándose con uso real
- no existe una solución PDF final robusta
- falta validar indexación real, snippets y comportamiento en buscadores tras despliegue

## 16. Próximos pasos recomendados

1. Revisión visual final de desktop y móvil.
2. Pulido fino del hero y del panel derecho si todavía se percibe desequilibrio.
3. Verificar despliegue real en GitHub Pages.
4. Dar de alta y revisar `sitemap.xml` en Google Search Console.
5. OG image final mejorada.
6. Adaptación a LinkedIn.
7. Preparación de entrevistas simuladas.
8. Si se necesita PDF profesional, montar flujo con Playwright o Puppeteer.

## 17. Base para entrevistas simuladas

### Tipos de entrevistas a simular

- recruiter generalista
- recruiter tech
- CTO
- director de datos
- hiring manager de salud digital
- lead data engineer
- entrevista en inglés

### Ejes sobre los que conviene simular

- trayectoria y narrativa profesional
- Savana y promoción interna
- interoperabilidad clínica
- HL7 FHIR y OMOP
- calidad del dato
- DataHub y metadatos
- liderazgo técnico
- criterios de arquitectura
- docencia y mentoring

### Preguntas clave que conviene practicar

- ¿Cómo resumirías tu trayectoria en dos minutos?
- ¿Qué te diferencia de otros perfiles de data engineering?
- ¿Qué construiste exactamente en Savana?
- ¿Cómo entiendes la interoperabilidad clínica en términos prácticos?
- ¿Qué significa para ti tratar la calidad del dato como producto?
- ¿Cómo equilibras entrega, gobierno y escalabilidad?
- ¿Qué parte de tu evolución profesional te ha preparado mejor para liderar?
- ¿Cómo explicarías HL7 FHIR y OMOP a un perfil no técnico?

### Clave estratégica para responder

No caer en solo tecnología. La mejor narrativa es:

- problema complejo
- capacidad construida
- criterio aplicado
- impacto operativo o de producto

## 18. Instrucciones y aprendizajes para otro LLM

### Reglas de intervención

Si otro LLM retoma este proyecto, debe:

1. Respetar este documento como fuente principal de verdad.
2. No reabrir decisiones ya cerradas salvo que exista una razón muy fuerte.
3. Mantener tono sobrio, profesional y preciso.
4. Evitar mezcla innecesaria de idiomas.
5. Tratar el PDF como problema aparte, no contaminar la web intentando resolverlo con hacks.
6. Si hace cambios visuales, priorizar:
   - jerarquía
   - legibilidad
   - equilibrio
   - credibilidad

### Aprendizajes ya confirmados

- El proyecto funciona mejor cuando se trata como un `CV online` con objetivos profesionales reales, no como un portfolio creativo genérico.
- La narrativa de evolución profesional importa tanto como la lista de tecnologías.
- `Lead Data Engineer` es el naming principal más sólido para mercado, consistencia pública y posicionamiento.
- La versión española debe sonar natural y defendible oralmente, aunque conserve ciertos términos estratégicos en inglés.
- El inglés debe escribirse pensando en entrevistas futuras:
  - claro
  - directo
  - natural
  - sin grandilocuencia
- El SEO no puede depender solo de JavaScript:
  - debe existir contenido HTML indexable
  - deben cuidarse `title`, `description`, `canonical`, `hreflang` y `JSON-LD`
- La historia en Savana es una pieza central de credibilidad y debe seguir visible.
- La trazabilidad documental no es un extra:
  - es parte del sistema de mantenimiento del proyecto

### Qué revisar antes de cambiar algo importante

- headline principal del hero
- subtítulo y resumen inicial
- metadatos SEO ES y EN
- datos estructurados
- consistencia entre web, LinkedIn y GitHub
- trazabilidad del propio cambio

## 19. Archivo único

Este archivo reemplaza como referencia única a documentos previos de notas y prompt. Si en el futuro se actualiza el contexto del proyecto, este debe seguir siendo el documento maestro.

## 20. Trazabilidad de cambios recientes

### 2026-03-17

Objetivo del bloque:

- cerrar el naming principal del perfil
- mejorar consistencia editorial ES/EN
- reforzar SEO técnico y contenido indexable
- corregir la estrategia del audio en inglés

Decisiones tomadas:

- Se adopta `Lead Data Engineer` como naming principal en toda la web.
- En la versión española se mantiene ese naming en el cargo, pero el resto del copy se hace más natural y recruiter-friendly.
- `Líder de Ingeniería de Datos` deja de ser el headline principal y pasa a ser una explicación posible del rol, no la etiqueta oficial visible.
- Se mantiene `Head of Data Management` como parte de la progresión profesional en Savana.

Evidencia usada para naming:

- Consulta realizada el `2026-03-17` sobre páginas públicas de LinkedIn Jobs.
- Resultado observado en Europa:
  - `19,000+ Lead Data Engineer jobs in Europe`
  - `3,000+ Data Engineering Lead jobs in Europe`
- Resultado observado en España:
  - `1,000+ Lead Data Engineer jobs in Spain`
  - `284 Data Engineering Lead jobs in Spain`
  - `274 Líder de Ingeniería de Datos jobs in Spain`
- Conclusión:
  - `Lead Data Engineer` es la mejor opción para posicionamiento y alineación con mercado.

Cambios aplicados en contenido:

- hero y resumen reescritos para sonar más naturales en entrevista
- narrativa de Savana simplificada y hecha más defendible oralmente
- FAQs revisadas para evitar tono rígido o demasiado literal
- mención visible de `GitHub` añadida en la presencia profesional
- limpieza de mezcla innecesaria de idiomas, salvo en el cargo objetivo y nombres propios

Cambios aplicados en SEO:

- `title`, `description`, `Open Graph` y `Twitter cards` actualizados con `Lead Data Engineer`, `Savana` y `GitHub`
- `JSON-LD` reforzado con `Person`, `Occupation`, `sameAs` y keywords
- contenido profesional visible añadido en HTML estático para no depender solo de JavaScript
- `rel="me"` añadido para LinkedIn y GitHub

Cambios aplicados en audio:

- El audio inglés estático se consideró de peor calidad que el español.
- Se cambia la estrategia:
  - español sigue pudiendo usar audio estático
  - inglés pasa a usar por defecto la voz del navegador
- Se redacta un guion inglés más corto, natural y usable en entrevista.

Ficheros tocados en este bloque:

- `assets/content.js`
- `assets/app.js`
- `index.html`
- `index_en.html`

Limitaciones de validación en esta sesión:

- `git diff --check` quedó limpio
- no había runtime JS disponible en el entorno para validar sintaxis con `node`, `jsc` o `bun`

Fuentes de contraste usadas para la decisión de naming:

- `https://www.linkedin.com/jobs/lead-data-engineer-jobs-europe`
- `https://www.linkedin.com/jobs/data-engineering-lead-jobs-europe`
- `https://es.linkedin.com/jobs/lead-data-engineer-empleos`
- `https://es.linkedin.com/jobs/data-engineering-lead-empleos`
- `https://es.linkedin.com/jobs/l%C3%ADder-de-ingenier%C3%ADa-de-datos-empleos`

### 2026-03-17 - Estructura del documento maestro

Objetivo del bloque:

- reforzar este `md` como documento operativo para futuros LLMs
- hacer más visible el origen del proyecto como necesidad de un `CV online`
- dejar mejor separadas las capas de requisitos, evolución, aprendizaje y trazabilidad

Motivación:

- evitar que futuras sesiones pierdan contexto de negocio y de posicionamiento
- reducir re-trabajo al retomar decisiones ya validadas
- facilitar continuidad entre sesiones, versiones y derivados del proyecto

Cambios aplicados:

- requisitos no negociables reorganizados por capas:
  - producto
  - contenido y posicionamiento
  - mantenimiento
- mapa del documento añadido al inicio para orientar a futuros LLMs
- sección de instrucciones ampliada con aprendizajes ya confirmados
- checklist previa a cambios grandes añadida para reducir incoherencias

Fichero tocado:

- `PROJECT_CONTEXT.md`

Validación realizada:

- revisión manual de estructura y coherencia del documento
- `git diff --check` limpio

### 2026-03-17 - Audio inglés, layout del hero y naming documental

Objetivo del bloque:

- corregir la mala percepción del audio inglés
- cerrar el hueco visual detectado en la zona de `Capas`
- dejar más claro el rol de `README.md` frente al documento maestro

Motivación:

- el audio inglés previo seguía sonando mal o demasiado dependiente de voces variables del navegador
- en el hero existía una separación visual excesiva en el panel derecho
- el nombre `personal-cv-llm-brief.md` era útil internamente, pero poco limpio como referencia de proyecto

Decisiones tomadas:

- el inglés vuelve a priorizar audio estático
- se añade estrategia multi-formato para el audio inglés:
  - `m4a`
  - `wav`
- el TTS del navegador queda solo como fallback real
- se priorizan voces inglesas más naturales en el fallback:
  - `Daniel`
  - `Moira`
  - `Karen`
- el documento maestro se renombra a `PROJECT_CONTEXT.md`
- `README.md` se mantiene como puerta de entrada humana y técnica del repo

Aprendizajes confirmados:

- en inglés es mejor evitar demasiados estándares pronunciados letra por letra si empeoran la naturalidad del audio
- el layout del hero no debía forzar alturas iguales entre columnas
- para mantenimiento a medio plazo, separar `README.md` y documento maestro mejora claridad

Cambios aplicados:

- audio:
  - nuevo guion inglés más natural
  - soporte de múltiples fuentes estáticas
  - mejora en selección de voz fallback
- layout:
  - la rejilla del hero deja de estirar paneles de forma artificial
  - el panel derecho alinea su contenido al inicio
  - el título `Capas` deja de forzar un hueco visual raro
- documentación:
  - renombrado del documento maestro a `PROJECT_CONTEXT.md`
  - `README.md` actualizado para reflejar la nueva estructura
  - lectura multiperspectiva añadida para futuras revisiones

Ficheros tocados:

- `assets/app.css`
- `assets/app.js`
- `assets/content.js`
- `README.md`
- `PROJECT_CONTEXT.md`

Validación realizada:

- generación local de audio inglés con voz del sistema fuera del sandbox
- comprobación con `afinfo` de duración, formato y existencia de los audios generados
- validación lógica del flujo:
  - audio estático multi-formato
  - fallback a TTS solo si falla
- `git diff --check` limpio

## 21. Plantilla de log de cambios

Usar esta plantilla cada vez que se haga una iteración relevante:

```md
### YYYY-MM-DD

Objetivo del bloque:

- ...
- ...

Motivación:

- ...
- ...

Decisiones tomadas:

- ...
- ...

Aprendizajes confirmados:

- ...
- ...

Cambios aplicados:

- contenido:
  - ...
- visual:
  - ...
- SEO:
  - ...
- audio / interacción:
  - ...

Ficheros tocados:

- `...`
- `...`

Validación realizada:

- ...
- ...

Riesgos o limitaciones:

- ...
- ...

Siguientes pasos sugeridos:

1. ...
2. ...
3. ...
```

## 22. Regla de mantenimiento del documento

Cada cambio importante debe actualizar dos capas:

- la capa estable:
  - decisiones maestras
  - requisitos
  - estado del producto
- la capa histórica:
  - trazabilidad con fecha

Si solo se actualiza una de las dos, el documento deja de ser fiable para futuros LLMs.

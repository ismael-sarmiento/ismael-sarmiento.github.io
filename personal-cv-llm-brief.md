# Personal CV LLM Brief

Fecha de consolidación: 2026-03-16
Proyecto: `ismael-sarmiento.github.io`
Objetivo: servir como fuente única de verdad para cualquier LLM que tenga que continuar el trabajo de la web CV, preparar simulaciones de entrevista o adaptar el contenido a LinkedIn u otros canales.

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
  - `Líder de Ingeniería de Datos`
- Headline secundario:
  - `Gobierno, Interoperabilidad y Calidad del Dato`
- Subtítulo:
  - `Ingeniería de datos para productos y plataformas gobernadas, interoperables y orientadas a la calidad del dato.`
- Mensaje principal:
  - `Transformo datos complejos en plataformas confiables e interoperables para que datos de calidad se traduzcan en decisiones de impacto real.`

Versión inglesa:

- Headline principal:
  - `Lead Data Engineer`
- Headline secundario:
  - `Governance, Interoperability & Data Quality`
- Subtítulo:
  - `Data engineering for governed, interoperable products and platforms built around data quality.`
- Mensaje principal:
  - `I transform complex data into reliable, interoperable platforms so that quality data can become decisions with real impact.`

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

- Título de pestaña:
  - `Ismael Sarmiento | CV`
- No debe depender del cargo actual para evitar mantenimiento futuro.

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

`Ingeniero de Datos Senior → Líder de Ingeniería de Datos → Head of Data Management`

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
- falta trabajo técnico de SEO y metadatos estructurados

## 16. Próximos pasos recomendados

1. Revisión visual final de desktop y móvil.
2. Pulido fino del hero y del panel derecho si todavía se percibe desequilibrio.
3. SEO técnico:
   - `robots.txt`
   - `sitemap.xml`
   - datos estructurados
4. OG image final mejorada.
5. Adaptación a LinkedIn.
6. Preparación de entrevistas simuladas.
7. Si se necesita PDF profesional, montar flujo con Playwright o Puppeteer.

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

## 18. Instrucciones para otro LLM

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

## 19. Archivo único

Este archivo reemplaza como referencia única a documentos previos de notas y prompt. Si en el futuro se actualiza el contexto del proyecto, este debe seguir siendo el documento maestro.

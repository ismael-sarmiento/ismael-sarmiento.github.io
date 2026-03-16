window.CV_CONTENT = {
  meta: {
    siteName: "Ismael Sarmiento",
    siteUrl: "https://ismael-sarmiento.github.io/",
    email: "ismaelantonio.professional@gmail.com",
    linkedin: "https://www.linkedin.com/in/ismael-sarmiento",
    github: "https://github.com/isarmiento",
    currentCompany: "https://savanamed.com/about-us/",
    title: {
      es: "Ismael Sarmiento | CV",
      en: "Ismael Sarmiento | CV",
    },
    description: {
      es: "CV interactivo de Ismael Sarmiento. Perfil especializado en gobierno del dato, interoperabilidad y calidad del dato para productos y plataformas de datos.",
      en: "Interactive CV of Ismael Sarmiento. Profile focused on data governance, interoperability, and data quality for data products and platforms.",
    },
  },
  ui: {
    es: {
      skipToContent: "Ir al contenido principal",
      brandTagline: "Ingeniería del dato con impacto real",
      navigation: {
        summary: "Resumen",
        story: "Historia",
        cases: "Casos",
        timeline: "Trayectoria",
        pdf: "PDF",
      },
      actions: {
        summaryMode: "Modo resumen",
        fullMode: "Ver historia completa",
        print: "Exportar CV en PDF",
        summaryCta: "Ver resumen ejecutivo",
        contactCta: "Hablemos",
        assistantCta: "Preguntar al asistente (beta)",
        language: "Cambiar idioma",
        theme: "Cambiar tema",
        menu: "Abrir navegación",
        close: "Cerrar",
        skipLoader: "Saltar intro",
        clearChat: "Limpiar chat",
      },
      labels: {
        keyValue: "Qué aporto",
        stack: "Ecosistema",
        progression: "Progresión",
        currentFocus: "Foco actual",
        timeline: "Trayectoria",
        credentials: "Credenciales",
        assistant: "Asistente local",
        overview: "Resumen de trayectoria",
        layers: "Capas",
        printStamp: "Exportado",
      },
      assistant: {
        note:
          "Asistente local del CV. Responde a partir del contenido público de esta página y no utiliza datos privados ni conexión a modelos externos.",
        audioTitle: "Resumen en audio",
        audioNote:
          "Puedes reproducir un resumen corto en español o en inglés. Si no existe un audio estático todavía, la web usará la voz disponible del navegador como fallback.",
        inputPlaceholder: "Pregunta por experiencia, capacidades o proyectos...",
        send: "Enviar",
        launcherTitle: "Asistente",
        launcherQuestion: "¿Qué quieres hacer?",
        summaryEs: "Resumen ES",
        summaryEn: "Summary EN",
        openChat: "Abrir chat",
        stopAudio: "Detener audio",
        audioLoading: "Preparando audio...",
        audioStaticEs: "Reproduciendo audio estático en español.",
        audioStaticEn: "Reproduciendo audio estático en inglés.",
        audioFallbackEs: "Usando la voz del navegador para el resumen en español.",
        audioFallbackEn: "Using browser voice for the English summary.",
        empty:
          "Puedo resumir experiencia en Savana, interoperabilidad con FHIR y OMOP, calidad del dato, DataHub, trayectoria, seguridad del asistente o forma de trabajo.",
        noMatch:
          "No tengo una respuesta exacta para eso en esta versión beta. Puedo responder sobre experiencia, capacidades, seguridad del asistente, docencia, contacto o límites de privacidad.",
      },
    },
    en: {
      skipToContent: "Skip to main content",
      brandTagline: "Data engineering with real impact",
      navigation: {
        summary: "Summary",
        story: "Story",
        cases: "Cases",
        timeline: "Career",
        pdf: "PDF",
      },
      actions: {
        summaryMode: "Summary mode",
        fullMode: "View full story",
        print: "Export CV as PDF",
        summaryCta: "View executive summary",
        contactCta: "Let's talk",
        assistantCta: "Ask the assistant (beta)",
        language: "Change language",
        theme: "Change theme",
        menu: "Open navigation",
        close: "Close",
        skipLoader: "Skip intro",
        clearChat: "Clear chat",
      },
      labels: {
        keyValue: "What I bring",
        stack: "Ecosystem",
        progression: "Progression",
        currentFocus: "Current focus",
        timeline: "Timeline",
        credentials: "Credentials",
        assistant: "Local assistant",
        overview: "Career snapshot",
        layers: "Layers",
        printStamp: "Exported",
      },
      assistant: {
        note:
          "Local CV assistant. It answers from the public content on this page and does not use private data or any external model connection.",
        audioTitle: "Audio summary",
        audioNote:
          "You can play a short summary in Spanish or English. If a static audio file is not available yet, the site will fall back to the browser voice.",
        inputPlaceholder: "Ask about experience, capabilities, or projects...",
        send: "Send",
        launcherTitle: "Assistant",
        launcherQuestion: "What do you want to do?",
        summaryEs: "Resumen ES",
        summaryEn: "Summary EN",
        openChat: "Open chat",
        stopAudio: "Stop audio",
        audioLoading: "Preparing audio...",
        audioStaticEs: "Playing static Spanish audio.",
        audioStaticEn: "Playing static English audio.",
        audioFallbackEs: "Using browser voice for the Spanish summary.",
        audioFallbackEn: "Using browser voice for the English summary.",
        empty:
          "I can summarize Savana experience, FHIR and OMOP interoperability, Data Quality, DataHub, career path, assistant safety, or working style.",
        noMatch:
          "I do not have an exact answer for that in this beta version. I can answer about experience, capabilities, assistant safety, teaching, contact, or privacy limits.",
      },
    },
  },
  links: [
    { label: "AWS", href: "https://aws.amazon.com/" },
    { label: "Apache Spark", href: "https://spark.apache.org/" },
    { label: "Apache Airflow", href: "https://airflow.apache.org/" },
    { label: "Apache Superset", href: "https://superset.apache.org/" },
    { label: "DataHub", href: "https://datahubproject.io/" },
    { label: "HL7 FHIR", href: "https://hl7.org/fhir/overview.html" },
    { label: "OMOP CDM", href: "https://ohdsi.github.io/CommonDataModel/" },
    { label: "DAMA", href: "https://www.damaspain.org/" },
    { label: "Savana", href: "https://savanamed.com/about-us/" },
    { label: "Stratio", href: "https://www.stratio.com/" },
  ],
  audio: {
    es: {
      label: "Resumen ES",
      src: "./assets/audio/resumen-es.wav",
    },
    en: {
      label: "Summary EN",
      src: "./assets/audio/summary-en.wav",
    },
  },
  loader_milestones: {
    es: [
      "Modernización cloud de soluciones de datos",
      "Sistemas batch y streaming de alta exigencia",
      "Visión end-to-end de plataformas de datos",
      "Interoperabilidad clínica con HL7 FHIR y OMOP",
      "Calidad del dato, metadatos y ciclo de vida como producto",
    ],
    en: [
      "Cloud modernization for data solutions",
      "High-demand batch and streaming systems",
      "End-to-end data platform perspective",
      "Clinical interoperability with HL7 FHIR and OMOP",
      "Data quality, metadata, and lifecycle as product capabilities",
    ],
  },
  hero: {
    headlinePrimary: {
      es: "Líder de Ingeniería de Datos",
      en: "Lead Data Engineer",
    },
    headlineSecondary: {
      es: "Gobierno, Interoperabilidad y Calidad del Dato",
      en: "Governance, Interoperability & Data Quality",
    },
    subtitle: {
      es: "Ingeniería de datos para productos y plataformas gobernadas, interoperables y orientadas a la calidad del dato.",
      en: "Data engineering for governed, interoperable products and platforms built around data quality.",
    },
    message: {
      es: "Transformo datos complejos en plataformas confiables e interoperables para que datos de calidad se traduzcan en decisiones de impacto real.",
      en: "I transform complex data into reliable, interoperable platforms so that quality data can become decisions with real impact.",
    },
    trajectoryHeading: {
      es: "Resumen de trayectoria",
      en: "Career snapshot",
    },
    trajectoryIntro: {
      es: [
        "Mi trayectoria parte de una base sólida en desarrollo de software e ingeniería de datos y evoluciona hacia un perfil más completo, donde plataforma, gobierno del dato, interoperabilidad clínica y calidad end-to-end trabajan como una misma capacidad. He pasado por entornos de banca, producto y salud digital construyendo soluciones que debían ser fiables, operables y útiles para decisiones reales.",
        "Ese recorrido me ha permitido consolidar una propuesta de valor poco común: combinar ejecución técnica, criterio arquitectónico y visión de producto para convertir problemas complejos del dato en capacidades reutilizables. Hoy no aporto solo pipelines o integraciones, sino estructuras de confianza alrededor del dato: estándares, calidad, metadatos, trazabilidad y control del ciclo de vida.",
      ],
      en: [
        "My career started with a strong foundation in software development and data engineering and evolved into a broader profile where platform thinking, data governance, clinical interoperability, and end-to-end quality work as one capability. I have worked across banking, product, and digital health environments building solutions that needed to be reliable, operable, and useful for real decisions.",
        "That path allowed me to consolidate a less common value proposition: combining technical execution, architectural judgment, and product thinking to turn complex data problems into reusable capabilities. Today I do not bring only pipelines or integrations, but trust structures around data: standards, quality, metadata, traceability, and lifecycle control.",
      ],
    },
    layers: {
      es: [
        {
          title: "Capa de gobernanza",
          text: "Catálogo, metadatos y ownership centralizados con DataHub para hacer el dato entendible y gobernable.",
        },
        {
          title: "Capa de interoperabilidad",
          text: "Transformación de datos clínicos hacia HL7 FHIR y OMOP para intercambio operativo y analítica avanzada.",
        },
        {
          title: "Capa de calidad y ciclo de vida",
          text: "Calidad del dato, observabilidad y Data Offboarding para seguir el dato desde su entrada hasta su bloqueo o eliminación.",
        },
      ],
      en: [
        {
          title: "Governance layer",
          text: "Cataloging, metadata, and ownership centralized with DataHub to make data understandable and governable.",
        },
        {
          title: "Interoperability layer",
          text: "Clinical data transformation toward HL7 FHIR and OMOP for operational exchange and advanced analytics.",
        },
        {
          title: "Quality & lifecycle layer",
          text: "Data Quality, observability, and Data Offboarding to track data from ingestion to blocking or deletion.",
        },
      ],
    },
    proofPoints: {
      es: [
        {
          title: "Gobierno del dato aplicado a producto",
          body: "Diseño capacidades reutilizables de catálogo, metadatos, calidad y control operativo, no solo pipelines aislados.",
        },
        {
          title: "Interoperabilidad clínica con propósito",
          body: "Conecto intercambio operativo y analítica avanzada sobre estándares como HL7 FHIR y OMOP CDM.",
        },
        {
          title: "Calidad, trazabilidad y control",
          body: "Trabajo el ciclo de vida completo del dato, desde su entrada y validación hasta su monitorización, bloqueo o eliminación.",
        },
      ],
      en: [
        {
          title: "Governance applied to product",
          body: "I design reusable capabilities for cataloging, metadata, quality, and operational control, not isolated pipelines.",
        },
        {
          title: "Clinical interoperability with purpose",
          body: "I connect operational data exchange and advanced analytics through standards such as HL7 FHIR and OMOP CDM.",
        },
        {
          title: "Quality, traceability, and control",
          body: "I work across the full data lifecycle, from ingestion and validation to monitoring, blocking, or deletion.",
        },
      ],
    },
    quickFacts: {
      es: [
        "Promoción interna en Savana: Ingeniero de Datos Senior → Líder de Ingeniería de Datos → Head of Data Management",
        "Especialización en gobierno del dato, interoperabilidad clínica y calidad del dato",
        "Perfil técnico con foco en producto, escalabilidad y equipos sólidos",
      ],
      en: [
        "Internal growth at Savana: Senior Data Engineer → Lead Data Engineer → Head of Data Management",
        "Focused on data governance, clinical interoperability, and data quality",
        "Technical profile with a product mindset, scalability focus, and strong team habits",
      ],
    },
  },
  summary: {
    heading: { es: "Resumen ejecutivo", en: "Executive summary" },
    lead: {
      es: "Diseño y evoluciono productos y plataformas de datos donde la ingeniería, el gobierno y la interoperabilidad trabajan juntos para que el dato sea útil, trazable y confiable.",
      en: "I design and evolve data products and platforms where engineering, governance, and interoperability work together to make data useful, traceable, and trustworthy.",
    },
    paragraphs: {
      es: [
        "Mi foco está en convertir necesidades complejas de integración, calidad y explotación en capacidades reales de producto: catálogo, metadatos, validación, observabilidad, visualización y control del ciclo de vida del dato.",
        "Trabajo con una mezcla de ejecución práctica, criterio arquitectónico y liderazgo técnico para traducir entornos regulados y requisitos complejos en sistemas más sólidos, reutilizables y preparados para generar valor.",
      ],
      en: [
        "My focus is on turning complex integration, quality, and analytics needs into real product capabilities: cataloging, metadata, validation, observability, visualization, and lifecycle control.",
        "I combine hands-on execution, architectural judgment, and technical leadership to translate regulated environments and complex requirements into more solid, reusable systems that are ready to generate value.",
      ],
    },
    pillars: {
      es: [
        {
          label: "Producto",
          text: "Pienso en capacidades reutilizables, no en soluciones puntuales.",
        },
        {
          label: "Plataforma",
          text: "Conecto datos, procesos, metadatos y visualización con criterio end-to-end.",
        },
        {
          label: "Impacto",
          text: "Aterrizo decisiones técnicas en calidad, interoperabilidad y control operativo.",
        },
      ],
      en: [
        {
          label: "Product",
          text: "I think in reusable capabilities, not one-off solutions.",
        },
        {
          label: "Platform",
          text: "I connect data, processes, metadata, and visualization with an end-to-end mindset.",
        },
        {
          label: "Impact",
          text: "I translate technical decisions into quality, interoperability, and operational control.",
        },
      ],
    },
  },
  about: {
    heading: { es: "Sobre mí", en: "About" },
    paragraphs: {
      es: [
        "Trabajo en la intersección entre ingeniería de datos, gobierno del dato y producto. Mi foco está en transformar requisitos complejos en plataformas más sólidas, auditables e interoperables, capaces de generar valor real para equipos técnicos y funcionales.",
        "Me he especializado en gobierno del dato, interoperabilidad y calidad end-to-end, impulsando soluciones que conectan metadatos, catálogo, validación, observabilidad y control operativo del dato a escala. Soy miembro de DAMA y mantengo el conocimiento actualizado mediante formación continua, certificaciones y práctica aplicada.",
        "También considero la documentación, el mentoring y la transferencia de conocimiento una parte esencial de la escalabilidad técnica y del desarrollo de equipos sólidos.",
      ],
      en: [
        "I work at the intersection of data engineering, data governance, and product. My focus is on turning complex requirements into stronger, auditable, interoperable platforms that create real value for technical and functional teams.",
        "I specialize in data governance, interoperability, and end-to-end quality, building solutions that connect metadata, cataloging, validation, observability, and operational control at scale. I am a member of DAMA and keep my expertise current through continuous learning, certifications, and hands-on delivery.",
        "I also see documentation, mentoring, and knowledge transfer as essential to technical scalability and to building strong teams.",
      ],
    },
  },
  experience: {
    spotlight: {
      heading: { es: "Savana", en: "Savana" },
      title: {
        es: "Ingeniero de Datos Senior → Líder de Ingeniería de Datos → Head of Data Management",
        en: "Senior Data Engineer → Lead Data Engineer → Head of Data Management",
      },
      chapter: {
        es: "Historia principal",
        en: "Main story",
      },
      paragraphs: {
        es: [
          "He evolucionado dentro de Savana desde un rol técnico de ejecución hasta una posición de liderazgo técnico con visión transversal sobre calidad, interoperabilidad y gobierno del dato, manteniendo siempre una fuerte cercanía a la construcción de soluciones y al diseño de producto.",
          "He impulsado capacidades de interoperabilidad sobre HL7 FHIR, la especificación moderna de HL7 para el intercambio electrónico de información clínica, y sobre OMOP CDM, el modelo común de datos promovido por OHDSI para estandarización y analítica avanzada. Este trabajo me ha permitido conectar integración operativa, explotación analítica y necesidades reales de negocio dentro del ecosistema del dato clínico.",
          "También diseñé y evolucioné una plataforma de calidad del dato construida desde cero, alineada con marcos UNE/ISO de calidad del dato y apoyada en herramientas open source, hasta convertirla en una capacidad reutilizable y preparada para consumo vía API. A esto se suma la centralización del catálogo y los metadatos en plataformas open source de terceros como DataHub, junto con soluciones de monitorización y visualización del ciclo de vida del dato, incluyendo la evolución del Data Model Explorer desde Power BI hacia Apache Superset.",
          "Ese trabajo se completa con procesos de Data Offboarding orientados a cumplimiento, seguridad y control operativo, permitiendo seguir el recorrido del dato desde su entrada hasta su bloqueo o eliminación.",
        ],
        en: [
          "At Savana, I progressed from a hands-on engineering role into a technical leadership position with a cross-functional view of data quality, interoperability, and governance, while staying close to solution design and product thinking.",
          "I drove interoperability capabilities around HL7 FHIR, the modern HL7 specification for healthcare data exchange, and OMOP CDM, the common data model promoted by OHDSI for standardization and advanced analytics. This allowed me to connect operational integration, analytics enablement, and real business needs across the clinical data ecosystem.",
          "I also designed and evolved a Data Quality platform from scratch, aligned with UNE/ISO quality frameworks and built on open source tooling, until it became a reusable capability ready for API-based integration. This was complemented by metadata and catalog centralization on third-party open source platforms such as DataHub, as well as lifecycle monitoring and visualization solutions, including the evolution of the Data Model Explorer from Power BI to Apache Superset.",
          "This work was completed by Data Offboarding processes focused on compliance, security, and operational control, making it possible to track data from ingestion to blocking or deletion.",
        ],
      },
      progression: {
        es: ["Ingeniero de Datos Senior", "Líder de Ingeniería de Datos", "Head of Data Management"],
        en: ["Senior Data Engineer", "Lead Data Engineer", "Head of Data Management"],
      },
      focus: {
        es: [
          "Interoperabilidad clínica con HL7 FHIR y OMOP CDM",
          "Calidad del dato como capacidad de producto",
          "Catálogo, metadatos y linaje sobre DataHub",
          "Gestión del ciclo de vida y Data Offboarding",
        ],
        en: [
          "Clinical interoperability with HL7 FHIR and OMOP CDM",
          "Data Quality as a product capability",
          "Catalog, metadata, and lineage on DataHub",
          "Lifecycle management and Data Offboarding",
        ],
      },
    },
    timelineHeading: { es: "Trayectoria compacta", en: "Compact career path" },
    timeline: {
      es: [
        {
          company: "Stratio",
          period: "2021 — 2022",
          role: "Ingeniero de Datos",
          text: "Consolidé una visión end-to-end del dato trabajando sobre una plataforma que conectaba ingesta, procesamiento, modelado, gobierno, observabilidad y explotación. Diseñé procesos de integración y analítica sobre Apache Spark y participé en casos de uso donde el dato debía ser fiable, explicable y operable a escala.",
        },
        {
          company: "Santander",
          period: "2020 — 2021",
          role: "Ingeniero de Software",
          text: "Contribuí al desarrollo de una plataforma bancaria de alto rendimiento en entornos batch y streaming, trabajando con tecnologías como Apache Spark, Apache Flink, Apache Kafka y Hazelcast en contextos donde la fiabilidad operativa no era opcional.",
        },
        {
          company: "BBVA",
          period: "2018 — 2020",
          role: "Desarrollador de Software",
          text: "Participé en la modernización de soluciones de datos para fondos, pensiones y analítica corporativa, conectando automatización, cloud y utilidad de negocio en migraciones desde entornos on-premise hacia AWS.",
        },
        {
          company: "Autana",
          period: "2017 — 2018",
          role: "Desarrollador de Software Junior",
          text: "Primera etapa profesional en analítica social y geográfica, donde asenté una base temprana en tratamiento de datos, contexto de negocio y entrega de soluciones.",
        },
      ],
      en: [
        {
          company: "Stratio",
          period: "2021 — 2022",
          role: "Data Engineer",
          text: "I strengthened an end-to-end understanding of data by working on a platform that connected ingestion, processing, modeling, governance, observability, and analytics. I designed integration and analytics processes on Apache Spark and worked on use cases where data needed to be reliable, explainable, and operable at scale.",
        },
        {
          company: "Santander",
          period: "2020 — 2021",
          role: "Software Engineer",
          text: "I contributed to a high-performance banking platform across batch and streaming environments, working with technologies such as Apache Spark, Apache Flink, Apache Kafka, and Hazelcast in contexts where operational reliability was critical.",
        },
        {
          company: "BBVA",
          period: "2018 — 2020",
          role: "Software Developer",
          text: "I participated in the modernization of data solutions for pensions, investment funds, and corporate analytics, connecting automation, cloud, and business utility in migrations from on-premise environments to AWS.",
        },
        {
          company: "Autana",
          period: "2017 — 2018",
          role: "Junior Software Developer",
          text: "My first professional stage in social and geographic analytics, where I built an early foundation in data processing, business context, and solution delivery.",
        },
      ],
    },
  },
  case_studies: {
    heading: { es: "Casos destacados", en: "Featured cases" },
    intro: {
      es: "Tres capacidades que resumen mejor mi valor que una simple lista de tecnologías.",
      en: "Three capabilities that explain my value better than a simple list of technologies.",
    },
    items: {
      es: [
        {
          id: "data-quality",
          title: "Plataforma de Calidad del Dato",
          kicker: "Calidad como capacidad de producto",
          summary:
            "Diseñé una plataforma de calidad del dato construida desde cero, basada en open source, alineada con marcos UNE/ISO y evolucionada hasta convertirse en una capacidad reutilizable y preparada para integración vía API.",
          outcomes: [
            "Validación, trazabilidad y observabilidad del dato de extremo a extremo",
            "Preparada para consumo programático y reutilización por otros equipos",
            "Pensada como producto técnico, no como controles sueltos",
          ],
        },
        {
          id: "interoperability",
          title: "Interoperabilidad Clinica",
          kicker: "Intercambio clínico y analítica avanzada",
          summary:
            "Impulsé transformaciones de datos clínicos hacia FHIR y OMOP para conectar intercambio operativo, normalización semántica y analítica avanzada sobre una base más consistente y reutilizable.",
          outcomes: [
            "FHIR para intercambio electrónico de información clínica",
            "OMOP CDM para estandarización y analítica avanzada",
            "Puente entre integración operativa y explotación de valor",
          ],
        },
        {
          id: "lifecycle",
          title: "Gestion del Ciclo de Vida del Dato",
          kicker: "Visibilidad y control del dato",
          summary:
            "Contribuí a dar visibilidad y control al recorrido completo del dato, desde la entrada y la monitorización hasta el offboarding, con métricas operativas, trazabilidad y cumplimiento.",
          outcomes: [
            "Data Model Explorer como capa de visibilidad del lifecycle",
            "Evolución de Power BI hacia Apache Superset",
            "Procesos de Data Offboarding con foco en seguridad y cumplimiento",
          ],
        },
      ],
      en: [
        {
          id: "data-quality",
          title: "Data Quality Platform",
          kicker: "Quality as a product capability",
          summary:
            "I designed a Data Quality platform from scratch, built on open source tooling, aligned with UNE/ISO quality frameworks, and evolved into a reusable capability ready for API-based integration.",
          outcomes: [
            "End-to-end validation, traceability, and observability",
            "Ready for programmatic use and reuse by other teams",
            "Built as a technical product, not as scattered controls",
          ],
        },
        {
          id: "interoperability",
          title: "Clinical Interoperability",
          kicker: "Clinical exchange and advanced analytics",
          summary:
            "I drove clinical data transformations toward FHIR and OMOP to connect operational exchange, semantic normalization, and advanced analytics on a more consistent and reusable foundation.",
          outcomes: [
            "FHIR for electronic healthcare information exchange",
            "OMOP CDM for standardization and advanced analytics",
            "A bridge between operational integration and downstream value",
          ],
        },
        {
          id: "lifecycle",
          title: "Data Lifecycle Management",
          kicker: "Visibility and control across the data journey",
          summary:
            "I helped provide visibility and control across the full data journey, from ingestion and monitoring to offboarding, with operational metrics, traceability, and compliance in place.",
          outcomes: [
            "Data Model Explorer as a visibility layer for the lifecycle",
            "Evolution from Power BI to Apache Superset",
            "Data Offboarding processes focused on security and compliance",
          ],
        },
      ],
    },
  },
  credentials: {
    heading: { es: "Credenciales y asociaciones", en: "Credentials and affiliations" },
    groups: {
      es: [
        {
          title: "Asociaciones y foco profesional",
          items: [
            "Miembro de DAMA",
            "Especialización en gobierno del dato, interoperabilidad y calidad del dato",
            "Foco en producto, plataforma y escalabilidad técnica",
          ],
        },
        {
          title: "Formación y aprendizaje continuo",
          items: [
            "AWS Certified Solutions Architect – Associate",
            "Experto en Gobierno y Gestión Estratégica de Datos",
            "Taller de certificación HL7 FHIR y formación continua en tecnologías de datos",
          ],
        },
        {
          title: "Mentoring y docencia",
          items: [
            "Formación interna en equipos técnicos a lo largo de mi carrera",
            "Acompañamiento a personas que quieren dar el salto al mundo del dato",
            "Documentación y transferencia de conocimiento como capacidad de equipo",
          ],
        },
      ],
      en: [
        {
          title: "Affiliations and professional focus",
          items: [
            "Member of DAMA",
            "Focused on data governance, interoperability, and data quality",
            "A product, platform, and technical scalability mindset",
          ],
        },
        {
          title: "Learning and continuous development",
          items: [
            "AWS Certified Solutions Architect – Associate",
            "Postgraduate-level training in strategic data governance",
            "HL7 FHIR training and continuous learning across data technologies",
          ],
        },
        {
          title: "Mentoring and teaching",
          items: [
            "Internal training for technical teams across multiple companies",
            "Supporting people who want to move into the data field",
            "Documentation and knowledge transfer as team capabilities",
          ],
        },
      ],
    },
  },
  contact: {
    heading: { es: "Contacto", en: "Contact" },
    intro: {
      es: "Disponible para conversaciones sobre plataformas de datos, interoperabilidad, data quality y liderazgo técnico con foco en producto.",
      en: "Open to conversations about data platforms, interoperability, data quality, and technical leadership with a product mindset.",
    },
    items: {
      es: [
        { label: "Email", value: "ismaelantonio.professional@gmail.com", href: "mailto:ismaelantonio.professional@gmail.com" },
        { label: "LinkedIn", value: "linkedin.com/in/ismael-sarmiento", href: "https://www.linkedin.com/in/ismael-sarmiento" },
        { label: "Web", value: "ismael-sarmiento.github.io", href: "https://ismael-sarmiento.github.io/" },
      ],
      en: [
        { label: "Email", value: "ismaelantonio.professional@gmail.com", href: "mailto:ismaelantonio.professional@gmail.com" },
        { label: "LinkedIn", value: "linkedin.com/in/ismael-sarmiento", href: "https://www.linkedin.com/in/ismael-sarmiento" },
        { label: "Website", value: "ismael-sarmiento.github.io", href: "https://ismael-sarmiento.github.io/" },
      ],
    },
  },
  faq: {
    heading: { es: "Asistente local beta", en: "Local assistant beta" },
    prompts: {
      es: [
        "¿Cuál es su foco principal?",
        "¿Qué hizo en Savana?",
        "¿Cómo trabaja la interoperabilidad?",
        "¿Qué significa la calidad del dato como producto?",
        "¿Cuál es su trayectoria?",
        "¿Qué puedes hacer?",
        "¿Cómo funcionas?",
        "¿Eres seguro?",
        "¿Puedes dar datos privados?",
      ],
      en: [
        "What is his main focus?",
        "What did he do at Savana?",
        "How does he work on interoperability?",
        "What does Data Quality as a product mean?",
        "What is his career path?",
        "What can you do?",
        "How do you work?",
        "Are you secure?",
        "Can you share private data?",
      ],
    },
    items: {
      es: [
        {
          q: "¿Cuál es su foco principal?",
          a: "Su foco principal está en productos y plataformas de datos gobernadas, interoperables y orientadas a la calidad del dato, con una mezcla de ejecución técnica, criterio arquitectónico y liderazgo.",
          keywords: ["foco", "principal", "perfil", "especializacion"],
        },
        {
          q: "¿Qué hizo en Savana?",
          a: "En Savana evolucionó de Ingeniero de Datos Senior a Líder de Ingeniería de Datos y luego a Head of Data Management, impulsando interoperabilidad clínica con FHIR y OMOP, plataformas de calidad del dato, catálogo y metadatos con DataHub, y control del ciclo de vida del dato.",
          keywords: ["savana", "head", "lead", "data management"],
        },
        {
          q: "¿Cómo trabaja la interoperabilidad?",
          a: "Trabaja la interoperabilidad como una capacidad de producto. Utiliza HL7 FHIR para intercambio electrónico de información clínica y OMOP CDM para normalización y analítica avanzada, conectando integración operativa y explotación de valor.",
          keywords: ["interoperabilidad", "fhir", "omop", "hl7"],
        },
        {
          q: "¿Qué significa la calidad del dato como producto?",
          a: "Significa tratar la calidad del dato como una capacidad reutilizable, con validación, trazabilidad, observabilidad y control operativo, en lugar de mantener controles aislados y difíciles de escalar.",
          keywords: ["data quality", "calidad", "producto", "validacion"],
        },
        {
          q: "¿Cuál es su trayectoria?",
          a: "Su trayectoria pasa por BBVA, Santander, Stratio y Savana, con una evolución clara desde desarrollo de software y plataformas de datos hasta liderazgo técnico en gobierno del dato, interoperabilidad y calidad del dato.",
          keywords: ["trayectoria", "career", "bbva", "santander", "stratio"],
        },
        {
          q: "¿Tiene experiencia docente?",
          a: "Sí. Ha impartido formación interna en varias empresas y acompaña a personas que quieren dar el salto al mundo del dato. La documentación, el mentoring y la transferencia de conocimiento forman parte estable de su forma de trabajar.",
          keywords: ["docencia", "mentoring", "formacion", "teaching"],
        },
        {
          q: "¿Qué puedes hacer?",
          a: "Puedo resumir la trayectoria, explicar proyectos clave, aclarar cómo trabaja Ismael temas como interoperabilidad o calidad del dato, y detallar los límites públicos de este CV interactivo.",
          keywords: ["puedes hacer", "capacidades", "asistente", "faq"],
        },
        {
          q: "¿Cómo funcionas?",
          a: "Funciono como un asistente local basado en el contenido público de esta página. No improviso con fuentes externas ni accedo a sistemas privados; respondo a partir de un banco curado de información profesional.",
          keywords: ["funcionas", "como", "works", "local"],
        },
        {
          q: "¿Eres seguro?",
          a: "Sí, en el sentido de que esta versión no envía preguntas a modelos externos ni procesa datos sensibles. Solo utiliza información pública del CV y respuestas curadas para orientar la conversación.",
          keywords: ["seguro", "seguridad", "secure", "safety"],
        },
        {
          q: "¿Puedes dar datos privados?",
          a: "No. Este asistente está limitado al contenido público del CV y no tiene acceso a datos privados, credenciales, métricas sensibles ni información confidencial de Ismael o de las empresas en las que ha trabajado.",
          keywords: ["privados", "confidencial", "datos", "secretos"],
        },
      ],
      en: [
        {
          q: "What is his main focus?",
          a: "His main focus is on governed, interoperable data products and platforms built around data quality, combining technical execution, architectural judgment, and leadership.",
          keywords: ["focus", "main", "specialization", "profile"],
        },
        {
          q: "What did he do at Savana?",
          a: "At Savana, he progressed from Senior Data Engineer to Lead Data Engineer and then to Head of Data Management, driving clinical interoperability with FHIR and OMOP, Data Quality platforms, metadata and cataloging through DataHub, and lifecycle control.",
          keywords: ["savana", "head", "lead", "data management"],
        },
        {
          q: "How does he work on interoperability?",
          a: "He treats interoperability as a product capability. He uses HL7 FHIR for electronic healthcare information exchange and OMOP CDM for normalization and advanced analytics, connecting operational integration with downstream value.",
          keywords: ["interoperability", "fhir", "omop", "hl7"],
        },
        {
          q: "What does Data Quality as a product mean?",
          a: "It means treating data quality as a reusable capability with validation, traceability, observability, and operational control instead of keeping scattered checks that do not scale well.",
          keywords: ["data quality", "quality", "product", "validation"],
        },
        {
          q: "What is his career path?",
          a: "His path includes BBVA, Santander, Stratio, and Savana, showing a clear evolution from software and data platforms into technical leadership around governance, interoperability, and data quality.",
          keywords: ["career", "path", "bbva", "santander", "stratio"],
        },
        {
          q: "Does he have teaching experience?",
          a: "Yes. He has delivered internal training in several companies and supports people moving into the data field. Documentation, mentoring, and knowledge transfer are stable parts of how he works.",
          keywords: ["teaching", "mentoring", "training", "knowledge"],
        },
        {
          q: "What can you do?",
          a: "I can summarize the career path, explain key projects, clarify how Ismael approaches topics such as interoperability or Data Quality, and describe the public limits of this interactive CV.",
          keywords: ["can you do", "capabilities", "assistant", "help"],
        },
        {
          q: "How do you work?",
          a: "I work as a local assistant based on the public content of this page. I do not improvise with external sources or access private systems; I answer from a curated professional knowledge base.",
          keywords: ["how do you work", "local", "work", "operate"],
        },
        {
          q: "Are you secure?",
          a: "Yes, in the sense that this version does not send questions to external models or process sensitive data. It only uses public CV content and curated answers to guide the conversation.",
          keywords: ["secure", "safe", "security", "privacy"],
        },
        {
          q: "Can you share private data?",
          a: "No. This assistant is limited to the public content of the CV and has no access to private data, credentials, sensitive metrics, or confidential information from Ismael or the companies he has worked with.",
          keywords: ["private data", "confidential", "credentials", "sensitive"],
        },
      ],
    },
  },
};

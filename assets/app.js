(function () {
  const content = window.CV_CONTENT;
  const root = document.getElementById("app");
  const validViews = new Set(["full", "summary"]);
  const validLangs = new Set(["es", "en"]);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const publicUrls = {
    es: content.meta.siteUrl,
    en: new URL("index_en.html", content.meta.siteUrl).toString(),
  };
  const pageDefaultLang = /index_en\.html$/i.test(window.location.pathname) ? "en" : "es";

  const query = new URLSearchParams(window.location.search);
  const initialLang = validLangs.has(query.get("lang"))
    ? query.get("lang")
    : pageDefaultLang || window.localStorage.getItem("cv-lang") || "es";
  const initialView = validViews.has(query.get("view"))
    ? query.get("view")
    : "full";
  const initialTheme =
    window.localStorage.getItem("cv-theme") ||
    (prefersDark.matches ? "dark" : "light");

  const state = {
    lang: initialLang,
    view: initialView,
    theme: initialTheme,
    mobileOpen: false,
    assistantDockOpen: false,
    isSpeaking: false,
    audioLang: null,
    audioMode: null,
    audioStatus: "",
    loaderVisible: window.sessionStorage.getItem("cv-loader-seen") !== "1",
    activeSection: "summary",
    assistantMessages: [],
  };

  let loaderTimer = null;
  let loaderAnimationFrame = null;
  let sectionObserver = null;
  let revealObserver = null;
  let assistantVisibilityObserver = null;
  let activeUtterance = null;
  let activeAudioElement = null;

  const icons = {
    moon:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.7 14.4A8.5 8.5 0 0 1 9.6 3.3a.7.7 0 0 0-.8-.8A10.2 10.2 0 1 0 21.5 15a.7.7 0 0 0-.8-.6Z"/></svg>',
    sun:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 4a1 1 0 0 1 1 1v1.1a1 1 0 0 1-2 0V5a1 1 0 0 1 1-1Zm0 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-5a1 1 0 0 1 0 2h-1.1a1 1 0 1 1 0-2H19ZM7.1 12a1 1 0 0 1-1 1H5a1 1 0 1 1 0-2h1.1a1 1 0 0 1 1 1Zm8.66-5.66a1 1 0 0 1 1.41 0l.78.78a1 1 0 0 1-1.41 1.41l-.78-.78a1 1 0 0 1 0-1.41ZM6.45 15.55a1 1 0 0 1 1.41 0l.78.78a1 1 0 0 1-1.41 1.41l-.78-.78a1 1 0 0 1 0-1.41Zm11.1 0a1 1 0 0 1 0 1.41l-.78.78a1 1 0 0 1-1.41-1.41l.78-.78a1 1 0 0 1 1.41 0ZM8.64 7.76A1 1 0 0 1 7.23 9.17l-.78-.78a1 1 0 1 1 1.41-1.41l.78.78ZM12 17.8a1 1 0 0 1 1 1V20a1 1 0 1 1-2 0v-1.2a1 1 0 0 1 1-1Z"/></svg>',
    menu:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 7.25A1.25 1.25 0 0 1 5.25 6h13.5a1.25 1.25 0 1 1 0 2.5H5.25A1.25 1.25 0 0 1 4 7.25Zm0 9.5A1.25 1.25 0 0 1 5.25 15.5h13.5a1.25 1.25 0 1 1 0 2.5H5.25A1.25 1.25 0 0 1 4 16.75Zm0-4.75a1.25 1.25 0 0 1 1.25-1.25h13.5a1.25 1.25 0 1 1 0 2.5H5.25A1.25 1.25 0 0 1 4 12Z"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.7 5.3a1 1 0 0 1 1.4 0L12 9.17l3.9-3.88a1 1 0 1 1 1.4 1.42L13.4 10.6l3.9 3.9a1 1 0 0 1-1.4 1.4L12 12.01 8.1 15.9a1 1 0 0 1-1.4-1.4l3.89-3.9-3.9-3.89a1 1 0 0 1 0-1.41Z"/></svg>',
    arrow:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10.9 4.3a1 1 0 0 0-1.4 1.4l5.3 5.3H4a1 1 0 1 0 0 2h10.8l-5.3 5.3a1 1 0 0 0 1.4 1.4l7-7a1 1 0 0 0 0-1.4l-7-7Z"/></svg>',
    download:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M11 4a1 1 0 1 1 2 0v8.59l2.3-2.29a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L11 12.6V4Zm-6 13a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"/></svg>',
    bot:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M12 3.5v2M8.4 6.5h7.2a4.4 4.4 0 0 1 4.4 4.4v3.7a4.4 4.4 0 0 1-4.4 4.4H8.4A4.4 4.4 0 0 1 4 14.6v-3.7a4.4 4.4 0 0 1 4.4-4.4ZM9.3 11.4h.01M14.7 11.4h.01M9.4 15.4h5.2"/></svg>',
  };

  function getCopy(group) {
    return content.ui[state.lang][group];
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalize(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getHeroRole() {
    return `${content.hero.headlinePrimary[state.lang]} | ${content.hero.headlineSecondary[state.lang]}`;
  }

  function getNarrationText(lang = state.lang) {
    const narrationScript = content.audio?.[lang]?.script;
    if (narrationScript) return narrationScript;
    return [
      content.hero.message[lang],
      content.summary.lead[lang],
      ...content.summary.paragraphs[lang],
      content.about.paragraphs[lang][0],
    ].join(" ");
  }

  function getPageUrl(lang) {
    return publicUrls[lang] || publicUrls.es;
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const value = normalized.length === 3
      ? normalized
          .split("")
          .map((chunk) => `${chunk}${chunk}`)
          .join("")
      : normalized;
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    };
  }

  function mixHexColor(fromHex, toHex, amount) {
    const from = hexToRgb(fromHex);
    const to = hexToRgb(toHex);
    const r = Math.round(lerp(from.r, to.r, amount));
    const g = Math.round(lerp(from.g, to.g, amount));
    const b = Math.round(lerp(from.b, to.b, amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function getLanguageHref(lang) {
    const target =
      lang === "en"
        ? new URL("index_en.html", window.location.href)
        : new URL(window.location.protocol === "file:" ? "index.html" : "/", window.location.href);
    const params = new URLSearchParams();
    if (state.view !== "full") params.set("view", state.view);
    const queryString = params.toString();
    target.search = queryString ? `?${queryString}` : "";
    target.hash = window.location.hash;
    return target.toString();
  }

  function buildStructuredData(lang) {
    return {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      "@id": `${getPageUrl(lang)}#profile-page`,
      url: getPageUrl(lang),
      name: content.meta.title[lang],
      description: content.meta.description[lang],
      inLanguage: lang === "es" ? "es-ES" : "en-US",
      keywords: [
        content.meta.siteName,
        "Ismael A. Sarmiento",
        "Lead Data Engineer",
        "Savana",
        "GitHub",
        "Data Governance",
        "Clinical Interoperability",
        "HL7 FHIR",
        "OMOP",
        "DataHub",
      ],
      mainEntity: {
        "@type": "Person",
        "@id": `${content.meta.siteUrl}#ismael-sarmiento`,
        name: content.meta.siteName,
        alternateName: "Ismael A. Sarmiento",
        givenName: "Ismael",
        familyName: "Sarmiento",
        url: content.meta.siteUrl,
        email: `mailto:${content.meta.email}`,
        jobTitle:
          lang === "es"
            ? "Lead Data Engineer | Gobierno del dato, interoperabilidad y calidad del dato"
            : "Lead Data Engineer | Governance, Interoperability & Data Quality",
        description: content.hero.subtitle[lang],
        mainEntityOfPage: getPageUrl(lang),
        hasOccupation: {
          "@type": "Occupation",
          name: "Lead Data Engineer",
        },
        sameAs: [content.meta.linkedin, content.meta.github],
        worksFor: {
          "@type": "Organization",
          name: "Savana",
          url: content.meta.currentCompany,
        },
        knowsAbout: [
          "Data Governance",
          "Clinical Interoperability",
          "Data Quality",
          "Data Lifecycle Management",
          "HL7 FHIR",
          "OMOP CDM",
          "DataHub",
          "AWS",
          "Apache Spark",
          "Apache Airflow",
          "Apache Superset",
        ],
      },
    };
  }

  function chooseNarrationVoice(lang = state.lang) {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const spanishPreferred = [
      "jorge",
      "diego",
      "carlos",
      "antonio",
      "enrique",
      "raul",
      "alvaro",
      "alejandro",
    ];
    const englishPreferred = [
      "daniel",
      "moira",
      "karen",
      "reed",
      "flo",
      "eddy",
      "aaron",
      "alex",
      "fred",
      "tom",
      "joel",
      "matthew",
      "oliver",
    ];

    const localePattern = lang === "es" ? /es[-_]ES/i : /en[-_](GB|IE|AU|US)/i;
    const preferredNames = lang === "es" ? spanishPreferred : englishPreferred;
    const localeFallback = lang === "es" ? /^es/i : /^en/i;

    const exact = voices.find(
      (voice) =>
        localePattern.test(voice.lang) &&
        preferredNames.some((name) => normalize(voice.name).includes(name))
    );
    if (exact) return exact;

    const localeMatch = voices.find((voice) => localePattern.test(voice.lang));
    if (localeMatch) return localeMatch;

    const broadMatch = voices.find((voice) => localeFallback.test(voice.lang));
    return broadMatch || null;
  }

  function getAudioSources(audioConfig) {
    if (!audioConfig) return [];

    if (Array.isArray(audioConfig.sources) && audioConfig.sources.length) {
      return audioConfig.sources.filter((source) => source?.src);
    }

    if (audioConfig.src) {
      return [{ src: audioConfig.src, type: audioConfig.type || "" }];
    }

    return [];
  }

  function pickPlayableAudioSource(audioConfig) {
    const sources = getAudioSources(audioConfig);
    if (!sources.length) return null;

    const probe = document.createElement("audio");
    return (
      sources.find((source) => !source.type || probe.canPlayType(source.type)) ||
      sources[0]
    );
  }

  function updateUrl() {
    const next = getLanguageHref(state.lang);
    window.history.replaceState({}, "", next);
  }

  function updateMeta() {
    document.documentElement.lang = state.lang;
    document.title = content.meta.title[state.lang];
    const metaDescription = document.getElementById("meta-description");
    const ogTitle = document.getElementById("og-title");
    const ogDescription = document.getElementById("og-description");
    const ogUrl = document.getElementById("og-url");
    const ogLocale = document.getElementById("og-locale");
    const twitterTitle = document.getElementById("twitter-title");
    const twitterDescription = document.getElementById("twitter-description");
    const canonicalLink = document.getElementById("canonical-link");
    const alternateEs = document.getElementById("alternate-es");
    const alternateEn = document.getElementById("alternate-en");
    const alternateDefault = document.getElementById("alternate-default");
    const profileJson = document.getElementById("profile-jsonld");
    if (metaDescription) metaDescription.content = content.meta.description[state.lang];
    if (ogTitle) ogTitle.content = content.meta.title[state.lang];
    if (ogDescription) ogDescription.content = content.meta.description[state.lang];
    if (ogUrl) ogUrl.content = getPageUrl(state.lang);
    if (ogLocale) ogLocale.content = state.lang === "es" ? "es_ES" : "en_US";
    if (twitterTitle) twitterTitle.content = content.meta.title[state.lang];
    if (twitterDescription) twitterDescription.content = content.meta.description[state.lang];
    if (canonicalLink) canonicalLink.href = getPageUrl(state.lang);
    if (alternateEs) alternateEs.href = getPageUrl("es");
    if (alternateEn) alternateEn.href = getPageUrl("en");
    if (alternateDefault) alternateDefault.href = getPageUrl("es");
    if (profileJson) profileJson.textContent = JSON.stringify(buildStructuredData(state.lang));
  }

  function renderLinkCloud() {
    return content.links
      .map(
        (link) =>
          `<a class="chip-link" href="${link.href}" target="_blank" rel="noopener">${escapeHtml(
            link.label
          )}</a>`
      )
      .join("");
  }

  function renderHeroPanel(copy) {
    const layers = content.hero.layers[state.lang];

    return `
      <aside class="hero__panel reveal" aria-label="${
        state.lang === "es" ? "Resumen visual de trayectoria" : "Career visual summary"
      }">
        <article class="architecture-card">
          <span class="architecture-card__label">${copy.labels.overview}</span>
          <h2 class="architecture-card__title">${content.hero.trajectoryHeading[state.lang]}</h2>
          <div class="architecture-card__text">
            ${content.hero.trajectoryIntro[state.lang]
              .map((paragraph) => `<p>${paragraph}</p>`)
              .join("")}
          </div>
        </article>
        <h3 class="layers-title">${copy.labels.layers}</h3>
        <div class="platform-layers">
          ${layers
            .map(
              (item) => `
              <article class="platform-layer">
                <div class="platform-layer__node" aria-hidden="true"></div>
                <div>
                  <h3>${item.title}</h3>
                  <p>${item.text}</p>
                </div>
              </article>
            `
            )
            .join("")}
        </div>
      </aside>
    `;
  }

  function render() {
    const copy = content.ui[state.lang];
    const hero = content.hero;
    const summary = content.summary;
    const about = content.about;
    const spotlight = content.experience.spotlight;
    const timeline = content.experience.timeline[state.lang];
    const cases = content.case_studies.items[state.lang];
    const credentials = content.credentials.groups[state.lang];
    const contact = content.contact.items[state.lang];
    const faq = content.faq.items[state.lang];
    const prompts = content.faq.prompts[state.lang];
    const currentYear = new Date().getFullYear();

    document.body.dataset.theme = state.theme;
    document.body.dataset.view = state.view;
    updateUrl();
    updateMeta();

    const viewToggleLabel =
      state.view === "summary"
        ? copy.actions.fullMode
        : copy.actions.summaryMode;

    root.innerHTML = `
      <a class="skip-link" href="#main">${copy.skipToContent}</a>
      <div class="site-shell">
        <div class="ambient ambient--one" aria-hidden="true"></div>
        <div class="ambient ambient--two" aria-hidden="true"></div>
        <div class="ambient ambient--three" aria-hidden="true"></div>
        ${
          state.loaderVisible
            ? `
          <div class="loader" id="loader" role="status" aria-live="polite">
            <div class="loader__panel">
              <h1 class="loader__title">${content.meta.siteName}</h1>
              <p class="loader__subtitle">${hero.subtitle[state.lang]}</p>
              <ol class="loader__steps">
                ${content.loader_milestones[state.lang]
                  .map(
                    (item, index) => `
                    <li class="loader__step" data-loader-step="${index}">
                      <span class="loader__step-dot" aria-hidden="true"></span>
                      <span>${item}</span>
                    </li>
                  `
                  )
                  .join("")}
              </ol>
              <div class="loader__ticker">
                <p class="loader__milestone" data-loader-milestone></p>
              </div>
              <div class="loader__progress"><span data-loader-progress></span></div>
              <div class="loader__actions">
                <span class="loader__status" data-loader-status>0%</span>
                <button class="loader__skip" type="button" data-loader-skip>${copy.actions.skipLoader}</button>
              </div>
            </div>
          </div>
        `
            : ""
        }
        <header class="site-header">
          <div class="site-header__inner">
            <a class="brand" href="#hero" aria-label="${content.meta.siteName}">
              <span class="brand__name">
                <span>${content.meta.siteName}</span>
              </span>
              <span class="brand__role">${copy.brandTagline}</span>
            </a>
            <nav class="site-nav" aria-label="${state.lang === "es" ? "Principal" : "Primary"}">
              <a href="#summary" data-nav="summary">${copy.navigation.summary}</a>
              <a href="#story" data-nav="story">${copy.navigation.story}</a>
              <a href="#cases" data-nav="cases">${copy.navigation.cases}</a>
              <a href="#timeline" data-nav="timeline">${copy.navigation.timeline}</a>
            </nav>
            <div class="header-actions">
              <button type="button" class="ghost-button" data-view-toggle>${viewToggleLabel}</button>
              <div class="segmented" aria-label="${copy.actions.language}">
                <button type="button" data-lang="es" aria-pressed="${state.lang === "es"}">ES</button>
                <button type="button" data-lang="en" aria-pressed="${state.lang === "en"}">EN</button>
              </div>
              <button type="button" class="icon-button" data-theme-toggle aria-label="${copy.actions.theme}">
                ${state.theme === "dark" ? icons.sun : icons.moon}
              </button>
              <button type="button" class="icon-button mobile-menu-button" data-mobile-toggle aria-label="${copy.actions.menu}">
                ${state.mobileOpen ? icons.close : icons.menu}
              </button>
            </div>
          </div>
        </header>
        <div class="mobile-sheet ${state.mobileOpen ? "is-open" : ""}" id="mobile-sheet">
          <a href="#summary" data-mobile-link="summary">${copy.navigation.summary}</a>
          <a href="#story" data-mobile-link="story">${copy.navigation.story}</a>
          <a href="#cases" data-mobile-link="cases">${copy.navigation.cases}</a>
          <a href="#timeline" data-mobile-link="timeline">${copy.navigation.timeline}</a>
        </div>
        <main class="main" id="main">
          <section class="section hero" id="hero">
            <div class="hero__grid">
              <article class="hero__copy reveal">
                <h1 class="hero__headline">
                  <span class="hero__headline-primary">${hero.headlinePrimary[state.lang]}</span>
                  <span class="hero__headline-secondary">${hero.headlineSecondary[state.lang]}</span>
                </h1>
                <p class="hero__subtitle">${hero.subtitle[state.lang]}</p>
                <p class="hero__message">${hero.message[state.lang]}</p>
                <ul class="hero__facts">
                  ${hero.quickFacts[state.lang]
                    .map((fact) => `<li>${fact}</li>`)
                    .join("")}
                </ul>
                <div class="hero__cta">
                  <a class="primary-button" href="#summary">${copy.actions.summaryCta} ${icons.arrow}</a>
                  <a class="secondary-button" href="#contact">${copy.actions.contactCta}</a>
                </div>
                <div class="hero__meta">
                  <span class="micro-label">${copy.labels.stack}</span>
                  <div class="link-cloud">${renderLinkCloud()}</div>
                </div>
              </article>
              ${renderHeroPanel(copy)}
            </div>
          </section>

          <section class="section" id="summary" data-section="summary">
            <div class="section__heading reveal">
              <div>
                <span class="section__eyebrow">${copy.navigation.summary}</span>
                <h2 class="section__title">${summary.heading[state.lang]}</h2>
              </div>
              <p class="section__intro">${summary.lead[state.lang]}</p>
            </div>
            <div class="summary-grid">
              <article class="glass-card summary-copy reveal">
                ${summary.paragraphs[state.lang]
                  .map((paragraph) => `<p>${paragraph}</p>`)
                  .join("")}
              </article>
              ${hero.proofPoints[state.lang]
                .map(
                  (item) => `
                  <article class="glass-card reveal">
                    <span class="micro-label">${copy.labels.keyValue}</span>
                    <h3>${item.title}</h3>
                    <p>${item.body}</p>
                  </article>
                `
                )
                .join("")}
            </div>
            <div class="pillars">
              ${summary.pillars[state.lang]
                .map(
                  (pillar) => `
                  <article class="pillar reveal">
                    <h3>${pillar.label}</h3>
                    <p>${pillar.text}</p>
                  </article>
                `
                )
                .join("")}
            </div>
          </section>

          <section class="section" id="about">
            <div class="section__heading reveal">
              <div>
                <span class="section__eyebrow">${about.heading[state.lang]}</span>
                <h2 class="section__title">${about.heading[state.lang]}</h2>
              </div>
            </div>
            <div class="about-grid">
              <article class="glass-card about-copy reveal">
                ${about.paragraphs[state.lang]
                  .map((paragraph) => `<p>${paragraph}</p>`)
                  .join("")}
              </article>
              <aside class="glass-card stat-card reveal">
                <article class="stat-card__item">
                  <strong>${state.lang === "es" ? "Rol actual" : "Current position"}</strong>
                  <p>${getHeroRole()}</p>
                </article>
                <article class="stat-card__item">
                  <strong>${state.lang === "es" ? "Contexto" : "Context"}</strong>
                  <p>${state.lang === "es" ? "Plataformas de datos, estándares clínicos, gobierno y gestión del ciclo de vida." : "Data platforms, clinical standards, governance, and lifecycle management."}</p>
                </article>
                <article class="stat-card__item">
                  <strong>${state.lang === "es" ? "Forma de trabajar" : "Working style"}</strong>
                  <p>${state.lang === "es" ? "Ejecución práctica, criterio arquitectónico y liderazgo técnico." : "Hands-on delivery, architectural judgment, and technical leadership."}</p>
                </article>
              </aside>
            </div>
          </section>

          <section class="section detail-section" id="story" data-section="story">
            <div class="section__heading reveal">
              <div>
                <span class="section__eyebrow">${spotlight.chapter[state.lang]}</span>
                <h2 class="section__title">${spotlight.heading[state.lang]}</h2>
              </div>
              <p class="section__intro">${spotlight.title[state.lang]}</p>
            </div>
            <div class="spotlight">
              <article class="glass-card spotlight__copy reveal">
                ${spotlight.paragraphs[state.lang]
                  .map((paragraph) => `<p>${paragraph}</p>`)
                  .join("")}
              </article>
              <aside class="glass-card reveal">
                <span class="micro-label">${copy.labels.progression}</span>
                <ul class="progression-list">
                  ${spotlight.progression[state.lang]
                    .map((item) => `<li>${item}</li>`)
                    .join("")}
                </ul>
                <span class="micro-label" style="margin-top:22px;">${copy.labels.currentFocus}</span>
                <ul class="focus-list">
                  ${spotlight.focus[state.lang]
                    .map((item) => `<li>${item}</li>`)
                    .join("")}
                </ul>
              </aside>
            </div>
          </section>

          <section class="section detail-section" id="cases" data-section="cases">
            <div class="section__heading reveal">
              <div>
                <span class="section__eyebrow">${content.case_studies.heading[state.lang]}</span>
                <h2 class="section__title">${content.case_studies.heading[state.lang]}</h2>
              </div>
              <p class="section__intro">${content.case_studies.intro[state.lang]}</p>
            </div>
            <div class="cases-grid">
              ${cases
                .map(
                  (item) => `
                  <article class="case-card reveal" id="${item.id}">
                    <span class="case-card__kicker">${item.kicker}</span>
                    <h3 class="case-card__title">${item.title}</h3>
                    <p class="case-card__summary">${item.summary}</p>
                    <ul>
                      ${item.outcomes.map((outcome) => `<li>${outcome}</li>`).join("")}
                    </ul>
                  </article>
                `
                )
                .join("")}
            </div>
          </section>

          <section class="section detail-section" id="timeline" data-section="timeline">
            <div class="section__heading reveal">
              <div>
                <span class="section__eyebrow">${copy.labels.timeline}</span>
                <h2 class="section__title">${content.experience.timelineHeading[state.lang]}</h2>
              </div>
            </div>
            <div class="timeline-grid">
              ${timeline
                .map(
                  (item) => `
                  <article class="timeline-card reveal">
                    <div class="timeline-card__head">
                      <div>
                        <h3 class="timeline-card__company">${item.company}</h3>
                        <div class="timeline-card__role">${item.role}</div>
                      </div>
                      <div class="timeline-card__period">${item.period}</div>
                    </div>
                    <p>${item.text}</p>
                  </article>
                `
                )
                .join("")}
            </div>
          </section>

          <section class="section detail-section" id="credentials">
            <div class="section__heading reveal">
              <div>
                <span class="section__eyebrow">${copy.labels.credentials}</span>
                <h2 class="section__title">${content.credentials.heading[state.lang]}</h2>
              </div>
            </div>
            <div class="credentials-grid">
              ${credentials
                .map(
                  (group) => `
                  <article class="credential-card reveal">
                    <h3>${group.title}</h3>
                    <ul>${group.items.map((item) => `<li>${item}</li>`).join("")}</ul>
                  </article>
                `
                )
                .join("")}
            </div>
          </section>

          <section class="section" id="contact">
            <div class="section__heading reveal">
              <div>
                <span class="section__eyebrow">${content.contact.heading[state.lang]}</span>
                <h2 class="section__title">${content.contact.heading[state.lang]}</h2>
              </div>
              <p class="section__intro">${content.contact.intro[state.lang]}</p>
            </div>
            <div class="contact-grid">
              <article class="contact-card reveal">
                <p>${state.lang === "es" ? "La mejor forma de iniciar conversación es con un correo breve o un mensaje en LinkedIn." : "The best way to start a conversation is with a short email or a LinkedIn message."}</p>
                <div class="contact-links">
                  ${contact
                    .map(
                      (item) => `
                      <a class="contact-link" href="${item.href}" ${item.href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>
                        <span>${item.label}</span>
                        <strong>${item.value}</strong>
                      </a>
                    `
                    )
                    .join("")}
                </div>
              </article>
              <aside class="contact-card reveal">
                <span class="micro-label">${copy.labels.stack}</span>
                <p>${state.lang === "es" ? "Enlaces contrastados a estándares, asociaciones y plataformas mencionadas en esta página." : "Verified links to standards, associations, and platforms referenced on this page."}</p>
                <div class="link-cloud" style="margin-top:18px;">${renderLinkCloud()}</div>
              </aside>
            </div>
          </section>

          <section class="section assistant-section" id="assistant">
            <div class="section__heading reveal">
              <div>
                <span class="section__eyebrow">${copy.labels.assistant}</span>
                <h2 class="section__title">${content.faq.heading[state.lang]}</h2>
              </div>
              <p class="section__intro">${copy.assistant.note}</p>
            </div>
            <article class="assistant-card reveal">
              <div class="assistant-audio">
                <div class="assistant-audio__copy">
                  <span class="micro-label">${copy.assistant.audioTitle}</span>
                  <p>${copy.assistant.audioNote}</p>
                  ${
                    state.audioStatus
                      ? `<p class="assistant-audio__status">${state.audioStatus}</p>`
                      : ""
                  }
                </div>
                <div class="assistant-audio__actions">
                  <button
                    type="button"
                    class="${state.isSpeaking && state.audioLang === "es" ? "primary-button" : "secondary-button"}"
                    data-summary-audio="es"
                    aria-pressed="${state.isSpeaking && state.audioLang === "es"}"
                  >${copy.assistant.summaryEs}</button>
                  <button
                    type="button"
                    class="${state.isSpeaking && state.audioLang === "en" ? "primary-button" : "secondary-button"}"
                    data-summary-audio="en"
                    aria-pressed="${state.isSpeaking && state.audioLang === "en"}"
                  >${copy.assistant.summaryEn}</button>
                  ${
                    state.isSpeaking
                      ? `<button type="button" class="ghost-button" data-summary-audio-stop>${copy.assistant.stopAudio}</button>`
                      : ""
                  }
                </div>
              </div>
              <div class="assistant-toolbar">
                <div class="assistant-chips">
                ${prompts
                  .map(
                    (prompt) =>
                      `<button type="button" data-prompt="${escapeHtml(prompt)}">${prompt}</button>`
                  )
                  .join("")}
                </div>
                <button type="button" class="ghost-button assistant-clear" data-assistant-clear>${copy.actions.clearChat}</button>
              </div>
              <div class="assistant-log" id="assistant-log">
                ${renderAssistantMessages(faq)}
              </div>
              <form class="assistant-form" id="assistant-form">
                <input type="text" name="question" placeholder="${copy.assistant.inputPlaceholder}" aria-label="${copy.assistant.inputPlaceholder}" />
                <button class="primary-button" type="submit">${copy.assistant.send}</button>
              </form>
            </article>
          </section>
        </main>
        <div class="assistant-fab ${state.assistantDockOpen ? "is-open" : ""}">
          ${
            state.assistantDockOpen
              ? `
              <div class="assistant-fab__panel">
                <span class="micro-label">${copy.assistant.launcherTitle}</span>
                <p>${copy.assistant.launcherQuestion}</p>
                ${
                  state.audioStatus
                    ? `<p class="assistant-fab__status">${state.audioStatus}</p>`
                    : ""
                }
                <div class="assistant-fab__actions">
                  <button
                    type="button"
                    class="${state.isSpeaking && state.audioLang === "es" ? "primary-button" : "secondary-button"}"
                    data-summary-audio="es"
                    aria-pressed="${state.isSpeaking && state.audioLang === "es"}"
                  >${copy.assistant.summaryEs}</button>
                  <button
                    type="button"
                    class="${state.isSpeaking && state.audioLang === "en" ? "primary-button" : "secondary-button"}"
                    data-summary-audio="en"
                    aria-pressed="${state.isSpeaking && state.audioLang === "en"}"
                  >${copy.assistant.summaryEn}</button>
                  <button type="button" class="primary-button" data-assistant-open-chat>${copy.assistant.openChat}</button>
                  ${
                    state.isSpeaking
                      ? `<button type="button" class="ghost-button" data-summary-audio-stop>${copy.assistant.stopAudio}</button>`
                      : ""
                  }
                </div>
              </div>
            `
              : ""
          }
          <button type="button" class="assistant-fab__trigger" data-assistant-toggle aria-expanded="${state.assistantDockOpen}" aria-label="${copy.assistant.launcherTitle}">
            ${icons.bot}
          </button>
        </div>
        <footer class="site-footer">
          <p>© ${currentYear} ${content.meta.siteName}. ${state.lang === "es" ? "Todos los derechos reservados." : "All rights reserved."}</p>
        </footer>
      </div>
    `;

    bindEvents();
    setupRevealObserver();
    setupSectionObserver();
    setupAssistantVisibilityObserver();
    startLoaderIfNeeded();
    const assistantLog = document.getElementById("assistant-log");
    if (assistantLog) assistantLog.scrollTop = assistantLog.scrollHeight;
  }

  function renderAssistantMessages(faqItems) {
    const messages = state.assistantMessages.length
      ? state.assistantMessages
      : [{ author: "assistant", text: content.ui[state.lang].assistant.empty }];
    return messages
      .map(
        (message) => `
        <div class="assistant-message ${
          message.author === "user" ? "assistant-message--user" : ""
        }">${message.text}</div>
      `
      )
      .join("");
  }

  function bindEvents() {
    const langButtons = root.querySelectorAll("[data-lang]");
    langButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextLang = button.getAttribute("data-lang");
        if (!validLangs.has(nextLang) || nextLang === state.lang) return;
        window.localStorage.setItem("cv-lang", nextLang);
        window.location.assign(getLanguageHref(nextLang));
      });
    });

    const themeToggle = root.querySelector("[data-theme-toggle]");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        state.theme = state.theme === "dark" ? "light" : "dark";
        window.localStorage.setItem("cv-theme", state.theme);
        render();
      });
    }

    const viewToggle = root.querySelector("[data-view-toggle]");
    if (viewToggle) {
      viewToggle.addEventListener("click", () => {
        state.view = state.view === "summary" ? "full" : "summary";
        state.mobileOpen = false;
        render();
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }

    const mobileToggle = root.querySelector("[data-mobile-toggle]");
    if (mobileToggle) {
      mobileToggle.addEventListener("click", () => {
        state.mobileOpen = !state.mobileOpen;
        render();
      });
    }

    root.querySelectorAll("[data-mobile-link]").forEach((link) => {
      link.addEventListener("click", () => {
        state.mobileOpen = false;
        render();
      });
    });

    root.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("href").slice(1);
        if (!targetId) return;
        if (state.view === "summary" && ["story", "cases", "timeline", "assistant"].includes(targetId)) {
          event.preventDefault();
          jumpToSection(targetId);
        }
      });
    });

    const assistantForm = root.querySelector("#assistant-form");
    if (assistantForm) {
      assistantForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const field = assistantForm.elements.question;
        const question = field.value.trim();
        if (!question) return;
        state.assistantMessages.push({ author: "user", text: question });
        state.assistantMessages.push({
          author: "assistant",
          text: answerQuestion(question),
        });
        render();
      });
    }

    root.querySelectorAll("[data-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        const prompt = button.getAttribute("data-prompt");
        state.assistantMessages.push({ author: "user", text: prompt });
        state.assistantMessages.push({
          author: "assistant",
          text: answerQuestion(prompt),
        });
        render();
      });
    });

    const assistantClear = root.querySelector("[data-assistant-clear]");
    if (assistantClear) {
      assistantClear.addEventListener("click", () => {
        state.assistantMessages = [];
        render();
      });
    }

    const assistantToggle = root.querySelector("[data-assistant-toggle]");
    if (assistantToggle) {
      assistantToggle.addEventListener("click", () => {
        state.assistantDockOpen = !state.assistantDockOpen;
        render();
      });
    }

    const assistantOpenChat = root.querySelector("[data-assistant-open-chat]");
    if (assistantOpenChat) {
      assistantOpenChat.addEventListener("click", () => {
        state.assistantDockOpen = false;
        jumpToSection("assistant");
        window.setTimeout(() => {
          const input = root.querySelector('#assistant-form input[name="question"]');
          if (input) input.focus();
        }, 260);
      });
    }

    root.querySelectorAll("[data-summary-audio]").forEach((button) => {
      button.addEventListener("click", () => {
        const targetLang = button.getAttribute("data-summary-audio");
        if (!validLangs.has(targetLang)) return;
        playSummaryAudio(targetLang);
      });
    });

    const stopAudio = root.querySelectorAll("[data-summary-audio-stop]");
    stopAudio.forEach((button) => {
      button.addEventListener("click", stopAudioPlayback);
    });

    const loaderSkip = root.querySelector("[data-loader-skip]");
    if (loaderSkip) {
      loaderSkip.addEventListener("click", finishLoader);
    }
  }

  function answerQuestion(question) {
    const items = content.faq.items[state.lang];
    const normalizedQuestion = normalize(question);
    let best = null;
    let bestScore = -1;

    items.forEach((item) => {
      const haystack = `${item.q} ${item.a} ${(item.keywords || []).join(" ")}`;
      const normalizedHaystack = normalize(haystack);
      let score = 0;
      normalizedQuestion.split(/\s+/).forEach((token) => {
        if (token.length < 3) return;
        if (normalizedHaystack.includes(token)) score += 1;
      });
      if (normalizedHaystack.includes(normalizedQuestion)) score += 2;
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    });

    return bestScore > 0 ? best.a : content.ui[state.lang].assistant.noMatch;
  }

  function jumpToSection(targetId) {
    if (state.view === "summary" && ["story", "cases", "timeline", "assistant"].includes(targetId)) {
      state.view = "full";
      state.mobileOpen = false;
      render();
      window.setTimeout(() => {
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        }
      }, 40);
      return;
    }

    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }

  function getAudioStatus(lang, mode) {
    const assistantCopy = content.ui[state.lang].assistant;
    if (mode === "static") {
      return lang === "es" ? assistantCopy.audioStaticEs : assistantCopy.audioStaticEn;
    }
    if (mode === "fallback") {
      return lang === "es" ? assistantCopy.audioFallbackEs : assistantCopy.audioFallbackEn;
    }
    return assistantCopy.audioLoading;
  }

  function stopAudioPlayback() {
    if (activeAudioElement) {
      activeAudioElement.pause();
      activeAudioElement.src = "";
      activeAudioElement = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    activeUtterance = null;
    state.isSpeaking = false;
    state.audioLang = null;
    state.audioMode = null;
    state.audioStatus = "";
    render();
  }

  function playSummaryAudio(lang) {
    if (!validLangs.has(lang)) return;

    if (state.isSpeaking && state.audioLang === lang) {
      stopAudioPlayback();
      return;
    }

    if (activeAudioElement) {
      activeAudioElement.pause();
      activeAudioElement.src = "";
      activeAudioElement = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    activeUtterance = null;
    state.isSpeaking = false;
    state.audioLang = lang;
    state.audioMode = "loading";
    state.audioStatus = getAudioStatus(lang, "loading");
    render();

    const audioConfig = content.audio?.[lang];
    const selectedSource = pickPlayableAudioSource(audioConfig);
    const shouldUseStaticAudio =
      Boolean(selectedSource?.src) && audioConfig?.preferStatic !== false;
    if (!shouldUseStaticAudio) {
      playSummaryFallback(lang);
      return;
    }

    const audio = new Audio(selectedSource.src);
    activeAudioElement = audio;
    audio.preload = "auto";

    const cleanup = () => {
      audio.oncanplaythrough = null;
      audio.onerror = null;
      audio.onended = null;
      audio.onpause = null;
    };

    audio.oncanplaythrough = () => {
      if (activeAudioElement !== audio) return;
      cleanup();
      state.isSpeaking = true;
      state.audioMode = "static";
      state.audioStatus = getAudioStatus(lang, "static");
      render();
      audio.play().catch(() => {
        if (activeAudioElement === audio) {
          activeAudioElement = null;
          playSummaryFallback(lang);
        }
      });
      audio.onended = () => {
        if (activeAudioElement !== audio) return;
        activeAudioElement = null;
        state.isSpeaking = false;
        state.audioLang = null;
        state.audioMode = null;
        state.audioStatus = "";
        render();
      };
      audio.onpause = () => {
        if (!audio.ended && activeAudioElement === audio) {
          activeAudioElement = null;
          state.isSpeaking = false;
          state.audioLang = null;
          state.audioMode = null;
          state.audioStatus = "";
          render();
        }
      };
    };

    audio.onerror = () => {
      if (activeAudioElement !== audio) return;
      cleanup();
      activeAudioElement = null;
      playSummaryFallback(lang);
    };

    audio.load();
  }

  function playSummaryFallback(lang) {
    if (!("speechSynthesis" in window)) {
      state.isSpeaking = false;
      state.audioLang = lang;
      state.audioMode = "fallback";
      state.audioStatus = getAudioStatus(lang, "fallback");
      render();
      jumpToSection("assistant");
      return;
    }

    window.speechSynthesis.cancel();
    activeUtterance = new SpeechSynthesisUtterance(getNarrationText(lang));
    const preferredVoice = chooseNarrationVoice(lang);
    activeUtterance.lang = preferredVoice?.lang || (lang === "es" ? "es-ES" : "en-US");
    if (preferredVoice) activeUtterance.voice = preferredVoice;
    activeUtterance.rate = 0.98;
    activeUtterance.pitch = 0.94;
    activeUtterance.onend = () => {
      activeUtterance = null;
      state.isSpeaking = false;
      state.audioLang = null;
      state.audioMode = null;
      state.audioStatus = "";
      render();
    };
    activeUtterance.onerror = () => {
      activeUtterance = null;
      state.isSpeaking = false;
      state.audioLang = null;
      state.audioMode = null;
      state.audioStatus = "";
      render();
    };
    state.isSpeaking = true;
    state.audioLang = lang;
    state.audioMode = "fallback";
    state.audioStatus = getAudioStatus(lang, "fallback");
    render();
    window.speechSynthesis.speak(activeUtterance);
  }

  function startLoaderIfNeeded() {
    const loader = document.getElementById("loader");
    if (!loader) return;
    if (reduceMotion) {
      finishLoader();
      return;
    }

    const milestones = content.loader_milestones[state.lang];
    const milestoneNode = loader.querySelector("[data-loader-milestone]");
    const progressNode = loader.querySelector("[data-loader-progress]");
    const statusNode = loader.querySelector("[data-loader-status]");
    const steps = loader.querySelectorAll("[data-loader-step]");
    const loaderPalette = [
      ["#dff3ff", "#cbe7ff"],
      ["#cce8ff", "#a8d2ff"],
      ["#9fd2ff", "#79bbff"],
      ["#73b8ff", "#4f9cff"],
      ["#478fff", "#285fdb"],
    ];
    const totalDuration = milestones.length * 1320;
    let startTime = null;

    function paint(ratio) {
      const clampedRatio = Math.min(Math.max(ratio, 0), 1);
      const progress = clampedRatio * 100;
      const stepRatio = Math.min(clampedRatio * milestones.length, milestones.length - 0.0001);
      const activeIndex = Math.min(Math.floor(stepRatio), milestones.length - 1);
      const paletteRatio = clampedRatio * (loaderPalette.length - 1);
      const paletteIndex = Math.floor(paletteRatio);
      const paletteMix = paletteRatio - paletteIndex;
      const [fromStart, fromEnd] = loaderPalette[Math.min(paletteIndex, loaderPalette.length - 1)];
      const [toStart, toEnd] = loaderPalette[Math.min(paletteIndex + 1, loaderPalette.length - 1)];
      const gradientStart = mixHexColor(fromStart, toStart, paletteMix);
      const gradientEnd = mixHexColor(fromEnd, toEnd, paletteMix);

      if (milestoneNode) milestoneNode.textContent = milestones[activeIndex];
      if (progressNode) progressNode.style.width = `${progress}%`;
      if (progressNode) {
        progressNode.style.background = `linear-gradient(90deg, ${gradientStart}, ${gradientEnd})`;
      }
      if (statusNode) statusNode.textContent = `${Math.round(progress)}%`;
      steps.forEach((step, stepIndex) => {
        step.classList.toggle("is-active", stepIndex === activeIndex);
        step.classList.toggle("is-complete", stepIndex < activeIndex);
      });
    }

    function animateLoader(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const ratio = Math.min(elapsed / totalDuration, 1);
      paint(ratio);

      if (ratio >= 1) {
        loaderAnimationFrame = null;
        loaderTimer = window.setTimeout(finishLoader, 820);
        return;
      }

      loaderAnimationFrame = window.requestAnimationFrame(animateLoader);
    }

    paint(0);
    if (loaderTimer) {
      clearTimeout(loaderTimer);
      loaderTimer = null;
    }
    if (loaderAnimationFrame) {
      window.cancelAnimationFrame(loaderAnimationFrame);
      loaderAnimationFrame = null;
    }
    loaderAnimationFrame = window.requestAnimationFrame(animateLoader);
  }

  function finishLoader() {
    if (!state.loaderVisible) return;
    if (loaderTimer) {
      clearTimeout(loaderTimer);
      loaderTimer = null;
    }
    if (loaderAnimationFrame) {
      window.cancelAnimationFrame(loaderAnimationFrame);
      loaderAnimationFrame = null;
    }
    const loader = document.getElementById("loader");
    if (!loader) {
      state.loaderVisible = false;
      render();
      return;
    }
    loader.classList.add("is-hidden");
    window.sessionStorage.setItem("cv-loader-seen", "1");
    window.setTimeout(() => {
      state.loaderVisible = false;
      render();
    }, 520);
  }

  function setupRevealObserver() {
    if (revealObserver) revealObserver.disconnect();
    if (reduceMotion) {
      root.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const items = root.querySelectorAll(".reveal");
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    items.forEach((item) => revealObserver.observe(item));
  }

  function setupSectionObserver() {
    if (sectionObserver) sectionObserver.disconnect();
    const sections = root.querySelectorAll("[data-section]");
    const navLinks = root.querySelectorAll("[data-nav]");
    if (!sections.length || !navLinks.length) return;

    sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            state.activeSection = entry.target.id;
            navLinks.forEach((link) => {
              link.classList.toggle(
                "is-active",
                link.getAttribute("data-nav") === state.activeSection
              );
            });
          }
        });
      },
      { rootMargin: "-45% 0px -40% 0px", threshold: 0.01 }
    );

    sections.forEach((section) => sectionObserver.observe(section));
  }

  function setupAssistantVisibilityObserver() {
    if (assistantVisibilityObserver) assistantVisibilityObserver.disconnect();
    const fab = root.querySelector(".assistant-fab");
    const assistantSection = root.querySelector("#assistant");
    if (!fab || !assistantSection) return;

    assistantVisibilityObserver = new IntersectionObserver(
      ([entry]) => {
        fab.classList.toggle("is-hidden", entry.isIntersecting && entry.intersectionRatio > 0.28);
      },
      { threshold: [0, 0.28, 0.5] }
    );

    assistantVisibilityObserver.observe(assistantSection);
  }

  render();
})();

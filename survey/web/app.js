/* Poputi Survey front-end */
(() => {
  const QUESTIONS_URL = "questions.json"; // relative to survey/web/
  const DUMMY_ENDPOINT = "https://httpbin.org/post"; // replace with real endpoint later

  // i18n dictionary
  const i18n = {
    en: {
      title: "Poputi — Survey",
      intro: [
        "<p>Help us understand what counts as “along the way”.</p>",
        "<ul>",
        "<li>Your answers are confidential. We only collect data that you provide yourself.</li>",
        "<li>Source code and docs are available at <a href=\"https://github.com/rastsislaux/poputi\" target=\"_blank\" rel=\"noopener noreferrer\">github.com/rastsislaux/poputi</a>.</li>",
        "<li>You must answer at least 15 questions; if you can answer more — thank you!</li>",
        "</ul>"
      ].join("") ,
      metadataLegend: "Respondent metadata",
      questionsLegend: "Questions",
      prev: "Previous",
      next: "Next",
      submit: "Submit",
      fields: {
        Age: "Age",
        Sex: "Sex",
        Education: "Education",
        Country: "Country",
      },
      placeholders: {
        Age: "e.g., 30",
        Sex: "Select sex",
        Education: "Select education",
        Country: "Select country",
      },
      // Question text template ignores prompt, constructs from fields
      questionTitle: ({ means, value, unit }) => `If it takes you ${value} ${unit} to go from A to B by ${means}, how much extra time to reach C would still feel "along the way"?`,
      questionHelp: "How much extra time is still along the way?",
      validationMeta: "Please complete required fields.",
      validationAnswer: "Please enter a valid duration (e.g., 1h 30m).",
      done: "All questions answered. You can submit now.",
      submitting: "Submitting…",
      submitted: "Thanks! Your response has been recorded.",
      submitError: "Submission failed. Please try again.",
      toastSaved: "Saved",
      toastSubmitted: "Submitted",
      toastRestored: "Restored your progress",
    },
    ru: {
      title: "Попути — Опрос",
      intro: [
        "<p>Помогите понять, что такое «по пути».</p>",
        "<ul>", 
        "<li>Ваши ответы конфиденциальны. Мы собираем только ту информацию, которую вы сами указываете.</li>",
        "<li>Исходный код и документация доступны на <a href=\"https://github.com/rastsislaux/poputi\" target=\"_blank\" rel=\"noopener noreferrer\">github.com/rastsislaux/poputi</a>.</li>",
        "<li>Нужно ответить минимум на 15 вопросов; если сможете больше — большое спасибо!</li>",
        "</ul>"
      ].join("") ,
      metadataLegend: "Данные респондента",
      questionsLegend: "Вопросы",
      prev: "Назад",
      next: "Далее",
      submit: "Отправить",
      fields: {
        Age: "Возраст",
        Sex: "Пол",
        Education: "Образование",
        Country: "Страна",
      },
      placeholders: {
        Age: "например, 30",
        Sex: "Выберите пол",
        Education: "Выберите образование",
        Country: "Выберите страну",
      },
      questionTitle: ({ means, value, unit }) => `Если дорога от A до B занимает ${value} ${unit} на ${means}, сколько дополнительного времени до точки C вы бы считали «по пути»?`,
      questionHelp: "Сколько дополнительного времени все еще считается «по пути»?",
      validationMeta: "Пожалуйста, заполните обязательные поля.",
      validationAnswer: "Введите корректную длительность (например, 1ч 30м).",
      done: "Все вопросы отвечены. Можно отправить.",
      submitting: "Отправка…",
      submitted: "Спасибо! Ваш ответ записан.",
      submitError: "Не удалось отправить. Попробуйте еще раз.",
      toastSaved: "Сохранено",
      toastSubmitted: "Отправлено",
      toastRestored: "Ваш прогресс восстановлен",
    },
  };

  // Simple translations for means and units displayed inside question text (not changing raw payload)
  const displayMaps = {
    ru: {
      means: { walk: "пешком", bicycle: "велосипед", car: "машина", train: "поезд" },
      units: { minutes: "минут", hours: "часов", days: "дней" },
    },
    en: {
      means: { walk: "walk", bicycle: "bicycle", car: "car", train: "train" },
      units: { minutes: "minutes", hours: "hours", days: "days" },
    },
  };

  // Metadata spec from definition.md (fixed for v1)
  const respondentSpec = [
    { key: "Age", type: "number", required: false },
    { key: "Sex", type: "select", required: false, options: ["male", "female", "other"] },
    { key: "Education", type: "select", required: false, options: ["primary", "secondary", "higher", "other"] },
    { key: "Country", type: "select", required: false, options: ["BY", "RU", "UA", "PL", "US", "DE", "Other"] },
  ];

  // DOM refs
  const el = {
    title: document.getElementById("app-title"),
    intro: document.getElementById("intro-text"),
    metaLegend: document.getElementById("meta-legend"),
    qLegend: document.getElementById("questions-legend"),
    form: document.getElementById("survey-form"),
    metaFields: document.getElementById("metadata-fields"),
    qArea: document.getElementById("question-area"),
    qContainer: document.getElementById("question-container"),
    prev: document.getElementById("prev-btn"),
    next: document.getElementById("next-btn"),
    submitArea: document.getElementById("submit-area"),
    submitBtn: document.getElementById("submit-btn"),
    status: document.getElementById("status"),
    progressBar: document.getElementById("progress-bar"),
    langSelect: document.getElementById("lang-select"),
    toast: document.getElementById("toast-container"),
  };

  let lang = localStorage.getItem("poputi_lang") || "en";
  el.langSelect.value = lang;

  // State
  const state = {
    questions: [],
    answers: {}, // id -> { extra_value, unit }
    index: 0,
    minRequired: 15,
    userId: null,
  };

  // Simple persistent storage helpers
  const storageKeys = {
    userId: "poputi_user_id",
    answers: "poputi_answers",
    metadata: "poputi_metadata",
    index: "poputi_index",
  };

  function ensureUserId() {
    let id = localStorage.getItem(storageKeys.userId);
    if (!id) {
      id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(storageKeys.userId, id);
    }
    state.userId = id;
  }

  function saveProgress() {
    try {
      localStorage.setItem(storageKeys.answers, JSON.stringify(state.answers));
      localStorage.setItem(storageKeys.index, String(state.index));
      localStorage.setItem(storageKeys.metadata, JSON.stringify(collectMetadata()));
      showToast(i18n[lang].toastSaved);
    } catch {}
  }

  function loadProgress() {
    try {
      const ans = localStorage.getItem(storageKeys.answers);
      const idx = localStorage.getItem(storageKeys.index);
      const meta = localStorage.getItem(storageKeys.metadata);
      if (ans) state.answers = JSON.parse(ans);
      if (idx && Number.isFinite(Number(idx))) state.index = Math.max(0, Number(idx));
      if (meta) {
        const obj = JSON.parse(meta);
        respondentSpec.forEach(f => {
          const node = document.getElementById(`meta-${f.key}`);
          if (node && obj && Object.prototype.hasOwnProperty.call(obj, f.key)) {
            node.value = obj[f.key];
          }
        });
      }
      if (ans || meta) showToast(i18n[lang].toastRestored);
    } catch {}
  }

  function showToast(message) {
    if (!el.toast || !message) return;
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    el.toast.appendChild(node);
    setTimeout(() => {
      node.style.transition = "opacity 200ms ease, transform 200ms ease";
      node.style.opacity = "0";
      node.style.transform = "translateY(8px)";
      setTimeout(() => node.remove(), 220);
    }, 1400);
  }

  function t(key) {
    const d = i18n[lang];
    return d?.[key];
  }

  function applyTranslations() {
    document.title = t("title");
    el.title.textContent = t("title");
    el.intro.innerHTML = t("intro");
    el.metaLegend.textContent = t("metadataLegend");
    el.qLegend.textContent = t("questionsLegend");
    document.querySelectorAll("[data-i18n=prev]").forEach(n => n.textContent = t("prev"));
    document.querySelectorAll("[data-i18n=next]").forEach(n => n.textContent = t("next"));
    el.submitBtn.textContent = t("submit");
    // placeholders/labels for metadata fields
    el.metaFields.querySelectorAll("[data-field]").forEach(wrapper => {
      const key = wrapper.getAttribute("data-field");
      const label = wrapper.querySelector("label");
      const input = wrapper.querySelector("input, select");
      if (label) label.textContent = i18n[lang].fields[key] || key;
      if (input && input.placeholder !== undefined && input.tagName === "INPUT") {
        input.placeholder = i18n[lang].placeholders[key] || "";
      }
      // Translate select option labels while preserving values
      if (input && input.tagName === "SELECT") {
        const placeholderOpt = input.querySelector("option[value='']");
        if (placeholderOpt) placeholderOpt.textContent = i18n[lang].placeholders[key] || "";
        const spec = respondentSpec.find(f => f.key === key);
        if (spec && Array.isArray(spec.options)) {
          // map values -> translated label
          const labelMap = {
            Sex: { en: { male: "male", female: "female", other: "other" }, ru: { male: "мужской", female: "женский", other: "другое" } },
            Education: { en: { primary: "primary", secondary: "secondary", higher: "higher", other: "other" }, ru: { primary: "начальное", secondary: "среднее", higher: "высшее", other: "другое" } },
            Country: { en: { BY: "Belarus", RU: "Russia", UA: "Ukraine", PL: "Poland", US: "USA", DE: "Germany", Other: "Other" }, ru: { BY: "Беларусь", RU: "Россия", UA: "Украина", PL: "Польша", US: "США", DE: "Германия", Other: "Другая" } },
          };
          const map = (labelMap[key] || {})[lang] || {};
          input.querySelectorAll("option").forEach(opt => {
            if (opt.value === "") return;
            opt.textContent = map[opt.value] || opt.value;
          });
        }
      }
    });
  }

  function renderMetadata() {
    el.metaFields.innerHTML = "";
    respondentSpec.forEach(field => {
      const wrap = document.createElement("div");
      wrap.className = "row";
      wrap.setAttribute("data-field", field.key);

      const label = document.createElement("label");
      label.setAttribute("for", `meta-${field.key}`);
      label.textContent = i18n[lang].fields[field.key] || field.key;

      let input;
      if (field.type === "select") {
        input = document.createElement("select");
        input.id = `meta-${field.key}`;
        input.name = field.key;
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = i18n[lang].placeholders[field.key] || "";
        placeholder.disabled = false; // allow empty
        placeholder.selected = true;
        input.appendChild(placeholder);
        (field.options || []).forEach(opt => {
          const o = document.createElement("option");
          o.value = opt;
          o.textContent = opt;
          input.appendChild(o);
        });
      } else {
        input = document.createElement("input");
        input.type = field.type;
        input.id = `meta-${field.key}`;
        input.name = field.key;
        input.placeholder = i18n[lang].placeholders[field.key] || "";
        if (field.type === "number") input.min = "0";
      }

      wrap.appendChild(label);
      wrap.appendChild(input);
      el.metaFields.appendChild(wrap);
    });
  }

  function constructQuestionText(q) {
    // Do not use q.prompt; construct dynamically
    const maps = displayMaps[lang] || displayMaps.en;
    const means = maps.means[q.means_of_transportation] || q.means_of_transportation;
    const unit = maps.units[q.base_time_unit] || q.base_time_unit;
    return {
      title: i18n[lang].questionTitle({ means, value: q.base_time_value, unit }),
      help: i18n[lang].questionHelp,
    };
  }

  function renderQuestion() {
    const i = state.index;
    const total = state.questions.length;
    const q = state.questions[i];
    if (!q) return;
    const { title, help } = constructQuestionText(q);

    const prevAns = state.answers[q.id]?.extra_value ?? "";
    const prevUnit = state.answers[q.id]?.unit ?? q.base_time_unit;

    el.qContainer.innerHTML = "";
    const titleEl = document.createElement("div");
    titleEl.className = "q-title";
    // Only show answered count (no total)
    const answeredCount = Object.keys(state.answers).length;
    titleEl.textContent = `${answeredCount} — ${title}`;

    const helpEl = document.createElement("div");
    helpEl.className = "q-help";
    helpEl.textContent = help;

    const inputWrap = document.createElement("div");
    inputWrap.className = "row";
    const label = document.createElement("label");
    label.setAttribute("for", "answer-input");
    label.textContent = lang === "ru" ? "Ответ" : "Answer";

    const input = document.createElement("input");
    input.id = "answer-input";
    input.type = "text";
    input.placeholder = lang === "ru" ? "напр. 1ч 30м, 90м, 1.5ч, 2д" : "e.g., 1h 30m, 90m, 1.5h, 2d";
    input.value = prevAns ? formatDuration(prevAns) : "";

    const preview = document.createElement("div");
    preview.id = "answer-preview";
    preview.className = "q-help";
    preview.textContent = "";

    inputWrap.appendChild(label);
    inputWrap.appendChild(input);
    inputWrap.appendChild(preview);

    el.qContainer.appendChild(titleEl);
    el.qContainer.appendChild(helpEl);
    el.qContainer.appendChild(inputWrap);

    el.prev.disabled = i === 0;
    el.next.textContent = t("next");

    // progress
    const answered = Object.keys(state.answers).length;
    const pct = Math.min(100, Math.round((answered / state.minRequired) * 100));
    el.progressBar.style.width = `${pct}%`;

    // Auto-advance on Enter key and on valid blur
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        el.next.click();
      }
    });
    input.addEventListener("input", () => {
      const parsed = parseDurationToMinutes(input.value);
      if (parsed.valid) {
        preview.textContent = (lang === "ru" ? "≈ " : "≈ ") + formatMinutesReadable(parsed.minutesTotal);
        preview.classList.remove("error");
      } else {
        preview.textContent = parsed.hint || (lang === "ru" ? "Введите продолжительность" : "Enter a duration");
        preview.classList.toggle("error", input.value.trim().length > 0);
      }
    });
    input.addEventListener("blur", () => {
      const parsed = parseDurationToMinutes(input.value);
      if (parsed.valid) {
        const q = state.questions[state.index];
        state.answers[q.id] = { extra_value: parsed.minutesTotal, unit: "minutes" };
        updateSubmitVisibility();
      }
    });

    // Focus and select input for convenience
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  function validateMetadata() {
    // All fields optional in v1
    return true;
  }

  function validateAnswer(val) {
    if (val === "" || val === null || val === undefined) return false;
    const parsed = parseDurationToMinutes(val);
    return parsed.valid && parsed.minutesTotal >= 0;
  }

  function collectMetadata() {
    const meta = {};
    respondentSpec.forEach(f => {
      const input = document.getElementById(`meta-${f.key}`);
      meta[f.key] = input ? (input.value ?? "") : "";
    });
    return meta;
  }

  function showStatus(msg, kind = "info") {
    el.status.textContent = msg;
    el.status.className = kind === "error" ? "error" : "";
  }

  async function loadQuestions() {
    const res = await fetch(QUESTIONS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load questions.json");
    const data = await res.json();
    // Expect array of { id, means_of_transportation, base_time_value, base_time_unit, prompt }
    state.questions = Array.isArray(data) ? data : [];
    state.index = 0;
  }

  function updateSubmitVisibility() {
    const answered = Object.keys(state.answers).length;
    const ready = answered >= state.minRequired;
    el.submitArea.classList.toggle("hidden", !ready);
    if (ready) {
      showStatus(t("done"));
    } else {
      showStatus(`${answered}/${state.minRequired}`);
    }
  }

  // Event handlers
  el.prev.addEventListener("click", () => {
    if (state.index > 0) {
      state.index -= 1;
      renderQuestion();
    }
    saveProgress();
  });

  el.next.addEventListener("click", () => {
    // Save current answer and advance if valid
    const q = state.questions[state.index];
    const input = document.getElementById("answer-input");
    const val = input ? input.value : "";
    const parsed = parseDurationToMinutes(val);
    if (!parsed.valid) {
      showStatus(t("validationAnswer"), "error");
      return;
    }
    state.answers[q.id] = { extra_value: parsed.minutesTotal, unit: "minutes" };
    showStatus("");
    state.index = (state.index + 1) % state.questions.length;
    renderQuestion();
    updateSubmitVisibility();
    saveProgress();
  });

  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateMetadata()) {
      showStatus(t("validationMeta"), "error");
      return;
    }
    if (Object.keys(state.answers).length < state.minRequired) {
      showStatus(`${Object.keys(state.answers).length}/${state.minRequired}`, "error");
      return;
    }
    const payload = {
      lang,
      user_id: state.userId,
      respondent: collectMetadata(),
      answers: Object.entries(state.answers).map(([qid, ans]) => {
        const q = state.questions.find(x => String(x.id) === String(qid));
        return {
          question_id: q ? q.id : Number(qid),
          means_of_transportation: q ? q.means_of_transportation : undefined,
          base_time_value: q ? q.base_time_value : undefined,
          base_time_unit: q ? q.base_time_unit : undefined,
          acceptable_extra_time: ans.extra_value, // minutes total
          acceptable_extra_time_unit: "minutes",
        };
      }),
      submitted_at: new Date().toISOString(),
    };
    try {
      showStatus(t("submitting"));
      const res = await fetch(DUMMY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP error");
      showStatus(t("submitted"));
      showToast(i18n[lang].toastSubmitted);
      // Optionally display response id/echo
      // const json = await res.json();
      // console.log(json);
    } catch (err) {
      console.error(err);
      showStatus(t("submitError"), "error");
    }
  });

  el.langSelect.addEventListener("change", () => {
    lang = el.langSelect.value;
    localStorage.setItem("poputi_lang", lang);
    applyTranslations();
    // re-render current question with new text
    if (state.questions.length) renderQuestion();
    saveProgress();
  });

  // Init
  (async function init() {
    ensureUserId();
    renderMetadata();
    applyTranslations();
    try {
      await loadQuestions();
      loadProgress();
      el.qArea.classList.remove("hidden");
      renderQuestion();
      updateSubmitVisibility();
    } catch (e) {
      showStatus("Failed to initialize questions.json", "error");
    }
  })();
})();

// -------- Duration parsing utilities --------
function parseDurationToMinutes(input) {
  if (!input || typeof input !== "string") return { valid: false, minutesTotal: 0 };
  const s = input.trim().toLowerCase().replace(/,/g, ".");
  if (!s) return { valid: false, minutesTotal: 0 };

  // Supported tokens (en/ru): m, min, mins, minute(s); h, hr(s), hour(s); d, day(s)
  // ru: м, мин, минуты, час, ч, часов; д, день, дней
  let minutes = 0;
  // Pattern to capture sequences like "1.5h", "1 h", "90m", "2d", and ru equivalents; avoid \b which fails on Cyrillic
  const pattern = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|ч|ч\.|час|часа|часов|m|min|mins|minute|minutes|м|м\.|мин|мин\.|минуты|минут|d|day|days|д|д\.|день|дня|дней)(?=\s|$)/g;
  let match;
  let consumedAny = false;
  while ((match = pattern.exec(s)) !== null) {
    consumedAny = true;
    const value = parseFloat(match[1]);
    const unit = match[2];
    if (isNaN(value)) continue;
    if (/^(h|hr|hrs|hour|hours|ч|ч\.|час|часа|часов)$/.test(unit)) {
      minutes += value * 60;
    } else if (/^(m|min|mins|minute|minutes|м|м\.|мин|мин\.|минуты|минут)$/.test(unit)) {
      minutes += value;
    } else if (/^(d|day|days|д|д\.|день|дня|дней)$/.test(unit)) {
      minutes += value * 60 * 24;
    }
  }

  // If no unit tokens found, try plain number fallback: treat as minutes
  if (!consumedAny) {
    const num = Number(s);
    if (Number.isFinite(num) && num >= 0) {
      minutes = num;
      consumedAny = true;
    }
  }

  if (!consumedAny) return { valid: false, minutesTotal: 0, hint: "" };
  return { valid: minutes >= 0, minutesTotal: Math.round(minutes) };
}

function formatMinutesReadable(mins) {
  const abs = Math.round(mins);
  const d = Math.floor(abs / (24 * 60));
  const h = Math.floor((abs % (24 * 60)) / 60);
  const m = abs % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

function formatDuration(mins) {
  return formatMinutesReadable(Number(mins) || 0);
}



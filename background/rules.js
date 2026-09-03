(() => {
  const DICT_VERSION = "libreoffice-ru_RU-master-v1";
  const DB_NAME = "TextMateRussianDictionary";
  const STORE_NAME = "files";

  const DICTIONARY_SOURCES = {
    aff: [
      "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/ru_RU/ru_RU.aff",
      "https://cdn.jsdelivr.net/gh/LibreOffice/dictionaries@master/ru_RU/ru_RU.aff"
    ],
    dic: [
      "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/ru_RU/ru_RU.dic",
      "https://cdn.jsdelivr.net/gh/LibreOffice/dictionaries@master/ru_RU/ru_RU.dic"
    ]
  };

  const COMMON_TYPOS = new Map([
    ["вообщем", "в общем"],
    ["вобщем", "в общем"],
    ["впринципе", "в принципе"],
    ["какбудто", "как будто"],
    ["изза", "из-за"],
    ["изпод", "из-под"],
    ["поидее", "по идее"],
    ["помоему", "по-моему"],
    ["чтоли", "что ли"],
    ["врядли", "вряд ли"],
    ["наврятли", "навряд ли"],
    ["наврядли", "навряд ли"],
    ["всётаки", "всё-таки"],
    ["всетаки", "всё-таки"],
    ["ктонибудь", "кто-нибудь"],
    ["чтонибудь", "что-нибудь"],
    ["какойнибудь", "какой-нибудь"],
    ["когданибудь", "когда-нибудь"],
    ["гденибудь", "где-нибудь"],
    ["почемуто", "почему-то"],
    ["зачемто", "зачем-то"],
    ["какойто", "какой-то"],
    ["какието", "какие-то"],
    ["чьито", "чьи-то"],
    ["придти", "прийти"],
    ["прийдёт", "придёт"],
    ["прийдет", "придёт"],
    ["прийду", "приду"],
    ["прийдут", "придут"],
    ["будующее", "будущее"],
    ["будующем", "будущем"],
    ["следущий", "следующий"],
    ["следущая", "следующая"],
    ["следущее", "следующее"],
    ["учавствовать", "участвовать"],
    ["учавствовал", "участвовал"],
    ["учавствует", "участвует"],
    ["агенство", "агентство"],
    ["агенстве", "агентстве"],
    ["дермантин", "дерматин"],
    ["инциндент", "инцидент"],
    ["инцендент", "инцидент"],
    ["компроментировать", "компрометировать"],
    ["константировать", "констатировать"],
    ["координально", "кардинально"],
    ["скурпулёзный", "скрупулёзный"],
    ["скурпулезный", "скрупулёзный"],
    ["черезчур", "чересчур"],
    ["через чур", "чересчур"],
    ["экспрессо", "эспрессо"],
    ["симпотичный", "симпатичный"],
    ["симпотичная", "симпатичная"],
    ["девченка", "девчонка"],
    ["девченки", "девчонки"],
    ["мальченка", "мальчонка"],
    ["подскользнуться", "поскользнуться"],
    ["потскользнуться", "поскользнуться"],
    ["в течении", "в течение"],
    ["в последствии", "впоследствии"],
    ["в последствие", "впоследствии"],
    ["иметь ввиду", "иметь в виду"],
    ["имей ввиду", "имей в виду"]
  ]);

  const RUSSIAN_ALPHABET = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";

  let dictionaryPromise = null;
  let dictionaryState = {
    ready: false,
    forms: null,
    source: null,
    formsCount: 0
  };

  function normalizeWord(word) {
    return String(word || "").toLocaleLowerCase("ru-RU");
  }

  function isMostlyRussian(text) {
    const letters = String(text).match(/\p{L}/gu) || [];
    if (!letters.length) return true;
    const cyr = String(text).match(/[А-Яа-яЁё]/g) || [];
    return cyr.length / letters.length >= 0.7;
  }

  function preserveCase(original, correction) {
    if (!original) return correction;
    if (original === original.toUpperCase() && /[А-ЯЁ]/.test(original)) {
      return correction.toUpperCase();
    }
    const first = original[0];
    if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
      return correction.charAt(0).toUpperCase() + correction.slice(1);
    }
    return correction;
  }

  function addError(errors, original, correction, explanation) {
    if (!original || original === correction) return;
    errors.push({ original, correction, explanation });
  }

  function replaceRegex(state, regex, replacer, explanation) {
    state.text = state.text.replace(regex, (...args) => {
      const match = args[0];
      const replacement = typeof replacer === "function" ? replacer(...args) : replacer;
      if (replacement !== match) addError(state.errors, match, replacement, explanation);
      return replacement;
    });
  }

  function correctCommonTypos(state) {
    const entries = [...COMMON_TYPOS.entries()].sort((a, b) => b[0].length - a[0].length);

    for (const [wrong, right] of entries) {
      const escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|[^А-Яа-яЁё])(${escaped})(?=$|[^А-Яа-яЁё])`, "giu");
      state.text = state.text.replace(regex, (full, prefix, found) => {
        const correction = preserveCase(found, right);
        addError(state.errors, found, correction, "Исправлена типичная орфографическая ошибка.");
        return prefix + correction;
      });
    }
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("Локальное хранилище словаря недоступно."));
        return;
      }

      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Не удалось открыть хранилище словаря."));
    });
  }

  async function dbGet(key) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async function dbSet(key, value) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("Запись словаря отменена."));
      });
    } finally {
      db.close();
    }
  }

  async function fetchFirst(urls, minLength) {
    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!text || text.length < minLength) throw new Error("Получен неполный файл словаря.");
        return { text, url };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Не удалось скачать русский словарь.");
  }

  async function loadDictionaryFiles() {
    const affKey = `${DICT_VERSION}:aff`;
    const dicKey = `${DICT_VERSION}:dic`;

    let [aff, dic] = await Promise.all([
      dbGet(affKey).catch(() => null),
      dbGet(dicKey).catch(() => null)
    ]);

    if (typeof aff === "string" && typeof dic === "string" && aff.length > 100 && dic.length > 1000) {
      return { aff, dic, source: "local-cache" };
    }

    const [affRemote, dicRemote] = await Promise.all([
      fetchFirst(DICTIONARY_SOURCES.aff, 100),
      fetchFirst(DICTIONARY_SOURCES.dic, 1000)
    ]);

    aff = affRemote.text;
    dic = dicRemote.text;

    await Promise.all([
      dbSet(affKey, aff).catch(() => {}),
      dbSet(dicKey, dic).catch(() => {})
    ]);

    return { aff, dic, source: "download" };
  }

  function parseFlags(text, flagMode) {
    if (!text) return [];
    if (flagMode === "num") return text.split(",").filter(Boolean);
    if (flagMode === "long") {
      const out = [];
      for (let i = 0; i < text.length; i += 2) out.push(text.slice(i, i + 2));
      return out;
    }
    return Array.from(text);
  }

  function parseAff(affData) {
    const lines = String(affData).replace(/^\uFEFF/, "").split(/\r?\n/);
    const rules = new Map();
    let flagMode = "utf8";
    let needAffix = null;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw || raw.startsWith("#")) continue;
      const parts = raw.split(/\s+/);

      if (parts[0] === "FLAG") {
        const value = String(parts[1] || "").toLowerCase();
        flagMode = value === "num" ? "num" : value === "long" ? "long" : "utf8";
        continue;
      }

      if (parts[0] === "NEEDAFFIX") {
        needAffix = parts[1] || null;
        continue;
      }

      if ((parts[0] === "SFX" || parts[0] === "PFX") && parts.length >= 4 && /^\d+$/.test(parts[3])) {
        const type = parts[0];
        const code = parts[1];
        const combineable = parts[2] === "Y";
        const count = Number(parts[3]);
        const entries = [];

        for (let j = 0; j < count && i + 1 < lines.length; j++) {
          i++;
          const entryRaw = lines[i].trim();
          if (!entryRaw || entryRaw.startsWith("#")) {
            j--;
            continue;
          }

          const ep = entryRaw.split(/\s+/);
          if (ep.length < 5 || ep[0] !== type || ep[1] !== code) continue;

          const strip = ep[2] === "0" ? "" : ep[2];
          const addRaw = ep[3] === "0" ? "" : ep[3];
          const [add, continuationRaw = ""] = addRaw.split("/", 2);
          const conditionText = ep[4] || ".";
          let condition = null;
          try {
            if (conditionText !== ".") {
              condition = new RegExp(type === "SFX" ? `${conditionText}$` : `^${conditionText}`, "u");
            }
          } catch {
            condition = null;
          }

          entries.push({
            type,
            strip,
            add,
            continuation: parseFlags(continuationRaw, flagMode),
            condition
          });
        }

        rules.set(code, { type, combineable, entries });
      }
    }

    return { rules, flagMode, needAffix };
  }

  function applyEntry(word, entry) {
    if (entry.condition && !entry.condition.test(word)) return null;

    if (entry.type === "SFX") {
      if (entry.strip && !word.endsWith(entry.strip)) return null;
      const base = entry.strip ? word.slice(0, -entry.strip.length) : word;
      return base + entry.add;
    }

    if (entry.strip && !word.startsWith(entry.strip)) return null;
    const base = entry.strip ? word.slice(entry.strip.length) : word;
    return entry.add + base;
  }

  function addForm(forms, word) {
    if (!word) return;
    const normalized = normalizeWord(word);
    if (!forms.has(normalized)) forms.set(normalized, normalized);

    if (normalized.includes("ё")) {
      const noYo = normalized.replaceAll("ё", "е");
      if (!forms.has(noYo)) forms.set(noYo, normalized);
    }
  }

  function expandDictionary(affData, dicData) {
    const { rules, flagMode, needAffix } = parseAff(affData);
    const forms = new Map();
    const lines = String(dicData).replace(/^\uFEFF/, "").split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;
      if (i === 0 && /^\d+$/.test(line)) continue;

      line = line.replace(/\s.*$/, "");
      if (!line) continue;

      let word = line;
      let flagsText = "";
      let slashIndex = -1;
      for (let k = 0; k < line.length; k++) {
        if (line[k] === "/" && line[k - 1] !== "\\") {
          slashIndex = k;
          break;
        }
      }
      if (slashIndex >= 0) {
        word = line.slice(0, slashIndex);
        flagsText = line.slice(slashIndex + 1);
      }
      word = word.replaceAll("\\/", "/");
      if (!/[А-Яа-яЁё]/.test(word)) continue;

      const flags = parseFlags(flagsText, flagMode);
      const needsAffix = needAffix && flags.includes(needAffix);
      if (!needsAffix) addForm(forms, word);

      for (const flag of flags) {
        const rule = rules.get(flag);
        if (!rule) continue;

        for (const entry of rule.entries) {
          const derived = applyEntry(word, entry);
          if (!derived) continue;
          addForm(forms, derived);

          for (const nextFlag of entry.continuation) {
            const nextRule = rules.get(nextFlag);
            if (!nextRule) continue;
            for (const nextEntry of nextRule.entries) {
              const second = applyEntry(derived, nextEntry);
              if (second) addForm(forms, second);
            }
          }
        }
      }

      const prefixRules = flags.map((f) => rules.get(f)).filter((r) => r?.type === "PFX" && r.combineable);
      const suffixRules = flags.map((f) => rules.get(f)).filter((r) => r?.type === "SFX" && r.combineable);

      for (const pr of prefixRules) {
        for (const pe of pr.entries) {
          const prefixed = applyEntry(word, pe);
          if (!prefixed) continue;
          for (const sr of suffixRules) {
            for (const se of sr.entries) {
              const both = applyEntry(prefixed, se);
              if (both) addForm(forms, both);
            }
          }
        }
      }
    }

    return forms;
  }

  async function ensureDictionary() {
    if (dictionaryState.ready && dictionaryState.forms) return dictionaryState;
    if (dictionaryPromise) return dictionaryPromise;

    dictionaryPromise = (async () => {
      const files = await loadDictionaryFiles();
      const forms = expandDictionary(files.aff, files.dic);
      if (!forms.size) throw new Error("Русский словарь не удалось разобрать.");

      dictionaryState = {
        ready: true,
        forms,
        source: files.source,
        formsCount: forms.size
      };
      return dictionaryState;
    })().catch((error) => {
      dictionaryPromise = null;
      throw error;
    });

    return dictionaryPromise;
  }

  function isDictionaryWord(forms, word) {
    const normalized = normalizeWord(word);
    return forms.has(normalized) || forms.has(normalized.replaceAll("ё", "е"));
  }

  function levenshtein(a, b, limit = 3) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = cur[0];
      for (let j = 1; j <= b.length; j++) {
        const value = Math.min(
          cur[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        cur[j] = value;
        if (value < rowMin) rowMin = value;
      }
      if (rowMin > limit) return limit + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function collectDeleteCandidates(forms, word, maxDepth = 2) {
    const found = new Set();
    let frontier = new Set([word]);
    const visited = new Set([word]);

    for (let depth = 1; depth <= maxDepth; depth++) {
      const next = new Set();

      for (const current of frontier) {
        for (let i = 0; i < current.length; i++) {
          const candidate = current.slice(0, i) + current.slice(i + 1);
          if (visited.has(candidate)) continue;
          visited.add(candidate);
          next.add(candidate);
          if (forms.has(candidate)) found.add(forms.get(candidate));
        }

        for (let i = 0; i < current.length - 1; i++) {
          if (current[i] === current[i + 1]) continue;
          const candidate =
            current.slice(0, i) +
            current[i + 1] +
            current[i] +
            current.slice(i + 2);
          if (forms.has(candidate)) found.add(forms.get(candidate));
        }
      }

      frontier = next;
      if (found.size >= 12) break;
    }

    return found;
  }

  function collectOneEditCandidates(forms, word, found) {
    for (let i = 0; i < word.length && found.size < 20; i++) {
      for (const char of RUSSIAN_ALPHABET) {
        if (char === word[i]) continue;
        const candidate = word.slice(0, i) + char + word.slice(i + 1);
        if (forms.has(candidate)) found.add(forms.get(candidate));
      }
    }

    for (let i = 0; i <= word.length && found.size < 20; i++) {
      for (const char of RUSSIAN_ALPHABET) {
        const candidate = word.slice(0, i) + char + word.slice(i);
        if (forms.has(candidate)) found.add(forms.get(candidate));
      }
    }
  }

  function suggest(forms, word) {
    const normalized = normalizeWord(word);
    const found = collectDeleteCandidates(forms, normalized, 2);
    collectOneEditCandidates(forms, normalized, found);

    if (!found.size) return null;

    const ranked = [...found]
      .map((candidate) => ({
        candidate,
        distance: levenshtein(normalized, candidate, 3),
        sameStart: candidate[0] === normalized[0],
        sameEnd: candidate.at(-1) === normalized.at(-1)
      }))
      .filter((x) => x.distance <= 3)
      .sort((a, b) =>
        a.distance - b.distance ||
        Number(b.sameStart) - Number(a.sameStart) ||
        Number(b.sameEnd) - Number(a.sameEnd) ||
        Math.abs(a.candidate.length - normalized.length) - Math.abs(b.candidate.length - normalized.length)
      );

    return ranked[0] || null;
  }

  function shouldSkipWord(text, word, index) {
    if (word.length <= 2) return true;
    if (/^[А-ЯЁ]{2,}$/.test(word)) return true;

    const isCapitalized = /^[А-ЯЁ][а-яё]+$/.test(word);
    if (isCapitalized) {
      const before = text.slice(0, index).trimEnd();
      const sentenceStart = !before || /[.!?]\s*$/u.test(before);
      if (!sentenceStart) return true;
    }

    return false;
  }

  function applySpelling(state, forms) {
    const text = state.text;
    const regex = /[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*/gu;
    const replacements = [];

    for (const match of text.matchAll(regex)) {
      const word = match[0];
      const index = match.index ?? 0;
      if (shouldSkipWord(text, word, index)) continue;

      const parts = word.split("-");
      if (parts.every((part) => isDictionaryWord(forms, part))) continue;

      const suggestion = parts.length === 1 ? suggest(forms, word) : null;
      if (!suggestion) continue;

      const corrected = preserveCase(word, suggestion.candidate);
      const distance = suggestion.distance;

      const confident =
        distance === 1 ||
        (distance === 2 &&
          word.length >= 7 &&
          suggestion.sameStart &&
          suggestion.sameEnd);

      if (!confident) continue;

      replacements.push({
        start: index,
        end: index + word.length,
        original: word,
        correction: corrected,
        explanation: "Слово не найдено в русском словаре. Предложено ближайшее написание."
      });
    }

    replacements.sort((a, b) => b.start - a.start);
    for (const item of replacements) {
      state.text =
        state.text.slice(0, item.start) +
        item.correction +
        state.text.slice(item.end);
      addError(state.errors, item.original, item.correction, item.explanation);
    }
  }

  async function correct(text) {
    const original = String(text ?? "");
    if (!original.trim()) throw new Error("Текст пуст.");

    if (!isMostlyRussian(original)) {
      throw new Error("Режим «Без AI» предназначен для текста на русском языке.");
    }

    const state = { text: original, errors: [] };

    replaceRegex(state, /\u00A0/g, " ", "Неразрывный пробел заменён обычным.");
    replaceRegex(state, /[ \t]{2,}/g, " ", "Удалены лишние пробелы.");
    replaceRegex(state, /[ \t]+([,.;:!?])/g, (_m, p) => p, "Удалён лишний пробел перед знаком препинания.");
    replaceRegex(state, /([,;:])\1+/g, (_m, mark) => mark, "Удалён повторяющийся знак препинания.");
    replaceRegex(state, /([,;])([А-Яа-яЁё])/g, (_m, mark, letter) => `${mark} ${letter}`, "Добавлен пробел после знака препинания.");
    replaceRegex(state, /(^|[^.])\.([А-Яа-яЁё])/g, (_m, prefix, letter) => `${prefix}. ${letter}`, "Добавлен пробел после точки.");
    replaceRegex(
      state,
      /(^|[^А-Яа-яЁё])([А-Яа-яЁё]{2,})([ \t]+)\2(?=$|[^А-Яа-яЁё])/giu,
      (_m, prefix, word) => prefix + word,
      "Удалён случайный повтор слова."
    );

    correctCommonTypos(state);

    replaceRegex(state, /^([ \t]*)([а-яё])/u, (_m, spaces, letter) => spaces + letter.toUpperCase(), "Первое слово предложения начинается с заглавной буквы.");
    replaceRegex(state, /([.!?][ \t]+)([а-яё])/gu, (_m, prefix, letter) => prefix + letter.toUpperCase(), "Предложение начинается с заглавной буквы.");

    let dictionaryInfo;
    try {
      dictionaryInfo = await ensureDictionary();
      applySpelling(state, dictionaryInfo.forms);
    } catch (error) {
      throw new Error(
        `Не удалось загрузить русский словарь. При первом использовании режима без AI нужен интернет. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return {
      correctedText: state.text,
      errors: state.errors.slice(0, 100),
      provider: "rules",
      model: "LibreOffice Russian dictionary + local rules",
      noAI: true,
      dictionarySource: dictionaryInfo.source,
      dictionaryForms: dictionaryInfo.formsCount
    };
  }

  async function getDictionaryStatus() {
    if (dictionaryState.ready) {
      return {
        ready: true,
        source: dictionaryState.source,
        formsCount: dictionaryState.formsCount
      };
    }

    const aff = await dbGet(`${DICT_VERSION}:aff`).catch(() => null);
    const dic = await dbGet(`${DICT_VERSION}:dic`).catch(() => null);
    return {
      ready: typeof aff === "string" && typeof dic === "string",
      source: typeof aff === "string" && typeof dic === "string" ? "local-cache" : null,
      formsCount: 0
    };
  }

  globalThis.TextMateRules = Object.freeze({
    correct,
    isMostlyRussian,
    ensureDictionary,
    getDictionaryStatus
  });
})();

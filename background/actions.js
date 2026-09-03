(() => {
  const P = globalThis.AITextProviders;
  const C = globalThis.AITextCache;

  const TRANSFORMS = {
    simplify: "Перепиши текст проще и понятнее. Сохрани смысл, факты, имена, числа, ссылки и важные детали. Убери сложные обороты и канцелярит.",
    shorten: "Сделай текст заметно короче без потери ключевого смысла, фактов, дат, чисел, имён и необходимых действий. Удали повторы.",
    polite: "Перепиши текст в более вежливом и доброжелательном тоне. Сохрани смысл и позицию автора. Не добавляй лишних извинений.",
    formal: "Перепиши текст в официальном деловом стиле. Сохрани смысл, факты и конкретику. Избегай канцелярских перегибов.",
    rephrase: "Дай три заметно отличающихся естественных варианта формулировки с тем же смыслом. Сохрани исходный язык текста."
  };

  const correctionSchema = {
    type: "OBJECT",
    properties: {
      correctedText: { type: "STRING" },
      errors: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            original: { type: "STRING" },
            correction: { type: "STRING" },
            explanation: { type: "STRING" }
          },
          required: ["original", "correction", "explanation"]
        }
      }
    },
    required: ["correctedText", "errors"]
  };

  const translateSchema = {
    type: "OBJECT",
    properties: {
      sourceLanguage: { type: "STRING" },
      translation: { type: "STRING" },
      notes: { type: "ARRAY", items: { type: "STRING" } }
    },
    required: ["sourceLanguage", "translation", "notes"]
  };

  const transformSchema = {
    type: "OBJECT",
    properties: {
      output: { type: "STRING" },
      alternatives: { type: "ARRAY", items: { type: "STRING" } }
    },
    required: ["output", "alternatives"]
  };

  function parseJson(text) {
    const raw = String(text || "").trim();
    if (!raw) throw new Error("Модель вернула пустой ответ.");
    try { return JSON.parse(raw); } catch {}
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try { return JSON.parse(fenced); } catch {}
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
    }
    throw new Error("Не удалось разобрать ответ модели.");
  }

  async function cached(action, text, quality, work) {
    const settings = await P.settings();
    const key = C.makeKey({
      action, text, quality,
      mode: settings.runMode,
      cloud: settings.cloudProvider,
      geminiFastModel: settings.geminiFastModel,
      geminiQualityModel: settings.geminiQualityModel,
      openaiBaseUrl: settings.openaiBaseUrl,
      openaiFastModel: settings.openaiFastModel,
      openaiQualityModel: settings.openaiQualityModel
    });
    const hit = await C.get(key);
    if (hit) return { ...hit, cached: true };
    const value = await work();
    await C.set(key, value);
    return { ...value, cached: false };
  }

  async function correct(text) {
    if (!String(text || "").trim()) throw new Error("Сначала выделите текст.");
    return cached("edit", text, "quality", async () => {
      const result = await P.chat({
        quality: "quality",
        temperature: 0,
        numPredict: 320,
        schema: correctionSchema,
        system: "Ты профессиональный редактор русского языка. Исправляй только реальные орфографические, пунктуационные, грамматические и явные стилистические ошибки. Сохраняй смысл, тон, имена, факты, форматирование и абзацы. Не добавляй новую информацию. Верни только JSON вида {\"correctedText\":\"...\",\"errors\":[{\"original\":\"...\",\"correction\":\"...\",\"explanation\":\"...\"}]}",
        user: `Проверь текст и верни исправленную версию и список правок.\n\nТЕКСТ:\n${text}`
      });
      const parsed = parseJson(result.text);
      if (typeof parsed.correctedText !== "string") throw new Error("Модель вернула исправление в неожиданном формате.");
      return {
        correctedText: parsed.correctedText,
        errors: Array.isArray(parsed.errors) ? parsed.errors.slice(0, 100).map((item) => ({
          original: String(item?.original ?? ""),
          correction: String(item?.correction ?? ""),
          explanation: String(item?.explanation ?? "")
        })) : [],
        model: result.model,
        provider: result.provider
      };
    });
  }

  async function translate(text) {
    if (!String(text || "").trim()) throw new Error("Сначала выделите текст.");
    return cached("translate", text, "quality", async () => {
      const result = await P.chat({
        quality: "quality",
        temperature: 0,
        numPredict: 320,
        schema: translateSchema,
        system: "Ты профессиональный переводчик. Определи язык исходного текста и переведи его на естественный русский язык. Сохраняй смысл, тон, структуру, абзацы, списки, имена, числа, ссылки и форматирование. Не добавляй факты. Верни только JSON вида {\"sourceLanguage\":\"...\",\"translation\":\"...\",\"notes\":[]}.",
        user: `Переведи текст на русский язык.\n\nТЕКСТ:\n${text}`
      });
      const parsed = parseJson(result.text);
      if (typeof parsed.translation !== "string") throw new Error("Модель вернула перевод в неожиданном формате.");
      return {
        sourceLanguage: String(parsed.sourceLanguage || "Автоопределение"),
        translation: parsed.translation,
        notes: Array.isArray(parsed.notes) ? parsed.notes.map(String).filter(Boolean).slice(0, 20) : [],
        model: result.model,
        provider: result.provider
      };
    });
  }

  function cleanPlainText(text) {
    return String(text || "")
      .trim()
      .replace(/^```(?:text|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  function parseRephraseAlternatives(text) {
    const raw = cleanPlainText(text);
    if (!raw) return [];

    const numbered = raw
      .split(/\n+/)
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);

    if (numbered.length >= 2) return numbered.slice(0, 3);

    const separated = raw.split(/\s*;\s*/).map((item) => item.trim()).filter(Boolean);
    return separated.length >= 2 ? separated.slice(0, 3) : [raw];
  }

  async function transform(text, action) {
    if (!String(text || "").trim()) throw new Error("Сначала выделите текст.");
    if (!TRANSFORMS[action]) throw new Error("Неизвестное действие.");

    return cached(action, text, "fast", async () => {
      const isRephrase = action === "rephrase";
      const result = await P.chat({
        quality: "fast",
        temperature: isRephrase ? 0.45 : 0.05,
        numPredict: isRephrase ? 180 : 120,
        system: isRephrase
          ? `${TRANSFORMS[action]} Не добавляй факты от себя. Верни ровно 3 варианта, каждый с новой строки. Без пояснений, заголовков и JSON.`
          : `${TRANSFORMS[action]} Не добавляй факты от себя. Верни только готовый переписанный текст. Без пояснений, кавычек, заголовков и JSON.`,
        user: `ТЕКСТ:\n${text}`
      });

      const raw = cleanPlainText(result.text);
      if (!raw) throw new Error("Модель вернула пустой результат. Попробуйте ещё раз.");

      if (isRephrase) {
        const alternatives = parseRephraseAlternatives(raw);
        const output = alternatives[0] || raw;
        return { output, alternatives, model: result.model, provider: result.provider };
      }

      return { output: raw, alternatives: [], model: result.model, provider: result.provider };
    });
  }

  globalThis.AITextActions = Object.freeze({ correct, translate, transform });
})();

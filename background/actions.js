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

  function tryParseJson(text) {
    let raw = String(text || "")
      .replace(/^\uFEFF/, "")
      .trim();

    if (!raw) return null;

    const candidates = [raw];

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) candidates.push(fenced);

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      candidates.push(raw.slice(start, end + 1));
    }

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {}

      // Частые мелкие ошибки маленьких локальных моделей:
      // trailing comma перед }/] и типографские кавычки.
      const repaired = candidate
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, "$1");

      try {
        return JSON.parse(repaired);
      } catch {}
    }

    return null;
  }

  function plainModelText(text) {
    return String(text || "")
      .trim()
      .replace(/^```(?:text|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
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
        system: "Ты профессиональный редактор русского языка. Исправляй только реальные орфографические, пунктуационные, грамматические и явные стилистические ошибки. Сохраняй смысл, тон, имена, факты, форматирование и абзацы. Не добавляй новую информацию. Верни только JSON вида {\"correctedText\":\"...\",\"errors\":[{\"original\":\"...\",\"correction\":\"...\",\"explanation\":\"...\"}]}.",
        user: `Проверь текст и верни исправленную версию и список правок.\n\nТЕКСТ:\n${text}`
      });
      const parsed = tryParseJson(result.text);

      if (parsed && typeof parsed.correctedText === "string") {
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
      }

      // Если модель нарушила JSON-формат, не падаем:
      // повторяем запрос в максимально простом текстовом формате.
      const fallback = await P.chat({
        quality: "quality",
        temperature: 0,
        numPredict: 320,
        system: "Ты профессиональный редактор русского языка. Исправь только реальные орфографические, пунктуационные, грамматические и явные стилистические ошибки. Сохрани смысл, тон, имена, факты, абзацы и форматирование. Не добавляй новую информацию. Верни ТОЛЬКО готовый исправленный текст без JSON, заголовков, пояснений и кавычек.",
        user: `ТЕКСТ:\n${text}`
      });

      const correctedText = plainModelText(fallback.text);
      if (!correctedText) throw new Error("Модель вернула пустой результат.");

      return {
        correctedText,
        errors: [],
        model: fallback.model || result.model,
        provider: fallback.provider || result.provider,
        fallback: true
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
      const parsed = tryParseJson(result.text);

      if (parsed && typeof parsed.translation === "string") {
        return {
          sourceLanguage: String(parsed.sourceLanguage || "Автоопределение"),
          translation: parsed.translation,
          notes: Array.isArray(parsed.notes) ? parsed.notes.map(String).filter(Boolean).slice(0, 20) : [],
          model: result.model,
          provider: result.provider
        };
      }

      const fallback = await P.chat({
        quality: "quality",
        temperature: 0,
        numPredict: 320,
        system: "Ты профессиональный переводчик. Переведи исходный текст на естественный русский язык. Сохрани смысл, тон, структуру, абзацы, списки, имена, числа, ссылки и форматирование. Не добавляй факты. Верни ТОЛЬКО готовый перевод без JSON, заголовков, пояснений и кавычек.",
        user: `ТЕКСТ:\n${text}`
      });

      const translation = plainModelText(fallback.text);
      if (!translation) throw new Error("Модель вернула пустой результат.");

      return {
        sourceLanguage: "Автоопределение",
        translation,
        notes: [],
        model: fallback.model || result.model,
        provider: fallback.provider || result.provider,
        fallback: true
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

    // Fallback for models that put variants on one line separated with semicolons.
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
        // В быстрых действиях намеренно НЕ используем JSON schema.
        // Маленькие локальные модели отвечают так быстрее и стабильнее.
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

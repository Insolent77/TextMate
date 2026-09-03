(() => {
  const FAST_OLLAMA_MODEL = "qwen3:0.6b";
  const QUALITY_OLLAMA_MODEL = "qwen3:1.7b";
  const KEEP_ALIVE = "30m";
  const OLLAMA_URL = "http://127.0.0.1:11434";
  const OLLAMA_TIMEOUT = 30000;
  const RETIRED_GEMINI = new Set(["gemini-2.5-flash"]);
  const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

  async function settings() {
    const value = await chrome.storage.local.get([
      "runMode", "cloudProvider", "aiProvider",
      "geminiApiKey", "geminiFastModel", "geminiQualityModel", "geminiModel",
      "officialOpenaiApiKey", "officialOpenaiFastModel", "officialOpenaiQualityModel",
      "openaiBaseUrl", "openaiApiKey", "openaiFastModel", "openaiQualityModel",
      "textmateCloudUrl", "textmateClientId"
    ]);

    // Backward compatibility with v0.4.x settings.
    const runMode = value.runMode || (value.aiProvider === "gemini" ? "cloud" : "local");
    const cloudProvider = value.cloudProvider || "gemini";
    return { ...value, runMode, cloudProvider };
  }

  async function fetchWithTimeout(url, init = {}, ms = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Сервис не успел ответить. Попробуйте ещё раз.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  let modelListCache = { at: 0, models: [] };

  async function listOllamaModels(force = false) {
    if (!force && Date.now() - modelListCache.at < 30000 && modelListCache.models.length) {
      return modelListCache.models;
    }
    try {
      const response = await fetchWithTimeout(`${OLLAMA_URL}/api/tags`, { method: "GET" }, 3000);
      if (!response.ok) throw new Error(`Ollama ответила с ошибкой ${response.status}.`);
      const payload = await response.json().catch(() => ({}));
      const models = (payload.models || []).map((item) => String(item?.name || item?.model || "")).filter(Boolean);
      modelListCache = { at: Date.now(), models };
      return models;
    } catch (error) {
      if (/Failed to fetch|fetch failed/i.test(String(error?.message || error))) {
        throw new Error("Не удалось подключиться к Ollama. Проверьте, что Ollama запущена.");
      }
      throw error;
    }
  }

  function hasModel(models, wanted) {
    return models.some((name) => name === wanted || name.startsWith(`${wanted}:`));
  }

  async function resolveOllamaModel(quality) {
    const wanted = quality === "quality" ? QUALITY_OLLAMA_MODEL : FAST_OLLAMA_MODEL;
    const models = await listOllamaModels();
    if (hasModel(models, wanted)) return wanted;
    if (quality === "quality" && hasModel(models, FAST_OLLAMA_MODEL)) return FAST_OLLAMA_MODEL;
    throw new Error(`Модель ${wanted} не установлена. Выполните: ollama pull ${wanted}`);
  }

  async function warmModel(model) {
    try {
      const response = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: "", stream: false, keep_alive: KEEP_ALIVE })
      }, 30000);
      return response.ok;
    } catch {
      return false;
    }
  }

  function warmLocalModels() {
    warmModel(FAST_OLLAMA_MODEL).catch(() => {});
    // Quality model is warmed independently and never blocks an action.
    warmModel(QUALITY_OLLAMA_MODEL).catch(() => {});
  }

  async function testLocal() {
    const models = await listOllamaModels(true);
    const fast = hasModel(models, FAST_OLLAMA_MODEL);
    const quality = hasModel(models, QUALITY_OLLAMA_MODEL);
    if (!fast) throw new Error(`Не найдена ${FAST_OLLAMA_MODEL}. Выполните: ollama pull ${FAST_OLLAMA_MODEL}`);
    warmLocalModels();
    return { fastModel: FAST_OLLAMA_MODEL, qualityModel: quality ? QUALITY_OLLAMA_MODEL : FAST_OLLAMA_MODEL, qualityFallback: !quality };
  }

  function schemaForOllama(value) {
    if (Array.isArray(value)) return value.map(schemaForOllama);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = key === "type" && typeof item === "string" ? item.toLowerCase() : schemaForOllama(item);
    }
    return result;
  }

  async function ollamaChat({
    messages,
    system = "",
    user = "",
    schema,
    quality = "fast",
    temperature = 0,
    numPredict = 220
  }) {
    const model = await resolveOllamaModel(quality);

    // Все провайдеры используют единый интерфейс system + user.
    // Для обратной совместимости также принимаем готовый messages[].
    const normalizedMessages = Array.isArray(messages) && messages.length
      ? messages
      : [
          ...(String(system || "").trim()
            ? [{ role: "system", content: String(system) }]
            : []),
          ...(String(user || "").trim()
            ? [{ role: "user", content: String(user) }]
            : [])
        ];

    if (!normalizedMessages.length) {
      throw new Error("В запрос к Ollama не был передан текст.");
    }

    const response = await fetchWithTimeout(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: normalizedMessages,
        ...(schema ? { format: schemaForOllama(schema) } : {}),
        stream: false,
        think: false,
        keep_alive: KEEP_ALIVE,
        options: { temperature, num_predict: numPredict, num_ctx: 2048 }
      })
    }, OLLAMA_TIMEOUT);

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Ошибка Ollama (${response.status})`);
    }

    const answer =
      payload?.message?.content ??
      payload?.response ??
      "";

    const resultText = String(answer || "").trim();

    if (!resultText) {
      throw new Error("Ollama вернула пустой ответ.");
    }

    return { text: resultText, model, provider: "ollama" };
  }

  function geminiModelFor(s, quality) {
    const legacy = RETIRED_GEMINI.has(s.geminiModel) ? DEFAULT_GEMINI_MODEL : s.geminiModel;
    return (quality === "quality" ? s.geminiQualityModel : s.geminiFastModel) || legacy || DEFAULT_GEMINI_MODEL;
  }

  async function geminiChat({ system, user, schema, quality = "fast", temperature = 0.1 }) {
    const s = await settings();
    if (!s.geminiApiKey) throw new Error("Укажите Gemini API-ключ в настройках расширения.");
    const model = geminiModelFor(s, quality);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": s.geminiApiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature,
          ...(schema ? {
            responseMimeType: "application/json",
            responseSchema: schema
          } : {})
        }
      })
    }, 30000);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `Ошибка Gemini API (${response.status})`);
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { text, model, provider: "gemini" };
  }

  function normalizeOpenAiBase(url) {
    const value = String(url || "").trim().replace(/\/+$/, "");
    if (!value) throw new Error("Укажите адрес OpenAI-compatible API.");
    if (/\/chat\/completions$/i.test(value)) return value;
    return `${value}/chat/completions`;
  }

  async function openAiCompatibleChat({ system, user, quality = "fast", temperature = 0.1 }) {
    const s = await settings();
    const model = (quality === "quality" ? s.openaiQualityModel : s.openaiFastModel) || s.openaiFastModel || s.openaiQualityModel;
    if (!model) throw new Error("Укажите модель OpenAI-compatible API.");
    const endpoint = normalizeOpenAiBase(s.openaiBaseUrl);
    const headers = { "Content-Type": "application/json" };
    if (s.openaiApiKey) headers.Authorization = `Bearer ${s.openaiApiKey}`;
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature,
        stream: false
      })
    }, 30000);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `Ошибка API (${response.status})`);
    const text = payload?.choices?.[0]?.message?.content || "";
    return { text, model, provider: "openai-compatible" };
  }


  const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
  const DEFAULT_OPENAI_FAST_MODEL = "gpt-5.6-luna";
  const DEFAULT_OPENAI_QUALITY_MODEL = "gpt-5.6-terra";

  function jsonSchemaForOpenAi(value) {
    if (Array.isArray(value)) return value.map(jsonSchemaForOpenAi);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] =
        key === "type" && typeof item === "string"
          ? item.toLowerCase()
          : jsonSchemaForOpenAi(item);
    }
    return result;
  }

  async function officialOpenAiChat({
    system,
    user,
    schema,
    quality = "fast",
    temperature = 0.1
  }) {
    const s = await settings();
    if (!s.officialOpenaiApiKey) {
      throw new Error("Укажите OpenAI API-ключ в настройках расширения.");
    }

    const model =
      (quality === "quality"
        ? s.officialOpenaiQualityModel
        : s.officialOpenaiFastModel) ||
      (quality === "quality"
        ? DEFAULT_OPENAI_QUALITY_MODEL
        : DEFAULT_OPENAI_FAST_MODEL);

    const body = {
      model,
      messages: [
        ...(String(system || "").trim()
          ? [{ role: "system", content: String(system) }]
          : []),
        { role: "user", content: String(user || "") }
      ],
      stream: false
    };

    // Некоторые reasoning-модели могут не принимать temperature.
    if (!/^gpt-5/i.test(model)) {
      body.temperature = temperature;
    }

    if (schema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "textmate_response",
          strict: true,
          schema: jsonSchemaForOpenAi(schema)
        }
      };
    }

    const response = await fetchWithTimeout(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${s.officialOpenaiApiKey}`
      },
      body: JSON.stringify(body)
    }, 45000);

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const code = payload?.error?.code || "";
      const message = payload?.error?.message || `Ошибка OpenAI API (${response.status})`;

      if (/unsupported_country_region|country|region/i.test(`${code} ${message}`)) {
        throw new Error(
          "OpenAI отклонил запрос из-за региональных ограничений API. Используйте TextMate Global или другой доступный провайдер."
        );
      }

      throw new Error(message);
    }

    const text =
      payload?.choices?.[0]?.message?.content ??
      payload?.output_text ??
      "";

    if (!String(text || "").trim()) {
      throw new Error("OpenAI вернул пустой ответ.");
    }

    return {
      text: String(text).trim(),
      model: payload?.model || model,
      provider: "openai"
    };
  }

  async function ensureTextMateClientId(current) {
    if (current) return current;

    const id =
      globalThis.crypto?.randomUUID?.() ||
      `tm-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

    await chrome.storage.local.set({ textmateClientId: id });
    return id;
  }

  function normalizeTextMateCloudUrl(url) {
    const value = String(url || "").trim().replace(/\/+$/, "");
    if (!value) {
      throw new Error(
        "TextMate Global ещё не настроен владельцем расширения. Укажите адрес Cloudflare Worker в расширенных настройках."
      );
    }
    return /\/v1\/text$/i.test(value) ? value : `${value}/v1/text`;
  }

  async function textMateGlobalChat({
    system,
    user,
    schema,
    quality = "fast",
    temperature = 0.1
  }) {
    const s = await settings();
    const endpoint = normalizeTextMateCloudUrl(s.textmateCloudUrl);
    const clientId = await ensureTextMateClientId(s.textmateClientId);

    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TextMate-Client-Id": clientId,
        "X-TextMate-Version": "0.9.0"
      },
      body: JSON.stringify({
        system: String(system || ""),
        user: String(user || ""),
        quality,
        temperature,
        schema: schema || null
      })
    }, 45000);

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Достигнут лимит TextMate Global. Попробуйте немного позже.");
      }
      throw new Error(payload?.error || `Ошибка TextMate Global (${response.status})`);
    }

    const text = String(payload?.text || "").trim();
    if (!text) throw new Error("TextMate Global вернул пустой ответ.");

    return {
      text,
      model: payload?.model || "Workers AI",
      provider: "textmate-global"
    };
  }

  async function chat(request) {
    const s = await settings();
    if (s.runMode === "local") return ollamaChat(request);

    if (s.cloudProvider === "textmate") {
      return textMateGlobalChat(request);
    }

    if (s.cloudProvider === "openai-official") {
      return officialOpenAiChat(request);
    }

    // "openai" оставляем как legacy-значение v0.8.x.
    if (s.cloudProvider === "openai-compatible" || s.cloudProvider === "openai") {
      return openAiCompatibleChat(request);
    }

    return geminiChat(request);
  }

  async function testCloud() {
    const s = await settings();

    if (s.cloudProvider === "textmate") {
      const result = await textMateGlobalChat({
        system: "Верни только слово OK.",
        user: "Проверка соединения TextMate Global.",
        quality: "fast",
        temperature: 0
      });
      return { provider: "TextMate Global", model: result.model };
    }

    if (s.cloudProvider === "openai-official") {
      const result = await officialOpenAiChat({
        system: "Верни только слово OK.",
        user: "Проверка соединения OpenAI API.",
        quality: "fast",
        temperature: 0
      });
      return { provider: "OpenAI", model: result.model };
    }

    if (s.cloudProvider === "openai-compatible" || s.cloudProvider === "openai") {
      const result = await openAiCompatibleChat({
        system: "Ответь строго словом OK.",
        user: "Проверка соединения",
        quality: "fast",
        temperature: 0
      });
      return { provider: "OpenAI-compatible", model: result.model };
    }

    const result = await geminiChat({
      system: "Ответь JSON объектом с полем status.",
      user: "Верни status=OK",
      schema: { type: "OBJECT", properties: { status: { type: "STRING" } }, required: ["status"] },
      quality: "fast",
      temperature: 0
    });
    return { provider: "Gemini", model: result.model };
  }

  globalThis.AITextProviders = Object.freeze({
    FAST_OLLAMA_MODEL,
    QUALITY_OLLAMA_MODEL,
    settings,
    chat,
    testLocal,
    testCloud,
    warmLocalModels
  });
})();

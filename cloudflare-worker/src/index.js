const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS, GET",
  "access-control-allow-headers": "Content-Type, X-TextMate-Client-Id, X-TextMate-Version"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

function cleanClientId(value) {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9._:-]{8,160}$/.test(id) ? id : "";
}

function normalizeModelOutput(result) {
  if (typeof result === "string") return result.trim();
  if (!result || typeof result !== "object") return "";

  const candidates = [
    result.response,
    result.text,
    result.output_text,
    result.result?.response,
    result.result?.text
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  if (Array.isArray(result.choices)) {
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content.trim();
  }

  return "";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "TextMate Global",
        version: "0.9.0"
      });
    }

    if (request.method !== "POST" || url.pathname !== "/v1/text") {
      return json({ error: "Not found" }, 404);
    }

    const clientId = cleanClientId(request.headers.get("x-textmate-client-id"));
    if (!clientId) {
      return json({ error: "Missing or invalid TextMate client id." }, 400);
    }

    // Rate limit привязан к установке расширения. Это защита от обычного
    // злоупотребления, а не биллинговая/антифрод-система.
    const rate = await env.TEXTMATE_RATE_LIMITER.limit({ key: clientId });
    if (!rate.success) {
      return json({ error: "Too many requests. Try again later." }, 429);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 64000) {
      return json({ error: "Request is too large." }, 413);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }

    const system = String(body?.system || "");
    const user = String(body?.user || "");
    const quality = body?.quality === "quality" ? "quality" : "fast";
    const maxChars = Math.max(1000, Number(env.MAX_USER_CHARS || 16000));

    if (!user.trim()) {
      return json({ error: "Text is empty." }, 400);
    }

    if (user.length > maxChars || system.length > 12000) {
      return json({ error: `Text is too long. Maximum ${maxChars} characters.` }, 413);
    }

    const model =
      quality === "quality"
        ? (env.QUALITY_MODEL || "@cf/google/gemma-4-26b-a4b-it")
        : (env.FAST_MODEL || "@cf/zai-org/glm-4.7-flash");

    // В Worker нет console.log с текстом пользователя.
    // Cloudflare всё равно технически обрабатывает запрос как инфраструктурный провайдер.
    let result;
    try {
      result = await env.AI.run(model, {
        messages: [
          ...(system.trim() ? [{ role: "system", content: system }] : []),
          { role: "user", content: user }
        ],
        temperature: Number.isFinite(Number(body?.temperature))
          ? Math.max(0, Math.min(1, Number(body.temperature)))
          : 0.1
      });
    } catch (error) {
      return json({
        error: "AI provider error.",
        details: error instanceof Error ? error.message : String(error)
      }, 502);
    }

    const text = normalizeModelOutput(result);
    if (!text) {
      return json({ error: "AI model returned an empty response." }, 502);
    }

    return json({
      text,
      model,
      provider: "cloudflare-workers-ai"
    });
  }
};

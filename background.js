if (typeof importScripts === "function" && !globalThis.AITextProviders) {
  importScripts(
    "compat.js",
    "background/logger.js",
    "background/cache.js",
    "background/rules.js",
    "background/providers.js",
    "background/actions.js",
    "background/context-menu.js"
  );
}

const REQUEST_TIMEOUT_MS = 35000;

function readableError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/API key not valid/i.test(message)) return "Неверный API-ключ.";
  if (/quota|resource has been exhausted|429/i.test(message)) return "Закончился доступный лимит API. Попробуйте позже.";
  if (/failed to fetch|fetch failed/i.test(message)) return "Не удалось связаться с выбранным AI-провайдером.";
  return message;
}

function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Ответ модели занял слишком много времени. Попробуйте ещё раз или выделите меньше текста.")), ms))
  ]);
}

async function warmLocalOnlyWhenNeeded() {
  const { runMode } = await chrome.storage.local.get(["runMode"]);
  if ((runMode || "local") === "local") {
    AITextProviders.warmLocalModels();
  }
}

async function correctByCurrentMode(text) {
  const { runMode } = await chrome.storage.local.get(["runMode"]);
  if (runMode === "rules") return TextMateRules.correct(text);
  return AITextActions.correct(text);
}

async function ensureAiActionAllowed() {
  const { runMode } = await chrome.storage.local.get(["runMode"]);
  if (runMode === "rules") {
    throw new Error("В режиме «Без AI» доступно только редактирование русского текста.");
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const old = await chrome.storage.local.get(["runMode", "aiProvider", "geminiApiKey"]);
  if (!old.runMode) {
    await chrome.storage.local.set({ runMode: old.aiProvider === "gemini" || old.geminiApiKey ? "cloud" : "local" });
  }
  await AITextContextMenu.create();
  warmLocalOnlyWhenNeeded();
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(() => {
  AITextContextMenu.create();
  warmLocalOnlyWhenNeeded();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.runMode) return;
  AITextContextMenu.create();
  if (changes.runMode.newValue === "local") AITextProviders.warmLocalModels();
});

AITextContextMenu.install();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  let task = null;
  if (message?.type === "TEST_LOCAL") task = AITextProviders.testLocal();
  if (message?.type === "TEST_CLOUD") task = AITextProviders.testCloud();
  if (message?.type === "TEST_OLLAMA") task = AITextProviders.testLocal(); // compatibility
  if (message?.type === "CLEAR_CACHE") task = AITextCache.clear().then(() => ({ cleared: true }));
  if (message?.type === "CORRECT_TEXT") task = correctByCurrentMode(message.text);
  if (message?.type === "TRANSLATE_TEXT") {
    task = ensureAiActionAllowed().then(() => AITextActions.translate(message.text));
  }
  if (message?.type === "TRANSFORM_TEXT") {
    task = ensureAiActionAllowed().then(() => AITextActions.transform(message.text, message.action));
  }

  if (!task) return false;
  withTimeout(task)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      AITextLogger.warn(message?.type, error);
      sendResponse({ ok: false, error: readableError(error) });
    });
  return true;
});

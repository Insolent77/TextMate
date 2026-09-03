importScripts(
  "background/logger.js",
  "background/cache.js",
  "background/providers.js",
  "background/actions.js",
  "background/context-menu.js"
);

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

chrome.runtime.onInstalled.addListener(async (details) => {
  const old = await chrome.storage.local.get(["runMode", "aiProvider", "geminiApiKey"]);
  if (!old.runMode) {
    await chrome.storage.local.set({ runMode: old.aiProvider === "gemini" || old.geminiApiKey ? "cloud" : "local" });
  }
  AITextContextMenu.create();
  AITextProviders.warmLocalModels();
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(() => {
  AITextContextMenu.create();
  AITextProviders.warmLocalModels();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
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
  if (message?.type === "CORRECT_TEXT") task = AITextActions.correct(message.text);
  if (message?.type === "TRANSLATE_TEXT") task = AITextActions.translate(message.text);
  if (message?.type === "TRANSFORM_TEXT") task = AITextActions.transform(message.text, message.action);

  if (!task) return false;
  withTimeout(task)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      AITextLogger.warn(message?.type, error);
      sendResponse({ ok: false, error: readableError(error) });
    });
  return true;
});

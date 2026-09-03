const $ = (selector) => document.querySelector(selector);

const ACTIONS = ["edit", "translate", "simplify", "shorten", "polite", "formal", "rephrase"];
const DEFAULT_QUICK_ACTIONS = ["edit", "translate"];

const runMode = $("#runMode");
const cloudProvider = $("#cloudProvider");
const localSummary = $("#localSummary");
const cloudSummary = $("#cloudSummary");
const rulesSummary = $("#rulesSummary");
const cloudModels = $("#cloudModels");
const rulesActionsNote = $("#rulesActionsNote");
const autoCopyResult = $("#autoCopyResult");
const connectionStatus = $("#connectionStatus");
const testConnection = $("#testConnection");

let settings = {};

restore();

async function restore() {
  settings = await chrome.storage.local.get([
    "runMode",
    "aiProvider",
    "cloudProvider",
    "geminiApiKey",
    "textmateCloudUrl",
    "officialOpenaiApiKey",
    "officialOpenaiFastModel",
    "officialOpenaiQualityModel",
    "geminiModel",
    "geminiFastModel",
    "geminiQualityModel",
    "openaiBaseUrl",
    "openaiApiKey",
    "openaiFastModel",
    "openaiQualityModel",
    "quickTextActions",
    "autoCopyResult"
  ]);

  runMode.value =
    settings.runMode ||
    (settings.aiProvider === "gemini" || settings.aiProvider === "openai" || settings.geminiApiKey
      ? "cloud"
      : "local");

  const restoredProvider =
    settings.cloudProvider === "openai"
      ? "openai-compatible"
      : settings.cloudProvider || (
          settings.aiProvider === "openai" ? "openai-compatible" : "textmate"
        );
  cloudProvider.value = restoredProvider;

  const quick = Array.isArray(settings.quickTextActions)
    ? settings.quickTextActions
    : DEFAULT_QUICK_ACTIONS;

  document.querySelectorAll("[data-action]").forEach((input) => {
    input.checked = quick.includes(input.dataset.action);
  });

  autoCopyResult.checked = Boolean(settings.autoCopyResult);
  updateModeUi();
}

function updateModeUi() {
  const local = runMode.value === "local";
  const cloud = runMode.value === "cloud";
  const rules = runMode.value === "rules";

  localSummary.classList.toggle("hidden", !local);
  cloudSummary.classList.toggle("hidden", !cloud);
  rulesSummary.classList.toggle("hidden", !rules);
  testConnection.classList.toggle("hidden", rules);
  rulesActionsNote.classList.toggle("hidden", !rules);

  document.querySelectorAll("[data-action]").forEach((input) => {
    const isEdit = input.dataset.action === "edit";
    input.disabled = rules;
    if (rules) input.checked = isEdit;
  });

  if (cloud) renderCloudModels();

  connectionStatus.textContent = rules
    ? "Никаких подключений не требуется."
    : "";
  connectionStatus.className = rules ? "status success" : "status";
}

function renderCloudModels() {
  const provider = cloudProvider.value;
  let fast = "";
  let quality = "";
  let configured = false;

  if (provider === "textmate") {
    fast = "Workers AI";
    quality = "Workers AI";
    configured = Boolean(settings.textmateCloudUrl);
  } else if (provider === "openai-official") {
    fast = settings.officialOpenaiFastModel || "gpt-5.6-luna";
    quality = settings.officialOpenaiQualityModel || "gpt-5.6-terra";
    configured = Boolean(settings.officialOpenaiApiKey);
  } else if (provider === "gemini") {
    fast = settings.geminiFastModel || settings.geminiModel || "gemini-3.6-flash";
    quality = settings.geminiQualityModel || settings.geminiModel || "gemini-3.6-flash";
    configured = Boolean(settings.geminiApiKey);
  } else {
    fast = settings.openaiFastModel || "Не настроена";
    quality = settings.openaiQualityModel || "Не настроена";
    configured = Boolean(settings.openaiBaseUrl && settings.openaiFastModel && settings.openaiQualityModel);
  }

  cloudModels.innerHTML = `
    <div><span>Быстрая</span><strong>${escapeHtml(fast)}</strong></div>
    <div><span>Качественная</span><strong>${escapeHtml(quality)}</strong></div>
    <div><span>Статус</span><strong>${configured ? "Настроен" : "Нужна настройка"}</strong></div>
  `;
}

runMode.addEventListener("change", async () => {
  await chrome.storage.local.set({
    runMode: runMode.value,
    aiProvider:
      runMode.value === "local" ? "ollama" :
      runMode.value === "cloud" ? cloudProvider.value :
      "rules"
  });
  updateModeUi();
});

cloudProvider.addEventListener("change", async () => {
  settings.cloudProvider = cloudProvider.value;
  await chrome.storage.local.set({
    cloudProvider: cloudProvider.value,
    aiProvider:
      runMode.value === "local" ? "ollama" :
      runMode.value === "cloud" ? cloudProvider.value :
      "rules"
  });
  renderCloudModels();
});

document.querySelectorAll("[data-action]").forEach((input) => {
  input.addEventListener("change", saveQuickSettings);
});

autoCopyResult.addEventListener("change", saveQuickSettings);

async function saveQuickSettings() {
  if (runMode.value === "rules") return;

  const quickTextActions = Array.from(document.querySelectorAll("[data-action]:checked"))
    .map((input) => input.dataset.action)
    .filter((action) => ACTIONS.includes(action));

  await chrome.storage.local.set({
    quickTextActions,
    autoCopyResult: autoCopyResult.checked
  });
}

testConnection.addEventListener("click", async () => {
  testConnection.disabled = true;
  showConnection("Проверяю подключение…");

  try {
    const type = runMode.value === "local" ? "TEST_LOCAL" : "TEST_CLOUD";
    const response = await chrome.runtime.sendMessage({ type });

    if (!response?.ok) {
      throw new Error(response?.error || "Проверка не удалась.");
    }

    if (runMode.value === "local") {
      const r = response.result;
      showConnection(
        `✓ Ollama работает. ${r.fastModel} / ${r.qualityModel}${r.qualityFallback ? " (резерв)" : ""}`,
        "success"
      );
    } else {
      showConnection(
        `✓ ${response.result.provider}: ${response.result.model}`,
        "success"
      );
    }
  } catch (error) {
    showConnection(error instanceof Error ? error.message : String(error), "error");
  } finally {
    testConnection.disabled = false;
  }
});

$("#advancedSettings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

function showConnection(message, kind = "") {
  connectionStatus.textContent = message;
  connectionStatus.className = `status ${kind}`.trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const $ = (selector) => document.querySelector(selector);
const runMode = $("#runMode");
const cloudProvider = $("#cloudProvider");
const status = $("#status");

restore();

async function restore() {
  const s = await chrome.storage.local.get([
    "runMode", "aiProvider", "geminiApiKey", "geminiModel", "geminiFastModel", "geminiQualityModel",
    "cloudProvider",
    "officialOpenaiApiKey", "officialOpenaiFastModel", "officialOpenaiQualityModel",
    "openaiBaseUrl", "openaiApiKey", "openaiFastModel", "openaiQualityModel",
    "textmateCloudUrl"
  ]);
  runMode.value = s.runMode || (s.aiProvider === "gemini" || s.geminiApiKey ? "cloud" : "local");
  const restoredProvider = s.cloudProvider === "openai" ? "openai-compatible" : (s.cloudProvider || "textmate");
  cloudProvider.value = restoredProvider;
  $("#textmateCloudUrl").value = s.textmateCloudUrl || "";
  $("#officialOpenaiApiKey").value = s.officialOpenaiApiKey || "";
  $("#officialOpenaiFastModel").value = s.officialOpenaiFastModel || "gpt-5.6-luna";
  $("#officialOpenaiQualityModel").value = s.officialOpenaiQualityModel || "gpt-5.6-terra";
  $("#geminiApiKey").value = s.geminiApiKey || "";
  $("#geminiFastModel").value = s.geminiFastModel || s.geminiModel || "gemini-3.6-flash";
  $("#geminiQualityModel").value = s.geminiQualityModel || s.geminiModel || "gemini-3.6-flash";
  $("#openaiBaseUrl").value = s.openaiBaseUrl || "";
  $("#openaiApiKey").value = s.openaiApiKey || "";
  $("#openaiFastModel").value = s.openaiFastModel || "";
  $("#openaiQualityModel").value = s.openaiQualityModel || "";
  updateVisibility();
}

runMode.addEventListener("change", updateVisibility);
cloudProvider.addEventListener("change", updateVisibility);

function updateVisibility() {
  const local = runMode.value === "local";
  const cloud = runMode.value === "cloud";
  const rules = runMode.value === "rules";

  $("#localSettings").classList.toggle("hidden", !local);
  $("#cloudSettings").classList.toggle("hidden", !cloud);
  $("#rulesSettings").classList.toggle("hidden", !rules);
  $("#test").classList.toggle("hidden", rules);
  $("#clearCache").classList.toggle("hidden", rules);

  const provider = cloudProvider.value;
  $("#textmateSettings").classList.toggle("hidden", provider !== "textmate");
  $("#officialOpenaiSettings").classList.toggle("hidden", provider !== "openai-official");
  $("#geminiSettings").classList.toggle("hidden", provider !== "gemini");
  $("#openaiCompatibleSettings").classList.toggle("hidden", provider !== "openai-compatible");

  if (rules) showStatus("Режим без AI работает локально после загрузки словаря.");
}

function togglePassword(inputSelector, button) {
  const input = $(inputSelector);
  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  button.textContent = visible ? "Показать" : "Скрыть";
}
$("#toggleGemini").addEventListener("click", (e) => togglePassword("#geminiApiKey", e.currentTarget));
$("#toggleOfficialOpenai").addEventListener("click", (e) => togglePassword("#officialOpenaiApiKey", e.currentTarget));
$("#toggleOpenai").addEventListener("click", (e) => togglePassword("#openaiApiKey", e.currentTarget));

$("#settings").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { await save(); showStatus("Настройки сохранены."); }
  catch (error) { showStatus(error instanceof Error ? error.message : String(error), true); }
});

$("#test").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  showStatus("Проверяю подключение…");
  try {
    await save();
    if (runMode.value === "rules") {
      showStatus("✓ Режим без AI готов. Подключение не требуется.");
      return;
    }
    const type = runMode.value === "local" ? "TEST_LOCAL" : "TEST_CLOUD";
    const response = await chrome.runtime.sendMessage({ type });
    if (!response?.ok) throw new Error(response?.error || "Проверка не удалась.");
    if (runMode.value === "local") {
      const r = response.result;
      showStatus(`✓ Ollama подключена. Быстрая: ${r.fastModel}. Редактирование/перевод: ${r.qualityModel}${r.qualityFallback ? " (резервная)" : ""}.`);
    } else {
      showStatus(`✓ Облако подключено: ${response.result.provider}, модель ${response.result.model}.`);
    }
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), true);
  } finally { button.disabled = false; }
});

$("#clearCache").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "CLEAR_CACHE" });
  showStatus(response?.ok ? "Кэш очищен." : "Не удалось очистить кэш.", !response?.ok);
});

async function save() {
  const data = {
    runMode: runMode.value,
    cloudProvider: cloudProvider.value,
    aiProvider:
      runMode.value === "local" ? "ollama" :
      runMode.value === "cloud" ? cloudProvider.value :
      "rules",
    ollamaModel: "qwen3:0.6b",
    textmateCloudUrl: $("#textmateCloudUrl").value.trim(),
    officialOpenaiApiKey: $("#officialOpenaiApiKey").value.trim(),
    officialOpenaiFastModel: $("#officialOpenaiFastModel").value.trim() || "gpt-5.6-luna",
    officialOpenaiQualityModel: $("#officialOpenaiQualityModel").value.trim() || "gpt-5.6-terra",
    geminiApiKey: $("#geminiApiKey").value.trim(),
    geminiFastModel: $("#geminiFastModel").value.trim() || "gemini-3.6-flash",
    geminiQualityModel: $("#geminiQualityModel").value.trim() || "gemini-3.6-flash",
    openaiBaseUrl: $("#openaiBaseUrl").value.trim(),
    openaiApiKey: $("#openaiApiKey").value.trim(),
    openaiFastModel: $("#openaiFastModel").value.trim(),
    openaiQualityModel: $("#openaiQualityModel").value.trim()
  };
  if (data.runMode === "cloud" && data.cloudProvider === "textmate") {
    if (!data.textmateCloudUrl) throw new Error("Укажите адрес TextMate Cloudflare Worker.");
    const origin = new URL(data.textmateCloudUrl).origin + "/*";
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) throw new Error("Разрешите расширению доступ к TextMate Global.");
  }

  if (data.runMode === "cloud" && data.cloudProvider === "openai-official") {
    if (!data.officialOpenaiApiKey) throw new Error("Введите OpenAI API-ключ.");
    if (!data.officialOpenaiFastModel || !data.officialOpenaiQualityModel) {
      throw new Error("Укажите быструю и качественную OpenAI-модели.");
    }
  }

  if (data.runMode === "cloud" && data.cloudProvider === "gemini" && !data.geminiApiKey) {
    throw new Error("Введите Gemini API-ключ.");
  }

  if (data.runMode === "cloud" && data.cloudProvider === "openai-compatible") {
    if (!data.openaiBaseUrl) throw new Error("Введите адрес OpenAI-compatible API.");
    if (!data.openaiFastModel || !data.openaiQualityModel) throw new Error("Укажите быструю и качественную модели.");
    const origin = new URL(data.openaiBaseUrl).origin + "/*";
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) throw new Error("Разрешите расширению доступ к указанному API-серверу.");
  }
  await chrome.storage.local.set(data);
  await chrome.runtime.sendMessage({ type: "CLEAR_CACHE" }).catch(() => {});
}

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}

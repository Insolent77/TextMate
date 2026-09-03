const $ = (selector) => document.querySelector(selector);
const runMode = $("#runMode");
const cloudProvider = $("#cloudProvider");
const status = $("#status");

restore();

async function restore() {
  const s = await chrome.storage.local.get([
    "runMode", "aiProvider", "geminiApiKey", "geminiModel", "geminiFastModel", "geminiQualityModel",
    "cloudProvider", "openaiBaseUrl", "openaiApiKey", "openaiFastModel", "openaiQualityModel"
  ]);
  runMode.value = s.runMode || (s.aiProvider === "gemini" || s.geminiApiKey ? "cloud" : "local");
  cloudProvider.value = s.cloudProvider || "gemini";
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
  $("#localSettings").classList.toggle("hidden", !local);
  $("#cloudSettings").classList.toggle("hidden", local);
  const gemini = cloudProvider.value === "gemini";
  $("#geminiSettings").classList.toggle("hidden", !gemini);
  $("#openaiSettings").classList.toggle("hidden", gemini);
}

function togglePassword(inputSelector, button) {
  const input = $(inputSelector);
  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  button.textContent = visible ? "Показать" : "Скрыть";
}
$("#toggleGemini").addEventListener("click", (e) => togglePassword("#geminiApiKey", e.currentTarget));
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
    aiProvider: runMode.value === "local" ? "ollama" : cloudProvider.value,
    ollamaModel: "qwen3:0.6b",
    geminiApiKey: $("#geminiApiKey").value.trim(),
    geminiFastModel: $("#geminiFastModel").value.trim() || "gemini-3.6-flash",
    geminiQualityModel: $("#geminiQualityModel").value.trim() || "gemini-3.6-flash",
    openaiBaseUrl: $("#openaiBaseUrl").value.trim(),
    openaiApiKey: $("#openaiApiKey").value.trim(),
    openaiFastModel: $("#openaiFastModel").value.trim(),
    openaiQualityModel: $("#openaiQualityModel").value.trim()
  };
  if (data.runMode === "cloud" && data.cloudProvider === "gemini" && !data.geminiApiKey) throw new Error("Введите Gemini API-ключ.");
  if (data.runMode === "cloud" && data.cloudProvider === "openai") {
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

(() => {
  function available() {
    try {
      return Boolean(
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        typeof chrome.runtime.sendMessage === "function" &&
        chrome.runtime.id
      );
    } catch {
      return false;
    }
  }

  async function safeSendMessage(message) {
    if (!available()) {
      throw new Error("Расширение было обновлено. Обновите эту страницу (F5) и попробуйте ещё раз.");
    }

    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (
        /Extension context invalidated/i.test(text) ||
        /Receiving end does not exist/i.test(text) ||
        /Could not establish connection/i.test(text)
      ) {
        throw new Error("Расширение было обновлено. Обновите эту страницу (F5) и попробуйте ещё раз.");
      }
      throw error;
    }
  }

  globalThis.AITextRuntime = Object.freeze({ available, safeSendMessage });
})();

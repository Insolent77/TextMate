(() => {
  if (typeof globalThis.browser !== "undefined") {
    try {
      globalThis.chrome = globalThis.browser;
    } catch {
      Object.defineProperty(globalThis, "chrome", {
        configurable: true,
        value: globalThis.browser
      });
    }
  }

  const api = globalThis.chrome;
  if (!api) throw new Error("TextMate: WebExtension API is unavailable.");

  async function removeAllContextMenus() {
    if (!api.contextMenus?.removeAll) return;

    if (typeof globalThis.browser !== "undefined") {
      await api.contextMenus.removeAll();
      return;
    }

    await new Promise((resolve, reject) => {
      api.contextMenus.removeAll(() => {
        const error = api.runtime?.lastError;
        if (error) reject(new Error(error.message));
        else resolve();
      });
    });
  }

  globalThis.TextMateCompat = Object.freeze({
    api,
    isFirefox: typeof globalThis.browser !== "undefined",
    removeAllContextMenus
  });
})();

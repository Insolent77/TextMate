(() => {
  const ACTIONS = [
    ["edit", "Редактировать"],
    ["translate", "Перевести на русский"],
    ["simplify", "Упростить"],
    ["shorten", "Сделать короче"],
    ["polite", "Сделать вежливее"],
    ["formal", "Сделать официальнее"],
    ["rephrase", "Переформулировать"]
  ];

  function available() {
    return Boolean(chrome.contextMenus?.create && chrome.contextMenus?.onClicked);
  }

  async function create() {
    if (!available()) return;

    try {
      await globalThis.TextMateCompat.removeAllContextMenus();
    } catch (error) {
      console.warn("TextMate: не удалось очистить контекстное меню", error);
    }

    chrome.contextMenus.create({
      id: "ai-text-tools",
      title: "TextMate: работа с текстом",
      contexts: ["selection"]
    });

    for (const [id, title] of ACTIONS) {
      chrome.contextMenus.create({
        id: `ai-${id}`,
        parentId: "ai-text-tools",
        title,
        contexts: ["selection"]
      });
    }
  }

  function install() {
    if (!available()) return;
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (!info.menuItemId?.startsWith?.("ai-") || info.menuItemId === "ai-text-tools") return;
      const action = String(info.menuItemId).replace(/^ai-/, "");
      const text = String(info.selectionText || "").trim();
      if (!text || !tab?.id) return;
      try {
        let result;
        if (action === "edit") result = await AITextActions.correct(text);
        else if (action === "translate") result = await AITextActions.translate(text);
        else result = await AITextActions.transform(text, action);
        await chrome.tabs.sendMessage(tab.id, { type: "SHOW_CONTEXT_RESULT", action, originalText: text, result });
      } catch (error) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "SHOW_CONTEXT_RESULT", action, originalText: text,
          result: { output: `Ошибка: ${error instanceof Error ? error.message : String(error)}`, alternatives: [] }
        }).catch(() => {});
      }
    });
  }

  globalThis.AITextContextMenu = Object.freeze({ create, install });
})();

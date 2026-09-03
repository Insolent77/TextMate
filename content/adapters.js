(() => {
  const host = location.hostname.toLowerCase();

  function isTextControl(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return false;
    if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
    return ["text", "search", "email", "url", "tel"].includes(element.type) &&
      !element.disabled && !element.readOnly;
  }

  const ADAPTERS = [
    {
      id: "google-docs",
      matches: () => host === "docs.google.com" && location.pathname.includes("/document/"),
      selectors: [
        "[contenteditable='true']",
        "[role='textbox']:not([aria-readonly='true'])",
        ".kix-appview-editor"
      ],
      allowReadonlyEdit: true,
      replaceMode: "command-only"
    },
    {
      id: "google-sheets",
      matches: () => host === "docs.google.com" && location.pathname.includes("/spreadsheets/"),
      selectors: [
        "[contenteditable='true']",
        "[role='textbox']:not([aria-readonly='true'])",
        "textarea"
      ],
      allowReadonlyEdit: false,
      replaceMode: "command-first"
    },
    {
      id: "word-online",
      matches: () => /(^|\.)office\.com$|(^|\.)officeapps\.live\.com$|(^|\.)microsoft365\.com$/.test(host),
      selectors: [
        "[contenteditable='true']",
        "[role='textbox']:not([aria-readonly='true'])",
        "[aria-multiline='true']:not([aria-readonly='true'])"
      ],
      allowReadonlyEdit: true,
      replaceMode: "command-first"
    },
    {
      id: "notion",
      matches: () => /(^|\.)notion\.so$|(^|\.)notion\.site$/.test(host),
      selectors: [
        "[contenteditable='true'][data-content-editable-leaf]",
        "[contenteditable='true']",
        "[role='textbox']:not([aria-readonly='true'])"
      ],
      allowReadonlyEdit: false,
      replaceMode: "command-first"
    },
    {
      id: "gmail",
      matches: () => host === "mail.google.com",
      selectors: [
        "div[role='textbox'][contenteditable='true']",
        "[contenteditable='true']"
      ],
      allowReadonlyEdit: false,
      replaceMode: "command-first"
    },
    {
      id: "telegram-web",
      matches: () => host === "web.telegram.org",
      selectors: [
        "[contenteditable='true'][role='textbox']",
        ".input-message-input[contenteditable='true']",
        "[contenteditable='true']"
      ],
      allowReadonlyEdit: false,
      replaceMode: "command-first"
    },
    {
      id: "generic",
      matches: () => true,
      selectors: [
        "[contenteditable]:not([contenteditable='false'])",
        "[role='textbox']:not([aria-readonly='true'])",
        "[aria-multiline='true']:not([aria-readonly='true'])"
      ],
      allowReadonlyEdit: false,
      replaceMode: "command-first"
    }
  ];

  function current() {
    return ADAPTERS.find((adapter) => adapter.matches()) || ADAPTERS[ADAPTERS.length - 1];
  }

  function findEditable(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!element?.closest) return null;
    const adapter = current();
    for (const selector of adapter.selectors) {
      try {
        const found = element.closest(selector);
        if (found && !(found instanceof HTMLInputElement && (found.disabled || found.readOnly))) return found;
      } catch {}
    }
    return null;
  }

  function canProcessReadonlySelection() {
    return Boolean(current().allowReadonlyEdit);
  }

  function dispatchInput(element, replacement) {
    try {
      element.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertReplacementText",
        data: replacement
      }));
    } catch {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function replaceControl(selection, replacement) {
    if (!selection.element?.isConnected) return false;
    const currentText = selection.element.value.slice(selection.start, selection.end);
    if (currentText !== selection.text) return false;
    selection.element.focus();
    selection.element.setRangeText(replacement, selection.start, selection.end, "end");
    dispatchInput(selection.element, replacement);
    selection.element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function restoreRange(selection) {
    if (!selection.range) return false;
    const pageSelection = window.getSelection();
    if (!pageSelection) return false;
    pageSelection.removeAllRanges();
    pageSelection.addRange(selection.range);
    return true;
  }

  function replaceEditable(selection, replacement) {
    if (!selection.element?.isConnected || !selection.range) return false;
    const adapter = current();
    selection.element.focus();
    restoreRange(selection);

    // Framework editors (Gmail, Notion, Telegram, Word) generally react better
    // to the browser editing command than to direct DOM mutation.
    try {
      if (document.queryCommandSupported?.("insertText")) {
        const ok = document.execCommand("insertText", false, replacement);
        if (ok) {
          dispatchInput(selection.element, replacement);
          return true;
        }
      }
    } catch {}

    // Google Docs can keep an internal document model that direct DOM edits corrupt.
    // If the editor did not accept insertText, leave the document untouched.
    if (adapter.replaceMode === "command-only") return false;

    try {
      if (selection.range.toString() !== selection.text) return false;
      selection.range.deleteContents();
      const node = document.createTextNode(replacement);
      selection.range.insertNode(node);
      selection.range.setStartAfter(node);
      selection.range.collapse(true);
      restoreRange(selection);
      dispatchInput(selection.element, replacement);
      return true;
    } catch {
      return false;
    }
  }

  function replaceCapturedText(selection, replacement) {
    if (!selection || selection.kind === "readonly") return false;
    if (selection.kind === "control") return replaceControl(selection, replacement);
    if (selection.kind === "editable") return replaceEditable(selection, replacement);
    return false;
  }

  globalThis.AITextAdapters = Object.freeze({
    current,
    isTextControl,
    findEditable,
    canProcessReadonlySelection,
    replaceCapturedText
  });
})();

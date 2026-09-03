(() => {
  if (window.__aiCorrectorLoaded) return;
  window.__aiCorrectorLoaded = true;

  const host = document.createElement("div");
  host.id = "ai-corrector-root";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      :host { all: initial; }
      .hidden { display: none !important; }
      button { font: 500 14px/1.2 Arial, sans-serif; }

      #actions {
        position: fixed;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 7px;
        width: max-content;
        max-width: calc(100vw - 16px);
      }

      .actionButton {
        border: 1px solid rgba(255,255,255,.09);
        border-radius: 9px;
        padding: 9px 13px;
        color: #fff;
        background: #292a2d;
        box-shadow: 0 5px 18px rgba(0,0,0,.25);
        cursor: pointer;
        white-space: nowrap;
      }
      .actionButton:hover { background: #3a3b3f; }
      #translateButton {
        background: #26374f;
        border-color: #3b587e;
      }
      #translateButton:hover { background: #304766; }

      #panel {
        position: fixed;
        z-index: 3;
        width: min(470px, calc(100vw - 24px));
        max-height: min(580px, calc(100vh - 24px));
        overflow: hidden;
        border: 1px solid #44474d;
        border-radius: 14px;
        background: #202124;
        color: #f1f3f4;
        box-shadow: 0 14px 42px rgba(0,0,0,.48);
        font: 14px/1.48 Arial, sans-serif;
        display: flex;
        flex-direction: column;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid #3c4043;
      }
      .title {
        margin: 0;
        font: 600 16px/1.2 Arial, sans-serif;
        flex: 1;
      }
      .close {
        border: 0;
        background: transparent;
        color: #bdc1c6;
        font-size: 23px;
        cursor: pointer;
        padding: 0 4px;
      }

      .body { overflow: auto; padding: 15px 16px; }
      .label { font-weight: 600; margin: 0 0 8px; }

      #corrected {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: #292a2d;
        border: 1px solid #45474d;
        border-radius: 9px;
        padding: 12px;
        min-height: 72px;
      }

      .diff-old {
        color: #ff7b72;
        background: rgba(248,81,73,.13);
        text-decoration: line-through;
        text-decoration-thickness: 1.5px;
      }
      .diff-new {
        color: #7ee787;
        background: rgba(46,160,67,.16);
        font-weight: 600;
      }

      #errors {
        display: grid;
        gap: 9px;
        margin-top: 12px;
      }
      .error {
        border-left: 3px solid #8ab4f8;
        background: #292a2d;
        border-radius: 4px 8px 8px 4px;
        padding: 8px 10px;
      }
      .change { font-weight: 600; }
      .arrow { color: #9aa0a6; padding: 0 5px; }
      .explanation { color: #bdc1c6; margin-top: 3px; }
      .empty { color: #7ee787; }

      #translationResult { display: grid; gap: 12px; }
      .languageRow {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .muted { color: #9aa0a6; }
      .langBadge {
        display: inline-flex;
        align-items: center;
        border: 1px solid #4a5f7d;
        background: #26374f;
        color: #d8e8ff;
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 12px;
        font-weight: 600;
      }
      .translationCard {
        background: #292a2d;
        border: 1px solid #45474d;
        border-radius: 10px;
        padding: 13px;
      }
      #translatedText {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 15px;
        line-height: 1.55;
      }
      #translationNotes {
        display: grid;
        gap: 7px;
      }
      .note {
        position: relative;
        padding: 8px 10px 8px 28px;
        color: #c7cbd1;
        background: #252629;
        border-radius: 8px;
      }
      .note::before {
        content: "•";
        position: absolute;
        left: 12px;
        color: #8ab4f8;
        font-weight: 700;
      }

      .footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid #3c4043;
      }
      .secondary, .primary {
        border-radius: 8px;
        padding: 10px 14px;
        cursor: pointer;
      }
      .secondary {
        border: 1px solid #5f6368;
        color: #f1f3f4;
        background: #303134;
      }
      .primary {
        border: 1px solid #8ab4f8;
        color: #202124;
        background: #8ab4f8;
      }
      .primary:hover { background: #aecbfa; }

      button:disabled { opacity: .55; cursor: wait; }

      #status {
        color: #bdc1c6;
        margin: 0;
        padding: 22px 0;
        text-align: center;
      }
      .spinner {
        display: inline-block;
        width: 17px;
        height: 17px;
        margin-right: 8px;
        vertical-align: -3px;
        border: 2px solid #cfd4dc;
        border-top-color: #1a73e8;
        border-radius: 50%;
        animation: spin .8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }


      #moreButton {
        min-width: 38px;
        padding-left: 11px;
        padding-right: 11px;
        font-size: 18px;
        line-height: 1;
      }
      #hideActionsButton {
        min-width: 34px;
        padding-left: 10px;
        padding-right: 10px;
        font-size: 17px;
        line-height: 1;
        color: #bdc1c6;
      }
      #hideActionsButton:hover {
        color: #fff;
        background: #3a3b3f;
      }
      #actionMenu {
        position: absolute;
        top: calc(100% + 7px);
        right: 0;
        width: 230px;
        border: 1px solid #45474d;
        border-radius: 11px;
        background: #202124;
        box-shadow: 0 12px 30px rgba(0,0,0,.42);
        padding: 6px;
        z-index: 4;
      }
      .menuItem {
        width: 100%;
        border: 0;
        border-radius: 8px;
        padding: 9px 10px;
        background: transparent;
        color: #f1f3f4;
        text-align: left;
        cursor: pointer;
      }
      .menuItem:hover { background: #303134; }
      .menuDivider {
        height: 1px;
        background: #3c4043;
        margin: 5px 3px;
      }
      #actionSettings {
        position: absolute;
        top: calc(100% + 7px);
        right: 0;
        width: 292px;
        max-height: min(420px, calc(100vh - 32px));
        overflow-y: auto;
        padding: 10px;
        border: 1px solid #45474d;
        border-radius: 11px;
        background: #202124;
        box-shadow: 0 12px 30px rgba(0,0,0,.42);
        z-index: 6;
      }
      .settingsTitle {
        font: 600 13px/1.3 Arial, sans-serif;
        margin: 2px 4px 8px;
        color: #f1f3f4;
      }
      .settingRow {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        padding: 7px 5px;
        margin: 0;
        color: #d5d8dc;
        font: 13px/1.3 Arial, sans-serif;
        white-space: normal;
        cursor: pointer;
      }
      .settingRow input {
        flex: 0 0 auto;
        width: 15px;
        height: 15px;
        margin: 0;
        accent-color: #8ab4f8;
      }
      #genericResult {
        display: grid;
        gap: 12px;
      }
      #genericOutput {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: #292a2d;
        border: 1px solid #45474d;
        border-radius: 10px;
        padding: 13px;
        font-size: 15px;
        line-height: 1.55;
      }
      #alternatives {
        display: grid;
        gap: 9px;
      }
      .alternative {
        border: 1px solid #45474d;
        border-radius: 10px;
        background: #292a2d;
        padding: 11px 12px;
        cursor: pointer;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .alternative:hover { border-color: #8ab4f8; }
      .alternative.active { border-color: #8ab4f8; box-shadow: 0 0 0 1px #8ab4f8 inset; }

      #toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        z-index: 5;
        transform: translateX(-50%);
        background: #202124;
        color: #fff;
        border-radius: 8px;
        padding: 10px 14px;
        font: 14px Arial, sans-serif;
        box-shadow: 0 6px 20px rgba(0,0,0,.25);
      }
    </style>

    <div id="actions" class="hidden">
      <button id="editButton" class="actionButton quickAction" data-action="edit" type="button">✎&nbsp; Редактировать</button>
      <button id="translateButton" class="actionButton quickAction" data-action="translate" type="button">文&nbsp; Перевод</button>
      <button id="simplifyButton" class="actionButton quickAction hidden" data-action="simplify" type="button">Упростить</button>
      <button id="shortenButton" class="actionButton quickAction hidden" data-action="shorten" type="button">Короче</button>
      <button id="politeButton" class="actionButton quickAction hidden" data-action="polite" type="button">Вежливее</button>
      <button id="formalButton" class="actionButton quickAction hidden" data-action="formal" type="button">Официальнее</button>
      <button id="rephraseButton" class="actionButton quickAction hidden" data-action="rephrase" type="button">Переформулировать</button>
      <button id="moreButton" class="actionButton" type="button" aria-label="Другие действия">⋯</button>
      <button id="hideActionsButton" class="actionButton" type="button" aria-label="Скрыть до следующего выделения" title="Скрыть до следующего выделения">×</button>

      <div id="actionMenu" class="hidden">
        <div id="menuActions"></div>
        <div class="menuDivider"></div>
        <button id="openActionSettings" class="menuItem" type="button">⚙ Настроить действия</button>
      </div>

      <div id="actionSettings" class="hidden">
        <div class="settingsTitle">Показывать рядом с выделением</div>
        <label class="settingRow"><input type="checkbox" data-setting-action="edit"> Редактировать</label>
        <label class="settingRow"><input type="checkbox" data-setting-action="translate"> Перевод</label>
        <label class="settingRow"><input type="checkbox" data-setting-action="simplify"> Упростить</label>
        <label class="settingRow"><input type="checkbox" data-setting-action="shorten"> Сделать короче</label>
        <label class="settingRow"><input type="checkbox" data-setting-action="polite"> Сделать вежливее</label>
        <label class="settingRow"><input type="checkbox" data-setting-action="formal"> Сделать официальнее</label>
        <label class="settingRow"><input type="checkbox" data-setting-action="rephrase"> Переформулировать</label>
        <div class="menuDivider"></div>
        <label class="settingRow"><input id="autoCopySetting" type="checkbox"> Автоматически копировать результат</label>
      </div>
    </div>

    <section id="panel" class="hidden" role="dialog" aria-labelledby="title">
      <div class="header">
        <h2 class="title" id="title">Редактор текста</h2>
        <button class="close" type="button" aria-label="Закрыть">×</button>
      </div>

      <div class="body">
        <p id="status"><span class="spinner"></span>Проверяю текст…</p>

        <div id="editResult" class="hidden">
          <p class="label">Исправленный текст</p>
          <div id="corrected"></div>

          <p class="label" style="margin-top:16px">Найденные правки</p>
          <div id="errors"></div>
        </div>

        <div id="translationResult" class="hidden">
          <div class="languageRow">
            <span class="muted">Исходный язык:</span>
            <span id="sourceLanguage" class="langBadge">Определяется…</span>
            <span class="muted">→ Русский</span>
          </div>

          <div>
            <p class="label">Перевод</p>
            <div class="translationCard">
              <div id="translatedText"></div>
            </div>
          </div>

          <div id="notesSection" class="hidden">
            <p class="label">Нюансы перевода</p>
            <div id="translationNotes"></div>
          </div>
        </div>
        <div id="genericResult" class="hidden">
          <div>
            <p class="label" id="genericLabel">Результат</p>
            <div id="genericOutput"></div>
          </div>
          <div id="alternativesSection" class="hidden">
            <p class="label">Варианты</p>
            <div id="alternatives"></div>
          </div>
        </div>
      </div>

      <div class="footer hidden" id="footer">
        <button class="secondary" id="copy" type="button">Копировать</button>
        <button class="primary" id="replace" type="button">Заменить текст</button>
      </div>
    </section>

    <div id="toast" class="hidden"></div>
  `;

  const $ = (selector) => shadow.querySelector(selector);
  const actions = $("#actions");
  const editButton = $("#editButton");
  const translateButton = $("#translateButton");
  const panel = $("#panel");
  const title = $("#title");
  const status = $("#status");
  const editResult = $("#editResult");
  const translationResult = $("#translationResult");
  const correctedBox = $("#corrected");
  const errorsBox = $("#errors");
  const sourceLanguage = $("#sourceLanguage");
  const translatedTextBox = $("#translatedText");
  const notesSection = $("#notesSection");
  const translationNotes = $("#translationNotes");
  const footer = $("#footer");
  const copyButton = $("#copy");
  const replaceButton = $("#replace");
  const simplifyButton = $("#simplifyButton");
  const shortenButton = $("#shortenButton");
  const politeButton = $("#politeButton");
  const formalButton = $("#formalButton");
  const rephraseButton = $("#rephraseButton");
  const moreButton = $("#moreButton");
  const hideActionsButton = $("#hideActionsButton");
  const actionMenu = $("#actionMenu");
  const menuActions = $("#menuActions");
  const openActionSettings = $("#openActionSettings");
  const actionSettings = $("#actionSettings");
  const autoCopySetting = $("#autoCopySetting");
  const genericResult = $("#genericResult");
  const genericLabel = $("#genericLabel");
  const genericOutput = $("#genericOutput");
  const alternativesSection = $("#alternativesSection");
  const alternatives = $("#alternatives");

  let captured = null;
  let outputText = "";
  let currentMode = "edit";
  let toastTimer;
  let selectionCheckTimer;
  const safeSendMessage = (message) => globalThis.AITextRuntime.safeSendMessage(message);

  let suppressActionsUntilNextSelection = false;

  const ACTION_META = {
    edit: { label: "Редактировать", title: "Редактор текста" },
    translate: { label: "Перевод", title: "Перевод на русский" },
    simplify: { label: "Упростить", title: "Упростить текст" },
    shorten: { label: "Сделать короче", title: "Сделать текст короче" },
    polite: { label: "Сделать вежливее", title: "Вежливая версия" },
    formal: { label: "Сделать официальнее", title: "Официальная версия" },
    rephrase: { label: "Переформулировать", title: "Варианты формулировки" }
  };
  const DEFAULT_QUICK_ACTIONS = ["edit", "translate"];
  let quickActions = [...DEFAULT_QUICK_ACTIONS];
  let autoCopyResult = false;
  let currentAvailability = { canEdit: false, canTranslate: false };

  loadUiSettings();

  async function loadUiSettings() {
    const saved = await chrome.storage.local.get(["quickTextActions", "autoCopyResult"]);
    if (Array.isArray(saved.quickTextActions)) {
      quickActions = saved.quickTextActions.filter((x) => ACTION_META[x]);
    }
    autoCopyResult = Boolean(saved.autoCopyResult);
    autoCopySetting.checked = autoCopyResult;
    syncSettingCheckboxes();
  }

  function syncSettingCheckboxes() {
    shadow.querySelectorAll("[data-setting-action]").forEach((input) => {
      input.checked = quickActions.includes(input.dataset.settingAction);
    });
  }

  async function saveUiSettings() {
    quickActions = Array.from(shadow.querySelectorAll("[data-setting-action]:checked"))
      .map((input) => input.dataset.settingAction);
    autoCopyResult = autoCopySetting.checked;
    await chrome.storage.local.set({
      quickTextActions: quickActions,
      autoCopyResult
    });
    updateActionButtons();
  }

  document.addEventListener("mouseup", (event) => {
    if (host.contains(event.target)) return;

    // Любое новое выделение мышью снова разрешает показ панели,
    // даже если пользователь выделил тот же самый текст повторно.
    suppressActionsUntilNextSelection = false;

    queueSelectionCheck(event.target, {
      x: event.clientX,
      y: event.clientY
    });
  }, true);

  document.addEventListener("pointerup", (event) => {
    if (host.contains(event.target)) return;
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;

    suppressActionsUntilNextSelection = false;
    queueSelectionCheck(event.target, {
      x: event.clientX,
      y: event.clientY
    });
  }, true);

  document.addEventListener("keyup", (event) => {
    if (event.altKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      suppressActionsUntilNextSelection = false;
      forceOpenActions(event.target);
      return;
    }

    if (event.shiftKey || ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      suppressActionsUntilNextSelection = false;
    }

    queueSelectionCheck(event.target);
  }, true);

  document.addEventListener("selectionchange", () => {
    if (!panel.classList.contains("hidden")) return;
    if (suppressActionsUntilNextSelection) return;
    queueSelectionCheck(document.activeElement);
  }, true);

  document.addEventListener("input", (event) => {
    if (!panel.classList.contains("hidden")) return;
    queueSelectionCheck(event.target);
  }, true);

  document.addEventListener("mousedown", (event) => {
    if (!host.contains(event.target)) {
      hideActions(true);
      if (!panel.classList.contains("hidden")) closeModal();
    }
  }, true);

  window.addEventListener("scroll", () => hideActions(false), true);
  window.addEventListener("blur", () => {
    if (panel.classList.contains("hidden")) hideActions(true);
  });

  function queueSelectionCheck(target, pointer = null) {
    clearTimeout(selectionCheckTimer);
    selectionCheckTimer = setTimeout(() => {
      captureSelection(target, false, pointer);
    }, 0);
  }

  function forceOpenActions(target) {
    if (!panel.classList.contains("hidden")) return;
    const ok = captureSelection(target || document.activeElement, true, null);
    if (!ok) showToast("Сначала выделите текст");
  }

  function captureSelection(target, force = false, pointer = null) {
    if (!panel.classList.contains("hidden")) return false;

    const candidate =
      isTextControl(target) ? target :
      isTextControl(document.activeElement) ? document.activeElement :
      null;

    if (candidate) {
      const start = candidate.selectionStart;
      const end = candidate.selectionEnd;

      if (Number.isInteger(start) && Number.isInteger(end) && start !== end) {
        const text = candidate.value.slice(start, end);
        if (text.trim()) {
          captured = {
            kind: "control",
            element: candidate,
            start,
            end,
            text,
            adapterId: globalThis.AITextAdapters.current().id
          };

          const rect = pointer
            ? pointRect(pointer.x, pointer.y)
            : getTextControlAnchor(candidate);

          showActionsNear(rect, {
            canEdit: true,
            canTranslate: shouldOfferTranslation(text)
          });
          return true;
        }
      }
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const text = selection.toString();

      if (text.trim()) {
        const editable = closestEditable(range.commonAncestorContainer);

        if (editable) {
          captured = {
            kind: "editable",
            element: editable,
            range: range.cloneRange(),
            text,
            adapterId: globalThis.AITextAdapters.current().id
          };

          const rect = pointer
            ? pointRect(pointer.x, pointer.y)
            : getRangeEndRect(range);

          if (rect && (rect.width || rect.height)) {
            showActionsNear(rect, {
              canEdit: true,
              canTranslate: shouldOfferTranslation(text)
            });
            return true;
          }
        }

        captured = {
          kind: "readonly",
          element: null,
          range: range.cloneRange(),
          text,
          adapterId: globalThis.AITextAdapters.current().id
        };

        const rect = pointer
          ? pointRect(pointer.x, pointer.y)
          : getRangeEndRect(range);

        if (rect && (rect.width || rect.height)) {
          showActionsNear(rect, {
            canEdit: globalThis.AITextAdapters.canProcessReadonlySelection(),
            canTranslate: shouldOfferTranslation(text)
          });
          return true;
        }
      }
    }

    hideActions(true);
    return false;
  }

  function shouldOfferTranslation(text) {
    const letters = text.match(/\p{L}/gu) || [];
    if (!letters.length) return false;

    const cyrillic = text.match(/[А-Яа-яЁё]/g) || [];
    const russianRatio = cyrillic.length / letters.length;

    return russianRatio < 0.7;
  }

  function isTextControl(element) {
    return globalThis.AITextAdapters.isTextControl(element);
  }

  function closestEditable(node) {
    return globalThis.AITextAdapters.findEditable(node);
  }

  function pointRect(x, y) {
    return {
      top: y,
      right: x,
      bottom: y,
      left: x,
      width: 1,
      height: 1
    };
  }

  function getRangeEndRect(range) {
    try {
      const endRange = range.cloneRange();
      endRange.collapse(false);

      const rects = endRange.getClientRects();
      if (rects.length) return rects[rects.length - 1];

      const allRects = range.getClientRects();
      if (allRects.length) return allRects[allRects.length - 1];

      return range.getBoundingClientRect();
    } catch {
      return range.getBoundingClientRect();
    }
  }

  function getTextControlAnchor(element) {
    return element.getBoundingClientRect();
  }

  function showActionsNear(rect, availability = { canEdit: true, canTranslate: true }) {
    if (!captured) return;

    currentAvailability = availability;
    updateActionButtons();

    captured.anchorRect = {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left
    };

    actions.classList.remove("hidden");

    requestAnimationFrame(() => {
      const margin = 8;
      const gap = 8;
      const actionsWidth = actions.offsetWidth || 150;
      const actionsHeight = actions.offsetHeight || 40;

      const left = Math.max(
        margin,
        Math.min(window.innerWidth - actionsWidth - margin, rect.left)
      );

      let top = rect.top - actionsHeight - gap;
      if (top < margin) {
        top = Math.min(
          window.innerHeight - actionsHeight - margin,
          rect.bottom + gap
        );
      }

      actions.style.left = `${left}px`;
      actions.style.top = `${top}px`;
    });
  }

  function actionAllowed(action) {
    if (action === "edit") return currentAvailability.canEdit;
    if (action === "translate") return currentAvailability.canTranslate;
    return true;
  }

  function updateActionButtons() {
    const buttonMap = {
      edit: editButton,
      translate: translateButton,
      simplify: simplifyButton,
      shorten: shortenButton,
      polite: politeButton,
      formal: formalButton,
      rephrase: rephraseButton
    };

    for (const [action, button] of Object.entries(buttonMap)) {
      button.classList.toggle("hidden", !(quickActions.includes(action) && actionAllowed(action)));
    }

    renderMoreMenu();
  }

  function renderMoreMenu() {
    menuActions.replaceChildren();
    for (const action of Object.keys(ACTION_META)) {
      if (quickActions.includes(action) || !actionAllowed(action)) continue;
      const button = document.createElement("button");
      button.className = "menuItem";
      button.type = "button";
      button.dataset.menuAction = action;
      button.textContent = ACTION_META[action].label;
      menuActions.appendChild(button);
    }
  }

  function hideActions(resetCapture = false) {
    actions.classList.add("hidden");
    actionMenu.classList.add("hidden");
    actionSettings.classList.add("hidden");
    if (resetCapture) captured = null;
  }

  for (const button of shadow.querySelectorAll(".actionButton")) {
    button.addEventListener("mousedown", (event) => event.preventDefault());
  }

  shadow.querySelectorAll(".quickAction").forEach((button) => {
    button.addEventListener("click", () => runAction(button.dataset.action));
  });

  moreButton.addEventListener("click", (event) => {
    event.stopPropagation();
    actionSettings.classList.add("hidden");
    renderMoreMenu();
    actionMenu.classList.toggle("hidden");
  });

  hideActionsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    suppressActionsUntilNextSelection = true;
    hideActions(false);
  });

  menuActions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-menu-action]");
    if (!button) return;
    actionMenu.classList.add("hidden");
    runAction(button.dataset.menuAction);
  });

  openActionSettings.addEventListener("click", () => {
    actionMenu.classList.add("hidden");
    syncSettingCheckboxes();
    autoCopySetting.checked = autoCopyResult;
    actionSettings.classList.remove("hidden");

    requestAnimationFrame(() => {
      const rect = actionSettings.getBoundingClientRect();
      const margin = 8;

      if (rect.right > window.innerWidth - margin) {
        actionSettings.style.right = "0";
        actionSettings.style.left = "auto";
      }

      if (rect.left < margin) {
        actionSettings.style.left = "0";
        actionSettings.style.right = "auto";
      }

      const updated = actionSettings.getBoundingClientRect();
      if (updated.bottom > window.innerHeight - margin) {
        actionSettings.style.top = "auto";
        actionSettings.style.bottom = "calc(100% + 7px)";
      } else {
        actionSettings.style.bottom = "auto";
        actionSettings.style.top = "calc(100% + 7px)";
      }
    });
  });

  actionSettings.addEventListener("change", saveUiSettings);

  shadow.addEventListener("click", (event) => {
    if (
      !actionSettings.classList.contains("hidden") &&
      !actionSettings.contains(event.target) &&
      event.target !== openActionSettings
    ) {
      actionSettings.classList.add("hidden");
    }
  });

  async function runAction(mode) {
    if (!captured?.text) {
      hideActions(true);
      return;
    }

    if (mode === "edit" && !currentAvailability.canEdit) {
      hideActions(true);
      return;
    }

    currentMode = mode;
    const requestText = captured.text;

    hideActions(false);
    openLoading(mode);

    try {
      let message;
      if (mode === "edit") {
        message = { type: "CORRECT_TEXT", text: requestText };
      } else if (mode === "translate") {
        message = { type: "TRANSLATE_TEXT", text: requestText, targetLanguage: "ru" };
      } else {
        message = { type: "TRANSFORM_TEXT", text: requestText, action: mode };
      }

      const response = await safeSendMessage(message);

      if (!response?.ok) {
        throw new Error(response?.error || "Неизвестная ошибка.");
      }

      if (mode === "translate") {
        const result = normalizeTranslationResult(response.result);
        outputText = result.translation;
        renderTranslation(result);
      } else if (mode === "edit") {
        outputText = response.result.correctedText;
        renderEditResult(response.result);
      } else {
        const result = normalizeTransformResult(response.result);
        outputText = result.output;
        renderTransformResult(result);
      }

      if (autoCopyResult && outputText) {
        const copied = await copyText(outputText);
        if (copied) showToast("Результат скопирован автоматически");
      }
    } catch (error) {
      renderError(error instanceof Error ? error.message : String(error));
    }
  }

  function openLoading(mode) {
    outputText = "";
    title.textContent = ACTION_META[mode]?.title || "Работа с текстом";
    const loadingText =
      mode === "translate" ? "Перевожу текст…" :
      mode === "edit" ? "Проверяю текст…" :
      mode === "rephrase" ? "Готовлю варианты…" :
      "⚡ Обрабатываю текст…";

    status.innerHTML = `<span class="spinner"></span>${loadingText}`;

    status.classList.remove("hidden");
    editResult.classList.add("hidden");
    translationResult.classList.add("hidden");
    genericResult.classList.add("hidden");
    footer.classList.add("hidden");

    copyButton.classList.remove("hidden");
    if (captured?.kind === "readonly") {
      replaceButton.classList.add("hidden");
    } else {
      replaceButton.classList.remove("hidden");
    }

    replaceButton.textContent =
      mode === "translate" ? "Заменить переводом" :
      mode === "edit" ? "Заменить текст" :
      "Заменить результатом";
    replaceButton.dataset.mode = "replace";

    panel.classList.remove("hidden");
    requestAnimationFrame(positionPanel);
  }

  function renderEditResult(result) {
    status.classList.add("hidden");
    editResult.classList.remove("hidden");
    translationResult.classList.add("hidden");
    genericResult.classList.add("hidden");
    footer.classList.remove("hidden");

    renderInlineDiff(captured.text, result.correctedText, correctedBox);
    errorsBox.replaceChildren();

    if (!Array.isArray(result.errors) || !result.errors.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Ошибок не найдено.";
      errorsBox.appendChild(empty);
      requestAnimationFrame(positionPanel);
      return;
    }

    for (const item of result.errors) {
      const card = document.createElement("div");
      card.className = "error";

      const line = document.createElement("div");
      line.className = "change";

      appendDiffPart(line, item.original || "∅", "diff-old");

      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "→";
      line.appendChild(arrow);

      appendDiffPart(line, item.correction || "∅", "diff-new");

      const explanation = document.createElement("div");
      explanation.className = "explanation";
      explanation.textContent = item.explanation || "";

      card.append(line, explanation);
      errorsBox.appendChild(card);
    }

    requestAnimationFrame(positionPanel);
  }

  function normalizeTranslationResult(result) {
    if (typeof result === "string") {
      return {
        sourceLanguage: "Автоопределение",
        translation: result,
        notes: []
      };
    }

    const translation =
      result?.translation ??
      result?.translatedText ??
      result?.correctedText ??
      "";

    if (!translation) throw new Error("Модель не вернула перевод.");

    let notes = [];
    if (Array.isArray(result?.notes)) {
      notes = result.notes.map(String).filter(Boolean);
    } else if (typeof result?.notes === "string" && result.notes.trim()) {
      notes = [result.notes.trim()];
    }

    return {
      sourceLanguage:
        result?.sourceLanguage ||
        result?.detectedLanguage ||
        result?.language ||
        "Автоопределение",
      translation: String(translation),
      notes
    };
  }

  function renderTranslation(result) {
    status.classList.add("hidden");
    editResult.classList.add("hidden");
    translationResult.classList.remove("hidden");
    genericResult.classList.add("hidden");
    footer.classList.remove("hidden");

    sourceLanguage.textContent = result.sourceLanguage;
    translatedTextBox.textContent = result.translation;
    translationNotes.replaceChildren();

    if (result.notes.length) {
      notesSection.classList.remove("hidden");
      for (const item of result.notes) {
        const note = document.createElement("div");
        note.className = "note";
        note.textContent = item;
        translationNotes.appendChild(note);
      }
    } else {
      notesSection.classList.add("hidden");
    }

    requestAnimationFrame(positionPanel);
  }

  function normalizeTransformResult(result) {
    const alternativesList = Array.isArray(result?.alternatives)
      ? result.alternatives.map(String).filter(Boolean).slice(0, 3)
      : [];

    const output = String(
      result?.output ||
      alternativesList[0] ||
      ""
    );

    if (!output) throw new Error("Модель не вернула результат.");

    return {
      output,
      alternatives: alternativesList
    };
  }

  function renderTransformResult(result) {
    status.classList.add("hidden");
    editResult.classList.add("hidden");
    translationResult.classList.add("hidden");
    genericResult.classList.remove("hidden");
    footer.classList.remove("hidden");

    genericLabel.textContent = currentMode === "rephrase" ? "Выбранный вариант" : "Результат";
    genericOutput.textContent = result.output;
    alternatives.replaceChildren();

    if (currentMode === "rephrase" && result.alternatives.length) {
      alternativesSection.classList.remove("hidden");
      result.alternatives.forEach((text, index) => {
        const card = document.createElement("div");
        card.className = "alternative" + (text === outputText ? " active" : "");
        card.textContent = text;
        card.dataset.index = String(index);
        alternatives.appendChild(card);
      });
    } else {
      alternativesSection.classList.add("hidden");
    }

    requestAnimationFrame(positionPanel);
  }

  alternatives.addEventListener("click", (event) => {
    const card = event.target.closest(".alternative");
    if (!card) return;
    outputText = card.textContent;
    genericOutput.textContent = outputText;
    alternatives.querySelectorAll(".alternative").forEach((x) => x.classList.remove("active"));
    card.classList.add("active");
  });

  function renderInlineDiff(original, corrected, container) {
    container.replaceChildren();
    const before = tokenize(original);
    const after = tokenize(corrected);

    if (before.length * after.length > 1200000) {
      appendDiffPart(container, original, "diff-old");
      appendDiffPart(container, corrected, "diff-new");
      return;
    }

    const rows = Array.from(
      { length: before.length + 1 },
      () => new Uint16Array(after.length + 1)
    );

    for (let i = before.length - 1; i >= 0; i--) {
      for (let j = after.length - 1; j >= 0; j--) {
        rows[i][j] =
          before[i] === after[j]
            ? rows[i + 1][j + 1] + 1
            : Math.max(rows[i + 1][j], rows[i][j + 1]);
      }
    }

    const parts = [];
    let i = 0;
    let j = 0;

    while (i < before.length || j < after.length) {
      if (i < before.length && j < after.length && before[i] === after[j]) {
        pushPart(parts, "", before[i]);
        i++;
        j++;
      } else if (
        i < before.length &&
        (j >= after.length || rows[i + 1][j] >= rows[i][j + 1])
      ) {
        pushPart(parts, "diff-old", before[i++]);
      } else {
        pushPart(parts, "diff-new", after[j++]);
      }
    }

    for (const part of parts) {
      appendDiffPart(container, part.text, part.className);
    }
  }

  function tokenize(text) {
    return text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
  }

  function pushPart(parts, className, text) {
    const last = parts[parts.length - 1];
    if (last?.className === className) last.text += text;
    else parts.push({ className, text });
  }

  function appendDiffPart(container, text, className) {
    const span = document.createElement("span");
    if (className) span.className = className;
    span.textContent = text;
    container.appendChild(span);
  }

  function positionPanel() {
    if (panel.classList.contains("hidden") || !captured?.anchorRect) return;

    const margin = 12;
    const gap = 8;
    const rect = captured.anchorRect;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;

    const left = Math.max(
      margin,
      Math.min(window.innerWidth - panelWidth - margin, rect.left)
    );

    let top = rect.bottom + gap;
    if (top + panelHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - panelHeight - gap);
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function renderError(message) {
    status.classList.remove("hidden");
    status.textContent = message;

    editResult.classList.add("hidden");
    translationResult.classList.add("hidden");
    genericResult.classList.add("hidden");
    footer.classList.remove("hidden");
    copyButton.classList.add("hidden");

    replaceButton.textContent = "Открыть настройки";
    replaceButton.dataset.mode = "settings";

    requestAnimationFrame(positionPanel);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.documentElement.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  copyButton.addEventListener("click", async () => {
    if (!outputText) return;
    const ok = await copyText(outputText);
    showToast(ok ? "Результат скопирован" : "Не удалось скопировать текст");
  });

  replaceButton.addEventListener("click", () => {
    if (replaceButton.dataset.mode === "settings") {
      safeSendMessage({ type: "OPEN_OPTIONS" }).catch(() => {});
      return;
    }

    if (!captured || !outputText) return;

    const replaced = replaceCapturedText(captured, outputText);

    if (replaced) {
      closeModal();
      hideActions(true);
      showToast(
        currentMode === "translate"
          ? "Текст заменён переводом"
          : "Текст заменён"
      );
    } else {
      showToast("Поле изменилось. Выделите текст заново");
    }
  });

  function replaceCapturedText(selection, replacement) {
    return globalThis.AITextAdapters.replaceCapturedText(selection, replacement);
  }

  function closeModal() {
    panel.classList.add("hidden");
    status.classList.add("hidden");
    editResult.classList.add("hidden");
    translationResult.classList.add("hidden");
    genericResult.classList.add("hidden");
    footer.classList.add("hidden");
    actionMenu.classList.add("hidden");
    actionSettings.classList.add("hidden");

    copyButton.classList.remove("hidden");
    replaceButton.dataset.mode = "replace";
    outputText = "";
  }

  $(".close").addEventListener("click", () => {
    closeModal();
    hideActions(true);
  });


  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "SHOW_CONTEXT_RESULT") return false;

    try {
      const selection = window.getSelection();
      let rect = null;
      if (selection && selection.rangeCount && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        rect = getRangeEndRect(range);
        captured = {
          kind: "readonly",
          element: null,
          range: range.cloneRange(),
          text: message.originalText || selection.toString()
        };
      } else {
        captured = {
          kind: "readonly",
          element: null,
          range: null,
          text: message.originalText || ""
        };
        rect = pointRect(window.innerWidth / 2, window.innerHeight / 2);
      }

      captured.anchorRect = {
        top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left
      };
      currentMode = message.action;

      if (message.action === "edit") {
        outputText = message.result.correctedText;
        panel.classList.remove("hidden");
        title.textContent = ACTION_META.edit.title;
        renderEditResult(message.result);
      } else if (message.action === "translate") {
        const result = normalizeTranslationResult(message.result);
        outputText = result.translation;
        panel.classList.remove("hidden");
        title.textContent = ACTION_META.translate.title;
        renderTranslation(result);
      } else {
        const result = normalizeTransformResult(message.result);
        outputText = result.output;
        panel.classList.remove("hidden");
        title.textContent = ACTION_META[message.action]?.title || "Результат";
        renderTransformResult(result);
      }

      replaceButton.classList.add("hidden");
      requestAnimationFrame(positionPanel);

      if (autoCopyResult && outputText) {
        copyText(outputText).then((ok) => {
          if (ok) showToast("Результат скопирован автоматически");
        });
      }

      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }

    return false;
  });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!panel.classList.contains("hidden")) {
        closeModal();
      }
      hideActions(true);
    }
  }, true);

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => toast.classList.add("hidden"),
      2200
    );
  }
})();
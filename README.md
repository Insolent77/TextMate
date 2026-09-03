# TextMate

[Русский](#русский) | [English](#english)

## Русский

TextMate — расширение для Chrome для работы с выделенным текстом с помощью ИИ.

### Возможности

- исправление орфографии, пунктуации и грамматики;
- перевод на русский язык;
- упрощение текста;
- сокращение текста;
- более вежливая формулировка;
- официальный стиль;
- 3 варианта переформулировки;
- настраиваемые быстрые действия;
- компактное popup-окно по клику на иконку расширения;
- быстрый выбор локального/облачного режима прямо в popup;
- контекстное меню Chrome;
- автокопирование результата;
- локальный режим через Ollama;
- облачный режим через Gemini или OpenAI-compatible API;
- отдельные адаптеры для Google Docs, Google Sheets, Word Online, Notion, Gmail и Telegram Web;
- кэш одинаковых запросов;
- гибрид локальных моделей: `qwen3:0.6b` для быстрых действий и `qwen3:1.7b` для редактирования и перевода.

Автопроверка при вводе текста пока не используется: все действия запускаются только пользователем.

### Popup и расширенные настройки

Обычный клик по иконке **TextMate** открывает компактное окно, где можно:

- переключить локальный/облачный режим;
- выбрать облачного провайдера;
- посмотреть используемые модели;
- включить нужные быстрые действия;
- включить автокопирование;
- проверить подключение.

API-ключи и дополнительные параметры остаются на странице **«Расширенные настройки»**.

### Установка для разработки

1. Скачайте или клонируйте репозиторий.
2. Откройте `chrome://extensions`.
3. Включите «Режим разработчика».
4. Нажмите «Загрузить распакованное расширение».
5. Выберите папку репозитория.
6. После обновления расширения обновите уже открытые вкладки через `F5`.

### Локальный режим

Установите Ollama и модели:

```powershell
ollama pull qwen3:0.6b
ollama pull qwen3:1.7b
```

Если `qwen3:1.7b` недоступна, TextMate автоматически использует `qwen3:0.6b`.

### Облачный режим

Поддерживаются:

- Gemini API;
- OpenAI-compatible API;
- собственный совместимый backend.

API-ключи не находятся в исходном коде. Пользователь вводит их в расширенных настройках расширения, после чего они сохраняются локально через `chrome.storage.local`.

### Версия

Текущая версия: **0.6.0**.

---

## English

TextMate is a Chrome extension for AI-powered work with selected text directly on web pages and in online editors.

### Features

- spelling, punctuation and grammar correction;
- translation to Russian;
- text simplification;
- text shortening;
- more polite wording;
- more formal wording;
- 3 rephrasing alternatives;
- configurable quick actions;
- compact extension popup opened by clicking the TextMate icon;
- quick local/cloud mode switching directly from the popup;
- Chrome context menu integration;
- optional automatic copying of results;
- local mode powered by Ollama;
- cloud mode powered by Gemini or any OpenAI-compatible API;
- dedicated adapters for Google Docs, Google Sheets, Word Online, Notion, Gmail and Telegram Web;
- caching for repeated requests;
- hybrid local models: `qwen3:0.6b` for fast transformations and `qwen3:1.7b` for correction and translation.

Automatic checking while typing is not enabled yet. Every action is started manually by the user.

### Popup and advanced settings

Clicking the **TextMate** extension icon now opens a compact popup where you can:

- switch between local and cloud modes;
- choose a cloud provider;
- see the active models;
- configure quick actions;
- enable automatic copying;
- test the current connection.

API keys and advanced provider parameters remain available through **Advanced settings**.

### Development installation

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder.
6. After reloading or updating the extension, refresh already opened pages with `F5`.

### Local mode

Install Ollama and the models:

```powershell
ollama pull qwen3:0.6b
ollama pull qwen3:1.7b
```

If `qwen3:1.7b` is unavailable, TextMate automatically falls back to `qwen3:0.6b`.

### Cloud mode

Supported options:

- Gemini API;
- OpenAI-compatible API;
- your own compatible backend.

API keys are not hardcoded in the source code. Users enter them in the advanced extension settings, and they are stored locally through `chrome.storage.local`.

### Version

Current version: **0.6.0**.

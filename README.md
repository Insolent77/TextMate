# TextMate

[Русский](#русский) | [English](#english)

## Русский

TextMate — расширение для работы с выделенным текстом с помощью ИИ.

### Поддерживаемые браузеры

| Браузер | Сборка |
|---|---|
| Google Chrome | Chromium |
| Microsoft Edge | Chromium |
| Opera | Chromium |
| Mozilla Firefox | Firefox |

Яндекс Браузер отдельно не поддерживается.

### Возможности

- исправление орфографии, пунктуации и грамматики;
- перевод на русский язык;
- упрощение и сокращение текста;
- вежливый и официальный стиль;
- несколько вариантов переформулировки;
- настраиваемые быстрые действия;
- popup по клику на иконку TextMate;
- контекстное меню браузера;
- автокопирование результата;
- локальный режим через Ollama;
- облачный режим через Gemini или OpenAI-compatible API;
- адаптеры для Google Docs, Google Sheets, Word Online, Notion, Gmail и Telegram Web;
- кэш одинаковых запросов;
- локальные модели `qwen3:0.6b` и `qwen3:1.7b`.

### Сборки

Chrome, Edge и Opera используют один ZIP:

`TextMate-v0.7.0-Chromium.zip`

Firefox использует отдельный ZIP:

`TextMate-v0.7.0-Firefox.zip`

Исходный код:

`TextMate-v0.7.0-Source.zip`

### Сборка из исходников

```bash
python build.py
```

Готовые файлы появятся в папке `dist/`.

### Локальный режим

```powershell
ollama pull qwen3:0.6b
ollama pull qwen3:1.7b
```

### Версия

Текущая версия: **0.7.0**.

---

## English

TextMate is an AI-powered browser extension for working with selected text.

### Supported browsers

| Browser | Package |
|---|---|
| Google Chrome | Chromium |
| Microsoft Edge | Chromium |
| Opera | Chromium |
| Mozilla Firefox | Firefox |

Yandex Browser is not maintained as a separate supported target.

### Features

- spelling, punctuation and grammar correction;
- translation to Russian;
- text simplification and shortening;
- polite and formal rewriting;
- multiple rephrasing alternatives;
- configurable quick actions;
- compact TextMate popup;
- browser context menu integration;
- optional automatic result copying;
- local Ollama mode;
- cloud mode using Gemini or any OpenAI-compatible API;
- adapters for Google Docs, Google Sheets, Word Online, Notion, Gmail and Telegram Web;
- repeated-request caching;
- local `qwen3:0.6b` and `qwen3:1.7b` models.

### Packages

Chrome, Edge and Opera use:

`TextMate-v0.7.0-Chromium.zip`

Firefox uses:

`TextMate-v0.7.0-Firefox.zip`

Source code:

`TextMate-v0.7.0-Source.zip`

### Build from source

```bash
python build.py
```

Generated packages are placed in `dist/`.

### Local mode

```powershell
ollama pull qwen3:0.6b
ollama pull qwen3:1.7b
```

### Version

Current version: **0.7.0**.

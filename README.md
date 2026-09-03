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

`TextMate-v0.9.2-Chromium.zip`

Firefox использует отдельный ZIP:

`TextMate-v0.9.2-Firefox.zip`

Исходный код:

`TextMate-v0.9.2-Source.zip`

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

Текущая версия: **0.9.2**.

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

`TextMate-v0.9.2-Chromium.zip`

Firefox uses:

`TextMate-v0.9.2-Firefox.zip`

Source code:

`TextMate-v0.9.2-Source.zip`

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

Current version: **0.9.2**.


## Исправления v0.9.1 / Fixes in v0.9.1

- исправлено падение «Не удалось разобрать ответ модели»;
- JSON от локальной модели разбирается более устойчиво;
- если структурированный ответ всё равно повреждён, TextMate автоматически повторяет запрос обычным текстом;
- для Gemini JSON-режим теперь используется только там, где он действительно нужен.

- fixed “Could not parse model response” errors;
- more tolerant parsing of local model JSON responses;
- automatic plain-text retry when structured output is malformed;
- Gemini JSON mode is now enabled only for structured actions.


## Режим без AI

В TextMate есть третий режим: **«Без AI — проверка русского текста»**.

В нём:

- текст не отправляется в Ollama, Gemini, OpenAI-compatible API или на другие серверы;
- доступна только кнопка **«Редактировать»**;
- перевод, упрощение, сокращение, изменение тона и переформулирование скрываются;
- проверяются только русскоязычные тексты;
- используются локальные детерминированные правила: частые опечатки, пробелы, базовая пунктуация, заглавные буквы и повтор слов.

Этот режим быстрее и приватнее, но слабее AI в сложной грамматике, стилистике и контексте.

---

## No-AI mode

TextMate also includes **No AI — Russian text correction** mode.

In this mode:

- text is never sent to Ollama, Gemini, OpenAI-compatible APIs, or other servers;
- only the **Edit** action is available;
- translation, simplification, shortening, tone changes, and rephrasing are hidden;
- only predominantly Russian text is processed;
- correction uses deterministic local rules for common typos, spacing, basic punctuation, capitalization, and repeated words.

This mode is faster and fully private, but intentionally less capable than AI for complex grammar, style, and context.


## Словарная проверка без AI / Dictionary spellcheck without AI

В v0.9.1 режим **«Без AI — русский язык»** использует русский Hunspell-словарь LibreOffice.

- при первом использовании скачиваются только данные словаря (`ru_RU.aff` и `ru_RU.dic`, около 4 МБ);
- словарь сохраняется в IndexedDB расширения;
- последующие проверки используют локальную копию;
- выделенный пользовательский текст никуда не отправляется;
- удалённый JavaScript не загружается и не выполняется.

In v0.9.1 **No AI — Russian** mode uses the LibreOffice Russian Hunspell dictionary.

- only dictionary data (`ru_RU.aff` and `ru_RU.dic`, about 4 MB) is downloaded on first use;
- it is cached in the extension's IndexedDB;
- later checks use the local cached copy;
- selected user text is never uploaded;
- no remote JavaScript is downloaded or executed.


## v0.9.1: OpenAI API + TextMate Global

Cloud AI now supports four explicit providers:

- **TextMate Global** — public TextMate backend on Cloudflare Workers AI; end users do not need an AI API key.
- **OpenAI API** — official `api.openai.com` with the user's own API key.
- **Gemini API**.
- **OpenAI-compatible** — custom/self-hosted endpoints.

### Official OpenAI API

The API key is stored in extension local storage and is sent only to OpenAI's API endpoint.
It is separate from a ChatGPT Plus subscription. Availability is subject to OpenAI's API terms and supported regions.

Default model fields:
- Fast: `gpt-5.6-luna`
- Quality: `gpt-5.6-terra`

Both are editable.

### TextMate Global

`cloudflare-worker/` contains the backend template:

TextMate → Cloudflare Worker → Cloudflare Workers AI.

Default Workers AI models:
- Fast: `@cf/zai-org/glm-4.7-flash`
- Quality: `@cf/google/gemma-4-26b-a4b-it`

The Worker includes a per-installation rate limit and input-size limits and does not log user text in application code.


## Provider setup links

TextMate v0.9.1 adds direct setup links to the extension settings:

- Ollama download: https://ollama.com/download
- OpenAI API keys: https://platform.openai.com/api-keys
- Gemini API keys: https://aistudio.google.com/app/apikey
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/get-started/
- LibreOffice Russian dictionary: https://github.com/LibreOffice/dictionaries/tree/master/ru_RU

For OpenAI-compatible providers, the API URL and API key depend on the selected provider.


## v0.9.2: correction result validation

TextMate no longer blindly trusts the AI-provided `errors` array.

Each reported correction is validated before it is shown:
- `original` must actually occur in the source text;
- `correction` must occur in the corrected text (unless it is a deletion);
- unchanged items are discarded;
- fabricated service tokens or unrelated fragments are therefore not shown as corrections.

Also fixes the asynchronous no-AI context-menu correction call.

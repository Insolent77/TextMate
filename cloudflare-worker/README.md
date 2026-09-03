# TextMate Global — Cloudflare Worker

Backend for the public TextMate extension.

## Architecture

TextMate extension → Cloudflare Worker → Workers AI.

No OpenAI API key is embedded in the extension.

## Deploy

1. Install Node.js.
2. `npm install`
3. `npx wrangler login`
4. `npm run deploy`
5. Copy the resulting `https://...workers.dev` address into TextMate advanced settings → TextMate Global.

## Default models

- Fast: `@cf/zai-org/glm-4.7-flash`
- Quality: `@cf/google/gemma-4-26b-a4b-it`

Both can be changed through `wrangler.toml`.

## Protection

- 30 requests/minute per TextMate installation id;
- max user prompt length;
- request body limit;
- no application-level logging of user text;
- no shared provider secret in the browser extension.

The installation id is not a strong identity mechanism. Before paid/public high-volume usage, add real accounts or signed access tokens plus usage accounting.

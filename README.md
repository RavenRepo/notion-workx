# WorX

Turn any **OpenAPI 3.x REST API** into a **Notion Worker** in one command.

WorX reads an API spec and generates a ready-to-deploy TypeScript worker where each endpoint becomes a `worker.tool()` that Notion agents can call through MCP.

## Why WorX?

Without WorX, each API action usually needs manual tool code. With WorX, you generate those tools automatically, so you can focus on your workflow instead of boilerplate.

## Real Use Cases (in simple terms)

1. **Sales ops automation**: Pull recent CRM deals, enrich them with billing data, and write summaries into Notion.
2. **Support workflows**: Let agents fetch ticket/customer details from your support API without hand-coding every endpoint.
3. **Internal tools fast**: Convert your company’s OpenAPI docs into usable agent tools in minutes.
4. **Hackathon speed**: Go from “API docs” to “working Notion tools” during the same task session.

## How it works

1. Give WorX a local file or URL to an OpenAPI spec.
2. WorX generates a complete Worker project.
3. Deploy the worker and start calling the generated tools from Notion agents.

## Quick Start

```bash
npm install
npm run build
node dist/cli/index.js generate --spec ./openapi.json --output ./generated-worker
```

Remote spec example:

```bash
worx generate --spec https://api.example.com/openapi.json --output ./example-worker
```

## CLI

```bash
worx generate --spec <url|path> --output ./worker
```

| Option | What it means |
|---|---|
| `--spec <url\|path>` | OpenAPI 3.x source (URL or local file) |
| `--output <dir>` | Where the generated Worker project is written |
| `--filter <tags...>` | Generate tools only for selected OpenAPI tags |
| `--dry-run` | Show what would be generated without writing files |
| `--deploy` | Deploy automatically via `ntn workers deploy` |

## What WorX generates

- `src/index.ts` — generated `worker.tool()` implementations
- `.env.example` — placeholder secrets you need to fill
- `worx.config.json` — generation details and skipped endpoint reasons
- `README.md` (inside output) — generated tool list + usage notes
- `package.json`, `tsconfig.json` — minimal worker project setup

## Scope (v1)

WorX v1 is built for **OpenAPI 3.x REST APIs with JSON bodies** and common auth patterns.

Supported:
- OpenAPI 3.0.x / 3.1.x
- Path/query/header params
- JSON request bodies
- Bearer and API key auth (header/query)
- Local `$ref` (same document)

Known limitations:
- Remote `$ref` (external files/URLs) is not resolved
- OAuth2/OpenID flows require manual token setup
- Multipart/binary upload endpoints are skipped
- Deep nested object schemas are simplified
- Complex `oneOf`/`anyOf` cases are simplified
- XML-only responses are skipped

## Development

```bash
npm install
npx tsc --noEmit
npm test
npm run build
```

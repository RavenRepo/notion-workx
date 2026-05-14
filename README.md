<p align="center">
  <img src="https://img.shields.io/badge/⚡-WorX-6366f1?style=for-the-badge&labelColor=0a0a0f" alt="WorX" height="45"/>
</p>

<h1 align="center">WorX</h1>

<p align="center">
  <strong>Any OpenAPI spec → Notion Worker tools, in one command.</strong>
</p>

<p align="center">
  <em>WorX turns OpenAPI 3.x APIs into deployable Notion Workers so AI agents can call real-world APIs without hand-writing every tool.</em>
</p>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/CLI-worx_generate-6366f1?style=flat-square" alt="CLI"/></a>
  <a href="#-v1-scope"><img src="https://img.shields.io/badge/OpenAPI-3.x-16a34a?style=flat-square" alt="OpenAPI 3.x"/></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"/></a>
</p>

---

## 💡 The Idea

Most teams already have API docs, but their Notion agents still cannot use those APIs directly.

That gap is exactly what WorX solves:

1. You give WorX an OpenAPI spec (`.json`, `.yaml`, URL, or local file).
2. WorX generates a TypeScript Notion Worker project.
3. Each supported endpoint becomes a `worker.tool()`.
4. Deploy it, and your Notion agents can call those tools immediately.

In simple words: **WorX converts API documentation into working agent tools.**

## 🎯 Use Cases (easy to understand)

| Use Case | What you do with WorX | Outcome |
|:--|:--|:--|
| **Sales workflows** | Generate tools from CRM + billing APIs | Agents enrich deal pages in Notion automatically |
| **Support operations** | Generate tools from helpdesk/customer APIs | Agents fetch customer context before replying |
| **Internal automation** | Use your company OpenAPI spec | Turn internal endpoints into callable Notion tools |
| **Hackathon/demo builds** | Generate + deploy quickly from public specs | Ship API-connected agent demos in minutes |

## ⚙️ How it works

```text
OpenAPI Spec (URL/file)
        │
        ▼
   worx generate
        │
        ▼
Generated Worker Project
        │
        ▼
  ntn workers deploy
        │
        ▼
Notion Agent can call tools
```

## 🚀 Quick Start

```bash
npm install
npm run build
node dist/cli/index.js generate --spec ./openapi.json --output ./generated-worker
```

Remote spec example:

```bash
worx generate --spec https://api.example.com/openapi.json --output ./example-worker
```

Generate and deploy in one run:

```bash
worx generate --spec https://api.example.com/openapi.json --output ./example-worker --deploy
```

## 🧩 CLI Options

```bash
worx generate --spec <url|path> --output ./worker
```

| Option | Meaning |
|:--|:--|
| `--spec <url\|path>` | OpenAPI 3.x source URL or local file path |
| `--output <dir>` | Output directory for generated Worker project |
| `--filter <tags...>` | Generate only endpoints matching specific tags |
| `--dry-run` | Show generated files/counts without writing files |
| `--deploy` | Run `ntn workers deploy` after generation |

## 📦 What WorX generates

```text
your-worker/
├── src/index.ts        # generated worker.tool() blocks
├── .env.example        # placeholder secrets inferred from auth
├── worx.config.json    # metadata + skipped endpoint reasons
├── README.md           # generated tool list + instructions
├── package.json
└── tsconfig.json
```

## ✅ v1 Scope

WorX v1 focuses on reliable, practical coverage for OpenAPI REST APIs.

**Supported**
- OpenAPI `3.0.x` and `3.1.x`
- REST APIs with JSON bodies
- Path, query, and header parameters
- Auth: Bearer token, API key (header/query)
- Local `$ref` resolution (within same document)
- Common object/array/scalar schemas

**Known limitations**
- Remote `$ref` (external files/URLs) is not resolved
- OAuth2/OpenID flows need manual token handling
- Multipart/binary upload endpoints are skipped
- Deep nested objects are simplified
- Complex `oneOf`/`anyOf` are simplified
- XML-only endpoints are skipped

## 🛠️ Tech Stack

- TypeScript
- Node.js 20+
- Commander (CLI)
- Handlebars (code templates)
- OpenAPI parser (`@readme/openapi-parser`)

## 🧪 Development

```bash
npm install
npx tsc --noEmit
npm test
npm run build
```

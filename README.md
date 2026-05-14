# WorX

WorX converts OpenAPI 3.x REST API specs into deployable Notion Workers. Each supported endpoint becomes a `worker.tool()` callable by Notion AI agents through the Notion MCP server.

## Quickstart

```bash
npm install
npm run build
node dist/cli/index.js generate --spec ./openapi.json --output ./generated-worker
```

For a remote spec:

```bash
worx generate --spec https://api.example.com/openapi.json --output ./example-worker
```

## CLI

```bash
worx generate --spec <url|path> --output ./worker
```

Options:

- `--spec <url|path>`: OpenAPI 3.x source URL or local file path.
- `--output <dir>`: Output directory for the generated Worker project.
- `--filter <tags...>`: Only generate tools for matching OpenAPI tags.
- `--dry-run`: Print generated files and line counts without writing.
- `--deploy`: Run `ntn workers deploy` after generation.

## Generated Project

WorX writes:

- `src/index.ts`: Notion Worker source with generated `worker.tool()` blocks.
- `.env.example`: Inferred secret names.
- `worx.config.json`: Generation metadata and skipped endpoint reasons.
- `README.md`: Tool list and deployment instructions.
- `package.json` and `tsconfig.json`: Minimal Worker project metadata.

## Development

```bash
npm install
npx tsc --noEmit
npm test
npm run build
```

## v1 Scope

WorX v1 is optimized for OpenAPI 3.x REST APIs with standard JSON bodies and common
auth patterns. The following are known limitations in v1:

- **Remote $refs**: External file or URL $refs are not resolved. Local $refs (within
  the same document) work correctly.
- **OAuth2 / OpenID**: Generated Worker uses a Bearer token placeholder. You need to
  handle the OAuth flow and pass the resulting token as your secret.
- **File uploads**: Endpoints with multipart/form-data or binary request bodies are
  skipped. They appear in worx.config.json > skippedEndpoints.
- **Deeply nested schemas**: Object properties nested more than one level deep are
  emitted as a JSON string parameter with a description of the expected shape.
- **oneOf with 3+ divergent schemas**: The first schema is used. A description note
  lists the alternatives.
- **XML responses**: Endpoints that only return XML are skipped.

These limitations are intentional scope decisions for v1. PRs welcome.

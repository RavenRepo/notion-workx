# WorX

**WorX converts OpenAPI 3.x specs into Notion Worker tools.**

You give it a spec file/URL, and it generates a deployable TypeScript worker project where each supported endpoint is mapped to `worker.tool()`.

## What WorX does vs. `ntn`

| Tool | Role |
|---|---|
| `ntn` (Notion CLI) | Auth, build, deploy, run, and manage workers |
| **WorX** | Generate worker code from OpenAPI automatically |

WorX is the generation layer **on top of** the Notion runtime/tooling.

## Quick start

```bash
npm install
npm run build
node dist/cli/index.js generate --spec ./openapi.json --output ./generated-worker
```

Deploy generated worker:

```bash
cd ./generated-worker
npm install
npm run deploy:create
```

After `workers.json` exists:

```bash
npm run deploy
```

## CLI

```bash
worx generate --spec <url|path> --output ./worker
```

| Option | Meaning |
|---|---|
| `--spec <url\|path>` | OpenAPI 3.x source URL or local file path |
| `--output <dir>` | Output directory for generated worker project |
| `--filter <tags...>` | Generate only endpoints matching specific tags |
| `--dry-run` | Print output summary without writing files |
| `--deploy` | Run `ntn workers deploy` after generation |

## Generated output

```text
your-worker/
├── src/index.ts
├── .env.example
├── worx.config.json
├── README.md
├── package.json
└── tsconfig.json
```

## v1 scope

Supported:
- OpenAPI 3.0.x / 3.1.x
- REST APIs with `application/json` and `application/x-www-form-urlencoded` request bodies
- Path/query/header parameters
- Bearer and API key auth (header/query)
- Local `$ref` resolution
- Optional parameters via `.nullable()` schema fields
- Large optional-parameter sets (>7) via generated `optionalParamsJson`

Known limitations:
- Remote `$ref` is not resolved
- OAuth2 / OpenID requires manual token flow
- Multipart, binary, XML-only, and other unsupported content-type endpoints are skipped
- Deeply nested schemas are simplified
- Complex `oneOf` / `anyOf` are simplified

## Deployment notes

- Notion Workers must be enabled in your workspace.
- Notion enforces a max capability count per worker (currently 100).  
  If your API is large, split generation by tags using `--filter`.
- Fill `.env` and push secrets after first deploy:

```bash
cp .env.example .env
ntn workers env push --yes
```

## Development

```bash
npm install
npx tsc --noEmit
npm test
npm run build
```

## Open source docs

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [AGENTS.md](AGENTS.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)

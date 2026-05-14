# WorX — Product Requirements Document
### Complete Implementation Guide · v1.0 · Notion Developer Platform Hackathon

---

## 0. How to Use This Document

This PRD is written to be executed by Claude Code or a human developer without ambiguity.
Every file has an exact spec. Every algorithm has a step-by-step description.
Read sections 1–3 before writing any code. Execute sections 4–9 in order.

**Guiding constraint throughout**: v1 scope is "OpenAPI 3.x REST APIs with standard
parameter patterns." Do not chase universal parity. Ship something that works perfectly
on Stripe, HubSpot, and GitHub. Edge cases get documented, not silently broken.

---

## 1. Product Overview

### 1.1 What WorX Does

WorX reads an OpenAPI 3.x specification (via URL or local file) and outputs a fully
deployable Notion Worker — a TypeScript project where every API endpoint becomes a
`worker.tool()` callable by any Notion AI agent or Hermes subagent via Notion's MCP server.

### 1.2 Core Value Proposition

Every API with an OpenAPI spec is one command away from being callable by Notion agents:

```bash
worx generate --spec https://api.stripe.com/openapi.json --output ./stripe-worker
ntn workers deploy ./stripe-worker
```

### 1.3 Strategic Scope Constraints (Non-Negotiable)

These constraints are product decisions, not technical limitations. They exist to ensure
v1 ships with correct behavior, not broad but broken behavior.

**IN SCOPE — v1**
- OpenAPI 3.x (3.0.x and 3.1.x) specifications
- REST APIs with JSON request/response bodies
- Path parameters, query parameters, header parameters, requestBody (application/json)
- Auth patterns: Bearer token, API Key (header), API Key (query param)
- `$ref` resolution within the same document (local refs)
- `allOf` merging (merge all schemas into one flat object)
- Simple `oneOf` / `anyOf` (use the first schema, add a comment noting alternatives)
- Scalar types: string, number, integer, boolean
- Array of scalars and array of objects (one level deep)
- Object types (one level deep; nested objects flatten to string with a description note)

**OUT OF SCOPE — v1 (document, do not implement)**
- Remote `$ref` (external file or URL refs) → emit a TODO comment
- `oneOf` with 3+ schemas of different shapes → use first schema, log warning
- OAuth2 / OpenID Connect flows → emit placeholder tool with instructions comment
- Multipart/form-data, binary uploads, file streams → skip endpoint, log warning
- Circular `$ref` chains → detect, skip, log error
- XML response bodies → skip endpoint, log warning
- GraphQL, gRPC, WebSocket → not OpenAPI, exit with clear error message

### 1.4 What Gets Generated

For each valid endpoint in the spec, WorX generates one `worker.tool()` block:

```typescript
worker.tool("getCustomerById", {
  title: "Retrieve a Customer",
  description: "Fetches a single customer record by their unique ID.",
  schema: j.object({
    customerId: j.string().describe("The customer's unique identifier"),
    expand: j.array(j.string()).describe("Fields to expand in the response").optional(),
  }),
  execute: async ({ customerId, expand }, { secrets }) => {
    const url = new URL(`${BASE_URL}/customers/${customerId}`);
    if (expand) expand.forEach(e => url.searchParams.append("expand[]", e));
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${secrets.API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`API error ${res.status}: ${error}`);
    }
    return res.json();
  },
});
```

---

## 2. File Structure

```
worx/
├── src/
│   ├── cli/
│   │   └── index.ts              # CLI entry point (commander)
│   ├── parser/
│   │   ├── openapi.ts            # Spec loading, validation, $ref resolution
│   │   └── schema-mapper.ts      # OAS Schema → Notion Worker JSON Schema
│   ├── generator/
│   │   ├── tool-builder.ts       # Endpoint → ToolDefinition (pure data transform)
│   │   ├── auth-detector.ts      # SecurityScheme → AuthConfig
│   │   ├── code-writer.ts        # ToolDefinition[] → TypeScript source string
│   │   └── templates/
│   │       ├── worker.hbs        # Full src/index.ts template
│   │       └── readme.hbs        # README.md template
│   ├── deploy/
│   │   └── ntn.ts                # Shell wrapper for `ntn workers deploy`
│   └── types.ts                  # All shared TypeScript interfaces
├── examples/
│   ├── stripe-worker/            # Pre-generated example (committed output)
│   └── hubspot-worker/           # Pre-generated example (committed output)
├── skills/
│   └── worx-deploy/
│       └── SKILL.md              # Hermes skill for mid-task Worker deployment
├── test/
│   ├── fixtures/
│   │   ├── simple.openapi.json   # Minimal valid spec (3 endpoints)
│   │   ├── stripe.openapi.json   # Stripe spec snapshot (for offline testing)
│   │   └── edge-cases.openapi.json # allOf, oneOf, $ref, optional params
│   ├── parser.test.ts
│   ├── schema-mapper.test.ts
│   ├── tool-builder.test.ts
│   └── code-writer.test.ts
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## 3. Shared Types (`src/types.ts`)

Define all interfaces here. Every other file imports from this file.
Never define interfaces inline in implementation files.

```typescript
// src/types.ts

export interface WorxConfig {
  specUrl?: string;
  specFile?: string;
  outputDir: string;
  filter?: string[];       // OAS tag names to include; empty = include all
  dryRun: boolean;
  groupByTag: boolean;     // if true, group tools by OAS tag in output
}

// The raw OAS spec after loading (we don't need the full OAS type tree,
// just the fields we actually use)
export interface ResolvedSpec {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItem>;
  components?: {
    securitySchemes?: Record<string, SecurityScheme>;
    schemas?: Record<string, OASSchema>;
  };
  security?: SecurityRequirement[];
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: Parameter[];  // shared path-level params
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  security?: SecurityRequirement[];
  deprecated?: boolean;
  'x-worx-skip'?: boolean;  // escape hatch: set true in spec to skip this endpoint
}

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: OASSchema;
  deprecated?: boolean;
}

export interface RequestBody {
  required?: boolean;
  content: {
    'application/json'?: {
      schema?: OASSchema;
    };
    [key: string]: unknown;  // other content types we ignore
  };
}

export interface OASSchema {
  type?: string;
  format?: string;
  description?: string;
  enum?: unknown[];
  items?: OASSchema;
  properties?: Record<string, OASSchema>;
  required?: string[];
  allOf?: OASSchema[];
  oneOf?: OASSchema[];
  anyOf?: OASSchema[];
  $ref?: string;
  nullable?: boolean;
  default?: unknown;
  example?: unknown;
  deprecated?: boolean;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  scheme?: string;       // 'bearer' | 'basic' for type=http
  in?: 'header' | 'query' | 'cookie';  // for type=apiKey
  name?: string;         // header/query param name for apiKey
  description?: string;
}

export type SecurityRequirement = Record<string, string[]>;

// ─── Output of the transform layer ───────────────────────────────────────────

export interface ToolParam {
  name: string;            // camelCase parameter name
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  itemType?: string;       // for type=array: the item type
  description: string;
  required: boolean;
  location: 'path' | 'query' | 'header' | 'body';
  originalName: string;   // original param name before camelCase (for URL building)
  deprecated: boolean;
}

export interface ToolDefinition {
  name: string;            // camelCase tool name (from operationId or generated)
  title: string;           // human-readable (from summary)
  description: string;     // from operation.description or summary
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  pathTemplate: string;   // e.g. "/customers/{customerId}"
  params: ToolParam[];
  auth: AuthConfig;
  tags: string[];
  deprecated: boolean;
  skipped: false;
}

export interface SkippedEndpoint {
  method: string;
  path: string;
  reason: string;
  skipped: true;
}

export type EndpointResult = ToolDefinition | SkippedEndpoint;

export type AuthType = 'bearer' | 'apikey_header' | 'apikey_query' | 'none' | 'unsupported';

export interface AuthConfig {
  type: AuthType;
  secretName: string;     // e.g. "API_KEY" — the secrets key to use
  headerName?: string;    // for apikey_header: the header name
  queryParamName?: string; // for apikey_query: the query param name
}

export interface GeneratorOutput {
  tools: ToolDefinition[];
  skipped: SkippedEndpoint[];
  auth: AuthConfig;
  baseUrl: string;
  apiTitle: string;
  apiVersion: string;
}
```

---

## 4. Parser Layer

### 4.1 `src/parser/openapi.ts`

**Responsibility**: Load a spec from URL or file path, validate it is OpenAPI 3.x,
resolve all local `$ref`s inline, and return a `ResolvedSpec`.

**Implementation spec**:

```typescript
import SwaggerParser from '@readme/openapi-parser';
import { ResolvedSpec } from '../types';

/**
 * Load and resolve an OpenAPI 3.x spec.
 *
 * @param source - URL string or local file path
 * @returns Fully resolved spec with all local $refs replaced inline
 * @throws Error with descriptive message if spec is invalid or not OAS 3.x
 */
export async function loadSpec(source: string): Promise<ResolvedSpec> {
  // Step 1: Parse (validates structure)
  // Step 2: Dereference (resolves $refs inline)
  // Step 3: Validate version is 3.x
  // Step 4: Return typed result
}
```

**Algorithm**:

1. Call `SwaggerParser.dereference(source)` — this both parses and resolves all local `$ref`s. The returned object has every `$ref` replaced with the actual schema object inline.
2. Check that `api.openapi` starts with `"3."`. If not, throw: `"WorX requires OpenAPI 3.x. This spec appears to be version ${api.swagger ?? api.openapi ?? 'unknown'}."`.
3. If `api.servers` is empty or missing, default to `[{ url: 'https://api.example.com' }]` and print a warning: `"No servers found in spec. Defaulting to https://api.example.com — update BASE_URL in the generated Worker."`.
4. Cast and return as `ResolvedSpec`.

**Error handling**: Wrap the whole function in try/catch. If `SwaggerParser.dereference` throws, check the message for common patterns:
- "ENOENT" → "Spec file not found: {source}"
- "ECONNREFUSED" or "fetch failed" → "Could not fetch spec from {source}. Check the URL and your network."
- Otherwise re-throw with the original message prefixed by "Failed to parse spec: ".

**Dependencies to install**:
```
@readme/openapi-parser
```

---

### 4.2 `src/parser/schema-mapper.ts`

**Responsibility**: Convert an `OASSchema` object into a `ToolParam` type descriptor
that the code generator can use to emit `j.string()`, `j.number()`, etc.

This is the most complex file. Read it carefully.

**The mapping table**:

| OAS type + format | ToolParam type | Notes |
|---|---|---|
| `string` (any format) | `string` | format (date, email, uuid) goes in description |
| `integer` | `number` | |
| `number` | `number` | |
| `boolean` | `boolean` | |
| `array` with scalar `items` | `array` | itemType = the scalar type |
| `array` with object `items` | `array` | itemType = `'object'`, add note in description |
| `object` | `object` | Flatten one level: describe properties in description text |
| `allOf` | merge all schemas | See algorithm below |
| `oneOf` / `anyOf` | use first schema | Add to description: "Note: accepts multiple shapes, using first" |
| missing / unknown | `string` | Default to string, add: "Note: type could not be inferred" |

**`allOf` merge algorithm**:

1. For each schema in the `allOf` array, call `resolveSchema(schema)` recursively.
2. Collect all `properties` from all resolved schemas into one merged `properties` map.
3. Collect all `required` arrays and union them.
4. Return a synthetic `OASSchema` with `type: 'object'`, merged `properties`, and merged `required`.

**`$ref` handling**: By the time schemas reach the mapper, `$ref`s are already resolved by `SwaggerParser.dereference`. If you encounter a `$ref` in the mapper anyway (shouldn't happen), return type `string` with a description note.

**Public API of this file**:

```typescript
/**
 * Convert an OAS parameter (path, query, header) into a ToolParam.
 */
export function mapParameter(param: Parameter): ToolParam

/**
 * Convert a requestBody's JSON schema into an array of ToolParams
 * (one per top-level property in the body object).
 * If the body is not a JSON object schema, returns a single ToolParam
 * named "body" of type string with a description.
 */
export function mapRequestBody(body: RequestBody): ToolParam[]

/**
 * Internal: resolve an OASSchema to a { type, itemType, description } tuple.
 * Used by both mapParameter and mapRequestBody.
 */
function resolveSchema(schema: OASSchema): { type: ToolParam['type']; itemType?: string; descriptionSuffix: string }
```

**Naming convention**: Parameter names from OAS may be `snake_case`, `kebab-case`,
`PascalCase`, or `camelCase`. Normalize all to `camelCase` for the TypeScript output.
Store `originalName` as-is (used in URL building and header setting).

**camelCase function**:
```typescript
function toCamelCase(s: string): string {
  return s
    .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, c => c.toLowerCase());
}
```

---

## 5. Generator Layer

### 5.1 `src/generator/auth-detector.ts`

**Responsibility**: Inspect the spec's `securitySchemes` and the global/operation-level
`security` requirements, and return an `AuthConfig`.

**Algorithm**:

1. If the spec has no `components.securitySchemes`, return `{ type: 'none', secretName: '' }`.
2. Find the first security scheme that is referenced by the spec-level `security` array (or the first scheme in `securitySchemes` if no global security is declared).
3. Map it:
   - `type: 'http'` + `scheme: 'bearer'` → `AuthType = 'bearer'`, `secretName = 'API_KEY'`
   - `type: 'apiKey'` + `in: 'header'` → `AuthType = 'apikey_header'`, `headerName = scheme.name`, `secretName = toScreamingSnake(scheme.name) + '_KEY'`
   - `type: 'apiKey'` + `in: 'query'` → `AuthType = 'apikey_query'`, `queryParamName = scheme.name`, `secretName = toScreamingSnake(scheme.name) + '_KEY'`
   - `type: 'oauth2'` or `type: 'openIdConnect'` → `AuthType = 'unsupported'`, `secretName = 'ACCESS_TOKEN'`, log warning: "OAuth2/OpenID detected. Generated Worker uses Bearer token placeholder — replace with your OAuth flow."
   - Anything else → `AuthType = 'none'`

**`toScreamingSnake` function**:
```typescript
function toScreamingSnake(s: string): string {
  return s.replace(/[-\s]/g, '_').toUpperCase();
}
```

---

### 5.2 `src/generator/tool-builder.ts`

**Responsibility**: Iterate every path + method in the spec and produce an array of
`EndpointResult` (either `ToolDefinition` or `SkippedEndpoint`).

**Public API**:

```typescript
export function buildTools(spec: ResolvedSpec, config: WorxConfig): EndpointResult[]
```

**Algorithm** (for each path + method combination):

1. **Skip check**: If `operation['x-worx-skip'] === true`, push `SkippedEndpoint` with reason "x-worx-skip flag set".
2. **Deprecation check**: If `operation.deprecated === true`, still generate the tool but set `deprecated: true` — the template will add a `@deprecated` JSDoc comment.
3. **Tag filter**: If `config.filter` is non-empty, skip operations whose `tags` array has no overlap with `config.filter`.
4. **Skip unsupported content types**: If `requestBody` exists but has no `application/json` content key, push `SkippedEndpoint` with reason "Non-JSON requestBody (multipart, binary, etc.)".
5. **Merge parameters**: Combine path-level `parameters` (from the `PathItem`) and operation-level `parameters`. Operation-level takes precedence (deduplicate by `name` + `in`).
6. **Filter out cookie params**: Skip cookie parameters (not useful in Worker context). Log a warning listing the skipped param names.
7. **Build `ToolParam[]`**: Call `mapParameter` for each non-cookie parameter, then `mapRequestBody` for the requestBody if present.
8. **Generate tool name**:
   - If `operationId` exists: convert to camelCase, sanitize (remove special chars). Use it.
   - If no `operationId`: generate from `{method}{PathWords}` — e.g. `GET /customers/{id}` → `getCustomersById`. Strip `{`, `}` from path words, join with title case.
9. **Dedup names**: If two tools would have the same name, append `_2`, `_3`, etc.
10. **Title**: `operation.summary ?? generatedTitle` where `generatedTitle` is a human-readable version of the generated name.
11. **Description**: `operation.description ?? operation.summary ?? title`. Max 200 chars — truncate with `...` if longer.
12. **Auth**: Pass the spec-level `AuthConfig` (computed once by `auth-detector.ts` and passed in). Operation-level security overrides are out of scope for v1.

---

### 5.3 `src/generator/code-writer.ts`

**Responsibility**: Take a `GeneratorOutput` and produce the actual file contents
(TypeScript source string, `.env.example` string, `worx.config.json` string, `README.md` string).

Do **not** use Handlebars for the TypeScript output — write it as a template literal
in TypeScript. This avoids whitespace/indentation issues that are common with Handlebars
and TypeScript. Use Handlebars only for the README.

**Public API**:

```typescript
export interface WriterOutput {
  indexTs: string;          // src/index.ts content
  envExample: string;       // .env.example content
  worxConfig: string;       // worx.config.json content
  readmeMd: string;         // README.md content
}

export function writeCode(output: GeneratorOutput, config: WorxConfig): WriterOutput
```

**`indexTs` structure** (write exactly in this order):

```
1. File header comment (generated by WorX, do not edit manually, spec title + version)
2. Import block:
   import { Worker } from "@notionhq/workers";
   import * as j from "@notionhq/workers/schema";
3. Empty line
4. const worker = new Worker();
5. Empty line
6. const BASE_URL = "{first server URL from spec}";
7. Empty line
8. One worker.tool() block per ToolDefinition (see tool block spec below)
9. Empty line
10. export default worker;
```

**Tool block spec** (for each `ToolDefinition`):

```typescript
// {title}
// {description}
// {if deprecated: @deprecated — this endpoint is marked deprecated in the spec}
worker.tool("{name}", {
  title: "{title}",
  description: "{description}",
  schema: j.object({
    {for each required param}: {camelName}: {jType}().describe("{description}"),
    {for each optional param}: {camelName}: {jType}().describe("{description}").optional(),
  }),
  execute: async ({ {paramNames} }, { secrets }) => {
    {URL building block}
    {headers block}
    {body block if POST/PUT/PATCH}
    const res = await fetch({urlVar}, {
      method: "{METHOD}",
      headers,
    });
    if (!res.ok) {
      const error = await res.text().catch(() => res.statusText);
      throw new Error(`{name} failed with status ${res.status}: ${error}`);
    }
    return res.json();
  },
});
```

**URL building block** (emit based on params):

```typescript
// If there are path params:
const url = new URL(`${BASE_URL}{pathTemplate}`
  .replace("{originalName}", String({camelName}))  // one line per path param
);

// If there are query params:
{for each query param that is required}:
url.searchParams.set("{originalName}", String({camelName}));
{for each query param that is optional}:
if ({camelName} !== undefined) url.searchParams.set("{originalName}", String({camelName}));

// If no params at all:
const url = new URL(`${BASE_URL}{pathTemplate}`);
```

**Headers block** (emit based on auth type):

```typescript
// bearer:
const headers: Record<string, string> = {
  "Authorization": `Bearer ${secrets.API_KEY}`,
  "Content-Type": "application/json",
};

// apikey_header:
const headers: Record<string, string> = {
  "{headerName}": secrets.{secretName},
  "Content-Type": "application/json",
};

// apikey_query:
url.searchParams.set("{queryParamName}", secrets.{secretName});
const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

// none:
const headers: Record<string, string> = {
  "Content-Type": "application/json",
};
```

**Body block** (for POST/PUT/PATCH with body params):

```typescript
const body = JSON.stringify({
  {for each body param that is required}: {originalName}: {camelName},
  {for each body param that is optional}: ...({camelName} !== undefined ? { {originalName}: {camelName} } : {}),
});
// Add body to fetch call: body: body
```

**jType mapping** (OAS ToolParam type → j.xxx() call):

| ToolParam type | itemType | jType() expression |
|---|---|---|
| `string` | — | `j.string()` |
| `number` | — | `j.number()` |
| `boolean` | — | `j.boolean()` |
| `array` | `string` | `j.array(j.string())` |
| `array` | `number` | `j.array(j.number())` |
| `array` | `boolean` | `j.array(j.boolean())` |
| `array` | `object` | `j.array(j.string())` with describe note "JSON string per item" |
| `object` | — | `j.string()` with describe note "JSON object as string" |

**`envExample` format**:

```
# WorX generated — {apiTitle} v{apiVersion}
# Copy to .env and fill in your values

{secretName}=your_{secretName_lowercase}_here

# Base URL (update if needed)
# WORX_BASE_URL=https://api.example.com
```

**`worxConfig` format** (JSON):

```json
{
  "generatedAt": "{ISO timestamp}",
  "specSource": "{source URL or filename}",
  "apiTitle": "{title}",
  "apiVersion": "{version}",
  "toolCount": 42,
  "skippedCount": 3,
  "auth": {
    "type": "bearer",
    "secretName": "API_KEY"
  },
  "filter": [],
  "skippedEndpoints": [
    { "method": "POST", "path": "/files/upload", "reason": "Non-JSON requestBody" }
  ]
}
```

**`readmeMd`**: Use the Handlebars template at `src/generator/templates/readme.hbs`.
Pass the full `GeneratorOutput` as the template context.

---

### 5.4 `src/generator/templates/readme.hbs`

```handlebars
# {{apiTitle}} — Notion Worker

Generated by [WorX](https://github.com/growthperclick/worx) from the {{apiTitle}} v{{apiVersion}} OpenAPI spec.

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Copy `.env.example` to `.env` and fill in your credentials:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Deploy to Notion Workers:
   \`\`\`bash
   ntn workers deploy
   \`\`\`

## Available Tools ({{toolCount}})

{{#each tools}}
### `{{name}}`

{{description}}

**Parameters:**
{{#each params}}
- `{{name}}` ({{type}}{{#unless required}}, optional{{/unless}}): {{description}}
{{/each}}

---
{{/each}}

{{#if skipped}}
## Skipped Endpoints ({{skippedCount}})

The following endpoints were not generated. See `worx.config.json` for details.

{{#each skipped}}
- `{{method}} {{path}}` — {{reason}}
{{/each}}
{{/if}}

## Auth

This Worker uses **{{auth.type}}** authentication.
Set `{{auth.secretName}}` in your `.env` file.

## Regenerating

\`\`\`bash
worx generate --spec {{specSource}} --output .
\`\`\`
```

---

## 6. CLI (`src/cli/index.ts`)

### 6.1 Implementation

Use `commander` for argument parsing. The CLI has one command: `generate`.

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs/promises';
import { loadSpec } from '../parser/openapi';
import { buildTools } from '../generator/tool-builder';
import { detectAuth } from '../generator/auth-detector';
import { writeCode } from '../generator/code-writer';
import { deployWorker } from '../deploy/ntn';
import { WorxConfig } from '../types';

const program = new Command();

program
  .name('worx')
  .description('Generate Notion Worker tools from OpenAPI specs')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a Notion Worker from an OpenAPI spec')
  .requiredOption('--spec <url|path>', 'OpenAPI 3.x spec URL or file path')
  .option('--output <dir>', 'Output directory for generated Worker', './worx-output')
  .option('--filter <tags...>', 'Only generate tools for these OAS tags')
  .option('--dry-run', 'Print what would be generated without writing files', false)
  .option('--deploy', 'Run ntn workers deploy after generating', false)
  .action(async (options) => {
    // See algorithm below
  });

program.parse();
```

### 6.2 `generate` action algorithm

```
1. Print header: "WorX v1.0 · Generating Worker from {spec}"

2. Build WorxConfig from options.

3. Call loadSpec(options.spec).
   On error: print error message in red, exit 1.

4. Print: "✓ Spec loaded: {apiTitle} v{apiVersion} — {path count} paths"

5. Call detectAuth(spec).
   Print: "✓ Auth: {authType} ({secretName})"
   If authType = 'unsupported': print warning in yellow.

6. Call buildTools(spec, config).
   Print: "✓ Endpoints analyzed: {tools.length} tools, {skipped.length} skipped"
   If skipped.length > 0: print each skipped endpoint with its reason (yellow).

7. Build GeneratorOutput object.

8. Call writeCode(output, config).

9. If dry-run:
   Print each file that would be written with its line count.
   Print: "Dry run complete. No files written."
   Exit 0.

10. Create output directory (mkdir -p).

11. Write files:
    - {outputDir}/src/index.ts
    - {outputDir}/.env.example
    - {outputDir}/worx.config.json
    - {outputDir}/README.md
    - {outputDir}/package.json  (see below)
    - {outputDir}/tsconfig.json  (see below)
    Print "✓ Written: {filename}" for each file.

12. If --deploy flag:
    Call deployWorker(outputDir).
    Print result.

13. Print summary:
    "
    ✓ Done! {toolCount} tools generated in {outputDir}
    
    Next steps:
      1. cd {outputDir}
      2. cp .env.example .env  (fill in {secretName})
      3. npm install
      4. ntn workers deploy
    "
```

### 6.3 Generated `package.json` (written to output dir)

```json
{
  "name": "{kebab-case apiTitle}-worker",
  "version": "0.1.0",
  "description": "Notion Worker for {apiTitle} — generated by WorX",
  "main": "src/index.ts",
  "scripts": {
    "deploy": "ntn workers deploy",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@notionhq/workers": "latest"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### 6.4 Generated `tsconfig.json` (written to output dir)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

---

## 7. Deploy Wrapper (`src/deploy/ntn.ts`)

### 7.1 Implementation

```typescript
import { execSync } from 'child_process';
import path from 'path';

/**
 * Run `ntn workers deploy` in the given directory.
 * Returns stdout on success, throws on failure.
 */
export async function deployWorker(outputDir: string): Promise<string> {
  const absPath = path.resolve(outputDir);

  // Check ntn is installed
  try {
    execSync('ntn --version', { stdio: 'pipe' });
  } catch {
    throw new Error(
      'ntn CLI not found. Install it with: npm install -g ntn\n' +
      'Then run: ntn workers deploy ' + absPath
    );
  }

  try {
    const result = execSync(`ntn workers deploy`, {
      cwd: absPath,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return result;
  } catch (err: any) {
    throw new Error(`Deploy failed:\n${err.stdout ?? ''}\n${err.stderr ?? ''}`);
  }
}
```

---

## 8. `package.json` (root — the worx CLI package)

```json
{
  "name": "worx",
  "version": "1.0.0",
  "description": "Generate Notion Worker tools from OpenAPI specs",
  "bin": {
    "worx": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/cli/index.ts",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@readme/openapi-parser": "^3.0.0",
    "commander": "^12.0.0",
    "handlebars": "^4.7.8"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0",
    "@types/handlebars": "^4.1.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## 9. `tsconfig.json` (root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

---

## 10. Tests

Write tests using Vitest. Run: `npm test`.

### 10.1 `test/parser.test.ts`

```
Test 1: loadSpec() with a valid local OpenAPI 3.0 file → returns ResolvedSpec
Test 2: loadSpec() with a valid local OpenAPI 3.1 file → returns ResolvedSpec
Test 3: loadSpec() with a Swagger 2.0 file → throws with version error message
Test 4: loadSpec() with a non-existent file → throws with "file not found" message
Test 5: loadSpec() resolves local $ref correctly → referenced schema appears inline
```

### 10.2 `test/schema-mapper.test.ts`

```
Test 1: string param → type: 'string'
Test 2: integer param → type: 'number'
Test 3: array of strings → type: 'array', itemType: 'string'
Test 4: allOf with two objects → merged into one object schema
Test 5: oneOf → uses first schema, description includes "accepts multiple shapes" note
Test 6: snake_case param name → camelCase in output, originalName preserved
Test 7: kebab-case param name → camelCase in output
Test 8: required flag correctly propagated from both param.required and schema.required
Test 9: requestBody with JSON object → ToolParam[] with one entry per property
Test 10: requestBody with non-JSON content → single body param of type string
```

### 10.3 `test/tool-builder.test.ts`

```
Test 1: operation with operationId → tool name matches camelCase operationId
Test 2: operation without operationId → name generated from method + path
Test 3: operation with x-worx-skip → SkippedEndpoint returned
Test 4: operation with deprecated:true → ToolDefinition with deprecated:true
Test 5: operation with multipart requestBody → SkippedEndpoint with reason
Test 6: path-level params merged with operation params → all appear in ToolParam[]
Test 7: path-level params overridden by operation params (same name+in) → deduped
Test 8: tag filter applied → only matching operations included
Test 9: two operations generate same name → second gets _2 suffix
```

### 10.4 `test/code-writer.test.ts`

```
Test 1: simple GET with path param → generated TypeScript compiles without error
Test 2: POST with JSON body → body block emitted in execute function
Test 3: bearer auth → Authorization: Bearer ${secrets.API_KEY} in headers
Test 4: apikey_header auth → correct header name and secret key
Test 5: optional param → .optional() appended in schema, undefined guard in URL building
Test 6: deprecated tool → @deprecated JSDoc comment emitted
Test 7: toolCount in worxConfig matches number of ToolDefinitions
Test 8: .env.example contains correct secret name
```

**Fixture: `test/fixtures/simple.openapi.json`**

Write a minimal valid OpenAPI 3.0.3 spec with exactly:
- 1 GET endpoint with a path param (required) and a query param (optional)
- 1 POST endpoint with a JSON requestBody (2 properties, 1 required)
- 1 DELETE endpoint with a path param
- Bearer auth
- One server URL

---

## 11. Hermes Integration (`skills/worx-deploy/SKILL.md`)

```markdown
# worx-deploy Skill

## Purpose
Deploy a new Notion Worker from an OpenAPI spec mid-task.
Use when you encounter an API you need to call but no Worker tools exist for it yet.

## When to Use
- You need to call an external REST API
- No worker.tool() exists for that API
- The API has a publicly accessible OpenAPI spec

## Steps

1. Find the OpenAPI spec URL for the API you need.
   - Common locations: {domain}/openapi.json, {domain}/swagger.json,
     docs.{domain}/api/openapi.yaml, or the API's developer documentation.

2. Run the WorX generator:
   \`\`\`bash
   worx generate --spec {spec_url} --output /tmp/{api_name}-worker --deploy
   \`\`\`

3. Confirm deployment succeeded. The tools are now available via Notion MCP.

4. Call the tools using the Notion MCP server:
   - Tool names follow camelCase operationId convention
   - Check /tmp/{api_name}-worker/README.md for the full tool list

## Constraints
- Requires worx CLI installed: npm install -g worx
- Requires ntn CLI installed: npm install -g ntn
- Requires NOTION_WORKER_TOKEN in environment
- Only works for OpenAPI 3.x REST APIs with JSON bodies
- OAuth2 APIs need manual token setup first

## Example

Task: "Fetch open issues from the Linear API"

\`\`\`bash
worx generate --spec https://api.linear.app/graphql/openapi.json \
  --output /tmp/linear-worker \
  --deploy
\`\`\`
Then call: notion_mcp.getIssues({ teamId: "TEAM_ID", state: "open" })
```

---

## 12. Build & Verification Order

Execute in this exact order to verify the implementation is correct end-to-end:

```bash
# 1. Install dependencies
npm install

# 2. Type check (must pass with 0 errors)
npx tsc --noEmit

# 3. Run tests (all must pass)
npm test

# 4. Build
npm run build

# 5. Smoke test with a real spec
node dist/cli/index.js generate \
  --spec https://petstore3.swagger.io/api/v3/openapi.json \
  --output /tmp/petstore-worker \
  --dry-run

# 6. Full generate (writes files)
node dist/cli/index.js generate \
  --spec https://petstore3.swagger.io/api/v3/openapi.json \
  --output /tmp/petstore-worker

# 7. Verify output compiles
cd /tmp/petstore-worker && npm install && npx tsc --noEmit

# 8. If ntn is available: deploy
ntn workers deploy
```

Steps 1–7 must all pass before the hackathon demo. Step 8 is the live demo moment.

---

## 13. Known Limitations to Document (Not Fix)

Add this section verbatim to the root `README.md`:

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
```

---

## 14. Demo Script (Verbatim)

Use this exact script for the Loom recording:

**Setup before recording**:
- Terminal: large font (18pt+), dark background
- Browser tab open to Notion workspace with a blank database named "Deal Enrichment Tasks"
- Hermes running locally (or show config)
- `worx` installed globally

```
[00:00] Show a raw HubSpot OpenAPI JSON in browser. Scroll to show 80+ endpoints.
        Narrate: "This is HubSpot's OpenAPI spec. 89 endpoints. Without WorX, each
        one needs a hand-written Notion Worker tool."

[00:30] Switch to terminal. Type:
        worx generate --spec https://api.hubapi.com/openapi --output ./hubspot-worker
        
        Watch the output: spec loaded → auth detected → 89 tools → files written.
        
[00:55] Type:
        ntn workers deploy ./hubspot-worker
        
        Deploy succeeds. Switch to Notion — show 89 tools in the agent tool list.

[01:15] Switch to Notion workspace. Open the "Deal Enrichment Tasks" database.
        Create a new page. In the body, type: @Hermes
        Then type: "Pull the 5 most recently closed deals from HubSpot, get the 
        Stripe invoice for each, and add a summary row here for each deal."

[01:40] Watch Hermes respond in the page. Show the task decomposition:
        - Subagent 1: getRecentDeals (HubSpot) ← WorX-generated tool
        - Subagent 2: getInvoice (Stripe) ← WorX-generated tool
        - Subagent 3: write rows to Notion database ← native Notion MCP

[02:10] Show the completed rows in the Notion database. 5 deal rows with enriched data.

[02:30] Close with: "Any API with an OpenAPI spec is now one command away from being
        callable by any Notion agent. WorX is the bridge between the existing API 
        economy and Notion's multi-agent runtime."
```

---

## 15. Submission Checklist

- [ ] `npm test` passes (all test suites green)
- [ ] `npx tsc --noEmit` passes (zero type errors)
- [ ] `worx generate --spec {petstore}` produces output that compiles
- [ ] `ntn workers deploy` succeeds on generated output
- [ ] Hermes demo: end-to-end task completes in Notion
- [ ] Loom video recorded (under 3 minutes, follows script in section 14)
- [ ] Root `README.md` includes v1 scope/limitations section
- [ ] `worx.config.json` in generated output lists all skipped endpoints with reasons
- [ ] Public GitHub repo: `github.com/growthperclick/worx`
- [ ] `npm publish` (or `npx worx generate` works via npx)
- [ ] Submitted to Notion hackathon portal before May 17 EOD IST
```

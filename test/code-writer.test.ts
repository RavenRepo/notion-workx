import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { writeCode } from "../src/generator/code-writer";
import { AuthConfig, GeneratorOutput, ToolDefinition, WorxConfig } from "../src/types";

describe("writeCode", () => {
  it("generates TypeScript for a simple GET with a path param", () => {
    const files = writeCode(output([tool({
      name: "getCustomer",
      method: "GET",
      pathTemplate: "/customers/{id}",
      params: [
        {
          name: "id",
          type: "string",
          description: "Customer ID",
          required: true,
          location: "path",
          originalName: "id",
          deprecated: false,
        },
      ],
    })]), config());

    expect(() => assertTypeScriptCompiles(files.indexTs)).not.toThrow();
  });

  it("emits a body block for POST JSON body params", () => {
    const files = writeCode(output([tool({
      name: "createCustomer",
      method: "POST",
      pathTemplate: "/customers",
      params: [
        {
          name: "email",
          type: "string",
          description: "Email",
          required: true,
          location: "body",
          originalName: "email",
          deprecated: false,
        },
        {
          name: "name",
          type: "string",
          description: "Name",
          required: false,
          location: "body",
          originalName: "name",
          deprecated: false,
        },
      ],
    })]), config());

    expect(files.indexTs).toContain("const body = JSON.stringify");
    expect(files.indexTs).toContain('"email": email');
    expect(files.indexTs).toContain('...(name !== undefined ? { "name": name } : {})');
  });

  it("emits bearer auth headers", () => {
    const files = writeCode(output([tool()], configAuth("bearer", "API_KEY")), config());

    expect(files.indexTs).toContain('"Authorization": `Bearer ${requireSecret("API_KEY")}`');
  });

  it("emits api key header auth", () => {
    const auth: AuthConfig = {
      type: "apikey_header",
      secretName: "X_API_KEY_KEY",
      headerName: "X-API-Key",
    };
    const files = writeCode(output([tool({ auth })], auth), config());

    expect(files.indexTs).toContain('"X-API-Key": requireSecret("X_API_KEY_KEY")');
  });

  it("emits optional params in schema and guards query params", () => {
    const files = writeCode(output([tool({
      params: [
        {
          name: "limit",
          type: "number",
          description: "Limit",
          required: false,
          location: "query",
          originalName: "limit",
          deprecated: false,
        },
      ],
    })]), config());

    expect(files.indexTs).toContain('limit: j.number().describe("Limit")');
    expect(files.indexTs).toContain('if (limit !== undefined) url.searchParams.set("limit", String(limit));');
  });

  it("emits deprecated comments", () => {
    const files = writeCode(output([tool({ deprecated: true })]), config());

    expect(files.indexTs).toContain("@deprecated This endpoint is marked deprecated in the spec.");
  });

  it("writes matching tool counts to worx.config.json", () => {
    const files = writeCode(output([tool({ name: "first" }), tool({ name: "second" })]), config());
    const parsed = JSON.parse(files.worxConfig) as { toolCount: number };

    expect(parsed.toolCount).toBe(2);
  });

  it("includes inferred secrets in .env.example", () => {
    const files = writeCode(output([tool()], configAuth("bearer", "API_KEY")), config());

    expect(files.envExample).toContain("API_KEY=your_api_key_here");
  });
});

function output(
  tools: ToolDefinition[],
  auth: AuthConfig = configAuth("bearer", "API_KEY"),
): GeneratorOutput {
  return {
    tools,
    skipped: [],
    auth,
    baseUrl: "https://api.test",
    apiTitle: "Test API",
    apiVersion: "1.0.0",
  };
}

function tool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: "listCustomers",
    title: "List customers",
    description: "List customers.",
    method: "GET",
    pathTemplate: "/customers",
    params: [],
    auth: configAuth("bearer", "API_KEY"),
    tags: [],
    deprecated: false,
    skipped: false,
    ...overrides,
  };
}

function configAuth(type: AuthConfig["type"], secretName: string): AuthConfig {
  return {
    type,
    secretName,
  };
}

function config(): WorxConfig {
  return {
    specFile: "test/fixtures/simple.openapi.json",
    outputDir: "/tmp/worx",
    filter: [],
    dryRun: false,
    groupByTag: false,
  };
}

function assertTypeScriptCompiles(source: string): void {
  const tempDir = mkdtempSync(path.join(tmpdir(), "worx-code-writer-"));
  const sourceDir = path.join(tempDir, "src");
  const workerTypesDir = path.join(tempDir, "node_modules/@notionhq/workers");
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(workerTypesDir, { recursive: true });
  writeFileSync(path.join(sourceDir, "index.ts"), source, "utf8");
  writeFileSync(
    path.join(workerTypesDir, "index.d.ts"),
    "export interface Schema { describe(value: string): Schema; nullable(): Schema; }\nexport const j: { string(): Schema; number(): Schema; boolean(): Schema; array(value: Schema): Schema; object(value: Record<string, Schema>): Schema; };\nexport class Worker { tool(name: string, definition: { execute: (input: any, context: unknown) => unknown; [key: string]: unknown }): void; }\n",
    "utf8",
  );
  writeFileSync(
    path.join(tempDir, "globals.d.ts"),
    "declare const process: { env: Record<string, string | undefined> };\n",
    "utf8",
  );

  const program = ts.createProgram([path.join(sourceDir, "index.ts"), path.join(tempDir, "globals.d.ts")], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(
      diagnostics
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
        .join("\n"),
    );
  }
}

import { describe, expect, it } from "vitest";
import { buildTools } from "../src/generator/tool-builder";
import { EndpointResult, ResolvedSpec, ToolDefinition, WorxConfig } from "../src/types";

describe("buildTools", () => {
  it("uses operationId for tool names", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/customers/{id}": {
          get: {
            operationId: "get_customer",
            summary: "Get customer",
            parameters: [pathParam("id")],
          },
        },
      }), config()),
    );

    expect(tools[0]?.name).toBe("getCustomer");
  });

  it("generates names from method and path when operationId is missing", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/customers/{id}": {
          get: {
            summary: "Get customer",
            parameters: [pathParam("id")],
          },
        },
      }), config()),
    );

    expect(tools[0]?.name).toBe("getCustomersById");
  });

  it("returns skipped endpoints for x-worx-skip", () => {
    const results = buildTools(specWithPaths({
      "/internal": {
        get: {
          operationId: "getInternal",
          "x-worx-skip": true,
        },
      },
    }), config());

    expect(results[0]).toMatchObject({
      skipped: true,
      reason: "x-worx-skip flag set",
    });
  });

  it("keeps deprecated operations and marks them deprecated", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/legacy": {
          get: {
            operationId: "getLegacy",
            summary: "Get legacy",
            deprecated: true,
          },
        },
      }), config()),
    );

    expect(tools[0]?.deprecated).toBe(true);
  });

  it("skips multipart request bodies", () => {
    const results = buildTools(specWithPaths({
      "/files": {
        post: {
          operationId: "uploadFile",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    }), config());

    expect(results[0]).toMatchObject({
      skipped: true,
      reason: "Unsupported requestBody content type (multipart, binary, etc.)",
    });
  });

  it("generates tools for form-encoded request bodies", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/charges": {
          post: {
            operationId: "createCharge",
            requestBody: {
              content: {
                "application/x-www-form-urlencoded": {
                  schema: {
                    type: "object",
                    required: ["amount"],
                    properties: {
                      amount: { type: "integer" },
                      currency: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }), config()),
    );

    expect(tools[0]?.requestContentType).toBe("application/x-www-form-urlencoded");
    expect(tools[0]?.params.map((param) => param.name)).toEqual(["amount", "currency"]);
  });

  it("ignores GET request bodies from specs that incorrectly include them", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/customers": {
          get: {
            operationId: "listCustomers",
            parameters: [
              {
                name: "limit",
                in: "query",
                schema: { type: "integer" },
              },
            ],
            requestBody: {
              content: {
                "application/x-www-form-urlencoded": {
                  schema: {
                    type: "object",
                    properties: {},
                  },
                },
              },
            },
          },
        },
      }), config()),
    );

    expect(tools[0]?.requestContentType).toBeUndefined();
    expect(tools[0]?.params.map((param) => param.name)).toEqual(["limit"]);
  });

  it("merges path-level and operation-level parameters", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/customers/{id}": {
          parameters: [pathParam("id")],
          get: {
            operationId: "getCustomer",
            parameters: [
              {
                name: "expand",
                in: "query",
                schema: { type: "string" },
              },
            ],
          },
        },
      }), config()),
    );

    expect(tools[0]?.params.map((param) => param.name)).toEqual(["id", "expand"]);
  });

  it("lets operation-level parameters override path-level parameters", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/customers/{id}": {
          parameters: [
            {
              ...pathParam("id"),
              description: "Path-level description",
            },
          ],
          get: {
            operationId: "getCustomer",
            parameters: [
              {
                ...pathParam("id"),
                description: "Operation-level description",
              },
            ],
          },
        },
      }), config()),
    );

    expect(tools[0]?.params).toHaveLength(1);
    expect(tools[0]?.params[0]?.description).toContain("Operation-level description");
  });

  it("applies tag filters", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/customers": {
          get: {
            operationId: "listCustomers",
            tags: ["customers"],
          },
        },
        "/invoices": {
          get: {
            operationId: "listInvoices",
            tags: ["billing"],
          },
        },
      }), config(["billing"])),
    );

    expect(tools.map((tool) => tool.name)).toEqual(["listInvoices"]);
  });

  it("deduplicates repeated operation names", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/a": {
          get: {
            operationId: "getThing",
          },
        },
        "/b": {
          get: {
            operationId: "getThing",
          },
        },
      }), config()),
    );

    expect(tools.map((tool) => tool.name)).toEqual(["getThing", "getThing_2"]);
  });

  it("deduplicates colliding parameter identifiers", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/users/{username}": {
          put: {
            operationId: "updateUser",
            parameters: [pathParam("username")],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      username: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }), config()),
    );

    expect(tools[0]?.params.map((param) => param.name)).toEqual(["username", "usernameBody"]);
  });

  it("renames reserved parameter identifiers before deduping", () => {
    const tools = onlyTools(
      buildTools(specWithPaths({
        "/reserved/{class}": {
          put: {
            operationId: "updateReserved",
            parameters: [
              pathParam("class"),
              {
                name: "fetch",
                in: "query",
                schema: { type: "string" },
              },
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      class: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }), config()),
    );

    expect(tools[0]?.params.map((param) => param.name)).toEqual(["classParam", "fetchParam", "classParamBody"]);
  });
});

function onlyTools(results: EndpointResult[]): ToolDefinition[] {
  return results.filter((result): result is ToolDefinition => result.skipped === false);
}

function config(filter: string[] = []): WorxConfig {
  return {
    outputDir: "/tmp/worx",
    filter,
    dryRun: false,
    groupByTag: false,
  };
}

function specWithPaths(paths: ResolvedSpec["paths"]): ResolvedSpec {
  return {
    info: {
      title: "Test API",
      version: "1.0.0",
    },
    servers: [{ url: "https://api.test" }],
    paths,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
    security: [{ BearerAuth: [] }],
  };
}

function pathParam(name: string) {
  return {
    name,
    in: "path" as const,
    required: true,
    description: `${name} parameter`,
    schema: {
      type: "string" as const,
    },
  };
}

import { describe, expect, it } from "vitest";
import { detectAuth } from "../src/generator/auth-detector";
import { ResolvedSpec } from "../src/types";

describe("detectAuth", () => {
  it("prefers a supported referenced scheme over an earlier unsupported one", () => {
    const spec = baseSpec({
      components: {
        securitySchemes: {
          basicAuth: {
            type: "http",
            scheme: "basic",
          },
          bearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
      security: [{ basicAuth: [] }, { bearerAuth: [] }],
    });

    expect(detectAuth(spec)).toEqual({
      type: "bearer",
      secretName: "API_KEY",
    });
  });

  it("falls back to an OAuth placeholder when no supported scheme exists", () => {
    const spec = baseSpec({
      components: {
        securitySchemes: {
          oauth: {
            type: "oauth2",
          },
        },
      },
      security: [{ oauth: [] }],
    });

    expect(detectAuth(spec)).toEqual({
      type: "unsupported",
      secretName: "ACCESS_TOKEN",
    });
  });
});

function baseSpec(overrides: Partial<ResolvedSpec>): ResolvedSpec {
  return {
    info: {
      title: "Auth API",
      version: "1.0.0",
    },
    servers: [{ url: "https://api.test" }],
    paths: {},
    ...overrides,
  };
}

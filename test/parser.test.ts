import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadSpec } from "../src/parser/openapi";

const fixturesDir = path.resolve("test/fixtures");

describe("loadSpec", () => {
  it("loads a valid local OpenAPI 3.0 spec", async () => {
    const spec = await loadSpec(path.join(fixturesDir, "simple.openapi.json"));

    expect(spec.info.title).toBe("Simple CRM");
    expect(spec.servers[0]?.url).toBe("https://api.simple.test");
    expect(Object.keys(spec.paths)).toHaveLength(2);
  });

  it("loads a valid local OpenAPI 3.1 spec", async () => {
    const spec = await loadSpec(path.join(fixturesDir, "simple31.openapi.json"));

    expect(spec.info.title).toBe("Simple 3.1 API");
  });

  it("rejects a Swagger 2.0 spec with a version error", async () => {
    await expect(loadSpec(path.join(fixturesDir, "swagger2.openapi.json"))).rejects.toThrow(
      "WorX requires OpenAPI 3.x",
    );
  });

  it("reports a missing local file clearly", async () => {
    await expect(loadSpec(path.join(fixturesDir, "missing.openapi.json"))).rejects.toThrow(
      "Spec file not found",
    );
  });

  it("resolves local refs inline", async () => {
    const spec = await loadSpec(path.join(fixturesDir, "simple.openapi.json"));
    const parameter = spec.paths["/customers/{customer_id}"]?.get?.parameters?.[0];

    expect(parameter?.name).toBe("customer_id");
    expect(parameter?.schema?.type).toBe("string");
  });
});

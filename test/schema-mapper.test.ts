import { describe, expect, it } from "vitest";
import { mapParameter, mapRequestBody, resolveSchema } from "../src/parser/schema-mapper";
import { RequestBody } from "../src/types";

describe("schema mapper", () => {
  it("maps string parameters", () => {
    const param = mapParameter({
      name: "email",
      in: "query",
      schema: { type: "string" },
    });

    expect(param.type).toBe("string");
  });

  it("maps integer parameters to number", () => {
    const param = mapParameter({
      name: "limit",
      in: "query",
      schema: { type: "integer" },
    });

    expect(param.type).toBe("number");
  });

  it("maps arrays of strings", () => {
    const param = mapParameter({
      name: "expand",
      in: "query",
      schema: { type: "array", items: { type: "string" } },
    });

    expect(param.type).toBe("array");
    expect(param.itemType).toBe("string");
  });

  it("merges allOf object schemas", () => {
    const resolved = resolveSchema({
      allOf: [
        {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string" },
          },
        },
        {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
          },
        },
      ],
    });

    expect(resolved.type).toBe("object");
    expect(resolved.descriptionSuffix).toContain("email");
    expect(resolved.descriptionSuffix).toContain("name");
  });

  it("uses the first oneOf schema and documents the choice", () => {
    const resolved = resolveSchema({
      oneOf: [{ type: "string" }, { type: "number" }],
    });

    expect(resolved.type).toBe("string");
    expect(resolved.descriptionSuffix).toContain("accepts multiple shapes");
  });

  it("normalizes snake_case names to camelCase and preserves originalName", () => {
    const param = mapParameter({
      name: "customer_id",
      in: "path",
      required: true,
      schema: { type: "string" },
    });

    expect(param.name).toBe("customerId");
    expect(param.originalName).toBe("customer_id");
  });

  it("normalizes kebab-case names to camelCase", () => {
    const param = mapParameter({
      name: "request-id",
      in: "header",
      schema: { type: "string" },
    });

    expect(param.name).toBe("requestId");
  });

  it("propagates requestBody required fields", () => {
    const params = mapRequestBody(jsonBody({
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string" },
        name: { type: "string" },
      },
    }));

    expect(params.find((param) => param.name === "email")?.required).toBe(true);
    expect(params.find((param) => param.name === "name")?.required).toBe(false);
  });

  it("maps JSON object request bodies to one param per property", () => {
    const params = mapRequestBody(jsonBody({
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string" },
        active: { type: "boolean" },
      },
    }));

    expect(params.map((param) => param.name)).toEqual(["email", "active"]);
  });

  it("maps form-encoded object request bodies to one param per property", () => {
    const params = mapRequestBody({
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
    });

    expect(params.map((param) => param.name)).toEqual(["amount", "currency"]);
    expect(params.find((param) => param.name === "amount")?.required).toBe(true);
  });

  it("returns a body string param for non-JSON content", () => {
    const params = mapRequestBody({
      content: {
        "multipart/form-data": {
          schema: { type: "object" },
        },
      },
    });

    expect(params).toHaveLength(1);
    expect(params[0]?.name).toBe("body");
    expect(params[0]?.type).toBe("string");
  });
});

function jsonBody(schema: RequestBody["content"]["application/json"]["schema"]): RequestBody {
  return {
    required: true,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

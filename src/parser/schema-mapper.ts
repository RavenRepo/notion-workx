import { OASSchema, Parameter, RequestBody, ToolParam } from "../types";

interface ResolvedSchemaShape {
  type: ToolParam["type"];
  itemType?: string;
  descriptionSuffix: string;
}

export function mapParameter(param: Parameter): ToolParam {
  const resolved = resolveSchema(param.schema);
  return {
    name: toIdentifier(toCamelCase(param.name)),
    type: resolved.type,
    itemType: resolved.itemType,
    description: buildDescription(param.description, param.schema, resolved.descriptionSuffix),
    required: param.in === "path" || Boolean(param.required),
    location: param.in === "cookie" ? "query" : param.in,
    originalName: param.name,
    deprecated: Boolean(param.deprecated),
  };
}

export function mapRequestBody(body: RequestBody): ToolParam[] {
  const content = body.content["application/json"] ?? body.content["application/x-www-form-urlencoded"];
  if (!content?.schema) {
    return [
      {
        name: "body",
        type: "string",
        description: "Request body payload. Note: content type could not be mapped.",
        required: Boolean(body.required),
        location: "body",
        originalName: "body",
        deprecated: false,
      },
    ];
  }

  const schema = normalizeCompositions(content.schema);
  const properties = schema.properties ?? {};
  const propertyEntries = Object.entries(properties);

  if ((schema.type !== "object" && propertyEntries.length === 0) || propertyEntries.length === 0) {
    return [
      {
        name: "body",
        type: "string",
        description:
          "Request body payload. Note: body schema is not a top-level JSON object and should be provided as a JSON string.",
        required: Boolean(body.required),
        location: "body",
        originalName: "body",
        deprecated: false,
      },
    ];
  }

  const required = new Set(schema.required ?? []);
  return propertyEntries.map(([propertyName, propertySchema]) => {
    const resolved = resolveSchema(propertySchema);
    return {
      name: toIdentifier(toCamelCase(propertyName)),
      type: resolved.type,
      itemType: resolved.itemType,
      description: buildDescription(propertySchema.description, propertySchema, resolved.descriptionSuffix),
      required: required.has(propertyName),
      location: "body",
      originalName: propertyName,
      deprecated: Boolean(propertySchema.deprecated),
    };
  });
}

export function resolveSchema(schema: OASSchema | undefined): ResolvedSchemaShape {
  if (!schema) {
    return {
      type: "string",
      descriptionSuffix: "Note: type could not be inferred.",
    };
  }

  if (schema.$ref) {
    return {
      type: "string",
      descriptionSuffix: `TODO: unresolved reference ${schema.$ref}.`,
    };
  }

  if (schema.allOf && schema.allOf.length > 0) {
    return resolveSchema(mergeAllOf(schema.allOf));
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    const resolved = resolveSchema(schema.oneOf[0]);
    return {
      ...resolved,
      descriptionSuffix: joinNotes(
        resolved.descriptionSuffix,
        "Note: accepts multiple shapes, using first.",
      ),
    };
  }

  if (schema.anyOf && schema.anyOf.length > 0) {
    const resolved = resolveSchema(schema.anyOf[0]);
    return {
      ...resolved,
      descriptionSuffix: joinNotes(
        resolved.descriptionSuffix,
        "Note: accepts multiple shapes, using first.",
      ),
    };
  }

  const schemaType = schema.type ?? (schema.properties ? "object" : undefined);
  switch (schemaType) {
    case "string":
      return {
        type: "string",
        descriptionSuffix: stringNotes(schema),
      };
    case "integer":
    case "number":
      return {
        type: "number",
        descriptionSuffix: stringNotes(schema),
      };
    case "boolean":
      return {
        type: "boolean",
        descriptionSuffix: stringNotes(schema),
      };
    case "array": {
      const item = resolveSchema(schema.items);
      const itemType = scalarItemType(item.type);
      const suffix =
        itemType === "object"
          ? joinNotes(stringNotes(schema), "Array items are JSON objects.")
          : stringNotes(schema);
      return {
        type: "array",
        itemType,
        descriptionSuffix: suffix,
      };
    }
    case "object":
      return {
        type: "object",
        descriptionSuffix: joinNotes(stringNotes(schema), describeObjectProperties(schema)),
      };
    default:
      return {
        type: "string",
        descriptionSuffix: joinNotes(stringNotes(schema), "Note: type could not be inferred."),
      };
  }
}

function normalizeCompositions(schema: OASSchema): OASSchema {
  if (schema.allOf && schema.allOf.length > 0) {
    return mergeAllOf(schema.allOf);
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    return normalizeCompositions(schema.oneOf[0]);
  }

  if (schema.anyOf && schema.anyOf.length > 0) {
    return normalizeCompositions(schema.anyOf[0]);
  }

  return schema;
}

function mergeAllOf(schemas: OASSchema[]): OASSchema {
  const merged: OASSchema = {
    type: "object",
    properties: {},
    required: [],
  };
  const required = new Set<string>();

  for (const schema of schemas) {
    const resolved = normalizeCompositions(schema);
    for (const [name, property] of Object.entries(resolved.properties ?? {})) {
      merged.properties![name] = property;
    }
    for (const name of resolved.required ?? []) {
      required.add(name);
    }
  }

  merged.required = Array.from(required);
  return merged;
}

function buildDescription(
  parameterDescription: string | undefined,
  schema: OASSchema | undefined,
  suffix: string,
): string {
  const base = parameterDescription ?? schema?.description ?? "No description provided.";
  return joinNotes(base, suffix);
}

function stringNotes(schema: OASSchema): string {
  const notes: string[] = [];
  if (schema.format) {
    notes.push(`Format: ${schema.format}.`);
  }
  if (schema.enum && schema.enum.length > 0) {
    notes.push(`Allowed values: ${schema.enum.map(String).join(", ")}.`);
  }
  if (schema.nullable) {
    notes.push("Nullable.");
  }
  return notes.join(" ");
}

function describeObjectProperties(schema: OASSchema): string {
  const entries = Object.entries(schema.properties ?? {});
  if (entries.length === 0) {
    return "JSON object as string.";
  }

  const fields = entries.map(([name, property]) => {
    const type = property.type ?? (property.properties ? "object" : "unknown");
    const nestedNote = type === "object" ? " (nested object should be sent as JSON string)" : "";
    return `${name}: ${type}${nestedNote}`;
  });
  return `JSON object fields: ${fields.join("; ")}.`;
}

function scalarItemType(type: ToolParam["type"]): string {
  if (type === "number" || type === "boolean" || type === "object") {
    return type;
  }
  return "string";
}

function joinNotes(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function toCamelCase(value: string): string {
  return value
    .replace(/[-_\s]+(.)/g, (_match, character: string) => character.toUpperCase())
    .replace(/^(.)/, (character: string) => character.toLowerCase());
}

function toIdentifier(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_$]/g, "");
  if (!cleaned) {
    return "value";
  }
  if (/^[a-zA-Z_$]/.test(cleaned)) {
    return cleaned;
  }
  return `param${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
}

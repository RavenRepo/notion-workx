import {
  EndpointResult,
  Operation,
  Parameter,
  PathItem,
  ResolvedSpec,
  SkippedEndpoint,
  ToolDefinition,
  ToolParam,
  WorxConfig,
  AuthConfig,
} from "../types";
import { mapParameter, mapRequestBody } from "../parser/schema-mapper";
import { detectAuth } from "./auth-detector";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

type HttpMethod = (typeof HTTP_METHODS)[number];

export function buildTools(
  spec: ResolvedSpec,
  config: WorxConfig,
  auth: AuthConfig = detectAuth(spec),
): EndpointResult[] {
  const results: EndpointResult[] = [];
  const names = new Map<string, number>();

  for (const [pathTemplate, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }

      if (operation["x-worx-skip"] === true) {
        results.push(skipped(method, pathTemplate, "x-worx-skip flag set"));
        continue;
      }

      if (!matchesFilter(operation, config.filter)) {
        continue;
      }

      if (operation.requestBody && !operation.requestBody.content["application/json"]) {
        results.push(skipped(method, pathTemplate, "Non-JSON requestBody (multipart, binary, etc.)"));
        continue;
      }

      const nonCookieParameters = mergeParameters(pathItem, operation).filter((parameter) => {
        if (parameter.in !== "cookie") {
          return true;
        }
        console.warn(`Skipping cookie parameter ${parameter.name} on ${method.toUpperCase()} ${pathTemplate}.`);
        return false;
      });
      const params = nonCookieParameters.map(mapParameter);
      if (operation.requestBody) {
        params.push(...mapRequestBody(operation.requestBody));
      }
      const dedupedParams = dedupeParamNames(params);

      const baseName = operation.operationId
        ? sanitizeToolName(toCamelCase(operation.operationId))
        : generateToolName(method, pathTemplate);
      const name = dedupeToolName(baseName, names);
      const generatedTitle = toHumanTitle(name);
      const title = operation.summary ?? generatedTitle;

      results.push({
        name,
        title,
        description: truncate(operation.description ?? operation.summary ?? title, 200),
        method: method.toUpperCase() as ToolDefinition["method"],
        pathTemplate,
        params: dedupedParams,
        auth,
        tags: operation.tags ?? [],
        deprecated: Boolean(operation.deprecated),
        skipped: false,
      });
    }
  }

  return results;
}

function matchesFilter(operation: Operation, filter: string[] | undefined): boolean {
  if (!filter || filter.length === 0) {
    return true;
  }

  const tags = new Set((operation.tags ?? []).map((tag) => tag.toLowerCase()));
  return filter.some((tag) => tags.has(tag.toLowerCase()));
}

function mergeParameters(pathItem: PathItem, operation: Operation): Parameter[] {
  const merged = new Map<string, Parameter>();
  const order: string[] = [];

  for (const parameter of pathItem.parameters ?? []) {
    const key = parameterKey(parameter);
    if (!merged.has(key)) {
      order.push(key);
    }
    merged.set(key, parameter);
  }

  for (const parameter of operation.parameters ?? []) {
    const key = parameterKey(parameter);
    if (!merged.has(key)) {
      order.push(key);
    }
    merged.set(key, parameter);
  }

  return order.map((key) => merged.get(key)).filter((parameter): parameter is Parameter => Boolean(parameter));
}

function dedupeParamNames(params: ToolParam[]): ToolParam[] {
  const used = new Set<string>();
  return params.map((param) => {
    let name = param.name;
    if (RESERVED_IDENTIFIERS.has(name)) {
      name = `${name}Param`;
    }
    if (used.has(name)) {
      const base = `${name}${toPascalCase(param.location)}`;
      name = base;
      let suffix = 2;
      while (used.has(name) || RESERVED_IDENTIFIERS.has(name)) {
        name = `${base}${suffix}`;
        suffix += 1;
      }
    }
    used.add(name);
    return name === param.name ? param : { ...param, name };
  });
}

function parameterKey(parameter: Parameter): string {
  return `${parameter.in}:${parameter.name}`;
}

function generateToolName(method: HttpMethod, pathTemplate: string): string {
  const words = pathTemplate
    .split("/")
    .filter(Boolean)
    .flatMap((segment) => {
      const isPathParam = segment.startsWith("{") && segment.endsWith("}");
      const cleaned = segment.replace(/[{}]/g, "").replace(/[^a-zA-Z0-9]+/g, " ");
      const titled = toPascalCase(cleaned);
      return isPathParam ? [`By${titled}`] : [titled];
    })
    .join("");

  return sanitizeToolName(`${method}${words || "Operation"}`);
}

function dedupeToolName(baseName: string, names: Map<string, number>): string {
  const count = names.get(baseName) ?? 0;
  names.set(baseName, count + 1);
  return count === 0 ? baseName : `${baseName}_${count + 1}`;
}

function skipped(method: HttpMethod, path: string, reason: string): SkippedEndpoint {
  return {
    method: method.toUpperCase(),
    path,
    reason,
    skipped: true,
  };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function toHumanTitle(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toPascalCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function toCamelCase(value: string): string {
  return value
    .replace(/[-_\s]+(.)/g, (_match, character: string) => character.toUpperCase())
    .replace(/^(.)/, (character: string) => character.toLowerCase());
}

function sanitizeToolName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_$]/g, "");
  if (!cleaned) {
    return "operation";
  }
  if (/^[a-zA-Z_$]/.test(cleaned)) {
    return cleaned;
  }
  return `operation${cleaned}`;
}

const RESERVED_IDENTIFIERS = new Set([
  "BASE_URL",
  "await",
  "body",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "error",
  "export",
  "extends",
  "false",
  "fetch",
  "finally",
  "for",
  "function",
  "headers",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "requestBody",
  "requireSecret",
  "res",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "url",
  "var",
  "void",
  "while",
  "with",
  "worker",
  "yield",
]);

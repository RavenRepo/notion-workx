import { AuthConfig, ResolvedSpec, SecurityScheme } from "../types";

export function detectAuth(spec: ResolvedSpec): AuthConfig {
  const securitySchemes = spec.components?.securitySchemes;
  if (!securitySchemes || Object.keys(securitySchemes).length === 0) {
    return { type: "none", secretName: "" };
  }

  const schemeEntry = findReferencedScheme(securitySchemes, spec.security) ?? Object.entries(securitySchemes)[0];
  const [_schemeName, scheme] = schemeEntry;

  if (scheme.type === "http" && scheme.scheme?.toLowerCase() === "bearer") {
    return {
      type: "bearer",
      secretName: "API_KEY",
    };
  }

  if (scheme.type === "apiKey" && scheme.in === "header") {
    const headerName = scheme.name ?? "x-api-key";
    return {
      type: "apikey_header",
      headerName,
      secretName: `${toScreamingSnake(headerName)}_KEY`,
    };
  }

  if (scheme.type === "apiKey" && scheme.in === "query") {
    const queryParamName = scheme.name ?? "api_key";
    return {
      type: "apikey_query",
      queryParamName,
      secretName: `${toScreamingSnake(queryParamName)}_KEY`,
    };
  }

  if (scheme.type === "oauth2" || scheme.type === "openIdConnect") {
    console.warn(
      "OAuth2/OpenID detected. Generated Worker uses Bearer token placeholder - replace with your OAuth flow.",
    );
    return {
      type: "unsupported",
      secretName: "ACCESS_TOKEN",
    };
  }

  return { type: "none", secretName: "" };
}

function findReferencedScheme(
  securitySchemes: Record<string, SecurityScheme>,
  security: ResolvedSpec["security"],
): [string, SecurityScheme] | undefined {
  for (const requirement of security ?? []) {
    for (const schemeName of Object.keys(requirement)) {
      const scheme = securitySchemes[schemeName];
      if (scheme) {
        return [schemeName, scheme];
      }
    }
  }
  return undefined;
}

function toScreamingSnake(value: string): string {
  return value.replace(/[-\s]/g, "_").toUpperCase();
}

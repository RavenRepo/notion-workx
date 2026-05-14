import { AuthConfig, ResolvedSpec, SecurityScheme } from "../types";

export function detectAuth(spec: ResolvedSpec): AuthConfig {
  const securitySchemes = spec.components?.securitySchemes;
  if (!securitySchemes || Object.keys(securitySchemes).length === 0) {
    return { type: "none", secretName: "" };
  }

  let unsupportedAuth: AuthConfig | undefined;
  for (const [_schemeName, scheme] of candidateSchemes(securitySchemes, spec.security)) {
    const auth = authFromScheme(scheme);
    if (!auth) {
      continue;
    }
    if (auth.type !== "unsupported") {
      return auth;
    }
    unsupportedAuth ??= auth;
  }

  return unsupportedAuth ?? { type: "none", secretName: "" };
}

function authFromScheme(scheme: SecurityScheme): AuthConfig | undefined {
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

  return undefined;
}

function candidateSchemes(
  securitySchemes: Record<string, SecurityScheme>,
  security: ResolvedSpec["security"],
): Array<[string, SecurityScheme]> {
  const candidates: Array<[string, SecurityScheme]> = [];
  const seen = new Set<string>();
  for (const requirement of security ?? []) {
    for (const schemeName of Object.keys(requirement)) {
      const scheme = securitySchemes[schemeName];
      if (scheme && !seen.has(schemeName)) {
        candidates.push([schemeName, scheme]);
        seen.add(schemeName);
      }
    }
  }
  for (const [schemeName, scheme] of Object.entries(securitySchemes)) {
    if (!seen.has(schemeName)) {
      candidates.push([schemeName, scheme]);
    }
  }
  return candidates;
}

function toScreamingSnake(value: string): string {
  return value.replace(/[-\s]/g, "_").toUpperCase();
}

export interface WorxConfig {
  specUrl?: string;
  specFile?: string;
  outputDir: string;
  filter?: string[];
  dryRun: boolean;
  groupByTag: boolean;
}

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
  parameters?: Parameter[];
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
  "x-worx-skip"?: boolean;
}

export interface Parameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: OASSchema;
  deprecated?: boolean;
}

export interface RequestBody {
  required?: boolean;
  content: {
    "application/json"?: {
      schema?: OASSchema;
    };
    "application/x-www-form-urlencoded"?: {
      schema?: OASSchema;
    };
    [key: string]: unknown;
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
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  scheme?: string;
  in?: "header" | "query" | "cookie";
  name?: string;
  description?: string;
}

export type SecurityRequirement = Record<string, string[]>;

export interface ToolParam {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  itemType?: string;
  description: string;
  required: boolean;
  location: "path" | "query" | "header" | "body";
  originalName: string;
  deprecated: boolean;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  pathTemplate: string;
  params: ToolParam[];
  requestContentType?: "application/json" | "application/x-www-form-urlencoded";
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

export type AuthType = "bearer" | "apikey_header" | "apikey_query" | "none" | "unsupported";

export interface AuthConfig {
  type: AuthType;
  secretName: string;
  headerName?: string;
  queryParamName?: string;
}

export interface GeneratorOutput {
  tools: ToolDefinition[];
  skipped: SkippedEndpoint[];
  auth: AuthConfig;
  baseUrl: string;
  apiTitle: string;
  apiVersion: string;
}

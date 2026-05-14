import { dereference } from "@readme/openapi-parser";
import { ResolvedSpec } from "../types";

type JsonRecord = Record<string, unknown>;

/**
 * Load and resolve an OpenAPI 3.x spec.
 *
 * Local refs are dereferenced inline. External refs are intentionally left
 * unresolved because WorX v1 only supports single-document OpenAPI specs.
 */
export async function loadSpec(source: string): Promise<ResolvedSpec> {
  try {
    const api = (await dereference(source, {
      dereference: {
        circular: "ignore",
      },
      resolve: {
        external: false,
      },
    })) as unknown as JsonRecord;

    const version = readString(api.openapi);
    if (!version?.startsWith("3.")) {
      const detectedVersion = readString(api.swagger) ?? version ?? "unknown";
      throw new Error(
        `WorX requires OpenAPI 3.x. This spec appears to be version ${detectedVersion}.`,
      );
    }

    if (!Array.isArray(api.servers) || api.servers.length === 0) {
      console.warn(
        "No servers found in spec. Defaulting to https://api.example.com - update BASE_URL in the generated Worker.",
      );
      api.servers = [{ url: "https://api.example.com" }];
    }

    return api as unknown as ResolvedSpec;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.startsWith("WorX requires OpenAPI 3.x.")) {
      throw error;
    }

    if (message.includes("ENOENT")) {
      throw new Error(`Spec file not found: ${source}`);
    }

    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("fetch failed")
    ) {
      throw new Error(`Could not fetch spec from ${source}. Check the URL and your network.`);
    }

    throw new Error(`Failed to parse spec: ${message}`);
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

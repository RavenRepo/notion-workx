import { execSync } from "node:child_process";
import path from "node:path";

export async function deployWorker(outputDir: string): Promise<string> {
  const absPath = path.resolve(outputDir);

  try {
    execSync("ntn --version", { stdio: "pipe" });
  } catch {
    throw new Error(
      "ntn CLI not found. Install it with: npm install -g @notionhq/workers-cli\n" +
        `Then run: ntn workers deploy ${absPath}`,
    );
  }

  try {
    return execSync("ntn workers deploy", {
      cwd: absPath,
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch (error: unknown) {
    const failed = error as { stdout?: string; stderr?: string };
    throw new Error(`Deploy failed:\n${failed.stdout ?? ""}\n${failed.stderr ?? ""}`);
  }
}

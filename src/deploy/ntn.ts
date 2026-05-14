import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export async function deployWorker(outputDir: string, workerName?: string): Promise<string> {
  const absPath = path.resolve(outputDir);

  try {
    execFileSync("ntn", ["--version"], { stdio: "pipe" });
  } catch {
    throw new Error(
      "ntn CLI not found. Install it with: npm install -g ntn\n" +
        `Then run: ntn workers deploy --name ${workerName ?? path.basename(absPath)} in ${absPath}`,
    );
  }

  try {
    return execFileSync("ntn", deployArgs(absPath, workerName), {
      cwd: absPath,
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch (error: unknown) {
    const failed = error as { stdout?: string; stderr?: string };
    throw new Error(`Deploy failed:\n${failed.stdout ?? ""}\n${failed.stderr ?? ""}`);
  }
}

export function deployArgs(outputDir: string, workerName?: string): string[] {
  const args = ["workers", "deploy", "--no-git"];
  if (!existsSync(path.join(outputDir, "workers.json"))) {
    args.push("--name", workerName ?? path.basename(outputDir));
  }
  return args;
}

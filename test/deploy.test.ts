import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deployArgs } from "../src/deploy/ntn";

describe("deployArgs", () => {
  it("adds a worker name for first deploys without workers.json", () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "worx-deploy-"));

    expect(deployArgs(outputDir, "crm-worker")).toEqual([
      "workers",
      "deploy",
      "--no-git",
      "--name",
      "crm-worker",
    ]);
  });

  it("omits the create-only worker name when workers.json exists", () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "worx-deploy-"));
    writeFileSync(path.join(outputDir, "workers.json"), "{}\n", "utf8");

    expect(deployArgs(outputDir, "crm-worker")).toEqual(["workers", "deploy", "--no-git"]);
  });
});

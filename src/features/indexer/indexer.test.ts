import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { buildIndex, detectDrift } from "./indexer";
import { stringifyYaml } from "@shared/lib/yaml";
import { join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import type { Index } from "@shared/types/contract.types";

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "indexer-test-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function contractYaml(feature: string, deps: string[] = [], overrides?: { status?: string; description?: string; rulesCount?: number }): string {
  const internal =
    deps.length === 0
      ? "[]"
      : "\n" + deps.map((d) => `    - feature: ${d}\n      reason: "test"`).join("\n");

  const status = overrides?.status ?? "draft";
  const description = overrides?.description ?? `Test ${feature}`;
  const rules = overrides?.rulesCount
    ? "\n" + Array.from({ length: overrides.rulesCount }, (_, i) => `  - id: rule-${i}\n    description: "Rule ${i}"\n    severity: error\n    testable: true`).join("\n")
    : "[]";

  return `
contract:
  version: "1.0.0"
  feature: ${feature}
  description: "${description}"
  owner: test
  status: ${status}
dependencies:
  internal: ${internal}
  external: []
exports:
  functions: []
  types: []
rules: ${rules}
files: []
`.trim();
}

async function createContractsDir(
  name: string,
  contracts: { feature: string; deps?: string[]; overrides?: { status?: string; description?: string; rulesCount?: number } }[]
): Promise<string> {
  const dir = await mkdtemp(join(tmpDir, `${name}-`));
  for (const c of contracts) {
    await Bun.write(
      join(dir, `${c.feature}.contract.yaml`),
      contractYaml(c.feature, c.deps ?? [], c.overrides)
    );
  }
  return dir;
}

async function writeIndexYaml(dir: string, index: Index): Promise<string> {
  const indexPath = join(dir, "index.yaml");
  await Bun.write(indexPath, stringifyYaml(index));
  return indexPath;
}

describe("indexer", () => {
  describe("buildIndex", () => {
    test("scans contracts directory and builds index", async () => {
      const dir = await createContractsDir("build-scan", [
        { feature: "alpha" },
        { feature: "beta" },
        { feature: "gamma" },
      ]);

      const result = await buildIndex(dir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.features).toHaveLength(3);
        expect(result.value.version).toBe("1.0.0");
        expect(result.value.project).toBe("contract-mcp");
        expect(result.value.contractsDir).toBe(dir);
        const featureNames = result.value.features.map((f) => f.feature).sort();
        expect(featureNames).toEqual(["alpha", "beta", "gamma"]);
      }
    });

    test("includes all contract metadata in index entries", async () => {
      const dir = await createContractsDir("build-meta", [
        {
          feature: "my-feature",
          deps: ["other-dep"],
          overrides: { status: "active", description: "My description", rulesCount: 3 },
        },
      ]);

      const result = await buildIndex(dir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const entry = result.value.features[0];
        expect(entry.feature).toBe("my-feature");
        expect(entry.contractPath).toBe("my-feature.contract.yaml");
        expect(entry.status).toBe("active");
        expect(entry.description).toBe("My description");
        expect(entry.dependsOn).toEqual(["other-dep"]);
        expect(entry.exportsCount).toBe(0);
        expect(entry.rulesCount).toBe(3);
      }
    });

    test("returns error for invalid contracts directory", async () => {
      const dir = await mkdtemp(join(tmpDir, "build-empty-"));
      // Write a broken contract so compileAll fails with all-contracts-failed
      await Bun.write(join(dir, "broken.contract.yaml"), "contract:\n  version: 1\n");

      const result = await buildIndex(dir);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBeTruthy();
      }
    });
  });

  describe("detectDrift", () => {
    test("detects orphaned contracts not in index", async () => {
      const dir = await createContractsDir("drift-orphan", [
        { feature: "indexed-feature" },
        { feature: "orphaned-feature" },
      ]);

      // Index only has one feature
      const existingIndex: Index = {
        version: "1.0.0",
        project: "contract-mcp",
        updatedAt: new Date().toISOString(),
        contractsDir: dir,
        features: [
          {
            feature: "indexed-feature",
            contractPath: "indexed-feature.contract.yaml",
            status: "draft",
            description: "Test indexed-feature",
            dependsOn: [],
            exportsCount: 0,
            rulesCount: 0,
          },
        ],
      };

      const indexPath = await writeIndexYaml(dir, existingIndex);
      const report = await detectDrift(indexPath, dir);

      expect(report.hasDrift).toBe(true);
      expect(report.orphanedContracts).toContain("orphaned-feature");
      expect(report.missingContracts).toHaveLength(0);
    });

    test("detects missing contracts referenced by index", async () => {
      const dir = await createContractsDir("drift-missing", [
        { feature: "existing-feature" },
      ]);

      // Index references a feature that no longer has a contract file
      const existingIndex: Index = {
        version: "1.0.0",
        project: "contract-mcp",
        updatedAt: new Date().toISOString(),
        contractsDir: dir,
        features: [
          {
            feature: "existing-feature",
            contractPath: "existing-feature.contract.yaml",
            status: "draft",
            description: "Test existing-feature",
            dependsOn: [],
            exportsCount: 0,
            rulesCount: 0,
          },
          {
            feature: "ghost-feature",
            contractPath: "ghost-feature.contract.yaml",
            status: "draft",
            description: "This contract was deleted",
            dependsOn: [],
            exportsCount: 0,
            rulesCount: 0,
          },
        ],
      };

      const indexPath = await writeIndexYaml(dir, existingIndex);
      const report = await detectDrift(indexPath, dir);

      expect(report.hasDrift).toBe(true);
      expect(report.missingContracts).toContain("ghost-feature");
      expect(report.orphanedContracts).toHaveLength(0);
    });

    test("detects outdated metadata in index", async () => {
      const dir = await createContractsDir("drift-outdated", [
        { feature: "changed-feature", overrides: { status: "active", description: "New description" } },
      ]);

      // Index has old metadata
      const existingIndex: Index = {
        version: "1.0.0",
        project: "contract-mcp",
        updatedAt: new Date().toISOString(),
        contractsDir: dir,
        features: [
          {
            feature: "changed-feature",
            contractPath: "changed-feature.contract.yaml",
            status: "draft",
            description: "Old description",
            dependsOn: [],
            exportsCount: 0,
            rulesCount: 0,
          },
        ],
      };

      const indexPath = await writeIndexYaml(dir, existingIndex);
      const report = await detectDrift(indexPath, dir);

      expect(report.hasDrift).toBe(true);
      expect(report.outdatedEntries).toContain("changed-feature");
    });

    test("returns no drift when index is current", async () => {
      const dir = await createContractsDir("drift-none", [
        { feature: "stable-feature" },
      ]);

      // Build fresh index then use it as existing
      const freshResult = await buildIndex(dir);
      expect(freshResult.ok).toBe(true);
      if (!freshResult.ok) return;

      const indexPath = await writeIndexYaml(dir, freshResult.value);
      const report = await detectDrift(indexPath, dir);

      expect(report.hasDrift).toBe(false);
      expect(report.orphanedContracts).toHaveLength(0);
      expect(report.missingContracts).toHaveLength(0);
      expect(report.outdatedEntries).toHaveLength(0);
    });
  });

  describe("rules", () => {
    test("all-contracts-indexed: every .contract.yaml must be in index", async () => {
      const dir = await createContractsDir("rule-all-indexed", [
        { feature: "feat-a" },
        { feature: "feat-b" },
      ]);

      // Index only has feat-a
      const partialIndex: Index = {
        version: "1.0.0",
        project: "contract-mcp",
        updatedAt: new Date().toISOString(),
        contractsDir: dir,
        features: [
          {
            feature: "feat-a",
            contractPath: "feat-a.contract.yaml",
            status: "draft",
            description: "Test feat-a",
            dependsOn: [],
            exportsCount: 0,
            rulesCount: 0,
          },
        ],
      };

      const indexPath = await writeIndexYaml(dir, partialIndex);
      const report = await detectDrift(indexPath, dir);

      // feat-b is orphaned (exists as contract but not in index)
      expect(report.orphanedContracts).toContain("feat-b");
      expect(report.hasDrift).toBe(true);
    });

    test("no-phantom-entries: every index entry must have a contract", async () => {
      const dir = await createContractsDir("rule-no-phantom", [
        { feature: "real-feature" },
      ]);

      // Index has a phantom entry
      const phantomIndex: Index = {
        version: "1.0.0",
        project: "contract-mcp",
        updatedAt: new Date().toISOString(),
        contractsDir: dir,
        features: [
          {
            feature: "real-feature",
            contractPath: "real-feature.contract.yaml",
            status: "draft",
            description: "Test real-feature",
            dependsOn: [],
            exportsCount: 0,
            rulesCount: 0,
          },
          {
            feature: "phantom-feature",
            contractPath: "phantom-feature.contract.yaml",
            status: "draft",
            description: "Does not exist",
            dependsOn: [],
            exportsCount: 0,
            rulesCount: 0,
          },
        ],
      };

      const indexPath = await writeIndexYaml(dir, phantomIndex);
      const report = await detectDrift(indexPath, dir);

      expect(report.missingContracts).toContain("phantom-feature");
      expect(report.hasDrift).toBe(true);
    });

    test("index-regenerable: index must be regenerable from scratch", async () => {
      const dir = await createContractsDir("rule-regenerable", [
        { feature: "feat-x" },
        { feature: "feat-y" },
      ]);

      // Build index from scratch
      const result1 = await buildIndex(dir);
      expect(result1.ok).toBe(true);
      if (!result1.ok) return;

      // Build again - should produce equivalent features
      const result2 = await buildIndex(dir);
      expect(result2.ok).toBe(true);
      if (!result2.ok) return;

      const features1 = result1.value.features.map((f) => f.feature).sort();
      const features2 = result2.value.features.map((f) => f.feature).sort();
      expect(features1).toEqual(features2);

      // Verify no drift against itself
      const indexPath = await writeIndexYaml(dir, result1.value);
      const report = await detectDrift(indexPath, dir);
      expect(report.hasDrift).toBe(false);
    });

    test("metadata-sync: index metadata must match contract", async () => {
      const dir = await createContractsDir("rule-metadata", [
        { feature: "synced", overrides: { status: "active", description: "Current desc", rulesCount: 2 } },
      ]);

      // Index with stale metadata
      const staleIndex: Index = {
        version: "1.0.0",
        project: "contract-mcp",
        updatedAt: new Date().toISOString(),
        contractsDir: dir,
        features: [
          {
            feature: "synced",
            contractPath: "synced.contract.yaml",
            status: "draft",
            description: "Old desc",
            dependsOn: [],
            exportsCount: 5,
            rulesCount: 0,
          },
        ],
      };

      const indexPath = await writeIndexYaml(dir, staleIndex);
      const report = await detectDrift(indexPath, dir);

      expect(report.outdatedEntries).toContain("synced");
      expect(report.hasDrift).toBe(true);
    });
  });
});

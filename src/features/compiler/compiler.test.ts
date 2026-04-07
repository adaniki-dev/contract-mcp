import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { compileOne, compileAll } from "./compiler";
import { join } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";

const VALID_CONTRACT_YAML = `
contract:
  version: "1.0.0"
  feature: test-feature
  description: "Test"
  owner: test
  status: draft
dependencies:
  internal: []
  external: []
exports:
  functions: []
  types: []
rules: []
files: []
`.trim();

function makeContractYaml(overrides: {
  feature?: string;
  internalDeps?: { feature: string; reason: string }[];
} = {}): string {
  const feature = overrides.feature ?? "test-feature";
  const internalDeps = overrides.internalDeps ?? [];
  const depsYaml =
    internalDeps.length === 0
      ? "[]"
      : "\n" +
        internalDeps
          .map((d) => `    - feature: ${d.feature}\n      reason: "${d.reason}"`)
          .join("\n");

  return `
contract:
  version: "1.0.0"
  feature: ${feature}
  description: "Test feature ${feature}"
  owner: test
  status: draft
dependencies:
  internal: ${depsYaml}
  external: []
exports:
  functions: []
  types: []
rules: []
files: []
`.trim();
}

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "compiler-test-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeTempYaml(name: string, content: string, subdir?: string): Promise<string> {
  const dir = subdir ? join(tmpDir, subdir) : tmpDir;
  if (subdir) {
    await mkdir(dir, { recursive: true });
  }
  const path = join(dir, name);
  await Bun.write(path, content);
  return path;
}

describe("compiler", () => {
  describe("compileOne", () => {
    test("parses valid contract YAML into Contract type", async () => {
      const path = await writeTempYaml("valid.contract.yaml", VALID_CONTRACT_YAML);
      const result = await compileOne(path);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contract.feature).toBe("test-feature");
        expect(result.value.contract.version).toBe("1.0.0");
        expect(result.value.contract.status).toBe("draft");
      }
    });

    test("returns CompileError for invalid YAML syntax", async () => {
      const path = await writeTempYaml(
        "bad-syntax.contract.yaml",
        "{\n  invalid: yaml: broken:\n}"
      );
      const result = await compileOne(path);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.length).toBeGreaterThan(0);
        expect(result.error[0].severity).toBe("error");
      }
    });

    test("returns CompileError for missing required fields", async () => {
      const incomplete = `
contract:
  version: "1.0.0"
`.trim();
      const path = await writeTempYaml("incomplete.contract.yaml", incomplete);
      const result = await compileOne(path);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const messages = result.error.map((e) => e.message);
        expect(messages.some((m) => m.includes("contract.feature"))).toBe(true);
        expect(messages.some((m) => m.includes("contract.owner"))).toBe(true);
        expect(messages.some((m) => m.includes("dependencies"))).toBe(true);
        expect(messages.some((m) => m.includes("exports"))).toBe(true);
        expect(messages.some((m) => m.includes("rules"))).toBe(true);
        expect(messages.some((m) => m.includes("files"))).toBe(true);
      }
    });

    test("returns CompileError for schema violations", async () => {
      const badSchema = `
contract:
  version: 123
  feature: true
  description: null
  owner: 456
  status: invalid-status
dependencies:
  internal: "not-an-array"
  external: "not-an-array"
exports:
  functions: "not-an-array"
  types: "not-an-array"
rules: "not-an-array"
files: "not-an-array"
`.trim();
      const path = await writeTempYaml("bad-schema.contract.yaml", badSchema);
      const result = await compileOne(path);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.length).toBeGreaterThan(0);
        expect(result.error.every((e) => e.severity === "error")).toBe(true);
      }
    });
  });

  describe("compileAll", () => {
    test("compiles all contracts in directory", async () => {
      const dir = await mkdtemp(join(tmpdir(), "compiler-all-"));
      await Bun.write(
        join(dir, "a.contract.yaml"),
        makeContractYaml({ feature: "feature-a" })
      );
      await Bun.write(
        join(dir, "b.contract.yaml"),
        makeContractYaml({ feature: "feature-b" })
      );

      const result = await compileAll(dir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contracts).toHaveLength(2);
        const features = result.value.contracts.map((c) => c.contract.feature).sort();
        expect(features).toEqual(["feature-a", "feature-b"]);
      }

      await rm(dir, { recursive: true, force: true });
    });

    test("returns diagnostics for invalid contracts", async () => {
      const dir = await mkdtemp(join(tmpdir(), "compiler-diag-"));
      await Bun.write(
        join(dir, "good.contract.yaml"),
        makeContractYaml({ feature: "good-feature" })
      );
      await Bun.write(join(dir, "bad.contract.yaml"), "contract:\n  version: 1\n");

      const result = await compileAll(dir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contracts).toHaveLength(1);
        expect(result.value.diagnostics.length).toBeGreaterThan(0);
        expect(result.value.diagnostics.some((d) => d.rule === "compile-error")).toBe(true);
      }

      await rm(dir, { recursive: true, force: true });
    });

    test("returns success when all contracts valid", async () => {
      const dir = await mkdtemp(join(tmpdir(), "compiler-valid-"));
      await Bun.write(
        join(dir, "one.contract.yaml"),
        makeContractYaml({ feature: "one" })
      );
      await Bun.write(
        join(dir, "two.contract.yaml"),
        makeContractYaml({ feature: "two" })
      );

      const result = await compileAll(dir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contracts).toHaveLength(2);
        expect(result.value.diagnostics).toHaveLength(0);
      }

      await rm(dir, { recursive: true, force: true });
    });
  });

  describe("rules", () => {
    test("valid-yaml-syntax: all contracts must have valid YAML", async () => {
      const dir = await mkdtemp(join(tmpdir(), "compiler-yaml-rule-"));
      await Bun.write(
        join(dir, "broken.contract.yaml"),
        "{\n  invalid: yaml: broken:\n}"
      );

      const result = await compileAll(dir);

      // All contracts failed, so ok: false
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.length).toBeGreaterThan(0);
      }

      await rm(dir, { recursive: true, force: true });
    });

    test("schema-compliance: contracts must follow feature.schema.yaml", async () => {
      const dir = await mkdtemp(join(tmpdir(), "compiler-schema-rule-"));
      await Bun.write(
        join(dir, "good.contract.yaml"),
        makeContractYaml({ feature: "good" })
      );
      await Bun.write(
        join(dir, "bad.contract.yaml"),
        `
contract:
  version: 123
  feature: true
  description: null
  owner: 456
  status: invalid
dependencies:
  internal: "nope"
  external: "nope"
exports:
  functions: "nope"
  types: "nope"
rules: "nope"
files: "nope"
`.trim()
      );

      const result = await compileAll(dir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.diagnostics.length).toBeGreaterThan(0);
        expect(
          result.value.diagnostics.some((d) => d.severity === "error")
        ).toBe(true);
      }

      await rm(dir, { recursive: true, force: true });
    });

    test("required-fields: required fields must be present", async () => {
      const dir = await mkdtemp(join(tmpdir(), "compiler-required-rule-"));
      await Bun.write(
        join(dir, "valid.contract.yaml"),
        makeContractYaml({ feature: "valid" })
      );
      await Bun.write(
        join(dir, "missing.contract.yaml"),
        `
contract:
  version: "1.0.0"
`.trim()
      );

      const result = await compileAll(dir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.diagnostics.length).toBeGreaterThan(0);
        const messages = result.value.diagnostics.map((d) => d.message);
        expect(messages.some((m) => m.includes("dependencies"))).toBe(true);
        expect(messages.some((m) => m.includes("exports"))).toBe(true);
        expect(messages.some((m) => m.includes("rules"))).toBe(true);
        expect(messages.some((m) => m.includes("files"))).toBe(true);
      }

      await rm(dir, { recursive: true, force: true });
    });

    test("valid-references: internal dependency references must exist", async () => {
      const dir = await mkdtemp(join(tmpdir(), "compiler-refs-rule-"));

      // Contract A depends on Contract B (valid)
      await Bun.write(
        join(dir, "a.contract.yaml"),
        makeContractYaml({
          feature: "feature-a",
          internalDeps: [{ feature: "feature-b", reason: "needs B" }],
        })
      );

      // Contract B exists (no deps)
      await Bun.write(
        join(dir, "b.contract.yaml"),
        makeContractYaml({ feature: "feature-b" })
      );

      // Contract C depends on "nonexistent" (invalid reference)
      await Bun.write(
        join(dir, "c.contract.yaml"),
        makeContractYaml({
          feature: "feature-c",
          internalDeps: [{ feature: "nonexistent", reason: "does not exist" }],
        })
      );

      const result = await compileAll(dir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contracts).toHaveLength(3);

        // Should have a warning about nonexistent reference
        const refDiagnostics = result.value.diagnostics.filter(
          (d) => d.rule === "valid-references"
        );
        expect(refDiagnostics).toHaveLength(1);
        expect(refDiagnostics[0].severity).toBe("warning");
        expect(refDiagnostics[0].message).toContain("nonexistent");
        expect(refDiagnostics[0].message).toContain("feature-c");
      }

      await rm(dir, { recursive: true, force: true });
    });
  });
});

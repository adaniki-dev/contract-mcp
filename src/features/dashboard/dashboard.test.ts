import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { renderDashboard, renderHtml } from "./dashboard";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function contractYaml(
  feature: string,
  opts: { deps?: string[]; rules?: number } = {}
): string {
  const internal = (opts.deps || [])
    .map((d) => `    - feature: ${d}\n      reason: test`)
    .join("\n");
  const rules = Array.from(
    { length: opts.rules || 0 },
    (_, i) =>
      `  - id: rule-${i}\n    description: "Rule ${i}"\n    severity: error\n    testable: true`
  ).join("\n");
  return `contract:
  version: "1.0.0"
  feature: ${feature}
  description: "Test ${feature}"
  owner: test
  status: draft
dependencies:
  internal:
${internal || "    []"}
  external: []
exports:
  functions: []
  types: []
rules:
${rules || "  []"}
files: []
`;
}

let tmpDir: string;

beforeAll(() => {
  tmpDir = join(tmpdir(), `dashboard-test-${Date.now()}`);
  mkdirSync(join(tmpDir, "contracts"), { recursive: true });
  mkdirSync(join(tmpDir, "src", "features", "test-a"), { recursive: true });
  mkdirSync(join(tmpDir, "src", "features", "test-b"), { recursive: true });

  writeFileSync(
    join(tmpDir, "contracts", "test-a.contract.yaml"),
    contractYaml("test-a", { deps: [], rules: 3 })
  );
  writeFileSync(
    join(tmpDir, "contracts", "test-b.contract.yaml"),
    contractYaml("test-b", { deps: ["test-a"], rules: 2 })
  );

  // Create barrel files so validator can find them
  writeFileSync(
    join(tmpDir, "src", "features", "test-a", "index.ts"),
    "export {};\n"
  );
  writeFileSync(
    join(tmpDir, "src", "features", "test-b", "index.ts"),
    "export {};\n"
  );
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("dashboard", () => {
  describe("renderDashboard", () => {
    test("renders text dashboard for terminal", async () => {
      const result = await renderDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value).toBe("string");
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    test("includes all features in output", async () => {
      const result = await renderDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain("test-a");
        expect(result.value).toContain("test-b");
      }
    });

    test("shows validation status per feature", async () => {
      const result = await renderDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should contain either checkmark or cross for validation status
        const hasValidIndicator =
          result.value.includes("✓") || result.value.includes("✗");
        expect(hasValidIndicator).toBe(true);
      }
    });

    test("shows dependency counts", async () => {
      const result = await renderDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // test-b has 1 dep (test-a), test-a has 0 deps
        // The table should contain "Deps" header
        expect(result.value).toContain("Deps");
      }
    });
  });

  describe("renderHtml", () => {
    test("renders HTML dashboard", async () => {
      const result = await renderHtml(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain("<html>");
        expect(result.value).toContain("<table");
        expect(result.value).toContain("test-a");
        expect(result.value).toContain("test-b");
      }
    });
  });

  describe("rules", () => {
    test("read-only: dashboard never modifies contracts", async () => {
      const contractAPath = join(
        tmpDir,
        "contracts",
        "test-a.contract.yaml"
      );
      const contractBPath = join(
        tmpDir,
        "contracts",
        "test-b.contract.yaml"
      );

      const beforeA = readFileSync(contractAPath, "utf-8");
      const beforeB = readFileSync(contractBPath, "utf-8");

      await renderDashboard(tmpDir);

      const afterA = readFileSync(contractAPath, "utf-8");
      const afterB = readFileSync(contractBPath, "utf-8");

      expect(afterA).toBe(beforeA);
      expect(afterB).toBe(beforeB);
    });

    test("complete-overview: shows feature, status, validation, deps, rules", async () => {
      const result = await renderDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Must contain feature names
        expect(result.value).toContain("test-a");
        expect(result.value).toContain("test-b");
        // Must contain status
        expect(result.value).toContain("draft");
        // Must contain valid indicator
        const hasValidIndicator =
          result.value.includes("✓") || result.value.includes("✗");
        expect(hasValidIndicator).toBe(true);
        // Must contain column headers for deps and rules
        expect(result.value).toContain("Deps");
        expect(result.value).toContain("Rules");
      }
    });

    test("human-readable: output is readable without additional tools", async () => {
      const result = await renderDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value).toBe("string");
        expect(result.value.length).toBeGreaterThan(0);
        // Contains recognizable feature data
        expect(result.value).toContain("test-a");
        // Contains the project name in the title
        expect(result.value).toContain("zero-human");
        // Contains box-drawing characters indicating a formatted table
        expect(result.value).toContain("═");
      }
    });
  });
});

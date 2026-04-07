import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { startDashboard, renderDashboard } from "./dashboard";
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
  describe("startDashboard", () => {
    test("starts web server and returns url with port", async () => {
      const result = await startDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.url).toMatch(/^http:\/\/localhost:\d+$/);
        expect(result.value.port).toBeGreaterThanOrEqual(8000);
        expect(typeof result.value.stop).toBe("function");
        result.value.stop();
      }
    });

    test("serves HTML on GET /", async () => {
      const result = await startDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const res = await fetch(result.value.url);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/html");
        const html = await res.text();
        expect(html).toContain("test-a");
        expect(html).toContain("test-b");
        result.value.stop();
      }
    });

    test("serves JSON on GET /api/data", async () => {
      const result = await startDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const res = await fetch(`${result.value.url}/api/data`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.totalFeatures).toBe(2);
        expect(data.features).toHaveLength(2);
        result.value.stop();
      }
    });

    test("falls back to next port if current is busy", async () => {
      const first = await startDashboard(tmpDir);
      expect(first.ok).toBe(true);
      if (first.ok) {
        const second = await startDashboard(tmpDir);
        expect(second.ok).toBe(true);
        if (second.ok) {
          expect(second.value.port).toBeGreaterThan(first.value.port);
          second.value.stop();
        }
        first.value.stop();
      }
    });
  });

  describe("renderDashboard", () => {
    test("returns HTML string without starting server", async () => {
      const result = await renderDashboard(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain("<!DOCTYPE html>");
        expect(result.value).toContain("test-a");
        expect(result.value).toContain("test-b");
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
        const hasValidIndicator =
          result.value.includes("✓") || result.value.includes("✗");
        expect(hasValidIndicator).toBe(true);
      }
    });
  });

  describe("rules", () => {
    test("read-only: dashboard never modifies contracts", async () => {
      const contractAPath = join(tmpDir, "contracts", "test-a.contract.yaml");
      const beforeA = readFileSync(contractAPath, "utf-8");

      const result = await startDashboard(tmpDir);
      if (result.ok) {
        await fetch(result.value.url);
        result.value.stop();
      }

      const afterA = readFileSync(contractAPath, "utf-8");
      expect(afterA).toBe(beforeA);
    });
  });
});

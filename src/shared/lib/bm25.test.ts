import { describe, test, expect } from "bun:test";
import { BM25Index, tokenize } from "./bm25";

describe("tokenize", () => {
  test("splits on spaces, hyphens, underscores, dots, slashes", () => {
    expect(tokenize("dependency-graph")).toEqual(["dependency", "graph"]);
    expect(tokenize("src/features/compiler/index.ts")).toEqual([
      "src", "features", "compiler", "index", "ts",
    ]);
    expect(tokenize("hello_world.test")).toEqual(["hello", "world", "test"]);
  });

  test("lowercases and removes single-char tokens", () => {
    expect(tokenize("A Big Thing")).toEqual(["big", "thing"]);
    expect(tokenize("I/O")).toEqual([]);
  });
});

describe("BM25Index", () => {
  function buildTestIndex() {
    const index = new BM25Index({
      fieldWeights: {
        feature: 3.0,
        description: 2.0,
        exports: 1.5,
        rules: 1.0,
        deps: 1.0,
        files: 0.5,
      },
    });

    index.addDocument({
      id: "compiler",
      fields: {
        feature: "compiler",
        description: "Compiles all YAML contracts into validated Contract objects",
        exports: "compileOne compileAll",
        rules: "yaml-parse cross-reference validation",
        deps: "contract-entity shared-lib shared-types shared-config",
        files: "src/features/compiler/compiler.ts src/features/compiler/index.ts",
      },
    });

    index.addDocument({
      id: "validator",
      fields: {
        feature: "validator",
        description: "Validates implementation code against contract declarations",
        exports: "validate validateAll",
        rules: "exports-match signature-match files-exist deps-declared no-circular-deps",
        deps: "compiler shared-lib shared-types shared-config",
        files: "src/features/validator/validator.ts src/features/validator/index.ts",
      },
    });

    index.addDocument({
      id: "dependency-graph",
      fields: {
        feature: "dependency-graph",
        description: "Builds and analyzes dependency graph between features from contracts",
        exports: "DependencyGraph",
        rules: "cycle-detection transitive-resolution blast-radius-levels community-detection",
        deps: "shared-types",
        files: "src/entities/dependency-graph/graph.ts src/entities/dependency-graph/index.ts",
      },
    });

    index.addDocument({
      id: "dashboard",
      fields: {
        feature: "dashboard",
        description: "Web dashboard with summary project and brain link visualization",
        exports: "startDashboard renderDashboard renderHtml",
        rules: "html-render server-start graph-visualization",
        deps: "compiler validator dependency-graph shared-types shared-lib shared-config",
        files: "src/features/dashboard/dashboard.ts src/features/dashboard/views/graph.ts",
      },
    });

    return index;
  }

  test("ranks exact feature name match highest", () => {
    const index = buildTestIndex();
    const results = index.search("compiler");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("compiler");
  });

  test("ranks by relevance — direct match > dependency mention", () => {
    const index = buildTestIndex();
    const results = index.search("validator");

    expect(results[0].id).toBe("validator");
    // dashboard mentions validator as dep, should be ranked lower
    const dashboardIdx = results.findIndex((r) => r.id === "dashboard");
    expect(dashboardIdx).toBeGreaterThan(0);
  });

  test("multi-term search finds across tokens", () => {
    const index = buildTestIndex();
    const results = index.search("dependency graph");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("dependency-graph");
    expect(results[0].matchedTerms).toContain("dependency");
    expect(results[0].matchedTerms).toContain("graph");
  });

  test("IDF — rare terms score higher than common terms", () => {
    const index = buildTestIndex();

    // "dashboard" appears only in one doc → high IDF
    const dashResults = index.search("dashboard");
    // "shared" appears in most deps → low IDF
    const sharedResults = index.search("shared");

    // dashboard search should have a higher top score than shared
    expect(dashResults[0].score).toBeGreaterThan(sharedResults[0].score);
  });

  test("field weights — feature name match scores higher than file path match", () => {
    const index = buildTestIndex();

    // "compiler" matches both feature name (weight 3.0) and deps/files
    const results = index.search("compiler");
    // The compiler doc should score much higher than others that only mention it in deps
    const compilerScore = results.find((r) => r.id === "compiler")!.score;
    const validatorScore = results.find((r) => r.id === "validator")?.score ?? 0;

    expect(compilerScore).toBeGreaterThan(validatorScore * 1.5);
  });

  test("returns empty for no matches", () => {
    const index = buildTestIndex();
    const results = index.search("nonexistent-feature-xyz");
    expect(results).toEqual([]);
  });

  test("returns empty for empty query", () => {
    const index = buildTestIndex();
    const results = index.search("");
    expect(results).toEqual([]);
  });

  test("score is a rounded number", () => {
    const index = buildTestIndex();
    const results = index.search("compiler");
    for (const r of results) {
      const decimals = r.score.toString().split(".")[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(3);
    }
  });
});

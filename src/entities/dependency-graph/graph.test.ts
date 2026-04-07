import { describe, test, expect } from "bun:test";
import type { Contract } from "@shared/types/contract.types";
import { DependencyGraph } from "./graph";

function makeContract(feature: string, deps: string[] = []): Contract {
  return {
    contract: {
      version: "1.0.0",
      feature,
      description: "",
      owner: "test",
      status: "draft",
    },
    dependencies: {
      internal: deps.map((d) => ({ feature: d, reason: "test" })),
      external: [],
    },
    exports: { functions: [], types: [] },
    types: [],
    rules: [],
    files: [],
  };
}

describe("dependency graph", () => {
  test("builds graph from list of contracts", () => {
    const contracts = [
      makeContract("auth"),
      makeContract("users", ["auth"]),
      makeContract("dashboard", ["users"]),
    ];

    const graph = DependencyGraph.fromContracts(contracts);

    expect(graph.has("auth")).toBe(true);
    expect(graph.has("users")).toBe(true);
    expect(graph.has("dashboard")).toBe(true);
    expect(graph.getFeatures()).toHaveLength(3);
  });

  test("resolves direct dependencies", () => {
    const contracts = [
      makeContract("a", ["b", "c"]),
      makeContract("b"),
      makeContract("c"),
    ];

    const graph = DependencyGraph.fromContracts(contracts);

    expect(graph.getDependencies("a")).toEqual(["b", "c"]);
  });

  test("resolves transitive dependencies", () => {
    const contracts = [
      makeContract("a", ["b"]),
      makeContract("b", ["c"]),
      makeContract("c"),
    ];

    const graph = DependencyGraph.fromContracts(contracts);
    const transitive = graph.getTransitiveDeps("a");

    expect(transitive).toContain("b");
    expect(transitive).toContain("c");
  });

  test("detects circular dependencies", () => {
    const contracts = [
      makeContract("a", ["b"]),
      makeContract("b", ["c"]),
      makeContract("c", ["a"]),
    ];

    const graph = DependencyGraph.fromContracts(contracts);
    const cycles = graph.detectCircular();

    expect(cycles.length).toBeGreaterThan(0);
    const flat = cycles.flat();
    expect(flat).toContain("a");
    expect(flat).toContain("b");
    expect(flat).toContain("c");
  });

  test("returns empty graph for feature with no deps", () => {
    const contracts = [makeContract("standalone")];

    const graph = DependencyGraph.fromContracts(contracts);

    expect(graph.getDependencies("standalone")).toEqual([]);
  });

  test("calculates dependency depth", () => {
    const contracts = [
      makeContract("a", ["b"]),
      makeContract("b", ["c"]),
      makeContract("c"),
    ];

    const graph = DependencyGraph.fromContracts(contracts);

    expect(graph.getDepth("a")).toBe(2);
    expect(graph.getDepth("b")).toBe(1);
    expect(graph.getDepth("c")).toBe(0);
  });
});

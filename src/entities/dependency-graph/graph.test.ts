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

  test("getDependents returns direct dependents", () => {
    const contracts = [
      makeContract("core"),
      makeContract("auth", ["core"]),
      makeContract("users", ["core"]),
      makeContract("unrelated"),
    ];

    const graph = DependencyGraph.fromContracts(contracts);
    const dependents = graph.getDependents("core").sort();

    expect(dependents).toEqual(["auth", "users"]);
    expect(graph.getDependents("unrelated")).toEqual([]);
  });

  test("getTransitiveDependents walks up the chain", () => {
    const contracts = [
      makeContract("base"),
      makeContract("middle", ["base"]),
      makeContract("top", ["middle"]),
    ];

    const graph = DependencyGraph.fromContracts(contracts);
    const transitive = graph.getTransitiveDependents("base").sort();

    expect(transitive).toEqual(["middle", "top"]);
  });

  test("getBlastRadiusLevels groups upstream by depth", () => {
    const contracts = [
      makeContract("base"),
      makeContract("middle", ["base"]),
      makeContract("top1", ["middle"]),
      makeContract("top2", ["middle"]),
    ];

    const graph = DependencyGraph.fromContracts(contracts);
    const levels = graph.getBlastRadiusLevels("base", "upstream");

    expect(levels.get(1)).toEqual(["middle"]);
    expect(levels.get(2)?.sort()).toEqual(["top1", "top2"]);
  });

  test("getBlastRadiusLevels groups downstream by depth", () => {
    const contracts = [
      makeContract("base"),
      makeContract("middle", ["base"]),
      makeContract("top", ["middle"]),
    ];

    const graph = DependencyGraph.fromContracts(contracts);
    const levels = graph.getBlastRadiusLevels("top", "downstream");

    expect(levels.get(1)).toEqual(["middle"]);
    expect(levels.get(2)).toEqual(["base"]);
  });

  test("getBlastRadiusLevels returns empty map for isolated feature", () => {
    const contracts = [makeContract("isolated"), makeContract("other")];
    const graph = DependencyGraph.fromContracts(contracts);

    const upstream = graph.getBlastRadiusLevels("isolated", "upstream");
    const downstream = graph.getBlastRadiusLevels("isolated", "downstream");

    expect(upstream.size).toBe(0);
    expect(downstream.size).toBe(0);
  });

  test("getNeighbors returns union of deps and dependents", () => {
    const contracts = [
      makeContract("center"),
      makeContract("left", ["center"]),
      makeContract("right", ["center"]),
    ];
    const graph = DependencyGraph.fromContracts(contracts);

    expect(graph.getNeighbors("center").sort()).toEqual(["left", "right"]);
    expect(graph.getNeighbors("left").sort()).toEqual(["center"]);
  });

  test("detectCommunities groups isolated clusters separately", () => {
    const contracts = [
      // Cluster A
      makeContract("a1"),
      makeContract("a2", ["a1"]),
      makeContract("a3", ["a1", "a2"]),
      // Cluster B (no connection to A)
      makeContract("b1"),
      makeContract("b2", ["b1"]),
    ];
    const graph = DependencyGraph.fromContracts(contracts);
    const communities = graph.detectCommunities();

    const clusterA = new Set([
      communities.get("a1"),
      communities.get("a2"),
      communities.get("a3"),
    ]);
    const clusterB = new Set([communities.get("b1"), communities.get("b2")]);

    // Within each cluster, all should converge to same label
    expect(clusterA.size).toBe(1);
    expect(clusterB.size).toBe(1);
    // The two clusters should have different labels
    expect([...clusterA][0]).not.toBe([...clusterB][0]);
  });

  test("findOrphans returns features with no connections", () => {
    const contracts = [
      makeContract("connected", ["other"]),
      makeContract("other"),
      makeContract("orphan"),
    ];
    const graph = DependencyGraph.fromContracts(contracts);

    expect(graph.findOrphans()).toEqual(["orphan"]);
  });

  test("findBridges detects features that disconnect the graph when removed", () => {
    // bridge connects two halves: a-b-bridge-c-d
    const contracts = [
      makeContract("a"),
      makeContract("b", ["a"]),
      makeContract("bridge", ["b", "c"]),
      makeContract("c"),
      makeContract("d", ["c"]),
    ];
    const graph = DependencyGraph.fromContracts(contracts);
    const bridges = graph.findBridges();

    expect(bridges).toContain("bridge");
  });

  test("analyzeStructure returns full report with classifications", () => {
    const contracts = [
      makeContract("hub", ["leaf1"]),
      makeContract("leaf1"),
      makeContract("dep1", ["hub"]),
      makeContract("dep2", ["hub"]),
      makeContract("dep3", ["hub"]),
      makeContract("solo"),
    ];
    const graph = DependencyGraph.fromContracts(contracts);
    const report = graph.analyzeStructure();

    expect(report.communities.length).toBeGreaterThan(0);
    expect(report.classifications).toHaveLength(6);
    expect(report.orphans).toContain("solo");
    expect(typeof report.modularity).toBe("number");

    const hubClass = report.classifications.find((c) => c.feature === "hub");
    expect(hubClass).toBeDefined();
    expect(hubClass?.degree).toBeGreaterThanOrEqual(3);
  });
});

import type { Contract } from "@shared/types/contract.types";

export class DependencyGraph {
  private adjacency: Map<string, string[]>;

  private constructor() {
    this.adjacency = new Map();
  }

  static fromContracts(contracts: Contract[]): DependencyGraph {
    const graph = new DependencyGraph();

    for (const contract of contracts) {
      const feature = contract.contract.feature;
      const deps = contract.dependencies.internal.map((d) => d.feature);
      graph.adjacency.set(feature, deps);
    }

    return graph;
  }

  getDependencies(feature: string): string[] {
    return this.adjacency.get(feature) ?? [];
  }

  getTransitiveDeps(feature: string): string[] {
    const visited = new Set<string>();
    const queue = [...this.getDependencies(feature)];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      queue.push(...this.getDependencies(current));
    }

    return [...visited];
  }

  detectCircular(): string[][] {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;

    const color = new Map<string, number>();
    for (const feature of this.adjacency.keys()) {
      color.set(feature, WHITE);
    }

    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      color.set(node, GRAY);
      path.push(node);

      for (const dep of this.getDependencies(node)) {
        const depColor = color.get(dep);

        if (depColor === GRAY) {
          // Found a cycle - extract it from path
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
        } else if (depColor === WHITE) {
          dfs(dep, path);
        }
      }

      path.pop();
      color.set(node, BLACK);
    };

    for (const feature of this.adjacency.keys()) {
      if (color.get(feature) === WHITE) {
        dfs(feature, []);
      }
    }

    return cycles;
  }

  getDepth(feature: string): number {
    const deps = this.getDependencies(feature);
    if (deps.length === 0) return 0;

    let maxDepth = 0;
    for (const dep of deps) {
      maxDepth = Math.max(maxDepth, this.getDepth(dep) + 1);
    }
    return maxDepth;
  }

  has(feature: string): boolean {
    return this.adjacency.has(feature);
  }

  getFeatures(): string[] {
    return [...this.adjacency.keys()];
  }

  /**
   * Direct dependents: features that directly depend on the given feature.
   */
  getDependents(feature: string): string[] {
    const dependents: string[] = [];
    for (const [candidate, deps] of this.adjacency) {
      if (deps.includes(feature)) {
        dependents.push(candidate);
      }
    }
    return dependents;
  }

  /**
   * Transitive dependents: all features that directly or indirectly depend on the given feature.
   */
  getTransitiveDependents(feature: string): string[] {
    const visited = new Set<string>();
    const queue = [...this.getDependents(feature)];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      queue.push(...this.getDependents(current));
    }

    return [...visited];
  }

  /**
   * BFS that returns features grouped by depth level.
   * Direction "upstream" returns dependents (impact propagation).
   * Direction "downstream" returns dependencies (what this feature needs).
   */
  getBlastRadiusLevels(
    feature: string,
    direction: "upstream" | "downstream"
  ): Map<number, string[]> {
    const levels = new Map<number, string[]>();
    const visited = new Set<string>();
    visited.add(feature);

    const getNext = direction === "upstream"
      ? (f: string) => this.getDependents(f)
      : (f: string) => this.getDependencies(f);

    let current = getNext(feature).filter((f) => !visited.has(f));
    let depth = 1;

    while (current.length > 0) {
      const unique: string[] = [];
      for (const f of current) {
        if (!visited.has(f)) {
          visited.add(f);
          unique.push(f);
        }
      }

      if (unique.length === 0) break;

      levels.set(depth, unique);

      const next: string[] = [];
      for (const f of unique) {
        next.push(...getNext(f));
      }
      current = next;
      depth++;

      // Safety cap to prevent runaway graphs
      if (depth > 20) break;
    }

    return levels;
  }
}

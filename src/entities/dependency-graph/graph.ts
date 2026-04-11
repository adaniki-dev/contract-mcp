import type {
  Contract,
  CommunityReport,
  Community,
  FeatureClassification,
  NodeRole,
} from "@shared/types/contract.types";

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
   * Undirected neighbors: union of dependencies and dependents.
   */
  getNeighbors(feature: string): string[] {
    const set = new Set<string>();
    for (const d of this.getDependencies(feature)) set.add(d);
    for (const d of this.getDependents(feature)) set.add(d);
    return [...set];
  }

  /**
   * Total undirected edges in the graph.
   */
  private getTotalEdges(): number {
    const seen = new Set<string>();
    for (const [from, deps] of this.adjacency) {
      for (const to of deps) {
        const key = [from, to].sort().join("|");
        seen.add(key);
      }
    }
    return seen.size;
  }

  /**
   * Count connected components (undirected).
   */
  private countComponents(): number {
    const visited = new Set<string>();
    let count = 0;
    for (const feature of this.adjacency.keys()) {
      if (visited.has(feature)) continue;
      count++;
      const queue = [feature];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        queue.push(...this.getNeighbors(current));
      }
    }
    return count;
  }

  /**
   * Label propagation community detection.
   * Deterministic via lexicographic tiebreaker.
   */
  detectCommunities(): Map<string, string> {
    const labels = new Map<string, string>();
    for (const f of this.getFeatures()) {
      labels.set(f, f);
    }

    const MAX_ITER = 20;
    let iter = 0;
    let changed = true;

    while (changed && iter < MAX_ITER) {
      changed = false;
      iter++;

      const features = [...this.getFeatures()].sort();

      for (const f of features) {
        const neighbors = this.getNeighbors(f);
        if (neighbors.length === 0) continue;

        const counts = new Map<string, number>();
        for (const n of neighbors) {
          const lbl = labels.get(n)!;
          counts.set(lbl, (counts.get(lbl) ?? 0) + 1);
        }

        let bestLabel = labels.get(f)!;
        let bestCount = 0;
        for (const [lbl, cnt] of counts) {
          if (cnt > bestCount || (cnt === bestCount && lbl < bestLabel)) {
            bestLabel = lbl;
            bestCount = cnt;
          }
        }

        if (bestLabel !== labels.get(f)) {
          labels.set(f, bestLabel);
          changed = true;
        }
      }
    }

    return labels;
  }

  /**
   * Find orphan features (no connections at all).
   */
  findOrphans(): string[] {
    return this.getFeatures().filter((f) => this.getNeighbors(f).length === 0);
  }

  /**
   * Find bridge features — removing them increases the number of components.
   */
  findBridges(): string[] {
    const bridges: string[] = [];
    for (const feature of this.getFeatures()) {
      if (this.isBridge(feature)) bridges.push(feature);
    }
    return bridges;
  }

  private isBridge(feature: string): boolean {
    const neighbors = this.getNeighbors(feature);
    if (neighbors.length < 2) return false;

    const before = this.countComponents();

    // Temporarily detach the feature
    const ownDeps = this.adjacency.get(feature);
    this.adjacency.delete(feature);

    const restore: Array<[string, string[]]> = [];
    for (const [f, deps] of this.adjacency) {
      if (deps.includes(feature)) {
        restore.push([f, [...deps]]);
        this.adjacency.set(
          f,
          deps.filter((x) => x !== feature)
        );
      }
    }

    const after = this.countComponents();

    // Restore
    if (ownDeps) this.adjacency.set(feature, ownDeps);
    for (const [f, deps] of restore) this.adjacency.set(f, deps);

    // feature itself was removed so after excludes it; we want to know if
    // its neighbors got split. Compensate: the feature added 1 component when present.
    return after > before;
  }

  /**
   * Modularity score (Newman's Q) — 0 means no structure, > 0.3 means clear clusters.
   */
  calculateModularity(communities: Map<string, string>): number {
    const m = this.getTotalEdges();
    if (m === 0) return 0;

    const features = this.getFeatures();
    let q = 0;

    for (const i of features) {
      for (const j of features) {
        if (communities.get(i) !== communities.get(j)) continue;
        const Aij = this.getNeighbors(i).includes(j) ? 1 : 0;
        const ki = this.getNeighbors(i).length;
        const kj = this.getNeighbors(j).length;
        q += Aij - (ki * kj) / (2 * m);
      }
    }

    return q / (2 * m);
  }

  private classifyNode(feature: string, hubThreshold: number): NodeRole {
    const degree = this.getNeighbors(feature).length;
    if (degree === 0) return "orphan";

    if (degree >= hubThreshold && degree >= 3) return "hub";

    const deps = this.getDependencies(feature).length;
    const dependents = this.getDependents(feature).length;

    if (dependents === 0 && deps > 0) return "leaf";
    if (this.isBridge(feature)) return "bridge";

    return "member";
  }

  /**
   * Full structure analysis: communities + classifications + modularity.
   */
  analyzeStructure(): CommunityReport {
    const communities = this.detectCommunities();
    const modularity = this.calculateModularity(communities);

    const features = this.getFeatures();
    const degrees = features.map((f) => this.getNeighbors(f).length);
    const sortedDesc = [...degrees].sort((a, b) => b - a);
    const hubIdx = Math.max(0, Math.floor(sortedDesc.length * 0.2) - 1);
    const hubThreshold = sortedDesc[hubIdx] ?? 0;

    // Group by community
    const groups = new Map<string, string[]>();
    for (const f of features) {
      const lbl = communities.get(f)!;
      if (!groups.has(lbl)) groups.set(lbl, []);
      groups.get(lbl)!.push(f);
    }

    const communityList: Community[] = [];
    for (const [id, members] of groups) {
      const n = members.length;
      let internalEdges = 0;
      const memberSet = new Set(members);
      for (const a of members) {
        for (const b of this.getNeighbors(a)) {
          if (memberSet.has(b) && a < b) internalEdges++;
        }
      }
      const maxEdges = n > 1 ? (n * (n - 1)) / 2 : 0;
      const density = maxEdges > 0 ? internalEdges / maxEdges : 0;
      communityList.push({
        id,
        features: members.sort(),
        size: n,
        density: Math.round(density * 100) / 100,
      });
    }
    communityList.sort((a, b) => b.size - a.size);

    const classifications: FeatureClassification[] = features.map((f) => ({
      feature: f,
      community: communities.get(f)!,
      role: this.classifyNode(f, hubThreshold),
      degree: this.getNeighbors(f).length,
    }));

    const orphans = classifications.filter((c) => c.role === "orphan").map((c) => c.feature);
    const bridges = classifications.filter((c) => c.role === "bridge").map((c) => c.feature);
    const hubs = classifications.filter((c) => c.role === "hub").map((c) => c.feature);

    return {
      communities: communityList,
      classifications,
      orphans,
      bridges,
      hubs,
      modularity: Math.round(modularity * 1000) / 1000,
    };
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

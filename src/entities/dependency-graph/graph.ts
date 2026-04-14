import type {
  Contract,
  CommunityReport,
  Community,
  FeatureClassification,
  NodeRole,
  WeightedEdge,
  ValidationResult,
} from "@shared/types/contract.types";

export class DependencyGraph {
  private edges: Map<string, WeightedEdge[]>;

  private constructor() {
    this.edges = new Map();
  }

  static fromContracts(contracts: Contract[]): DependencyGraph {
    const graph = new DependencyGraph();

    for (const contract of contracts) {
      const feature = contract.contract.feature;
      const weightedDeps: WeightedEdge[] = contract.dependencies.internal.map((d) => ({
        from: feature,
        to: d.feature,
        confidence: d.confidence ?? 0.8,
        reason: d.reason,
        source: "declared" as const,
      }));
      graph.edges.set(feature, weightedDeps);
    }

    return graph;
  }

  /**
   * Enrich edge confidence using validation results.
   * - Declared + import found in code → 1.0
   * - Declared + no import found → stays 0.8
   * - Import found but not declared → new edge with 0.5
   */
  enrichWithValidation(validations: ValidationResult[]): void {
    for (const v of validations) {
      const featureEdges = this.edges.get(v.feature);
      if (!featureEdges) continue;

      const matchedSet = new Set(v.matchedDeps ?? []);
      const inferredList = v.inferredDeps ?? [];

      // Bump declared deps that were confirmed by imports
      for (const edge of featureEdges) {
        if (matchedSet.has(edge.to)) {
          edge.confidence = 1.0;
        }
      }

      // Add inferred edges (imports not declared in contract)
      const declaredTargets = new Set(featureEdges.map((e) => e.to));
      for (const dep of inferredList) {
        if (!declaredTargets.has(dep)) {
          featureEdges.push({
            from: v.feature,
            to: dep,
            confidence: 0.5,
            reason: "inferred from code imports",
            source: "inferred",
          });
        }
      }
    }
  }

  getDependencies(feature: string): string[] {
    return (this.edges.get(feature) ?? []).map((e) => e.to);
  }

  getWeightedDependencies(feature: string): WeightedEdge[] {
    return this.edges.get(feature) ?? [];
  }

  getEdgeConfidence(from: string, to: string): number {
    const edge = (this.edges.get(from) ?? []).find((e) => e.to === to);
    return edge?.confidence ?? 0;
  }

  getAllEdges(): WeightedEdge[] {
    const all: WeightedEdge[] = [];
    for (const edges of this.edges.values()) {
      all.push(...edges);
    }
    return all;
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
    for (const feature of this.edges.keys()) {
      color.set(feature, WHITE);
    }

    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      color.set(node, GRAY);
      path.push(node);

      for (const dep of this.getDependencies(node)) {
        const depColor = color.get(dep);

        if (depColor === GRAY) {
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

    for (const feature of this.edges.keys()) {
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
    return this.edges.has(feature);
  }

  getFeatures(): string[] {
    return [...this.edges.keys()];
  }

  /**
   * Direct dependents: features that directly depend on the given feature.
   */
  getDependents(feature: string): string[] {
    const dependents: string[] = [];
    for (const [candidate, edgeList] of this.edges) {
      if (edgeList.some((e) => e.to === feature)) {
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
    for (const [, edgeList] of this.edges) {
      for (const e of edgeList) {
        const key = [e.from, e.to].sort().join("|");
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
    for (const feature of this.edges.keys()) {
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
    const ownEdges = this.edges.get(feature);
    this.edges.delete(feature);

    const restore: Array<[string, WeightedEdge[]]> = [];
    for (const [f, edgeList] of this.edges) {
      if (edgeList.some((e) => e.to === feature)) {
        restore.push([f, [...edgeList]]);
        this.edges.set(
          f,
          edgeList.filter((e) => e.to !== feature)
        );
      }
    }

    const after = this.countComponents();

    // Restore
    if (ownEdges) this.edges.set(feature, ownEdges);
    for (const [f, edgeList] of restore) this.edges.set(f, edgeList);

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
    direction: "upstream" | "downstream",
    minConfidence?: number
  ): Map<number, string[]> {
    const levels = new Map<number, string[]>();
    const visited = new Set<string>();
    visited.add(feature);

    const threshold = minConfidence ?? 0;

    const getNext = (f: string): string[] => {
      if (direction === "upstream") {
        // Features whose edges point to f, filtered by confidence
        const result: string[] = [];
        for (const [candidate, edgeList] of this.edges) {
          for (const e of edgeList) {
            if (e.to === f && e.confidence >= threshold) {
              result.push(candidate);
              break;
            }
          }
        }
        return result;
      } else {
        return (this.edges.get(f) ?? [])
          .filter((e) => e.confidence >= threshold)
          .map((e) => e.to);
      }
    };

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

      if (depth > 20) break;
    }

    return levels;
  }
}

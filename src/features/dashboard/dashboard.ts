import { compileAll } from "@features/compiler";
import { validateAll } from "@features/validator";
import { DependencyGraph } from "@entities/dependency-graph";
import type {
  DashboardData,
  FeatureSummary,
  DashboardError,
  Result,
  Contract,
  ValidationResult,
  CommunityReport,
} from "@shared/types/contract.types";
import { DEFAULT_CONTRACTS_DIR } from "@shared/config";
import { join } from "path";

import { renderLayout } from "./views/layout";
import { renderSummary } from "./views/summary";
import { renderProject } from "./views/project";
import { renderGraph, type GraphNode, type GraphEdge } from "./views/graph";

const BASE_PORT = 8000;
const MAX_PORT_ATTEMPTS = 20;

// === Data Collection ===

interface FullData {
  data: DashboardData;
  contracts: Contract[];
  violations: Map<string, ValidationResult>;
  structure: CommunityReport;
  graph: DependencyGraph;
}

function buildDashboardData(
  contracts: Contract[],
  validations: ValidationResult[]
): DashboardData {
  const validationMap = new Map<string, ValidationResult>();
  for (const v of validations) {
    validationMap.set(v.feature, v);
  }

  let totalRules = 0;
  let totalViolations = 0;

  const features: FeatureSummary[] = contracts.map((c) => {
    const validation = validationMap.get(c.contract.feature);
    const violationsCount = validation ? validation.violations.length : 0;

    totalRules += c.rules.length;
    totalViolations += violationsCount;

    return {
      feature: c.contract.feature,
      status: c.contract.status,
      valid: validation ? validation.valid : true,
      violationsCount,
      dependenciesCount: c.dependencies.internal.length,
      rulesCount: c.rules.length,
    };
  });

  return {
    project: "contract-mcp",
    totalFeatures: contracts.length,
    totalRules,
    totalViolations,
    features,
  };
}

async function collectData(projectRoot: string): Promise<Result<FullData, DashboardError>> {
  const contractsDir = join(projectRoot, DEFAULT_CONTRACTS_DIR);
  const compileResult = await compileAll(contractsDir, projectRoot);

  if (!compileResult.ok) {
    return {
      ok: false,
      error: { message: `Compile failed: ${compileResult.error.map((e) => e.message).join("; ")}` },
    };
  }

  const { contracts } = compileResult.value;

  const validateResult = await validateAll(projectRoot);
  const validations: ValidationResult[] = validateResult.ok ? validateResult.value : [];

  const violationMap = new Map<string, ValidationResult>();
  for (const v of validations) {
    violationMap.set(v.feature, v);
  }

  const graph = DependencyGraph.fromContracts(contracts);
  graph.enrichWithValidation(validations);
  const structure = graph.analyzeStructure();

  return {
    ok: true,
    value: {
      data: buildDashboardData(contracts, validations),
      contracts,
      violations: violationMap,
      structure,
      graph,
    },
  };
}

function buildGraphData(
  contracts: Contract[],
  structure: CommunityReport,
  graph: DependencyGraph
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const communityByFeature = new Map(
    structure.classifications.map((c) => [c.feature, c.community])
  );
  const roleByFeature = new Map(
    structure.classifications.map((c) => [c.feature, c.role])
  );

  const nodes: GraphNode[] = contracts.map((c) => {
    const feature = c.contract.feature;
    return {
      id: feature,
      status: c.contract.status,
      deps: c.dependencies.internal.length,
      rules: c.rules.length,
      exports: c.exports.functions.length + c.exports.types.length,
      description: c.contract.description,
      community: communityByFeature.get(feature) ?? feature,
      role: roleByFeature.get(feature) ?? "member",
    };
  });

  const edges: GraphEdge[] = graph.getAllEdges().map((e) => ({
    from: e.from,
    to: e.to,
    reason: e.reason,
    confidence: e.confidence,
    source: e.source,
  }));

  return { nodes, edges };
}

// === Server ===

async function tryListen(port: number): Promise<ReturnType<typeof Bun.serve> | null> {
  try {
    const server = Bun.serve({
      port,
      fetch() {
        return new Response("starting...", { status: 503 });
      },
    });
    return server;
  } catch {
    return null;
  }
}

export async function startDashboard(
  projectRoot: string
): Promise<Result<{ url: string; port: number; stop: () => void }, DashboardError>> {
  let server: ReturnType<typeof Bun.serve> | null = null;
  let port = BASE_PORT;

  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    server = await tryListen(port + i);
    if (server) {
      port = port + i;
      break;
    }
  }

  if (!server) {
    return {
      ok: false,
      error: { message: `Could not find available port in range ${BASE_PORT}-${BASE_PORT + MAX_PORT_ATTEMPTS - 1}` },
    };
  }

  server.stop();

  const realServer = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // API endpoints
      if (url.pathname === "/api/data") {
        const result = await collectData(projectRoot);
        if (!result.ok) return Response.json({ error: result.error.message }, { status: 500 });
        return Response.json(result.value.data);
      }

      if (url.pathname === "/api/contracts") {
        const result = await collectData(projectRoot);
        if (!result.ok) return Response.json({ error: result.error.message }, { status: 500 });
        return Response.json(result.value.contracts);
      }

      if (url.pathname === "/api/graph") {
        const result = await collectData(projectRoot);
        if (!result.ok) return Response.json({ error: result.error.message }, { status: 500 });
        return Response.json(buildGraphData(result.value.contracts, result.value.structure, result.value.graph));
      }

      if (url.pathname === "/api/structure") {
        const result = await collectData(projectRoot);
        if (!result.ok) return Response.json({ error: result.error.message }, { status: 500 });
        return Response.json(result.value.structure);
      }

      // HTML pages
      const result = await collectData(projectRoot);
      if (!result.ok) {
        return new Response(`Error: ${result.error.message}`, { status: 500 });
      }

      const { data, contracts, violations, structure, graph } = result.value;

      if (url.pathname === "/project") {
        const selectedFeature = url.searchParams.get("feature") ?? undefined;
        const content = renderProject(contracts, selectedFeature, structure);
        const html = renderLayout("project", content);
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      if (url.pathname === "/graph") {
        const graphData = buildGraphData(contracts, structure, graph);
        const content = renderGraph(graphData.nodes, graphData.edges);
        const html = renderLayout("graph", content);
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      // Default: Summary
      const content = renderSummary(data, violations, structure);
      const html = renderLayout("summary", content);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    },
  });

  return {
    ok: true,
    value: {
      url: `http://localhost:${port}`,
      port,
      stop: () => realServer.stop(),
    },
  };
}

// Keep for backward compat / testing
export async function renderDashboard(
  projectRoot: string
): Promise<Result<string, DashboardError>> {
  const result = await collectData(projectRoot);
  if (!result.ok) return result;

  const content = renderSummary(
    result.value.data,
    result.value.violations,
    result.value.structure
  );
  const html = renderLayout("summary", content);
  return { ok: true, value: html };
}

export async function renderHtml(
  projectRoot: string
): Promise<Result<string, DashboardError>> {
  return renderDashboard(projectRoot);
}

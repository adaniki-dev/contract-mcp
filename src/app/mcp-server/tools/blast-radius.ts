import { compileAll } from "@features/compiler";
import { validateAll } from "@features/validator";
import { DependencyGraph } from "@entities/dependency-graph";
import { xmlSuccess, xmlError, formatBlastRadius } from "@shared/lib/xml";
import type {
  BlastRadius,
  BlastRadiusLevel,
  BlastRadiusFeature,
  BlastDirection,
  RiskLevel,
  Contract,
} from "@shared/types/contract.types";

const STATUS_WEIGHT: Record<string, number> = {
  active: 3,
  draft: 1,
  deprecated: 0.5,
};

function isCritical(contract: Contract): boolean {
  return contract.contract.status === "active" && contract.rules.length >= 3;
}

function calculateRiskScore(
  levels: BlastRadiusLevel[],
  direction: BlastDirection
): number {
  let score = 0;
  for (const level of levels) {
    const depthWeight = 1 / level.depth;
    for (const f of level.features) {
      const statusWeight = STATUS_WEIGHT[f.status] ?? 1;
      const confidence = f.edgeConfidence ?? 1;
      const base = 1 + f.rulesCount * 0.5;
      score += base * statusWeight * depthWeight * confidence;
    }
  }
  if (direction === "upstream") score *= 1.5;
  return Math.round(score * 10) / 10;
}

function riskLevel(score: number): RiskLevel {
  if (score >= 30) return "high";
  if (score >= 10) return "medium";
  return "low";
}

export async function handleBlastRadius(args: {
  feature: string;
  direction?: string;
}): Promise<string> {
  try {
    const direction: BlastDirection =
      args.direction === "downstream" ? "downstream" : "upstream";

    const compileResult = await compileAll(undefined, process.cwd());
    if (!compileResult.ok) {
      return xmlError(
        "blast_radius",
        "COMPILE_ERROR",
        compileResult.error.map((e) => e.message).join("; ")
      );
    }

    const contracts = compileResult.value.contracts;
    const contractMap = new Map<string, Contract>();
    for (const c of contracts) {
      contractMap.set(c.contract.feature, c);
    }

    if (!contractMap.has(args.feature)) {
      return xmlError(
        "blast_radius",
        "FEATURE_NOT_FOUND",
        `Feature "${args.feature}" not found in compiled contracts`
      );
    }

    const graph = DependencyGraph.fromContracts(contracts);

    // Enrich with validation data for confidence scoring
    const validateResult = await validateAll(process.cwd());
    if (validateResult.ok) {
      graph.enrichWithValidation(validateResult.value);
    }

    const levelsMap = graph.getBlastRadiusLevels(args.feature, direction);

    const levels: BlastRadiusLevel[] = [];
    let totalAffected = 0;

    for (const [depth, features] of [...levelsMap.entries()].sort((a, b) => a[0] - b[0])) {
      const levelFeatures: BlastRadiusFeature[] = [];
      for (const featureName of features) {
        const c = contractMap.get(featureName);
        if (!c) continue;
        // Get edge confidence: for upstream, the edge is featureName→args.feature
        // For downstream, the edge is args.feature→featureName (at depth 1)
        const edgeConfidence = direction === "upstream"
          ? graph.getEdgeConfidence(featureName, args.feature)
          : graph.getEdgeConfidence(args.feature, featureName);
        levelFeatures.push({
          feature: featureName,
          status: c.contract.status,
          rulesCount: c.rules.length,
          dependenciesCount: c.dependencies.internal.length,
          critical: isCritical(c),
          edgeConfidence: edgeConfidence || undefined,
        });
      }
      if (levelFeatures.length > 0) {
        levels.push({ depth, features: levelFeatures });
        totalAffected += levelFeatures.length;
      }
    }

    const riskScore = calculateRiskScore(levels, direction);
    const risk = riskLevel(riskScore);

    const radius: BlastRadius = {
      feature: args.feature,
      direction,
      totalAffected,
      riskScore,
      risk,
      levels,
    };

    return xmlSuccess("blast_radius", formatBlastRadius(radius));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("blast_radius", "INTERNAL_ERROR", message);
  }
}

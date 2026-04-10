import { compileAll } from "@features/compiler";
import { loadYamlFile, stringifyYaml } from "@shared/lib/yaml";
import type {
  Index,
  IndexEntry,
  IndexError,
  DriftReport,
  Result,
  Contract,
} from "@shared/types/contract.types";
import {
  DEFAULT_CONTRACTS_DIR,
  DEFAULT_INDEX_PATH,
  CONTRACT_FILE_PATTERN,
} from "@shared/config";

function contractToEntry(contract: Contract): IndexEntry {
  const featureSlug = contract.contract.feature;
  return {
    feature: featureSlug,
    contractPath: `${featureSlug}.contract.yaml`,
    status: contract.contract.status,
    description: contract.contract.description,
    dependsOn: contract.dependencies.internal.map((d) => d.feature),
    exportsCount:
      contract.exports.functions.length + contract.exports.types.length,
    rulesCount: contract.rules.length,
  };
}

export async function buildIndex(
  contractsDir?: string,
  projectRoot?: string
): Promise<Result<Index, IndexError>> {
  const dir = contractsDir ?? DEFAULT_CONTRACTS_DIR;

  const compileResult = await compileAll(dir, projectRoot);

  if (!compileResult.ok) {
    return {
      ok: false,
      error: {
        message: `Failed to compile contracts: ${compileResult.error.map((e) => e.message).join(", ")}`,
      },
    };
  }

  const entries = compileResult.value.contracts.map(contractToEntry);

  const index: Index = {
    version: "1.0.0",
    project: "contract-mcp",
    updatedAt: new Date().toISOString(),
    contractsDir: dir,
    features: entries,
  };

  return { ok: true, value: index };
}

export async function detectDrift(
  indexPath?: string,
  contractsDir?: string
): Promise<DriftReport> {
  const idxPath = indexPath ?? DEFAULT_INDEX_PATH;
  const dir = contractsDir ?? DEFAULT_CONTRACTS_DIR;

  // Load existing index
  const existingResult = await loadYamlFile<Index>(idxPath);
  const existingFeatures: Map<string, IndexEntry> = new Map();

  if (existingResult.ok) {
    for (const entry of existingResult.value.features) {
      existingFeatures.set(entry.feature, entry);
    }
  }

  // Build fresh index
  const freshResult = await buildIndex(dir);
  const freshFeatures: Map<string, IndexEntry> = new Map();

  if (freshResult.ok) {
    for (const entry of freshResult.value.features) {
      freshFeatures.set(entry.feature, entry);
    }
  }

  // Compare
  const orphanedContracts: string[] = [];
  const missingContracts: string[] = [];
  const outdatedEntries: string[] = [];

  // Features in fresh but not in existing index => orphaned (not indexed)
  for (const feature of freshFeatures.keys()) {
    if (!existingFeatures.has(feature)) {
      orphanedContracts.push(feature);
    }
  }

  // Features in existing index but not in fresh => missing (no contract file)
  for (const feature of existingFeatures.keys()) {
    if (!freshFeatures.has(feature)) {
      missingContracts.push(feature);
    }
  }

  // Features in both but with different metadata => outdated
  for (const [feature, freshEntry] of freshFeatures) {
    const existingEntry = existingFeatures.get(feature);
    if (!existingEntry) continue;

    if (
      existingEntry.status !== freshEntry.status ||
      existingEntry.description !== freshEntry.description ||
      existingEntry.exportsCount !== freshEntry.exportsCount ||
      existingEntry.rulesCount !== freshEntry.rulesCount ||
      existingEntry.contractPath !== freshEntry.contractPath ||
      JSON.stringify(existingEntry.dependsOn.sort()) !==
        JSON.stringify(freshEntry.dependsOn.sort())
    ) {
      outdatedEntries.push(feature);
    }
  }

  return {
    orphanedContracts,
    missingContracts,
    outdatedEntries,
    hasDrift:
      orphanedContracts.length > 0 ||
      missingContracts.length > 0 ||
      outdatedEntries.length > 0,
  };
}

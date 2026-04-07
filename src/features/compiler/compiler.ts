import { loadContract } from "@entities/contract";
import type {
  Contract,
  CompileResult,
  CompileError,
  Diagnostic,
  Result,
} from "@shared/types/contract.types";
import { DEFAULT_CONTRACTS_DIR, CONTRACT_FILE_PATTERN } from "@shared/config";
import { join } from "path";

const RECURSIVE_PATTERN = "**/*.contract.yaml";

export async function compileOne(
  contractPath: string
): Promise<Result<Contract, CompileError[]>> {
  return loadContract(contractPath);
}

async function scanContracts(dir: string, recursive: boolean): Promise<string[]> {
  const pattern = recursive ? RECURSIVE_PATTERN : CONTRACT_FILE_PATTERN;
  const glob = new Bun.Glob(pattern);
  const paths: string[] = [];

  for (const filePath of glob.scanSync({ cwd: dir, absolute: true })) {
    if (filePath.includes("/_schema/") || filePath.includes("/node_modules/")) {
      continue;
    }
    paths.push(filePath);
  }

  return paths;
}

export async function compileAll(
  contractsDir?: string,
  projectRoot?: string
): Promise<Result<CompileResult, CompileError[]>> {
  const dir = contractsDir ?? DEFAULT_CONTRACTS_DIR;

  const contracts: Contract[] = [];
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();

  // Scan contracts/ directory (flat)
  const contractPaths = await scanContracts(dir, false);

  // Also scan src/ for feature-local contracts (recursive)
  if (projectRoot) {
    const srcPaths = await scanContracts(join(projectRoot, "src"), true);
    contractPaths.push(...srcPaths);
  }

  let totalFiles = 0;

  for (const filePath of contractPaths) {
    totalFiles++;
    const result = await loadContract(filePath);

    if (result.ok) {
      // Deduplicate by feature name
      const featureName = result.value.contract.feature;
      if (seen.has(featureName)) {
        diagnostics.push({
          rule: "duplicate-contract",
          message: `Duplicate contract for feature "${featureName}" found at ${filePath}`,
          severity: "warning",
          path: filePath,
        });
        continue;
      }
      seen.add(featureName);
      contracts.push(result.value);
    } else {
      for (const err of result.error) {
        diagnostics.push({
          rule: "compile-error",
          message: err.message,
          severity: err.severity,
          path: err.path,
        });
      }
    }
  }

  // If we found files but ALL failed, return a critical error
  if (totalFiles > 0 && contracts.length === 0) {
    return {
      ok: false,
      error: [
        {
          path: dir,
          message: "All contracts failed to compile",
          severity: "error",
        },
      ],
    };
  }

  // Validate cross-references: check that internal dependency features exist
  const featureNames = new Set(contracts.map((c) => c.contract.feature));

  for (const contract of contracts) {
    for (const dep of contract.dependencies.internal) {
      if (!featureNames.has(dep.feature)) {
        diagnostics.push({
          rule: "valid-references",
          message: `Internal dependency "${dep.feature}" referenced by "${contract.contract.feature}" does not exist in compiled contracts`,
          severity: "warning",
          path: contract.contract.feature,
        });
      }
    }
  }

  return {
    ok: true,
    value: { contracts, diagnostics },
  };
}

import { loadContract } from "@entities/contract";
import type {
  Contract,
  CompileResult,
  CompileError,
  Diagnostic,
  Result,
} from "@shared/types/contract.types";
import { DEFAULT_CONTRACTS_DIR, CONTRACT_FILE_PATTERN } from "@shared/config";

export async function compileOne(
  contractPath: string
): Promise<Result<Contract, CompileError[]>> {
  return loadContract(contractPath);
}

export async function compileAll(
  contractsDir?: string
): Promise<Result<CompileResult, CompileError[]>> {
  const dir = contractsDir ?? DEFAULT_CONTRACTS_DIR;
  const glob = new Bun.Glob(CONTRACT_FILE_PATTERN);

  const contracts: Contract[] = [];
  const diagnostics: Diagnostic[] = [];
  let totalFiles = 0;

  for (const filePath of glob.scanSync({ cwd: dir, absolute: true })) {
    // Skip files in _schema/ subdirectory
    if (filePath.includes("/_schema/")) {
      continue;
    }

    totalFiles++;
    const result = await loadContract(filePath);

    if (result.ok) {
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

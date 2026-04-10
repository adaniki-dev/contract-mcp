import { compileAll } from "@features/compiler";
import { validate } from "@features/validator";
import { detectDrift } from "@features/indexer";
import { DEFAULT_CONTRACTS_DIR, DEFAULT_INDEX_PATH } from "@shared/config";
import type {
  CheckCommitResult,
  CheckCommitError,
  AffectedFeature,
  ValidationResult,
  Contract,
  Result,
} from "@shared/types/contract.types";
import { join, normalize } from "path";

async function getStagedFiles(projectRoot: string): Promise<Result<string[], CheckCommitError>> {
  // Verify it's a git repo
  const gitHead = Bun.file(join(projectRoot, ".git", "HEAD"));
  if (!(await gitHead.exists())) {
    return {
      ok: false,
      error: { code: "NOT_A_GIT_REPO", message: `${projectRoot} is not a git repository` },
    };
  }

  try {
    const proc = Bun.spawn(["git", "diff", "--cached", "--name-only"], {
      cwd: projectRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      return {
        ok: false,
        error: { code: "GIT_ERROR", message: stderr || "git diff failed" },
      };
    }

    const files = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return { ok: true, value: files };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown git error";
    return { ok: false, error: { code: "GIT_ERROR", message } };
  }
}

function normalizePath(p: string): string {
  return normalize(p).replace(/\\/g, "/");
}

/**
 * A staged file affects a feature if:
 * 1. It matches any contract.files[].path exactly, OR
 * 2. It's inside a directory declared in contract.files (prefix match on dir)
 */
function matchAffectedFeatures(
  stagedFiles: string[],
  contracts: Contract[]
): AffectedFeature[] {
  const normalizedStaged = stagedFiles.map(normalizePath);
  const featureMap = new Map<string, Set<string>>();

  for (const contract of contracts) {
    const featureName = contract.contract.feature;

    // Build the set of "owned directories" from contract file paths
    const ownedDirs = new Set<string>();
    const ownedFiles = new Set<string>();
    for (const f of contract.files) {
      const norm = normalizePath(f.path);
      ownedFiles.add(norm);
      // Add parent dir
      const lastSlash = norm.lastIndexOf("/");
      if (lastSlash >= 0) {
        ownedDirs.add(norm.slice(0, lastSlash));
      }
    }

    for (const staged of normalizedStaged) {
      let matched = false;

      // Exact file match
      if (ownedFiles.has(staged)) {
        matched = true;
      } else {
        // Prefix match on any owned directory
        for (const dir of ownedDirs) {
          if (staged === dir || staged.startsWith(dir + "/")) {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        if (!featureMap.has(featureName)) {
          featureMap.set(featureName, new Set());
        }
        featureMap.get(featureName)!.add(staged);
      }
    }
  }

  const result: AffectedFeature[] = [];
  for (const [feature, files] of featureMap) {
    result.push({ feature, stagedFiles: [...files].sort() });
  }
  return result.sort((a, b) => a.feature.localeCompare(b.feature));
}

export async function checkCommit(
  projectRoot: string
): Promise<Result<CheckCommitResult, CheckCommitError>> {
  // 1. Get staged files
  const stagedResult = await getStagedFiles(projectRoot);
  if (!stagedResult.ok) return stagedResult;
  const stagedFiles = stagedResult.value;

  // 2. Compile all contracts
  const contractsDir = join(projectRoot, DEFAULT_CONTRACTS_DIR);
  const compileResult = await compileAll(contractsDir, projectRoot);
  if (!compileResult.ok) {
    return {
      ok: false,
      error: {
        code: "COMPILE_ERROR",
        message: compileResult.error.map((e) => e.message).join("; "),
      },
    };
  }

  const contracts = compileResult.value.contracts;

  // 3. Detect affected features
  const affectedFeatures = matchAffectedFeatures(stagedFiles, contracts);

  // 4. Validate each affected feature
  const validationResults: ValidationResult[] = [];
  for (const af of affectedFeatures) {
    const vr = await validate(af.feature, projectRoot);
    if (vr.ok) {
      validationResults.push(vr.value);
    } else {
      // Treat validation error as a violation for reporting
      validationResults.push({
        feature: af.feature,
        valid: false,
        violations: [
          {
            rule: "validation-error",
            message: vr.error.message,
            severity: "error",
          },
        ],
      });
    }
  }

  // 5. Drift check (non-blocking warning)
  const driftReport = await detectDrift(
    join(projectRoot, DEFAULT_INDEX_PATH),
    contractsDir
  );

  // 6. Aggregate result
  let errorCount = 0;
  let warningCount = 0;
  for (const vr of validationResults) {
    for (const v of vr.violations) {
      if (v.severity === "error") errorCount++;
      else if (v.severity === "warning") warningCount++;
    }
  }

  const passed = errorCount === 0;

  return {
    ok: true,
    value: {
      stagedFiles,
      affectedFeatures,
      validationResults,
      driftReport,
      passed,
      errorCount,
      warningCount,
    },
  };
}

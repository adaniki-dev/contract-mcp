import { compileOne, compileAll } from "@features/compiler";
import { DependencyGraph } from "@entities/dependency-graph";
import {
  initParsers,
  analyzeImports,
  analyzeExports,
} from "@shared/lib/parsers";
import type {
  ValidationResult,
  ValidationError,
  Violation,
  Result,
  Contract,
} from "@shared/types/contract.types";
import { DEFAULT_CONTRACTS_DIR } from "@shared/config";
import { join } from "path";

/**
 * Read a file's text content, returning null if it doesn't exist.
 */
async function readFileSafe(path: string): Promise<string | null> {
  const file = Bun.file(path);
  if (await file.exists()) {
    return file.text();
  }
  return null;
}

/**
 * Collect all .ts files in a directory (non-recursive is fine for a feature folder).
 */
async function collectTsFiles(dir: string): Promise<string[]> {
  const glob = new Bun.Glob("**/*.ts");
  const files: string[] = [];
  for await (const path of glob.scan({ cwd: dir, absolute: true })) {
    // Skip test files
    if (!path.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Extract the feature name from an import source like "@features/compiler" -> "compiler"
 */
function extractFeatureFromImport(source: string): string | null {
  const match = source.match(/^@features\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Check exports-match rule: barrel file exports must match contract declarations.
 */
function findBarrelPath(contract: Contract, projectRoot: string): string {
  // 1. Look for an index.ts in the contract's declared files
  const barrelFile = contract.files.find(
    (f) => f.path.endsWith("/index.ts") || f.path === "index.ts"
  );
  if (barrelFile) {
    return join(projectRoot, barrelFile.path);
  }

  // 2. Search src/**/features/{name}/index.ts then src/**/{name}/index.ts
  const feature = contract.contract.feature;
  const patterns = [
    `src/**/features/${feature}/index.ts`,
    `src/**/${feature}/index.ts`,
  ];

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for (const match of glob.scanSync({ cwd: projectRoot, absolute: true })) {
      if (!match.includes("/node_modules/")) {
        return match;
      }
    }
  }

  // 3. Last fallback
  return join(projectRoot, "src", "features", feature, "index.ts");
}

async function checkExportsMatch(
  contract: Contract,
  projectRoot: string
): Promise<Violation[]> {
  const violations: Violation[] = [];
  const feature = contract.contract.feature;
  const barrelPath = findBarrelPath(contract, projectRoot);

  const barrelCode = await readFileSafe(barrelPath);
  if (barrelCode === null) {
    if (contract.exports.functions.length > 0) {
      violations.push({
        rule: "exports-match",
        message: `Barrel file not found at ${barrelPath} but contract declares ${contract.exports.functions.length} function export(s)`,
        severity: "error",
        file: barrelPath,
      });
    }
    return violations;
  }

  const exports = analyzeExports(barrelCode);
  const exportedNames = new Set(exports.map((e) => e.name));

  for (const fn of contract.exports.functions) {
    if (!exportedNames.has(fn.name)) {
      violations.push({
        rule: "exports-match",
        message: `Function "${fn.name}" declared in contract but not exported from barrel`,
        severity: "error",
        file: barrelPath,
      });
    }
  }

  return violations;
}

/**
 * Check files-exist rule: all files declared in contract must exist.
 */
async function checkFilesExist(
  contract: Contract,
  projectRoot: string
): Promise<Violation[]> {
  const violations: Violation[] = [];

  for (const file of contract.files) {
    const fullPath = join(projectRoot, file.path);
    const exists = await Bun.file(fullPath).exists();
    if (!exists) {
      violations.push({
        rule: "files-exist",
        message: `File "${file.path}" declared in contract does not exist`,
        severity: "warning",
        file: fullPath,
      });
    }
  }

  return violations;
}

/**
 * Check deps-declared and no-cross-feature-imports rules:
 * Imports from @features/X are only allowed if X is in dependencies.internal.
 */
async function checkDependencyImports(
  contract: Contract,
  projectRoot: string
): Promise<Violation[]> {
  const violations: Violation[] = [];
  const feature = contract.contract.feature;
  // Derive feature directory from contract files, fallback to convention
  const barrelPath = findBarrelPath(contract, projectRoot);
  const featureDir = join(barrelPath, "..");

  const declaredDeps = new Set(
    contract.dependencies.internal.map((d) => d.feature)
  );

  let tsFiles: string[];
  try {
    tsFiles = await collectTsFiles(featureDir);
  } catch {
    // Feature directory doesn't exist — skip this check
    return violations;
  }

  for (const filePath of tsFiles) {
    const code = await readFileSafe(filePath);
    if (!code) continue;

    const imports = analyzeImports(code);

    for (const imp of imports) {
      const importedFeature = extractFeatureFromImport(imp.source);
      if (importedFeature && importedFeature !== feature) {
        if (!declaredDeps.has(importedFeature)) {
          violations.push({
            rule: "deps-declared",
            message: `Import from "@features/${importedFeature}" is not declared in dependencies.internal`,
            severity: "error",
            file: filePath,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Validate a single feature against its contract.
 */
export async function validate(
  feature: string,
  projectRoot: string
): Promise<Result<ValidationResult, ValidationError>> {
  const contractPath = join(
    projectRoot,
    DEFAULT_CONTRACTS_DIR,
    feature + ".contract.yaml"
  );

  const compileResult = await compileOne(contractPath);

  if (!compileResult.ok) {
    const messages = compileResult.error.map((e) => e.message).join("; ");
    return {
      ok: false,
      error: { feature, message: `Failed to compile contract: ${messages}` },
    };
  }

  const contract = compileResult.value;

  await initParsers();

  const violations: Violation[] = [
    ...(await checkExportsMatch(contract, projectRoot)),
    ...(await checkFilesExist(contract, projectRoot)),
    ...(await checkDependencyImports(contract, projectRoot)),
  ];

  return {
    ok: true,
    value: {
      feature,
      valid: violations.length === 0,
      violations,
    },
  };
}

/**
 * Validate all features in a project.
 */
export async function validateAll(
  projectRoot: string
): Promise<Result<ValidationResult[], ValidationError>> {
  const contractsDir = join(projectRoot, DEFAULT_CONTRACTS_DIR);
  const compileResult = await compileAll(contractsDir, projectRoot);

  if (!compileResult.ok) {
    const messages = compileResult.error.map((e) => e.message).join("; ");
    return {
      ok: false,
      error: { feature: "*", message: `Failed to compile contracts: ${messages}` },
    };
  }

  const { contracts } = compileResult.value;

  await initParsers();

  // Check circular dependencies
  const graph = DependencyGraph.fromContracts(contracts);
  const cycles = graph.detectCircular();

  // Map feature names to their cycle violations
  const cycleViolations = new Map<string, Violation[]>();
  for (const cycle of cycles) {
    const cycleStr = [...cycle, cycle[0]].join(" -> ");
    for (const feature of cycle) {
      if (!cycleViolations.has(feature)) {
        cycleViolations.set(feature, []);
      }
      cycleViolations.get(feature)!.push({
        rule: "no-circular-deps",
        message: `Circular dependency detected: ${cycleStr}`,
        severity: "error",
      });
    }
  }

  // Validate each feature
  const results: ValidationResult[] = [];

  for (const contract of contracts) {
    const feature = contract.contract.feature;

    const violations: Violation[] = [
      ...(cycleViolations.get(feature) ?? []),
      ...(await checkExportsMatch(contract, projectRoot)),
      ...(await checkFilesExist(contract, projectRoot)),
      ...(await checkDependencyImports(contract, projectRoot)),
    ];

    results.push({
      feature,
      valid: violations.length === 0,
      violations,
    });
  }

  return { ok: true, value: results };
}

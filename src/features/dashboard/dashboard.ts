import { compileAll } from "@features/compiler";
import { validateAll } from "@features/validator";
import type {
  DashboardData,
  FeatureSummary,
  DashboardError,
  Result,
  Contract,
  ValidationResult,
} from "@shared/types/contract.types";
import { DEFAULT_CONTRACTS_DIR } from "@shared/config";
import { join } from "path";

/**
 * Build DashboardData from compiled contracts and validation results.
 */
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
    project: "zero-human",
    totalFeatures: contracts.length,
    totalRules,
    totalViolations,
    features,
  };
}

/**
 * Format a terminal table from DashboardData using Unicode box-drawing characters.
 */
function formatTable(data: DashboardData): string {
  // Column widths
  const colFeature = 14;
  const colStatus = 9;
  const colValid = 9;
  const colViolations = 12;
  const colDeps = 6;
  const colRules = 7;

  const totalWidth =
    colFeature + colStatus + colValid + colViolations + colDeps + colRules + 7; // 7 for separators

  const pad = (s: string, w: number) => (" " + s).padEnd(w);

  // Title row
  const title = "zero-human Dashboard";
  const titlePadded = title
    .padStart(Math.floor((totalWidth - 2 + title.length) / 2))
    .padEnd(totalWidth - 2);

  const lines: string[] = [];

  // Top border
  lines.push("╔" + "═".repeat(totalWidth - 2) + "╗");
  lines.push("║" + titlePadded + "║");

  // Header separator
  lines.push(
    "╠" +
      "═".repeat(colFeature) +
      "╦" +
      "═".repeat(colStatus) +
      "╦" +
      "═".repeat(colValid) +
      "╦" +
      "═".repeat(colViolations) +
      "╦" +
      "═".repeat(colDeps) +
      "╦" +
      "═".repeat(colRules) +
      "╣"
  );

  // Header row
  lines.push(
    "║" +
      pad("Feature", colFeature) +
      "║" +
      pad("Status", colStatus) +
      "║" +
      pad("Valid", colValid) +
      "║" +
      pad("Violations", colViolations) +
      "║" +
      pad("Deps", colDeps) +
      "║" +
      pad("Rules", colRules) +
      "║"
  );

  // Header-body separator
  lines.push(
    "╠" +
      "═".repeat(colFeature) +
      "╬" +
      "═".repeat(colStatus) +
      "╬" +
      "═".repeat(colValid) +
      "╬" +
      "═".repeat(colViolations) +
      "╬" +
      "═".repeat(colDeps) +
      "╬" +
      "═".repeat(colRules) +
      "╣"
  );

  // Data rows
  for (const f of data.features) {
    const validStr = f.valid ? "✓" : "✗";
    lines.push(
      "║" +
        pad(f.feature, colFeature) +
        "║" +
        pad(f.status, colStatus) +
        "║" +
        pad(validStr, colValid) +
        "║" +
        pad(String(f.violationsCount), colViolations) +
        "║" +
        pad(String(f.dependenciesCount), colDeps) +
        "║" +
        pad(String(f.rulesCount), colRules) +
        "║"
    );
  }

  // Summary separator
  lines.push(
    "╠" +
      "═".repeat(colFeature) +
      "╬" +
      "═".repeat(colStatus) +
      "╬" +
      "═".repeat(colValid) +
      "╬" +
      "═".repeat(colViolations) +
      "╬" +
      "═".repeat(colDeps) +
      "╬" +
      "═".repeat(colRules) +
      "╣"
  );

  // Summary row
  const summary = ` Total: ${data.totalFeatures} features │ ${data.totalRules} rules │ ${data.totalViolations} violations`;
  lines.push("║" + summary.padEnd(totalWidth - 2) + "║");

  // Bottom border
  lines.push("╚" + "═".repeat(totalWidth - 2) + "╝");

  return lines.join("\n");
}

/**
 * Render a terminal dashboard for the project.
 */
export async function renderDashboard(
  projectRoot: string
): Promise<Result<string, DashboardError>> {
  // Step 1: Compile all contracts
  const contractsDir = join(projectRoot, DEFAULT_CONTRACTS_DIR);
  const compileResult = await compileAll(contractsDir);

  if (!compileResult.ok) {
    const messages = compileResult.error.map((e) => e.message).join("; ");
    return {
      ok: false,
      error: { message: `Compile failed: ${messages}` },
    };
  }

  const { contracts } = compileResult.value;

  // Step 2: Validate all
  const validateResult = await validateAll(projectRoot);
  const validations: ValidationResult[] = validateResult.ok
    ? validateResult.value
    : [];

  // Step 3: Build dashboard data and format
  const data = buildDashboardData(contracts, validations);
  const table = formatTable(data);

  return { ok: true, value: table };
}

/**
 * Render an HTML dashboard for the project.
 */
export async function renderHtml(
  projectRoot: string
): Promise<Result<string, DashboardError>> {
  // Step 1: Compile all contracts
  const contractsDir = join(projectRoot, DEFAULT_CONTRACTS_DIR);
  const compileResult = await compileAll(contractsDir);

  if (!compileResult.ok) {
    const messages = compileResult.error.map((e) => e.message).join("; ");
    return {
      ok: false,
      error: { message: `Compile failed: ${messages}` },
    };
  }

  const { contracts } = compileResult.value;

  // Step 2: Validate all
  const validateResult = await validateAll(projectRoot);
  const validations: ValidationResult[] = validateResult.ok
    ? validateResult.value
    : [];

  // Step 3: Build dashboard data
  const data = buildDashboardData(contracts, validations);

  // Step 4: Render HTML
  const rows = data.features
    .map(
      (f) =>
        `      <tr>
        <td>${f.feature}</td>
        <td>${f.status}</td>
        <td>${f.valid ? "✓" : "✗"}</td>
        <td>${f.violationsCount}</td>
        <td>${f.dependenciesCount}</td>
        <td>${f.rulesCount}</td>
      </tr>`
    )
    .join("\n");

  const html = `<html>
<head><title>zero-human Dashboard</title></head>
<body>
  <h1>zero-human Dashboard</h1>
  <table border="1">
    <thead>
      <tr>
        <th>Feature</th>
        <th>Status</th>
        <th>Valid</th>
        <th>Violations</th>
        <th>Deps</th>
        <th>Rules</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="6">Total: ${data.totalFeatures} features | ${data.totalRules} rules | ${data.totalViolations} violations</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

  return { ok: true, value: html };
}

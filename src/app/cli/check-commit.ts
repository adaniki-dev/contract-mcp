#!/usr/bin/env bun
import { checkCommit } from "@features/check-commit";

const TAG = "[contract-mcp]";

const result = await checkCommit(process.cwd());

if (!result.ok) {
  if (result.error.code === "NOT_A_GIT_REPO") {
    console.error(`${TAG} pre-commit: not a git repository, skipping.`);
    process.exit(0);
  }
  console.error(`\n${TAG} pre-commit error: ${result.error.message}\n`);
  process.exit(1);
}

const {
  affectedFeatures,
  validationResults,
  passed,
  errorCount,
  warningCount,
  driftReport,
} = result.value;

if (affectedFeatures.length === 0) {
  console.log(`${TAG} No contract-managed features affected, skipping.`);
  process.exit(0);
}

console.log(`\n${TAG} Checking ${affectedFeatures.length} affected feature(s)...`);
for (const af of affectedFeatures) {
  const fileWord = af.stagedFiles.length === 1 ? "file" : "files";
  console.log(`  · ${af.feature} (${af.stagedFiles.length} ${fileWord})`);
}

if (errorCount > 0 || warningCount > 0) {
  console.log();
  for (const vr of validationResults) {
    if (vr.violations.length === 0) continue;
    const icon = vr.valid ? "✓" : "✗";
    console.log(`  ${icon} ${vr.feature}`);
    for (const v of vr.violations) {
      const prefix = v.severity === "error" ? "✗" : v.severity === "warning" ? "⚠" : "·";
      console.log(`    ${prefix} [${v.severity}] ${v.rule}: ${v.message}`);
    }
  }
}

if (driftReport.hasDrift) {
  const parts: string[] = [];
  if (driftReport.orphanedContracts.length > 0) {
    parts.push(`${driftReport.orphanedContracts.length} orphaned`);
  }
  if (driftReport.missingContracts.length > 0) {
    parts.push(`${driftReport.missingContracts.length} missing`);
  }
  if (driftReport.outdatedEntries.length > 0) {
    parts.push(`${driftReport.outdatedEntries.length} outdated`);
  }
  console.log(`\n⚠ Index drift detected: ${parts.join(", ")}`);
  console.log("  Run the 'index' tool to regenerate contracts/index.yaml");
}

if (!passed) {
  console.log(`\n✗ Commit blocked: ${errorCount} error(s) found.\n`);
  process.exit(1);
}

const warnSuffix = warningCount > 0 ? ` (${warningCount} warning${warningCount === 1 ? "" : "s"})` : "";
console.log(`\n✓ Contract check passed${warnSuffix}.\n`);
process.exit(0);

import { compileAll } from "@features/compiler";
import { validateAll } from "@features/validator";
import { xmlSuccess, xmlError, escapeXml } from "@shared/lib/xml";
import type { Contract, ValidationResult } from "@shared/types/contract.types";

interface SearchFilters {
  query?: string;
  status?: string;
  dependsOn?: string;
  dependedBy?: string;
  owner?: string;
  hasRules?: string;
  hasViolations?: boolean;
}

function matchesQuery(c: Contract, q: string): boolean {
  if (c.contract.feature.includes(q)) return true;
  if (c.contract.description.toLowerCase().includes(q)) return true;
  if (c.dependencies.internal.some((d) => d.feature.includes(q))) return true;
  if (c.dependencies.external.some((d) => d.package.toLowerCase().includes(q))) return true;
  if (c.exports.functions.some((f) => f.name.toLowerCase().includes(q))) return true;
  if (c.exports.types.some((t) => t.name.toLowerCase().includes(q))) return true;
  if (c.rules.some((r) => r.id.includes(q) || r.description.toLowerCase().includes(q))) return true;
  if (c.files.some((f) => f.path.toLowerCase().includes(q))) return true;
  return false;
}

function applyFilters(
  contracts: Contract[],
  filters: SearchFilters,
  violations: Map<string, ValidationResult>
): Contract[] {
  let results = contracts;

  if (filters.query) {
    const q = filters.query.toLowerCase();
    results = results.filter((c) => matchesQuery(c, q));
  }

  if (filters.status) {
    const s = filters.status.toLowerCase();
    results = results.filter((c) => c.contract.status === s);
  }

  if (filters.dependsOn) {
    const dep = filters.dependsOn.toLowerCase();
    results = results.filter((c) =>
      c.dependencies.internal.some((d) => d.feature.toLowerCase() === dep)
    );
  }

  if (filters.dependedBy) {
    const target = filters.dependedBy.toLowerCase();
    // Find features that the target depends on — i.e. features listed as deps of target
    const targetContract = contracts.find((c) => c.contract.feature.toLowerCase() === target);
    if (targetContract) {
      const targetDeps = new Set(targetContract.dependencies.internal.map((d) => d.feature));
      results = results.filter((c) => targetDeps.has(c.contract.feature));
    } else {
      results = [];
    }
  }

  if (filters.owner) {
    const o = filters.owner.toLowerCase();
    results = results.filter((c) => c.contract.owner.toLowerCase() === o);
  }

  if (filters.hasRules) {
    const ruleId = filters.hasRules.toLowerCase();
    results = results.filter((c) =>
      c.rules.some((r) => r.id.toLowerCase().includes(ruleId))
    );
  }

  if (filters.hasViolations !== undefined) {
    results = results.filter((c) => {
      const v = violations.get(c.contract.feature);
      const hasV = v ? v.violations.length > 0 : false;
      return filters.hasViolations ? hasV : !hasV;
    });
  }

  return results;
}

function buildFilterSummary(filters: SearchFilters): string {
  const parts: string[] = [];
  if (filters.query) parts.push(`query="${escapeXml(filters.query)}"`);
  if (filters.status) parts.push(`status="${escapeXml(filters.status)}"`);
  if (filters.dependsOn) parts.push(`dependsOn="${escapeXml(filters.dependsOn)}"`);
  if (filters.dependedBy) parts.push(`dependedBy="${escapeXml(filters.dependedBy)}"`);
  if (filters.owner) parts.push(`owner="${escapeXml(filters.owner)}"`);
  if (filters.hasRules) parts.push(`hasRules="${escapeXml(filters.hasRules)}"`);
  if (filters.hasViolations !== undefined) parts.push(`hasViolations="${filters.hasViolations}"`);
  return parts.join(" ");
}

export async function handleSearch(args: {
  query?: string;
  status?: string;
  dependsOn?: string;
  dependedBy?: string;
  owner?: string;
  hasRules?: string;
  hasViolations?: boolean;
}): Promise<string> {
  try {
    const result = await compileAll(undefined, process.cwd());

    if (!result.ok) {
      return xmlError("search", "COMPILE_ERROR", result.error.map((e) => e.message).join("; "));
    }

    // Run validation if hasViolations filter is used
    let violations = new Map<string, ValidationResult>();
    if (args.hasViolations !== undefined) {
      const valResult = await validateAll(process.cwd());
      if (valResult.ok) {
        for (const v of valResult.value) {
          violations.set(v.feature, v);
        }
      }
    }

    const matches = applyFilters(result.value.contracts, args, violations);
    const filterAttrs = buildFilterSummary(args);

    if (matches.length === 0) {
      return xmlSuccess("search", `<results ${filterAttrs} count="0" />`);
    }

    const items = matches.map((c) => {
      const deps = c.dependencies.internal.map((d) => d.feature).join(",") || "none";
      const fns = c.exports.functions.map((f) => f.name).join(",") || "none";
      const v = violations.get(c.contract.feature);
      const violationAttr = v ? ` violations="${v.violations.length}"` : "";
      return `<match feature="${escapeXml(c.contract.feature)}" status="${c.contract.status}" owner="${escapeXml(c.contract.owner)}" deps="${escapeXml(deps)}" exports="${escapeXml(fns)}" rules="${c.rules.length}"${violationAttr}>${escapeXml(c.contract.description)}</match>`;
    }).join("\n");

    return xmlSuccess("search", `<results ${filterAttrs} count="${matches.length}">\n${items}\n</results>`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("search", "INTERNAL_ERROR", message);
  }
}

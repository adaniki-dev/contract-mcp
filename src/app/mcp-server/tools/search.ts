import { compileAll } from "@features/compiler";
import { validateAll } from "@features/validator";
import { xmlSuccess, xmlError, escapeXml } from "@shared/lib/xml";
import { BM25Index } from "@shared/lib/bm25";
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

const FIELD_WEIGHTS: Record<string, number> = {
  feature: 3.0,
  description: 2.0,
  exports: 1.5,
  rules: 1.0,
  deps: 1.0,
  files: 0.5,
};

function buildIndex(contracts: Contract[]): BM25Index {
  const index = new BM25Index({ fieldWeights: FIELD_WEIGHTS });

  for (const c of contracts) {
    index.addDocument({
      id: c.contract.feature,
      fields: {
        feature: c.contract.feature,
        description: c.contract.description,
        exports: [
          ...c.exports.functions.map((f) => f.name),
          ...c.exports.types.map((t) => t.name),
        ].join(" "),
        rules: c.rules.map((r) => `${r.id} ${r.description}`).join(" "),
        deps: [
          ...c.dependencies.internal.map((d) => d.feature),
          ...c.dependencies.external.map((d) => d.package),
        ].join(" "),
        files: c.files.map((f) => f.path).join(" "),
      },
    });
  }

  return index;
}

function applyFilters(
  contracts: Contract[],
  filters: SearchFilters,
  violations: Map<string, ValidationResult>
): Contract[] {
  let results = contracts;

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

    const contracts = result.value.contracts;

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

    // BM25 search when query is provided, otherwise return all
    let ranked: Contract[];
    const scoreMap = new Map<string, number>();

    if (args.query) {
      const index = buildIndex(contracts);
      const bm25Results = index.search(args.query);

      const contractMap = new Map(contracts.map((c) => [c.contract.feature, c]));
      ranked = [];
      for (const r of bm25Results) {
        const c = contractMap.get(r.id);
        if (c) {
          ranked.push(c);
          scoreMap.set(r.id, r.score);
        }
      }
    } else {
      ranked = contracts;
    }

    // Apply non-query filters as post-filtering
    const matches = applyFilters(ranked, args, violations);
    const filterAttrs = buildFilterSummary(args);

    if (matches.length === 0) {
      return xmlSuccess("search", `<results ${filterAttrs} count="0" />`);
    }

    const items = matches.map((c) => {
      const deps = c.dependencies.internal.map((d) => d.feature).join(",") || "none";
      const fns = c.exports.functions.map((f) => f.name).join(",") || "none";
      const v = violations.get(c.contract.feature);
      const violationAttr = v ? ` violations="${v.violations.length}"` : "";
      const score = scoreMap.get(c.contract.feature);
      const scoreAttr = score != null ? ` relevance="${score}"` : "";
      return `<match feature="${escapeXml(c.contract.feature)}" status="${c.contract.status}" owner="${escapeXml(c.contract.owner)}" deps="${escapeXml(deps)}" exports="${escapeXml(fns)}" rules="${c.rules.length}"${violationAttr}${scoreAttr}>${escapeXml(c.contract.description)}</match>`;
    }).join("\n");

    return xmlSuccess("search", `<results ${filterAttrs} count="${matches.length}">\n${items}\n</results>`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("search", "INTERNAL_ERROR", message);
  }
}

import { compileOne } from "@features/compiler";
import { loadYamlFile, stringifyYaml } from "@shared/lib/yaml";
import { xmlSuccess, xmlError, escapeXml } from "@shared/lib/xml";
import { DEFAULT_CONTRACTS_DIR } from "@shared/config";
import { join } from "path";

type ContractSection = "dependencies" | "exports" | "rules" | "files" | "endpoints" | "types";

interface UpdateAction {
  add?: Record<string, unknown>;
  remove?: string[];
  set?: Record<string, unknown>;
}

function findContractPath(feature: string): string {
  return join(process.cwd(), DEFAULT_CONTRACTS_DIR, `${feature}.contract.yaml`);
}

async function findContractRecursive(feature: string): Promise<string | null> {
  // Check contracts/ first
  const centralPath = findContractPath(feature);
  const centralFile = Bun.file(centralPath);
  if (await centralFile.exists()) return centralPath;

  // Search src/ recursively
  const glob = new Bun.Glob(`**/${feature}.contract.yaml`);
  const srcDir = join(process.cwd(), "src");
  for (const match of glob.scanSync({ cwd: srcDir, absolute: true })) {
    if (!match.includes("/node_modules/")) return match;
  }

  return null;
}

function mergeArray(existing: unknown[], adds: unknown[], removes: string[], key: string): unknown[] {
  // Remove items by key match
  let result = existing.filter((item) => {
    if (typeof item === "object" && item !== null) {
      const val = (item as Record<string, unknown>)[key];
      return !removes.includes(String(val));
    }
    return !removes.includes(String(item));
  });

  // Add new items
  result.push(...adds);
  return result;
}

export async function handleUpdate(args: {
  feature: string;
  description?: string;
  status?: string;
  owner?: string;
  addDeps?: string;
  removeDeps?: string;
  addRules?: string;
  removeRules?: string;
  addFiles?: string;
  removeFiles?: string;
}): Promise<string> {
  try {
    // Find the contract
    const contractPath = await findContractRecursive(args.feature);
    if (!contractPath) {
      return xmlError("update", "FEATURE_NOT_FOUND", `Contract not found for feature: ${args.feature}`);
    }

    // Load raw YAML (preserve structure)
    const loadResult = await loadYamlFile<Record<string, unknown>>(contractPath);
    if (!loadResult.ok) {
      return xmlError("update", "PARSE_ERROR", loadResult.error.map((e) => e.message).join("; "));
    }

    const raw = loadResult.value;
    const contract = raw.contract as Record<string, unknown>;
    const changes: string[] = [];

    // Update metadata
    if (args.description) {
      contract.description = args.description;
      changes.push(`description → "${args.description}"`);
    }
    if (args.status) {
      if (!["draft", "active", "deprecated"].includes(args.status)) {
        return xmlError("update", "INVALID_STATUS", `Status must be: draft, active, or deprecated`);
      }
      contract.status = args.status;
      changes.push(`status → ${args.status}`);
    }
    if (args.owner) {
      contract.owner = args.owner;
      changes.push(`owner → ${args.owner}`);
    }

    // Update dependencies
    const deps = raw.dependencies as Record<string, unknown[]>;
    if (args.addDeps) {
      const newDeps = args.addDeps.split(",").map((d) => d.trim()).filter(Boolean);
      const existing = (deps.internal || []) as Record<string, unknown>[];
      const existingNames = new Set(existing.map((d) => d.feature));
      for (const dep of newDeps) {
        if (!existingNames.has(dep)) {
          existing.push({ feature: dep, reason: "TODO: describe reason" });
          changes.push(`+dep: ${dep}`);
        }
      }
      deps.internal = existing;
    }
    if (args.removeDeps) {
      const toRemove = args.removeDeps.split(",").map((d) => d.trim()).filter(Boolean);
      const existing = (deps.internal || []) as Record<string, unknown>[];
      deps.internal = existing.filter((d) => !toRemove.includes(String(d.feature)));
      for (const dep of toRemove) changes.push(`-dep: ${dep}`);
    }

    // Update rules
    const rules = (raw.rules || []) as Record<string, unknown>[];
    if (args.addRules) {
      const newRules = args.addRules.split(",").map((r) => r.trim()).filter(Boolean);
      const existingIds = new Set(rules.map((r) => r.id));
      for (const ruleId of newRules) {
        if (!existingIds.has(ruleId)) {
          rules.push({ id: ruleId, description: "TODO: describe rule", severity: "error", testable: true });
          changes.push(`+rule: ${ruleId}`);
        }
      }
      raw.rules = rules;
    }
    if (args.removeRules) {
      const toRemove = args.removeRules.split(",").map((r) => r.trim()).filter(Boolean);
      raw.rules = rules.filter((r) => !toRemove.includes(String(r.id)));
      for (const r of toRemove) changes.push(`-rule: ${r}`);
    }

    // Update files
    const files = (raw.files || []) as Record<string, unknown>[];
    if (args.addFiles) {
      const newFiles = args.addFiles.split(",").map((f) => f.trim()).filter(Boolean);
      const existingPaths = new Set(files.map((f) => f.path));
      for (const filePath of newFiles) {
        if (!existingPaths.has(filePath)) {
          files.push({ path: filePath, purpose: "TODO: describe purpose" });
          changes.push(`+file: ${filePath}`);
        }
      }
      raw.files = files;
    }
    if (args.removeFiles) {
      const toRemove = args.removeFiles.split(",").map((f) => f.trim()).filter(Boolean);
      raw.files = files.filter((f) => !toRemove.includes(String(f.path)));
      for (const f of toRemove) changes.push(`-file: ${f}`);
    }

    if (changes.length === 0) {
      return xmlSuccess("update", `<update feature="${escapeXml(args.feature)}" changes="0">No changes specified</update>`);
    }

    // Write back
    const yaml = stringifyYaml(raw);
    await Bun.write(contractPath, yaml);

    const changesXml = changes.map((c) => `<change>${escapeXml(c)}</change>`).join("\n");

    return xmlSuccess(
      "update",
      `<update feature="${escapeXml(args.feature)}" changes="${changes.length}" path="${escapeXml(contractPath)}">\n${changesXml}\n</update>`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("update", "INTERNAL_ERROR", message);
  }
}

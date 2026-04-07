import { compileAll } from "@features/compiler";
import { xmlSuccess, xmlError, escapeXml } from "@shared/lib/xml";

export async function handleSearch(args: {
  query: string;
}): Promise<string> {
  try {
    const result = await compileAll(undefined, process.cwd());

    if (!result.ok) {
      return xmlError("search", "COMPILE_ERROR", result.error.map((e) => e.message).join("; "));
    }

    const q = args.query.toLowerCase();
    const matches = result.value.contracts.filter((c) => {
      // Search in feature name
      if (c.contract.feature.includes(q)) return true;
      // Search in description
      if (c.contract.description.toLowerCase().includes(q)) return true;
      // Search in dependency names
      if (c.dependencies.internal.some((d) => d.feature.includes(q))) return true;
      if (c.dependencies.external.some((d) => d.package.toLowerCase().includes(q))) return true;
      // Search in export names
      if (c.exports.functions.some((f) => f.name.toLowerCase().includes(q))) return true;
      if (c.exports.types.some((t) => t.name.toLowerCase().includes(q))) return true;
      // Search in rule ids and descriptions
      if (c.rules.some((r) => r.id.includes(q) || r.description.toLowerCase().includes(q))) return true;
      // Search in file paths
      if (c.files.some((f) => f.path.toLowerCase().includes(q))) return true;
      return false;
    });

    if (matches.length === 0) {
      return xmlSuccess("search", `<results query="${escapeXml(args.query)}" count="0" />`);
    }

    const items = matches.map((c) => {
      const deps = c.dependencies.internal.map((d) => d.feature).join(",") || "none";
      const fns = c.exports.functions.map((f) => f.name).join(",") || "none";
      return `<match feature="${escapeXml(c.contract.feature)}" status="${c.contract.status}" deps="${escapeXml(deps)}" exports="${escapeXml(fns)}" rules="${c.rules.length}">${escapeXml(c.contract.description)}</match>`;
    }).join("\n");

    return xmlSuccess("search", `<results query="${escapeXml(args.query)}" count="${matches.length}">\n${items}\n</results>`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("search", "INTERNAL_ERROR", message);
  }
}

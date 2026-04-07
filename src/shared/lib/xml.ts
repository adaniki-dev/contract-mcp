import type {
  Contract,
  CompileResult,
  ValidationResult,
  Index,
  DriftReport,
} from "@shared/types/contract.types";

// === Core XML primitives ===

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlElement(
  tag: string,
  attrs?: Record<string, string | number | boolean>,
  children?: string
): string {
  const attrStr = attrs
    ? Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
        .join("")
    : "";

  if (children === undefined || children === "") {
    return `<${tag}${attrStr} />`;
  }
  return `<${tag}${attrStr}>${children}</${tag}>`;
}

export function xmlDocument(rootContent: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${rootContent}`;
}

export function xmlSuccess(tool: string, content: string): string {
  return xmlDocument(
    xmlElement("zero-human", { tool, status: "success" }, `\n${content}\n`)
  );
}

export function xmlError(tool: string, code: string, message: string): string {
  return xmlDocument(
    xmlElement(
      "zero-human",
      { tool, status: "error" },
      `\n${xmlElement("error", { code }, escapeXml(message))}\n`
    )
  );
}

// === Contract-aware formatters (token-efficient) ===

export function formatContract(c: Contract): string {
  const deps = c.dependencies.internal.map((d) => d.feature).join(", ") || "none";
  const extDeps = c.dependencies.external.map((d) => d.package).join(", ") || "none";

  const fns = c.exports.functions
    .map((f) => `<fn name="${escapeXml(f.name)}" sig="${escapeXml(f.signature)}" pure="${f.pure}">${escapeXml(f.description)}</fn>`)
    .join("\n");

  const types = c.exports.types
    .map((t) => `<type name="${escapeXml(t.name)}">${escapeXml(t.description)}</type>`)
    .join("\n");

  const rules = c.rules
    .map((r) => `<rule id="${escapeXml(r.id)}" severity="${r.severity}">${escapeXml(r.description)}</rule>`)
    .join("\n");

  const files = c.files
    .map((f) => `<file path="${escapeXml(f.path)}">${escapeXml(f.purpose)}</file>`)
    .join("\n");

  const endpoints = (c.endpoints ?? [])
    .map((e) => `<tool name="${escapeXml(e.tool)}" input="${escapeXml(e.input)}" output="${escapeXml(e.output)}">${escapeXml(e.description)}</tool>`)
    .join("\n");

  let xml = `<feature name="${escapeXml(c.contract.feature)}" version="${c.contract.version}" status="${c.contract.status}">
<description>${escapeXml(c.contract.description)}</description>
<deps internal="${escapeXml(deps)}" external="${escapeXml(extDeps)}" />
<exports>
${fns}
${types}
</exports>
<rules>
${rules}
</rules>
<files>
${files}
</files>`;

  if (endpoints) {
    xml += `\n<endpoints>\n${endpoints}\n</endpoints>`;
  }

  xml += "\n</feature>";
  return xml;
}

export function formatCompileResult(result: CompileResult): string {
  const features = result.contracts
    .map((c) => {
      const deps = c.dependencies.internal.map((d) => d.feature).join(",") || "none";
      const fns = c.exports.functions.map((f) => f.name).join(",") || "none";
      return `<contract feature="${escapeXml(c.contract.feature)}" status="${c.contract.status}" deps="${escapeXml(deps)}" exports="${escapeXml(fns)}" rules="${c.rules.length}" />`;
    })
    .join("\n");

  const diags = result.diagnostics
    .map((d) => `<diagnostic rule="${escapeXml(d.rule)}" severity="${d.severity}" path="${escapeXml(d.path)}">${escapeXml(d.message)}</diagnostic>`)
    .join("\n");

  return `<contracts count="${result.contracts.length}">
${features}
</contracts>
<diagnostics count="${result.diagnostics.length}">
${diags}
</diagnostics>`;
}

export function formatValidationResult(r: ValidationResult): string {
  if (r.violations.length === 0) {
    return `<result feature="${escapeXml(r.feature)}" valid="true" violations="0" />`;
  }

  const violations = r.violations
    .map((v) => `<violation rule="${escapeXml(v.rule)}" severity="${v.severity}"${v.file ? ` file="${escapeXml(v.file)}"` : ""}>${escapeXml(v.message)}</violation>`)
    .join("\n");

  return `<result feature="${escapeXml(r.feature)}" valid="false" violations="${r.violations.length}">
${violations}
</result>`;
}

export function formatValidationResults(results: ValidationResult[]): string {
  const totalViolations = results.reduce((s, r) => s + r.violations.length, 0);
  const allValid = results.every((r) => r.valid);

  const items = results.map(formatValidationResult).join("\n");

  return `<results count="${results.length}" valid="${allValid}" totalViolations="${totalViolations}">
${items}
</results>`;
}

export function formatIndex(index: Index): string {
  const entries = index.features
    .map((f) => {
      const deps = f.dependsOn.join(",") || "none";
      return `<entry feature="${escapeXml(f.feature)}" status="${f.status}" deps="${escapeXml(deps)}" exports="${f.exportsCount}" rules="${f.rulesCount}">${escapeXml(f.description)}</entry>`;
    })
    .join("\n");

  return `<index version="${index.version}" project="${escapeXml(index.project)}" features="${index.features.length}" updated="${index.updatedAt}">
${entries}
</index>`;
}

export function formatDriftReport(report: DriftReport): string {
  const orphaned = report.orphanedContracts
    .map((f) => `<contract feature="${escapeXml(f)}" />`)
    .join("\n");

  const missing = report.missingContracts
    .map((f) => `<contract feature="${escapeXml(f)}" />`)
    .join("\n");

  const outdated = report.outdatedEntries
    .map((f) => `<contract feature="${escapeXml(f)}" />`)
    .join("\n");

  return `<drift hasDrift="${report.hasDrift}">
<orphaned count="${report.orphanedContracts.length}">
${orphaned}
</orphaned>
<missing count="${report.missingContracts.length}">
${missing}
</missing>
<outdated count="${report.outdatedEntries.length}">
${outdated}
</outdated>
</drift>`;
}

// Keep toXml as fallback for generic serialization
export function toXml(data: unknown, tag: string): string {
  if (data === null || data === undefined) {
    return xmlElement(tag);
  }
  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return xmlElement(tag, undefined, escapeXml(String(data)));
  }
  if (Array.isArray(data)) {
    const itemTag = tag.endsWith("s") ? tag.slice(0, -1) : "item";
    const children = data.map((item) => toXml(item, itemTag)).join("\n");
    return xmlElement(tag, { count: data.length }, `\n${children}\n`);
  }
  if (typeof data === "object") {
    const children = Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => toXml(value, key))
      .join("\n");
    return xmlElement(tag, undefined, `\n${children}\n`);
  }
  return xmlElement(tag, undefined, escapeXml(String(data)));
}

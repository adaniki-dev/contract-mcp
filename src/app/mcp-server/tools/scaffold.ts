import { stringifyYaml } from "@shared/lib/yaml";
import { xmlSuccess, xmlError, escapeXml } from "@shared/lib/xml";
import { DEFAULT_CONTRACTS_DIR } from "@shared/config";
import { join } from "path";

function buildContractTemplate(args: {
  feature: string;
  description?: string;
  owner?: string;
  deps?: string;
}): Record<string, unknown> {
  const feature = args.feature;
  const description = args.description || `Feature ${feature}`;
  const owner = args.owner || "team";

  const internal = args.deps
    ? args.deps.split(",").map((d) => d.trim()).filter(Boolean).map((d) => ({
        feature: d,
        reason: "TODO: describe reason",
      }))
    : [];

  return {
    contract: {
      version: "1.0.0",
      feature,
      description,
      owner,
      status: "draft",
    },
    dependencies: {
      internal,
      external: [],
    },
    exports: {
      functions: [],
      types: [],
    },
    rules: [],
    files: [
      { path: `src/features/${feature}/index.ts`, purpose: "Barrel export" },
      { path: `src/features/${feature}/${feature}.ts`, purpose: "Main implementation" },
      { path: `src/features/${feature}/${feature}.test.ts`, purpose: "Tests" },
    ],
  };
}

export async function handleScaffold(args: {
  feature: string;
  description?: string;
  owner?: string;
  deps?: string;
  outputPath?: string;
}): Promise<string> {
  try {
    if (!args.feature || !/^[a-z][a-z0-9-]*$/.test(args.feature)) {
      return xmlError(
        "scaffold",
        "INVALID_FEATURE_NAME",
        `Feature name must be kebab-case: "${args.feature}"`
      );
    }

    const template = buildContractTemplate(args);
    const yaml = stringifyYaml(template);

    if (args.outputPath) {
      const fullPath = join(process.cwd(), args.outputPath);
      await Bun.write(fullPath, yaml);
      return xmlSuccess(
        "scaffold",
        `<scaffold feature="${escapeXml(args.feature)}" saved="${escapeXml(fullPath)}" />`
      );
    }

    const suggestedPath = `${DEFAULT_CONTRACTS_DIR}/${args.feature}.contract.yaml`;

    return xmlSuccess(
      "scaffold",
      `<scaffold feature="${escapeXml(args.feature)}">
<yaml><![CDATA[
${yaml}]]></yaml>
<suggestion>Save to: ${escapeXml(suggestedPath)}</suggestion>
</scaffold>`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("scaffold", "INTERNAL_ERROR", message);
  }
}

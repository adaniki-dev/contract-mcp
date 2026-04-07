import { buildIndex } from "@features/indexer";
import { stringifyYaml } from "@shared/lib/yaml";
import { xmlSuccess, xmlError, toXml } from "@shared/lib/xml";
import { join } from "path";

export async function handleIndex(args: {
  contractsDir?: string;
  outputPath?: string;
}): Promise<string> {
  try {
    const dir = args.contractsDir
      ? join(process.cwd(), args.contractsDir)
      : undefined;

    const result = await buildIndex(dir);

    if (!result.ok) {
      return xmlError("index", "INDEX_ERROR", result.error.message);
    }

    const index = result.value;

    // If outputPath provided, write the YAML index to disk
    if (args.outputPath) {
      const fullPath = join(process.cwd(), args.outputPath);
      const yamlContent = stringifyYaml(index);
      await Bun.write(fullPath, yamlContent);
    }

    return xmlSuccess("index", toXml(index, "index"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("index", "INTERNAL_ERROR", message);
  }
}

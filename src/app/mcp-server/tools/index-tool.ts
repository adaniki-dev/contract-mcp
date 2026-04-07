import { buildIndex } from "@features/indexer";
import { stringifyYaml } from "@shared/lib/yaml";
import { xmlSuccess, xmlError, formatIndex } from "@shared/lib/xml";
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

    if (args.outputPath) {
      const fullPath = join(process.cwd(), args.outputPath);
      await Bun.write(fullPath, stringifyYaml(result.value));
    }

    return xmlSuccess("index", formatIndex(result.value));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("index", "INTERNAL_ERROR", message);
  }
}

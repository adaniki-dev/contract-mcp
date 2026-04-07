import { compileOne } from "@features/compiler";
import { xmlSuccess, xmlError, formatContract } from "@shared/lib/xml";
import { DEFAULT_CONTRACTS_DIR } from "@shared/config";
import { join } from "path";

export async function handleGetFeature(args: {
  feature: string;
}): Promise<string> {
  try {
    const contractPath = join(
      process.cwd(),
      DEFAULT_CONTRACTS_DIR,
      args.feature + ".contract.yaml"
    );

    const result = await compileOne(contractPath);

    if (!result.ok) {
      return xmlError(
        "get_feature",
        "FEATURE_NOT_FOUND",
        result.error.map((e) => e.message).join("; ")
      );
    }

    return xmlSuccess("get_feature", formatContract(result.value));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("get_feature", "INTERNAL_ERROR", message);
  }
}

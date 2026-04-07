import { compileAll } from "@features/compiler";
import { xmlSuccess, xmlError, formatCompileResult } from "@shared/lib/xml";
import { join } from "path";

export async function handleCompile(args: {
  contractsDir?: string;
}): Promise<string> {
  try {
    const dir = args.contractsDir
      ? join(process.cwd(), args.contractsDir)
      : undefined;
    const result = await compileAll(dir, process.cwd());

    if (!result.ok) {
      return xmlError(
        "compile",
        "PARSE_ERROR",
        result.error.map((e) => e.message).join("; ")
      );
    }

    return xmlSuccess("compile", formatCompileResult(result.value));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("compile", "INTERNAL_ERROR", message);
  }
}

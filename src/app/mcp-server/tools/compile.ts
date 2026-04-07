import { compileAll } from "@features/compiler";
import { xmlSuccess, xmlError, toXml } from "@shared/lib/xml";
import { join } from "path";

export async function handleCompile(args: {
  contractsDir?: string;
}): Promise<string> {
  try {
    const dir = args.contractsDir
      ? join(process.cwd(), args.contractsDir)
      : undefined;
    const result = await compileAll(dir);

    if (!result.ok) {
      return xmlError(
        "compile",
        "PARSE_ERROR",
        result.error.map((e) => e.message).join("; ")
      );
    }

    const { contracts, diagnostics } = result.value;
    const contractsXml = contracts
      .map(
        (c) =>
          `<contract feature="${c.contract.feature}" status="${c.contract.status}" />`
      )
      .join("\n");
    const diagXml =
      diagnostics.length > 0
        ? toXml(diagnostics, "diagnostics")
        : '<diagnostics count="0" />';

    return xmlSuccess(
      "compile",
      `<contracts count="${contracts.length}">\n${contractsXml}\n</contracts>\n${diagXml}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("compile", "INTERNAL_ERROR", message);
  }
}

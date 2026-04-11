import { compileAll } from "@features/compiler";
import { DependencyGraph } from "@entities/dependency-graph";
import { xmlSuccess, xmlError, formatCommunityReport } from "@shared/lib/xml";

export async function handleAnalyzeStructure(args: {
  projectRoot?: string;
}): Promise<string> {
  try {
    const root = args.projectRoot ?? process.cwd();
    const compileResult = await compileAll(undefined, root);

    if (!compileResult.ok) {
      return xmlError(
        "analyze_structure",
        "COMPILE_ERROR",
        compileResult.error.map((e) => e.message).join("; ")
      );
    }

    const graph = DependencyGraph.fromContracts(compileResult.value.contracts);
    const report = graph.analyzeStructure();

    return xmlSuccess("analyze_structure", formatCommunityReport(report));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("analyze_structure", "INTERNAL_ERROR", message);
  }
}

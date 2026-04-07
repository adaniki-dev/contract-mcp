import { compileAll } from "@features/compiler";
import { DependencyGraph } from "@entities/dependency-graph";
import { xmlSuccess, xmlError, xmlElement, toXml } from "@shared/lib/xml";

export async function handleGetDependencies(args: {
  feature: string;
  depth?: number;
}): Promise<string> {
  try {
    const result = await compileAll(undefined, process.cwd());

    if (!result.ok) {
      return xmlError(
        "get_dependencies",
        "COMPILE_ERROR",
        result.error.map((e) => e.message).join("; ")
      );
    }

    const graph = DependencyGraph.fromContracts(result.value.contracts);

    if (!graph.has(args.feature)) {
      return xmlError(
        "get_dependencies",
        "FEATURE_NOT_FOUND",
        `Feature "${args.feature}" not found in compiled contracts`
      );
    }

    const directDeps = graph.getDependencies(args.feature);
    const transitiveDeps = graph.getTransitiveDeps(args.feature);
    const circularCycles = graph.detectCircular();
    const depth = graph.getDepth(args.feature);

    const directXml = directDeps
      .map((d) => xmlElement("dependency", { feature: d }))
      .join("\n");

    const transitiveXml = transitiveDeps
      .map((d) => xmlElement("dependency", { feature: d }))
      .join("\n");

    // Check if this feature is involved in any circular dependency
    const relevantCycles = circularCycles.filter((cycle) =>
      cycle.includes(args.feature)
    );

    let warningXml = "";
    if (relevantCycles.length > 0) {
      const cycleDetails = relevantCycles
        .map((cycle) => xmlElement("cycle", undefined, [...cycle, cycle[0]].join(" -> ")))
        .join("\n");
      warningXml = `\n${xmlElement("warnings", undefined, `\n${cycleDetails}\n`)}`;
    }

    const content = [
      xmlElement("feature", { name: args.feature, depth: depth }),
      xmlElement(
        "direct",
        { count: directDeps.length },
        directDeps.length > 0 ? `\n${directXml}\n` : undefined
      ),
      xmlElement(
        "transitive",
        { count: transitiveDeps.length },
        transitiveDeps.length > 0 ? `\n${transitiveXml}\n` : undefined
      ),
      warningXml,
    ]
      .filter(Boolean)
      .join("\n");

    return xmlSuccess("get_dependencies", content);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("get_dependencies", "INTERNAL_ERROR", message);
  }
}

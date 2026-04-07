import { detectDrift } from "@features/indexer";
import { xmlSuccess, xmlError, formatDriftReport } from "@shared/lib/xml";

export async function handleDrift(args: {
  indexPath?: string;
  contractsDir?: string;
}): Promise<string> {
  try {
    const report = await detectDrift(args.indexPath, args.contractsDir);
    return xmlSuccess("drift", formatDriftReport(report));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("drift", "INTERNAL_ERROR", message);
  }
}

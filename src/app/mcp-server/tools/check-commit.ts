import { checkCommit } from "@features/check-commit";
import { xmlSuccess, xmlError, formatCheckCommitResult } from "@shared/lib/xml";

export async function handleCheckCommit(args: {
  projectRoot?: string;
}): Promise<string> {
  try {
    const root = args.projectRoot ?? process.cwd();
    const result = await checkCommit(root);

    if (!result.ok) {
      return xmlError("check_commit", result.error.code, result.error.message);
    }

    return xmlSuccess("check_commit", formatCheckCommitResult(result.value));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("check_commit", "INTERNAL_ERROR", message);
  }
}

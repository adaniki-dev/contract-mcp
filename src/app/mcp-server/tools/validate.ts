import { validate, validateAll } from "@features/validator";
import {
  xmlSuccess,
  xmlError,
  formatValidationResult,
  formatValidationResults,
} from "@shared/lib/xml";

export async function handleValidate(args: {
  feature?: string;
  projectRoot?: string;
}): Promise<string> {
  try {
    const root = args.projectRoot ?? process.cwd();

    if (args.feature) {
      const result = await validate(args.feature, root);

      if (!result.ok) {
        return xmlError("validate", "VALIDATION_ERROR", result.error.message);
      }

      return xmlSuccess("validate", formatValidationResult(result.value));
    }

    const result = await validateAll(root);

    if (!result.ok) {
      return xmlError("validate", "VALIDATION_ERROR", result.error.message);
    }

    return xmlSuccess("validate", formatValidationResults(result.value));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("validate", "INTERNAL_ERROR", message);
  }
}

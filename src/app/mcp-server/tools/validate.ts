import { validate, validateAll } from "@features/validator";
import { xmlSuccess, xmlError, toXml, xmlElement } from "@shared/lib/xml";

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

      const { feature, valid, violations } = result.value;
      const violationsXml =
        violations.length > 0
          ? toXml(violations, "violations")
          : '<violations count="0" />';

      return xmlSuccess(
        "validate",
        xmlElement(
          "result",
          { feature, valid },
          `\n${violationsXml}\n`
        )
      );
    }

    // Validate all
    const result = await validateAll(root);

    if (!result.ok) {
      return xmlError("validate", "VALIDATION_ERROR", result.error.message);
    }

    const resultsXml = result.value
      .map((r) => {
        const violationsXml =
          r.violations.length > 0
            ? toXml(r.violations, "violations")
            : '<violations count="0" />';

        return xmlElement(
          "result",
          { feature: r.feature, valid: r.valid },
          `\n${violationsXml}\n`
        );
      })
      .join("\n");

    const totalViolations = result.value.reduce(
      (sum, r) => sum + r.violations.length,
      0
    );
    const allValid = result.value.every((r) => r.valid);

    return xmlSuccess(
      "validate",
      xmlElement(
        "results",
        {
          count: result.value.length,
          valid: allValid,
          totalViolations,
        },
        `\n${resultsXml}\n`
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("validate", "INTERNAL_ERROR", message);
  }
}

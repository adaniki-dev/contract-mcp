import { xmlSuccess, xmlError } from "@shared/lib/xml";

const REFERENCE_GUIDE = `<reference>
<workflow>
<title>Contract-Driven Development</title>
<description>Always work with contracts as the source of truth. Never modify code without checking the contract first.</description>
<steps>
<step order="1">Before coding, run 'search' to find relevant contracts</step>
<step order="2">Run 'get_feature' to read the full contract of the feature you'll modify</step>
<step order="3">Run 'get_dependencies' to understand what depends on this feature</step>
<step order="4">Make your code changes respecting the contract rules</step>
<step order="5">Run 'validate' to verify your changes comply with contracts</step>
<step order="6">If adding a new feature, run 'scaffold' first to generate the contract</step>
<step order="7">If modifying contracts, run 'update' to change them properly</step>
<step order="8">Run 'drift' to ensure the index is up to date</step>
</steps>
</workflow>

<tools>
<category name="discovery">
<tool name="search" when="Finding contracts by keyword, status, dependencies, owner, or violations" />
<tool name="get_feature" when="Reading the full contract of a specific feature before modifying it" />
<tool name="get_dependencies" when="Understanding what depends on a feature before changing it" />
</category>
<category name="analysis">
<tool name="compile" when="Checking if all contracts are valid YAML and follow the schema" />
<tool name="validate" when="Verifying that implementation code matches contract declarations" />
<tool name="drift" when="Checking if the index is out of sync with actual contracts" />
<tool name="index" when="Regenerating the contracts index after changes" />
</category>
<category name="mutation">
<tool name="scaffold" when="Creating a new feature — generates the contract YAML template" />
<tool name="update" when="Modifying an existing contract (status, deps, rules, files)" />
</category>
</tools>

<rules>
<rule severity="critical">Never write code for a feature without reading its contract first</rule>
<rule severity="critical">Never add a dependency without declaring it in the contract</rule>
<rule severity="critical">Always run validate after modifying code to check compliance</rule>
<rule severity="important">Use scaffold to create new features — do not write contracts from scratch</rule>
<rule severity="important">Use update to modify contracts — do not edit YAML manually unless necessary</rule>
<rule severity="important">Run drift periodically to keep the index current</rule>
<rule severity="recommended">Check get_dependencies before modifying shared features to understand impact</rule>
<rule severity="recommended">Use search with hasViolations filter to find broken features before starting work</rule>
</rules>

<claude-md-section>
<![CDATA[
## Contract-Driven Development (MCP Contractor)

This project uses YAML contracts as the source of truth for all features.
An MCP server (contract-mcp) provides tools to manage and validate contracts.

### Workflow

1. Before modifying any feature, read its contract: \`get_feature\`
2. Check dependencies: \`get_dependencies\`
3. After changes, validate: \`validate\`
4. For new features, generate contract first: \`scaffold\`

### Rules

- **No code without a contract.** Every feature must have a \`.contract.yaml\`
- **No undeclared dependencies.** All imports from other features must be in \`dependencies.internal\`
- **Respect the rules.** Each contract defines business rules with severity levels
- **Validate before committing.** Run \`validate\` to ensure compliance

### Contract Location

- Centralized: \`contracts/*.contract.yaml\`
- Feature-local: \`src/**/*.contract.yaml\`

### Available Tools

| Tool | Use When |
|------|----------|
| \`search\` | Finding contracts (supports filters: status, dependsOn, owner, hasViolations) |
| \`get_feature\` | Reading full contract details |
| \`get_dependencies\` | Checking dependency graph |
| \`compile\` | Validating all contract YAML |
| \`validate\` | Checking code matches contracts |
| \`scaffold\` | Creating new feature contracts |
| \`update\` | Modifying existing contracts |
| \`drift\` | Checking index freshness |
| \`index\` | Regenerating the index |
]]>
</claude-md-section>
</reference>`;

export async function handleReference(args: {
  section?: string;
}): Promise<string> {
  try {
    if (args.section === "claude-md") {
      // Return only the CLAUDE.md section for easy copy
      const start = REFERENCE_GUIDE.indexOf("<claude-md-section>");
      const end = REFERENCE_GUIDE.indexOf("</claude-md-section>") + "</claude-md-section>".length;
      return xmlSuccess("reference", REFERENCE_GUIDE.slice(start, end));
    }

    if (args.section === "workflow") {
      const start = REFERENCE_GUIDE.indexOf("<workflow>");
      const end = REFERENCE_GUIDE.indexOf("</workflow>") + "</workflow>".length;
      return xmlSuccess("reference", REFERENCE_GUIDE.slice(start, end));
    }

    if (args.section === "tools") {
      const start = REFERENCE_GUIDE.indexOf("<tools>");
      const end = REFERENCE_GUIDE.indexOf("</tools>") + "</tools>".length;
      return xmlSuccess("reference", REFERENCE_GUIDE.slice(start, end));
    }

    if (args.section === "rules") {
      const start = REFERENCE_GUIDE.indexOf("<rules>");
      const end = REFERENCE_GUIDE.indexOf("</rules>") + "</rules>".length;
      return xmlSuccess("reference", REFERENCE_GUIDE.slice(start, end));
    }

    // Return full reference
    return xmlSuccess("reference", REFERENCE_GUIDE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("reference", "INTERNAL_ERROR", message);
  }
}

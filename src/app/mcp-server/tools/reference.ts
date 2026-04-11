import { xmlSuccess, xmlError } from "@shared/lib/xml";

const REFERENCE_GUIDE = `<reference>
<workflow>
<title>Contract-Driven Development</title>
<description>Always work with contracts as the source of truth. Never modify code without checking the contract first. The contract is the skeleton; the code is the muscle — they must match.</description>
<steps>
<step order="1">Explore: run 'search' (with filters like status, dependsOn, hasViolations) to find relevant contracts</step>
<step order="2">Read: run 'get_feature' to read the full contract of the feature you'll modify</step>
<step order="3">Impact: run 'blast_radius' to see who breaks if you change this feature (risk score + critical flag)</step>
<step order="4">Dependencies: run 'get_dependencies' to understand what this feature relies on</step>
<step order="5">Modify code: respect every rule, signature and declared dependency</step>
<step order="6">Validate: run 'validate' after changes to verify signature-match, exports-match, deps-declared</step>
<step order="7">New feature: run 'scaffold' with basePath matching your project structure (src/features, src/modules, packages/core, etc.)</step>
<step order="8">Update existing contract: use 'update' to add/remove deps, rules, files or change metadata</step>
<step order="9">Pre-commit: run 'check_commit' to validate only features affected by staged changes (fast, surgical)</step>
<step order="10">Install hook: once per project, run 'install_hook' so every git commit is auto-validated</step>
<step order="11">Drift check: run 'drift' to detect if the index is out of sync with actual contracts</step>
<step order="12">Architecture: run 'analyze_structure' to see communities, hubs, bridges and orphans emerging from the graph</step>
</steps>
</workflow>

<tools>
<category name="discovery">
<tool name="search" when="Finding contracts by keyword OR by filters: status, dependsOn, dependedBy, owner, hasRules, hasViolations. Returns compact summary — use get_feature for details." />
<tool name="get_feature" when="Reading the full contract of a specific feature before modifying it (deps, exports, signatures, rules, files, endpoints)" />
<tool name="get_dependencies" when="Getting the downstream dependency graph of a feature (what it depends on, direct + transitive)" />
<tool name="reference" when="Getting the contract-driven development guide itself — use section='claude-md' to get a ready-to-paste CLAUDE.md block" />
</category>
<category name="analysis">
<tool name="compile" when="Checking if all contracts are valid YAML, follow the schema, and have valid cross-references" />
<tool name="validate" when="Verifying that implementation code matches contract declarations (exports-match, signature-match, deps-declared, no-circular-deps, files-exist)" />
<tool name="blast_radius" when="Assessing risk before modifying a feature — shows affected features grouped by depth with risk scoring (low/medium/high) and critical flags. Use direction='upstream' for impact, 'downstream' for what it needs." />
<tool name="analyze_structure" when="Understanding the project's emergent architecture — returns communities (clusters), hubs, bridges, orphans and modularity score via label propagation" />
<tool name="drift" when="Checking if contracts/index.yaml is out of sync with actual .contract.yaml files" />
<tool name="check_commit" when="Validating only features affected by staged git changes (fast, cirúrgica — use before committing)" />
</category>
<category name="mutation">
<tool name="scaffold" when="Creating a new feature — generates a contract YAML template. Supports basePath for non-standard structures (src/modules, packages/core, etc.)" />
<tool name="update" when="Modifying an existing contract — add/remove deps, rules, files; change status, description, owner. Do NOT edit YAML manually unless strictly necessary." />
<tool name="index" when="Regenerating the contracts/index.yaml after contract changes" />
<tool name="install_hook" when="One-time setup: installs a git pre-commit hook that runs check_commit automatically before every commit" />
</category>
</tools>

<rules>
<rule severity="critical">Never write code for a feature without reading its contract first via get_feature</rule>
<rule severity="critical">Never add a dependency without declaring it in the contract — validator rule deps-declared blocks this</rule>
<rule severity="critical">Signature must match reality — if the code signature changes, update the contract in the same commit (rule: signature-match)</rule>
<rule severity="critical">Always run validate after modifying code to check compliance</rule>
<rule severity="important">Before changing a high-risk feature, run blast_radius upstream to see who depends on it</rule>
<rule severity="important">Use scaffold to create new features — never write contracts from scratch by hand</rule>
<rule severity="important">Use update to modify contracts programmatically — do not edit YAML manually unless the contract is malformed</rule>
<rule severity="important">Use check_commit before committing to catch violations early; install the pre-commit hook once per project</rule>
<rule severity="important">Run drift periodically to keep the index current; regenerate it with the 'index' tool when drift is detected</rule>
<rule severity="recommended">Use search with filters (hasViolations=true) to find broken features before starting work</rule>
<rule severity="recommended">Use analyze_structure periodically to inspect emerging architecture — hubs are critical, bridges are fragile, orphans may be dead code</rule>
<rule severity="recommended">For shared features (hubs), prefer additive changes over breaking ones — check blast_radius first</rule>
</rules>

<contract-anatomy>
<description>Every feature has a YAML contract with this structure:</description>
<field name="contract" required="true">version, feature (slug), description, owner, status (draft/active/deprecated)</field>
<field name="dependencies" required="true">internal (other features) + external (npm packages), each with a reason</field>
<field name="exports" required="true">functions (name, signature, description, pure) + types (name, description)</field>
<field name="endpoints" required="false">MCP tools exposed (tool name, input, output, errors) — only for mcp-server features</field>
<field name="types" required="false">Domain types owned by this feature</field>
<field name="rules" required="true">Business invariants with id, description, severity (error/warning/info), testable flag</field>
<field name="files" required="true">Declared file paths with purpose — validator uses these to find the barrel and files</field>
</contract-anatomy>

<claude-md-section>
<![CDATA[
## Contract-Driven Development (contract-mcp)

This project uses YAML contracts as the source of truth for all features.
An MCP server (contract-mcp) provides tools to manage, validate and analyze contracts.

### Core Workflow

1. **Before modifying a feature:** \`get_feature\` (read it) → \`blast_radius\` (assess impact) → \`get_dependencies\` (understand deps)
2. **Make changes** respecting the contract's rules, signatures and declared deps
3. **After changes:** \`validate\` to verify compliance
4. **New features:** \`scaffold\` with \`basePath\` → then \`update\` to add rules/deps/files
5. **Pre-commit:** \`check_commit\` validates only the affected features (surgical, fast)

### Rules

- **No code without a contract.** Every feature must have a \`.contract.yaml\`
- **No undeclared dependencies.** All imports from other features must be in \`dependencies.internal\`
- **Signatures must match.** If the TypeScript signature changes, update the contract
- **Validate before committing.** Run \`validate\` (or \`check_commit\`) before every commit
- **Prefer tools over manual edits.** Use \`scaffold\`, \`update\`, \`index\` instead of editing YAML by hand

### Contract Location

- Centralized: \`contracts/*.contract.yaml\`
- Feature-local: \`src/**/*.contract.yaml\`

### Available Tools

| Category | Tool | Use When |
|----------|------|----------|
| Discovery | \`search\` | Find contracts (filters: status, dependsOn, owner, hasViolations) |
| Discovery | \`get_feature\` | Read full contract details |
| Discovery | \`get_dependencies\` | Downstream dependency graph |
| Discovery | \`reference\` | This guide itself |
| Analysis | \`compile\` | Validate all YAML contracts |
| Analysis | \`validate\` | Verify code matches contracts |
| Analysis | \`blast_radius\` | Risk assessment before changes |
| Analysis | \`analyze_structure\` | Communities, hubs, bridges, orphans |
| Analysis | \`drift\` | Check index freshness |
| Analysis | \`check_commit\` | Surgical validation of staged changes |
| Mutation | \`scaffold\` | Create new feature (with \`basePath\` for any structure) |
| Mutation | \`update\` | Modify existing contract (add/remove deps, rules, files) |
| Mutation | \`index\` | Regenerate contracts/index.yaml |
| Mutation | \`install_hook\` | Install git pre-commit hook (one-time) |
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

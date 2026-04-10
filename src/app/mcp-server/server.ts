import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleCompile } from "./tools/compile";
import { handleGetFeature } from "./tools/get-feature";
import { handleGetDependencies } from "./tools/get-dependencies";
import { handleValidate } from "./tools/validate";
import { handleIndex } from "./tools/index-tool";
import { handleDrift } from "./tools/drift";
import { handleScaffold } from "./tools/scaffold";
import { handleSearch } from "./tools/search";
import { handleUpdate } from "./tools/update";
import { handleReference } from "./tools/reference";
import { startDashboard } from "@features/dashboard";

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "contract-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "compile",
    {
      description: "Compile all contracts and return XML diagnostic report",
      inputSchema: {
        contractsDir: z
          .string()
          .optional()
          .describe("Path to contracts directory"),
      },
    },
    async (args) => {
      const xml = await handleCompile(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  server.registerTool(
    "get_feature",
    {
      description: "Get the full contract of a specific feature as XML",
      inputSchema: {
        feature: z.string().describe("Feature slug (e.g. 'compiler', 'auth')"),
      },
    },
    async (args) => {
      const xml = await handleGetFeature(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  server.registerTool(
    "get_dependencies",
    {
      description: "Get the dependency graph for a feature",
      inputSchema: {
        feature: z.string().describe("Feature slug"),
        depth: z.number().optional().describe("Max depth to traverse"),
      },
    },
    async (args) => {
      const xml = await handleGetDependencies(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  server.registerTool(
    "validate",
    {
      description: "Validate implementation code against contracts",
      inputSchema: {
        feature: z
          .string()
          .optional()
          .describe("Feature slug (omit to validate all)"),
        projectRoot: z.string().optional().describe("Project root path"),
      },
    },
    async (args) => {
      const xml = await handleValidate(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  server.registerTool(
    "index",
    {
      description: "Generate or update the contracts index",
      inputSchema: {
        contractsDir: z
          .string()
          .optional()
          .describe("Contracts directory path"),
        outputPath: z
          .string()
          .optional()
          .describe("Path to write the index YAML"),
      },
    },
    async (args) => {
      const xml = await handleIndex(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  server.registerTool(
    "drift",
    {
      description: "Detect drift between the index and actual contract files",
      inputSchema: {
        indexPath: z.string().optional().describe("Path to existing index YAML"),
        contractsDir: z.string().optional().describe("Contracts directory path"),
      },
    },
    async (args) => {
      const xml = await handleDrift(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  server.registerTool(
    "scaffold",
    {
      description: "Generate a YAML contract template for a new feature",
      inputSchema: {
        feature: z.string().describe("Feature slug in kebab-case (e.g. 'auth', 'payment-gateway')"),
        description: z.string().optional().describe("Feature description"),
        owner: z.string().optional().describe("Owner (person or team)"),
        deps: z.string().optional().describe("Internal dependencies, comma-separated (e.g. 'database,crypto')"),
        basePath: z.string().optional().describe("Base path for feature files (default: 'src/features', e.g. 'src/modules', 'packages/core')"),
        outputPath: z.string().optional().describe("Path to write the contract file (e.g. 'contracts/auth.contract.yaml')"),
      },
    },
    async (args) => {
      const xml = await handleScaffold(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  server.registerTool(
    "search",
    {
      description: "Search contracts with filters. Returns compact results — use get_feature for full details.",
      inputSchema: {
        query: z.string().optional().describe("Text search across all fields (name, description, deps, exports, rules, files)"),
        status: z.string().optional().describe("Filter by status: draft, active, deprecated"),
        dependsOn: z.string().optional().describe("Find features that depend on this feature"),
        dependedBy: z.string().optional().describe("Find features that this feature depends on"),
        owner: z.string().optional().describe("Filter by owner"),
        hasRules: z.string().optional().describe("Find features with rules matching this ID"),
        hasViolations: z.boolean().optional().describe("Filter by violation status (true = with violations, false = clean)"),
      },
    },
    async (args) => {
      const xml = await handleSearch(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  server.registerTool(
    "update",
    {
      description: "Update an existing contract. Modifies metadata, adds/removes deps, rules, or files.",
      inputSchema: {
        feature: z.string().describe("Feature slug of the contract to update"),
        description: z.string().optional().describe("New description"),
        status: z.string().optional().describe("New status: draft, active, or deprecated"),
        owner: z.string().optional().describe("New owner"),
        addDeps: z.string().optional().describe("Internal deps to add, comma-separated"),
        removeDeps: z.string().optional().describe("Internal deps to remove, comma-separated"),
        addRules: z.string().optional().describe("Rule IDs to add, comma-separated"),
        removeRules: z.string().optional().describe("Rule IDs to remove, comma-separated"),
        addFiles: z.string().optional().describe("File paths to add, comma-separated"),
        removeFiles: z.string().optional().describe("File paths to remove, comma-separated"),
      },
    },
    async (args) => {
      const xml = await handleUpdate(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  server.registerTool(
    "reference",
    {
      description: "Get the contract-driven development reference guide. Use to onboard AI agents or update CLAUDE.md with contract workflow instructions.",
      inputSchema: {
        section: z.string().optional().describe("Specific section: 'workflow', 'tools', 'rules', or 'claude-md'. Omit for full guide."),
      },
    },
    async (args) => {
      const xml = await handleReference(args);
      return { content: [{ type: "text" as const, text: xml }] };
    }
  );

  // Start dashboard web server alongside MCP
  const dashResult = await startDashboard(process.cwd());
  if (dashResult.ok) {
    // Log to stderr so it doesn't interfere with stdio transport
    console.error(`[contract-mcp] Dashboard: ${dashResult.value.url}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

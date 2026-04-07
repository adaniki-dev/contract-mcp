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
import { startDashboard } from "@features/dashboard";

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "zero-human",
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

  // Start dashboard web server alongside MCP
  const dashResult = await startDashboard(process.cwd());
  if (dashResult.ok) {
    // Log to stderr so it doesn't interfere with stdio transport
    console.error(`[zero-human] Dashboard: ${dashResult.value.url}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

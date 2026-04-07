import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleCompile } from "./tools/compile";
import { handleGetFeature } from "./tools/get-feature";
import { handleGetDependencies } from "./tools/get-dependencies";
import { handleValidate } from "./tools/validate";
import { handleIndex } from "./tools/index-tool";
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

  // Start dashboard web server alongside MCP
  const dashResult = await startDashboard(process.cwd());
  if (dashResult.ok) {
    // Log to stderr so it doesn't interfere with stdio transport
    console.error(`[zero-human] Dashboard: ${dashResult.value.url}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

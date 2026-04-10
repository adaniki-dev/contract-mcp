import { xmlSuccess, xmlError, escapeXml } from "@shared/lib/xml";
import { join } from "path";
import { fileURLToPath } from "url";

export async function handleInstallHook(args: {
  projectRoot?: string;
  force?: boolean;
}): Promise<string> {
  try {
    const root = args.projectRoot ?? process.cwd();

    // Verify it's a git repo
    const gitHead = Bun.file(join(root, ".git", "HEAD"));
    if (!(await gitHead.exists())) {
      return xmlError(
        "install_hook",
        "NOT_A_GIT_REPO",
        `${root} is not a git repository`
      );
    }

    const hookPath = join(root, ".git", "hooks", "pre-commit");

    const existing = Bun.file(hookPath);
    if ((await existing.exists()) && !args.force) {
      return xmlError(
        "install_hook",
        "HOOK_EXISTS",
        `Pre-commit hook already exists at ${hookPath}. Pass force=true to overwrite.`
      );
    }

    // Resolve the CLI path relative to this file
    // import.meta.url → .../src/app/mcp-server/tools/install-hook.ts
    // CLI is at      → .../src/app/cli/check-commit.ts
    const thisFile = fileURLToPath(import.meta.url);
    const cliPath = join(thisFile, "..", "..", "..", "cli", "check-commit.ts");
    // Normalize
    const resolvedCli = new URL("../../cli/check-commit.ts", import.meta.url).pathname;

    const hookContent = `#!/bin/sh
# contract-mcp pre-commit hook
# Installed by contract-mcp install_hook tool
bun run ${resolvedCli} || exit 1
`;

    await Bun.write(hookPath, hookContent);
    await Bun.spawn(["chmod", "+x", hookPath]).exited;

    return xmlSuccess(
      "install_hook",
      `<install path="${escapeXml(hookPath)}" cli="${escapeXml(resolvedCli)}" />`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("install_hook", "INTERNAL_ERROR", message);
  }
}

import { xmlSuccess, xmlError, escapeXml } from "@shared/lib/xml";
import { join } from "path";

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

    const hookContent = `#!/bin/sh
# contract-mcp pre-commit hook
# Installed by contract-mcp install_hook tool
bunx -p @adaniki/contract-agent-linter contract-agent-linter-check || exit 1
`;

    await Bun.write(hookPath, hookContent);
    await Bun.spawn(["chmod", "+x", hookPath]).exited;

    return xmlSuccess(
      "install_hook",
      `<install path="${escapeXml(hookPath)}" command="bunx @adaniki/contract-agent-linter-check" />`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return xmlError("install_hook", "INTERNAL_ERROR", message);
  }
}

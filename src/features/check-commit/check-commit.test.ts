import { describe, test, expect } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { checkCommit } from "./check-commit";

async function sh(cwd: string, ...args: string[]): Promise<string> {
  const proc = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out;
}

async function initGitRepo(dir: string): Promise<void> {
  await sh(dir, "git", "init", "-q");
  await sh(dir, "git", "config", "user.email", "test@test.com");
  await sh(dir, "git", "config", "user.name", "test");
  await sh(dir, "git", "config", "commit.gpgsign", "false");
}

function contractYaml(
  feature: string,
  opts: { functions?: string[]; files?: string[]; deps?: string[] } = {}
): string {
  const internal =
    opts.deps && opts.deps.length > 0
      ? opts.deps.map((d) => `    - feature: ${d}\n      reason: test`).join("\n")
      : "    []";
  const fns =
    opts.functions && opts.functions.length > 0
      ? opts.functions
          .map(
            (f) =>
              `    - name: ${f}\n      signature: "() => void"\n      description: test\n      pure: true`
          )
          .join("\n")
      : "    []";
  const files =
    opts.files && opts.files.length > 0
      ? opts.files.map((f) => `    - path: ${f}\n      purpose: test`).join("\n")
      : "  []";
  return `contract:
  version: "1.0.0"
  feature: ${feature}
  description: "Test ${feature}"
  owner: test
  status: draft
dependencies:
  internal:
${internal}
  external: []
exports:
  functions:
${fns}
  types: []
rules: []
files:
${files}
`;
}

async function setupProject(
  dir: string,
  feature: string,
  extra: { barrelContent?: string; extraFiles?: Record<string, string> } = {}
): Promise<void> {
  await initGitRepo(dir);
  await Bun.write(
    join(dir, "contracts", `${feature}.contract.yaml`),
    contractYaml(feature, {
      functions: ["doSomething"],
      files: [
        `src/features/${feature}/index.ts`,
        `src/features/${feature}/${feature}.ts`,
      ],
    })
  );
  await Bun.write(
    join(dir, "src", "features", feature, "index.ts"),
    extra.barrelContent ?? "export function doSomething() {};\n"
  );
  await Bun.write(
    join(dir, "src", "features", feature, `${feature}.ts`),
    "export const x = 1;\n"
  );
  if (extra.extraFiles) {
    for (const [path, content] of Object.entries(extra.extraFiles)) {
      await Bun.write(join(dir, path), content);
    }
  }
}

describe("check-commit", () => {
  test("returns error when not a git repo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cc-nogit-"));
    try {
      await Bun.write(
        join(dir, "contracts", "auth.contract.yaml"),
        contractYaml("auth", { functions: ["login"] })
      );
      const result = await checkCommit(dir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_A_GIT_REPO");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("no staged files returns passed with no affected features", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cc-empty-"));
    try {
      await setupProject(dir, "auth");
      const result = await checkCommit(dir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.stagedFiles).toHaveLength(0);
        expect(result.value.affectedFeatures).toHaveLength(0);
        expect(result.value.passed).toBe(true);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("staged file matching contract.files triggers validation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cc-match-"));
    try {
      await setupProject(dir, "auth");
      await sh(dir, "git", "add", "src/features/auth/index.ts");

      const result = await checkCommit(dir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.stagedFiles).toContain("src/features/auth/index.ts");
        expect(result.value.affectedFeatures).toHaveLength(1);
        expect(result.value.affectedFeatures[0].feature).toBe("auth");
        expect(result.value.validationResults).toHaveLength(1);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("staged file in feature dir but not in contract.files matches by prefix", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cc-prefix-"));
    try {
      await setupProject(dir, "auth", {
        extraFiles: {
          "src/features/auth/helpers.ts": "export const help = () => {};\n",
        },
      });
      // Stage a file NOT declared in contract.files but inside feature dir
      await sh(dir, "git", "add", "src/features/auth/helpers.ts");

      const result = await checkCommit(dir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.affectedFeatures).toHaveLength(1);
        expect(result.value.affectedFeatures[0].feature).toBe("auth");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("violation in affected feature blocks commit (passed=false)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cc-violation-"));
    try {
      // Barrel missing the declared 'doSomething' export
      await setupProject(dir, "auth", {
        barrelContent: "export function other() {};\n",
      });
      await sh(dir, "git", "add", "src/features/auth/index.ts");

      const result = await checkCommit(dir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.passed).toBe(false);
        expect(result.value.errorCount).toBeGreaterThan(0);
        expect(result.value.validationResults[0].valid).toBe(false);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("staged file outside any contract dir is ignored", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cc-unmanaged-"));
    try {
      await setupProject(dir, "auth");
      await Bun.write(join(dir, "README.md"), "# test\n");
      await sh(dir, "git", "add", "README.md");

      const result = await checkCommit(dir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.stagedFiles).toContain("README.md");
        expect(result.value.affectedFeatures).toHaveLength(0);
        expect(result.value.passed).toBe(true);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

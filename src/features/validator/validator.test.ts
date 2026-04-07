import { describe, test, expect } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { validate, validateAll } from "./validator";

function contractYaml(
  feature: string,
  opts: {
    deps?: string[];
    functions?: string[];
    files?: string[];
  } = {}
): string {
  const internal =
    opts.deps && opts.deps.length > 0
      ? opts.deps
          .map((d) => `    - feature: ${d}\n      reason: test`)
          .join("\n")
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

async function createProject(
  tmpDir: string,
  features: {
    name: string;
    contract: string;
    barrel?: string;
    files?: Record<string, string>;
  }[]
): Promise<void> {
  for (const feat of features) {
    await Bun.write(
      join(tmpDir, "contracts", `${feat.name}.contract.yaml`),
      feat.contract
    );

    if (feat.barrel !== undefined) {
      await Bun.write(
        join(tmpDir, "src", "features", feat.name, "index.ts"),
        feat.barrel
      );
    }

    if (feat.files) {
      for (const [path, content] of Object.entries(feat.files)) {
        await Bun.write(join(tmpDir, path), content);
      }
    }
  }
}

describe("validator", () => {
  describe("validate", () => {
    test("validates a single feature against its contract", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-single-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", { functions: ["login"] }),
            barrel: "export function login() {};\n",
          },
        ]);

        const result = await validate("auth", dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.feature).toBe("auth");
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("returns valid result for compliant feature", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-compliant-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", {
              functions: ["login", "logout"],
              files: ["src/features/auth/index.ts"],
            }),
            barrel:
              "export function login() {};\nexport function logout() {};\n",
          },
        ]);

        const result = await validate("auth", dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.valid).toBe(true);
          expect(result.value.violations).toHaveLength(0);
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("returns violations for non-compliant feature", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-noncompliant-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", {
              functions: ["login", "logout", "refresh"],
            }),
            barrel: "export function login() {};\n",
          },
        ]);

        const result = await validate("auth", dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.valid).toBe(false);
          expect(result.value.violations.length).toBeGreaterThan(0);
          const rules = result.value.violations.map((v) => v.rule);
          expect(rules).toContain("exports-match");
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe("validateAll", () => {
    test("validates all features in project", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-all-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", { functions: ["login"] }),
            barrel: "export function login() {};\n",
          },
          {
            name: "user",
            contract: contractYaml("user", { functions: ["getUser"] }),
            barrel: "export function getUser() {};\n",
          },
        ]);

        const result = await validateAll(dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.length).toBe(2);
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("returns results for each feature", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-each-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", { functions: ["login"] }),
            barrel: "export function login() {};\n",
          },
          {
            name: "user",
            contract: contractYaml("user", { functions: ["getUser"] }),
            barrel: "export function getUser() {};\n",
          },
        ]);

        const result = await validateAll(dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const features = result.value.map((r) => r.feature).sort();
          expect(features).toEqual(["auth", "user"]);
          for (const r of result.value) {
            expect(r).toHaveProperty("feature");
            expect(r).toHaveProperty("valid");
            expect(r).toHaveProperty("violations");
          }
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe("rules", () => {
    test("exports-match: exports in contract must exist in barrel", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-exports-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", {
              functions: ["login", "logout"],
            }),
            barrel: "export function login() {};\n",
          },
        ]);

        const result = await validate("auth", dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const exportViolations = result.value.violations.filter(
            (v) => v.rule === "exports-match"
          );
          expect(exportViolations.length).toBeGreaterThan(0);
          expect(exportViolations[0].message).toContain("logout");
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("deps-declared: imports must be declared in dependencies", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-deps-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", {
              functions: ["login"],
            }),
            barrel: "export function login() {};\n",
            files: {
              "src/features/auth/auth.ts":
                'import { getUser } from "@features/user";\nexport function login() { return getUser(); }\n',
            },
          },
          {
            name: "user",
            contract: contractYaml("user", { functions: ["getUser"] }),
            barrel: "export function getUser() {};\n",
          },
        ]);

        const result = await validate("auth", dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const depViolations = result.value.violations.filter(
            (v) => v.rule === "deps-declared"
          );
          expect(depViolations.length).toBeGreaterThan(0);
          expect(depViolations[0].message).toContain("@features/user");
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("no-circular-deps: no circular dependencies between features", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-circular-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", {
              functions: ["login"],
              deps: ["user"],
            }),
            barrel: "export function login() {};\n",
          },
          {
            name: "user",
            contract: contractYaml("user", {
              functions: ["getUser"],
              deps: ["auth"],
            }),
            barrel: "export function getUser() {};\n",
          },
        ]);

        const result = await validateAll(dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const allViolations = result.value.flatMap((r) => r.violations);
          const circularViolations = allViolations.filter(
            (v) => v.rule === "no-circular-deps"
          );
          expect(circularViolations.length).toBeGreaterThan(0);
          expect(circularViolations[0].message).toContain("Circular");
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("no-cross-feature-imports: features cannot import from undeclared features", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-cross-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", {
              functions: ["login"],
            }),
            barrel: "export function login() {};\n",
            files: {
              "src/features/auth/auth.ts":
                'import { getUser } from "@features/user";\nexport function login() { return getUser(); }\n',
            },
          },
          {
            name: "user",
            contract: contractYaml("user", { functions: ["getUser"] }),
            barrel: "export function getUser() {};\n",
          },
        ]);

        const result = await validate("auth", dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const crossViolations = result.value.violations.filter(
            (v) => v.rule === "deps-declared"
          );
          expect(crossViolations.length).toBeGreaterThan(0);
          expect(crossViolations[0].message).toContain("@features/user");
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("files-exist: declared files must exist in filesystem", async () => {
      const dir = await mkdtemp(join(tmpdir(), "val-files-"));
      try {
        await createProject(dir, [
          {
            name: "auth",
            contract: contractYaml("auth", {
              functions: ["login"],
              files: [
                "src/features/auth/index.ts",
                "src/features/auth/nonexistent.ts",
              ],
            }),
            barrel: "export function login() {};\n",
          },
        ]);

        const result = await validate("auth", dir);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const fileViolations = result.value.violations.filter(
            (v) => v.rule === "files-exist"
          );
          expect(fileViolations.length).toBeGreaterThan(0);
          expect(fileViolations[0].message).toContain("nonexistent.ts");
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });
});

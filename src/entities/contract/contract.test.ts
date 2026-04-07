import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { loadContract, validateContractStructure } from "./contract";
import { join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";

const VALID_CONTRACT_YAML = `
contract:
  version: "1.0.0"
  feature: test-feature
  description: "A test feature"
  owner: test
  status: draft
dependencies:
  internal: []
  external: []
exports:
  functions: []
  types: []
rules: []
files: []
`.trim();

const FULL_CONTRACT_YAML = `
contract:
  version: "2.0.0"
  feature: full-feature
  description: "A full feature contract"
  owner: team-a
  status: active
dependencies:
  internal:
    - feature: auth
      reason: "needs auth"
  external:
    - package: zod
      version: "^3.0.0"
      reason: "validation"
exports:
  functions:
    - name: doStuff
      signature: "(input: string) => void"
      description: "Does stuff"
      pure: true
  types:
    - name: MyType
      description: "A type"
rules:
  - id: rule-1
    description: "First rule"
    severity: error
    testable: true
files:
  - path: src/index.ts
    purpose: entry point
types:
  - name: Config
    description: "Config type"
    fields:
      - name: host
        type: string
        required: true
        description: "Hostname"
endpoints:
  - tool: get_data
    description: "Gets data"
    input: "{ id: string }"
    output: "{ data: unknown }"
    errors:
      - NOT_FOUND
`.trim();

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "contract-test-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeTempYaml(name: string, content: string): Promise<string> {
  const path = join(tmpDir, name);
  await Bun.write(path, content);
  return path;
}

describe("contract entity", () => {
  describe("loadContract", () => {
    test("loads a valid YAML contract file", async () => {
      const path = await writeTempYaml("valid.yaml", VALID_CONTRACT_YAML);
      const result = await loadContract(path);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contract.version).toBe("1.0.0");
        expect(result.value.contract.feature).toBe("test-feature");
        expect(result.value.contract.status).toBe("draft");
        expect(result.value.dependencies.internal).toEqual([]);
        expect(result.value.exports.functions).toEqual([]);
        expect(result.value.rules).toEqual([]);
        expect(result.value.files).toEqual([]);
      }
    });

    test("returns error for non-existent file", async () => {
      const result = await loadContract("/tmp/does-not-exist-contract.yaml");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.length).toBeGreaterThan(0);
        expect(result.error[0].severity).toBe("error");
        expect(result.error[0].message).toContain("File not found");
      }
    });

    test("returns error for invalid YAML syntax", async () => {
      const path = await writeTempYaml("bad.yaml", "{\n  invalid: yaml: broken:\n}");
      const result = await loadContract(path);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.length).toBeGreaterThan(0);
        expect(result.error[0].severity).toBe("error");
      }
    });

    test("parses all contract sections correctly", async () => {
      const path = await writeTempYaml("full.yaml", FULL_CONTRACT_YAML);
      const result = await loadContract(path);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const c = result.value;
        expect(c.contract.version).toBe("2.0.0");
        expect(c.contract.feature).toBe("full-feature");
        expect(c.contract.status).toBe("active");

        expect(c.dependencies.internal).toHaveLength(1);
        expect(c.dependencies.internal[0].feature).toBe("auth");
        expect(c.dependencies.external).toHaveLength(1);
        expect(c.dependencies.external[0].package).toBe("zod");

        expect(c.exports.functions).toHaveLength(1);
        expect(c.exports.functions[0].name).toBe("doStuff");
        expect(c.exports.types).toHaveLength(1);

        expect(c.rules).toHaveLength(1);
        expect(c.rules[0].id).toBe("rule-1");
        expect(c.rules[0].testable).toBe(true);

        expect(c.files).toHaveLength(1);
        expect(c.files[0].path).toBe("src/index.ts");

        expect(c.types).toHaveLength(1);
        expect(c.types[0].name).toBe("Config");

        expect(c.endpoints).toHaveLength(1);
        expect(c.endpoints![0].tool).toBe("get_data");
      }
    });

    test("validates required fields are present", async () => {
      const incomplete = `
contract:
  version: "1.0.0"
`;
      const path = await writeTempYaml("incomplete.yaml", incomplete.trim());
      const result = await loadContract(path);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const messages = result.error.map((e) => e.message);
        // Missing contract fields
        expect(messages.some((m) => m.includes("contract.feature"))).toBe(true);
        expect(messages.some((m) => m.includes("contract.description"))).toBe(true);
        expect(messages.some((m) => m.includes("contract.owner"))).toBe(true);
        expect(messages.some((m) => m.includes("contract.status"))).toBe(true);
        // Missing blocks
        expect(messages.some((m) => m.includes("dependencies"))).toBe(true);
        expect(messages.some((m) => m.includes("exports"))).toBe(true);
        expect(messages.some((m) => m.includes("rules"))).toBe(true);
        expect(messages.some((m) => m.includes("files"))).toBe(true);
      }
    });
  });
});

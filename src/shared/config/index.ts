export const DEFAULT_CONTRACTS_DIR = "contracts";
export const DEFAULT_INDEX_PATH = "contracts/index.yaml";
export const DEFAULT_SCHEMA_DIR = "contracts/_schema";
export const CONTRACT_FILE_PATTERN = "*.contract.yaml";

export const IGNORED_DIRS = [
  "/node_modules/",
  "/_schema/",
  "/dist/",
  "/build/",
  "/.git/",
  "/.next/",
  "/.nuxt/",
  "/.svelte-kit/",
  "/coverage/",
  "/.turbo/",
  "/.cache/",
];

export function isIgnoredPath(filePath: string): boolean {
  return IGNORED_DIRS.some((dir) => filePath.includes(dir));
}

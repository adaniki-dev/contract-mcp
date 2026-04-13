#!/usr/bin/env bun
/**
 * Build script — bundles the MCP server and check-commit CLI
 * into standalone Bun executables for npm distribution.
 */
import { rmSync, writeFileSync, readFileSync, chmodSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");

// Clean previous build
rmSync(DIST, { recursive: true, force: true });

const entries = [
  { entry: "src/app/index.ts", out: "server" },
  { entry: "src/app/cli/check-commit.ts", out: "check-commit" },
];

// All package.json dependencies stay external — npm installs them
const external = [
  "@modelcontextprotocol/sdk",
  "oxc-parser",
  "es-module-lexer",
  "yaml",
];

for (const { entry, out } of entries) {
  const result = await Bun.build({
    entrypoints: [join(ROOT, entry)],
    outdir: DIST,
    target: "bun",
    naming: `${out}.js`,
    minify: false,
    sourcemap: "none",
    external,
  });

  if (!result.success) {
    console.error(`Build failed for ${entry}:`);
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
}

// Add shebangs to CLI entry points
const shebang = "#!/usr/bin/env bun\n";
for (const name of ["server.js", "check-commit.js"]) {
  const filePath = join(DIST, name);
  const content = readFileSync(filePath, "utf-8");
  if (!content.startsWith("#!")) {
    writeFileSync(filePath, shebang + content);
  }
  chmodSync(filePath, 0o755);
}

console.log("Build complete:");
for (const { out } of entries) {
  const stat = Bun.file(join(DIST, `${out}.js`));
  const size = await stat.size;
  console.log(`  dist/${out}.js  (${(size / 1024).toFixed(1)} KB)`);
}

import { parseSync, type ParseResult } from "oxc-parser";
import { init, parse } from "es-module-lexer";

let initialized = false;

export async function initParsers(): Promise<void> {
  if (!initialized) {
    await init;
    initialized = true;
  }
}

export interface ImportInfo {
  source: string;
  type: "static" | "dynamic";
}

export interface ExportInfo {
  name: string;
  localName: string | undefined;
}

export function parseTypeScript(
  filename: string,
  code: string
): ParseResult {
  return parseSync(filename, code, {
    sourceType: "module",
    lang: filename.endsWith(".tsx") ? "tsx" : "ts",
  });
}

export function analyzeImports(code: string): ImportInfo[] {
  if (!initialized) {
    throw new Error("Parsers not initialized. Call initParsers() first.");
  }

  const [imports] = parse(code);
  return imports
    .filter((imp) => imp.n !== undefined)
    .map((imp) => ({
      source: imp.n!,
      type: imp.d === -1 ? ("static" as const) : ("dynamic" as const),
    }));
}

export function analyzeExports(code: string): ExportInfo[] {
  if (!initialized) {
    throw new Error("Parsers not initialized. Call initParsers() first.");
  }

  const [, exports] = parse(code);
  return exports.map((exp) => ({
    name: exp.n,
    localName: exp.ln,
  }));
}

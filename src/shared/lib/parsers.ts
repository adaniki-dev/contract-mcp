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

export interface ReExportInfo {
  name: string;
  source: string;
}

export function normalizeSignature(sig: string): string {
  return sig
    .replace(/\s+/g, " ")
    .replace(/\s*([():<>,\[\]])\s*/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/<\s+/g, "<")
    .replace(/\s+>/g, ">")
    .replace(/,\s*/g, ", ")
    .replace(/:\s*/g, ": ")
    .replace(/\s*=>\s*/g, " => ")
    .trim();
}

function extractFunctionSignature(
  code: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  funcNode: any,
  isAsync: boolean
): string {
  // Extract params from source text
  const firstParam = funcNode.params?.[0];
  let paramsStr: string;

  if (!funcNode.params || funcNode.params.length === 0) {
    paramsStr = "()";
  } else {
    // Find the opening paren before first param and closing paren after last param
    const lastParam = funcNode.params[funcNode.params.length - 1];
    // Search backwards from first param for '('
    let openParen = firstParam.start - 1;
    while (openParen >= 0 && code[openParen] !== "(") openParen--;
    // Search forwards from last param for ')'
    let closeParen = lastParam.end;
    while (closeParen < code.length && code[closeParen] !== ")") closeParen++;
    paramsStr = code.slice(openParen, closeParen + 1);
  }

  // Extract return type
  let returnStr = "void";
  if (funcNode.returnType?.typeAnnotation) {
    const ta = funcNode.returnType.typeAnnotation;
    returnStr = code.slice(ta.start, ta.end);
  }

  // If async and return type doesn't already start with Promise, wrap it
  if (isAsync && !returnStr.startsWith("Promise<") && returnStr !== "void") {
    returnStr = `Promise<${returnStr}>`;
  }

  return normalizeSignature(`${paramsStr} => ${returnStr}`);
}

export interface SignatureResult {
  signatures: Map<string, string>;
  reExports: ReExportInfo[];
}

export function extractSignatures(
  filename: string,
  code: string
): SignatureResult {
  const result = parseTypeScript(filename, code);
  const signatures = new Map<string, string>();
  const reExports: ReExportInfo[] = [];

  for (const node of result.program.body as any[]) {
    if (node.type !== "ExportNamedDeclaration") continue;

    // Re-export: export { X } from "./file"
    if (!node.declaration && node.source) {
      for (const spec of node.specifiers || []) {
        reExports.push({
          name: spec.exported?.name ?? spec.local?.name,
          source: node.source.value,
        });
      }
      continue;
    }

    const decl = node.declaration;
    if (!decl) continue;

    // export function foo(...): T { }
    if (decl.type === "FunctionDeclaration" && decl.id?.name) {
      const sig = extractFunctionSignature(code, decl, decl.async ?? false);
      signatures.set(decl.id.name, sig);
    }

    // export const foo = (...): T => { }
    if (decl.type === "VariableDeclaration") {
      for (const declarator of decl.declarations || []) {
        const init = declarator.init;
        if (!init) continue;
        const name = declarator.id?.name;
        if (!name) continue;

        if (
          init.type === "ArrowFunctionExpression" ||
          init.type === "FunctionExpression"
        ) {
          const sig = extractFunctionSignature(code, init, init.async ?? false);
          signatures.set(name, sig);
        }
      }
    }
  }

  return { signatures, reExports };
}

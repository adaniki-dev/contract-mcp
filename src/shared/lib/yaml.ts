import { parse, stringify } from "yaml";
import type { Result, CompileError } from "@shared/types/contract.types";

export function parseYaml<T>(content: string, filePath = "<inline>"): Result<T, CompileError[]> {
  try {
    const parsed = parse(content) as T;
    return { ok: true, value: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown YAML parse error";
    return {
      ok: false,
      error: [{ path: filePath, message, severity: "error" }],
    };
  }
}

export async function loadYamlFile<T>(path: string): Promise<Result<T, CompileError[]>> {
  try {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) {
      return {
        ok: false,
        error: [{ path, message: `File not found: ${path}`, severity: "error" }],
      };
    }
    const content = await file.text();
    return parseYaml<T>(content, path);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown file read error";
    return {
      ok: false,
      error: [{ path, message, severity: "error" }],
    };
  }
}

export function stringifyYaml(obj: unknown): string {
  return stringify(obj);
}

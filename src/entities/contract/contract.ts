import { loadYamlFile } from "@shared/lib/yaml";
import type {
  Contract,
  CompileError,
  Result,
  Severity,
  ContractStatus,
} from "@shared/types/contract.types";

const VALID_STATUSES: ContractStatus[] = ["draft", "active", "deprecated"];

function error(path: string, message: string): CompileError {
  return { path, message, severity: "error" };
}

function validateContractBlock(raw: Record<string, unknown>, filePath: string): CompileError[] {
  const errors: CompileError[] = [];
  const block = raw.contract;

  if (!block || typeof block !== "object") {
    errors.push(error(filePath, "Missing required block: 'contract'"));
    return errors;
  }

  const meta = block as Record<string, unknown>;
  for (const field of ["version", "feature", "description", "owner"]) {
    if (typeof meta[field] !== "string") {
      errors.push(error(filePath, `contract.${field} must be a string`));
    }
  }

  if (!VALID_STATUSES.includes(meta.status as ContractStatus)) {
    errors.push(
      error(filePath, `contract.status must be one of: ${VALID_STATUSES.join(", ")}`)
    );
  }

  return errors;
}

function validateDependenciesBlock(raw: Record<string, unknown>, filePath: string): CompileError[] {
  const errors: CompileError[] = [];
  const block = raw.dependencies;

  if (!block || typeof block !== "object") {
    errors.push(error(filePath, "Missing required block: 'dependencies'"));
    return errors;
  }

  const deps = block as Record<string, unknown>;
  if (!Array.isArray(deps.internal)) {
    errors.push(error(filePath, "dependencies.internal must be an array"));
  }
  if (!Array.isArray(deps.external)) {
    errors.push(error(filePath, "dependencies.external must be an array"));
  }

  return errors;
}

function validateExportsBlock(raw: Record<string, unknown>, filePath: string): CompileError[] {
  const errors: CompileError[] = [];
  const block = raw.exports;

  if (!block || typeof block !== "object") {
    errors.push(error(filePath, "Missing required block: 'exports'"));
    return errors;
  }

  const exp = block as Record<string, unknown>;
  if (!Array.isArray(exp.functions)) {
    errors.push(error(filePath, "exports.functions must be an array"));
  }
  if (!Array.isArray(exp.types)) {
    errors.push(error(filePath, "exports.types must be an array"));
  }

  return errors;
}

function validateRulesBlock(raw: Record<string, unknown>, filePath: string): CompileError[] {
  const errors: CompileError[] = [];

  if (!Array.isArray(raw.rules)) {
    errors.push(error(filePath, "Missing required block: 'rules' (must be an array)"));
    return errors;
  }

  for (let i = 0; i < raw.rules.length; i++) {
    const rule = raw.rules[i] as Record<string, unknown> | undefined;
    if (!rule || typeof rule !== "object") {
      errors.push(error(filePath, `rules[${i}] must be an object`));
      continue;
    }
    for (const field of ["id", "description"] as const) {
      if (typeof rule[field] !== "string") {
        errors.push(error(filePath, `rules[${i}].${field} must be a string`));
      }
    }
    if (typeof rule.severity !== "string") {
      errors.push(error(filePath, `rules[${i}].severity must be a string`));
    }
    if (typeof rule.testable !== "boolean") {
      errors.push(error(filePath, `rules[${i}].testable must be a boolean`));
    }
  }

  return errors;
}

function validateFilesBlock(raw: Record<string, unknown>, filePath: string): CompileError[] {
  const errors: CompileError[] = [];

  if (!Array.isArray(raw.files)) {
    errors.push(error(filePath, "Missing required block: 'files' (must be an array)"));
    return errors;
  }

  for (let i = 0; i < raw.files.length; i++) {
    const file = raw.files[i] as Record<string, unknown> | undefined;
    if (!file || typeof file !== "object") {
      errors.push(error(filePath, `files[${i}] must be an object`));
      continue;
    }
    if (typeof file.path !== "string") {
      errors.push(error(filePath, `files[${i}].path must be a string`));
    }
    if (typeof file.purpose !== "string") {
      errors.push(error(filePath, `files[${i}].purpose must be a string`));
    }
  }

  return errors;
}

function validateOptionalBlocks(raw: Record<string, unknown>, filePath: string): CompileError[] {
  const errors: CompileError[] = [];

  if (raw.types !== undefined && !Array.isArray(raw.types)) {
    errors.push(error(filePath, "'types' block must be an array if present"));
  }

  if (raw.endpoints !== undefined && !Array.isArray(raw.endpoints)) {
    errors.push(error(filePath, "'endpoints' block must be an array if present"));
  }

  return errors;
}

export function validateContractStructure(raw: unknown, filePath: string): CompileError[] {
  if (!raw || typeof raw !== "object") {
    return [error(filePath, "Contract must be a YAML object")];
  }

  const obj = raw as Record<string, unknown>;

  return [
    ...validateContractBlock(obj, filePath),
    ...validateDependenciesBlock(obj, filePath),
    ...validateExportsBlock(obj, filePath),
    ...validateRulesBlock(obj, filePath),
    ...validateFilesBlock(obj, filePath),
    ...validateOptionalBlocks(obj, filePath),
  ];
}

export async function loadContract(
  path: string
): Promise<Result<Contract, CompileError[]>> {
  const yamlResult = await loadYamlFile<unknown>(path);

  if (!yamlResult.ok) {
    return yamlResult;
  }

  const raw = yamlResult.value;
  const errors = validateContractStructure(raw, path);

  if (errors.length > 0) {
    return { ok: false, error: errors };
  }

  const contract = raw as Contract;

  // Default optional fields
  if (!contract.types) {
    contract.types = [];
  }

  return { ok: true, value: contract };
}

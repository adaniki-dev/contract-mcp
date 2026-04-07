import type { CompileResult, Contract, Index, ValidationResult } from "./contract.types";

export type CompileErrorCode = "CONTRACTS_DIR_NOT_FOUND" | "PARSE_ERROR";
export type GetFeatureErrorCode = "FEATURE_NOT_FOUND" | "CONTRACT_PARSE_ERROR";
export type GetDepsErrorCode = "FEATURE_NOT_FOUND" | "CIRCULAR_DEPENDENCY";
export type ValidateErrorCode = "FEATURE_NOT_FOUND" | "VALIDATION_ERROR";
export type IndexErrorCode = "CONTRACTS_DIR_NOT_FOUND" | "INDEX_ERROR";

export interface CompileInput { contractsDir?: string; }
export interface GetFeatureInput { feature: string; }
export interface GetDependenciesInput { feature: string; depth?: number; }
export interface ValidateInput { feature?: string; projectRoot?: string; }
export interface IndexInput { contractsDir?: string; outputPath?: string; }

export type McpToolInput =
  | { tool: "compile"; params: CompileInput }
  | { tool: "get_feature"; params: GetFeatureInput }
  | { tool: "get_dependencies"; params: GetDependenciesInput }
  | { tool: "validate"; params: ValidateInput }
  | { tool: "index"; params: IndexInput };

export interface McpToolOutput {
  content: string;
  isError: boolean;
}

export type McpErrorCode =
  | CompileErrorCode
  | GetFeatureErrorCode
  | GetDepsErrorCode
  | ValidateErrorCode
  | IndexErrorCode;

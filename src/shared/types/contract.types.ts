export type Severity = "error" | "warning" | "info";
export type ContractStatus = "draft" | "active" | "deprecated";

// Result pattern
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Contract structure matching feature.schema.yaml
export interface ContractMeta {
  version: string;
  feature: string;
  description: string;
  owner: string;
  status: ContractStatus;
}

export interface InternalDep {
  feature: string;
  reason: string;
  confidence?: number; // 0.0-1.0, computed at validation time
}

export type EdgeSource = "declared" | "inferred";

export interface WeightedEdge {
  from: string;
  to: string;
  confidence: number;
  reason: string;
  source: EdgeSource;
}

export interface ExternalDep {
  package: string;
  version: string;
  reason: string;
}

export interface ContractDependencies {
  internal: InternalDep[];
  external: ExternalDep[];
}

export interface FunctionExport {
  name: string;
  signature: string;
  description: string;
  pure: boolean;
}

export interface TypeExport {
  name: string;
  description: string;
}

export interface ContractExports {
  functions: FunctionExport[];
  types: TypeExport[];
}

export interface Endpoint {
  tool: string;
  description: string;
  input: string;
  output: string;
  errors: string[];
}

export interface TypeField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ContractType {
  name: string;
  description: string;
  fields: TypeField[];
}

export interface Rule {
  id: string;
  description: string;
  severity: Severity;
  testable: boolean;
}

export interface ContractFile {
  path: string;
  purpose: string;
}

export interface Contract {
  contract: ContractMeta;
  dependencies: ContractDependencies;
  exports: ContractExports;
  endpoints?: Endpoint[];
  types: ContractType[];
  rules: Rule[];
  files: ContractFile[];
}

// Compiler types
export interface CompileResult {
  contracts: Contract[];
  diagnostics: Diagnostic[];
}

export interface CompileError {
  path: string;
  message: string;
  severity: Severity;
  line?: number;
}

export interface Diagnostic {
  rule: string;
  message: string;
  severity: Severity;
  path: string;
}

// Validator types
export interface ValidationResult {
  feature: string;
  valid: boolean;
  violations: Violation[];
  matchedDeps?: string[];   // declared deps confirmed by code imports
  inferredDeps?: string[];  // code imports not declared in contract
}

export interface ValidationError {
  feature: string;
  message: string;
}

export interface Violation {
  rule: string;
  message: string;
  severity: Severity;
  file?: string;
  line?: number;
}

// Indexer types
export interface Index {
  version: string;
  project: string;
  updatedAt: string;
  contractsDir: string;
  features: IndexEntry[];
}

export interface IndexEntry {
  feature: string;
  contractPath: string;
  status: ContractStatus;
  description: string;
  dependsOn: string[];
  exportsCount: number;
  rulesCount: number;
}

export interface IndexError {
  message: string;
}

export interface DriftReport {
  orphanedContracts: string[];
  missingContracts: string[];
  outdatedEntries: string[];
  hasDrift: boolean;
}

// Blast Radius types
export type BlastDirection = "upstream" | "downstream";
export type RiskLevel = "low" | "medium" | "high";

export interface BlastRadiusFeature {
  feature: string;
  status: ContractStatus;
  rulesCount: number;
  dependenciesCount: number;
  critical: boolean;
  edgeConfidence?: number;
}

export interface BlastRadiusLevel {
  depth: number;
  features: BlastRadiusFeature[];
}

export interface BlastRadius {
  feature: string;
  direction: BlastDirection;
  totalAffected: number;
  riskScore: number;
  risk: RiskLevel;
  levels: BlastRadiusLevel[];
}

export interface BlastRadiusError {
  message: string;
}

// Check Commit types
export interface AffectedFeature {
  feature: string;
  stagedFiles: string[];
}

export interface CheckCommitResult {
  stagedFiles: string[];
  affectedFeatures: AffectedFeature[];
  validationResults: ValidationResult[];
  driftReport: DriftReport;
  passed: boolean;
  errorCount: number;
  warningCount: number;
}

export interface CheckCommitError {
  code: "NOT_A_GIT_REPO" | "GIT_ERROR" | "COMPILE_ERROR" | "INTERNAL_ERROR";
  message: string;
}

// Community Detection types
export type NodeRole = "orphan" | "bridge" | "hub" | "leaf" | "member";

export interface Community {
  id: string;
  features: string[];
  size: number;
  density: number;
}

export interface FeatureClassification {
  feature: string;
  community: string;
  role: NodeRole;
  degree: number;
}

export interface CommunityReport {
  communities: Community[];
  classifications: FeatureClassification[];
  orphans: string[];
  bridges: string[];
  hubs: string[];
  modularity: number;
}

// Dashboard types
export interface DashboardData {
  project: string;
  totalFeatures: number;
  totalRules: number;
  totalViolations: number;
  features: FeatureSummary[];
}

export interface FeatureSummary {
  feature: string;
  status: ContractStatus;
  valid: boolean;
  violationsCount: number;
  dependenciesCount: number;
  rulesCount: number;
}

export interface DashboardError {
  message: string;
}

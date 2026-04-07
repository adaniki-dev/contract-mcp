import { compileAll } from "@features/compiler";
import { validateAll } from "@features/validator";
import type {
  DashboardData,
  FeatureSummary,
  DashboardError,
  Result,
  Contract,
  ValidationResult,
} from "@shared/types/contract.types";
import { DEFAULT_CONTRACTS_DIR } from "@shared/config";
import { join } from "path";

const BASE_PORT = 8000;
const MAX_PORT_ATTEMPTS = 20;

function buildDashboardData(
  contracts: Contract[],
  validations: ValidationResult[]
): DashboardData {
  const validationMap = new Map<string, ValidationResult>();
  for (const v of validations) {
    validationMap.set(v.feature, v);
  }

  let totalRules = 0;
  let totalViolations = 0;

  const features: FeatureSummary[] = contracts.map((c) => {
    const validation = validationMap.get(c.contract.feature);
    const violationsCount = validation ? validation.violations.length : 0;

    totalRules += c.rules.length;
    totalViolations += violationsCount;

    return {
      feature: c.contract.feature,
      status: c.contract.status,
      valid: validation ? validation.valid : true,
      violationsCount,
      dependenciesCount: c.dependencies.internal.length,
      rulesCount: c.rules.length,
    };
  });

  return {
    project: "zero-human",
    totalFeatures: contracts.length,
    totalRules,
    totalViolations,
    features,
  };
}

function renderHtmlPage(data: DashboardData, violations: Map<string, ValidationResult>): string {
  const rows = data.features
    .map((f) => {
      const statusClass = f.valid ? "valid" : "invalid";
      const icon = f.valid ? "✓" : "✗";
      const v = violations.get(f.feature);
      const violationRows = v && v.violations.length > 0
        ? v.violations
            .map((viol) => `<tr class="violation-row"><td colspan="6"><span class="badge ${viol.severity}">${viol.severity}</span> <strong>${viol.rule}</strong>: ${viol.message}${viol.file ? ` <code>${viol.file}</code>` : ""}</td></tr>`)
            .join("\n")
        : "";

      return `<tr class="${statusClass}">
        <td class="feature-name">${f.feature}</td>
        <td><span class="badge ${f.status}">${f.status}</span></td>
        <td class="status-icon ${statusClass}">${icon}</td>
        <td>${f.violationsCount}</td>
        <td>${f.dependenciesCount}</td>
        <td>${f.rulesCount}</td>
      </tr>${violationRows}`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>zero-human Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
    background: #0d1117;
    color: #c9d1d9;
    padding: 2rem;
  }
  .header {
    text-align: center;
    margin-bottom: 2rem;
  }
  .header h1 {
    font-size: 1.8rem;
    color: #58a6ff;
    margin-bottom: 0.5rem;
  }
  .summary {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    margin-bottom: 2rem;
  }
  .summary-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1rem 1.5rem;
    text-align: center;
    min-width: 120px;
  }
  .summary-card .number {
    font-size: 2rem;
    font-weight: bold;
    color: #58a6ff;
  }
  .summary-card .label {
    font-size: 0.85rem;
    color: #8b949e;
    margin-top: 0.25rem;
  }
  .summary-card.danger .number { color: #f85149; }
  .summary-card.success .number { color: #3fb950; }
  table {
    width: 100%;
    border-collapse: collapse;
    background: #161b22;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #30363d;
  }
  th {
    background: #21262d;
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: #8b949e;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  td {
    padding: 0.65rem 1rem;
    border-top: 1px solid #21262d;
  }
  tr.valid { }
  tr.invalid { background: rgba(248, 81, 73, 0.05); }
  .feature-name { font-weight: 600; color: #c9d1d9; }
  .status-icon.valid { color: #3fb950; font-weight: bold; font-size: 1.1rem; }
  .status-icon.invalid { color: #f85149; font-weight: bold; font-size: 1.1rem; }
  .badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge.draft { background: #1f6feb22; color: #58a6ff; border: 1px solid #1f6feb44; }
  .badge.active { background: #3fb95022; color: #3fb950; border: 1px solid #3fb95044; }
  .badge.deprecated { background: #f8514922; color: #f85149; border: 1px solid #f8514944; }
  .badge.error { background: #f8514922; color: #f85149; border: 1px solid #f8514944; }
  .badge.warning { background: #d29a2822; color: #d29a28; border: 1px solid #d29a2844; }
  .badge.info { background: #1f6feb22; color: #58a6ff; border: 1px solid #1f6feb44; }
  .violation-row td {
    padding: 0.4rem 1rem 0.4rem 2.5rem;
    font-size: 0.85rem;
    color: #8b949e;
    border-top: none;
    background: rgba(248, 81, 73, 0.03);
  }
  .violation-row code {
    color: #58a6ff;
    font-size: 0.8rem;
  }
  .footer {
    text-align: center;
    margin-top: 1.5rem;
    color: #484f58;
    font-size: 0.8rem;
  }
</style>
</head>
<body>
<div class="header">
  <h1>zero-human</h1>
  <p>Contract Linter Dashboard</p>
</div>
<div class="summary">
  <div class="summary-card">
    <div class="number">${data.totalFeatures}</div>
    <div class="label">Features</div>
  </div>
  <div class="summary-card">
    <div class="number">${data.totalRules}</div>
    <div class="label">Rules</div>
  </div>
  <div class="summary-card ${data.totalViolations > 0 ? "danger" : "success"}">
    <div class="number">${data.totalViolations}</div>
    <div class="label">Violations</div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Feature</th>
      <th>Status</th>
      <th>Valid</th>
      <th>Violations</th>
      <th>Deps</th>
      <th>Rules</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
<div class="footer">
  Updated: ${new Date().toISOString()} — zero-human MCP Contract Linter
</div>
</body>
</html>`;
}

async function collectData(projectRoot: string): Promise<Result<{ data: DashboardData; violations: Map<string, ValidationResult> }, DashboardError>> {
  const contractsDir = join(projectRoot, DEFAULT_CONTRACTS_DIR);
  const compileResult = await compileAll(contractsDir);

  if (!compileResult.ok) {
    return {
      ok: false,
      error: { message: `Compile failed: ${compileResult.error.map((e) => e.message).join("; ")}` },
    };
  }

  const { contracts } = compileResult.value;

  const validateResult = await validateAll(projectRoot);
  const validations: ValidationResult[] = validateResult.ok ? validateResult.value : [];

  const violationMap = new Map<string, ValidationResult>();
  for (const v of validations) {
    violationMap.set(v.feature, v);
  }

  return {
    ok: true,
    value: {
      data: buildDashboardData(contracts, validations),
      violations: violationMap,
    },
  };
}

async function tryListen(port: number): Promise<ReturnType<typeof Bun.serve> | null> {
  try {
    // We need a placeholder, will be replaced after collectData
    const server = Bun.serve({
      port,
      fetch() {
        return new Response("starting...", { status: 503 });
      },
    });
    return server;
  } catch {
    return null;
  }
}

export async function startDashboard(
  projectRoot: string
): Promise<Result<{ url: string; port: number; stop: () => void }, DashboardError>> {
  // Find available port
  let server: ReturnType<typeof Bun.serve> | null = null;
  let port = BASE_PORT;

  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    server = await tryListen(port + i);
    if (server) {
      port = port + i;
      break;
    }
  }

  if (!server) {
    return {
      ok: false,
      error: { message: `Could not find available port in range ${BASE_PORT}-${BASE_PORT + MAX_PORT_ATTEMPTS - 1}` },
    };
  }

  // Stop the placeholder and start the real server
  server.stop();

  const realServer = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/data") {
        const result = await collectData(projectRoot);
        if (!result.ok) {
          return Response.json({ error: result.error.message }, { status: 500 });
        }
        const { data } = result.value;
        return Response.json(data);
      }

      // Serve dashboard HTML (fresh data on each request)
      const result = await collectData(projectRoot);
      if (!result.ok) {
        return new Response(`Error: ${result.error.message}`, { status: 500 });
      }

      const html = renderHtmlPage(result.value.data, result.value.violations);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  });

  const dashboardUrl = `http://localhost:${port}`;

  return {
    ok: true,
    value: {
      url: dashboardUrl,
      port,
      stop: () => realServer.stop(),
    },
  };
}

// Keep renderDashboard for backward compat / testing, but now it returns the URL info
export async function renderDashboard(
  projectRoot: string
): Promise<Result<string, DashboardError>> {
  const result = await collectData(projectRoot);
  if (!result.ok) return result;

  const html = renderHtmlPage(result.value.data, result.value.violations);
  return { ok: true, value: html };
}

// Alias for direct HTML generation (no server)
export async function renderHtml(
  projectRoot: string
): Promise<Result<string, DashboardError>> {
  return renderDashboard(projectRoot);
}

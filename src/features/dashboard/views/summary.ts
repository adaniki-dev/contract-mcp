import type {
  DashboardData,
  ValidationResult,
  Violation,
} from "@shared/types/contract.types";

function escapeHtml(text: string | undefined | null): string {
  if (text === undefined || text === null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStatusBar(totalViolations: number): string {
  const isClean = totalViolations === 0;
  const bg = isClean ? "#3fb950" : "#f85149";
  const label = isClean
    ? "All contracts valid &#10003;"
    : `${totalViolations} violation${totalViolations === 1 ? "" : "s"} found &#10007;`;

  return `<div style="
    background: ${bg};
    color: #ffffff;
    font-weight: 600;
    font-size: 0.8125rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 1.25rem;
  ">${label}</div>`;
}

function renderSummaryCards(data: DashboardData): string {
  const violationColor =
    data.totalViolations > 0 ? "color: #f85149;" : "color: #3fb950;";

  const cards = [
    { value: data.totalFeatures, label: "Features", style: "color: #58a6ff;" },
    { value: data.totalRules, label: "Rules", style: "color: #58a6ff;" },
    { value: data.totalViolations, label: "Violations", style: violationColor },
    { value: 0, label: "Diagnostics", style: "color: #58a6ff;" },
  ];

  const cardsHtml = cards
    .map(
      (c) => `<div class="card" style="flex: 1; min-width: 120px; text-align: center;">
      <div style="font-size: 1.75rem; font-weight: 700; ${c.style}">${c.value}</div>
      <div style="font-size: 0.75rem; color: #8b949e; margin-top: 0.25rem;">${c.label}</div>
    </div>`
    )
    .join("\n    ");

  return `<div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
    ${cardsHtml}
  </div>`;
}

function renderViolationRows(violations: Violation[]): string {
  return violations
    .map(
      (v) =>
        `<tr class="violation-detail">
        <td colspan="6" style="
          padding: 0.375rem 1rem 0.375rem 2.5rem;
          font-size: 0.8125rem;
          color: #8b949e;
          border-top: none;
          background: rgba(248, 81, 73, 0.03);
        ">
          <span class="badge ${v.severity}">${v.severity}</span>
          <strong style="margin-left: 0.375rem;">${escapeHtml(v.rule)}</strong>:
          ${escapeHtml(v.message)}${v.file ? ` <code style="color: #58a6ff; font-size: 0.75rem;">${escapeHtml(v.file)}</code>` : ""}
        </td>
      </tr>`
    )
    .join("\n");
}

function renderFeaturesTable(
  data: DashboardData,
  violations: Map<string, ValidationResult>
): string {
  const rows = data.features
    .map((f) => {
      const rowClass = f.valid ? "" : ' style="background: rgba(248, 81, 73, 0.05);"';
      const icon = f.valid
        ? '<span style="color: #3fb950; font-weight: 700;">&#10003;</span>'
        : '<span style="color: #f85149; font-weight: 700;">&#10007;</span>';

      const v = violations.get(f.feature);
      const violationRows =
        v && v.violations.length > 0 ? renderViolationRows(v.violations) : "";

      return `<tr${rowClass}>
        <td><a href="/project?feature=${encodeURIComponent(f.feature)}" style="font-weight: 600;">${escapeHtml(f.feature)}</a></td>
        <td><span class="badge ${f.status}">${f.status}</span></td>
        <td class="text-center">${icon}</td>
        <td class="text-center">${f.violationsCount}</td>
        <td class="text-center">${f.dependenciesCount}</td>
        <td class="text-center">${f.rulesCount}</td>
      </tr>${violationRows}`;
    })
    .join("\n");

  return `<div class="card" style="padding: 0; overflow: hidden;">
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Status</th>
          <th class="text-center">Valid</th>
          <th class="text-center">Violations</th>
          <th class="text-center">Deps</th>
          <th class="text-center">Rules</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

export function renderSummary(
  data: DashboardData,
  violations: Map<string, ValidationResult>
): string {
  return [
    renderStatusBar(data.totalViolations),
    renderSummaryCards(data),
    renderFeaturesTable(data, violations),
  ].join("\n");
}

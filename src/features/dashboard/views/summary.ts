import type {
  DashboardData,
  FeatureSummary,
  ValidationResult,
  Violation,
  CommunityReport,
  FeatureClassification,
} from "@shared/types/contract.types";
import {
  communityColor,
  communityColorBright,
  communityColorFaint,
  escapeHtml,
  modularityBand,
  modularityLabel,
  roleIcon,
} from "./_shared";

function renderHero(
  data: DashboardData,
  structure: CommunityReport,
  hasWarnings: boolean
): string {
  const isClean = data.totalViolations === 0;
  const bg = isClean
    ? hasWarnings
      ? "linear-gradient(135deg, #d29a28 0%, #a67914 100%)"
      : "linear-gradient(135deg, #3fb950 0%, #2ea043 100%)"
    : "linear-gradient(135deg, #f85149 0%, #da3633 100%)";
  const icon = isClean ? "&#10003;" : "&#10007;";
  const status = isClean
    ? hasWarnings
      ? "Contracts valid · with warnings"
      : "All contracts valid"
    : `${data.totalViolations} violation${data.totalViolations === 1 ? "" : "s"} found`;

  return `<section style="background: ${bg}; border-radius: 12px; padding: 1.75rem 2rem; margin-bottom: 1.5rem; color: #ffffff; box-shadow: 0 4px 16px rgba(0,0,0,0.25);">
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
      <div>
        <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.75; font-weight: 600;">${escapeHtml(data.project)}</div>
        <div style="font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem;">${icon} ${status}</div>
        <div style="font-size: 0.875rem; opacity: 0.85; margin-top: 0.25rem;">
          ${data.totalFeatures} features · ${structure.communities.length} communit${structure.communities.length === 1 ? "y" : "ies"} · modularity ${structure.modularity.toFixed(2)}
        </div>
      </div>
      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        ${structure.hubs.length > 0 ? `<div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.875rem; border-radius: 8px; font-size: 0.8125rem;"><strong>${structure.hubs.length}</strong> hub${structure.hubs.length === 1 ? "" : "s"}</div>` : ""}
        ${structure.bridges.length > 0 ? `<div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.875rem; border-radius: 8px; font-size: 0.8125rem;"><strong>${structure.bridges.length}</strong> bridge${structure.bridges.length === 1 ? "" : "s"}</div>` : ""}
        ${structure.orphans.length > 0 ? `<div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.875rem; border-radius: 8px; font-size: 0.8125rem;"><strong>${structure.orphans.length}</strong> orphan${structure.orphans.length === 1 ? "" : "s"}</div>` : ""}
      </div>
    </div>
  </section>`;
}

function renderMetricsGrid(
  data: DashboardData,
  structure: CommunityReport
): string {
  const violationColor = data.totalViolations > 0 ? "#f85149" : "#3fb950";
  const modBand = modularityBand(structure.modularity);
  const modColor = modBand === "high" ? "#3fb950" : modBand === "medium" ? "#d29a28" : "#8b949e";

  const cardStyle =
    "background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 1rem 1.25rem; flex: 1 1 160px; min-width: 140px;";
  const numStyle = "font-size: 1.875rem; font-weight: 700; line-height: 1;";
  const labelStyle =
    "font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0.5rem; font-weight: 600;";

  return `<section style="display: flex; gap: 0.875rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
    <div style="${cardStyle}">
      <div style="${numStyle} color: #58a6ff;">${data.totalFeatures}</div>
      <div style="${labelStyle}">Features</div>
    </div>
    <div style="${cardStyle}">
      <div style="${numStyle} color: #58a6ff;">${data.totalRules}</div>
      <div style="${labelStyle}">Rules</div>
    </div>
    <div style="${cardStyle}">
      <div style="${numStyle} color: ${violationColor};">${data.totalViolations}</div>
      <div style="${labelStyle}">Violations</div>
    </div>
    <div style="${cardStyle}">
      <div style="${numStyle} color: #58a6ff;">${structure.communities.length}</div>
      <div style="${labelStyle}">Communities</div>
    </div>
    <div style="${cardStyle}">
      <div style="${numStyle} color: #d29a28;">${structure.hubs.length}</div>
      <div style="${labelStyle}">Hubs</div>
    </div>
    <div style="${cardStyle}">
      <div style="${numStyle} color: ${modColor};">${structure.modularity.toFixed(2)}</div>
      <div style="${labelStyle}">Modularity · ${modularityLabel(structure.modularity)}</div>
    </div>
  </section>`;
}

function renderArchitecturePanel(
  structure: CommunityReport,
  classByFeature: Map<string, FeatureClassification>
): string {
  const hubItems =
    structure.hubs.length > 0
      ? structure.hubs
          .map((h) => {
            const cls = classByFeature.get(h);
            return `<li style="display: flex; justify-content: space-between; padding: 0.4rem 0.625rem; background: #0d1117; border-radius: 6px; margin-bottom: 0.375rem; font-size: 0.8125rem;">
            <span><a href="/project?feature=${encodeURIComponent(h)}" style="color: #c9d1d9; text-decoration: none;">${roleIcon("hub")} <strong>${escapeHtml(h)}</strong></a></span>
            <span style="color: #8b949e;">degree ${cls?.degree ?? 0}</span>
          </li>`;
          })
          .join("")
      : '<li style="color: #484f58; font-size: 0.8125rem; padding: 0.4rem 0.625rem;">No hubs detected</li>';

  const bridgeItems =
    structure.bridges.length > 0
      ? structure.bridges
          .map((b) => {
            const cls = classByFeature.get(b);
            return `<li style="display: flex; justify-content: space-between; padding: 0.4rem 0.625rem; background: #0d1117; border-radius: 6px; margin-bottom: 0.375rem; font-size: 0.8125rem;">
            <span><a href="/project?feature=${encodeURIComponent(b)}" style="color: #c9d1d9; text-decoration: none;">${roleIcon("bridge")} <strong>${escapeHtml(b)}</strong></a></span>
            <span style="color: #8b949e;">degree ${cls?.degree ?? 0}</span>
          </li>`;
          })
          .join("")
      : '<li style="color: #484f58; font-size: 0.8125rem; padding: 0.4rem 0.625rem;">No bridges detected</li>';

  const orphanItems =
    structure.orphans.length > 0
      ? structure.orphans
          .map(
            (o) =>
              `<li style="padding: 0.4rem 0.625rem; background: #0d1117; border-radius: 6px; margin-bottom: 0.375rem; font-size: 0.8125rem;">
            <a href="/project?feature=${encodeURIComponent(o)}" style="color: #c9d1d9; text-decoration: none;">${roleIcon("orphan")} <strong>${escapeHtml(o)}</strong></a>
          </li>`
          )
          .join("")
      : '<li style="color: #484f58; font-size: 0.8125rem; padding: 0.4rem 0.625rem;">No orphans</li>';

  const modBand = modularityBand(structure.modularity);
  const checks: string[] = [];
  if (structure.orphans.length > 0) {
    checks.push(
      `<div style="display: flex; align-items: start; gap: 0.625rem; padding: 0.625rem 0.75rem; background: rgba(210, 154, 40, 0.08); border: 1px solid rgba(210, 154, 40, 0.3); border-radius: 6px; margin-bottom: 0.5rem;">
        <span style="color: #d29a28; font-size: 1rem;">⚠</span>
        <span style="font-size: 0.8125rem; color: #c9d1d9;">${structure.orphans.length} orphan contract${structure.orphans.length === 1 ? "" : "s"} — consider removing or connecting them</span>
      </div>`
    );
  }
  if (modBand === "low" && structure.communities.length > 0) {
    checks.push(
      `<div style="display: flex; align-items: start; gap: 0.625rem; padding: 0.625rem 0.75rem; background: rgba(210, 154, 40, 0.08); border: 1px solid rgba(210, 154, 40, 0.3); border-radius: 6px; margin-bottom: 0.5rem;">
        <span style="color: #d29a28; font-size: 1rem;">⚠</span>
        <span style="font-size: 0.8125rem; color: #c9d1d9;">Low modularity (${structure.modularity.toFixed(2)}) — graph is densely connected, consider extracting clusters</span>
      </div>`
    );
  }
  if (structure.hubs.length > 0) {
    checks.push(
      `<div style="display: flex; align-items: start; gap: 0.625rem; padding: 0.625rem 0.75rem; background: rgba(210, 154, 40, 0.08); border: 1px solid rgba(210, 154, 40, 0.3); border-radius: 6px; margin-bottom: 0.5rem;">
        <span style="color: #d29a28; font-size: 1rem;">⚡</span>
        <span style="font-size: 0.8125rem; color: #c9d1d9;">${structure.hubs.length} hub${structure.hubs.length === 1 ? "" : "s"} carry most of the graph — changes there have high blast radius</span>
      </div>`
    );
  }
  if (checks.length === 0) {
    checks.push(
      `<div style="display: flex; align-items: start; gap: 0.625rem; padding: 0.625rem 0.75rem; background: rgba(63, 185, 80, 0.08); border: 1px solid rgba(63, 185, 80, 0.3); border-radius: 6px;">
        <span style="color: #3fb950; font-size: 1rem;">&#10003;</span>
        <span style="font-size: 0.8125rem; color: #c9d1d9;">No structural issues detected</span>
      </div>`
    );
  }

  const columnStyle =
    "background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 1rem 1.25rem; flex: 1 1 300px;";
  const headerStyle =
    "font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 0.75rem;";

  return `<section style="display: flex; gap: 0.875rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
    <div style="${columnStyle}">
      <div style="${headerStyle}">Critical Features</div>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${hubItems}
        ${bridgeItems}
      </ul>
    </div>
    <div style="${columnStyle}">
      <div style="${headerStyle}">Health Checks</div>
      ${checks.join("")}
    </div>
    <div style="${columnStyle}">
      <div style="${headerStyle}">Orphans</div>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${orphanItems}
      </ul>
    </div>
  </section>`;
}

function renderCommunitiesRow(
  structure: CommunityReport,
  classByFeature: Map<string, FeatureClassification>
): string {
  if (structure.communities.length === 0) return "";

  const cards = structure.communities
    .map((c) => {
      const color = communityColor(c.id);
      const bright = communityColorBright(c.id);
      const faint = communityColorFaint(c.id);
      const hubsInCommunity = c.features.filter((f) => {
        const cls = classByFeature.get(f);
        return cls?.role === "hub";
      });
      const membersPreview = c.features
        .slice(0, 5)
        .map(
          (f) =>
            `<a href="/project?feature=${encodeURIComponent(f)}" style="color: ${bright}; text-decoration: none; font-size: 0.75rem; background: ${faint}; padding: 0.15rem 0.5rem; border-radius: 10px; margin-right: 0.25rem; display: inline-block; margin-bottom: 0.25rem;">${escapeHtml(f)}</a>`
        )
        .join("");
      const more = c.features.length > 5 ? `<span style="color: #8b949e; font-size: 0.75rem;">+${c.features.length - 5} more</span>` : "";

      return `<div style="background: #161b22; border: 1px solid #30363d; border-left: 4px solid ${color}; border-radius: 10px; padding: 1rem 1.125rem; min-width: 280px; flex: 1 1 280px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></div>
            <strong style="color: #c9d1d9; font-size: 0.9375rem;">${escapeHtml(c.id)}</strong>
          </div>
          <span style="color: #8b949e; font-size: 0.75rem;">density ${c.density.toFixed(2)}</span>
        </div>
        <div style="color: #8b949e; font-size: 0.75rem; margin-bottom: 0.625rem;">
          ${c.size} feature${c.size === 1 ? "" : "s"}${hubsInCommunity.length > 0 ? ` · ${hubsInCommunity.length} hub${hubsInCommunity.length === 1 ? "" : "s"} ⚡` : ""}
        </div>
        <div>${membersPreview}${more}</div>
      </div>`;
    })
    .join("");

  return `<section style="margin-bottom: 1.5rem;">
    <div style="font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 0.75rem;">Communities</div>
    <div style="display: flex; gap: 0.875rem; flex-wrap: wrap;">${cards}</div>
  </section>`;
}

function renderViolationRows(violations: Violation[]): string {
  return violations
    .map(
      (v) => `<tr class="violation-row">
        <td colspan="7" style="padding: 0.5rem 1rem 0.5rem 2.5rem; font-size: 0.8125rem; color: #8b949e; background: rgba(248, 81, 73, 0.04); border-top: none;">
          <span class="badge ${v.severity}">${v.severity}</span>
          <strong style="color: #c9d1d9; margin-left: 0.375rem;">${escapeHtml(v.rule)}</strong>
          <span style="margin-left: 0.375rem;">${escapeHtml(v.message)}</span>
          ${v.file ? `<code style="color: #58a6ff; margin-left: 0.375rem; font-size: 0.75rem;">${escapeHtml(v.file)}</code>` : ""}
        </td>
      </tr>`
    )
    .join("");
}

function renderFeaturesTable(
  data: DashboardData,
  violations: Map<string, ValidationResult>,
  classByFeature: Map<string, FeatureClassification>
): string {
  const rows = data.features
    .map((f: FeatureSummary) => {
      const cls = classByFeature.get(f.feature);
      const community = cls?.community ?? f.feature;
      const role = cls?.role ?? "member";
      const communityBorder = `border-left: 3px solid ${communityColor(community)};`;
      const rowBg = f.valid ? "" : " background: rgba(248, 81, 73, 0.05);";
      const icon = f.valid
        ? '<span style="color: #3fb950; font-weight: 700;">&#10003;</span>'
        : '<span style="color: #f85149; font-weight: 700;">&#10007;</span>';
      const v = violations.get(f.feature);
      const violationRows =
        v && v.violations.length > 0 ? renderViolationRows(v.violations) : "";
      const roleBadgeBg =
        role === "hub"
          ? "rgba(210, 154, 40, 0.15)"
          : role === "bridge"
          ? "rgba(248, 81, 73, 0.15)"
          : role === "leaf"
          ? "rgba(63, 185, 80, 0.15)"
          : role === "orphan"
          ? "rgba(139, 148, 158, 0.15)"
          : "rgba(88, 166, 255, 0.1)";
      const roleBadgeColor =
        role === "hub"
          ? "#d29a28"
          : role === "bridge"
          ? "#f85149"
          : role === "leaf"
          ? "#3fb950"
          : role === "orphan"
          ? "#8b949e"
          : "#58a6ff";

      return `<tr style="${communityBorder}${rowBg}">
        <td style="padding: 0.75rem 1rem; font-weight: 600;">
          <a href="/project?feature=${encodeURIComponent(f.feature)}" style="color: #c9d1d9; text-decoration: none;">${escapeHtml(f.feature)}</a>
        </td>
        <td style="padding: 0.75rem 1rem;">
          <span class="badge ${f.status}">${f.status}</span>
        </td>
        <td style="padding: 0.75rem 1rem;">
          <span style="display: inline-flex; align-items: center; gap: 0.25rem; background: ${roleBadgeBg}; color: ${roleBadgeColor}; padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">
            ${roleIcon(role)} ${role}
          </span>
        </td>
        <td style="padding: 0.75rem 1rem;">
          <span style="display: inline-flex; align-items: center; gap: 0.375rem; color: #c9d1d9; font-size: 0.8125rem;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${communityColor(community)};"></span>
            ${escapeHtml(community)}
          </span>
        </td>
        <td style="padding: 0.75rem 1rem; text-align: center;">${icon}</td>
        <td style="padding: 0.75rem 1rem; text-align: center; color: ${f.violationsCount > 0 ? "#f85149" : "#8b949e"}; font-weight: 600;">${f.violationsCount}</td>
        <td style="padding: 0.75rem 1rem; text-align: center; color: #8b949e;">${f.dependenciesCount}</td>
        <td style="padding: 0.75rem 1rem; text-align: center; color: #8b949e;">${f.rulesCount}</td>
      </tr>${violationRows}`;
    })
    .join("\n");

  return `<section>
    <div style="font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 0.75rem;">Features</div>
    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 10px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #21262d;">
            <th style="padding: 0.625rem 1rem; text-align: left; font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Feature</th>
            <th style="padding: 0.625rem 1rem; text-align: left; font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Status</th>
            <th style="padding: 0.625rem 1rem; text-align: left; font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Role</th>
            <th style="padding: 0.625rem 1rem; text-align: left; font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Community</th>
            <th style="padding: 0.625rem 1rem; text-align: center; font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Valid</th>
            <th style="padding: 0.625rem 1rem; text-align: center; font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Violations</th>
            <th style="padding: 0.625rem 1rem; text-align: center; font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Deps</th>
            <th style="padding: 0.625rem 1rem; text-align: center; font-size: 0.6875rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Rules</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </section>`;
}

export function renderSummary(
  data: DashboardData,
  violations: Map<string, ValidationResult>,
  structure: CommunityReport
): string {
  const classByFeature = new Map(
    structure.classifications.map((c) => [c.feature, c])
  );

  // Count warnings
  let warnings = 0;
  for (const vr of violations.values()) {
    for (const v of vr.violations) {
      if (v.severity === "warning") warnings++;
    }
  }

  return [
    renderHero(data, structure, warnings > 0),
    renderMetricsGrid(data, structure),
    renderArchitecturePanel(structure, classByFeature),
    renderCommunitiesRow(structure, classByFeature),
    renderFeaturesTable(data, violations, classByFeature),
  ].join("\n");
}

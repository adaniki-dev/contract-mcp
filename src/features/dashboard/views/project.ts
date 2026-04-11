import type {
  Contract,
  CommunityReport,
  FeatureClassification,
  NodeRole,
} from "@shared/types/contract.types";
import {
  communityColor,
  communityColorBright,
  communityColorFaint,
  escapeHtml,
  roleIcon,
} from "./_shared";

function statusBadge(status: string): string {
  return `<span class="project-badge project-badge--${status}">${escapeHtml(status)}</span>`;
}

function severityBadge(severity: string): string {
  return `<span class="project-badge project-badge--${severity}">${escapeHtml(severity)}</span>`;
}

function roleBadge(role: NodeRole | string): string {
  const label = String(role);
  return `<span class="project-role-badge project-role-badge--${label}">${roleIcon(role)} ${label}</span>`;
}

// === Sidebar (grouped by community) ===

function renderSidebar(
  contracts: Contract[],
  classByFeature: Map<string, FeatureClassification>,
  structure: CommunityReport,
  selectedFeature?: string
): string {
  // Build community → features map preserving order from structure.communities
  const communityOrder: string[] = structure.communities.map((c) => c.id);
  const groups = new Map<string, Contract[]>();
  for (const id of communityOrder) groups.set(id, []);

  for (const c of contracts) {
    const cls = classByFeature.get(c.contract.feature);
    const community = cls?.community ?? "uncategorized";
    if (!groups.has(community)) groups.set(community, []);
    groups.get(community)!.push(c);
  }

  const groupHtml = [...groups.entries()]
    .filter(([, features]) => features.length > 0)
    .map(([communityId, features]) => {
      const color = communityColor(communityId);
      const bright = communityColorBright(communityId);
      const hasSelected = features.some(
        (c) => c.contract.feature === selectedFeature
      );
      const openAttr = hasSelected || !selectedFeature ? " open" : "";

      const items = features
        .map((c) => {
          const slug = c.contract.feature;
          const cls = classByFeature.get(slug);
          const role = cls?.role ?? "member";
          const isActive = selectedFeature === slug;
          const activeClass = isActive ? " project-sidebar__item--active" : "";
          const activeStyle = isActive
            ? ` style="border-left-color: ${color}; background: ${communityColorFaint(communityId)};"`
            : "";
          return `<a href="/project?feature=${encodeURIComponent(slug)}" class="project-sidebar__item${activeClass}"${activeStyle} title="${escapeHtml(c.contract.description)}" data-feature="${escapeHtml(slug)}">
            <span class="project-sidebar__role-icon" style="color: ${bright};">${roleIcon(role)}</span>
            <span class="project-sidebar__label">${escapeHtml(slug)}</span>
            <span class="project-sidebar__status project-sidebar__status--${c.contract.status}"></span>
          </a>`;
        })
        .join("\n");

      return `<details class="project-sidebar__group"${openAttr}>
        <summary class="project-sidebar__group-header">
          <span class="project-sidebar__group-swatch" style="background: ${color};"></span>
          <span class="project-sidebar__group-name">${escapeHtml(communityId)}</span>
          <span class="project-sidebar__group-count">${features.length}</span>
        </summary>
        <nav class="project-sidebar__nav">
          ${items}
        </nav>
      </details>`;
    })
    .join("\n");

  return `<aside class="project-sidebar">
    <div class="project-sidebar__search-wrap">
      <input type="text" id="project-search" class="project-sidebar__search" placeholder="Search features..." />
    </div>
    <div class="project-sidebar__body">
      ${groupHtml}
    </div>
  </aside>`;
}

// === Architecture Overview (shown when no feature selected) ===

function renderArchitectureOverview(
  contracts: Contract[],
  classByFeature: Map<string, FeatureClassification>,
  structure: CommunityReport
): string {
  const communityCards = structure.communities
    .map((c) => {
      const color = communityColor(c.id);
      const bright = communityColorBright(c.id);
      const hubsInCommunity = c.features.filter((f) => {
        const cls = classByFeature.get(f);
        return cls?.role === "hub";
      });
      const featurePills = c.features
        .slice(0, 8)
        .map(
          (f) =>
            `<a href="/project?feature=${encodeURIComponent(f)}" class="project-overview-pill" style="color: ${bright};">${escapeHtml(f)}</a>`
        )
        .join("");
      const more =
        c.features.length > 8
          ? `<span class="project-overview-pill project-overview-pill--more">+${c.features.length - 8}</span>`
          : "";

      return `<div class="project-overview-card" style="border-left: 4px solid ${color};">
        <div class="project-overview-card__title">
          <span class="project-overview-card__swatch" style="background: ${color};"></span>
          <h3>${escapeHtml(c.id)}</h3>
          <span class="project-overview-card__density">density ${c.density.toFixed(2)}</span>
        </div>
        <div class="project-overview-card__meta">
          ${c.size} feature${c.size === 1 ? "" : "s"}${hubsInCommunity.length > 0 ? ` · ${hubsInCommunity.length} hub${hubsInCommunity.length === 1 ? "" : "s"} ⚡` : ""}
        </div>
        <div class="project-overview-card__pills">${featurePills}${more}</div>
      </div>`;
    })
    .join("\n");

  const totalContracts = contracts.length;
  const modPct = (structure.modularity * 100).toFixed(0);

  return `<div class="project-content-inner">
    <header class="project-overview-header">
      <h1>Architecture</h1>
      <p>${totalContracts} features across ${structure.communities.length} communit${structure.communities.length === 1 ? "y" : "ies"} · modularity ${modPct}%</p>
    </header>

    <section class="project-overview-meta">
      <div class="project-overview-stat">
        <div class="project-overview-stat__num" style="color: #d29a28;">${structure.hubs.length}</div>
        <div class="project-overview-stat__label">Hubs ⚡</div>
      </div>
      <div class="project-overview-stat">
        <div class="project-overview-stat__num" style="color: #f85149;">${structure.bridges.length}</div>
        <div class="project-overview-stat__label">Bridges 🌉</div>
      </div>
      <div class="project-overview-stat">
        <div class="project-overview-stat__num" style="color: #8b949e;">${structure.orphans.length}</div>
        <div class="project-overview-stat__label">Orphans ○</div>
      </div>
    </section>

    <section class="project-overview-grid">
      ${communityCards}
    </section>
  </div>`;
}

// === Feature Detail ===

function renderStructureCard(
  c: Contract,
  classByFeature: Map<string, FeatureClassification>
): string {
  const feature = c.contract.feature;
  const cls = classByFeature.get(feature);
  const role = cls?.role ?? "member";
  const community = cls?.community ?? feature;
  const degree = cls?.degree ?? 0;
  const color = communityColor(community);
  const bright = communityColorBright(community);

  let warning = "";
  if (role === "hub") {
    warning = `<div class="project-structure__warning project-structure__warning--hub">
      <span>⚡</span>
      <div>
        <strong>High-impact feature</strong>
        <div>Changes here propagate widely. Run blast_radius before modifying.</div>
      </div>
    </div>`;
  } else if (role === "bridge") {
    warning = `<div class="project-structure__warning project-structure__warning--bridge">
      <span>🌉</span>
      <div>
        <strong>Structural bridge</strong>
        <div>Removing this feature would disconnect parts of the graph.</div>
      </div>
    </div>`;
  } else if (role === "orphan") {
    warning = `<div class="project-structure__warning project-structure__warning--orphan">
      <span>○</span>
      <div>
        <strong>Isolated feature</strong>
        <div>No connections to other features. Candidate for removal or consolidation.</div>
      </div>
    </div>`;
  } else if (role === "leaf") {
    warning = `<div class="project-structure__warning project-structure__warning--leaf">
      <span>🍃</span>
      <div>
        <strong>Leaf feature</strong>
        <div>Has dependencies but nothing depends on it. Changes have limited reach.</div>
      </div>
    </div>`;
  }

  return `<section class="project-structure-card" style="background: linear-gradient(135deg, ${color}22 0%, #161b22 60%); border-left: 4px solid ${color};">
    <div class="project-structure__pills">
      <div class="project-structure__pill">
        <div class="project-structure__pill-label">Role</div>
        <div class="project-structure__pill-value">${roleBadge(role)}</div>
      </div>
      <div class="project-structure__pill">
        <div class="project-structure__pill-label">Community</div>
        <div class="project-structure__pill-value">
          <span class="project-structure__swatch" style="background: ${bright};"></span>
          <span>${escapeHtml(community)}</span>
        </div>
      </div>
      <div class="project-structure__pill">
        <div class="project-structure__pill-label">Degree</div>
        <div class="project-structure__pill-value project-structure__pill-num">${degree}</div>
      </div>
    </div>
    ${warning}
  </section>`;
}

function renderHeaderCard(c: Contract): string {
  return `<section class="project-card">
    <div class="project-card__title-row">
      <h2 class="project-card__feature-name">${escapeHtml(c.contract.feature)}</h2>
      <div class="project-card__meta">
        <span class="project-card__version">v${escapeHtml(c.contract.version)}</span>
        ${statusBadge(c.contract.status)}
      </div>
    </div>
    <p class="project-card__description">${escapeHtml(c.contract.description)}</p>
    <p class="project-card__owner">Owner: <strong>${escapeHtml(c.contract.owner)}</strong></p>
  </section>`;
}

function renderDependenciesCard(c: Contract): string {
  const internalItems =
    c.dependencies.internal.length > 0
      ? c.dependencies.internal
          .map(
            (d) => `<div class="project-dep">
              <span class="project-dep__arrow">&rarr;</span>
              <a href="/project?feature=${encodeURIComponent(d.feature)}" class="project-dep__name">${escapeHtml(d.feature)}</a>
              <span class="project-dep__reason">${escapeHtml(d.reason)}</span>
            </div>`
          )
          .join("\n")
      : `<p class="project-card__empty">No internal dependencies</p>`;

  const externalItems =
    c.dependencies.external.length > 0
      ? c.dependencies.external
          .map(
            (d) => `<div class="project-dep">
              <span class="project-dep__pkg-icon">&#9679;</span>
              <span class="project-dep__name">${escapeHtml(d.package)}</span>
              <code class="project-dep__version">${escapeHtml(d.version)}</code>
              <span class="project-dep__reason">${escapeHtml(d.reason)}</span>
            </div>`
          )
          .join("\n")
      : `<p class="project-card__empty">No external dependencies</p>`;

  return `<section class="project-card">
    <h3 class="project-card__title">Dependencies</h3>
    <div class="project-card__subsection">
      <div class="project-card__subtitle">Internal</div>
      ${internalItems}
    </div>
    <div class="project-card__subsection">
      <div class="project-card__subtitle">External</div>
      ${externalItems}
    </div>
  </section>`;
}

function renderExportsCard(c: Contract): string {
  const fnItems =
    c.exports.functions.length > 0
      ? c.exports.functions
          .map(
            (f) => `<div class="project-export">
              <code class="project-export__sig">${escapeHtml(f.name)}${escapeHtml(f.signature)}</code>
              <div class="project-export__row">
                ${f.pure ? '<span class="project-export__tag">✧ pure</span>' : ""}
                <span class="project-export__desc">${escapeHtml(f.description)}</span>
              </div>
            </div>`
          )
          .join("\n")
      : `<p class="project-card__empty">No exported functions</p>`;

  const typeItems =
    c.exports.types.length > 0
      ? c.exports.types
          .map(
            (t) => `<div class="project-export">
              <code class="project-export__type-name">${escapeHtml(t.name)}</code>
              <span class="project-export__desc">${escapeHtml(t.description)}</span>
            </div>`
          )
          .join("\n")
      : `<p class="project-card__empty">No exported types</p>`;

  return `<section class="project-card">
    <h3 class="project-card__title">Exports</h3>
    <div class="project-card__subsection">
      <div class="project-card__subtitle">Functions (${c.exports.functions.length})</div>
      ${fnItems}
    </div>
    <div class="project-card__subsection">
      <div class="project-card__subtitle">Types (${c.exports.types.length})</div>
      ${typeItems}
    </div>
  </section>`;
}

function renderRulesCard(c: Contract): string {
  if (c.rules.length === 0) {
    return `<section class="project-card">
      <h3 class="project-card__title">Rules</h3>
      <p class="project-card__empty">No rules declared</p>
    </section>`;
  }

  const items = c.rules
    .map(
      (r) => `<div class="project-rule">
        ${severityBadge(r.severity)}
        <code class="project-rule__id">${escapeHtml(r.id)}</code>
        <span class="project-rule__desc">${escapeHtml(r.description)}</span>
      </div>`
    )
    .join("\n");

  return `<section class="project-card">
    <h3 class="project-card__title">Rules (${c.rules.length})</h3>
    ${items}
  </section>`;
}

function renderFilesCard(c: Contract): string {
  if (c.files.length === 0) {
    return `<section class="project-card">
      <h3 class="project-card__title">Files</h3>
      <p class="project-card__empty">No files declared</p>
    </section>`;
  }

  const items = c.files
    .map(
      (f) => `<div class="project-file">
        <code class="project-file__path">${escapeHtml(f.path)}</code>
        <span class="project-file__purpose">${escapeHtml(f.purpose)}</span>
      </div>`
    )
    .join("\n");

  return `<section class="project-card">
    <h3 class="project-card__title">Files (${c.files.length})</h3>
    ${items}
  </section>`;
}

function renderEndpointsCard(c: Contract): string {
  if (!c.endpoints || c.endpoints.length === 0) return "";

  const items = c.endpoints
    .map(
      (e) => `<div class="project-endpoint">
        <code class="project-endpoint__tool">${escapeHtml(e.tool)}</code>
        <span class="project-endpoint__desc">${escapeHtml(e.description)}</span>
        <div class="project-endpoint__io">
          <div><span class="project-endpoint__io-label">input</span> <code>${escapeHtml(e.input)}</code></div>
          <div><span class="project-endpoint__io-label">output</span> <code>${escapeHtml(e.output)}</code></div>
          ${e.errors.length > 0 ? `<div><span class="project-endpoint__io-label">errors</span> <span>${e.errors.map((err) => `<code>${escapeHtml(err)}</code>`).join(", ")}</span></div>` : ""}
        </div>
      </div>`
    )
    .join("\n");

  return `<section class="project-card">
    <h3 class="project-card__title">MCP Endpoints (${c.endpoints.length})</h3>
    ${items}
  </section>`;
}

function renderFeatureDetail(
  c: Contract,
  classByFeature: Map<string, FeatureClassification>
): string {
  return `<div class="project-content-inner">
    ${renderStructureCard(c, classByFeature)}
    ${renderHeaderCard(c)}
    ${renderDependenciesCard(c)}
    ${renderExportsCard(c)}
    ${renderRulesCard(c)}
    ${renderFilesCard(c)}
    ${renderEndpointsCard(c)}
  </div>`;
}

// === Styles ===

function renderStyles(): string {
  return `<style>
    .project-layout {
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
      min-height: calc(100vh - 200px);
    }
    .project-sidebar {
      width: 280px;
      flex-shrink: 0;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      overflow: hidden;
      position: sticky;
      top: 72px;
      max-height: calc(100vh - 88px);
      display: flex;
      flex-direction: column;
    }
    .project-sidebar__search-wrap {
      padding: 0.75rem;
      border-bottom: 1px solid #21262d;
    }
    .project-sidebar__search {
      width: 100%;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      color: #c9d1d9;
      font-size: 0.8125rem;
      font-family: inherit;
      outline: none;
      transition: border-color 150ms;
    }
    .project-sidebar__search:focus {
      border-color: #58a6ff;
    }
    .project-sidebar__body {
      overflow-y: auto;
      flex: 1;
      padding: 0.5rem 0;
    }
    .project-sidebar__group {
      margin-bottom: 0.25rem;
    }
    .project-sidebar__group-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      cursor: pointer;
      font-size: 0.75rem;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      user-select: none;
      list-style: none;
    }
    .project-sidebar__group-header::-webkit-details-marker {
      display: none;
    }
    .project-sidebar__group-header::before {
      content: "▸";
      font-size: 0.625rem;
      color: #484f58;
      transition: transform 150ms;
    }
    .project-sidebar__group[open] .project-sidebar__group-header::before {
      transform: rotate(90deg);
    }
    .project-sidebar__group-swatch {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .project-sidebar__group-name {
      color: #c9d1d9;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .project-sidebar__group-count {
      color: #484f58;
      font-size: 0.6875rem;
      background: #0d1117;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
    }
    .project-sidebar__nav {
      display: flex;
      flex-direction: column;
      padding: 0.125rem 0;
    }
    .project-sidebar__item {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 1.25rem 0.5rem 1.75rem;
      color: #c9d1d9;
      text-decoration: none;
      font-size: 0.8125rem;
      transition: background 100ms;
      border-left: 3px solid transparent;
    }
    .project-sidebar__item:hover {
      background: #1c2128;
    }
    .project-sidebar__item--active {
      font-weight: 600;
    }
    .project-sidebar__role-icon {
      font-size: 0.75rem;
      width: 12px;
      text-align: center;
      flex-shrink: 0;
    }
    .project-sidebar__label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .project-sidebar__status {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .project-sidebar__status--draft { background: #1f6feb; }
    .project-sidebar__status--active { background: #3fb950; }
    .project-sidebar__status--deprecated { background: #f85149; }

    .project-content {
      flex: 1;
      min-width: 0;
    }
    .project-content-inner {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .project-overview-header h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: #c9d1d9;
      margin-bottom: 0.25rem;
    }
    .project-overview-header p {
      color: #8b949e;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .project-overview-meta {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .project-overview-stat {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 0.875rem 1.125rem;
      flex: 1;
    }
    .project-overview-stat__num {
      font-size: 1.5rem;
      font-weight: 700;
    }
    .project-overview-stat__label {
      font-size: 0.6875rem;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      margin-top: 0.25rem;
    }
    .project-overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }
    .project-overview-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 1rem 1.125rem;
    }
    .project-overview-card__title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .project-overview-card__title h3 {
      font-size: 1rem;
      font-weight: 700;
      color: #c9d1d9;
      flex: 1;
    }
    .project-overview-card__swatch {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .project-overview-card__density {
      color: #8b949e;
      font-size: 0.75rem;
    }
    .project-overview-card__meta {
      color: #8b949e;
      font-size: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .project-overview-card__pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .project-overview-pill {
      display: inline-block;
      padding: 0.2rem 0.625rem;
      border-radius: 12px;
      font-size: 0.75rem;
      text-decoration: none;
      background: #0d1117;
      border: 1px solid #21262d;
      font-family: ui-monospace, monospace;
    }
    .project-overview-pill--more {
      color: #484f58;
      background: transparent;
      border: none;
    }

    .project-structure-card {
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      border: 1px solid #30363d;
    }
    .project-structure__pills {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.75rem;
    }
    .project-structure__pill-label {
      font-size: 0.625rem;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    .project-structure__pill-value {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #c9d1d9;
      font-size: 0.9375rem;
      font-weight: 600;
    }
    .project-structure__pill-num {
      font-size: 1.25rem;
    }
    .project-structure__swatch {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .project-structure__warning {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-top: 0.625rem;
      font-size: 0.8125rem;
    }
    .project-structure__warning span:first-child {
      font-size: 1.25rem;
    }
    .project-structure__warning strong {
      display: block;
      color: #c9d1d9;
      margin-bottom: 0.15rem;
    }
    .project-structure__warning div:last-child > div:last-child {
      color: #8b949e;
    }
    .project-structure__warning--hub {
      background: rgba(210, 154, 40, 0.1);
      border: 1px solid rgba(210, 154, 40, 0.35);
    }
    .project-structure__warning--bridge {
      background: rgba(248, 81, 73, 0.1);
      border: 1px solid rgba(248, 81, 73, 0.35);
    }
    .project-structure__warning--orphan {
      background: rgba(139, 148, 158, 0.1);
      border: 1px solid rgba(139, 148, 158, 0.3);
    }
    .project-structure__warning--leaf {
      background: rgba(63, 185, 80, 0.08);
      border: 1px solid rgba(63, 185, 80, 0.3);
    }

    .project-role-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.625rem;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .project-role-badge--hub { background: rgba(210, 154, 40, 0.15); color: #d29a28; }
    .project-role-badge--bridge { background: rgba(248, 81, 73, 0.15); color: #f85149; }
    .project-role-badge--leaf { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
    .project-role-badge--orphan { background: rgba(139, 148, 158, 0.15); color: #8b949e; }
    .project-role-badge--member { background: rgba(88, 166, 255, 0.1); color: #58a6ff; }

    .project-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 1.125rem 1.375rem;
    }
    .project-card__title {
      font-size: 0.875rem;
      font-weight: 700;
      color: #c9d1d9;
      margin-bottom: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .project-card__title-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      gap: 1rem;
    }
    .project-card__feature-name {
      font-size: 1.5rem;
      font-weight: 700;
      color: #c9d1d9;
      font-family: ui-monospace, monospace;
    }
    .project-card__meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .project-card__version {
      color: #8b949e;
      font-size: 0.75rem;
      font-family: ui-monospace, monospace;
    }
    .project-card__description {
      color: #c9d1d9;
      font-size: 0.9375rem;
      margin-bottom: 0.5rem;
    }
    .project-card__owner {
      color: #8b949e;
      font-size: 0.8125rem;
    }
    .project-card__subsection {
      margin-bottom: 0.875rem;
    }
    .project-card__subsection:last-child {
      margin-bottom: 0;
    }
    .project-card__subtitle {
      font-size: 0.6875rem;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .project-card__empty {
      color: #484f58;
      font-size: 0.8125rem;
      font-style: italic;
    }

    .project-dep {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0;
      font-size: 0.8125rem;
      color: #c9d1d9;
      flex-wrap: wrap;
    }
    .project-dep__arrow {
      color: #484f58;
    }
    .project-dep__pkg-icon {
      color: #8b949e;
    }
    .project-dep__name {
      font-family: ui-monospace, monospace;
      color: #58a6ff;
      text-decoration: none;
      font-weight: 600;
    }
    .project-dep__name:hover {
      text-decoration: underline;
    }
    .project-dep__version {
      background: #0d1117;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #8b949e;
    }
    .project-dep__reason {
      color: #8b949e;
      font-size: 0.75rem;
      font-style: italic;
    }

    .project-export {
      padding: 0.5rem 0;
      border-bottom: 1px solid #21262d;
    }
    .project-export:last-child {
      border-bottom: none;
    }
    .project-export__sig {
      display: block;
      font-size: 0.8125rem;
      color: #c9d1d9;
      background: #0d1117;
      padding: 0.4rem 0.625rem;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .project-export__row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.375rem;
    }
    .project-export__tag {
      color: #3fb950;
      font-size: 0.6875rem;
    }
    .project-export__desc {
      color: #8b949e;
      font-size: 0.75rem;
    }
    .project-export__type-name {
      background: #0d1117;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      color: #58a6ff;
      font-size: 0.8125rem;
      margin-right: 0.5rem;
    }

    .project-rule {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0;
      font-size: 0.8125rem;
      flex-wrap: wrap;
    }
    .project-rule__id {
      background: #0d1117;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      color: #58a6ff;
      font-size: 0.75rem;
    }
    .project-rule__desc {
      color: #8b949e;
      flex: 1;
    }

    .project-file {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.375rem 0;
      font-size: 0.8125rem;
      flex-wrap: wrap;
    }
    .project-file__path {
      background: #0d1117;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      color: #58a6ff;
      font-size: 0.75rem;
    }
    .project-file__purpose {
      color: #8b949e;
      font-size: 0.75rem;
      flex: 1;
    }

    .project-endpoint {
      padding: 0.625rem 0;
      border-bottom: 1px solid #21262d;
    }
    .project-endpoint:last-child {
      border-bottom: none;
    }
    .project-endpoint__tool {
      background: #0d1117;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      color: #d29a28;
      font-size: 0.8125rem;
      font-weight: 600;
    }
    .project-endpoint__desc {
      color: #c9d1d9;
      font-size: 0.8125rem;
      margin-left: 0.5rem;
    }
    .project-endpoint__io {
      margin-top: 0.5rem;
      padding-left: 1rem;
      font-size: 0.75rem;
      color: #8b949e;
    }
    .project-endpoint__io > div {
      margin-bottom: 0.25rem;
    }
    .project-endpoint__io-label {
      display: inline-block;
      min-width: 48px;
      color: #484f58;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
      font-size: 0.6875rem;
    }
    .project-endpoint__io code {
      background: #0d1117;
      padding: 0.1rem 0.35rem;
      border-radius: 3px;
      color: #c9d1d9;
    }

    .project-badge {
      display: inline-block;
      padding: 0.15rem 0.55rem;
      border-radius: 10px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .project-badge--draft { background: rgba(31, 111, 235, 0.15); color: #58a6ff; border: 1px solid rgba(31, 111, 235, 0.3); }
    .project-badge--active { background: rgba(63, 185, 80, 0.15); color: #3fb950; border: 1px solid rgba(63, 185, 80, 0.3); }
    .project-badge--deprecated { background: rgba(248, 81, 73, 0.15); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3); }
    .project-badge--error { background: rgba(248, 81, 73, 0.15); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3); }
    .project-badge--warning { background: rgba(210, 154, 40, 0.15); color: #d29a28; border: 1px solid rgba(210, 154, 40, 0.3); }
    .project-badge--info { background: rgba(88, 166, 255, 0.1); color: #58a6ff; border: 1px solid rgba(88, 166, 255, 0.3); }

    @media (max-width: 900px) {
      .project-layout {
        flex-direction: column;
      }
      .project-sidebar {
        width: 100%;
        position: static;
        max-height: 280px;
      }
    }
  </style>`;
}

function renderScript(): string {
  return `<script>
    (function() {
      var input = document.getElementById('project-search');
      if (!input) return;
      var items = document.querySelectorAll('.project-sidebar__item');
      var groups = document.querySelectorAll('.project-sidebar__group');
      input.addEventListener('input', function() {
        var q = input.value.trim().toLowerCase();
        items.forEach(function(el) {
          var name = (el.getAttribute('data-feature') || '').toLowerCase();
          if (!q || name.indexOf(q) !== -1) {
            el.style.display = '';
          } else {
            el.style.display = 'none';
          }
        });
        // Auto-open groups that have visible items
        if (q) {
          groups.forEach(function(g) {
            var anyVisible = Array.from(g.querySelectorAll('.project-sidebar__item')).some(function(el) {
              return el.style.display !== 'none';
            });
            g.open = anyVisible;
          });
        }
      });
    })();
  </script>`;
}

export function renderProject(
  contracts: Contract[],
  selectedFeature?: string,
  structure?: CommunityReport
): string {
  // If no structure provided, fall back to an empty stub so the view still renders.
  const safeStructure: CommunityReport = structure ?? {
    communities: [],
    classifications: [],
    orphans: [],
    bridges: [],
    hubs: [],
    modularity: 0,
  };

  const classByFeature = new Map(
    safeStructure.classifications.map((c) => [c.feature, c])
  );

  const selected = selectedFeature
    ? contracts.find((c) => c.contract.feature === selectedFeature)
    : undefined;

  const content = selected
    ? renderFeatureDetail(selected, classByFeature)
    : renderArchitectureOverview(contracts, classByFeature, safeStructure);

  return `${renderStyles()}
<div class="project-layout">
  ${renderSidebar(contracts, classByFeature, safeStructure, selectedFeature)}
  <div class="project-content">
    ${content}
  </div>
</div>
${renderScript()}`;
}

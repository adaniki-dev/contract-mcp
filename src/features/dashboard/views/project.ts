import type { Contract } from "@shared/types/contract.types";

function escapeHtml(str: string | undefined | null): string {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadge(status: string): string {
  return `<span class="project-badge project-badge--${status}">${status}</span>`;
}

function severityBadge(severity: string): string {
  return `<span class="project-badge project-badge--${severity}">${severity}</span>`;
}

function renderSidebar(contracts: Contract[], selectedFeature?: string): string {
  const items = contracts
    .map((c) => {
      const slug = c.contract.feature;
      const isActive = selectedFeature === slug;
      const activeClass = isActive ? " project-sidebar__item--active" : "";
      return `<a href="/project?feature=${encodeURIComponent(slug)}" class="project-sidebar__item${activeClass}" title="${escapeHtml(c.contract.description)}">
        <svg class="project-sidebar__icon" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M3.75 1.5a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V6H9.75A1.75 1.75 0 0 1 8 4.25V1.5H3.75Zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06ZM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v9.086A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25V1.75Z"/></svg>
        <span class="project-sidebar__label">${escapeHtml(slug)}</span>
      </a>`;
    })
    .join("\n");

  return `<aside class="project-sidebar">
    <div class="project-sidebar__header">
      <svg class="project-sidebar__icon" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/></svg>
      <span>contracts/</span>
    </div>
    <nav class="project-sidebar__nav">
      ${items}
    </nav>
  </aside>`;
}

function renderOverviewGrid(contracts: Contract[]): string {
  const cards = contracts
    .map((c) => {
      const slug = c.contract.feature;
      const depCount = c.dependencies.internal.length + c.dependencies.external.length;
      const ruleCount = c.rules.length;
      return `<a href="/project?feature=${encodeURIComponent(slug)}" class="project-overview-card">
        <div class="project-overview-card__header">
          <span class="project-overview-card__name">${escapeHtml(slug)}</span>
          ${statusBadge(c.contract.status)}
        </div>
        <p class="project-overview-card__desc">${escapeHtml(c.contract.description)}</p>
        <div class="project-overview-card__stats">
          <span class="project-overview-card__stat">${depCount} deps</span>
          <span class="project-overview-card__stat">${ruleCount} rules</span>
          <span class="project-overview-card__stat">${c.exports.functions.length} fn</span>
        </div>
      </a>`;
    })
    .join("\n");

  return `<div class="project-overview-grid">${cards}</div>`;
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
  const internalItems = c.dependencies.internal.length > 0
    ? c.dependencies.internal
        .map(
          (d) =>
            `<div class="project-dep">
              <span class="project-dep__arrow">&rarr;</span>
              <span class="project-dep__name">${escapeHtml(d.feature)}</span>
              <span class="project-dep__reason">${escapeHtml(d.reason)}</span>
            </div>`
        )
        .join("\n")
    : `<p class="project-card__empty">No internal dependencies</p>`;

  const externalItems = c.dependencies.external.length > 0
    ? c.dependencies.external
        .map(
          (d) =>
            `<div class="project-dep">
              <svg class="project-dep__pkg-icon" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8.878.392a1.75 1.75 0 0 0-1.756 0l-5.25 3.045A1.75 1.75 0 0 0 1 4.951v6.098c0 .624.332 1.2.872 1.514l5.25 3.045a1.75 1.75 0 0 0 1.756 0l5.25-3.045c.54-.313.872-.89.872-1.514V4.951c0-.624-.332-1.2-.872-1.514L8.878.392ZM7.875 1.69a.25.25 0 0 1 .25 0l4.63 2.685L8 7.133 3.245 4.375l4.63-2.685ZM2.5 5.677v5.372c0 .09.047.171.125.216l4.625 2.683V8.432L2.5 5.677Zm6.25 8.271 4.625-2.683a.25.25 0 0 0 .125-.216V5.677L8.75 8.432v5.516Z"/></svg>
              <span class="project-dep__name">${escapeHtml(d.package)}</span>
              <code class="project-dep__version">${escapeHtml(d.version)}</code>
              <span class="project-dep__reason">${escapeHtml(d.reason)}</span>
            </div>`
        )
        .join("\n")
    : `<p class="project-card__empty">No external dependencies</p>`;

  return `<section class="project-card">
    <h3 class="project-card__heading">Dependencies</h3>
    <div class="project-card__section">
      <h4 class="project-card__subheading">Internal</h4>
      ${internalItems}
    </div>
    <div class="project-card__section">
      <h4 class="project-card__subheading">External</h4>
      ${externalItems}
    </div>
  </section>`;
}

function renderExportsCard(c: Contract): string {
  const functions = c.exports.functions.length > 0
    ? c.exports.functions
        .map(
          (f) =>
            `<div class="project-export">
              <code class="project-export__sig">${escapeHtml(f.name)}${escapeHtml(f.signature)}</code>
              <div class="project-export__details">
                ${f.pure ? '<span class="project-export__pure">pure</span>' : ""}
                <span class="project-export__desc">${escapeHtml(f.description)}</span>
              </div>
            </div>`
        )
        .join("\n")
    : `<p class="project-card__empty">No exported functions</p>`;

  const types = c.exports.types.length > 0
    ? c.exports.types
        .map(
          (t) =>
            `<div class="project-export">
              <code class="project-export__type-name">${escapeHtml(t.name)}</code>
              <span class="project-export__desc">${escapeHtml(t.description)}</span>
            </div>`
        )
        .join("\n")
    : `<p class="project-card__empty">No exported types</p>`;

  return `<section class="project-card">
    <h3 class="project-card__heading">Exports</h3>
    <div class="project-card__section">
      <h4 class="project-card__subheading">Functions</h4>
      ${functions}
    </div>
    <div class="project-card__section">
      <h4 class="project-card__subheading">Types</h4>
      ${types}
    </div>
  </section>`;
}

function renderRulesCard(c: Contract): string {
  if (c.rules.length === 0) {
    return `<section class="project-card">
      <h3 class="project-card__heading">Rules</h3>
      <p class="project-card__empty">No rules defined</p>
    </section>`;
  }

  const items = c.rules
    .map(
      (r) =>
        `<div class="project-rule">
          ${severityBadge(r.severity)}
          <code class="project-rule__id">${escapeHtml(r.id)}</code>
          <span class="project-rule__desc">${escapeHtml(r.description)}</span>
        </div>`
    )
    .join("\n");

  return `<section class="project-card">
    <h3 class="project-card__heading">Rules</h3>
    ${items}
  </section>`;
}

function renderFilesCard(c: Contract): string {
  if (c.files.length === 0) {
    return `<section class="project-card">
      <h3 class="project-card__heading">Files</h3>
      <p class="project-card__empty">No files listed</p>
    </section>`;
  }

  const items = c.files
    .map(
      (f) =>
        `<div class="project-file">
          <code class="project-file__path">${escapeHtml(f.path)}</code>
          <span class="project-file__purpose">${escapeHtml(f.purpose)}</span>
        </div>`
    )
    .join("\n");

  return `<section class="project-card">
    <h3 class="project-card__heading">Files</h3>
    ${items}
  </section>`;
}

function renderEndpointsCard(c: Contract): string {
  if (!c.endpoints || c.endpoints.length === 0) return "";

  const items = c.endpoints
    .map(
      (e) =>
        `<div class="project-endpoint">
          <div class="project-endpoint__header">
            <code class="project-endpoint__tool">${escapeHtml(e.tool)}</code>
            <span class="project-endpoint__desc">${escapeHtml(e.description)}</span>
          </div>
          <div class="project-endpoint__io">
            <div class="project-endpoint__param">
              <span class="project-endpoint__label">Input:</span>
              <code>${escapeHtml(e.input)}</code>
            </div>
            <div class="project-endpoint__param">
              <span class="project-endpoint__label">Output:</span>
              <code>${escapeHtml(e.output)}</code>
            </div>
            ${
              e.errors.length > 0
                ? `<div class="project-endpoint__param">
                    <span class="project-endpoint__label">Errors:</span>
                    <span>${e.errors.map((err) => `<code>${escapeHtml(err)}</code>`).join(", ")}</span>
                  </div>`
                : ""
            }
          </div>
        </div>`
    )
    .join("\n");

  return `<section class="project-card">
    <h3 class="project-card__heading">MCP Endpoints</h3>
    ${items}
  </section>`;
}

function renderFeatureDetail(c: Contract): string {
  return `<div class="project-detail">
    ${renderHeaderCard(c)}
    ${renderDependenciesCard(c)}
    ${renderExportsCard(c)}
    ${renderRulesCard(c)}
    ${renderFilesCard(c)}
    ${renderEndpointsCard(c)}
  </div>`;
}

function renderStyles(): string {
  return `<style>
  /* Layout */
  .project-layout {
    display: flex;
    gap: 0;
    min-height: calc(100vh - 4rem);
  }

  /* Sidebar */
  .project-sidebar {
    width: 250px;
    min-width: 250px;
    background: #161b22;
    border-right: 1px solid #30363d;
    border-radius: 8px 0 0 8px;
    overflow-y: auto;
  }

  .project-sidebar__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #c9d1d9;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #30363d;
  }

  .project-sidebar__header .project-sidebar__icon {
    color: #58a6ff;
    flex-shrink: 0;
  }

  .project-sidebar__nav {
    display: flex;
    flex-direction: column;
    padding: 6px 0;
  }

  .project-sidebar__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    color: #8b949e;
    text-decoration: none;
    font-size: 0.85rem;
    transition: background 200ms, color 200ms;
    cursor: pointer;
  }

  .project-sidebar__item:hover {
    background: #1c2128;
    color: #c9d1d9;
  }

  .project-sidebar__item--active {
    background: #1f6feb1a;
    color: #58a6ff;
    border-left: 2px solid #58a6ff;
  }

  .project-sidebar__item--active .project-sidebar__icon {
    color: #58a6ff;
  }

  .project-sidebar__icon {
    flex-shrink: 0;
    color: #484f58;
    transition: color 200ms;
  }

  .project-sidebar__label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Content area */
  .project-content {
    flex: 1;
    min-width: 0;
    padding: 24px 32px;
  }

  /* Overview grid */
  .project-overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .project-overview-card {
    display: block;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 18px 20px;
    text-decoration: none;
    color: inherit;
    transition: border-color 200ms, box-shadow 200ms;
    cursor: pointer;
  }

  .project-overview-card:hover {
    border-color: #58a6ff;
    box-shadow: 0 0 0 1px #58a6ff33;
  }

  .project-overview-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .project-overview-card__name {
    font-weight: 600;
    font-size: 0.95rem;
    color: #c9d1d9;
  }

  .project-overview-card__desc {
    color: #8b949e;
    font-size: 0.82rem;
    line-height: 1.45;
    margin-bottom: 12px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .project-overview-card__stats {
    display: flex;
    gap: 12px;
  }

  .project-overview-card__stat {
    font-size: 0.75rem;
    color: #484f58;
    font-weight: 500;
  }

  /* Detail cards */
  .project-detail {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .project-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px 24px;
  }

  .project-card__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 8px;
  }

  .project-card__feature-name {
    font-size: 1.3rem;
    font-weight: 700;
    color: #c9d1d9;
  }

  .project-card__meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .project-card__version {
    font-size: 0.8rem;
    color: #8b949e;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  }

  .project-card__description {
    color: #8b949e;
    font-size: 0.9rem;
    line-height: 1.5;
    margin-bottom: 6px;
  }

  .project-card__owner {
    color: #484f58;
    font-size: 0.82rem;
  }

  .project-card__owner strong {
    color: #8b949e;
  }

  .project-card__heading {
    font-size: 0.95rem;
    font-weight: 600;
    color: #c9d1d9;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #21262d;
  }

  .project-card__subheading {
    font-size: 0.78rem;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 10px;
  }

  .project-card__section {
    margin-bottom: 18px;
  }

  .project-card__section:last-child {
    margin-bottom: 0;
  }

  .project-card__empty {
    color: #484f58;
    font-size: 0.82rem;
    font-style: italic;
  }

  /* Badges */
  .project-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .project-badge--draft {
    background: #1f6feb22;
    color: #58a6ff;
    border: 1px solid #1f6feb44;
  }

  .project-badge--active {
    background: #3fb95022;
    color: #3fb950;
    border: 1px solid #3fb95044;
  }

  .project-badge--deprecated {
    background: #f8514922;
    color: #f85149;
    border: 1px solid #f8514944;
  }

  .project-badge--error {
    background: #f8514922;
    color: #f85149;
    border: 1px solid #f8514944;
  }

  .project-badge--warning {
    background: #d29a2822;
    color: #d29a28;
    border: 1px solid #d29a2844;
  }

  .project-badge--info {
    background: #1f6feb22;
    color: #58a6ff;
    border: 1px solid #1f6feb44;
  }

  /* Dependencies */
  .project-dep {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 0;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .project-dep__arrow {
    color: #3fb950;
    font-weight: 600;
    flex-shrink: 0;
  }

  .project-dep__pkg-icon {
    color: #d29a28;
    flex-shrink: 0;
    position: relative;
    top: 1px;
  }

  .project-dep__name {
    color: #c9d1d9;
    font-weight: 600;
    flex-shrink: 0;
  }

  .project-dep__version {
    font-size: 0.78rem;
    color: #8b949e;
    background: #0d1117;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    flex-shrink: 0;
  }

  .project-dep__reason {
    color: #8b949e;
    font-size: 0.82rem;
  }

  /* Exports */
  .project-export {
    padding: 8px 0;
    border-bottom: 1px solid #21262d;
  }

  .project-export:last-child {
    border-bottom: none;
  }

  .project-export__sig {
    display: block;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 0.82rem;
    color: #c9d1d9;
    background: #0d1117;
    padding: 6px 10px;
    border-radius: 4px;
    margin-bottom: 4px;
    overflow-x: auto;
  }

  .project-export__type-name {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 0.85rem;
    color: #58a6ff;
    font-weight: 600;
  }

  .project-export__details {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 2px;
  }

  .project-export__pure {
    font-size: 0.72rem;
    font-weight: 600;
    color: #3fb950;
    background: #3fb95015;
    border: 1px solid #3fb95033;
    padding: 1px 6px;
    border-radius: 4px;
  }

  .project-export__desc {
    color: #8b949e;
    font-size: 0.82rem;
  }

  /* Rules */
  .project-rule {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px solid #21262d;
  }

  .project-rule:last-child {
    border-bottom: none;
  }

  .project-rule__id {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 0.82rem;
    color: #c9d1d9;
    font-weight: 600;
    flex-shrink: 0;
  }

  .project-rule__desc {
    color: #8b949e;
    font-size: 0.82rem;
  }

  /* Files */
  .project-file {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid #21262d;
  }

  .project-file:last-child {
    border-bottom: none;
  }

  .project-file__path {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 0.8rem;
    color: #58a6ff;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .project-file__purpose {
    color: #8b949e;
    font-size: 0.82rem;
  }

  /* Endpoints */
  .project-endpoint {
    padding: 12px 0;
    border-bottom: 1px solid #21262d;
  }

  .project-endpoint:last-child {
    border-bottom: none;
  }

  .project-endpoint__header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .project-endpoint__tool {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 0.85rem;
    color: #c9d1d9;
    font-weight: 600;
    background: #0d1117;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .project-endpoint__desc {
    color: #8b949e;
    font-size: 0.82rem;
  }

  .project-endpoint__io {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 4px;
  }

  .project-endpoint__param {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
  }

  .project-endpoint__label {
    color: #484f58;
    font-weight: 600;
    flex-shrink: 0;
  }

  .project-endpoint__param code {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 0.78rem;
    color: #8b949e;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .project-layout {
      flex-direction: column;
    }

    .project-sidebar {
      width: 100%;
      min-width: 100%;
      border-right: none;
      border-bottom: 1px solid #30363d;
      border-radius: 8px 8px 0 0;
    }

    .project-sidebar__nav {
      flex-direction: row;
      overflow-x: auto;
      padding: 4px 8px;
    }

    .project-sidebar__item {
      white-space: nowrap;
      padding: 6px 12px;
    }

    .project-sidebar__item--active {
      border-left: none;
      border-bottom: 2px solid #58a6ff;
    }

    .project-content {
      padding: 16px;
    }

    .project-overview-grid {
      grid-template-columns: 1fr;
    }

    .project-dep {
      flex-wrap: wrap;
    }

    .project-file {
      flex-direction: column;
      gap: 2px;
    }

    .project-rule {
      flex-wrap: wrap;
    }
  }
</style>`;
}

export function renderProject(
  contracts: Contract[],
  selectedFeature?: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _structure?: import("@shared/types/contract.types").CommunityReport
): string {
  const selected = selectedFeature
    ? contracts.find((c) => c.contract.feature === selectedFeature)
    : undefined;

  const content = selected
    ? renderFeatureDetail(selected)
    : renderOverviewGrid(contracts);

  return `${renderStyles()}
<div class="project-layout">
  ${renderSidebar(contracts, selectedFeature)}
  <div class="project-content">
    ${content}
  </div>
</div>`;
}

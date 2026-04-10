export function renderLayout(activeTab: string, content: string): string {
  const tabs = [
    { href: "/", id: "summary", label: "Summary" },
    { href: "/project", id: "project", label: "Project" },
    { href: "/graph", id: "graph", label: "Brain Link" },
  ];

  const tabsHtml = tabs
    .map(
      (t) =>
        `<a href="${t.href}" class="tab${activeTab === t.id ? " active" : ""}">${t.label}</a>`
    )
    .join("\n        ");

  const timestamp = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>contract-mcp Dashboard</title>
  <style>
    /* Reset */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
      background: #0d1117;
      color: #c9d1d9;
      min-height: 100vh;
    }

    /* Topbar */
    .topbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      height: 56px;
      padding: 0 1.5rem;
      background: #161b22;
      border-bottom: 1px solid #30363d;
    }

    .logo {
      font-size: 1rem;
      font-weight: 700;
      color: #58a6ff;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }

    .tabs {
      display: flex;
      gap: 0.375rem;
      margin-left: auto;
      margin-right: auto;
    }

    .tab {
      display: inline-flex;
      align-items: center;
      padding: 0.375rem 0.875rem;
      border-radius: 6px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #8b949e;
      text-decoration: none;
      cursor: pointer;
      transition: color 200ms, background 200ms;
    }

    .tab:hover {
      color: #c9d1d9;
      background: #21262d;
    }

    .tab.active {
      color: #ffffff;
      background: #1f6feb;
    }

    /* Main */
    main {
      padding: 72px 1.5rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 1.5rem 1rem;
      color: #484f58;
      font-size: 0.75rem;
    }

    /* Card */
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 1rem 1.25rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      padding-bottom: 0.625rem;
      border-bottom: 1px solid #21262d;
    }

    .card-header h2 {
      font-size: 0.875rem;
      font-weight: 600;
      color: #c9d1d9;
    }

    /* Badge */
    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.5;
    }

    .badge.draft {
      background: #1f6feb22;
      color: #58a6ff;
      border: 1px solid #1f6feb44;
    }

    .badge.active {
      background: #3fb95022;
      color: #3fb950;
      border: 1px solid #3fb95044;
    }

    .badge.deprecated {
      background: #f8514922;
      color: #f85149;
      border: 1px solid #f8514944;
    }

    .badge.error {
      background: #f8514922;
      color: #f85149;
      border: 1px solid #f8514944;
    }

    .badge.warning {
      background: #d29a2822;
      color: #d29a28;
      border: 1px solid #d29a2844;
    }

    .badge.info {
      background: #1f6feb22;
      color: #58a6ff;
      border: 1px solid #1f6feb44;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      padding: 0.625rem 1rem;
      text-align: left;
      font-weight: 600;
      color: #8b949e;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: #21262d;
    }

    td {
      padding: 0.5rem 1rem;
      border-top: 1px solid #21262d;
      font-size: 0.8125rem;
    }

    /* Links */
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Utility */
    .text-muted { color: #8b949e; }
    .text-green { color: #3fb950; }
    .text-red { color: #f85149; }
    .text-blue { color: #58a6ff; }
    .text-yellow { color: #d29a28; }
    .fw-bold { font-weight: 700; }
    .text-center { text-align: center; }

    /* Responsive */
    @media (max-width: 768px) {
      main { padding: 64px 1rem 1.5rem; }
      .topbar { padding: 0 1rem; }
      .tabs { gap: 0.25rem; }
      .tab { padding: 0.3rem 0.625rem; font-size: 0.75rem; }
    }

    @media (max-width: 480px) {
      .logo { font-size: 0.875rem; }
      .tab { padding: 0.25rem 0.5rem; font-size: 0.6875rem; }
    }
  </style>
</head>
<body>
  <nav class="topbar">
    <div class="logo">contract-mcp</div>
    <div class="tabs">
      ${tabsHtml}
    </div>
  </nav>
  <main>
    ${content}
  </main>
  <div class="footer">
    Updated: ${timestamp} &mdash; contract-mcp · MCP Contract Linter
  </div>
</body>
</html>`;
}

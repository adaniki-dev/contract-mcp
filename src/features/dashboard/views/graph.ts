export interface GraphNode {
  id: string;
  status: string;
  deps: number;
  rules: number;
  exports: number;
  description: string;
  community?: string;
  role?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  reason: string;
}

export function renderGraph(nodes: GraphNode[], edges: GraphEdge[]): string {
  const graphData = JSON.stringify({ nodes, edges });

  return `
<style>
  .graph-container {
    position: fixed;
    top: 56px;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: calc(100vh - 56px);
    padding: 0;
    margin: 0;
    overflow: hidden;
    background: #0d1117;
    z-index: 1;
  }

  .graph-container canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
    touch-action: none;
  }

  .graph-container canvas.dragging {
    cursor: grabbing;
  }

  .graph-hint {
    position: absolute;
    bottom: 12px;
    left: 12px;
    color: #484f58;
    font-size: 0.75rem;
    pointer-events: none;
    font-family: ui-monospace, monospace;
  }

  .graph-tooltip {
    position: absolute;
    pointer-events: none;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: #c9d1d9;
    max-width: 280px;
    opacity: 0;
    transition: opacity 150ms;
    z-index: 10;
  }

  .graph-tooltip.visible {
    opacity: 1;
  }

  .graph-tooltip .tt-name {
    font-weight: 700;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    color: #ffffff;
  }

  .graph-tooltip .tt-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .graph-tooltip .tt-label {
    color: #8b949e;
  }

  .graph-tooltip .tt-val {
    font-weight: 600;
  }

  .graph-tooltip .tt-desc {
    margin-top: 0.375rem;
    padding-top: 0.375rem;
    border-top: 1px solid #30363d;
    color: #8b949e;
    font-size: 0.75rem;
  }

  .graph-tooltip .tt-edge-reason {
    color: #8b949e;
    font-style: italic;
  }

  .graph-hud {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(22, 27, 34, 0.92);
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 0.5rem 0.75rem;
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    color: #c9d1d9;
    backdrop-filter: blur(4px);
    z-index: 5;
  }

  .graph-hud__stat {
    color: #8b949e;
    padding: 0 0.375rem;
  }
  .graph-hud__stat strong { color: #c9d1d9; }

  .graph-hud__sep {
    width: 1px;
    height: 16px;
    background: #30363d;
  }

  .graph-hud__btn {
    background: #0d1117;
    border: 1px solid #30363d;
    color: #c9d1d9;
    border-radius: 6px;
    padding: 0.3rem 0.625rem;
    font-size: 0.6875rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 150ms;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .graph-hud__btn:hover {
    background: #1c2128;
    border-color: #58a6ff;
    color: #58a6ff;
  }
  .graph-hud__btn.active {
    background: #58a6ff22;
    border-color: #58a6ff;
    color: #58a6ff;
  }

  .graph-hud__select {
    background: #0d1117;
    border: 1px solid #30363d;
    color: #c9d1d9;
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
    font-size: 0.6875rem;
    font-family: inherit;
    cursor: pointer;
    outline: none;
  }

  .graph-search {
    position: absolute;
    top: 12px;
    right: 260px;
    z-index: 5;
  }
  .graph-search input {
    background: rgba(22, 27, 34, 0.92);
    border: 1px solid #30363d;
    color: #c9d1d9;
    border-radius: 8px;
    padding: 0.45rem 0.75rem;
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
    width: 180px;
    outline: none;
    backdrop-filter: blur(4px);
  }
  .graph-search input:focus {
    border-color: #58a6ff;
  }

  .graph-minimap {
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: 180px;
    height: 130px;
    background: rgba(13, 17, 23, 0.85);
    border: 1px solid #30363d;
    border-radius: 8px;
    overflow: hidden;
    backdrop-filter: blur(4px);
    z-index: 5;
    pointer-events: none;
  }
  .graph-minimap canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .graph-legend {
    position: absolute;
    top: 64px;
    right: 12px;
    background: rgba(22, 27, 34, 0.92);
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 0.75rem 0.875rem;
    font-size: 0.75rem;
    color: #c9d1d9;
    font-family: ui-monospace, monospace;
    max-width: 300px;
    backdrop-filter: blur(4px);
    z-index: 4;
  }

  .graph-legend .legend-title {
    font-weight: 700;
    margin-bottom: 0.375rem;
    color: #8b949e;
    text-transform: uppercase;
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
  }

  .graph-legend__section {
    margin-bottom: 0.875rem;
  }
  .graph-legend__section:last-child {
    margin-bottom: 0;
  }
  .graph-legend__section-title {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #8b949e;
    font-weight: 700;
    margin-bottom: 0.625rem;
  }

  .graph-legend__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    justify-content: flex-start;
  }

  .graph-legend .legend-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    cursor: pointer;
    background: transparent;
    border: none;
    padding: 0;
    min-width: 64px;
    max-width: 84px;
    transition: transform 150ms;
  }
  .graph-legend .legend-item:hover {
    transform: translateY(-1px);
  }
  .graph-legend .legend-item:hover .legend-swatch {
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.15),
      0 0 12px 2px rgba(88, 166, 255, 0.25),
      inset 0 1px 3px rgba(255, 255, 255, 0.35),
      inset 0 -2px 4px rgba(0, 0, 0, 0.35);
  }
  .graph-legend .legend-item.dim {
    opacity: 0.3;
  }
  .graph-legend .legend-item.dim .legend-swatch {
    filter: saturate(0.3);
  }

  .graph-legend .legend-swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow:
      inset 0 1px 3px rgba(255, 255, 255, 0.35),
      inset 0 -2px 4px rgba(0, 0, 0, 0.35),
      0 2px 6px rgba(0, 0, 0, 0.4);
    transition: box-shadow 180ms, filter 180ms;
  }

  .graph-legend .legend-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.6875rem;
    max-width: 82px;
    text-align: center;
    color: #c9d1d9;
    font-weight: 600;
  }

  .graph-legend .legend-count {
    color: #8b949e;
    font-size: 0.625rem;
    margin-top: -0.125rem;
  }

  @media (max-width: 768px) {
    .graph-container {
      height: calc(100vh - 56px);
      margin: -64px -1rem -1.5rem;
    }
    .graph-legend {
      top: 8px;
      right: 8px;
      font-size: 0.6875rem;
      max-width: 180px;
    }
  }
</style>

<div class="graph-container">
  <canvas id="graph-canvas"></canvas>

  <div class="graph-hud" id="graph-hud">
    <span class="graph-hud__stat"><strong id="hud-nodes">0</strong> features</span>
    <span class="graph-hud__stat"><strong id="hud-communities">0</strong> communities</span>
    <span class="graph-hud__stat">mod <strong id="hud-mod">0</strong></span>
    <span class="graph-hud__sep"></span>
    <button class="graph-hud__btn" id="btn-show-orphans">hide orphans</button>
    <button class="graph-hud__btn" id="btn-hubs-only">hubs only</button>
    <select class="graph-hud__select" id="community-select">
      <option value="">all communities</option>
    </select>
    <span class="graph-hud__sep"></span>
    <button class="graph-hud__btn" id="btn-reset">reset view</button>
    <button class="graph-hud__btn" id="btn-relayout">re-layout</button>
  </div>

  <div class="graph-search">
    <input type="text" id="graph-search-input" placeholder="Search feature..." />
  </div>

  <div class="graph-tooltip" id="graph-tooltip"></div>
  <div class="graph-legend" id="graph-legend"></div>

  <div class="graph-minimap">
    <canvas id="minimap-canvas"></canvas>
  </div>

  <div class="graph-hint">drag nodes · wheel to zoom · shift+drag to pan · click node to open</div>
</div>

<script>
(function () {
  const raw = ${graphData};
  const STATUS_COLORS = {
    draft: "#1f6feb",
    active: "#3fb950",
    deprecated: "#f85149"
  };
  const ROLE_COLORS = {
    hub: "#f59f00",
    bridge: "#e03131",
    leaf: "#37b24d",
    orphan: "#868e96",
    member: "#5c7cfa"
  };
  const EDGE_COLOR = "#30363d";
  const EDGE_HIGHLIGHT = "#58a6ff";
  const DIM_ALPHA = 0.15;
  const NODE_TEXT = "#ffffff";
  const DAMPING = 0.85;
  const CENTER_GRAVITY = 0.005;
  const SETTLE_FRAME = 600;
  const SETTLE_THRESHOLD = 0.3;
  const COLLISION_PADDING = 20;

  // Scale physics with node count so many contracts still spread apart
  const nodeCount = raw.nodes.length || 1;
  const REPULSION = Math.max(8000, 4000 + nodeCount * 800);
  const SPRING_K = 0.008;
  const REST_LENGTH = Math.max(200, 160 + nodeCount * 8);

  const canvas = document.getElementById("graph-canvas");
  const tooltip = document.getElementById("graph-tooltip");
  const legendEl = document.getElementById("graph-legend");
  const ctx = canvas.getContext("2d");

  function communityColor(label) {
    if (!label) return "#30363d";
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return "hsl(" + hue + ", 55%, 42%)";
  }

  function lightenColor(label) {
    if (!label) return "#484f58";
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return "hsl(" + hue + ", 60%, 65%)";
  }

  const simNodes = raw.nodes.map(function (n) {
    // Radius scales with feature complexity, clamped for readability
    const weight = (n.deps || 0) + (n.rules || 0) + (n.exports || 0);
    const r = Math.min(58, Math.max(34, 30 + weight * 1.2));
    return {
      id: n.id,
      status: n.status,
      deps: n.deps,
      rules: n.rules,
      exports: n.exports,
      description: n.description,
      community: n.community || n.id,
      role: n.role || "member",
      x: 0, y: 0, vx: 0, vy: 0,
      r: r,
      pinned: false
    };
  });

  const nodeMap = {};
  simNodes.forEach(function (n) { nodeMap[n.id] = n; });

  const simEdges = raw.edges.map(function (e) {
    return { from: e.from, to: e.to, reason: e.reason };
  });

  // === Filter & view state ===
  const filterState = {
    hideOrphans: false,
    hubsOnly: false,
    community: "",  // empty = all
    searchMatch: null,  // node id or null
  };

  function isNodeVisible(n) {
    if (filterState.hideOrphans && n.role === "orphan") return false;
    if (filterState.community && n.community !== filterState.community) return false;
    if (filterState.hubsOnly) {
      if (n.role === "hub") return true;
      // Show direct neighbors of hubs too
      for (let i = 0; i < simEdges.length; i++) {
        const e = simEdges[i];
        if (e.from === n.id) {
          const tgt = nodeMap[e.to];
          if (tgt && tgt.role === "hub") return true;
        }
        if (e.to === n.id) {
          const src = nodeMap[e.from];
          if (src && src.role === "hub") return true;
        }
      }
      return false;
    }
    return true;
  }

  function isEdgeVisible(e) {
    const s = nodeMap[e.from];
    const t = nodeMap[e.to];
    if (!s || !t) return false;
    return isNodeVisible(s) && isNodeVisible(t);
  }

  // === Community counts ===
  const communityCounts = {};
  for (const n of simNodes) {
    communityCounts[n.community] = (communityCounts[n.community] || 0) + 1;
  }
  const communityEntries = Object.entries(communityCounts).sort(function (a, b) {
    return b[1] - a[1];
  });

  // === HUD ===
  const hudNodes = document.getElementById("hud-nodes");
  const hudCommunities = document.getElementById("hud-communities");
  const hudMod = document.getElementById("hud-mod");
  hudNodes.textContent = simNodes.length;
  hudCommunities.textContent = communityEntries.length;

  // Approximate modularity: read from a global if injected, else compute simple ratio
  (function () {
    let within = 0, total = 0;
    for (const e of simEdges) {
      const s = nodeMap[e.from];
      const t = nodeMap[e.to];
      if (!s || !t) continue;
      total++;
      if (s.community === t.community) within++;
    }
    const approx = total === 0 ? 0 : (within / total - 0.5);
    hudMod.textContent = approx.toFixed(2);
  })();

  // Populate community select
  const communitySelect = document.getElementById("community-select");
  for (const [label, cnt] of communityEntries) {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label + " (" + cnt + ")";
    communitySelect.appendChild(opt);
  }

  // === Role counts ===
  const roleCounts = {};
  for (const n of simNodes) {
    const r = n.role || "member";
    roleCounts[r] = (roleCounts[r] || 0) + 1;
  }
  const roleOrder = ["hub", "bridge", "leaf", "member", "orphan"];

  // === Legend (clickable) ===
  function renderLegend() {
    let html = "";

    // Communities section
    html += '<div class="graph-legend__section">';
    html += '<div class="graph-legend__section-title">Communities (' + communityEntries.length + ')</div>';
    html += '<div class="graph-legend__grid">';
    for (const [label, cnt] of communityEntries) {
      const dimClass = filterState.community && filterState.community !== label ? " dim" : "";
      html += '<div class="legend-item' + dimClass + '" data-community="' + label + '">';
      html += '<div class="legend-swatch" style="background:' + communityColor(label) + '"></div>';
      html += '<span class="legend-label">' + label + '</span>';
      html += '<span class="legend-count">' + cnt + '</span>';
      html += '</div>';
    }
    html += '</div></div>';

    // Roles section
    html += '<div class="graph-legend__section">';
    html += '<div class="graph-legend__section-title">Roles</div>';
    html += '<div class="graph-legend__grid">';
    for (const role of roleOrder) {
      const cnt = roleCounts[role] || 0;
      if (cnt === 0) continue;
      html += '<div class="legend-item" data-role="' + role + '">';
      html += '<div class="legend-swatch" style="background:' + (ROLE_COLORS[role] || "#8b949e") + '"></div>';
      html += '<span class="legend-label">' + role + '</span>';
      html += '<span class="legend-count">' + cnt + '</span>';
      html += '</div>';
    }
    html += '</div></div>';

    legendEl.innerHTML = html;

    // Wire community clicks
    legendEl.querySelectorAll("[data-community]").forEach(function (el) {
      el.addEventListener("click", function () {
        const label = el.getAttribute("data-community");
        if (filterState.community === label) {
          filterState.community = "";
        } else {
          filterState.community = label;
        }
        communitySelect.value = filterState.community;
        renderLegend();
        settled = false;
      });
    });
  }
  renderLegend();

  // === HUD controls ===
  const btnShowOrphans = document.getElementById("btn-show-orphans");
  const btnHubsOnly = document.getElementById("btn-hubs-only");
  const btnReset = document.getElementById("btn-reset");
  const btnRelayout = document.getElementById("btn-relayout");

  btnShowOrphans.addEventListener("click", function () {
    filterState.hideOrphans = !filterState.hideOrphans;
    btnShowOrphans.classList.toggle("active", filterState.hideOrphans);
    btnShowOrphans.textContent = filterState.hideOrphans ? "show orphans" : "hide orphans";
    settled = false;
  });
  btnHubsOnly.addEventListener("click", function () {
    filterState.hubsOnly = !filterState.hubsOnly;
    btnHubsOnly.classList.toggle("active", filterState.hubsOnly);
    settled = false;
  });
  communitySelect.addEventListener("change", function () {
    filterState.community = communitySelect.value;
    renderLegend();
    settled = false;
  });
  btnReset.addEventListener("click", function () {
    viewScale = 1;
    viewX = 0;
    viewY = 0;
    settled = false;
  });
  btnRelayout.addEventListener("click", function () {
    initPositions();
    simNodes.forEach(function (n) { n.vx = 0; n.vy = 0; n.pinned = false; });
    frame = 0;
    settled = false;
  });

  // === Search ===
  const searchInput = document.getElementById("graph-search-input");
  searchInput.addEventListener("input", function () {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      filterState.searchMatch = null;
      return;
    }
    const match = simNodes.find(function (n) {
      return n.id.toLowerCase().indexOf(q) !== -1;
    });
    if (match) {
      filterState.searchMatch = match.id;
      // Center viewport on the node
      const c = centerXY();
      viewX = c.cx - match.x * viewScale;
      viewY = c.cy - match.y * viewScale;
    }
  });
  searchInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && filterState.searchMatch) {
      window.location.href = "/project?feature=" + encodeURIComponent(filterState.searchMatch);
    }
  });

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function centerXY() {
    var rect = canvas.getBoundingClientRect();
    return { cx: rect.width / 2, cy: rect.height / 2 };
  }

  function initPositions() {
    var c = centerXY();
    var len = simNodes.length || 1;
    // Scale initial radius with node count to avoid overlap at start
    var radius = Math.max(200, len * 40);
    simNodes.forEach(function (node, i) {
      var angle = (i / len) * Math.PI * 2;
      node.x = c.cx + Math.cos(angle) * radius;
      node.y = c.cy + Math.sin(angle) * radius;
    });
  }

  resize();
  initPositions();
  window.addEventListener("resize", function () {
    resize();
    if (frame > SETTLE_FRAME) settled = false;
  });

  var frame = 0;
  var settled = false;
  var hoveredNode = null;
  var hoveredEdge = null;
  var dragNode = null;
  var dragStart = null;
  var clickStart = null;

  // Viewport transform (pan + zoom)
  var viewScale = 1;
  var viewX = 0;
  var viewY = 0;
  var panning = false;
  var panStart = null;

  function screenToWorld(sx, sy) {
    return {
      x: (sx - viewX) / viewScale,
      y: (sy - viewY) / viewScale
    };
  }

  function simulate() {
    var c = centerXY();
    var i, j, n, m, dx, dy, dist, force, edge, src, tgt;

    for (i = 0; i < simNodes.length; i++) {
      n = simNodes[i];
      if (n.pinned) continue;

      n.vx += (c.cx - n.x) * CENTER_GRAVITY;
      n.vy += (c.cy - n.y) * CENTER_GRAVITY;
    }

    for (i = 0; i < simNodes.length; i++) {
      for (j = i + 1; j < simNodes.length; j++) {
        n = simNodes[i];
        m = simNodes[j];
        dx = n.x - m.x;
        dy = n.y - m.y;
        dist = Math.sqrt(dx * dx + dy * dy) || 1;
        force = REPULSION / (dist * dist);
        var fx = (dx / dist) * force;
        var fy = (dy / dist) * force;
        if (!n.pinned) { n.vx += fx; n.vy += fy; }
        if (!m.pinned) { m.vx -= fx; m.vy -= fy; }
      }
    }

    for (i = 0; i < simEdges.length; i++) {
      edge = simEdges[i];
      src = nodeMap[edge.from];
      tgt = nodeMap[edge.to];
      if (!src || !tgt) continue;
      dx = tgt.x - src.x;
      dy = tgt.y - src.y;
      dist = Math.sqrt(dx * dx + dy * dy) || 1;
      force = (dist - REST_LENGTH) * SPRING_K;
      var sfx = (dx / dist) * force;
      var sfy = (dy / dist) * force;
      if (!src.pinned) { src.vx += sfx; src.vy += sfy; }
      if (!tgt.pinned) { tgt.vx -= sfx; tgt.vy -= sfy; }
    }

    var totalMovement = 0;
    for (i = 0; i < simNodes.length; i++) {
      n = simNodes[i];
      if (n.pinned) continue;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      totalMovement += Math.abs(n.vx) + Math.abs(n.vy);
    }

    // Collision resolution: push apart any overlapping circles
    for (i = 0; i < simNodes.length; i++) {
      for (j = i + 1; j < simNodes.length; j++) {
        n = simNodes[i];
        m = simNodes[j];
        var minDist = n.r + m.r + COLLISION_PADDING;
        dx = n.x - m.x;
        dy = n.y - m.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < minDist * minDist) {
          var d = Math.sqrt(d2) || 1;
          var overlap = (minDist - d) / 2;
          var px = (dx / d) * overlap;
          var py = (dy / d) * overlap;
          if (!n.pinned) { n.x += px; n.y += py; }
          if (!m.pinned) { m.x -= px; m.y -= py; }
        }
      }
    }

    return totalMovement;
  }

  function nodeAt(mx, my) {
    for (var i = simNodes.length - 1; i >= 0; i--) {
      var n = simNodes[i];
      if (!isNodeVisible(n)) continue;
      var dx = mx - n.x;
      var dy = my - n.y;
      if (dx * dx + dy * dy <= n.r * n.r) {
        return n;
      }
    }
    return null;
  }

  function edgeAt(mx, my) {
    var threshold = 6;
    for (var i = 0; i < simEdges.length; i++) {
      var e = simEdges[i];
      if (!isEdgeVisible(e)) continue;
      var s = nodeMap[e.from];
      var t = nodeMap[e.to];
      if (!s || !t) continue;
      var dx = t.x - s.x;
      var dy = t.y - s.y;
      var len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      var param = ((mx - s.x) * dx + (my - s.y) * dy) / len2;
      param = Math.max(0, Math.min(1, param));
      var px = s.x + param * dx;
      var py = s.y + param * dy;
      var d = Math.sqrt((mx - px) * (mx - px) + (my - py) * (my - py));
      if (d < threshold) return e;
    }
    return null;
  }

  function drawArrow(fromX, fromY, toX, toY, targetR, color, alpha) {
    var dx = toX - fromX;
    var dy = toY - fromY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    var angle = Math.atan2(dy, dx);

    // Stop the arrow at the edge of the target circle
    var stopAt = targetR + 4;
    var endX = toX - Math.cos(angle) * stopAt;
    var endY = toY - Math.sin(angle) * stopAt;

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    var arrowLen = 8;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLen * Math.cos(angle - 0.35),
      endY - arrowLen * Math.sin(angle - 0.35)
    );
    ctx.lineTo(
      endX - arrowLen * Math.cos(angle + 0.35),
      endY - arrowLen * Math.sin(angle + 0.35)
    );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function connectedTo(nodeId) {
    var set = {};
    for (var i = 0; i < simEdges.length; i++) {
      var e = simEdges[i];
      if (e.from === nodeId) set[e.to] = true;
      if (e.to === nodeId) set[e.from] = true;
    }
    return set;
  }

  function draw() {
    var rect = canvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    var dpr = window.devicePixelRatio || 1;

    // Reset to identity for background fill
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, w, h);

    // Apply viewport transform (pan + zoom) on top of DPR
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, dpr * viewX, dpr * viewY);

    var highlightSet = null;
    if (hoveredNode) {
      highlightSet = connectedTo(hoveredNode.id);
      highlightSet[hoveredNode.id] = true;
    }

    // Pulse phase for hub halo
    var hubPulse = 0.5 + 0.5 * Math.sin(frame * 0.04);

    for (var i = 0; i < simEdges.length; i++) {
      var e = simEdges[i];
      if (!isEdgeVisible(e)) continue;
      var s = nodeMap[e.from];
      var t = nodeMap[e.to];
      if (!s || !t) continue;

      var edgeAlpha = 0.6;
      var edgeColor = EDGE_COLOR;
      if (highlightSet) {
        if (highlightSet[e.from] && highlightSet[e.to]) {
          edgeColor = EDGE_HIGHLIGHT;
          edgeAlpha = 1;
        } else {
          edgeAlpha = DIM_ALPHA;
        }
      }
      if (hoveredEdge === e) {
        edgeColor = EDGE_HIGHLIGHT;
        edgeAlpha = 1;
      }

      drawArrow(s.x, s.y, t.x, t.y, t.r, edgeColor, edgeAlpha);
    }

    for (var j = 0; j < simNodes.length; j++) {
      var n = simNodes[j];
      if (!isNodeVisible(n)) continue;
      var fillColor = communityColor(n.community);
      var borderColor = ROLE_COLORS[n.role] || ROLE_COLORS.member;
      var statusColor = STATUS_COLORS[n.status] || "#8b949e";
      var alpha = 1;

      if (highlightSet && !highlightSet[n.id]) {
        alpha = DIM_ALPHA;
      }
      if (n.role === "orphan") {
        alpha = Math.min(alpha, 0.6);
      }

      // Search match highlight
      var isSearchMatch = filterState.searchMatch === n.id;

      ctx.globalAlpha = alpha;

      // Hub pulsing halo
      if (n.role === "hub") {
        ctx.save();
        ctx.globalAlpha = alpha * (0.2 + 0.2 * hubPulse);
        var haloR = n.r + 8 + 4 * hubPulse;
        ctx.strokeStyle = ROLE_COLORS.hub;
        ctx.lineWidth = 4 + 2 * hubPulse;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Search match aura
      if (isSearchMatch) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = "#58a6ff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Main ball fill with outer drop shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Radial gradient highlight to make the ball feel spherical
      var grad = ctx.createRadialGradient(
        n.x - n.r * 0.35, n.y - n.r * 0.4, n.r * 0.1,
        n.x, n.y, n.r
      );
      grad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
      grad.addColorStop(0.4, "rgba(255, 255, 255, 0.08)");
      grad.addColorStop(0.85, "rgba(0, 0, 0, 0)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0.3)");
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Role-colored border
      var borderWidth = n.role === "hub" ? 3.5 : n.role === "bridge" ? 3 : 2.25;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r - borderWidth / 2, 0, Math.PI * 2);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();

      // Status dot (top of the ball, 12 o'clock, outside the stroke)
      var dotOffset = n.r * 0.68;
      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(n.x, n.y - dotOffset, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(13, 17, 23, 0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Feature name centered in the ball
      ctx.fillStyle = NODE_TEXT;
      ctx.font = "700 12px ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 3;

      var label = n.id;
      // Circle inscribed text area is ~1.4 * r on the horizontal midline
      var maxTextW = n.r * 1.55;
      if (ctx.measureText(label).width > maxTextW) {
        while (label.length > 3 && ctx.measureText(label + "...").width > maxTextW) {
          label = label.slice(0, -1);
        }
        label += "...";
      }
      ctx.fillText(label, n.x, n.y);
      ctx.shadowBlur = 0;

      // Role icon on the top-right of the ball (~1:30 position)
      if (n.role === "hub" || n.role === "bridge") {
        var iconAngle = -Math.PI / 4; // top-right
        var iconX = n.x + Math.cos(iconAngle) * (n.r - 8);
        var iconY = n.y + Math.sin(iconAngle) * (n.r - 8);
        ctx.font = "11px ui-monospace, monospace";
        var icon = n.role === "hub" ? "⚡" : "🌉";
        ctx.fillStyle = n.role === "hub" ? ROLE_COLORS.hub : ROLE_COLORS.bridge;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(icon, iconX, iconY);
      }

      ctx.globalAlpha = 1;
    }
  }

  // === Minimap ===
  const minimapCanvas = document.getElementById("minimap-canvas");
  const minimapCtx = minimapCanvas.getContext("2d");
  function drawMinimap() {
    var rect = minimapCanvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    minimapCanvas.width = rect.width * dpr;
    minimapCanvas.height = rect.height * dpr;
    minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    minimapCtx.clearRect(0, 0, rect.width, rect.height);
    minimapCtx.fillStyle = "rgba(13, 17, 23, 0)";
    minimapCtx.fillRect(0, 0, rect.width, rect.height);

    // Compute bounds of all nodes
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < simNodes.length; i++) {
      var n = simNodes[i];
      if (!isNodeVisible(n)) continue;
      if (n.x - n.r < minX) minX = n.x - n.r;
      if (n.y - n.r < minY) minY = n.y - n.r;
      if (n.x + n.r > maxX) maxX = n.x + n.r;
      if (n.y + n.r > maxY) maxY = n.y + n.r;
    }
    if (!isFinite(minX)) return;
    var pad = 40;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    var w = maxX - minX, h = maxY - minY;
    var sx = rect.width / w, sy = rect.height / h;
    var s = Math.min(sx, sy);
    var ox = (rect.width - w * s) / 2 - minX * s;
    var oy = (rect.height - h * s) / 2 - minY * s;

    // Draw nodes as small dots
    for (var j = 0; j < simNodes.length; j++) {
      var nn = simNodes[j];
      if (!isNodeVisible(nn)) continue;
      minimapCtx.fillStyle = communityColor(nn.community);
      var r = nn.role === "hub" ? 3 : 2;
      minimapCtx.beginPath();
      minimapCtx.arc(nn.x * s + ox, nn.y * s + oy, r, 0, Math.PI * 2);
      minimapCtx.fill();
    }

    // Draw viewport rectangle
    var canvasRect = canvas.getBoundingClientRect();
    var vx = (-viewX / viewScale) * s + ox;
    var vy = (-viewY / viewScale) * s + oy;
    var vw = (canvasRect.width / viewScale) * s;
    var vh = (canvasRect.height / viewScale) * s;
    minimapCtx.strokeStyle = "#58a6ff";
    minimapCtx.lineWidth = 1.5;
    minimapCtx.strokeRect(vx, vy, vw, vh);
  }

  function showNodeTooltip(n, mx, my) {
    var statusColor = STATUS_COLORS[n.status] || "#8b949e";
    var commColor = communityColor(n.community);
    tooltip.innerHTML =
      '<div class="tt-name">' + n.id + '</div>' +
      '<div class="tt-row"><span class="tt-label">Status</span><span class="tt-val" style="color:' + statusColor + '">' + n.status + '</span></div>' +
      '<div class="tt-row"><span class="tt-label">Community</span><span class="tt-val" style="color:' + commColor + '">' + n.community + '</span></div>' +
      '<div class="tt-row"><span class="tt-label">Role</span><span class="tt-val">' + n.role + '</span></div>' +
      '<div class="tt-row"><span class="tt-label">Dependencies</span><span class="tt-val">' + n.deps + '</span></div>' +
      '<div class="tt-row"><span class="tt-label">Rules</span><span class="tt-val">' + n.rules + '</span></div>' +
      '<div class="tt-row"><span class="tt-label">Exports</span><span class="tt-val">' + n.exports + '</span></div>' +
      (n.description ? '<div class="tt-desc">' + n.description + '</div>' : '');
    positionTooltip(mx, my);
    tooltip.classList.add("visible");
  }

  function showEdgeTooltip(e, mx, my) {
    tooltip.innerHTML = '<div class="tt-edge-reason">' + e.from + ' &rarr; ' + e.to + '<br>' + e.reason + '</div>';
    positionTooltip(mx, my);
    tooltip.classList.add("visible");
  }

  function positionTooltip(mx, my) {
    var rect = canvas.getBoundingClientRect();
    var container = canvas.parentElement.getBoundingClientRect();
    var tx = mx - container.left + 16;
    var ty = my - container.top + 16;
    if (tx + 280 > container.width) tx = mx - container.left - 296;
    if (ty + 160 > container.height) ty = my - container.top - 170;
    tooltip.style.left = tx + "px";
    tooltip.style.top = ty + "px";
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
  }

  function getScreenPos(ev) {
    var rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function getWorldPos(ev) {
    var s = getScreenPos(ev);
    return screenToWorld(s.x, s.y);
  }

  canvas.addEventListener("mousemove", function (ev) {
    var screen = getScreenPos(ev);
    var world = screenToWorld(screen.x, screen.y);

    // Panning
    if (panning && panStart) {
      viewX += screen.x - panStart.x;
      viewY += screen.y - panStart.y;
      panStart = screen;
      return;
    }

    // Dragging a node
    if (dragNode) {
      dragNode.x = world.x;
      dragNode.y = world.y;
      dragNode.vx = 0;
      dragNode.vy = 0;
      settled = false;
      return;
    }

    var n = nodeAt(world.x, world.y);
    var e = n ? null : edgeAt(world.x, world.y);

    if (n !== hoveredNode || e !== hoveredEdge) {
      hoveredNode = n;
      hoveredEdge = e;
    }

    if (n) {
      canvas.style.cursor = "pointer";
      showNodeTooltip(n, ev.clientX, ev.clientY);
    } else if (e) {
      canvas.style.cursor = "default";
      showEdgeTooltip(e, ev.clientX, ev.clientY);
    } else {
      canvas.style.cursor = "grab";
      hideTooltip();
    }
  });

  canvas.addEventListener("mousedown", function (ev) {
    ev.preventDefault();
    var screen = getScreenPos(ev);
    var world = screenToWorld(screen.x, screen.y);

    // Middle click or shift+left click = pan
    if (ev.button === 1 || (ev.button === 0 && ev.shiftKey)) {
      panning = true;
      panStart = screen;
      canvas.style.cursor = "grabbing";
      return;
    }

    if (ev.button !== 0) return;

    var n = nodeAt(world.x, world.y);
    if (n) {
      dragNode = n;
      n.pinned = true;
      canvas.classList.add("dragging");
      hideTooltip();
      settled = false;
      clickStart = { x: ev.clientX, y: ev.clientY, time: Date.now() };
    } else {
      // Left click on empty space also pans
      panning = true;
      panStart = screen;
      canvas.style.cursor = "grabbing";
    }
  });

  canvas.addEventListener("mouseup", function (ev) {
    if (panning) {
      panning = false;
      panStart = null;
      canvas.style.cursor = "grab";
      return;
    }

    if (dragNode) {
      dragNode.pinned = false;
      canvas.classList.remove("dragging");

      // Detect click: small movement and short duration
      var isClick = false;
      if (clickStart) {
        var dxClick = Math.abs(ev.clientX - clickStart.x);
        var dyClick = Math.abs(ev.clientY - clickStart.y);
        var dtClick = Date.now() - clickStart.time;
        isClick = dxClick < 4 && dyClick < 4 && dtClick < 300;
      }

      if (isClick) {
        window.location.href = "/project?feature=" + encodeURIComponent(dragNode.id);
      }

      dragNode = null;
      clickStart = null;
    }
  });

  canvas.addEventListener("mouseleave", function () {
    hoveredNode = null;
    hoveredEdge = null;
    hideTooltip();
    if (dragNode) {
      dragNode.pinned = false;
      dragNode = null;
      canvas.classList.remove("dragging");
    }
    panning = false;
    panStart = null;
    clickStart = null;
  });

  canvas.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var screen = getScreenPos(ev);
    var worldBefore = screenToWorld(screen.x, screen.y);

    var delta = -ev.deltaY;
    var factor = delta > 0 ? 1.1 : 1 / 1.1;
    var newScale = viewScale * factor;
    newScale = Math.max(0.2, Math.min(3, newScale));
    viewScale = newScale;

    // Adjust viewX/viewY so the point under the cursor stays fixed
    var worldAfter = screenToWorld(screen.x, screen.y);
    viewX += (worldAfter.x - worldBefore.x) * viewScale;
    viewY += (worldAfter.y - worldBefore.y) * viewScale;
  }, { passive: false });

  canvas.addEventListener("contextmenu", function (ev) {
    ev.preventDefault();
  });

  function tick() {
    frame++;

    if (!settled) {
      var movement = simulate();
      if (frame > SETTLE_FRAME && movement < SETTLE_THRESHOLD) {
        settled = true;
      }
    }

    draw();
    drawMinimap();

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
</script>`;
}

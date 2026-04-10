export interface GraphNode {
  id: string;
  status: string;
  deps: number;
  rules: number;
  exports: number;
  description: string;
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
    position: relative;
    width: 100%;
    height: calc(100vh - 56px);
    margin: -72px -1.5rem -2rem;
    padding: 0;
    overflow: hidden;
    background: #0d1117;
  }

  .graph-container canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .graph-container canvas.dragging {
    cursor: grabbing;
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

  @media (max-width: 768px) {
    .graph-container {
      height: calc(100vh - 56px);
      margin: -64px -1rem -1.5rem;
    }
  }
</style>

<div class="graph-container">
  <canvas id="graph-canvas"></canvas>
  <div class="graph-tooltip" id="graph-tooltip"></div>
</div>

<script>
(function () {
  const raw = ${graphData};
  const STATUS_COLORS = {
    draft: "#1f6feb",
    active: "#3fb950",
    deprecated: "#f85149"
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
  const ctx = canvas.getContext("2d");

  const simNodes = raw.nodes.map(function (n) {
    const size = Math.min(80, Math.max(40, 30 + (n.deps + n.rules + n.exports) * 2));
    return {
      id: n.id,
      status: n.status,
      deps: n.deps,
      rules: n.rules,
      exports: n.exports,
      description: n.description,
      x: 0, y: 0, vx: 0, vy: 0,
      w: size * 2,
      h: size * 0.8,
      pinned: false
    };
  });

  const nodeMap = {};
  simNodes.forEach(function (n) { nodeMap[n.id] = n; });

  const simEdges = raw.edges.map(function (e) {
    return { from: e.from, to: e.to, reason: e.reason };
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

    // Collision resolution: push apart any overlapping rectangles
    for (i = 0; i < simNodes.length; i++) {
      for (j = i + 1; j < simNodes.length; j++) {
        n = simNodes[i];
        m = simNodes[j];
        var minDX = (n.w + m.w) / 2 + COLLISION_PADDING;
        var minDY = (n.h + m.h) / 2 + COLLISION_PADDING;
        dx = n.x - m.x;
        dy = n.y - m.y;
        var overlapX = minDX - Math.abs(dx);
        var overlapY = minDY - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          // Push along the axis with smaller overlap
          if (overlapX < overlapY) {
            var push = overlapX / 2 * (dx >= 0 ? 1 : -1);
            if (!n.pinned) n.x += push;
            if (!m.pinned) m.x -= push;
          } else {
            var pushY = overlapY / 2 * (dy >= 0 ? 1 : -1);
            if (!n.pinned) n.y += pushY;
            if (!m.pinned) m.y -= pushY;
          }
        }
      }
    }

    return totalMovement;
  }

  function nodeAt(mx, my) {
    for (var i = simNodes.length - 1; i >= 0; i--) {
      var n = simNodes[i];
      var hw = n.w / 2;
      var hh = n.h / 2;
      if (mx >= n.x - hw && mx <= n.x + hw && my >= n.y - hh && my <= n.y + hh) {
        return n;
      }
    }
    return null;
  }

  function edgeAt(mx, my) {
    var threshold = 6;
    for (var i = 0; i < simEdges.length; i++) {
      var e = simEdges[i];
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

  function drawArrow(fromX, fromY, toX, toY, nodeW, nodeH, color, alpha) {
    var dx = toX - fromX;
    var dy = toY - fromY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    var angle = Math.atan2(dy, dx);

    var hw = nodeW / 2 + 4;
    var hh = nodeH / 2 + 4;
    var scale = Math.min(hw / Math.max(Math.abs(Math.cos(angle)), 0.01), hh / Math.max(Math.abs(Math.sin(angle)), 0.01));
    var endX = toX - Math.cos(angle) * scale;
    var endY = toY - Math.sin(angle) * scale;

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

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, w, h);

    var highlightSet = null;
    if (hoveredNode) {
      highlightSet = connectedTo(hoveredNode.id);
      highlightSet[hoveredNode.id] = true;
    }

    for (var i = 0; i < simEdges.length; i++) {
      var e = simEdges[i];
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

      drawArrow(s.x, s.y, t.x, t.y, t.w, t.h, edgeColor, edgeAlpha);
    }

    for (var j = 0; j < simNodes.length; j++) {
      var n = simNodes[j];
      var nx = n.x - n.w / 2;
      var ny = n.y - n.h / 2;
      var color = STATUS_COLORS[n.status] || "#8b949e";
      var alpha = 1;

      if (highlightSet && !highlightSet[n.id]) {
        alpha = DIM_ALPHA;
      }

      ctx.globalAlpha = alpha;

      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      roundRect(nx, ny, n.w, n.h, 6);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.shadowBlur = 0;

      roundRect(nx, ny, n.w, n.h, 6);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = NODE_TEXT;
      ctx.font = "600 12px ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      var label = n.id;
      var maxTextW = n.w - 12;
      if (ctx.measureText(label).width > maxTextW) {
        while (label.length > 3 && ctx.measureText(label + "...").width > maxTextW) {
          label = label.slice(0, -1);
        }
        label += "...";
      }
      ctx.fillText(label, n.x, n.y);

      ctx.globalAlpha = 1;
    }
  }

  function showNodeTooltip(n, mx, my) {
    var statusColor = STATUS_COLORS[n.status] || "#8b949e";
    tooltip.innerHTML =
      '<div class="tt-name">' + n.id + '</div>' +
      '<div class="tt-row"><span class="tt-label">Status</span><span class="tt-val" style="color:' + statusColor + '">' + n.status + '</span></div>' +
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

  function getMousePos(ev) {
    var rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  canvas.addEventListener("mousemove", function (ev) {
    var pos = getMousePos(ev);

    if (dragNode) {
      dragNode.x = pos.x;
      dragNode.y = pos.y;
      dragNode.vx = 0;
      dragNode.vy = 0;
      settled = false;
      return;
    }

    var n = nodeAt(pos.x, pos.y);
    var e = n ? null : edgeAt(pos.x, pos.y);

    if (n !== hoveredNode || e !== hoveredEdge) {
      hoveredNode = n;
      hoveredEdge = e;
      if (!settled) return;
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
    var pos = getMousePos(ev);
    var n = nodeAt(pos.x, pos.y);
    if (n) {
      dragNode = n;
      n.pinned = true;
      canvas.classList.add("dragging");
      hideTooltip();
      settled = false;
    }
  });

  canvas.addEventListener("mouseup", function (ev) {
    if (dragNode) {
      dragNode.pinned = false;
      canvas.classList.remove("dragging");

      var pos = getMousePos(ev);
      var n = nodeAt(pos.x, pos.y);
      if (n === dragNode && Math.abs(dragNode.vx) < 1 && Math.abs(dragNode.vy) < 1) {
        window.location.href = "/project?feature=" + encodeURIComponent(dragNode.id);
      }
      dragNode = null;
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

    if (settled && !dragNode && !hoveredNode) {
      requestAnimationFrame(tick);
    } else {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
})();
</script>`;
}

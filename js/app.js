const CONTINENTS = {
  "Mathematics":      "#378ADD",
  "Philosophy":       "#9F8FE8",
  "Social Sciences":  "#EF9F27",
  "Medicine":         "#E2614A",
  "Humanities":       "#2BBFA0",
  "Arts":             "#D4537E",
  "Applied Sciences": "#7ABF3C",
  "Natural Sciences": "#5BC8D8",
  "Skills & Crafts":  "#9A9890"
};

const FADE = 0.25;
function labelOpacity(level, zoom) {
  if (level === 1) return 1;
  if (level === 2) return Math.min(1, (zoom - 0.3) / FADE);
  if (level === 3) return Math.min(1, Math.max(0, (zoom - 0.7) / FADE));
  if (level === 4) return Math.min(1, Math.max(0, (zoom - 1.4) / FADE));
  if (level === 5) return Math.min(1, Math.max(0, (zoom - 2.4) / FADE));
  return 0;
}

const FONT_SIZE   = { 1: 13, 2: 11, 3: 10, 4: 9, 5: 8 };
const FONT_WEIGHT = { 1: 600, 2: 500, 3: 400, 4: 400, 5: 400 };
const NODE_OFFSET = { 1: 20, 2: 13, 3: 10, 4: 8, 5: 7 };
const TOP_BAR_H   = 52;

// ── Sidebar gradient helper ────────────────────────────────────────────────────
// Mixes the node hex colour with white at two opacities to produce a fully
// opaque two-stop gradient (no translucency).
function nodeGradient(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tint = (ch, p) => Math.round(255 * (1 - p) + ch * p);
  const light = `rgb(${tint(r,.18)},${tint(g,.18)},${tint(b,.18)})`;
  const deep  = `rgb(${tint(r,.42)},${tint(g,.42)},${tint(b,.42)})`;
  return `linear-gradient(to bottom, ${light} 0%, ${deep} 100%)`;
}

// ── Burger menu ───────────────────────────────────────────────────────────────
(function() {
  const btn      = document.getElementById("nav-menu");
  const dropdown = document.getElementById("nav-dropdown");
  btn.addEventListener("click", e => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });
  document.addEventListener("click", e => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove("open");
    }
  });
})();

fetch('knowledge_map.json')
  .then(r => r.json())
  .then(init)
  .catch(() => {
    document.body.innerHTML = '<div style="color:white;padding:20px">Could not load knowledge_map.json — place it in the same folder.</div>';
  });

function init(data) {
  // ── Build lookup structures ────────────────────────────────────────────────
  const allNodes = {};
  data.nodes.forEach(n => allNodes[n.id] = { ...n, children: [], parent: null, expanded: false });

  const childrenOf = {};
  const parentOf   = {};
  data.edges.forEach(e => {
    const src = e.source, tgt = e.target;
    if (!childrenOf[src]) childrenOf[src] = [];
    childrenOf[src].push(tgt);
    parentOf[tgt] = src;
  });

  function getContinent(id) {
    let cur = id, visited = new Set();
    while (parentOf[cur] !== undefined && !visited.has(cur)) {
      visited.add(cur);
      cur = parentOf[cur];
    }
    return allNodes[cur] ? allNodes[cur].label : "Unknown";
  }
  Object.values(allNodes).forEach(n => {
    n.continent = getContinent(n.id);
    n.color = CONTINENTS[n.continent] || "#888";
  });

  const hasHiddenChildren = id => (childrenOf[id] || []).some(cid => allNodes[cid].level >= 5);

  // ── Visible set: starts as L1–L4 ──────────────────────────────────────────
  const visibleIds = new Set(Object.values(allNodes).filter(n => n.level <= 4).map(n => n.id));

  // ── SVG setup ──────────────────────────────────────────────────────────────
  const w = window.innerWidth, h = window.innerHeight - TOP_BAR_H;
  const svg      = d3.select("#canvas").attr("width", w).attr("height", h);
  const labelSvg = d3.select("#label-layer").attr("width", w).attr("height", h);
  const g        = svg.append("g");
  const gLinks   = g.append("g").attr("class", "links");
  const gNodes   = g.append("g").attr("class", "nodes");
  const gExpand  = g.append("g").attr("class", "expanders");

  let currentTransform = d3.zoomIdentity;

  const zoomBehaviour = d3.zoom()
    .scaleExtent([0.1, 5])
    .on("zoom", e => {
      g.attr("transform", e.transform);
      currentTransform = e.transform;
      updateLabels();
      repositionLabels();
      document.getElementById("zoom-level").textContent = `zoom: ${e.transform.k.toFixed(2)}`;
    });
  svg.call(zoomBehaviour);

  // Zoom buttons
  document.getElementById("zoom-in").addEventListener("click", () => {
    svg.transition().duration(300).call(zoomBehaviour.scaleBy, 1.4);
  });
  document.getElementById("zoom-out").addEventListener("click", () => {
    svg.transition().duration(300).call(zoomBehaviour.scaleBy, 1 / 1.4);
  });

  // ── Continent pre-seeding ──────────────────────────────────────────────────
  const continentNames = Object.keys(CONTINENTS);
  const seedRadius = Math.min(w, h) * 0.75;
  const continentSeeds = {};
  continentNames.forEach((name, i) => {
    const angle = (i / continentNames.length) * 2 * Math.PI;
    continentSeeds[name] = { x: w/2 + seedRadius * Math.cos(angle), y: h/2 + seedRadius * Math.sin(angle) };
  });

  Object.values(allNodes).forEach(n => {
    const seed = continentSeeds[n.continent];
    if (seed) {
      const scatter = n.level === 1 ? 0 : n.level === 2 ? 60 : n.level === 3 ? 120 : n.level === 4 ? 160 : 190;
      n.x = seed.x + (Math.random() - 0.5) * scatter;
      n.y = seed.y + (Math.random() - 0.5) * scatter;
    }
  });

  // ── Force simulation ───────────────────────────────────────────────────────
  const nodeRadius = d => d.level === 1 ? 16 : d.level === 2 ? 9 : d.level === 3 ? 5.5 : d.level === 4 ? 4 : 3;

  let simNodes = [];
  let simEdges = [];
  let sim = d3.forceSimulation([])
    .force("link",    d3.forceLink([]).id(d => d.id).strength(0.8))
    .force("charge",  d3.forceManyBody().strength(d => d.level === 1 ? -2500 : d.level === 2 ? -300 : d.level === 3 ? -80 : d.level === 4 ? -25 : -10).distanceMax(600))
    .force("center",  d3.forceCenter(w/2, h/2).strength(0.05))
    .force("collide", d3.forceCollide().radius(d => nodeRadius(d) + 4).strength(0.8))
    .force("x",       d3.forceX(d => continentSeeds[d.continent] ? continentSeeds[d.continent].x : w/2).strength(d => d.level === 1 ? 0.3 : 0.06))
    .force("y",       d3.forceY(d => continentSeeds[d.continent] ? continentSeeds[d.continent].y : h/2).strength(d => d.level === 1 ? 0.3 : 0.06))
    .alphaDecay(0.015)
    .on("tick", ticked);

  let link, node, expander, label;

  function rebuild() {
    simNodes = Array.from(visibleIds).map(id => allNodes[id]);
    simEdges = data.edges
      .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map(e => ({ source: e.source, target: e.target }));

    link = gLinks.selectAll("line").data(simEdges, d => `${d.source}-${d.target}`);
    link.exit().remove();
    link = link.enter().append("line")
      .attr("stroke", d => {
        const src = allNodes[typeof d.source === "object" ? d.source.id : d.source];
        return src ? (CONTINENTS[src.continent] || "#444") : "#444";
      })
      .attr("stroke-opacity", d => {
        const src = allNodes[typeof d.source === "object" ? d.source.id : d.source];
        return src?.level === 1 ? 0.5 : src?.level === 2 ? 0.35 : src?.level === 3 ? 0.2 : 0.12;
      })
      .attr("stroke-width", d => {
        const src = allNodes[typeof d.source === "object" ? d.source.id : d.source];
        return src?.level === 1 ? 1.5 : src?.level === 2 ? 1 : 0.5;
      })
      .merge(link);

    node = gNodes.selectAll("circle").data(simNodes, d => d.id);
    node.exit().remove();
    const nodeEnter = node.enter().append("circle")
      .attr("r", nodeRadius)
      .attr("fill", d => d.color)
      .attr("fill-opacity", d => d.level === 1 ? 1 : d.level === 2 ? 0.85 : 0.7)
      .attr("stroke", d => d.level <= 2 ? "rgba(255,255,255,0.25)" : "none")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on("mouseover", (e, d) => {
        tt.style.display = "block";
        tt.innerHTML = `<strong style="color:${d.color}">${d.label}</strong><br><span style="color:#888;font-size:11px">${d.continent}</span>`;
      })
      .on("mousemove", e => { tt.style.left = (e.clientX+14)+"px"; tt.style.top = (e.clientY-10)+"px"; })
      .on("mouseout",  () => { tt.style.display = "none"; })
      .on("click", onNodeClick);
    node = nodeEnter.merge(node);
    refreshNodeColors();

    const expanderData = simNodes.filter(n => n.level === 4 && hasHiddenChildren(n.id));
    expander = gExpand.selectAll("text").data(expanderData, d => d.id);
    expander.exit().remove();
    expander = expander.enter().append("text")
      .attr("font-size", 9)
      .attr("fill", "rgba(255,255,255,0.6)")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("cursor", "pointer")
      .style("user-select", "none")
      .on("click", (e, d) => { e.stopPropagation(); toggleExpand(d); })
      .merge(expander);

    label = labelSvg.selectAll("text").data(simNodes, d => d.id);
    label.exit().remove();
    label = label.enter().append("text")
      .text(d => d.label)
      .attr("font-size",   d => FONT_SIZE[d.level]   || 9)
      .attr("font-weight", d => FONT_WEIGHT[d.level] || 400)
      .attr("fill", "#fff")
      .attr("text-anchor", "middle")
      .attr("opacity", 0)
      .style("pointer-events", "none")
      .style("user-select", "none")
      .merge(label);

    sim.nodes(simNodes);
    sim.force("link").links(simEdges);
    sim.alpha(0.4).restart();

    document.getElementById("node-count").textContent = `${simNodes.length} nodes visible`;
    updateLabels();
  }

  // ── Expand / collapse ──────────────────────────────────────────────────────
  function toggleExpand(d) {
    const kids = childrenOf[d.id] || [];
    if (!d.expanded) {
      kids.forEach(cid => {
        visibleIds.add(cid);
        allNodes[cid].x = d.x + (Math.random() - 0.5) * 30;
        allNodes[cid].y = d.y + (Math.random() - 0.5) * 30;
      });
      d.expanded = true;
    } else {
      function removeDescendants(id) {
        (childrenOf[id] || []).forEach(cid => {
          visibleIds.delete(cid);
          allNodes[cid].expanded = false;
          removeDescendants(cid);
        });
      }
      removeDescendants(d.id);
      d.expanded = false;
    }
    rebuild();
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const sidebar = document.getElementById("sidebar");
  document.getElementById("sb-close").addEventListener("click", () => {
    closeSidebar();
    resetHighlight();
  });

  function openSidebar(d) {
    // Build ancestor chain
    const chain = [];
    let cur = d.id;
    while (parentOf[cur] !== undefined) {
      cur = parentOf[cur];
      chain.unshift(allNodes[cur]);
    }
    // chain[0] = L1 domain, rest = intermediate ancestors

    const domainNode = chain[0];

    // Breadcrumb: L2 up to (but not including) the clicked node
    const crumbParts = chain.slice(1).map(n => n.label);
    document.getElementById("sb-breadcrumb-text").textContent =
      crumbParts.length ? crumbParts.join(" › ") : (domainNode ? domainNode.label : "");

    // Domain tag
    const domainTag = document.getElementById("sb-domain-tag");
    if (domainNode) {
      domainTag.textContent = domainNode.label.toUpperCase();
      domainTag.style.color = d.color;
      domainTag.style.background = d.color + "1A";
    }

    // Title
    document.getElementById("sb-title").textContent = d.label;

    // Sidebar gradient derived from node colour — fully opaque tints
    sidebar.style.background = nodeGradient(d.color);

    // Wire "Learn this" button to open learning mode for this node
    const learnBtn = document.querySelector(".sb-learn-btn");
    if (learnBtn) {
      const crumb = (domainNode ? domainNode.label : "") +
        (crumbParts.length ? " › " + crumbParts.join(" › ") : "");
      learnBtn.onclick = function () {
        closeSidebar();
        openLearningMode(d, crumb);
      };
    }

    sidebar.classList.add("open");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebar.style.background = "";
  }

  // ── Click to highlight ─────────────────────────────────────────────────────
  let selected = null;

  function onNodeClick(e, d) {
    e.stopPropagation();

    if (d.level === 4 && hasHiddenChildren(d.id)) {
      toggleExpand(d);
      return;
    }

    if (selected === d.id) {
      resetHighlight();
      closeSidebar();
      return;
    }

    selected = d.id;
    const connected = new Set([d.id]);
    simEdges.forEach(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (s === d.id) connected.add(t);
      if (t === d.id) connected.add(s);
    });
    node.attr("fill-opacity", n => connected.has(n.id) ? 1 : 0.08);
    link.attr("stroke-opacity", l => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      return (s === d.id || t === d.id) ? 0.9 : 0.03;
    });

    openSidebar(d);
  }

  function resetHighlight() {
    selected = null;
    refreshNodeColors();
  }

  svg.on("click", () => { resetHighlight(); closeSidebar(); });

  // ── Search ─────────────────────────────────────────────────────────────────
  document.getElementById("search-box").addEventListener("input", function() {
    const q = this.value.trim().toLowerCase();
    if (!q) { resetHighlight(); return; }
    const matches = new Set();
    simNodes.forEach(n => { if (n.label.toLowerCase().includes(q)) matches.add(n.id); });
    if (node) node.attr("fill-opacity", n => matches.has(n.id) ? 1 : 0.06);
    if (link) link.attr("stroke-opacity", 0.03);
  });

  // ── Tick ───────────────────────────────────────────────────────────────────
  const tt = document.getElementById("tooltip");

  function ticked() {
    if (link) link
      .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    if (node) node.attr("cx", d => d.x).attr("cy", d => d.y);
    if (expander) expander
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .text(d => d.expanded ? "−" : "+");
    repositionLabels();
  }

  function repositionLabels() {
    if (!label) return;
    label
      .attr("x", d => currentTransform.applyX(d.x))
      .attr("y", d => currentTransform.applyY(d.y) - (NODE_OFFSET[d.level] || 10));
  }

  function updateLabels() {
    if (!label) return;
    const k = currentTransform.k;
    label.attr("opacity", d => labelOpacity(d.level, k));
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  window.addEventListener("resize", () => {
    const nw = window.innerWidth, nh = window.innerHeight - TOP_BAR_H;
    svg.attr("width", nw).attr("height", nh);
    labelSvg.attr("width", nw).attr("height", nh);
    sim.force("center", d3.forceCenter(nw/2, nh/2)).alpha(0.1).restart();
  });

  // ── Screensaver ────────────────────────────────────────────────────────────
  let screensaverTimer = null;
  let screensaverActive = false;
  let screensaverLoop = null;
  const IDLE_TIMEOUT = 60000;

  function resetIdleTimer() {
    if (screensaverActive) stopScreensaver();
    clearTimeout(screensaverTimer);
    screensaverTimer = setTimeout(startScreensaver, IDLE_TIMEOUT);
  }
  function startScreensaver() {
    screensaverActive = true;
    runScreensaverStep();
  }
  function stopScreensaver() {
    screensaverActive = false;
    clearTimeout(screensaverLoop);
    svg.interrupt();
  }
  function runScreensaverStep() {
    if (!screensaverActive) return;
    const strategy = Math.random();
    let targetNode, targetZoom;
    if (strategy < 0.3) {
      const pool = simNodes.filter(n => n.level === 1);
      targetNode = pool[Math.floor(Math.random() * pool.length)];
      targetZoom = 0.3 + Math.random() * 0.3;
    } else if (strategy < 0.6) {
      const pool = simNodes.filter(n => n.level === 2 || n.level === 3);
      targetNode = pool[Math.floor(Math.random() * pool.length)];
      targetZoom = 0.8 + Math.random() * 0.8;
    } else {
      const pool = simNodes.filter(n => n.level === 4 || n.level === 5);
      targetNode = pool[Math.floor(Math.random() * pool.length)];
      targetZoom = 2.0 + Math.random() * 2.0;
    }
    if (!targetNode || !targetNode.x) { screensaverLoop = setTimeout(runScreensaverStep, 500); return; }
    const cw = window.innerWidth, ch = window.innerHeight - TOP_BAR_H;
    const transform = d3.zoomIdentity
      .translate(cw/2 - targetNode.x * targetZoom, ch/2 - targetNode.y * targetZoom)
      .scale(targetZoom);
    const duration = 3000 + Math.random() * 3000;
    const pause    = 2000 + Math.random() * 2000;
    svg.transition().duration(duration).ease(d3.easeCubicInOut)
      .call(zoomBehaviour.transform, transform)
      .on("end", () => { if (screensaverActive) screensaverLoop = setTimeout(runScreensaverStep, pause); });
  }
  ["mousemove", "mousedown", "wheel", "touchstart", "keydown"].forEach(evt => {
    window.addEventListener(evt, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();

  // ── Filter ─────────────────────────────────────────────────────────────────
  let activeFilterSet = null;

  function nodePassesFilter(nodeId) {
    let cur = nodeId;
    while (cur !== undefined) {
      if (allNodes[cur] && activeFilterSet.has(allNodes[cur].label)) return true;
      cur = parentOf[cur];
    }
    return false;
  }

  function refreshNodeColors() {
    if (!node) return;
    node
      .attr('fill', d => (!activeFilterSet || nodePassesFilter(d.id)) ? d.color : '#585858')
      .attr('fill-opacity', d => {
        const base = d.level === 1 ? 1 : d.level === 2 ? 0.85 : 0.7;
        return (!activeFilterSet || nodePassesFilter(d.id)) ? base : 0.3;
      });
    if (!link) return;
    link
      .attr('stroke', d => {
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        if (activeFilterSet && !(nodePassesFilter(srcId) && nodePassesFilter(tgtId))) return '#585858';
        const src = allNodes[srcId];
        return src ? (CONTINENTS[src.continent] || '#444') : '#444';
      })
      .attr('stroke-opacity', d => {
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        if (activeFilterSet && !(nodePassesFilter(srcId) && nodePassesFilter(tgtId))) return 0.06;
        const src = allNodes[srcId];
        return src?.level === 1 ? 0.5 : src?.level === 2 ? 0.35 : src?.level === 3 ? 0.2 : 0.12;
      });
  }

  window.setMapFilter = function(labelSet) {
    activeFilterSet = labelSet;
    refreshNodeColors();
  };

  // ── Initial build ──────────────────────────────────────────────────────────
  rebuild();
}

/* ═══════════════════════════════════════════════════════════════
   MAP VIEW  —  app.js
   ───────────────────────────────────────────────────────────────
   Owns  : D3 force simulation, zoom/pan, node rendering, sidebar,
           progress overlay, filter state, knowledge toggle
   Exposes: window.MapView.setFilter(labelSet)
            window.MapView.setKnowledgeFilter(progressMap)
            window.MapView.clearKnowledgeFilter()
            window.MapView.resetZoom()
            window.MapView.refreshProgress()
            window.MapView.setTilt(angle)    [called by tilt.js]
   Calls  : window.Learn.open/close
   Never  : implement learning or test flow — delegate to those modules
   ═══════════════════════════════════════════════════════════════ */

const CONTINENTS = {
  "Mathematics":      "#378ADD",
  "Philosophy":       "#9F8FE8",
  "Social Sciences":  "#EF9F27",
  "Medicine":         "#E2614A",
  "Humanities":       "#2BBFA0",
  "Arts":             "#D4537E",
  "Applied Sciences": "#7ABF3C",
  "Natural Sciences": "#5BC8D8",
  "Skills & Crafts":  "#C4A55A"
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

const SIM_PRESETS = {
  lively:   { alphaDecay: 0.015, velocityDecay: 0.4 },
  moderate: { alphaDecay: 0.06,  velocityDecay: 0.6 },
  static:   { alphaDecay: 0.2,   velocityDecay: 0.8 },
};
let simPreset = SIM_PRESETS.moderate;

Promise.all([
  fetch('/api/map').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  fetch('/api/settings').then(r => r.json()).catch(() => ({})),
]).then(([{ base, emergent }, settings]) => {
  simPreset = SIM_PRESETS[settings.map_animation] || SIM_PRESETS.moderate;
  init(base, emergent);
  if (window._tourCheckAutoStart) window._tourCheckAutoStart(settings);
}).catch(() => {
  document.body.innerHTML = '<div style="color:white;padding:20px">Could not load map — please refresh or log in again.</div>';
});

// Load user's knowledge progress and overlay on map
let progressMap = {};
function loadProgress() {
  fetch('/api/map/progress')
    .then(r => r.json())
    .then(data => {
      progressMap = data;
      applyProgressOverlay();
    })
    .catch(() => {});
}

function init(data, emergentData) {
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

  // ── Emergent layer constants & data ───────────────────────────────────────
  const LAYER_Y_OFFSET  = 680;
  const LAYER_Z         = LAYER_Y_OFFSET;
  const E_COLOR_L1      = '#C4A55A';
  const E_COLOR_L2      = '#E8C97A';

  const allEmergentNodes  = {};
  const emergentChildrenOf = {};
  const emergentParentOf   = {};
  const drawsFromEdges     = [];

  emergentData.nodes.forEach(n => {
    allEmergentNodes[n.id] = {
      ...n,
      expanded: false,
      color: n.level === 1 ? E_COLOR_L1 : E_COLOR_L2
    };
  });
  emergentData.edges.forEach(e => {
    if (e.edge_type === 'hierarchical') {
      if (!emergentChildrenOf[e.source]) emergentChildrenOf[e.source] = [];
      emergentChildrenOf[e.source].push(e.target);
      emergentParentOf[e.target] = e.source;
    } else if (e.edge_type === 'draws_from') {
      drawsFromEdges.push({ source: e.source, target: e.target });
    }
  });

  const visibleEmergentIds = new Set(
    Object.values(allEmergentNodes).filter(n => n.level === 1).map(n => n.id)
  );

  function nearestVisibleBase(id) {
    let cur = id;
    while (cur !== undefined && !visibleIds.has(cur)) cur = parentOf[cur];
    return cur !== undefined ? allNodes[cur] : null;
  }

  function diamondPoints(x, y, r) {
    return `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;
  }

  // ── Visible set: starts as L1–L4 ──────────────────────────────────────────
  const visibleIds = new Set(Object.values(allNodes).filter(n => n.level <= 4).map(n => n.id));

  // ── SVG setup ──────────────────────────────────────────────────────────────
  const w = window.innerWidth, h = window.innerHeight - TOP_BAR_H;
  const svg      = d3.select("#canvas").attr("width", w).attr("height", h);
  const labelSvg = d3.select("#label-layer").attr("width", w).attr("height", h);
  const g        = svg.append("g");
  const gLinks          = g.append("g").attr("class", "links");
  const gNodes          = g.append("g").attr("class", "nodes");
  const gExpand         = g.append("g").attr("class", "expanders");
  const gConnectors     = g.append("g").attr("class", "connectors");
  const gEmergentLinks  = g.append("g").attr("class", "emergent-links");
  const gEmergentNodes  = g.append("g").attr("class", "emergent-nodes");
  const gEmergentExpand = g.append("g").attr("class", "emergent-expanders");

  let currentTransform = d3.zoomIdentity;

  // ── 3-D tilt projection ────────────────────────────────────────────────────
  let tiltAngle = 0;
  function projectY(worldY, z) {
    return (worldY - h / 2) * Math.cos(tiltAngle) - z * Math.sin(tiltAngle) + h / 2;
  }

  const zoomBehaviour = d3.zoom()
    .scaleExtent([0.1, 5])
    .on("zoom", e => {
      g.attr("transform", e.transform);
      currentTransform = e.transform;
      updateLabels();
      repositionLabels();
      repositionEmergentLabels();
      const tiltDeg = Math.round((window.currentTilt || 0) * 180 / Math.PI);
      document.getElementById("zoom-level").textContent =
        tiltDeg > 0 ? `zoom: ${e.transform.k.toFixed(2)}  tilt: ${tiltDeg}°` : `zoom: ${e.transform.k.toFixed(2)}`;
    });
  svg.call(zoomBehaviour);

  // Zoom buttons
  document.getElementById("zoom-in").addEventListener("click", () => {
    svg.transition().duration(300).call(zoomBehaviour.scaleBy, 1.4);
  });
  document.getElementById("zoom-out").addEventListener("click", () => {
    svg.transition().duration(300).call(zoomBehaviour.scaleBy, 1 / 1.4);
  });

  // Home/reset zoom — centers map at scale=1 (continent-level overview)
  window.resetMapZoom = function () {
    svg.transition().duration(600).call(zoomBehaviour.transform, d3.zoomIdentity);
  };

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

  // ── Seed emergent node positions ──────────────────────────────────────────
  const eY = h / 2;
  const eL1 = Object.values(allEmergentNodes).filter(n => n.level === 1);
  eL1.forEach((n, i) => {
    const angle = (i / eL1.length) * 2 * Math.PI;
    n.x = w / 2 + Math.min(w, h) * 0.36 * Math.cos(angle);
    n.y = eY  + Math.min(w, h) * 0.10 * Math.sin(angle);
  });
  Object.values(allEmergentNodes).filter(n => n.level === 2).forEach(n => {
    const par = allEmergentNodes[emergentParentOf[n.id]];
    n.x = (par ? par.x : w / 2) + (Math.random() - 0.5) * 80;
    n.y = (par ? par.y : eY)    + (Math.random() - 0.5) * 80;
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
    .alphaDecay(simPreset.alphaDecay)
    .velocityDecay(simPreset.velocityDecay)
    .on("tick", ticked);

  // ── Emergent force simulation ──────────────────────────────────────────────
  const emergentNodeRadius = d => d.level === 1 ? 15 : 9;
  let simEmergentNodes = [], simEmergentEdges = [];
  let connector, emergentLink, emergentNode, emergentExpander, emergentLabel;
  let emergentLayerVisible = false;

  const simEmergent = d3.forceSimulation([])
    .force("link",    d3.forceLink([]).id(d => d.id).strength(0.5))
    .force("charge",  d3.forceManyBody().strength(d => d.level === 1 ? -1200 : -180).distanceMax(500))
    .force("collide", d3.forceCollide().radius(d => emergentNodeRadius(d) + 8).strength(0.9))
    .force("x",       d3.forceX(w / 2).strength(0.03))
    .force("y",       d3.forceY(eY).strength(0.18))
    .alphaDecay(0.04)
    .on("tick", tickedEmergent);

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
      .attr("font-size", 5)
      .attr("fill", "rgba(255,255,255,0.6)")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("pointer-events", "none")
      .style("user-select", "none")
      .merge(expander);

    label = labelSvg.selectAll(".base-label").data(simNodes, d => d.id);
    label.exit().remove();
    label = label.enter().append("text")
      .attr("class", "base-label")
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
      learnBtn.onclick = async function () {
        if (d.level !== 5) return;

        // Instant feedback — API can take several seconds on first visit
        const originalHTML = learnBtn.innerHTML;
        learnBtn.disabled = true;
        learnBtn.innerHTML =
          '<span style="opacity:0.75;font-size:12px">Creating your learning path</span>' +
          '<span class="sb-learn-dots">' +
          '<span class="sb-learn-dot"></span>' +
          '<span class="sb-learn-dot"></span>' +
          '<span class="sb-learn-dot"></span>' +
          '</span>';

        const restore = () => { learnBtn.innerHTML = originalHTML; learnBtn.disabled = false; };

        try {
          const r = await fetch(`/api/nodes/${d.id}/learn`, { method: 'POST' });
          const { knobits } = await r.json();
          restore();
          closeSidebar();
          window.Learn.open(d, crumb, knobits);
        } catch (err) {
          restore();
          closeSidebar();
          window.Learn.open(d, crumb, null);
        }
      };
    }

    sidebar.classList.add("open");

    // Load overview and knowledge asynchronously
    const sbOverview = document.querySelector('.sb-overview-text');
    const sbPct      = document.querySelector('.sb-pct');
    const sbBadge    = document.querySelector('.sb-knowledge-badge');
    const sbToggle   = document.querySelector('.sb-toggle');
    const learnBtnEl = document.querySelector('.sb-learn-btn');
    const nodeExtId  = d.id;

    // Inactive hint
    const inactiveHint = document.getElementById('sb-inactive-hint');
    if (inactiveHint) inactiveHint.classList.toggle('visible', d.level < 5);

    // Learn this — only active for L5 nodes
    if (learnBtnEl) {
      const learnLabel = learnBtnEl.querySelector('.sb-learn-label');
      if (learnLabel) learnLabel.textContent = 'Learn this';
      if (d.level === 5) {
        learnBtnEl.disabled = false;
        learnBtnEl.style.opacity = '';
        learnBtnEl.style.cursor = '';
        fetch(`/api/nodes/${nodeExtId}/learn-progress`)
          .then(r => r.json())
          .then(({ done, total }) => {
            if (done > 0 && done < total && learnLabel) {
              learnLabel.textContent = `Continue (${done}/${total})`;
            }
          }).catch(() => {});
      } else {
        learnBtnEl.disabled = true;
        learnBtnEl.style.opacity = '0.4';
        learnBtnEl.style.cursor = 'not-allowed';
      }
    }

    // Test me — active for L5 nodes
    const testBtnEl = document.querySelector('.sb-test-btn');
    if (testBtnEl) {
      if (d.level === 5) {
        testBtnEl.disabled = false;
        testBtnEl.style.opacity = '';
        testBtnEl.style.cursor = '';
        const testCrumb = (domainNode ? domainNode.label : '') +
          (crumbParts.length ? ' › ' + crumbParts.join(' › ') : '');
        testBtnEl.onclick = function () {
          closeSidebar();
          window.Test.open(d, testCrumb);
        };
      } else {
        testBtnEl.disabled = true;
        testBtnEl.style.opacity = '0.4';
        testBtnEl.style.cursor = 'not-allowed';
        testBtnEl.onclick = null;
      }
    }

    // Overview
    if (sbOverview) {
      sbOverview.textContent = 'Loading…';
      fetch(`/api/nodes/${nodeExtId}/overview`)
        .then(r => r.json())
        .then(({ overview }) => { if (sbOverview) sbOverview.textContent = overview || ''; })
        .catch(() => { if (sbOverview) sbOverview.textContent = ''; });
    }

    // Reset toggle to off immediately — correct state will be set by API response below
    if (sbToggle) {
      sbToggle.classList.remove('on');
      sbToggle.style.cursor = 'pointer';
    }

    // Knowledge %
    if (sbPct) {
      sbPct.textContent = '0%';
      if (sbBadge) sbBadge.textContent = '';
      fetch(`/api/nodes/${nodeExtId}/knowledge`)
        .then(r => r.json())
        .then(({ percentage, source }) => {
          if (!sbPct) return;
          sbPct.textContent = `${percentage}%`;
          if (sbBadge) {
            const sourceLabel = { tested: 'Tested', self_reported: 'Self-reported', estimated: 'Estimated' };
            sbBadge.textContent = sourceLabel[source] || '';
          }
          if (sbToggle) {
            // Show as 'on' only if self-reported 100%
            sbToggle.classList.toggle('on', percentage >= 100 && source === 'self_reported');
          }
        })
        .catch(() => {});
    }

    // I know this toggle — L4/L5 only, hidden entirely for L1–L3
    const toggleRow = document.querySelector('.sb-toggle-row');
    if (toggleRow) toggleRow.style.display = d.level >= 4 ? '' : 'none';
    if (sbToggle) {
      sbToggle.style.opacity = '';
      sbToggle.style.pointerEvents = '';
    }
    if (sbToggle && !sbToggle._wired) {
      sbToggle._wired = true;
      sbToggle.addEventListener('click', function () {
        const currentId = sidebar._currentNodeId;
        const currentNode = allNodes[currentId];
        if (!currentId) return;
        const isOn = sbToggle.classList.toggle('on');
        const pct  = isOn ? 100 : 0;
        // Server handles L4→L5 cascade internally
        fetch(`/api/nodes/${currentId}/knowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ percentage: pct, source: 'self_reported' }),
        }).then(r => r.json()).then(({ percentage }) => {
          if (sbPct) sbPct.textContent = `${percentage}%`;
          if (sbBadge) sbBadge.textContent = percentage >= 100 ? 'Self-reported' : '';
        }).catch(() => {});
      });
    }
    // Always update which node the toggle is acting on
    sidebar._currentNodeId = nodeExtId;
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebar.style.background = "";
  }

  // ── Click to highlight ─────────────────────────────────────────────────────
  let selected = null;

  function highlightAndOpen(d) {
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

  function onNodeClick(e, d) {
    e.stopPropagation();

    if (d.level === 4 && hasHiddenChildren(d.id)) {
      const wasSelected = (selected === d.id);
      toggleExpand(d);
      /* rebuild() recreates D3 elements; defer highlight+sidebar to next tick
         so the fresh node/link selections are fully settled before we touch them */
      setTimeout(function () {
        if (wasSelected) {
          resetHighlight();
          closeSidebar();
        } else {
          highlightAndOpen(d);
        }
      }, 0);
      return;
    }

    if (selected === d.id) {
      resetHighlight();
      closeSidebar();
      return;
    }

    highlightAndOpen(d);
  }

  function resetHighlight() {
    selected = null;
    refreshNodeColors();
  }

  svg.on("click", () => { resetHighlight(); closeSidebar(); });

  // ── Search ─────────────────────────────────────────────────────────────────
  const searchBox      = document.getElementById("search-box");
  const searchClear    = document.getElementById("search-clear");
  const searchDropdown = document.getElementById("search-dropdown");

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function closeDropdown() {
    if (searchDropdown) searchDropdown.classList.remove('visible');
  }

  function clearSearch() {
    searchBox.value = '';
    searchClear.style.display = 'none';
    closeDropdown();
    resetHighlight();
  }

  searchBox.addEventListener("input", function() {
    searchClear.style.display = this.value ? "flex" : "none";
    const q = this.value.trim().toLowerCase();
    if (!q) { resetHighlight(); closeDropdown(); return; }

    // Match against ALL nodes including hidden L5
    const allMatches = Object.values(allNodes).filter(n => n.label.toLowerCase().includes(q));

    // Highlight visible matches on map
    const visibleMatchIds = new Set(allMatches.filter(n => visibleIds.has(n.id)).map(n => n.id));
    if (node) node.attr("fill-opacity", n => visibleMatchIds.has(n.id) ? 1 : 0.06);
    if (link) link.attr("stroke-opacity", 0.03);

    // Dropdown for ≤5 matches
    if (searchDropdown) {
      if (allMatches.length > 0 && allMatches.length <= 5) {
        searchDropdown.innerHTML = allMatches.map(n =>
          `<div class="search-dropdown-item" data-node-id="${escHtml(n.id)}">
            <span class="search-dropdown-name">${escHtml(n.label)}</span>
            <span class="search-dropdown-domain">${escHtml(n.continent)}</span>
          </div>`
        ).join('');
        searchDropdown.classList.add('visible');
      } else {
        closeDropdown();
      }
    }
  });

  // Dropdown item click → navigate
  if (searchDropdown) {
    searchDropdown.addEventListener('click', function(e) {
      const item = e.target.closest('.search-dropdown-item');
      if (!item) return;
      clearSearch();
      navigateToNode(item.dataset.nodeId);
    });
  }

  // Keyboard navigation in dropdown + Enter on exact match
  let _dropdownIdx = -1;

  function _dropdownItems() {
    return searchDropdown ? Array.from(searchDropdown.querySelectorAll('.search-dropdown-item')) : [];
  }

  function _setDropdownActive(idx) {
    _dropdownItems().forEach(function(el, i) {
      el.classList.toggle('active', i === idx);
    });
    _dropdownIdx = idx;
  }

  searchBox.addEventListener("keydown", function(e) {
    const items = _dropdownItems();
    if (items.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const next = e.key === 'ArrowDown'
        ? Math.min(_dropdownIdx + 1, items.length - 1)
        : Math.max(_dropdownIdx - 1, 0);
      _setDropdownActive(next);
      return;
    }
    if (e.key === 'Escape') { closeDropdown(); _dropdownIdx = -1; return; }
    if (e.key !== 'Enter') return;

    // Enter on highlighted dropdown item
    if (_dropdownIdx >= 0 && items[_dropdownIdx]) {
      clearSearch(); _dropdownIdx = -1;
      navigateToNode(items[_dropdownIdx].dataset.nodeId);
      return;
    }
    // Enter on exact text match
    const q = this.value.trim().toLowerCase();
    const exact = Object.values(allNodes).find(n => n.label.toLowerCase() === q);
    if (exact) { clearSearch(); navigateToNode(exact.id); }
  });

  // Reset active index when dropdown content changes
  searchBox.addEventListener("input", function() { _dropdownIdx = -1; });

  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.topbar-search-wrap')) closeDropdown();
  });

  searchClear.addEventListener("click", function() {
    clearSearch();
    searchBox.focus();
  });

  // ── Tick ───────────────────────────────────────────────────────────────────
  const tt = document.getElementById("tooltip");

  function ticked() {
    if (link) link
      .attr("x1", d => d.source.x).attr("y1", d => projectY(d.source.y, 0))
      .attr("x2", d => d.target.x).attr("y2", d => projectY(d.target.y, 0));
    if (node) node.attr("cx", d => d.x).attr("cy", d => projectY(d.y, 0));
    if (expander) expander
      .attr("x", d => d.x)
      .attr("y", d => projectY(d.y, 0))
      .text(d => d.expanded ? "−" : "+");
    updateConnectorPositions();
    repositionLabels();
  }

  function updateConnectorPositions() {
    if (!connector) return;
    connector
      .attr("x1", d => allEmergentNodes[d.source] ? allEmergentNodes[d.source].x : 0)
      .attr("y1", d => allEmergentNodes[d.source] ? projectY(allEmergentNodes[d.source].y, LAYER_Z) : 0)
      .attr("x2", d => { const n = nearestVisibleBase(d.target); return n ? n.x : 0; })
      .attr("y2", d => { const n = nearestVisibleBase(d.target); return n ? projectY(n.y, 0) : 0; });
  }

  function repositionLabels() {
    if (!label) return;
    label
      .attr("x", d => currentTransform.applyX(d.x))
      .attr("y", d => currentTransform.applyY(projectY(d.y, 0)) - (NODE_OFFSET[d.level] || 10));
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
    if (localStorage.getItem('screensaver_enabled') !== 'false') {
      screensaverTimer = setTimeout(startScreensaver, IDLE_TIMEOUT);
    }
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

  function nodePassesActive(nodeId) {
    // Label-based curriculum filter
    if (activeFilterSet && !nodePassesFilter(nodeId)) return false;
    // ID-based knowledge filter
    if (knowledgeFilterIds && !knowledgeFilterIds.has(String(nodeId))) return false;
    return true;
  }

  function refreshNodeColors() {
    if (!node) return;
    node
      .attr('fill', d => nodePassesActive(d.id) ? d.color : '#585858')
      .attr('fill-opacity', d => {
        const base = d.level === 1 ? 1 : d.level === 2 ? 0.85 : 0.7;
        if (!nodePassesActive(d.id)) return 0.18;
        // Proportional opacity when My Knowledge filter is active
        if (knowledgePropMap) {
          const pct = knowledgePropMap[String(d.id)] || 0;
          // Scale: 0%→0.18 (dim), 1-99%→0.3–0.85, 100%→full
          if (pct <= 0) return 0.18;
          return Math.min(base, 0.25 + (pct / 100) * (base - 0.25));
        }
        return base;
      });
    if (!link) return;
    link
      .attr('stroke', d => {
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        if (!nodePassesActive(srcId) || !nodePassesActive(tgtId)) return '#585858';
        const src = allNodes[srcId];
        return src ? (CONTINENTS[src.continent] || '#444') : '#444';
      })
      .attr('stroke-opacity', d => {
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        if (!nodePassesActive(srcId) || !nodePassesActive(tgtId)) return 0.06;
        const src = allNodes[srcId];
        return src?.level === 1 ? 0.5 : src?.level === 2 ? 0.35 : src?.level === 3 ? 0.2 : 0.12;
      });
  }

  window.setMapFilter = function(labelSet) {
    activeFilterSet = labelSet;
    refreshNodeColors();
  };

  function applyProgressOverlay() {
    if (!node) return;
    node
      .attr('stroke', d => {
        const pct = progressMap[String(d.id)] || 0;
        if (pct >= 100) return '#8BAD7E';          // sage — fully known
        if (pct >= 50)  return '#C4A55A';           // amber — partially known
        return d.level <= 2 ? 'rgba(255,255,255,0.25)' : 'none';
      })
      .attr('stroke-width', d => {
        const pct = progressMap[String(d.id)] || 0;
        if (pct >= 100) return 2.5;
        if (pct >= 50)  return 1.5;
        return d.level <= 2 ? 0.5 : 0;
      });
  }

  window.refreshProgress = function() { loadProgress(); };

  // ── Emergent tick ─────────────────────────────────────────────────────────
  function tickedEmergent() {
    if (emergentNode) {
      emergentNode.attr("points", d => {
        const r = emergentNodeRadius(d) * 1.25;
        return diamondPoints(d.x, projectY(d.y, LAYER_Z), r);
      });
    }
    if (emergentLink) {
      emergentLink
        .attr("x1", d => (typeof d.source === 'object' ? d.source : allEmergentNodes[d.source])?.x || 0)
        .attr("y1", d => { const n = typeof d.source === 'object' ? d.source : allEmergentNodes[d.source]; return n ? projectY(n.y, LAYER_Z) : 0; })
        .attr("x2", d => (typeof d.target === 'object' ? d.target : allEmergentNodes[d.target])?.x || 0)
        .attr("y2", d => { const n = typeof d.target === 'object' ? d.target : allEmergentNodes[d.target]; return n ? projectY(n.y, LAYER_Z) : 0; });
    }
    if (emergentExpander) {
      emergentExpander
        .attr("x", d => d.x)
        .attr("y", d => projectY(d.y, LAYER_Z))
        .text(d => d.expanded ? "−" : "+");
    }
    updateConnectorPositions();
    repositionEmergentLabels();
  }

  // ── Emergent rebuild ───────────────────────────────────────────────────────
  function rebuildEmergent() {
    simEmergentNodes = Array.from(visibleEmergentIds).map(id => allEmergentNodes[id]);
    simEmergentEdges = emergentData.edges
      .filter(e => e.edge_type === 'hierarchical' &&
                   visibleEmergentIds.has(e.source) && visibleEmergentIds.has(e.target))
      .map(e => ({ source: e.source, target: e.target }));

    const connectorData = drawsFromEdges.filter(e => visibleEmergentIds.has(e.source));

    connector = gConnectors.selectAll("line").data(connectorData, d => `${d.source}-${d.target}`);
    connector.exit().remove();
    connector = connector.enter().append("line")
      .attr("class", "connector-line")
      .attr("stroke", "#5ADCFF")
      .attr("stroke-width", 0.9)
      .attr("stroke-dasharray", "4 3")
      .merge(connector);

    emergentLink = gEmergentLinks.selectAll("line").data(simEmergentEdges, d => `${d.source}-${d.target}`);
    emergentLink.exit().remove();
    emergentLink = emergentLink.enter().append("line")
      .attr("stroke", E_COLOR_L1)
      .attr("stroke-opacity", 0.55)
      .attr("stroke-width", 1.2)
      .merge(emergentLink);

    emergentNode = gEmergentNodes.selectAll("polygon").data(simEmergentNodes, d => d.id);
    emergentNode.exit().remove();
    emergentNode = emergentNode.enter().append("polygon")
      .attr("fill", d => d.color)
      .attr("fill-opacity", d => d.level === 1 ? 0.92 : 0.78)
      .attr("stroke", "rgba(255,230,140,0.55)")
      .attr("stroke-width", d => d.level === 1 ? 1.5 : 0.8)
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) simEmergent.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end",   (e, d) => { if (!e.active) simEmergent.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on("mouseover", (e, d) => {
        tt.style.display = "block";
        tt.innerHTML = `<strong style="color:${d.color}">${d.label}</strong><br><span style="color:#888;font-size:11px">Emergent field · Layer 2</span>`;
      })
      .on("mousemove", e => { tt.style.left = (e.clientX + 14) + "px"; tt.style.top = (e.clientY - 10) + "px"; })
      .on("mouseout",  () => { tt.style.display = "none"; })
      .on("click", onEmergentNodeClick)
      .merge(emergentNode);

    const expandableE = simEmergentNodes.filter(n => n.level === 1 && (emergentChildrenOf[n.id] || []).length > 0);
    emergentExpander = gEmergentExpand.selectAll("text").data(expandableE, d => d.id);
    emergentExpander.exit().remove();
    emergentExpander = emergentExpander.enter().append("text")
      .attr("font-size", 6)
      .attr("fill", "rgba(255,255,255,0.7)")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("pointer-events", "none")
      .style("user-select", "none")
      .merge(emergentExpander);

    emergentLabel = labelSvg.selectAll(".emergent-label").data(simEmergentNodes, d => d.id);
    emergentLabel.exit().remove();
    emergentLabel = emergentLabel.enter().append("text")
      .attr("class", "emergent-label")
      .text(d => d.label)
      .attr("font-size",   d => d.level === 1 ? 12 : 10)
      .attr("font-weight", d => d.level === 1 ? 600 : 400)
      .attr("fill", d => d.color)
      .attr("text-anchor", "middle")
      .attr("opacity", 1)
      .style("pointer-events", "none")
      .style("user-select", "none")
      .merge(emergentLabel);

    simEmergent.nodes(simEmergentNodes);
    simEmergent.force("link").links(simEmergentEdges);
    simEmergent.alpha(0.4).restart();
    repositionEmergentLabels();

    // Enforce current visibility state
    const eVis = emergentLayerVisible ? null : "none";
    gConnectors.style("display", eVis);
    gEmergentLinks.style("display", eVis);
    gEmergentNodes.style("display", eVis);
    gEmergentExpand.style("display", eVis);
    if (emergentLabel) emergentLabel.style("display", eVis);
  }

  function repositionEmergentLabels() {
    if (!emergentLabel) return;
    emergentLabel
      .attr("x", d => currentTransform.applyX(d.x))
      .attr("y", d => currentTransform.applyY(projectY(d.y, LAYER_Z)) - (d.level === 1 ? 24 : 16));
  }

  // ── Emergent expand / collapse ─────────────────────────────────────────────
  function toggleExpandEmergent(d) {
    const kids = emergentChildrenOf[d.id] || [];
    if (!d.expanded) {
      kids.forEach(cid => {
        visibleEmergentIds.add(cid);
        allEmergentNodes[cid].x = d.x + (Math.random() - 0.5) * 60;
        allEmergentNodes[cid].y = d.y + (Math.random() - 0.5) * 60;
      });
      d.expanded = true;
    } else {
      kids.forEach(cid => {
        visibleEmergentIds.delete(cid);
        allEmergentNodes[cid].expanded = false;
      });
      d.expanded = false;
    }
    rebuildEmergent();
  }

  function onEmergentNodeClick(e, d) {
    e.stopPropagation();
    if (d.level === 1 && (emergentChildrenOf[d.id] || []).length > 0) {
      toggleExpandEmergent(d);
    }
  }

  // ── Layer visibility API (called by layers.js) ────────────────────────────
  window.setLayerVisible = function (layerId, visible) {
    const vis = visible ? null : "none";
    if (layerId === 'emergent') {
      emergentLayerVisible = visible;
      gConnectors.style("display", vis);
      gEmergentLinks.style("display", vis);
      gEmergentNodes.style("display", vis);
      gEmergentExpand.style("display", vis);
      labelSvg.selectAll(".emergent-label").style("display", vis);
    } else if (layerId === 'base') {
      gLinks.style("display", vis);
      gNodes.style("display", vis);
      gExpand.style("display", vis);
      labelSvg.selectAll(".base-label").style("display", vis);
    }
  };

  // ── Knowledge ID filter (called by filters.js for "My Knowledge") ───────────
  // Uses node external IDs directly — avoids the label-based filter's tendency
  // to light up entire domains. Only colors the exact known nodes plus the
  // specific ancestor PATH (not siblings at each level).
  let knowledgeFilterIds = null;   // Set<externalId> | null
  let knowledgePropMap   = null;   // {externalId: 0-100} — proportional % per node

  // Proportional knowledge % per node: fraction of L5 descendants that are known.
  // Memoised bottom-up pass — O(n) total.
  function computeProportionalKnowledge(progressMap) {
    const cache = {};  // id → [knownFraction, totalL5Count]

    function stats(id) {
      if (cache[id]) return cache[id];
      const n = allNodes[id];
      if (!n) return (cache[id] = [0, 0]);
      if (progressMap[String(id)] !== undefined) {
        const pct = (progressMap[String(id)] || 0) / 100;
        return (cache[id] = [pct, 1]);
      }
      if (n.level === 5) return (cache[id] = [0, 1]);
      const kids = childrenOf[id] || [];
      let kSum = 0, tSum = 0;
      kids.forEach(cid => {
        const [k, t] = stats(cid);
        kSum += k; tSum += t;
      });
      return (cache[id] = [kSum, tSum]);
    }

    const result = {};
    Object.keys(allNodes).forEach(id => {
      const [k, t] = stats(id);
      result[id] = t > 0 ? Math.round((k / t) * 100) : 0;
    });
    return result;
  }

  window.setKnowledgeFilter = function (progressMap, threshold) {
    // Compute proportional knowledge for every node
    const propMap = computeProportionalKnowledge(progressMap);

    // Include nodes with at least 1% proportional knowledge (any source)
    knowledgeFilterIds = new Set(
      Object.entries(propMap)
        .filter(([, pct]) => pct > 0)
        .map(([id]) => String(id))
    );
    // Store proportional percentages for use in refreshNodeColors
    knowledgePropMap = propMap;

    refreshNodeColors();
  };

  window.clearKnowledgeFilter = function () {
    knowledgeFilterIds = null;
    knowledgePropMap   = null;
    refreshNodeColors();
  };

  // ── Tilt API (called by tilt.js) ──────────────────────────────────────────
  window.setTilt = function (angle) {
    tiltAngle = angle;
    window.currentTilt = angle;
    ticked();
    tickedEmergent();
  };
  window.currentTilt = 0;

  // ── Public MapView namespace (avoid 'Map' — that's a JS built-in) ────────────
  window.MapView = {
    setFilter:            function(labelSet) { window.setMapFilter(labelSet); },
    setKnowledgeFilter:   function(pm, t)   { window.setKnowledgeFilter(pm, t); },
    clearKnowledgeFilter: function()         { window.clearKnowledgeFilter(); },
    resetZoom:            function()         { window.resetMapZoom(); },
    refreshProgress:      function()         { loadProgress(); },
    setTilt:              function(angle)    { window.setTilt(angle); },
    openDemoNode:         function()         {
      var target = simNodes.find(function(n) { return n.level === 4 && n.x; });
      if (!target) return;
      var cw = window.innerWidth, ch = window.innerHeight - TOP_BAR_H;
      var z  = 4.5;
      svg.transition().duration(600).ease(d3.easeCubicOut)
        .call(zoomBehaviour.transform,
          d3.zoomIdentity.translate(cw/2 - target.x*z, ch/2 - target.y*z).scale(z));
      highlightAndOpen(target);
    },
    closeSidebar:         function()         { closeSidebar(); resetHighlight(); },
  };
  // Keep legacy aliases so filters.js / tilt.js / HTML inline calls still work
  window.refreshProgress = window.MapView.refreshProgress;

  // ── Node navigation (shared by deep-link and search) ─────────────────────
  function navigateToNode(nodeId) {
    function zoomAndOpen() {
      const t = allNodes[nodeId];
      if (!t || !t.x) return;
      const cw = window.innerWidth, ch = window.innerHeight - TOP_BAR_H;
      const z  = 3.5;
      svg.transition().duration(800).ease(d3.easeCubicOut)
        .call(zoomBehaviour.transform,
          d3.zoomIdentity.translate(cw / 2 - t.x * z, ch / 2 - t.y * z).scale(z))
        .on('end', function () { highlightAndOpen(t); });
    }
    const target = allNodes[nodeId];
    if (!target) return;
    if (target.level === 5) {
      const parentId = parentOf[nodeId];
      if (parentId && allNodes[parentId] && !allNodes[parentId].expanded) {
        toggleExpand(allNodes[parentId]);
        setTimeout(zoomAndOpen, 150);
        return;
      }
    }
    zoomAndOpen();
  }

  // ── Deep-link navigation (?node=external_id) ──────────────────────────────
  (function () {
    const targetId = new URLSearchParams(window.location.search).get('node');
    if (!targetId) return;
    history.replaceState(null, '', window.location.pathname);
    setTimeout(function () { navigateToNode(targetId); }, 1600);
  }());

  // ── Continue chip ──────────────────────────────────────────────────────────
  (function () {
    const chip        = document.getElementById('continue-chip');
    const topicEl     = document.getElementById('continue-chip-topic');
    const progressEl  = document.getElementById('continue-chip-progress');
    const toggleBtn   = document.getElementById('continue-chip-toggle');
    if (!chip) return;

    fetch('/api/learn/resume')
      .then(r => r.json())
      .then(({ nodeId, label, done, total }) => {
        if (!nodeId) return;
        topicEl.textContent    = label;
        progressEl.textContent = `${done}/${total}`;
        chip.classList.add('visible');

        // Click chip body → open learning mode
        chip.addEventListener('click', function (e) {
          if (e.target.closest('.continue-chip-toggle')) return;
          if (chip.classList.contains('collapsed')) {
            chip.classList.remove('collapsed');
            return;
          }
          const node = allNodes[nodeId];
          if (!node) return;
          const crumb = (function () {
            const chain = [];
            let cur = nodeId;
            while (parentOf[cur] !== undefined) { cur = parentOf[cur]; chain.unshift(allNodes[cur]); }
            const domain = chain[0];
            const mid    = chain.slice(1).map(n => n.label);
            return (domain ? domain.label : '') + (mid.length ? ' › ' + mid.join(' › ') : '');
          }());
          fetch(`/api/nodes/${nodeId}/learn`, { method: 'POST' })
            .then(r => r.json())
            .then(({ knobits }) => { window.Learn.open(node, crumb, knobits); })
            .catch(() => { window.Learn.open(node, crumb, null); });
        });

        // Collapse toggle
        toggleBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          const collapsed = chip.classList.toggle('collapsed');
          const chevron   = toggleBtn.querySelector('path');
          if (chevron) chevron.setAttribute('d', collapsed ? 'M3.5 2l3.5 3-3.5 3' : 'M6.5 2L3 5l3.5 3');
        });
      }).catch(() => {});
  }());

  // ── Initial build ──────────────────────────────────────────────────────────
  rebuild();
  rebuildEmergent();
  setTimeout(loadProgress, 800);  // load after D3 settles
}

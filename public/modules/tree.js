// modules/tree.js
let svg, zoomLayer, content, zoom, tooltip;

export function initTree(selector) {
  svg = d3.select(selector);
  zoomLayer = svg.append("g");
  content = zoomLayer.append("g");
  zoom = d3.zoom().scaleExtent([0.3, 3]).on("zoom", (e) => zoomLayer.attr("transform", e.transform));
  svg.call(zoom);

  // فلتر الـ glow
  const defs = svg.append("defs");
  const filter = defs.append("filter").attr("id", "glow");
  filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
  const feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // Tooltip عائم
  tooltip = d3.select("body").append("div")
    .attr("id", "tree-tooltip")
    .style("position", "fixed")
    .style("background", "rgba(15,17,23,0.95)")
    .style("border", "1px solid #c8a96e")
    .style("border-radius", "10px")
    .style("padding", "10px 14px")
    .style("color", "#c8a96e")
    .style("font-family", "'DM Sans', system-ui, sans-serif")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("opacity", "0")
    .style("transition", "opacity 0.2s ease")
    .style("z-index", "9999")
    .style("max-width", "200px")
    .style("line-height", "1.6")
    .style("direction", "rtl")
    .style("text-align", "right");
}

// 30 لوناً لكل جيل
const palette = [
  { fill: "#c8a96e", stroke: "#e8d48e", text: "#0f1117" },
  { fill: "#1a3a2a", stroke: "#4caf80", text: "#7dd4a8" },
  { fill: "#1a2a3a", stroke: "#4a8fc8", text: "#88c0e8" },
  { fill: "#2a1a3a", stroke: "#9b6ec8", text: "#c0a0e8" },
  { fill: "#3a2a1a", stroke: "#c8896e", text: "#e8b898" },
  { fill: "#1a3a3a", stroke: "#4ac8c0", text: "#88e0d8" },
  { fill: "#3a1a2a", stroke: "#c84a8f", text: "#e888c0" },
  { fill: "#2a3a1a", stroke: "#8fc84a", text: "#c0e088" },
  { fill: "#3a1a1a", stroke: "#c84a4a", text: "#e88888" },
  { fill: "#1a1a3a", stroke: "#4a4ac8", text: "#8888e8" },
  { fill: "#2a3a2e", stroke: "#5ac890", text: "#90e0b8" },
  { fill: "#3a2e1a", stroke: "#c8a04a", text: "#e8c888" },
  { fill: "#1e2a3a", stroke: "#4a70c8", text: "#88a8e8" },
  { fill: "#2e1a3a", stroke: "#804ac8", text: "#b888e8" },
  { fill: "#1a2e2a", stroke: "#4ab8a0", text: "#88d8c8" },
  { fill: "#3a2a2e", stroke: "#c86890", text: "#e8a0c0" },
  { fill: "#2e3a1a", stroke: "#90b84a", text: "#c0d888" },
  { fill: "#3a1e2a", stroke: "#c84a70", text: "#e888a8" },
  { fill: "#1a3a2e", stroke: "#4ac8a0", text: "#88e0c0" },
  { fill: "#2a1e3a", stroke: "#704ac8", text: "#a888e8" },
  { fill: "#3a2e2a", stroke: "#c89070", text: "#e8c0a0" },
  { fill: "#1a2e3a", stroke: "#4a90b8", text: "#88c8e0" },
  { fill: "#2e2a1a", stroke: "#b8904a", text: "#d8c080" },
  { fill: "#1e3a2a", stroke: "#5ab870", text: "#90d8a0" },
  { fill: "#3a1a2e", stroke: "#c84a90", text: "#e888c8" },
  { fill: "#2a3a3a", stroke: "#4ac8c8", text: "#88e0e0" },
  { fill: "#3a3a1a", stroke: "#c8c84a", text: "#e8e088" },
  { fill: "#1a3a1e", stroke: "#4ac858", text: "#88e098" },
  { fill: "#2e1a1a", stroke: "#c85a4a", text: "#e89888" },
  { fill: "#1a1e3a", stroke: "#4a58c8", text: "#8898e8" },
];

const getP = (depth) => palette[depth % palette.length];

let rootData = null;
let initialized = false;

// طي كل العقد التي عمقها >= المستوى المحدد
function collapseFromDepth(node, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth && node.children && node.children.length > 0) {
    node._collapsed = true;
  } else {
    node._collapsed = false;
  }
  (node.children || []).forEach(child => collapseFromDepth(child, maxDepth, currentDepth + 1));
}

// هل يوجد مؤسس في أبناء هذه العقدة
function hasFounderDescendant(node) {
  if (node.isFounder) return true;
  return (node.children || []).some(hasFounderDescendant);
}

export function renderTree(data) {
  if (!svg) initTree("#svg");
  rootData = data;

  // عند أول تحميل فقط: طي من المستوى 3 فما فوق
  if (!initialized) {
    collapseFromDepth(rootData, 3);
    initialized = true;
  }

  _render(data);
}

function _render(data) {
  content.selectAll("*").remove();

  const root = d3.hierarchy(data, d => d._collapsed ? null : d.children);

  const { width, height } = svg.node().getBoundingClientRect();
  const nodeWidth  = 160;
  const nodeHeight = 140;
  const treeWidth  = Math.max(root.leaves().length * nodeWidth, width - 40);
  const treeHeight = Math.max((root.height + 1) * nodeHeight, height - 40);

  const treeLayout = d3.tree().size([treeWidth, treeHeight]);
  treeLayout(root);

  // الخطوط
  content.selectAll(".link")
    .data(root.links())
    .join("path")
    .attr("class", "link")
    .attr("d", d3.linkVertical().x(d => d.x).y(d => d.y))
    .attr("fill", "none")
    .attr("stroke", d => getP(d.source.depth).stroke)
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.75);

  const node = content.selectAll(".node")
    .data(root.descendants())
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.x},${d.y})`)
    .style("cursor", d => (d.data.children && d.data.children.length > 0) ? "pointer" : "default")
    .on("click", (event, d) => {
      if (!d.data.children || d.data.children.length === 0) return;
      d.data._collapsed = !d.data._collapsed;
      _render(rootData);
    })
    // Tooltip للمؤسس
    .on("mouseover", function(event, d) {
      const isFounderBranch = d.data.isFounder || hasFounderDescendant(d.data);
      if (!isFounderBranch) return;

      let msg = "";
      if (d.data.isFounder) {
        msg = `💻 مؤسس الصفحة<br/>هذا الشخص أنشأ وبنى شجرة العائلة`;
      } else if (d.data._collapsed && hasFounderDescendant(d.data)) {
        msg = `💻 يوجد مؤسس الصفحة<br/>في هذا الفرع المطوي`;
      } else {
        msg = `💻 فرع يحتوي على<br/>مؤسس الصفحة`;
      }

      tooltip
        .html(msg)
        .style("opacity", "1")
        .style("left", (event.clientX + 14) + "px")
        .style("top", (event.clientY - 10) + "px");
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", (event.clientX + 14) + "px")
        .style("top", (event.clientY - 10) + "px");
    })
    .on("mouseout", function() {
      tooltip.style("opacity", "0");
    });

  // ---- الجذر ----
  node.filter(d => d.depth === 0).each(function(d) {
    const g = d3.select(this);
    g.append("rect")
      .attr("x", -66).attr("y", -26).attr("width", 132).attr("height", 52)
      .attr("rx", 26).attr("ry", 26)
      .attr("fill", "rgba(200,169,110,0.15)")
      .attr("stroke", "rgba(200,169,110,0.4)")
      .attr("stroke-width", 1);
    g.append("rect")
      .attr("x", -60).attr("y", -22).attr("width", 120).attr("height", 44)
      .attr("rx", 22).attr("ry", 22)
      .attr("fill", "#c8a96e")
      .attr("stroke", "#e8d48e")
      .attr("stroke-width", 2.5);
    g.append("text")
      .attr("dy", 6).attr("text-anchor", "middle")
      .attr("font-family", "'DM Sans', system-ui, sans-serif")
      .attr("font-size", "15px").attr("font-weight", "700")
      .attr("fill", "#0f1117")
      .text(d.data.name);
    _addCollapseIndicator(g, d);
  });

  // ---- المؤسس ----
  node.filter(d => d.depth !== 0 && d.data.isFounder === true).each(function(d) {
    const g = d3.select(this);
    const p = getP(d.depth);
    g.append("rect")
      .attr("x", -72).attr("y", -30).attr("width", 144).attr("height", 60)
      .attr("rx", 30).attr("ry", 30)
      .attr("fill", "none")
      .attr("stroke", "rgba(200,169,110,0.25)")
      .attr("stroke-width", 8)
      .attr("filter", "url(#glow)");
    g.append("rect")
      .attr("x", -66).attr("y", -26).attr("width", 132).attr("height", 52)
      .attr("rx", 26).attr("ry", 26)
      .attr("fill", "none")
      .attr("stroke", "#c8a96e")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "5,3");
    g.append("rect")
      .attr("x", -60).attr("y", -20).attr("width", 120).attr("height", 40)
      .attr("rx", 18).attr("ry", 18)
      .attr("fill", p.fill)
      .attr("stroke", "#c8a96e")
      .attr("stroke-width", 2.5);
    g.append("text")
      .attr("x", -40).attr("dy", 6)
      .attr("text-anchor", "middle").attr("font-size", "13px").text("💻");
    g.append("text")
      .attr("x", 12).attr("dy", 6).attr("text-anchor", "middle")
      .attr("font-family", "'DM Sans', system-ui, sans-serif")
      .attr("font-size", "13px").attr("font-weight", "700")
      .attr("fill", p.text).text(d.data.name);
    _addCollapseIndicator(g, d);
  });

  // ---- بقية العقد ----
  node.filter(d => d.depth !== 0 && !d.data.isFounder).each(function(d) {
    const g = d3.select(this);
    const p = getP(d.depth);

    // إطار ذهبي خفيف إذا كان الفرع يحتوي مؤسساً ومطوياً
    const hiddenFounder = d.data._collapsed && hasFounderDescendant(d.data);
    if (hiddenFounder) {
      g.append("rect")
        .attr("x", -63).attr("y", -23).attr("width", 126).attr("height", 46)
        .attr("rx", 21).attr("ry", 21)
        .attr("fill", "none")
        .attr("stroke", "#c8a96e")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
        .attr("opacity", 0.5);
    }

    g.append("rect")
      .attr("x", -60).attr("y", -20).attr("width", 120).attr("height", 40)
      .attr("rx", 18).attr("ry", 18)
      .attr("fill", p.fill)
      .attr("stroke", hiddenFounder ? "#c8a96e" : p.stroke)
      .attr("stroke-width", hiddenFounder ? 2 : 1.5);
    g.append("text")
      .attr("dy", 6).attr("text-anchor", "middle")
      .attr("font-family", "'DM Sans', system-ui, sans-serif")
      .attr("font-size", "13px").attr("font-weight", "600")
      .attr("fill", p.text).text(d.data.name);
    _addCollapseIndicator(g, d);
  });

  // Auto-Fit
  const b = content.node().getBBox();
  if (b.width && b.height) {
    const W = svg.node().clientWidth, H = svg.node().clientHeight;
    const scale = Math.max(0.3, Math.min(1.0, 0.85 * Math.min(W / b.width, H / b.height)));
    const t = d3.zoomIdentity
      .translate(W / 2 - scale * (b.x + b.width / 2), H / 2 - scale * (b.y + b.height / 2))
      .scale(scale);
    svg.transition().duration(300).call(zoom.transform, t);
  }
}

function _addCollapseIndicator(g, d) {
  if (!d.data.children || d.data.children.length === 0) return;
  const count = d.data.children.length;
  const collapsed = d.data._collapsed;

  g.append("circle")
    .attr("cx", 0).attr("cy", 26)
    .attr("r", 10)
    .attr("fill", collapsed ? "#c8a96e" : "rgba(255,255,255,0.08)")
    .attr("stroke", "#c8a96e")
    .attr("stroke-width", 1.5);

  g.append("text")
    .attr("x", 0).attr("y", 30)
    .attr("text-anchor", "middle")
    .attr("font-size", collapsed ? "9px" : "10px")
    .attr("font-weight", "700")
    .attr("fill", collapsed ? "#0f1117" : "#c8a96e")
    .text(collapsed ? count : "−");
}

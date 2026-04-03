// modules/tree.js
let svg, zoomLayer, content, zoom;

export function initTree(selector) {
  svg = d3.select(selector);
  zoomLayer = svg.append("g");
  content = zoomLayer.append("g");
  zoom = d3.zoom().scaleExtent([0.4, 2.5]).on("zoom", (e) => zoomLayer.attr("transform", e.transform));
  svg.call(zoom);
}

export function renderTree(data) {
  if (!svg) initTree("#svg");
  content.selectAll("*").remove();

  const root = d3.hierarchy(data);
  const { width, height } = svg.node().getBoundingClientRect();
  const treeLayout = d3.tree().size([Math.max(800, width - 200), Math.max(600, height - 200)]);
  treeLayout(root);

  // ألوان واضحة لكل جيل — 8 مستويات
  const palette = [
    { fill: "#c8a96e", stroke: "#e8c97e", text: "#0f1117" }, // 0 — جذر ذهبي
    { fill: "#1a3a2a", stroke: "#4caf80", text: "#7dd4a8" }, // 1 — أخضر غامق
    { fill: "#1a2a3a", stroke: "#4a8fc8", text: "#88c0e8" }, // 2 — أزرق غامق
    { fill: "#2a1a3a", stroke: "#9b6ec8", text: "#c0a0e8" }, // 3 — بنفسجي
    { fill: "#3a2a1a", stroke: "#c8896e", text: "#e8b898" }, // 4 — برتقالي
    { fill: "#1a3a3a", stroke: "#4ac8c0", text: "#88e0d8" }, // 5 — فيروزي
    { fill: "#3a1a2a", stroke: "#c84a8f", text: "#e888c0" }, // 6 — وردي
    { fill: "#2a3a1a", stroke: "#8fc84a", text: "#c0e088" }, // 7 — أخضر فاتح
  ];

  const getP = (depth) => palette[Math.min(depth, palette.length - 1)];

  // الخطوط
  content.selectAll(".link")
    .data(root.links())
    .join("path")
    .attr("class", "link")
    .attr("d", d3.linkVertical().x(d => d.x).y(d => d.y))
    .attr("fill", "none")
    .attr("stroke", d => getP(d.source.depth).stroke)
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.35);

  const node = content.selectAll(".node")
    .data(root.descendants())
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.x},${d.y})`);

  // ---- الجذر: تاج خاص ----
  node.filter(d => d.depth === 0).each(function(d) {
    const g = d3.select(this);
    g.append("rect")
      .attr("x", -70).attr("y", -28).attr("width", 140).attr("height", 56)
      .attr("rx", 28).attr("ry", 28)
      .attr("fill", "rgba(200,169,110,0.12)")
      .attr("stroke", "rgba(200,169,110,0.3)")
      .attr("stroke-width", 1);
    g.append("rect")
      .attr("x", -62).attr("y", -22).attr("width", 124).attr("height", 44)
      .attr("rx", 22).attr("ry", 22)
      .attr("fill", "#c8a96e")
      .attr("stroke", "#e8d48e")
      .attr("stroke-width", 2);
    g.append("text")
      .attr("x", -46).attr("dy", 6)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .text("👑");
    g.append("text")
      .attr("x", 10).attr("dy", 6)
      .attr("text-anchor", "middle")
      .attr("font-family", "'DM Sans', system-ui, sans-serif")
      .attr("font-size", "14px")
      .attr("font-weight", "700")
      .attr("fill", "#0f1117")
      .text(d.data.name);
  });

  // ---- المؤسس (المبرمج): إطار خاص ----
  node.filter(d => d.depth !== 0 && d.data.isFounder === true).each(function(d) {
    const g = d3.select(this);
    const p = getP(d.depth);
    g.append("rect")
      .attr("x", -68).attr("y", -26).attr("width", 136).attr("height", 52)
      .attr("rx", 26).attr("ry", 26)
      .attr("fill", "none")
      .attr("stroke", "#c8a96e")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,3")
      .attr("opacity", 0.7);
    g.append("rect")
      .attr("x", -60).attr("y", -20).attr("width", 120).attr("height", 40)
      .attr("rx", 18).attr("ry", 18)
      .attr("fill", p.fill)
      .attr("stroke", "#c8a96e")
      .attr("stroke-width", 2);
    g.append("text")
      .attr("x", -44).attr("dy", 6)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .text("💻");
    g.append("text")
      .attr("x", 10).attr("dy", 6)
      .attr("text-anchor", "middle")
      .attr("font-family", "'DM Sans', system-ui, sans-serif")
      .attr("font-size", "13px")
      .attr("font-weight", "700")
      .attr("fill", p.text)
      .text(d.data.name);
  });

  // ---- بقية العقد ----
  node.filter(d => d.depth !== 0 && !d.data.isFounder).each(function(d) {
    const g = d3.select(this);
    const p = getP(d.depth);
    g.append("rect")
      .attr("x", -60).attr("y", -20).attr("width", 120).attr("height", 40)
      .attr("rx", 18).attr("ry", 18)
      .attr("fill", p.fill)
      .attr("stroke", p.stroke)
      .attr("stroke-width", 1.5);
    g.append("text")
      .attr("dy", 6)
      .attr("text-anchor", "middle")
      .attr("font-family", "'DM Sans', system-ui, sans-serif")
      .attr("font-size", "13px")
      .attr("font-weight", "600")
      .attr("fill", p.text)
      .text(d.data.name);
  });

  // Auto-Fit
  const b = content.node().getBBox();
  if (b.width && b.height) {
    const W = svg.node().clientWidth, H = svg.node().clientHeight;
    const scale = Math.max(0.5, Math.min(1.1, 0.9 * Math.min(W / b.width, H / b.height)));
    const t = d3.zoomIdentity
      .translate(W / 2 - scale * (b.x + b.width / 2), H / 2 - scale * (b.y + b.height / 2))
      .scale(scale);
    svg.transition().duration(350).call(zoom.transform, t);
  }
}

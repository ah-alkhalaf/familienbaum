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

  // Farben pro Tiefe — passend zum Dark Mode
  const colors = {
    fill: [
      "#c8a96e",           // 0: Root — Gold
      "#2a3a2e",           // 1: Ebene 1 — dunkles Grün
      "#1e2d3d",           // 2: Ebene 2 — dunkles Blau
      "#2d1e3d",           // 3: Ebene 3 — dunkles Lila
      "#3d2a1e",           // 4: Ebene 4 — dunkles Braun
    ],
    stroke: [
      "#d4b87a",           // 0: Root
      "#4caf80",           // 1
      "#4a8fc8",           // 2
      "#9b6ec8",           // 3
      "#c8896e",           // 4
    ],
    text: [
      "#0f1117",           // 0: Root — dunkel auf Gold
      "#a0d4b0",           // 1
      "#88b8e8",           // 2
      "#c0a0e8",           // 3
      "#e8b8a0",           // 4
    ]
  };

  const getColor = (arr, depth) => arr[Math.min(depth, arr.length - 1)];

  // Links
  content.selectAll(".link")
    .data(root.links())
    .join("path")
    .attr("class", "link")
    .attr("d", d3.linkVertical().x(d => d.x).y(d => d.y))
    .attr("fill", "none")
    .attr("stroke", "rgba(200,169,110,0.3)")
    .attr("stroke-width", 1.5);

  // Nodes
  const node = content.selectAll(".node")
    .data(root.descendants())
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.x},${d.y})`);

  // Glow-Effekt für Root
  node.filter(d => d.depth === 0)
    .append("rect")
    .attr("x", -64).attr("y", -24).attr("width", 128).attr("height", 48)
    .attr("rx", 22).attr("ry", 22)
    .attr("fill", "rgba(200,169,110,0.15)")
    .attr("stroke", "none");

  node.append("rect")
    .attr("x", -60).attr("y", -20).attr("width", 120).attr("height", 40)
    .attr("rx", 18).attr("ry", 18)
    .attr("fill", d => getColor(colors.fill, d.depth))
    .attr("stroke", d => getColor(colors.stroke, d.depth))
    .attr("stroke-width", 1.5);

  node.append("text")
    .attr("dy", 5)
    .attr("text-anchor", "middle")
    .attr("font-family", "'DM Sans', system-ui, sans-serif")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .attr("fill", d => getColor(colors.text, d.depth))
    .text(d => d.data.name);

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

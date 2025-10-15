// modules/tree.js
let svg, zoomLayer, content, zoom;

export function initTree(selector) {
  svg = d3.select(selector);
  zoomLayer = svg.append("g");
  content = zoomLayer.append("g");

  zoom = d3.zoom().scaleExtent([0.4, 2.5]).on("zoom", (e)=> zoomLayer.attr("transform", e.transform));
  svg.call(zoom);
}

export function renderTree(data) {
  if (!svg) initTree("#svg");
  content.selectAll("*").remove();

  const root = d3.hierarchy(data);
  const { width, height } = svg.node().getBoundingClientRect();
  const treeLayout = d3.tree().size([Math.max(800, width-200), Math.max(600, height-200)]);
  treeLayout(root);

  content.selectAll(".link")
    .data(root.links())
    .join("path")
    .attr("class", "link")
    .attr("d", d3.linkVertical().x(d=>d.x).y(d=>d.y))
    .attr("fill","none")
    .attr("stroke","#6b4226")
    .attr("stroke-width",2);

  const node = content.selectAll(".node")
    .data(root.descendants())
    .join("g")
    .attr("class","node")
    .attr("transform", d=>`translate(${d.x},${d.y})`);

  node.append("rect")
    .attr("x",-60).attr("y",-20).attr("width",120).attr("height",40)
    .attr("rx",18).attr("ry",18)
    .attr("fill", d => {
      if (d.depth === 0) return "#2e7d32"; // Root
      if (d.depth === 1) return "#66bb6a"; // Väter-Ebene
      if (d.depth === 2) return "#ffee58"; // Söhne
      return "#90caf9";                    // tiefer
    })
    .attr("stroke","#333");

  node.append("text")
    .attr("dy",5).attr("text-anchor","middle")
    .attr("fill", d => (d.depth<=1 ? "#fff" : "#111"))
    .text(d => d.data.name);

  // Auto-Fit
  const b = content.node().getBBox();
  if (b.width && b.height) {
    const W = svg.node().clientWidth, H = svg.node().clientHeight;
    const scale = Math.max(0.5, Math.min(1.1, 0.9*Math.min(W/b.width, H/b.height)));
    const t = d3.zoomIdentity.translate(W/2 - scale*(b.x + b.width/2), H/2 - scale*(b.y + b.height/2)).scale(scale);
    svg.transition().duration(350).call(zoom.transform, t);
  }
}

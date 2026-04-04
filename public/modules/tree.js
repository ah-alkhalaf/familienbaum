// modules/tree.js
let svg, zoomLayer, content, zoom;

export function initTree(selector) {
  svg = d3.select(selector);
  zoomLayer = svg.append("g");
  content = zoomLayer.append("g");
  zoom = d3.zoom().scaleExtent([0.3, 3]).on("zoom", (e) => zoomLayer.attr("transform", e.transform));
  svg.call(zoom);
}

export function renderTree(data) {
  if (!svg) initTree("#svg");
  content.selectAll("*").remove();

  const root = d3.hierarchy(data);
  const { width, height } = svg.node().getBoundingClientRect();

  // مسافات أكبر بين العقد للهاتف
  const nodeWidth  = 160;
  const nodeHeight = 100;
  const treeWidth  = Math.max(root.leaves().length * nodeWidth, width - 40);
  const treeHeight = Math.max((root.height + 1) * nodeHeight, height - 40);

  const treeLayout = d3.tree().size([treeWidth, treeHeight]);
  treeLayout(root);

  // 30 لوناً لكل جيل
  const palette = [
    { fill: "#c8a96e", stroke: "#e8d48e", text: "#0f1117" }, //  0 — ذهبي (جذر)
    { fill: "#1a3a2a", stroke: "#4caf80", text: "#7dd4a8" }, //  1 — أخضر غامق
    { fill: "#1a2a3a", stroke: "#4a8fc8", text: "#88c0e8" }, //  2 — أزرق
    { fill: "#2a1a3a", stroke: "#9b6ec8", text: "#c0a0e8" }, //  3 — بنفسجي
    { fill: "#3a2a1a", stroke: "#c8896e", text: "#e8b898" }, //  4 — برتقالي
    { fill: "#1a3a3a", stroke: "#4ac8c0", text: "#88e0d8" }, //  5 — فيروزي
    { fill: "#3a1a2a", stroke: "#c84a8f", text: "#e888c0" }, //  6 — وردي
    { fill: "#2a3a1a", stroke: "#8fc84a", text: "#c0e088" }, //  7 — أخضر ليموني
    { fill: "#3a1a1a", stroke: "#c84a4a", text: "#e88888" }, //  8 — أحمر
    { fill: "#1a1a3a", stroke: "#4a4ac8", text: "#8888e8" }, //  9 — أزرق داكن
    { fill: "#2a3a2e", stroke: "#5ac890", text: "#90e0b8" }, // 10 — أخضر نعناعي
    { fill: "#3a2e1a", stroke: "#c8a04a", text: "#e8c888" }, // 11 — عنبري
    { fill: "#1e2a3a", stroke: "#4a70c8", text: "#88a8e8" }, // 12 — أزرق سماوي
    { fill: "#2e1a3a", stroke: "#804ac8", text: "#b888e8" }, // 13 — أرجواني
    { fill: "#1a2e2a", stroke: "#4ab8a0", text: "#88d8c8" }, // 14 — أخضر مائي
    { fill: "#3a2a2e", stroke: "#c86890", text: "#e8a0c0" }, // 15 — وردي غامق
    { fill: "#2e3a1a", stroke: "#90b84a", text: "#c0d888" }, // 16 — زيتوني
    { fill: "#3a1e2a", stroke: "#c84a70", text: "#e888a8" }, // 17 — توت
    { fill: "#1a3a2e", stroke: "#4ac8a0", text: "#88e0c0" }, // 18 — أخضر زمردي
    { fill: "#2a1e3a", stroke: "#704ac8", text: "#a888e8" }, // 19 — خزامى
    { fill: "#3a2e2a", stroke: "#c89070", text: "#e8c0a0" }, // 20 — خوخي
    { fill: "#1a2e3a", stroke: "#4a90b8", text: "#88c8e0" }, // 21 — أزرق بحري
    { fill: "#2e2a1a", stroke: "#b8904a", text: "#d8c080" }, // 22 — ذهبي داكن
    { fill: "#1e3a2a", stroke: "#5ab870", text: "#90d8a0" }, // 23 — أخضر فاتح
    { fill: "#3a1a2e", stroke: "#c84a90", text: "#e888c8" }, // 24 — فوشيا
    { fill: "#2a3a3a", stroke: "#4ac8c8", text: "#88e0e0" }, // 25 — سماوي فاتح
    { fill: "#3a3a1a", stroke: "#c8c84a", text: "#e8e088" }, // 26 — أصفر
    { fill: "#1a3a1e", stroke: "#4ac858", text: "#88e098" }, // 27 — أخضر نضر
    { fill: "#2e1a1a", stroke: "#c85a4a", text: "#e89888" }, // 28 — قرميدي
    { fill: "#1a1e3a", stroke: "#4a58c8", text: "#8898e8" }, // 29 — أزرق ملكي
  ];

  const getP = (depth) => palette[depth % palette.length];

  // الخطوط
  content.selectAll(".link")
    .data(root.links())
    .join("path")
    .attr("class", "link")
    .attr("d", d3.linkVertical().x(d => d.x).y(d => d.y))
    .attr("fill", "none")
    .attr("stroke", d => getP(d.source.depth).stroke)
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.4);

  const node = content.selectAll(".node")
    .data(root.descendants())
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.x},${d.y})`);

  // ---- الجذر: بدون تاج، فقط إطار ذهبي مميز ----
  node.filter(d => d.depth === 0).each(function(d) {
    const g = d3.select(this);
    // توهج خارجي خفيف
    g.append("rect")
      .attr("x", -66).attr("y", -26).attr("width", 132).attr("height", 52)
      .attr("rx", 26).attr("ry", 26)
      .attr("fill", "rgba(200,169,110,0.15)")
      .attr("stroke", "rgba(200,169,110,0.4)")
      .attr("stroke-width", 1);
    // الإطار الرئيسي
    g.append("rect")
      .attr("x", -60).attr("y", -22).attr("width", 120).attr("height", 44)
      .attr("rx", 22).attr("ry", 22)
      .attr("fill", "#c8a96e")
      .attr("stroke", "#e8d48e")
      .attr("stroke-width", 2.5);
    // الاسم فقط
    g.append("text")
      .attr("dy", 6)
      .attr("text-anchor", "middle")
      .attr("font-family", "'DM Sans', system-ui, sans-serif")
      .attr("font-size", "15px")
      .attr("font-weight", "700")
      .attr("fill", "#0f1117")
      .text(d.data.name);
  });

  // ---- المؤسس: إطار أثخن + glow واضح ----
  node.filter(d => d.depth !== 0 && d.data.isFounder === true).each(function(d) {
    const g = d3.select(this);
    const p = getP(d.depth);

    // glow طبقة خارجية
    g.append("rect")
      .attr("x", -72).attr("y", -30).attr("width", 144).attr("height", 60)
      .attr("rx", 30).attr("ry", 30)
      .attr("fill", "none")
      .attr("stroke", "rgba(200,169,110,0.25)")
      .attr("stroke-width", 8)
      .attr("filter", "url(#glow)");

    // إطار منقط ذهبي
    g.append("rect")
      .attr("x", -66).attr("y", -26).attr("width", 132).attr("height", 52)
      .attr("rx", 26).attr("ry", 26)
      .attr("fill", "none")
      .attr("stroke", "#c8a96e")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "5,3");

    // الإطار الداخلي
    g.append("rect")
      .attr("x", -60).attr("y", -20).attr("width", 120).attr("height", 40)
      .attr("rx", 18).attr("ry", 18)
      .attr("fill", p.fill)
      .attr("stroke", "#c8a96e")
      .attr("stroke-width", 2.5);

    // رمز الكمبيوتر
    g.append("text")
      .attr("x", -40).attr("dy", 6)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .text("💻");

    // الاسم
    g.append("text")
      .attr("x", 12).attr("dy", 6)
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

  // فلتر الـ glow للمؤسس
  const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
  const filter = defs.append("filter").attr("id", "glow");
  filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
  const feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // Auto-Fit
  const b = content.node().getBBox();
  if (b.width && b.height) {
    const W = svg.node().clientWidth, H = svg.node().clientHeight;
    const scale = Math.max(0.3, Math.min(1.0, 0.85 * Math.min(W / b.width, H / b.height)));
    const t = d3.zoomIdentity
      .translate(W / 2 - scale * (b.x + b.width / 2), H / 2 - scale * (b.y + b.height / 2))
      .scale(scale);
    svg.transition().duration(350).call(zoom.transform, t);
  }
}

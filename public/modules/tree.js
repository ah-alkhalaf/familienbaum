// modules/tree.js
let svg, zoomLayer, content, zoom, tooltip;

export function initTree(selector) {
  svg = d3.select(selector);
  zoomLayer = svg.append("g");
  content = zoomLayer.append("g");
  zoom = d3.zoom().scaleExtent([0.3, 3]).on("zoom", (e) => zoomLayer.attr("transform", e.transform));
  svg.call(zoom);

  const defs = svg.append("defs");
  const filter = defs.append("filter").attr("id", "glow");
  filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
  const feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // فلتر تمييز البحث
  const filterSearch = defs.append("filter").attr("id", "search-glow");
  filterSearch.append("feGaussianBlur").attr("stdDeviation", "6").attr("result", "coloredBlur");
  const feMerge2 = filterSearch.append("feMerge");
  feMerge2.append("feMergeNode").attr("in", "coloredBlur");
  feMerge2.append("feMergeNode").attr("in", "SourceGraphic");

  // تدرّج ذهبي ملكي للجذر
  const gradRoot = defs.append("linearGradient")
    .attr("id", "grad-root")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  gradRoot.append("stop").attr("offset", "0%").attr("stop-color", "#e6c876");
  gradRoot.append("stop").attr("offset", "100%").attr("stop-color", "#c9a54e");

  tooltip = d3.select("body").append("div")
    .attr("id", "tree-tooltip")
    .style("position", "fixed")
    .style("background", "rgba(15,17,23,0.95)")
    .style("border", "1px solid #c9a54e")
    .style("border-radius", "10px")
    .style("padding", "10px 14px")
    .style("color", "#c9a54e")
    .style("font-family", "'Amiri', serif")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("opacity", "0")
    .style("transition", "opacity 0.2s ease")
    .style("z-index", "9999")
    .style("max-width", "200px")
    .style("line-height", "1.6")
    .style("direction", "rtl")
    .style("text-align", "right");

  // ربط البحث
  _initSearch();
}

// لوحة ملكية — ياقوت أزرق × ذهب × جواهر فاخرة (تتناوب بتناغم)
const palette = [
  { fill: "url(#grad-root)", stroke: "#e6c876", text: "#1a1206" },          // 0 — الجذر ذهبي (يُعالج خاصة)
  { fill: "#152449", stroke: "#c9a54e", text: "#e8d9a8" },  // 1 — ياقوت أزرق × ذهب
  { fill: "#1e2a52", stroke: "#5a7fc8", text: "#a8c0e8" },  // 2 — أزرق ملكي
  { fill: "#241f4a", stroke: "#9678c0", text: "#c8b0e0" },  // 3 — بنفسجي ملكي
  { fill: "#2a2140", stroke: "#c98fb0", text: "#e8c0d0" },  // 4 — وردي عتيق
  { fill: "#142a44", stroke: "#4a9fc0", text: "#a0d0e0" },  // 5 — فيروزي عميق
  { fill: "#26233e", stroke: "#b09668", text: "#e0cca8" },  // 6 — ذهبي مدخّن
  { fill: "#1a2748", stroke: "#7088c8", text: "#b0c4e8" },  // 7 — أزرق سماوي
  { fill: "#282038", stroke: "#a878b0", text: "#d8b8e0" },  // 8 — أرجواني
  { fill: "#182644", stroke: "#c9a54e", text: "#e8d9a8" },  // 9 — أزرق × ذهب
  { fill: "#202a4e", stroke: "#5a7fc8", text: "#a8c0e8" },  // 10
  { fill: "#251f44", stroke: "#9678c0", text: "#c8b0e0" },  // 11
  { fill: "#2c2142", stroke: "#c98fb0", text: "#e8c0d0" },  // 12
  { fill: "#152a46", stroke: "#4a9fc0", text: "#a0d0e0" },  // 13
  { fill: "#282540", stroke: "#b09668", text: "#e0cca8" },  // 14
  { fill: "#1c2a4c", stroke: "#7088c8", text: "#b0c4e8" },  // 15
  { fill: "#2a223c", stroke: "#a878b0", text: "#d8b8e0" },  // 16
  { fill: "#1a2846", stroke: "#c9a54e", text: "#e8d9a8" },  // 17
  { fill: "#222c50", stroke: "#5a7fc8", text: "#a8c0e8" },  // 18
  { fill: "#271f46", stroke: "#9678c0", text: "#c8b0e0" },  // 19
  { fill: "#2e2344", stroke: "#c98fb0", text: "#e8c0d0" },  // 20
  { fill: "#172c48", stroke: "#4a9fc0", text: "#a0d0e0" },  // 21
  { fill: "#2a2742", stroke: "#b09668", text: "#e0cca8" },  // 22
  { fill: "#1e2c4e", stroke: "#7088c8", text: "#b0c4e8" },  // 23
  { fill: "#2c243e", stroke: "#a878b0", text: "#d8b8e0" },  // 24
  { fill: "#1c2a48", stroke: "#c9a54e", text: "#e8d9a8" },  // 25
  { fill: "#242e52", stroke: "#5a7fc8", text: "#a8c0e8" },  // 26
  { fill: "#292148", stroke: "#9678c0", text: "#c8b0e0" },  // 27
  { fill: "#302546", stroke: "#c98fb0", text: "#e8c0d0" },  // 28
  { fill: "#192e4a", stroke: "#4a9fc0", text: "#a0d0e0" },  // 29
];

const getP = (depth) => palette[depth % palette.length];

let rootData = null;
let initialized = false;
let searchTerm = "";
let hasFitted = false;

// حالة الصلاحية ودوال العمليات (يوفّرها main.js)
let canEdit = false;
let actions = { onAdd: null, onEdit: null, onDelete: null };

export function setTreeActions(loggedIn, handlers) {
  canEdit = !!loggedIn;
  actions = handlers || actions;
}

function collapseFromDepth(node, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth && node.children && node.children.length > 0) {
    node._collapsed = true;
  } else {
    node._collapsed = false;
  }
  (node.children || []).forEach(child => collapseFromDepth(child, maxDepth, currentDepth + 1));
}

function hasFounderDescendant(node) {
  if (node.isFounder) return true;
  return (node.children || []).some(hasFounderDescendant);
}

// فتح كل الفروع حتى الوصول للعقدة المطلوبة
function expandPathTo(node, targetId) {
  if (node._id === targetId) return true;
  const children = node.children || [];
  for (const child of children) {
    if (expandPathTo(child, targetId)) {
      node._collapsed = false;
      return true;
    }
  }
  return false;
}

// البحث عن كل العقد المطابقة بالاسم
function findAllNodes(node, query, results = []) {
  if (node.name && node.name.includes(query)) results.push(node);
  for (const child of (node.children || [])) {
    findAllNodes(child, query, results);
  }
  return results;
}

function _initSearch() {
  const btn    = document.getElementById("btnSearch");
  const bar    = document.getElementById("searchBar");
  const input  = document.getElementById("searchInput");
  const clear  = document.getElementById("btnClearSearch");
  const hint   = document.getElementById("searchHint");

  if (!btn) return;

  btn.addEventListener("click", () => {
    bar.classList.toggle("hidden");
    hint.classList.toggle("hidden");
    if (!bar.classList.contains("hidden")) {
      input.focus();
    }
  });

  clear.addEventListener("click", () => {
    input.value = "";
    searchTerm = "";
    bar.classList.add("hidden");
    hint.classList.add("hidden");
    _render(rootData);
  });

  input.addEventListener("input", () => {
    searchTerm = input.value.trim();
    if (!searchTerm) {
      _render(rootData);
      return;
    }

    // ابحث عن كل العقد المطابقة
    const matches = findAllNodes(rootData, searchTerm);
    if (matches.length > 0) {
      // افتح الفروع حتى الوصول لكل عقدة مطابقة
      matches.forEach(m => expandPathTo(rootData, m._id));
      _render(rootData);

      // ضبط العرض ليشمل كل النتائج
      setTimeout(() => {
        const matchIds = new Set(matches.map(m => m._id));
        const nodeEls = content.selectAll(".node").filter(d => matchIds.has(d.data._id));
        if (!nodeEls.empty()) {
          const xs = [], ys = [];
          nodeEls.each(d => { xs.push(d.x); ys.push(d.y); });
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          const W = svg.node().clientWidth, H = svg.node().clientHeight;
          const boxW = (maxX - minX) + 240;   // هامش
          const boxH = (maxY - minY) + 200;
          const scale = Math.max(0.4, Math.min(1.6, 0.85 * Math.min(W / boxW, H / boxH)));
          const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
          const t = d3.zoomIdentity
            .translate(W / 2 - scale * cx, H / 2 - scale * cy)
            .scale(scale);
          svg.transition().duration(500).call(zoom.transform, t);
        }
      }, 100);
    }
  });

  // البحث بـ Enter
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      searchTerm = "";
      bar.classList.add("hidden");
      hint.classList.add("hidden");
      _render(rootData);
    }
  });
}

export function renderTree(data) {
  if (!svg) initTree("#svg");
  rootData = data;

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

  // خطوط منحنية ملكية — تتصل بحواف المربعات بلون كل جيل
  const NODE_HALF = 20;
  const linkPath = (d) => {
    const sx = d.source.x, sy = d.source.y + NODE_HALF;
    const tx = d.target.x, ty = d.target.y - NODE_HALF;
    const my = (sy + ty) / 2;
    return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
  };

  content.selectAll(".link")
    .data(root.links())
    .join("path")
    .attr("class", "link")
    .attr("d", linkPath)
    .attr("fill", "none")
    .attr("stroke", d => getP(d.target.depth).stroke)
    .attr("stroke-width", 1.5)
    .attr("stroke-linecap", "round")
    .attr("opacity", 0.5);

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
    .on("mouseover", function(event, d) {
      const isFounderBranch = d.data.isFounder || hasFounderDescendant(d.data);
      if (!isFounderBranch) return;
      let msg = d.data.isFounder
        ? `💻 مؤسس الصفحة<br/>هذا الشخص أنشأ وبنى شجرة العائلة`
        : d.data._collapsed && hasFounderDescendant(d.data)
          ? `💻 يوجد مؤسس الصفحة<br/>في هذا الفرع المطوي`
          : `💻 فرع يحتوي على<br/>مؤسس الصفحة`;
      tooltip.html(msg).style("opacity", "1")
        .style("left", (event.clientX + 14) + "px")
        .style("top", (event.clientY - 10) + "px");
    })
    .on("mousemove", function(event) {
      tooltip.style("left", (event.clientX + 14) + "px")
              .style("top", (event.clientY - 10) + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", "0"));

  // هل هذه العقدة هي نتيجة البحث؟
  const isMatch = (d) => searchTerm && d.data.name && d.data.name.includes(searchTerm);

  // ---- الجذر ----
  node.filter(d => d.depth === 0).each(function(d) {
    const g = d3.select(this);
    const match = isMatch(d);
    g.append("rect")
      .attr("x", -66).attr("y", -26).attr("width", 132).attr("height", 52)
      .attr("rx", 26).attr("ry", 26)
      .attr("fill", "rgba(200,169,110,0.15)")
      .attr("stroke", match ? "#fff" : "rgba(200,169,110,0.4)")
      .attr("stroke-width", match ? 3 : 1)
      .attr("filter", match ? "url(#search-glow)" : null);
    g.append("rect")
      .attr("x", -60).attr("y", -22).attr("width", 120).attr("height", 44)
      .attr("rx", 22).attr("ry", 22)
      .attr("fill", "url(#grad-root)").attr("stroke", "#e6c876").attr("stroke-width", 2.5);
    g.append("text").attr("dy", 6).attr("text-anchor", "middle")
      .attr("font-family", "'Amiri', serif")
      .attr("font-size", "17px").attr("font-weight", "700")
      .attr("fill", "#1a1206").text(d.data.name);
    _addCollapseIndicator(g, d);
    _addActionButtons(g, d);
  });

  // ---- المؤسس ----
  node.filter(d => d.depth !== 0 && d.data.isFounder === true).each(function(d) {
    const g = d3.select(this);
    const p = getP(d.depth);
    const match = isMatch(d);
    if (match) {
      g.append("rect")
        .attr("x", -74).attr("y", -32).attr("width", 148).attr("height", 64)
        .attr("rx", 32).attr("ry", 32)
        .attr("fill", "none").attr("stroke", "#fff")
        .attr("stroke-width", 2).attr("filter", "url(#search-glow)");
    }
    g.append("rect")
      .attr("x", -72).attr("y", -30).attr("width", 144).attr("height", 60)
      .attr("rx", 30).attr("ry", 30)
      .attr("fill", "none").attr("stroke", "rgba(200,169,110,0.25)")
      .attr("stroke-width", 8).attr("filter", "url(#glow)");
    g.append("rect")
      .attr("x", -66).attr("y", -26).attr("width", 132).attr("height", 52)
      .attr("rx", 26).attr("ry", 26)
      .attr("fill", "none").attr("stroke", "#c9a54e")
      .attr("stroke-width", 2.5).attr("stroke-dasharray", "5,3");
    g.append("rect")
      .attr("x", -60).attr("y", -20).attr("width", 120).attr("height", 40)
      .attr("rx", 18).attr("ry", 18)
      .attr("fill", p.fill).attr("stroke", "#c9a54e").attr("stroke-width", 2.5);
    g.append("text").attr("x", -40).attr("dy", 6)
      .attr("text-anchor", "middle").attr("font-size", "13px").text("💻");
    g.append("text").attr("x", 12).attr("dy", 6).attr("text-anchor", "middle")
      .attr("font-family", "'Amiri', serif")
      .attr("font-size", "15px").attr("font-weight", "700")
      .attr("fill", p.text).text(d.data.name);
    _addCollapseIndicator(g, d);
    _addActionButtons(g, d);
  });

  // ---- بقية العقد ----
  node.filter(d => d.depth !== 0 && !d.data.isFounder).each(function(d) {
    const g = d3.select(this);
    const p = getP(d.depth);
    const match = isMatch(d);
    const hiddenFounder = d.data._collapsed && hasFounderDescendant(d.data);

    if (match) {
      g.append("rect")
        .attr("x", -66).attr("y", -26).attr("width", 132).attr("height", 52)
        .attr("rx", 24).attr("ry", 24)
        .attr("fill", "none").attr("stroke", "#ffffff")
        .attr("stroke-width", 2.5).attr("filter", "url(#search-glow)");
    }
    if (hiddenFounder && !match) {
      g.append("rect")
        .attr("x", -63).attr("y", -23).attr("width", 126).attr("height", 46)
        .attr("rx", 21).attr("ry", 21)
        .attr("fill", "none").attr("stroke", "#c9a54e")
        .attr("stroke-width", 1).attr("stroke-dasharray", "3,3").attr("opacity", 0.5);
    }
    g.append("rect")
      .attr("x", -60).attr("y", -20).attr("width", 120).attr("height", 40)
      .attr("rx", 18).attr("ry", 18)
      .attr("fill", p.fill)
      .attr("stroke", match ? "#ffffff" : hiddenFounder ? "#c9a54e" : p.stroke)
      .attr("stroke-width", match ? 2.5 : hiddenFounder ? 2 : 1.5);
    g.append("text").attr("dy", 6).attr("text-anchor", "middle")
      .attr("font-family", "'Amiri', serif")
      .attr("font-size", "15px").attr("font-weight", "600")
      .attr("fill", p.text).text(d.data.name);
    _addCollapseIndicator(g, d);
    _addActionButtons(g, d);
  });

  // Auto-Fit — مرة واحدة فقط عند أول تحميل
  if (!hasFitted && !searchTerm) {
    const b = content.node().getBBox();
    if (b.width && b.height) {
      const W = svg.node().clientWidth, H = svg.node().clientHeight;
      const scale = Math.max(0.3, Math.min(1.0, 0.85 * Math.min(W / b.width, H / b.height)));
      const t = d3.zoomIdentity
        .translate(W / 2 - scale * (b.x + b.width / 2), H / 2 - scale * (b.y + b.height / 2))
        .scale(scale);
      svg.transition().duration(300).call(zoom.transform, t);
      hasFitted = true;
    }
  }
}

export function refit() {
  hasFitted = false;
  if (rootData) _render(rootData);
}

function _addCollapseIndicator(g, d) {
  if (!d.data.children || d.data.children.length === 0) return;
  const count = d.data.children.length;
  const collapsed = d.data._collapsed;
  g.append("circle")
    .attr("cx", 0).attr("cy", 26).attr("r", 10)
    .attr("fill", collapsed ? "#c9a54e" : "rgba(255,255,255,0.08)")
    .attr("stroke", "#c9a54e").attr("stroke-width", 1.5);
  g.append("text")
    .attr("x", 0).attr("y", 30).attr("text-anchor", "middle")
    .attr("font-size", collapsed ? "9px" : "10px").attr("font-weight", "700")
    .attr("fill", collapsed ? "#1a1206" : "#c9a54e")
    .text(collapsed ? count : "−");
}

// أزرار العمليات المباشرة على العقدة (تظهر عند المرور)
function _addActionButtons(g, d) {
  if (!canEdit) return;

  const isRoot = d.depth === 0;

  // منطقة مرور غير مرئية تغطي العقدة + مكان الأزرار (تمنع الاختفاء السريع)
  g.append("rect")
    .attr("class", "hover-bridge")
    .attr("x", -66).attr("y", -48).attr("width", 132).attr("height", 74)
    .attr("fill", "transparent")
    .style("pointer-events", "all");

  const bar = g.append("g")
    .attr("class", "node-actions")
    .attr("transform", "translate(0,-32)")
    .style("opacity", 0)
    .style("pointer-events", "none");

  const mkBtn = (x, bg, symbol, title, handler) => {
    const b = bar.append("g")
      .attr("transform", `translate(${x},0)`)
      .style("cursor", "pointer")
      .on("click", (event) => {
        event.stopPropagation();
        handler(d.data);
      });
    b.append("title").text(title);
    b.append("circle")
      .attr("r", 12)
      .attr("fill", bg)
      .attr("stroke", "#0a1020")
      .attr("stroke-width", 1.5);
    b.append("text")
      .attr("text-anchor", "middle").attr("dy", 4)
      .attr("font-size", "13px").attr("font-weight", "700")
      .attr("fill", "#0a1020").attr("pointer-events", "none")
      .text(symbol);
    return b;
  };

  mkBtn(0, "#5aac7b", "+", "إضافة ابن", (data) => actions.onAdd && actions.onAdd(data));
  if (!isRoot) {
    mkBtn(-28, "#e6c876", "✎", "تعديل الاسم", (data) => actions.onEdit && actions.onEdit(data));
    mkBtn(28, "#d65a5a", "×", "حذف", (data) => actions.onDelete && actions.onDelete(data));
  }

  // إظهار فوري + إخفاء متأخّر قليلاً (تجربة مريحة)
  let hideTimer = null;
  const show = () => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    bar.interrupt().transition().duration(100).style("opacity", 1);
    bar.style("pointer-events", "all");
  };
  const hide = () => {
    hideTimer = setTimeout(() => {
      bar.interrupt().transition().duration(150).style("opacity", 0);
      bar.style("pointer-events", "none");
    }, 350); // تأخير 350ms قبل الإخفاء
  };
  g.on("mouseenter.actions", show);
  g.on("mouseleave.actions", hide);
}

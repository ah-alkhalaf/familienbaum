// ui.js
export function togglePanelHotkey(panel, app) {
  // Start: Panel ist garantiert versteckt
  panel.classList.add("hidden");
  app.classList.remove("with-panel");

  // Nur öffnen, wenn exakt ?admin=1
  const p = new URLSearchParams(location.search);
  if (p.get("admin") === "1") {
    panel.classList.remove("hidden");
    app.classList.add("with-panel");
  }

  // Alt + A toggelt sichtbar/unsichtbar
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "a" || e.key === "A")) {
      const nowHidden = panel.classList.toggle("hidden");
      app.classList.toggle("with-panel", !nowHidden);
    }
  });
}

export function initTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.add("hidden"));
      btn.classList.add("active");
      const tabId = "tab-" + btn.dataset.tab;
      document.getElementById(tabId)?.classList.remove("hidden");
    });
  });
}

export function populateAllDropdowns(data) {
  const items = [];

  // Walk mit Vater-Name
  (function walk(n, parentName) {
    items.push({
      id: n._id,
      name: n.name,
      parentName: parentName || null
    });
    (n.children || []).forEach(child => walk(child, n.name));
  })(data, null);

  // Label: "Name  (Vater: XYZ)" — nur wenn Vater existiert
  const label = (item) => {
    if (item.parentName) return `${item.name}  (${item.parentName})`;
    return item.name;
  };

  const fill = (id, filter = () => true) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    items.filter(filter).forEach(n => {
      const opt = document.createElement("option");
      opt.value = n.id;
      opt.textContent = label(n);
      el.appendChild(opt);
    });
  };

  fill("addParent");                           // inkl. Root → Top-Level möglich
  fill("renameTarget", n => n.id !== data._id);
  fill("moveTarget",   n => n.id !== data._id);
  fill("moveParent");                          // inkl. Root
  fill("deleteTarget", n => n.id !== data._id);
}

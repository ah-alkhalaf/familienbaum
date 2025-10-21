// main.js (ES-Module)
import { checkAuth, login, logout } from './modules/auth.js';
import { loadFamily, addPerson, renamePerson, movePerson, deletePerson, exportJson, listBackups, restoreBackup } from './modules/api.js';
import { populateAllDropdowns, initTabs, togglePanelHotkey } from './modules/ui.js';
import { initTree, renderTree } from './modules/tree.js';

let familyData = null;
let loggedIn = false;

const panel = document.getElementById("panel");
const app = document.getElementById("app");

function updateAdminUI() {
  document.getElementById("login").style.display = loggedIn ? "none" : "block";
  document.getElementById("adminPanel").style.display = loggedIn ? "block" : "none";
}

async function reloadTree() {
  familyData = await loadFamily();
  renderTree(familyData);
  populateAllDropdowns(familyData);
}

function bindEvents() {
  document.getElementById("btnLogin").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const result = await login(username, password);
    if (result.success) {
      loggedIn = true;
      updateAdminUI();
      await reloadTree();
    } else {
      alert(result.message || "Login fehlgeschlagen");
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await logout();
    loggedIn = false;
    updateAdminUI();
  });

  document.getElementById("btnAdd").addEventListener("click", async () => {
    if (!loggedIn) return alert("Bitte einloggen.");
    const name = document.getElementById("addName").value.trim();
    const parentId = document.getElementById("addParent").value || null;
    if (!name) return alert("Name erforderlich.");
    const result = await addPerson(name, parentId);
    if (result.success) { await reloadTree(); document.getElementById("addName").value = ""; }
    else alert(result.message || "Fehler beim Hinzufügen");
  });

  document.getElementById("btnRename").addEventListener("click", async () => {
    if (!loggedIn) return alert("Bitte einloggen.");
    const id = document.getElementById("renameTarget").value;
    const newName = document.getElementById("renameNew").value.trim();
    if (!id || !newName) return alert("Felder ausfüllen.");
    const result = await renamePerson(id, newName);
    if (result.success) { await reloadTree(); document.getElementById("renameNew").value = ""; }
    else alert(result.message || "Fehler beim Umbenennen");
  });

  document.getElementById("btnMove").addEventListener("click", async () => {
    if (!loggedIn) return alert("Bitte einloggen.");
    const id = document.getElementById("moveTarget").value;
    const newParentId = document.getElementById("moveParent").value;
    if (!id || !newParentId) return alert("Ungültige Auswahl.");
    if (id === newParentId) return alert("Ein Mitglied kann nicht sein eigener Vater sein.");
    const result = await movePerson(id, newParentId);
    if (result.success) await reloadTree(); else alert(result.message || "Fehler beim Verschieben");
  });

  document.getElementById("btnDelete").addEventListener("click", async () => {
    if (!loggedIn) return alert("Bitte einloggen.");
    const id = document.getElementById("deleteTarget").value;
    if (!id) return alert("Mitglied wählen.");
    if (!confirm("Wirklich löschen? (inkl. Nachkommen)")) return;
    const result = await deletePerson(id);
    if (result.success) { await reloadTree(); alert("✅ Person gelöscht"); }
    else alert(result.message || "Fehler beim Löschen");
  });

  document.getElementById("btnExport").addEventListener("click", () => exportJson());
  document.getElementById("btnRestore").addEventListener("click", async () => {
    if (!loggedIn) return alert("Bitte einloggen.");
    const sel = document.getElementById("restoreSelect");
    const filename = sel.value;
    if (!filename) return alert("Backup wählen.");
    if (!confirm("Backup wirklich wiederherstellen?")) return;
    const result = await restoreBackup(filename);
    if (result.success) { await reloadTree(); alert("Wiederhergestellt."); }
    else alert(result.message || "Restore fehlgeschlagen");
  });

  document.getElementById("btnExport").addEventListener("click", async () => {
  try {
    await exportJson();
  } catch (err) {
    alert("Export fehlgeschlagen: " + err.message);
  }
});

document.getElementById("btnRestore").addEventListener("click", async () => {
  const filename = document.getElementById("restoreSelect").value;
  if (!filename) return alert("Kein Backup ausgewählt.");
  if (!confirm(`Backup ${filename} wiederherstellen?`)) return;
  const result = await restoreBackup(filename);
  if (result.success) {
    alert("Backup erfolgreich wiederhergestellt!");
    await reloadTree();
  } else {
    alert(result.message || "Fehler beim Wiederherstellen.");
  }
});
}

async function init() {
  // Panel per Tastatur & ?admin=1
  togglePanelHotkey(panel, app);
  initTabs();

  loggedIn = await checkAuth();
  updateAdminUI();

  initTree("#svg");
  await reloadTree();

  const backups = await listBackups().catch(()=>[]);
  const sel = document.getElementById("restoreSelect");
  if (sel && backups?.forEach) {
    sel.innerHTML = "";
    backups.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.filename;
      opt.textContent = `${b.filename} (${Math.round(b.size/1024)} KB)`;
      sel.appendChild(opt);
    });
  }

  bindEvents();
}

init();

// main.js (ES-Module)
import { checkAuth, login, logout } from './modules/auth.js';
import { loadFamily, addPerson, addMultiplePeople, renamePerson, movePerson, deletePerson, exportJson, listBackups, restoreBackup, setFounder } from './modules/api.js';
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
      alert(result.message || "فشل تسجيل الدخول");
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await logout();
    loggedIn = false;
    updateAdminUI();
  });

  // إضافة شخص أو عدة أشخاص
  document.getElementById("btnAdd").addEventListener("click", async () => {
    if (!loggedIn) return alert("الرجاء تسجيل الدخول.");
    const raw = document.getElementById("addName").value.trim();
    const parentId = document.getElementById("addParent").value || null;
    if (!raw) return alert("أدخل اسماً واحداً على الأقل.");

    // تقسيم بالفاصلة أو الفاصلة المنقوطة
    const names = raw.split(/[,،;]/).map(n => n.trim()).filter(n => n.length > 0);

    let result;
    if (names.length === 1) {
      result = await addPerson(names[0], parentId);
    } else {
      result = await addMultiplePeople(names, parentId);
    }

    if (result.success) {
      await reloadTree();
      document.getElementById("addName").value = "";
    } else {
      alert(result.message || "خطأ في الإضافة");
    }
  });

  document.getElementById("btnRename").addEventListener("click", async () => {
    if (!loggedIn) return alert("الرجاء تسجيل الدخول.");
    const id = document.getElementById("renameTarget").value;
    const newName = document.getElementById("renameNew").value.trim();
    if (!id || !newName) return alert("يرجى ملء جميع الحقول.");
    const result = await renamePerson(id, newName);
    if (result.success) { await reloadTree(); document.getElementById("renameNew").value = ""; }
    else alert(result.message || "خطأ في تغيير الاسم");
  });

  document.getElementById("btnMove").addEventListener("click", async () => {
    if (!loggedIn) return alert("الرجاء تسجيل الدخول.");
    const id = document.getElementById("moveTarget").value;
    const newParentId = document.getElementById("moveParent").value;
    if (!id || !newParentId) return alert("اختيار غير صالح.");
    if (id === newParentId) return alert("لا يمكن أن يكون الشخص أباً لنفسه.");
    const result = await movePerson(id, newParentId);
    if (result.success) await reloadTree();
    else alert(result.message || "خطأ في النقل");
  });

  document.getElementById("btnDelete").addEventListener("click", async () => {
    if (!loggedIn) return alert("الرجاء تسجيل الدخول.");
    const id = document.getElementById("deleteTarget").value;
    if (!id) return alert("اختر شخصاً.");
    if (!confirm("هل تريد الحذف؟ (سيُحذف مع جميع أبنائه)")) return;
    const result = await deletePerson(id);
    if (result.success) { await reloadTree(); }
    else alert(result.message || "خطأ في الحذف");
  });

  // تعيين المؤسس
  document.getElementById("btnSetFounder").addEventListener("click", async () => {
    if (!loggedIn) return alert("الرجاء تسجيل الدخول.");
    const id = document.getElementById("founderTarget").value;
    if (!id) return alert("اختر شخصاً.");
    const result = await setFounder(id);
    if (result.success) { await reloadTree(); alert("✅ تم تعيين المؤسس"); }
    else alert(result.message || "خطأ");
  });

  document.getElementById("btnExport").addEventListener("click", async () => {
    try { exportJson(); } catch (err) { alert("فشل التصدير: " + err.message); }
  });

  document.getElementById("btnRestore").addEventListener("click", async () => {
    const filename = document.getElementById("restoreSelect").value;
    if (!filename) return alert("لم يتم اختيار نسخة احتياطية.");
    if (!confirm(`استعادة النسخة: ${filename}؟`)) return;
    const result = await restoreBackup(filename);
    if (result.success) { alert("تمت الاستعادة بنجاح!"); await reloadTree(); }
    else alert(result.message || "خطأ في الاستعادة.");
  });
}

async function init() {
  togglePanelHotkey(panel, app);
  initTabs();

  loggedIn = await checkAuth();
  updateAdminUI();

  initTree("#svg");
  await reloadTree();

  const backups = await listBackups().catch(() => []);
  const sel = document.getElementById("restoreSelect");
  if (sel && backups?.forEach) {
    sel.innerHTML = "";
    backups.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.filename;
      opt.textContent = `${b.filename} (${Math.round(b.size / 1024)} KB)`;
      sel.appendChild(opt);
    });
  }

  bindEvents();
}

init();

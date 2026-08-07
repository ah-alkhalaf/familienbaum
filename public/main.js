// main.js (ES-Module)
import { checkAuth, login, logout } from './modules/auth.js';
import {
  loadFamily, addPerson, addMultiplePeople, renamePerson, movePerson, deletePerson,
  exportJson, setFounder,
  listUsers, addUser, deleteUser, resetUserPassword
} from './modules/api.js';
import { populateAllDropdowns, initTabs, togglePanelHotkey } from './modules/ui.js';
import { initTree, renderTree } from './modules/tree.js';

let familyData = null;
let loggedIn = false;
let isSuper = false;

const panel = document.getElementById("panel");
const app = document.getElementById("app");

function updateAdminUI() {
  document.getElementById("login").style.display = loggedIn ? "none" : "block";
  document.getElementById("adminPanel").style.display = loggedIn ? "block" : "none";

  // إظهار/إخفاء عناصر المسؤول الرئيسي
  document.querySelectorAll(".super-only").forEach(el => {
    el.style.display = (loggedIn && isSuper) ? "" : "none";
  });

  // تحديث التحية
  const greeting = document.getElementById("adminGreeting");
  if (greeting) {
    greeting.textContent = isSuper ? "مرحباً، المسؤول الرئيسي 👑" : "مرحباً، المسؤول";
  }
}

async function reloadTree() {
  familyData = await loadFamily();
  renderTree(familyData);
  populateAllDropdowns(familyData);
}

// عرض قائمة المستخدمين
async function reloadUsers() {
  if (!isSuper) return;
  const listEl = document.getElementById("usersList");
  if (!listEl) return;
  const users = await listUsers();
  listEl.innerHTML = "";

  if (!users || users.length === 0) {
    listEl.innerHTML = `<p class="hint">لا يوجد مستخدمون بعد.</p>`;
    return;
  }

  users.forEach(u => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <span class="user-name">👤 ${u.username}</span>
      <div class="user-actions">
        <button class="user-reset" data-user="${u.username}" title="تغيير كلمة المرور">🔑</button>
        <button class="user-delete" data-user="${u.username}" title="حذف">🗑</button>
      </div>
    `;
    listEl.appendChild(row);
  });

  // ربط أزرار الحذف
  listEl.querySelectorAll(".user-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const username = btn.dataset.user;
      if (!confirm(`حذف المستخدم "${username}"؟`)) return;
      const result = await deleteUser(username);
      if (result.success) { await reloadUsers(); }
      else alert(result.message || "خطأ في الحذف");
    });
  });

  // ربط أزرار تغيير كلمة المرور
  listEl.querySelectorAll(".user-reset").forEach(btn => {
    btn.addEventListener("click", async () => {
      const username = btn.dataset.user;
      const newPass = prompt(`كلمة المرور الجديدة للمستخدم "${username}" (6 أحرف على الأقل):`);
      if (!newPass) return;
      const result = await resetUserPassword(username, newPass);
      if (result.success) alert("✅ تم تغيير كلمة المرور");
      else alert(result.message || "خطأ");
    });
  });
}

function bindEvents() {
  document.getElementById("btnLogin").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const result = await login(username, password);
    if (result.success) {
      loggedIn = true;
      isSuper = !!result.isSuper;
      updateAdminUI();
      await reloadTree();
      if (isSuper) await reloadUsers();
    } else {
      alert(result.message || "فشل تسجيل الدخول");
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await logout();
    loggedIn = false;
    isSuper = false;
    updateAdminUI();
  });

  document.getElementById("btnAdd").addEventListener("click", async () => {
    if (!loggedIn) return alert("الرجاء تسجيل الدخول.");
    const raw = document.getElementById("addName").value.trim();
    const parentId = document.getElementById("addParent").value || null;
    if (!raw) return alert("أدخل اسماً واحداً على الأقل.");
    const names = raw.split(/[,،;]/).map(n => n.trim()).filter(n => n.length > 0);
    let result;
    if (names.length === 1) result = await addPerson(names[0], parentId);
    else result = await addMultiplePeople(names, parentId);
    if (result.success) { await reloadTree(); document.getElementById("addName").value = ""; }
    else alert(result.message || "خطأ في الإضافة");
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

  document.getElementById("btnSetFounder").addEventListener("click", async () => {
    if (!loggedIn) return alert("الرجاء تسجيل الدخول.");
    const id = document.getElementById("founderTarget").value;
    if (!id) return alert("اختر شخصاً.");
    const result = await setFounder(id);
    if (result.success) { await reloadTree(); alert("✅ تم تعيين المؤسس"); }
    else alert(result.message || "خطأ");
  });

  // إضافة مستخدم
  const btnAddUser = document.getElementById("btnAddUser");
  if (btnAddUser) {
    btnAddUser.addEventListener("click", async () => {
      if (!isSuper) return alert("هذه العملية للمسؤول الرئيسي فقط.");
      const username = document.getElementById("newUserName").value.trim();
      const password = document.getElementById("newUserPass").value.trim();
      if (!username || !password) return alert("املأ الاسم وكلمة المرور.");
      const result = await addUser(username, password);
      if (result.success) {
        document.getElementById("newUserName").value = "";
        document.getElementById("newUserPass").value = "";
        await reloadUsers();
        alert("✅ تم إضافة المستخدم");
      } else {
        alert(result.message || "خطأ في الإضافة");
      }
    });
  }
}

async function init() {
  togglePanelHotkey(panel, app);
  initTabs();

  const auth = await checkAuth();
  loggedIn = !!auth.authenticated;
  isSuper = !!auth.isSuper;
  updateAdminUI();

  initTree("#svg");
  await reloadTree();

  if (loggedIn && isSuper) await reloadUsers();

  bindEvents();
}

init();
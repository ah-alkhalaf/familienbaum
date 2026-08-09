// main.js (ES-Module)
import { checkAuth, login, logout } from './modules/auth.js';
import {
  loadFamily, addPerson, addMultiplePeople, renamePerson, movePerson, deletePerson,
  exportJson, setFounder,
  listUsers, addUser, deleteUser, resetUserPassword
} from './modules/api.js';
import { populateAllDropdowns, initTabs, togglePanelHotkey } from './modules/ui.js';
import { initTree, renderTree, setTreeActions } from './modules/tree.js';

let familyData = null;
let loggedIn = false;
let isSuper = false;

const panel = document.getElementById("panel");
const app = document.getElementById("app");

/* ============================================================
   نظام النافذة المنبثقة الملكية
   ============================================================ */
const modal = {
  overlay: document.getElementById("modalOverlay"),
  box: document.querySelector(".modal-box"),
  title: document.getElementById("modalTitle"),
  body: document.getElementById("modalBody"),
  confirm: document.getElementById("modalConfirm"),
  cancel: document.getElementById("modalCancel"),
  close: document.getElementById("modalClose"),
  _onConfirm: null
};

function openModal({ title, bodyHTML, confirmText = "تأكيد", danger = false, onConfirm, focusId }) {
  modal.title.textContent = title;
  modal.body.innerHTML = bodyHTML;
  modal.confirm.textContent = confirmText;
  modal.box.classList.toggle("danger-mode", !!danger);
  modal._onConfirm = onConfirm;
  modal.overlay.classList.remove("hidden");
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus(); el.select?.(); }
  }
}

function closeModal() {
  modal.overlay.classList.add("hidden");
  modal._onConfirm = null;
}

modal.confirm.addEventListener("click", async () => {
  if (modal._onConfirm) {
    const keep = await modal._onConfirm();
    if (keep !== true) closeModal();
  } else closeModal();
});
modal.cancel.addEventListener("click", closeModal);
modal.close.addEventListener("click", closeModal);
modal.overlay.addEventListener("click", (e) => {
  if (e.target === modal.overlay) closeModal();
});
// Enter للتأكيد، Escape للإلغاء
document.addEventListener("keydown", (e) => {
  if (modal.overlay.classList.contains("hidden")) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "Enter" && e.target.tagName === "INPUT") modal.confirm.click();
});

// عدّ الأبناء (للحذف)
function countDescendants(node) {
  let c = 0;
  (node.children || []).forEach(ch => { c += 1 + countDescendants(ch); });
  return c;
}

/* ============================================================
   عمليات العقدة المباشرة (تُستدعى من الأزرار على الشجرة)
   ============================================================ */
function nodeAdd(nodeData) {
  openModal({
    title: `إضافة ابن لـ ${nodeData.name}`,
    bodyHTML: `
      <label>الاسم (أو عدة أسماء بفاصلة)</label>
      <input id="mAddInput" type="text" placeholder="مثال: محمد، أحمد" />
      <span class="hint">💡 يمكن إضافة عدة أبناء بفاصلة دفعة واحدة</span>
    `,
    confirmText: "إضافة",
    focusId: "mAddInput",
    onConfirm: async () => {
      const raw = document.getElementById("mAddInput").value.trim();
      if (!raw) { alert("أدخل اسماً واحداً على الأقل."); return true; }
      const names = raw.split(/[,،;]/).map(n => n.trim()).filter(Boolean);
      const res = names.length === 1
        ? await addPerson(names[0], nodeData._id)
        : await addMultiplePeople(names, nodeData._id);
      if (!res.success) { alert(res.message || "خطأ في الإضافة"); return true; }
      await reloadTree();
    }
  });
}

function nodeEdit(nodeData) {
  openModal({
    title: "تغيير الاسم",
    bodyHTML: `
      <label>الاسم الجديد</label>
      <input id="mEditInput" type="text" value="${nodeData.name.replace(/"/g, '&quot;')}" />
    `,
    confirmText: "حفظ",
    focusId: "mEditInput",
    onConfirm: async () => {
      const newName = document.getElementById("mEditInput").value.trim();
      if (!newName) { alert("الاسم مطلوب."); return true; }
      const res = await renamePerson(nodeData._id, newName);
      if (!res.success) { alert(res.message || "خطأ"); return true; }
      await reloadTree();
    }
  });
}

function nodeDelete(nodeData) {
  const n = countDescendants(nodeData);
  const warn = n > 0
    ? `سيتم حذف <span class="modal-highlight">${nodeData.name}</span> و <span class="modal-highlight">${n}</span> من الأبناء والأحفاد.`
    : `سيتم حذف <span class="modal-highlight">${nodeData.name}</span>.`;
  openModal({
    title: "تأكيد الحذف",
    bodyHTML: `<p class="modal-text">${warn}<br/>لا يمكن التراجع عن هذه العملية.</p>`,
    confirmText: "حذف",
    danger: true,
    onConfirm: async () => {
      const res = await deletePerson(nodeData._id);
      if (!res.success) { alert(res.message || "خطأ في الحذف"); return true; }
      await reloadTree();
    }
  });
}

/* ============================================================
   إدارة الواجهة
   ============================================================ */
function updateAdminUI() {
  document.getElementById("login").style.display = loggedIn ? "none" : "block";
  document.getElementById("adminPanel").style.display = loggedIn ? "block" : "none";

  document.querySelectorAll(".super-only").forEach(el => {
    el.style.display = (loggedIn && isSuper) ? "" : "none";
  });

  const greeting = document.getElementById("adminGreeting");
  if (greeting) greeting.textContent = isSuper ? "مرحباً، المسؤول الرئيسي 👑" : "مرحباً، المسؤول";

  // المستخدم العادي: لا تبويبات — يظهر له تلميح الأزرار
  const noTabsHint = document.getElementById("noTabsHint");
  const founderContent = document.getElementById("tab-founder");
  if (noTabsHint) noTabsHint.style.display = (loggedIn && !isSuper) ? "flex" : "none";
  // للمسؤول الرئيسي: أظهر محتوى المؤسس افتراضياً
  if (founderContent) {
  founderContent.classList.toggle("hidden", !(loggedIn && isSuper));
}
  // تفعيل أزرار العقد حسب حالة الدخول
  setTreeActions(loggedIn, { onAdd: nodeAdd, onEdit: nodeEdit, onDelete: nodeDelete });
}

async function reloadTree() {
  familyData = await loadFamily();
  renderTree(familyData);
  populateAllDropdowns(familyData);
}

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
      </div>`;
    listEl.appendChild(row);
  });
  listEl.querySelectorAll(".user-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const username = btn.dataset.user;
      openModal({
        title: "حذف مستخدم",
        bodyHTML: `<p class="modal-text">حذف المستخدم <span class="modal-highlight">${username}</span>؟</p>`,
        confirmText: "حذف", danger: true,
        onConfirm: async () => {
          const res = await deleteUser(username);
          if (!res.success) { alert(res.message || "خطأ"); return true; }
          await reloadUsers();
        }
      });
    });
  });
  listEl.querySelectorAll(".user-reset").forEach(btn => {
    btn.addEventListener("click", () => {
      const username = btn.dataset.user;
      openModal({
        title: `كلمة مرور جديدة لـ ${username}`,
        bodyHTML: `<label>كلمة المرور الجديدة</label><input id="mPassInput" type="text" placeholder="6 أحرف على الأقل"/>`,
        confirmText: "تغيير", focusId: "mPassInput",
        onConfirm: async () => {
          const p = document.getElementById("mPassInput").value.trim();
          if (p.length < 6) { alert("كلمة المرور قصيرة."); return true; }
          const res = await resetUserPassword(username, p);
          if (!res.success) { alert(res.message || "خطأ"); return true; }
          alert("✅ تم تغيير كلمة المرور");
        }
      });
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
    loggedIn = false; isSuper = false;
    updateAdminUI();
    await reloadTree();
  });

  document.getElementById("btnSetFounder").addEventListener("click", async () => {
    if (!loggedIn) return alert("الرجاء تسجيل الدخول.");
    const id = document.getElementById("founderTarget").value;
    if (!id) return alert("اختر شخصاً.");
    const res = await setFounder(id);
    if (res.success) { await reloadTree(); alert("✅ تم تعيين المؤسس"); }
    else alert(res.message || "خطأ");
  });

  const btnAddUser = document.getElementById("btnAddUser");
  if (btnAddUser) {
    btnAddUser.addEventListener("click", async () => {
      if (!isSuper) return alert("هذه العملية للمسؤول الرئيسي فقط.");
      const username = document.getElementById("newUserName").value.trim();
      const password = document.getElementById("newUserPass").value.trim();
      if (!username || !password) return alert("املأ الاسم وكلمة المرور.");
      const res = await addUser(username, password);
      if (res.success) {
        document.getElementById("newUserName").value = "";
        document.getElementById("newUserPass").value = "";
        await reloadUsers();
        alert("✅ تم إضافة المستخدم");
      } else alert(res.message || "خطأ في الإضافة");
    });
  }
}

async function init() {
  togglePanelHotkey(panel, app);
  initTabs();

  const auth = await checkAuth();
  loggedIn = !!auth.authenticated;
  isSuper = !!auth.isSuper;

  initTree("#svg");
  updateAdminUI();      // يضبط أزرار الشجرة قبل أول رسم
  await reloadTree();

  if (loggedIn && isSuper) await reloadUsers();

  bindEvents();
}

init();

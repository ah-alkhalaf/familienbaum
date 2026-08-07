require("dotenv").config();

const https = require("https");
const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "geheim",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: 1000 * 60 * 60 * 8 // 8 Stunden
  }
}));

// ==== Pfade ====
const FAMILY_PATH = path.join(__dirname, "family.json");
const BACKUP_DIR = path.join(__dirname, "backups");

// ==== GitHub Helpers (generisch für أي ملف) ====
function ghLoad(file) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${repo}/contents/${file}`,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "familienbaum-app",
        "Accept": "application/vnd.github+json"
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.content) {
            const content = Buffer.from(json.content, "base64").toString("utf-8");
            resolve({ data: JSON.parse(content), sha: json.sha });
          } else {
            // الملف غير موجود
            resolve({ data: null, sha: null });
          }
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function ghSave(file, data, sha, message) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  return new Promise((resolve, reject) => {
    const bodyObj = { message: message || "update", content };
    if (sha) bodyObj.sha = sha;
    const body = JSON.stringify(bodyObj);
    const options = {
      hostname: "api.github.com",
      path: `/repos/${repo}/contents/${file}`,
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "familienbaum-app",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ==== Family Load/Save ====
async function loadFamily() {
  const file = process.env.GITHUB_FILE || "family.json";
  return ghLoad(file);
}
async function saveFamily(data, sha) {
  const file = process.env.GITHUB_FILE || "family.json";
  return ghSave(file, data, sha, "Familienbaum aktualisiert");
}

// ==== Users Load/Save ====
const USERS_FILE = "users.json";
async function loadUsers() {
  const result = await ghLoad(USERS_FILE);
  if (!result.data) return { data: [], sha: null };
  return result;
}
async function saveUsers(users, sha) {
  return ghSave(USERS_FILE, users, sha, "Users aktualisiert");
}

// ==== Baum Hilfsfunktionen ====
function walk(node, parent = null, fn) {
  fn(node, parent);
  (node.children || []).forEach(child => walk(child, node, fn));
}
function findById(root, id) {
  let found = null;
  walk(root, null, (node) => { if (node._id === id) found = node; });
  return found;
}
function findParentOf(root, id) {
  let parent = null;
  walk(root, null, (node, p) => { if (node._id === id) parent = p; });
  return parent;
}
function isDescendant(root, ancestorId, candidateId) {
  const ancestor = findById(root, ancestorId);
  if (!ancestor) return false;
  let found = false;
  walk(ancestor, null, (node) => { if (node._id === candidateId) found = true; });
  return found;
}

// ==== Auth Middleware ====
// أي مسؤول (رئيسي أو عادي)
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin === true) return next();
  return res.status(401).json({ success: false, message: "غير مصرّح" });
}
// المسؤول الرئيسي فقط
function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true && req.session.isSuper === true) return next();
  return res.status(403).json({ success: false, message: "هذه العملية للمسؤول الرئيسي فقط" });
}

// ==== Family Routen ====
app.get("/family", async (req, res) => {
  const { data } = await loadFamily();
  res.json(data);
});

app.post("/addPerson", requireAuth, async (req, res) => {
  const { name, parentId } = req.body;
  const { data, sha } = await loadFamily();
  const parent = parentId ? findById(data, parentId) : data;
  if (!parent) return res.json({ success: false, message: "الأب غير موجود" });
  if (!parent.children) parent.children = [];
  parent.children.push({ _id: crypto.randomUUID(), name, children: [] });
  await saveFamily(data, sha);
  res.json({ success: true, data });
});

app.post("/addMultiple", requireAuth, async (req, res) => {
  const { names, parentId } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    return res.json({ success: false, message: "لا توجد أسماء" });
  }
  const { data, sha } = await loadFamily();
  const parent = parentId ? findById(data, parentId) : data;
  if (!parent) return res.json({ success: false, message: "الأب غير موجود" });
  if (!parent.children) parent.children = [];
  names.forEach(name => {
    if (name.trim()) parent.children.push({ _id: crypto.randomUUID(), name: name.trim(), children: [] });
  });
  await saveFamily(data, sha);
  res.json({ success: true, data });
});

app.post("/renamePerson", requireAuth, async (req, res) => {
  const { id, newName } = req.body;
  const { data, sha } = await loadFamily();
  const person = findById(data, id);
  if (!person) return res.json({ success: false, message: "الشخص غير موجود" });
  person.name = newName;
  await saveFamily(data, sha);
  res.json({ success: true, data });
});

app.post("/movePerson", requireAuth, async (req, res) => {
  const { id, newParentId } = req.body;
  const { data, sha } = await loadFamily();
  const person = findById(data, id);
  const oldParent = findParentOf(data, id);
  const newParent = findById(data, newParentId);
  if (!person || !oldParent || !newParent) return res.json({ success: false, message: "معرّفات غير صالحة" });
  if (isDescendant(person, id, newParentId)) return res.json({ success: false, message: "لا يمكن النقل إلى أحد الأبناء" });
  oldParent.children = oldParent.children.filter(c => c._id !== id);
  if (!newParent.children) newParent.children = [];
  newParent.children.push(person);
  await saveFamily(data, sha);
  res.json({ success: true, data });
});

app.post("/deletePerson", requireAuth, async (req, res) => {
  const { id } = req.body;
  const { data, sha } = await loadFamily();
  const parent = findParentOf(data, id);
  if (!parent) return res.json({ success: false, message: "لا يمكن حذف الجذر" });
  parent.children = parent.children.filter(c => c._id !== id);
  await saveFamily(data, sha);
  res.json({ success: true, data });
});

app.post("/setFounder", requireAuth, async (req, res) => {
  const { id } = req.body;
  const { data, sha } = await loadFamily();
  function clearFounder(node) {
    delete node.isFounder;
    (node.children || []).forEach(clearFounder);
  }
  clearFounder(data);
  const person = findById(data, id);
  if (!person) return res.json({ success: false, message: "الشخص غير موجود" });
  person.isFounder = true;
  await saveFamily(data, sha);
  res.json({ success: true, data });
});

// ==== Export (من GitHub) ====
app.get("/export", requireAuth, async (req, res) => {
  const { data } = await loadFamily();
  res.setHeader("Content-Disposition", "attachment; filename=family.json");
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(data, null, 2));
});

// ==== Auth Routen ====
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // 1) المسؤول الرئيسي (من متغيرات Railway)
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.isAdmin = true;
    req.session.isSuper = true;
    req.session.username = username;
    return res.json({ success: true, isSuper: true, username });
  }

  // 2) مسؤول عادي (من users.json)
  try {
    const { data: users } = await loadUsers();
    const user = (users || []).find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      req.session.isAdmin = true;
      req.session.isSuper = false;
      req.session.username = username;
      return res.json({ success: true, isSuper: false, username });
    }
  } catch (e) {
    console.error("Login-Fehler beim Laden der Users:", e.message);
  }

  res.json({ success: false, message: "بيانات الدخول غير صحيحة" });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get("/me", (req, res) => {
  res.json({
    authenticated: !!req.session?.isAdmin,
    isSuper: !!req.session?.isSuper,
    username: req.session?.username || null
  });
});

// ==== User-Management (nur Super-Admin) ====

// قائمة المستخدمين (بدون كلمات المرور)
app.get("/users", requireSuperAdmin, async (req, res) => {
  const { data: users } = await loadUsers();
  const safe = (users || []).map(u => ({ username: u.username, createdAt: u.createdAt || null }));
  res.json(safe);
});

// إضافة مستخدم
app.post("/users/add", requireSuperAdmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: "الاسم وكلمة المرور مطلوبان" });
  if (username.length < 3) return res.json({ success: false, message: "اسم المستخدم قصير جداً (3 أحرف على الأقل)" });
  if (password.length < 6) return res.json({ success: false, message: "كلمة المرور قصيرة جداً (6 أحرف على الأقل)" });
  if (username === process.env.ADMIN_USER) return res.json({ success: false, message: "هذا الاسم محجوز" });

  const { data: users, sha } = await loadUsers();
  const list = users || [];
  if (list.find(u => u.username === username)) {
    return res.json({ success: false, message: "اسم المستخدم موجود مسبقاً" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  list.push({ username, passwordHash, createdAt: new Date().toISOString() });
  await saveUsers(list, sha);
  res.json({ success: true });
});

// حذف مستخدم
app.post("/users/delete", requireSuperAdmin, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.json({ success: false, message: "الاسم مطلوب" });
  const { data: users, sha } = await loadUsers();
  const list = users || [];
  const filtered = list.filter(u => u.username !== username);
  if (filtered.length === list.length) {
    return res.json({ success: false, message: "المستخدم غير موجود" });
  }
  await saveUsers(filtered, sha);
  res.json({ success: true });
});

// تغيير كلمة مرور مستخدم
app.post("/users/reset-password", requireSuperAdmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: "الاسم وكلمة المرور مطلوبان" });
  if (password.length < 6) return res.json({ success: false, message: "كلمة المرور قصيرة جداً (6 أحرف على الأقل)" });
  const { data: users, sha } = await loadUsers();
  const list = users || [];
  const user = list.find(u => u.username === username);
  if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });
  user.passwordHash = await bcrypt.hash(password, 10);
  await saveUsers(list, sha);
  res.json({ success: true });
});

// ==== Server starten ====
app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});
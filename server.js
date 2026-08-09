require("dotenv").config();

const https = require("https");
const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

// ==== الأمان: رؤوس الحماية (Helmet) ====
// نسمح بموارد D3 والخطوط والصور الخارجية التي يستخدمها الموقع
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://d3js.org"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: "1mb" }));
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

// ==== الأمان: تحديد معدّل محاولات الدخول (Rate Limiting) ====
// 5 محاولات فاشلة كل 15 دقيقة من نفس المصدر
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,           // 15 دقيقة
  max: 5,                              // 5 محاولات
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,        // المحاولات الناجحة لا تُحسب
  message: { success: false, message: "محاولات كثيرة. حاول مجدداً بعد 15 دقيقة." },
  keyGenerator: (req) => req.ip
});

// حدّ عام أخف لبقية المسارات الحساسة (اختياري، يمنع الإساءة)
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,                 // دقيقة
  max: 40,                             // 40 عملية كتابة/دقيقة
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "عمليات كثيرة جداً. تمهّل قليلاً." }
});

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

// ==== الأمان: سجل العمليات (Audit Log) ====
const AUDIT_FILE = "audit.json";

async function loadAudit() {
  const result = await ghLoad(AUDIT_FILE);
  if (!result.data) return { data: [], sha: null };
  return result;
}

// يسجّل عملية دون إيقاف الطلب في حال الفشل
async function logAction(req, action, details = {}) {
  try {
    const { data: log, sha } = await loadAudit();
    const list = Array.isArray(log) ? log : [];
    list.push({
      time: new Date().toISOString(),
      user: req.session?.username || "غير معروف",
      role: req.session?.isSuper ? "رئيسي" : (req.session?.isAdmin ? "عادي" : "زائر"),
      action,
      details,
      ip: req.ip
    });
    // نحتفظ بآخر 1000 عملية فقط لمنع تضخّم الملف
    const trimmed = list.slice(-1000);
    await ghSave(AUDIT_FILE, trimmed, sha, `Audit: ${action}`);
  } catch (e) {
    console.error("تعذّر تسجيل العملية:", e.message);
  }
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
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin === true) return next();
  return res.status(401).json({ success: false, message: "غير مصرّح" });
}
function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true && req.session.isSuper === true) return next();
  return res.status(403).json({ success: false, message: "هذه العملية للمسؤول الرئيسي فقط" });
}

// ==== Family Routen ====
app.get("/family", async (req, res) => {
  const { data } = await loadFamily();
  res.json(data);
});

app.post("/addPerson", requireAuth, writeLimiter, async (req, res) => {
  const { name, parentId } = req.body;
  const { data, sha } = await loadFamily();
  const parent = parentId ? findById(data, parentId) : data;
  if (!parent) return res.json({ success: false, message: "الأب غير موجود" });
  if (!parent.children) parent.children = [];
  parent.children.push({ _id: crypto.randomUUID(), name, children: [] });
  await saveFamily(data, sha);
  logAction(req, "إضافة شخص", { name, parent: parent.name });
  res.json({ success: true, data });
});

app.post("/addMultiple", requireAuth, writeLimiter, async (req, res) => {
  const { names, parentId } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    return res.json({ success: false, message: "لا توجد أسماء" });
  }
  const { data, sha } = await loadFamily();
  const parent = parentId ? findById(data, parentId) : data;
  if (!parent) return res.json({ success: false, message: "الأب غير موجود" });
  if (!parent.children) parent.children = [];
  const added = [];
  names.forEach(name => {
    if (name.trim()) {
      parent.children.push({ _id: crypto.randomUUID(), name: name.trim(), children: [] });
      added.push(name.trim());
    }
  });
  await saveFamily(data, sha);
  logAction(req, "إضافة عدة أشخاص", { names: added, parent: parent.name });
  res.json({ success: true, data });
});

app.post("/renamePerson", requireAuth, writeLimiter, async (req, res) => {
  const { id, newName } = req.body;
  const { data, sha } = await loadFamily();
  const person = findById(data, id);
  if (!person) return res.json({ success: false, message: "الشخص غير موجود" });
  const oldName = person.name;
  person.name = newName;
  await saveFamily(data, sha);
  logAction(req, "تغيير اسم", { from: oldName, to: newName });
  res.json({ success: true, data });
});

app.post("/movePerson", requireAuth, writeLimiter, async (req, res) => {
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
  logAction(req, "نقل شخص", { name: person.name, to: newParent.name });
  res.json({ success: true, data });
});

app.post("/deletePerson", requireAuth, writeLimiter, async (req, res) => {
  const { id } = req.body;
  const { data, sha } = await loadFamily();
  const person = findById(data, id);
  const parent = findParentOf(data, id);
  if (!parent) return res.json({ success: false, message: "لا يمكن حذف الجذر" });
  const deletedName = person ? person.name : "غير معروف";
  parent.children = parent.children.filter(c => c._id !== id);
  await saveFamily(data, sha);
  logAction(req, "حذف شخص", { name: deletedName, parent: parent.name });
  res.json({ success: true, data });
});

app.post("/setFounder", requireSuperAdmin, writeLimiter, async (req, res) => {
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
  logAction(req, "تعيين مؤسس", { name: person.name });
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
app.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  // 1) المسؤول الرئيسي (من متغيرات Railway)
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.isAdmin = true;
    req.session.isSuper = true;
    req.session.username = username;
    logAction(req, "تسجيل دخول", { role: "رئيسي" });
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
      logAction(req, "تسجيل دخول", { role: "عادي" });
      return res.json({ success: true, isSuper: false, username });
    }
  } catch (e) {
    console.error("Login-Fehler beim Laden der Users:", e.message);
  }

  // تسجيل محاولة فاشلة (دون كلمة المرور)
  logAction(req, "محاولة دخول فاشلة", { username: username || "" });
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
app.get("/users", requireSuperAdmin, async (req, res) => {
  const { data: users } = await loadUsers();
  const safe = (users || []).map(u => ({ username: u.username, createdAt: u.createdAt || null }));
  res.json(safe);
});

app.post("/users/add", requireSuperAdmin, writeLimiter, async (req, res) => {
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
  logAction(req, "إضافة مستخدم", { username });
  res.json({ success: true });
});

app.post("/users/delete", requireSuperAdmin, writeLimiter, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.json({ success: false, message: "الاسم مطلوب" });
  const { data: users, sha } = await loadUsers();
  const list = users || [];
  const filtered = list.filter(u => u.username !== username);
  if (filtered.length === list.length) {
    return res.json({ success: false, message: "المستخدم غير موجود" });
  }
  await saveUsers(filtered, sha);
  logAction(req, "حذف مستخدم", { username });
  res.json({ success: true });
});

app.post("/users/reset-password", requireSuperAdmin, writeLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: "الاسم وكلمة المرور مطلوبان" });
  if (password.length < 6) return res.json({ success: false, message: "كلمة المرور قصيرة جداً (6 أحرف على الأقل)" });
  const { data: users, sha } = await loadUsers();
  const list = users || [];
  const user = list.find(u => u.username === username);
  if (!user) return res.json({ success: false, message: "المستخدم غير موجود" });
  user.passwordHash = await bcrypt.hash(password, 10);
  await saveUsers(list, sha);
  logAction(req, "تغيير كلمة مرور مستخدم", { username });
  res.json({ success: true });
});

// ==== سجل العمليات (عرض — للمسؤول الرئيسي فقط) ====
app.get("/audit", requireSuperAdmin, async (req, res) => {
  const { data: log } = await loadAudit();
  // أحدث 100 عملية، بترتيب عكسي (الأحدث أولاً)
  const recent = (Array.isArray(log) ? log : []).slice(-100).reverse();
  res.json(recent);
});

// مسار فحص الصحة لـ Railway
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ==== Server starten ====
app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});

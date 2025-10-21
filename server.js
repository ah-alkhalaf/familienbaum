require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "geheim",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 // 1 Stunde
  }
}));

// ==== Pfade ====
const FAMILY_PATH = path.join(__dirname, "family.json");
const BACKUP_DIR = path.join(__dirname, "backups");
// Liste der Backups
app.get("/backups", requireAuth, (req, res) => {
  if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("family.backup-") && f.endsWith(".json"))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, mtime: stat.mtimeMs, size: stat.size };
    })
    .sort((a,b) => b.mtime - a.mtime);
  res.json(files);
});

// Restore aus Backup
app.post("/restore", requireAuth, (req, res) => {
  const { filename } = req.body || {};
  if (!filename || filename.includes("/") || filename.includes("\\")) {
    return res.json({ success:false, message:"Ungültiger Dateiname." });
  }
  const backupPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(backupPath)) {
    return res.json({ success:false, message:"Backup nicht gefunden." });
  }
  const data = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  fs.writeFileSync(FAMILY_PATH, JSON.stringify(data, null, 2), "utf-8");
  res.json({ success:true });
});

// Export aktueller Stammbaum
app.get("/export", requireAuth, (req, res) => {
  const data = fs.readFileSync(FAMILY_PATH);
  res.setHeader("Content-Disposition", "attachment; filename=family.json");
  res.setHeader("Content-Type", "application/json");
  res.send(data);
});

// ==== Hilfsfunktionen ====
function walk(node, parent = null, fn) {
  fn(node, parent);
  (node.children || []).forEach(child => walk(child, node, fn));
}

function findById(root, id) {
  let found = null;
  walk(root, null, (node) => {
    if (node._id === id) found = node;
  });
  return found;
}

function findParentOf(root, id) {
  let parent = null;
  walk(root, null, (node, p) => {
    if (node._id === id) parent = p;
  });
  return parent;
}

function isDescendant(root, ancestorId, candidateId) {
  const ancestor = findById(root, ancestorId);
  if (!ancestor) return false;
  let found = false;
  walk(ancestor, null, (node) => {
    if (node._id === candidateId) found = true;
  });
  return found;
}

function loadFamily() {
  if (!fs.existsSync(FAMILY_PATH)) {
    const root = {
      _id: "root",
      name: "Ali",
      children: []
    };
    fs.writeFileSync(FAMILY_PATH, JSON.stringify(root, null, 2), "utf-8");
  }

  const data = JSON.parse(fs.readFileSync(FAMILY_PATH, "utf-8"));
  return data;
}

function saveFamily(data) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(
    path.join(BACKUP_DIR, `backup-${timestamp}.json`),
    JSON.stringify(data, null, 2),
    "utf-8"
  );

  fs.writeFileSync(FAMILY_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  return res.status(401).json({ success: false, message: "Nicht autorisiert" });
}

// ==== API-Routen ====

// ✅ Family anzeigen
app.get("/family", (req, res) => {
  const data = loadFamily();
  res.json(data);
});

// ✅ Person hinzufügen
app.post("/addPerson", requireAuth, (req, res) => {
  const { name, parentId } = req.body;
  const data = loadFamily();

  const parent = parentId ? findById(data, parentId) : data;
  if (!parent) {
    return res.json({ success: false, message: "Vater nicht gefunden" });
  }

  const newPerson = {
    _id: crypto.randomUUID(),
    name,
    children: []
  };

  parent.children.push(newPerson);
  saveFamily(data);
  res.json({ success: true, data });
});

// ✅ Person umbenennen
app.post("/renamePerson", requireAuth, (req, res) => {
  const { id, newName } = req.body;
  const data = loadFamily();
  const person = findById(data, id);

  if (!person) {
    return res.json({ success: false, message: "Person nicht gefunden" });
  }

  person.name = newName;
  saveFamily(data);
  res.json({ success: true, data });
});

// ✅ Person verschieben
app.post("/movePerson", requireAuth, (req, res) => {
  const { id, newParentId } = req.body;
  const data = loadFamily();

  const person = findById(data, id);
  const oldParent = findParentOf(data, id);
  const newParent = findById(data, newParentId);

  if (!person || !oldParent || !newParent) {
    return res.json({ success: false, message: "Ungültige ID(s)" });
  }

  if (isDescendant(person, id, newParentId)) {
    return res.json({ success: false, message: "Kann nicht zu Nachkomme verschoben werden" });
  }

  oldParent.children = oldParent.children.filter(c => c._id !== id);
  newParent.children.push(person);

  saveFamily(data);
  res.json({ success: true, data });
});

// ✅ Person löschen
app.post("/deletePerson", requireAuth, (req, res) => {
  const { id } = req.body;
  const data = loadFamily();
  const parent = findParentOf(data, id);

  if (!parent) {
    return res.json({ success: false, message: "Stammbaum kann nicht gelöscht werden" });
  }

  parent.children = parent.children.filter(c => c._id !== id);
  saveFamily(data);
  res.json({ success: true, data });
});

// ==== Auth ====
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }

  res.json({ success: false, message: "Ungültige Zugangsdaten" });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get("/me", (req, res) => {
  res.json({ authenticated: !!req.session?.isAdmin });
});

// ==== Server starten ====
app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});

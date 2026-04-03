require("dotenv").config();

const https = require("https");
const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const crypto = require("crypto");

const app = express();
app.set("trust proxy", 1); // <- NEW
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "geheim",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "none", // <- edit from "lax"
    secure: true,
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

async function loadFamily() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const file = process.env.GITHUB_FILE;

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
        const json = JSON.parse(data);
        const content = Buffer.from(json.content, "base64").toString("utf-8");
        resolve({ data: JSON.parse(content), sha: json.sha });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function saveFamily(data, sha) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const file = process.env.GITHUB_FILE;

  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      message: "Familienbaum aktualisiert",
      content,
      sha
    });

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

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  return res.status(401).json({ success: false, message: "Nicht autorisiert" });
}

// ==== API-Routen ====

app.get("/family", async (req, res) => {
  const { data } = await loadFamily();
  res.json(data);
});

app.post("/addPerson", requireAuth, async (req, res) => {
  const { name, parentId } = req.body;
  const { data, sha } = await loadFamily();
  const parent = parentId ? findById(data, parentId) : data;
  if (!parent) return res.json({ success: false, message: "Vater nicht gefunden" });
  const newPerson = { _id: crypto.randomUUID(), name, children: [] };
  parent.children.push(newPerson);
  await saveFamily(data, sha);
  res.json({ success: true, data });
});

app.post("/renamePerson", requireAuth, async (req, res) => {
  const { id, newName } = req.body;
  const { data, sha } = await loadFamily();
  const person = findById(data, id);
  if (!person) return res.json({ success: false, message: "Person nicht gefunden" });
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
  if (!person || !oldParent || !newParent) return res.json({ success: false, message: "Ungültige ID(s)" });
  if (isDescendant(person, id, newParentId)) return res.json({ success: false, message: "Kann nicht zu Nachkomme verschoben werden" });
  oldParent.children = oldParent.children.filter(c => c._id !== id);
  newParent.children.push(person);
  await saveFamily(data, sha);
  res.json({ success: true, data });
});

app.post("/deletePerson", requireAuth, async (req, res) => {
  const { id } = req.body;
  const { data, sha } = await loadFamily();
  const parent = findParentOf(data, id);
  if (!parent) return res.json({ success: false, message: "Stammbaum kann nicht gelöscht werden" });
  parent.children = parent.children.filter(c => c._id !== id);
  await saveFamily(data, sha);
  res.json({ success: true, data });
});

// ✅ إضافة عدة أشخاص دفعة واحدة
app.post("/addMultiple", requireAuth, async (req, res) => {
  const { names, parentId } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    return res.json({ success: false, message: "لا توجد أسماء" });
  }
  const { data, sha } = await loadFamily();
  const parent = parentId ? findById(data, parentId) : data;
  if (!parent) return res.json({ success: false, message: "الأب غير موجود" });

  names.forEach(name => {
    if (name.trim()) {
      parent.children.push({ _id: crypto.randomUUID(), name: name.trim(), children: [] });
    }
  });

  await saveFamily(data, sha);
  res.json({ success: true, data });
});

// ✅ تعيين المؤسس (المبرمج)
app.post("/setFounder", requireAuth, async (req, res) => {
  const { id } = req.body;
  const { data, sha } = await loadFamily();

  // إزالة isFounder من جميع العقد أولاً
  function clearFounder(node) {
    delete node.isFounder;
    (node.children || []).forEach(clearFounder);
  }
  clearFounder(data);

  // تعيين المؤسس الجديد
  const person = findById(data, id);
  if (!person) return res.json({ success: false, message: "الشخص غير موجود" });
  person.isFounder = true;

  await saveFamily(data, sha);
  res.json({ success: true, data });
});

// ==== Auth ====
app.post("/login", (req, res) => {
  const { username, password } = req.body;
    // ← HIER die console.logs einfügen
  console.log("ENV USER:", process.env.ADMIN_USER);
  console.log("ENV PASS:", process.env.ADMIN_PASS);
  console.log("REQ USER:", username);
  console.log("REQ PASS:", password);
  
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

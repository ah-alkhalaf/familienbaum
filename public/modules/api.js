// modules/api.js
export async function loadFamily() {
  const res = await fetch("/family", { credentials: "same-origin" });
  return res.json();
}

export async function addPerson(name, parentId) {
  const res = await fetch("/addPerson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name, parentId })
  });
  return res.json();
}

export async function renamePerson(id, newName) {
  const res = await fetch("/renamePerson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ id, newName })
  });
  return res.json();
}

export async function movePerson(id, newParentId) {
  const res = await fetch("/movePerson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ id, newParentId })
  });
  return res.json();
}

export async function deletePerson(id) {
  const res = await fetch("/deletePerson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ id })
  });
  return res.json();
}

export function exportJson() {
  window.location.href = "/export";
}

export async function listBackups() {
  const res = await fetch("/backups", { credentials: "same-origin" });
  if (res.status === 401) return []; // nicht eingeloggt
  return res.json();
}
export async function restoreBackup(filename) {
  const res = await fetch("/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ filename })
  });
  return res.json();
}

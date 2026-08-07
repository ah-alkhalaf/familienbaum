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

export async function addMultiplePeople(names, parentId) {
  const res = await fetch("/addMultiple", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ names, parentId })
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

export async function setFounder(id) {
  const res = await fetch("/setFounder", {
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
  return [];
}

export async function restoreBackup(filename) {
  return { success: false, message: "الاستعادة عبر GitHub" };
}

// ==== إدارة المستخدمين ====
export async function listUsers() {
  const res = await fetch("/users", { credentials: "same-origin" });
  if (!res.ok) return [];
  return res.json();
}

export async function addUser(username, password) {
  const res = await fetch("/users/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

export async function deleteUser(username) {
  const res = await fetch("/users/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username })
  });
  return res.json();
}

export async function resetUserPassword(username, password) {
  const res = await fetch("/users/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username, password })
  });
  return res.json();
}
export async function exportJson() {
  const res = await fetch("/export", { method: "GET" });
  if (!res.ok) throw new Error("Export fehlgeschlagen");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "family.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function listBackups() {
  const res = await fetch("/backups");
  if (!res.ok) return [];
  return await res.json();
}

export async function restoreBackup(filename) {
  const res = await fetch("/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
  return await res.json();
}

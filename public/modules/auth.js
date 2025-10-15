// modules/auth.js
export async function checkAuth() {
  try {
    const res = await fetch("/me", { credentials: "same-origin" });
    const data = await res.json();
    return !!data.authenticated;
  } catch { return false; }
}

export async function login(username, password) {
  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

export async function logout() {
  await fetch("/logout", { method: "POST", credentials: "same-origin" });
}

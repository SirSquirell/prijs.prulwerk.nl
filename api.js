// Praten met de Worker. Het sessietoken staat in localStorage en gaat alleen mee in de Authorization-header.
const API = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:8787"
  : "https://prijswacht.prijswacht-worker.workers.dev";

const KEY = "prijswacht.sessie";

export function getToken() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    // Privémodus zonder opslag: dan blijf je alleen dit tabblad ingelogd.
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { body, method } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(API + path, { method: method ?? (body !== undefined ? "POST" : "GET"), headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "geen verbinding. probeer het zo nog eens.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, data.fout ?? "er ging iets mis");
  }
  return data;
}

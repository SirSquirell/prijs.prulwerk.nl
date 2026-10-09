// Willekeurige tokens, hashes en HMAC. Alles via WebCrypto.

export function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(text) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

async function hmacKey(secret) {
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET ontbreekt of is te kort");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// payload → "<base64url json>.<base64url hmac>"
export async function sign(secret, payload) {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}

// Geeft de payload terug, of null als de handtekening niet klopt.
export async function verifySigned(secret, token) {
  if (typeof token !== "string" || token.length > 4000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let sigBytes;
  try {
    sigBytes = fromB64url(sig);
  } catch {
    return null;
  }
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sigBytes, new TextEncoder().encode(body));
  if (!ok) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    return null;
  }
}

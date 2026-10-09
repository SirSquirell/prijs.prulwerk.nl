// Kleine HTTP-hulpjes: JSON, CORS, fouten.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function corsHeaders(env, request) {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// ORIGIN is de live site. ORIGINS_EXTRA (alleen lokaal, in .dev.vars) mag er een lijst bij zetten.
export function allowedOrigins(env) {
  return [env.ORIGIN, ...String(env.ORIGINS_EXTRA ?? "").split(",").map((s) => s.trim())].filter(Boolean);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function readJson(request) {
  if (!(request.headers.get("Content-Type") ?? "").includes("application/json")) throw new HttpError(415, "verwacht json");
  const text = await request.text();
  if (text.length > 20_000) throw new HttpError(413, "te groot");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "ongeldige json");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "ongeldige json");
  return parsed;
}

import {
  cleanupAuth,
  createInvite,
  deviceName,
  inviteInfo,
  inviteLink,
  listInvites,
  listUsers,
  loginOptions,
  loginVerify,
  logout,
  registerOptions,
  registerVerify,
  requireAdmin,
  requireUser,
  revokeUser,
} from "./auth.js";
import { checkOffer } from "./check.js";
import { BATCH_SIZE, CHECK_INTERVAL_MIN } from "./config.js";
import { claimDue, healthSummary } from "./db.js";
import { HttpError, corsHeaders, json, readJson } from "./http.js";
import { itemDetail, listItems } from "./items.js";
import { isoNow } from "./time.js";

export default {
  async scheduled(controller, env, ctx) {
    const now = isoNow(new Date(controller.scheduledTime));
    await runChecks(env, now);
    // Eens per uur opruimen: verlopen challenges, sessies en uitnodigingen.
    if (now.slice(14, 16) === "00") await cleanupAuth(env.DB, now);
  },

  async fetch(request, env) {
    const cors = corsHeaders(env, request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let response;
    try {
      response = await route(request, env, isoNow());
    } catch (err) {
      if (err instanceof HttpError) {
        response = json({ fout: err.message }, err.status);
      } else {
        console.error(err?.stack ?? String(err));
        response = json({ fout: "er ging iets mis" }, 500);
      }
    }
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
    return response;
  },
};

async function route(request, env, now) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/") {
    return json({ naam: "prijswacht", ...(await healthSummary(env.DB, now)) });
  }

  // Openbaar: uitnodiging bekijken, registreren, inloggen. Tokens altijd in de body, nooit in de url.
  if (method === "POST" && path === "/api/uitnodiging") return json(await inviteInfo(env, await readJson(request), now));
  if (method === "POST" && path === "/api/registreren/opties") return json(await registerOptions(env, await readJson(request), now));
  if (method === "POST" && path === "/api/registreren") return json(await registerVerify(env, await readJson(request), now, deviceName(request)));
  if (method === "POST" && path === "/api/inloggen/opties") return json(await loginOptions(env, now));
  if (method === "POST" && path === "/api/inloggen") return json(await loginVerify(env, await readJson(request), now, deviceName(request)));

  if (method === "GET" && path === "/api/ik") {
    const user = await requireUser(env, request, now);
    return json({ id: user.id, name: user.name, isAdmin: user.isAdmin });
  }
  if (method === "POST" && path === "/api/uitloggen") {
    await logout(env, await requireUser(env, request, now));
    return json({ ok: true });
  }
  if (method === "GET" && path === "/api/items") return json(await listItems(env, await requireUser(env, request, now), now));
  const item = path.match(/^\/api\/items\/(\d+)$/);
  if (method === "GET" && item) return json(await itemDetail(env, await requireUser(env, request, now), Number(item[1]), now));

  // Beheer
  if (path === "/api/beheer/uitnodigingen") {
    const admin = await requireAdmin(env, request, now);
    if (method === "GET") return json({ invites: await listInvites(env, now) });
    if (method === "POST") {
      const body = await readJson(request);
      const userId = Number.isInteger(body.userId) ? body.userId : null;
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) || null : null;
      const { token, expiresAt } = await createInvite(env.DB, { name, userId, createdBy: admin.id }, now);
      return json({ link: inviteLink(env, token), expires_at: expiresAt });
    }
  }
  if (method === "GET" && path === "/api/beheer/gebruikers") {
    await requireAdmin(env, request, now);
    return json({ users: await listUsers(env) });
  }
  const revoke = path.match(/^\/api\/beheer\/gebruikers\/(\d+)\/intrekken$/);
  if (method === "POST" && revoke) {
    await revokeUser(env, await requireAdmin(env, request, now), Number(revoke[1]));
    return json({ ok: true });
  }

  throw new HttpError(404, "niet gevonden");
}

export async function runChecks(env, now, fetchImpl = fetch) {
  const offers = await claimDue(env.DB, now, CHECK_INTERVAL_MIN, BATCH_SIZE);
  const results = [];
  for (const offer of offers) {
    const result = await checkOffer(env, offer, now, fetchImpl);
    console.log(JSON.stringify({ offer: offer.id, shop: offer.shop, status: result.status, http: result.httpStatus, detail: result.detail }));
    results.push(result);
  }
  return results;
}

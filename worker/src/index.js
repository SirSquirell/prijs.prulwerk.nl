import { BATCH_SIZE, CHECK_INTERVAL_MIN } from "./config.js";
import { checkOffer } from "./check.js";
import { claimDue, healthSummary } from "./db.js";
import { isoNow } from "./time.js";

export default {
  async scheduled(controller, env, ctx) {
    await runChecks(env, isoNow(new Date(controller.scheduledTime)));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      const body = { naam: "prijswacht", ...(await healthSummary(env.DB, isoNow())) };
      return Response.json(body, { headers: { "Cache-Control": "no-store" } });
    }
    return new Response("niet gevonden\n", { status: 404 });
  },
};

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

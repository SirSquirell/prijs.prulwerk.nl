// Eén aanbieding ophalen: robots.txt, pagina, uitlezen, opslaan.
import { FETCH_TIMEOUT_MS, MAX_REDIRECTS, ROBOTS_MAX_BYTES, ROBOTS_RETRY_MIN, ROBOTS_TOKEN, ROBOTS_TTL_MIN, USER_AGENT } from "./config.js";
import { getRobotsCache, putRobotsCache, saveResult } from "./db.js";
import { extractPage } from "./extract.js";
import { interpretPage } from "./interpret.js";
import { isAllowed, robotsFromStatus } from "./robots.js";
import { minutesAgo } from "./time.js";

const HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "nl-NL,nl;q=0.9",
};

export async function checkOffer(env, offer, now, fetchImpl = fetch) {
  let result;
  try {
    result = await fetchAndInterpret(env, offer, now, fetchImpl);
  } catch (err) {
    result = { status: "fout", httpStatus: null, priceCents: null, inStock: null, detail: String(err?.message ?? err).slice(0, 200) };
  }
  await saveResult(env.DB, offer, result, now);
  return result;
}

async function fetchAndInterpret(env, offer, now, fetchImpl) {
  let url = new URL(offer.url);
  for (let hop = 0; ; hop++) {
    const robots = await loadRobots(env.DB, url.origin, now, fetchImpl);
    if (!isAllowed(robots, ROBOTS_TOKEN, url.pathname + url.search)) {
      return { status: "robots", httpStatus: null, priceCents: null, inStock: null, detail: hop ? "robots.txt verbiedt het doel van de redirect" : "robots.txt verbiedt dit pad" };
    }
    const response = await fetchImpl(url.href, { headers: HEADERS, redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("Location") : null;
    if (!location) {
      const ok = response.status >= 200 && response.status < 300;
      const page = ok ? await extractPage(response, offer.shop) : await discard(response);
      return interpretPage({ httpStatus: response.status, page, shop: offer.shop });
    }
    await discard(response);
    if (hop >= MAX_REDIRECTS) return { status: "fout", httpStatus: response.status, priceCents: null, inStock: null, detail: "te veel redirects" };
    url = new URL(location, url); // relatieve Location mag
    if (url.protocol !== "https:") return { status: "fout", httpStatus: response.status, priceCents: null, inStock: null, detail: "redirect naar " + url.protocol };
  }
}

async function discard(response) {
  await response.body?.cancel();
  return null;
}

async function loadRobots(db, origin, now, fetchImpl) {
  const cached = await getRobotsCache(db, origin);
  // Een 5xx of geen antwoord kort bewaren: één hapering mag een winkel geen etmaal stilleggen.
  const ttl = cached && (cached.http_status ?? 599) >= 500 ? ROBOTS_RETRY_MIN : ROBOTS_TTL_MIN;
  if (cached && cached.fetched_at > minutesAgo(now, ttl)) {
    return robotsFromStatus(cached.http_status ?? 599, cached.body ?? "");
  }
  let status = 599;
  let body = "";
  try {
    const res = await fetchImpl(origin + "/robots.txt", { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    status = res.status;
    body = res.ok ? (await res.text()).slice(0, ROBOTS_MAX_BYTES) : (await res.body?.cancel(), "");
  } catch {
    // Geen antwoord telt als 5xx: alles dicht tot de volgende poging.
  }
  await putRobotsCache(db, origin, now, status, body);
  return robotsFromStatus(status, body);
}

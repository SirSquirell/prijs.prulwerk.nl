import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "../src/auth.js";
import worker, { runChecks } from "../src/index.js";

const NOW = "2026-10-09T10:00:00Z";
const ld = (name, price, gtin) =>
  `<html><head><title>${name} | Winkel</title></head><body><script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name,
    gtin13: gtin,
    image: "https://img.example/x.jpg",
    offers: { "@type": "Offer", price, priceCurrency: "EUR", availability: "InStock" },
  })}</script></body></html>`;

const CB = "https://www.coolblue.nl/product/1/switch-2.html";
const MM = "https://www.mediamarkt.nl/nl/product/_switch-2-123.html";
const EAN = "4548736173293";

function shops(pages) {
  return async (url) => {
    const u = String(url);
    if (u.endsWith("/robots.txt")) return new Response("", { status: 200 });
    const p = pages[u];
    return p ? new Response(p, { headers: { "content-type": "text/html" } }) : new Response("weg", { status: 404 });
  };
}

async function call(path, token, { body, method } = {}) {
  const headers = { Origin: "https://prijs.prulwerk.nl", Authorization: `Bearer ${token}` };
  if (body) headers["Content-Type"] = "application/json";
  const res = await worker.fetch(new Request(`https://api.test${path}`, { method: method ?? (body ? "POST" : "GET"), headers, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: res.status, body: await res.json() };
}

let mathijs;
let sanne;
beforeEach(async () => {
  for (const t of ["watches", "sessions", "passkeys", "invites", "users", "price_points", "price_daily", "robots", "offers", "products"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, name, webauthn_id, is_admin, created_at) VALUES (1, 'Mathijs', 'w1', 1, ?1)").bind(NOW),
    env.DB.prepare("INSERT INTO users (id, name, webauthn_id, is_admin, created_at) VALUES (2, 'Sanne', 'w2', 0, ?1)").bind(NOW),
  ]);
  mathijs = await createSession(env.DB, 1, "test", NOW);
  sanne = await createSession(env.DB, 2, "test", NOW);
});

// Elke cron-aanroep doet één aanbieding; draai er een paar.
async function cron(pages, n = 3) {
  for (let i = 0; i < n; i++) await runChecks(env, NOW, shops(pages));
}

describe("link plakken", () => {
  it("nieuw item: tijdelijke naam, na de eerste check de echte naam en prijs", async () => {
    const added = await call("/api/items", mathijs, { body: { url: `bekijk dit: ${CB}?utm_source=app` } });
    expect(added.status).toBe(200);
    let list = (await call("/api/items", mathijs)).body;
    expect(list.items[0]).toMatchObject({ name: "nieuw item bij coolblue", price: null, pending: true });

    await cron({ [CB]: ld("Nintendo Switch 2", 469, EAN) }, 1);
    list = (await call("/api/items", mathijs)).body;
    expect(list.items[0]).toMatchObject({ name: "Nintendo Switch 2", price: 46900, shop: "coolblue", pending: false });
    const p = await env.DB.prepare("SELECT ean, image_url, named FROM products").first();
    expect(p).toEqual({ ean: EAN, image_url: "https://img.example/x.jpg", named: 1 });
  });

  it("dezelfde link bij een vriend: hetzelfde item, met de geschiedenis die er al is", async () => {
    const a = await call("/api/items", mathijs, { body: { url: CB } });
    const b = await call("/api/items", sanne, { body: { url: CB } });
    expect(b.body).toEqual({ id: a.body.id, existing: true });
    expect((await env.DB.prepare("SELECT count(*) AS n FROM offers").first()).n).toBe(1);
  });

  it("zelfde EAN bij een andere winkel: één item met twee winkels, beide mensen volgen het", async () => {
    const a = await call("/api/items", mathijs, { body: { url: CB } });
    await call("/api/items", sanne, { body: { url: MM } });
    await cron({ [CB]: ld("Nintendo Switch 2", 469, EAN), [MM]: ld("Nintendo Switch 2 console", 459, EAN) }, 2);

    expect((await env.DB.prepare("SELECT count(*) AS n FROM products").first()).n).toBe(1);
    for (const token of [mathijs, sanne]) {
      const list = (await call("/api/items", token)).body;
      expect(list.items).toHaveLength(1);
      expect(list.items[0]).toMatchObject({ id: a.body.id, shops: 2, price: 45900, shop: "mediamarkt" });
    }
  });

  it("winkel erbij plakken bij een item", async () => {
    const a = await call("/api/items", mathijs, { body: { url: CB } });
    expect((await call(`/api/items/${a.body.id}/winkels`, mathijs, { body: { url: MM } })).status).toBe(200);
    expect((await call(`/api/items/${a.body.id}`, mathijs)).body.offers).toHaveLength(2);
    // niet bij een item dat je niet volgt
    expect((await call(`/api/items/${a.body.id}/winkels`, sanne, { body: { url: MM } })).status).toBe(404);
  });

  it("niet meer volgen: ophalen stopt als niemand het volgt, de geschiedenis blijft", async () => {
    const a = await call("/api/items", mathijs, { body: { url: CB } });
    await cron({ [CB]: ld("Switch", 469, EAN) }, 1);
    await call("/api/items", sanne, { body: { url: CB } });

    await call(`/api/items/${a.body.id}`, mathijs, { method: "DELETE" });
    expect((await env.DB.prepare("SELECT active FROM offers").first()).active).toBe(1);
    await call(`/api/items/${a.body.id}`, sanne, { method: "DELETE" });
    expect((await env.DB.prepare("SELECT active FROM offers").first()).active).toBe(0);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM price_points").first()).n).toBe(1);

    await call("/api/items", mathijs, { body: { url: CB } });
    expect((await env.DB.prepare("SELECT active, last_checked_at FROM offers").first())).toEqual({ active: 1, last_checked_at: null });
  });

  it("geen winkellink: duidelijke fout", async () => {
    const r = await call("/api/items", mathijs, { body: { url: "kijk hier eens naar" } });
    expect(r.status).toBe(400);
    expect(r.body.fout).toContain("geen winkellink");
  });

  it("zonder inloggen kan niemand iets toevoegen", async () => {
    expect((await call("/api/items", "x".repeat(43), { body: { url: CB } })).status).toBe(401);
  });
});

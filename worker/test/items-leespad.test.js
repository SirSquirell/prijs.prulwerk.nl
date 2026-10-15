import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { itemDetail, listItems } from "../src/items.js";

const NOW = "2026-10-09T10:00:00Z";
const U1 = { id: 1 };
const U2 = { id: 2 };

beforeEach(async () => {
  for (const t of ["watches", "price_points", "price_daily", "offers", "products", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, name, webauthn_id, is_admin, created_at) VALUES (1, 'mathijs', 'w1', 1, ?1)").bind(NOW),
    env.DB.prepare("INSERT INTO users (id, name, webauthn_id, is_admin, created_at) VALUES (2, 'sanne', 'w2', 0, ?1)").bind(NOW),
    env.DB.prepare("INSERT INTO products (id, name, created_at) VALUES (1, 'Product een', ?1)").bind(NOW),
    env.DB.prepare("INSERT INTO products (id, name, created_at) VALUES (2, 'Product twee', ?1)").bind(NOW),
    env.DB.prepare("INSERT INTO offers (id, product_id, shop, url, created_at) VALUES (1, 1, 'coolblue', 'https://www.coolblue.nl/a', ?1)").bind(NOW),
    env.DB.prepare("INSERT INTO offers (id, product_id, shop, url, created_at) VALUES (2, 1, 'amazon', 'https://www.amazon.nl/a', ?1)").bind(NOW),
    env.DB.prepare("INSERT INTO offers (id, product_id, shop, url, created_at) VALUES (3, 2, 'bol', 'https://www.bol.com/a', ?1)").bind(NOW),
    env.DB.prepare("INSERT INTO watches (user_id, product_id, created_at) VALUES (1, 1, ?1), (1, 2, ?1), (2, 2, ?1)").bind(NOW),
  ]);
});

const point = (offer, at, status, price = null, inStock = null) =>
  env.DB.prepare("INSERT INTO price_points (offer_id, checked_at, status, price_cents, in_stock) VALUES (?1, ?2, ?3, ?4, ?5)").bind(offer, at, status, price, inStock).run();
const daily = (offer, day, cents) =>
  env.DB.prepare("INSERT INTO price_daily (offer_id, day, min_cents, max_cents, close_cents) VALUES (?1, ?2, ?3, ?3, ?3)").bind(offer, day, cents).run();

describe("items", () => {
  it("ieder ziet alleen zijn eigen lijst", async () => {
    expect((await listItems(env, U1, NOW)).items).toHaveLength(2);
    expect((await listItems(env, U2, NOW)).items).toHaveLength(1);
    await expect(itemDetail(env, U2, 1, NOW)).rejects.toMatchObject({ status: 404 });
  });

  it("een mislukte laatste check geeft geen prijs, wel de oude prijs als terugval", async () => {
    await point(1, "2026-10-09T08:00:00Z", "ok", 35900, 1);
    await point(1, "2026-10-09T10:00:00Z", "fout");
    const d = await itemDetail(env, U1, 1, NOW);
    expect(d.price).toBeNull();
    expect(d.offers.find((o) => o.shop === "coolblue")).toMatchObject({ price: null, last_ok_price: 35900, status: "fout" });
  });

  it("winkels gesorteerd op prijs, zonder prijs achteraan", async () => {
    await point(1, "2026-10-09T08:00:00Z", "ok", 35900, 1);
    await point(2, "2026-10-09T08:01:00Z", "ok", 30071, 1);
    expect((await itemDetail(env, U1, 1, NOW)).offers.map((o) => o.shop)).toEqual(["amazon", "coolblue"]);

    await point(1, "2026-10-09T09:00:00Z", "geblokkeerd");
    const d = await itemDetail(env, U1, 1, NOW);
    expect(d.offers.map((o) => o.shop)).toEqual(["amazon", "coolblue"]);
    expect(d.shop).toBe("amazon");
  });

  it("zonder prijs sorteert de winkel achteraan", async () => {
    await point(1, "2026-10-09T08:00:00Z", "geblokkeerd");
    await point(2, "2026-10-09T08:01:00Z", "ok", 30071, 1);
    const d = await itemDetail(env, U1, 1, NOW);
    expect(d.offers.map((o) => o.shop)).toEqual(["amazon", "coolblue"]);
    expect(d.shop).toBe("amazon");
  });

  it("uitverkocht is niet de kopprijs", async () => {
    await point(2, "2026-10-09T08:00:00Z", "ok", 25000, 0);
    await point(1, "2026-10-09T08:01:00Z", "ok", 35900, 1);
    const d = await itemDetail(env, U1, 1, NOW);
    expect(d).toMatchObject({ price: 35900, shop: "coolblue" });
    expect(d.offers.find((o) => o.shop === "amazon")).toMatchObject({ price: 25000, in_stock: false });
  });

  it("weekverschil uit price_daily", async () => {
    await point(1, "2026-10-09T08:00:00Z", "ok", 32900, 1);
    await daily(1, "2026-10-02", 34900);
    await daily(1, "2026-10-09", 32900);
    const item = (await listItems(env, U1, NOW)).items.find((i) => i.id === 1);
    expect(item.delta).toEqual({ cents: -2000, since: "2026-10-02" });
  });

  it("weekverschil: alleen vandaag of alleen buiten het venster geeft null", async () => {
    await point(1, "2026-10-09T08:00:00Z", "ok", 32900, 1);
    await daily(1, "2026-10-09", 32900);
    expect((await listItems(env, U1, NOW)).items.find((i) => i.id === 1).delta).toBeNull();
    await daily(1, "2026-09-30", 30000);
    expect((await listItems(env, U1, NOW)).items.find((i) => i.id === 1).delta).toBeNull();
  });

  it("stats over 90 dagen", async () => {
    await daily(1, "2026-07-10", 30000); // 91 dagen terug: buiten het venster
    await daily(1, "2026-07-12", 31000); // 89 dagen terug: erbinnen
    await daily(1, "2026-10-09", 32000);
    const d = await itemDetail(env, U1, 1, NOW);
    expect(d.stats).toMatchObject({ days: 2, low: 31000, high: 32000 });
  });

  it("last_ok is de laatste geslaagde check, last_check de laatste poging", async () => {
    await env.DB.prepare("UPDATE offers SET last_checked_at = '2026-10-09T10:00:00Z' WHERE id = 1").run();
    await point(1, "2026-10-09T08:00:00Z", "ok", 35900, 1);
    await point(1, "2026-10-09T10:00:00Z", "fout");
    const r = await listItems(env, U1, NOW);
    expect(r.last_ok).toBe("2026-10-09T08:00:00Z");
    expect(r.last_check).toBe("2026-10-09T10:00:00Z");
  });

  it("zonder geslaagde check is last_ok null", async () => {
    await point(1, "2026-10-09T10:00:00Z", "fout");
    expect((await listItems(env, U1, NOW)).last_ok).toBeNull();
  });
});

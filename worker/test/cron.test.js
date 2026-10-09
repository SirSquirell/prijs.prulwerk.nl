import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_REDIRECTS } from "../src/config.js";
import { runChecks } from "../src/index.js";
import coolblue from "./fixtures/coolblue.html?raw";

const NOW = "2026-10-08T10:00:00Z";
const LATER = "2026-10-08T13:01:00Z";

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url) => {
    const u = String(url);
    calls.push(u);
    const r = routes[u];
    if (r instanceof Error) throw r;
    if (!r) return new Response("weg", { status: 404 });
    return new Response(r.body, { status: r.status ?? 200, headers: { "content-type": "text/html", ...(r.headers ?? {}) } });
  };
  fn.calls = calls;
  return fn;
}

const CB = "https://www.coolblue.nl/product/962722/sony-wh-1000xm6-zwart.html";
const BOL = "https://www.bol.com/nl/nl/p/x/9300000229857581/";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM price_points"),
    env.DB.prepare("DELETE FROM price_daily"),
    env.DB.prepare("DELETE FROM robots"),
    env.DB.prepare("DELETE FROM offers"),
    env.DB.prepare("DELETE FROM products"),
    env.DB.prepare("INSERT INTO products (id, name, created_at) VALUES (1, 'Sony WH-1000XM6 zwart', ?1)").bind(NOW),
    env.DB.prepare("INSERT INTO offers (id, product_id, shop, url, created_at) VALUES (1, 1, 'coolblue', ?1, ?2)").bind(CB, NOW),
    env.DB.prepare("INSERT INTO offers (id, product_id, shop, url, created_at) VALUES (2, 1, 'bol', ?1, ?2)").bind(BOL, NOW),
  ]);
});

const points = async () => (await env.DB.prepare("SELECT * FROM price_points ORDER BY offer_id, checked_at").all()).results;

describe("cron", () => {
  it("haalt per aanroep één aanbieding op en slaat de prijs op", async () => {
    const f = fakeFetch({
      "https://www.coolblue.nl/robots.txt": { status: 403, body: "" },
      [CB]: { body: coolblue },
      "https://www.bol.com/robots.txt": { body: "User-agent: *\nDisallow: /checkout" },
      [BOL]: { status: 403, body: "nee" },
    });
    await runChecks(env, NOW, f);
    await runChecks(env, "2026-10-08T10:01:00Z", f);
    await runChecks(env, "2026-10-08T10:02:00Z", f); // niets meer aan de beurt

    const p = await points();
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ offer_id: 1, status: "ok", price_cents: 35900, in_stock: 1, http_status: 200 });
    expect(p[1]).toMatchObject({ offer_id: 2, status: "geblokkeerd", price_cents: null, http_status: 403 });

    const daily = await env.DB.prepare("SELECT * FROM price_daily").all();
    expect(daily.results).toEqual([{ offer_id: 1, day: "2026-10-08", min_cents: 35900, max_cents: 35900, close_cents: 35900 }]);

    const offers = (await env.DB.prepare("SELECT id, last_status, last_error FROM offers ORDER BY id").all()).results;
    expect(offers).toEqual([
      { id: 1, last_status: "ok", last_error: null },
      { id: 2, last_status: "geblokkeerd", last_error: "http 403" },
    ]);
  });

  it("robots.txt wordt een dag bewaard", async () => {
    const f = fakeFetch({ "https://www.coolblue.nl/robots.txt": { body: "" }, [CB]: { body: coolblue } });
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    await runChecks(env, NOW, f);
    await runChecks(env, LATER, f);
    expect(f.calls.filter((u) => u.endsWith("/robots.txt"))).toHaveLength(1);
    expect(f.calls.filter((u) => u === CB)).toHaveLength(2);
  });

  it("een mislukte robots.txt wordt na een half uur opnieuw geprobeerd, niet pas morgen", async () => {
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    const kapot = fakeFetch({ "https://www.coolblue.nl/robots.txt": { status: 503, body: "" } });
    await runChecks(env, NOW, kapot);
    expect((await points())[0]).toMatchObject({ status: "robots" });
    const goed = fakeFetch({ "https://www.coolblue.nl/robots.txt": { body: "" }, [CB]: { body: coolblue } });
    await runChecks(env, LATER, goed);
    expect(goed.calls).toContain("https://www.coolblue.nl/robots.txt");
    expect((await points())[1]).toMatchObject({ status: "ok" });
  });

  it("houdt zich aan robots.txt", async () => {
    const f = fakeFetch({ "https://www.coolblue.nl/robots.txt": { body: "User-agent: *\nDisallow: /product/" } });
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    await runChecks(env, NOW, f);
    expect(f.calls).not.toContain(CB);
    expect((await points())[0]).toMatchObject({ status: "robots", price_cents: null });
  });

  it("netwerkfout wordt een fout, geen oude prijs", async () => {
    const f = fakeFetch({ "https://www.coolblue.nl/robots.txt": { body: "" }, [CB]: { body: coolblue } });
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    await runChecks(env, NOW, f);
    const kapot = fakeFetch({ "https://www.coolblue.nl/robots.txt": { body: "" }, [CB]: new Error("timeout") });
    await runChecks(env, LATER, kapot);
    const p = await points();
    expect(p[1]).toMatchObject({ status: "fout", price_cents: null, detail: "timeout" });
  });

  it("een afgebroken check wordt alsnog als fout vastgelegd", async () => {
    await env.DB.prepare("UPDATE offers SET last_status = 'bezig', last_checked_at = ?1 WHERE id = 1").bind("2026-10-08T06:00:00Z").run();
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    const f = fakeFetch({ "https://www.coolblue.nl/robots.txt": { body: "" }, [CB]: { body: coolblue } });
    await runChecks(env, NOW, f);
    const p = await points();
    expect(p.map((x) => x.status)).toEqual(["fout", "ok"]);
    expect(p[0]).toMatchObject({ detail: "afgebroken", checked_at: "2026-10-08T06:00:00Z" });
  });

  it("dagwaarden: min, max en slot", async () => {
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    const met = (prijs) =>
      fakeFetch({
        "https://www.coolblue.nl/robots.txt": { body: "" },
        [CB]: { body: `<script type="application/ld+json">{"@type":"Product","name":"x","offers":{"@type":"Offer","price":${prijs}}}</script>` },
      });
    await runChecks(env, "2026-10-08T06:00:00Z", met(300));
    await runChecks(env, "2026-10-08T09:01:00Z", met(280));
    await runChecks(env, "2026-10-08T12:02:00Z", met(320));
    await runChecks(env, "2026-10-08T22:30:00Z", met(310)); // 00:30 in Amsterdam: volgende dag
    const d = (await env.DB.prepare("SELECT day, min_cents, max_cents, close_cents FROM price_daily ORDER BY day").all()).results;
    expect(d).toEqual([
      { day: "2026-10-08", min_cents: 28000, max_cents: 32000, close_cents: 32000 },
      { day: "2026-10-09", min_cents: 31000, max_cents: 31000, close_cents: 31000 },
    ]);
  });

  it("uitverkocht: wel een meetpunt, geen dagwaarde", async () => {
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    const met = (prijs, availability) =>
      fakeFetch({
        "https://www.coolblue.nl/robots.txt": { body: "" },
        [CB]: { body: `<script type="application/ld+json">{"@type":"Product","name":"x","offers":{"@type":"Offer","price":${prijs},"availability":"https://schema.org/${availability}"}}</script>` },
      });
    await runChecks(env, NOW, met(199, "OutOfStock"));
    const p = await points();
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ status: "ok", price_cents: 19900, in_stock: 0 });
    expect((await env.DB.prepare("SELECT count(*) AS n FROM price_daily").first()).n).toBe(0);

    await runChecks(env, LATER, met(209, "InStock"));
    const d = (await env.DB.prepare("SELECT min_cents, max_cents, close_cents FROM price_daily").all()).results;
    expect(d).toEqual([{ min_cents: 20900, max_cents: 20900, close_cents: 20900 }]);
  });

  it("volgt een redirect en toetst robots.txt van de bestemming", async () => {
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    const f = fakeFetch({
      "https://www.coolblue.nl/robots.txt": { body: "" },
      [CB]: { status: 302, headers: { Location: "https://shop.example/p/1" } },
      "https://shop.example/robots.txt": { body: "User-agent: *\nDisallow: /p/" },
    });
    await runChecks(env, NOW, f);
    expect(f.calls).toContain("https://shop.example/robots.txt");
    expect(f.calls).not.toContain("https://shop.example/p/1");
    expect((await points())[0]).toMatchObject({ status: "robots" });
  });

  it("een toegestane redirect levert gewoon een prijs", async () => {
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    const f = fakeFetch({
      "https://www.coolblue.nl/robots.txt": { body: "" },
      [CB]: { status: 302, headers: { Location: "https://shop.example/p/1" } },
      "https://shop.example/robots.txt": { body: "" },
      "https://shop.example/p/1": { body: coolblue },
    });
    await runChecks(env, NOW, f);
    expect((await points())[0]).toMatchObject({ status: "ok", price_cents: 35900 });
    expect(f.calls.filter((u) => u === "https://shop.example/p/1")).toHaveLength(1);
  });

  it("redirectlus stopt na MAX_REDIRECTS", async () => {
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    const f = fakeFetch({
      "https://www.coolblue.nl/robots.txt": { body: "" },
      [CB]: { status: 302, headers: { Location: CB } },
    });
    await runChecks(env, NOW, f);
    expect((await points())[0]).toMatchObject({ status: "fout", detail: "te veel redirects" });
    expect(f.calls.filter((u) => u === CB)).toHaveLength(MAX_REDIRECTS + 1);
  });

  it("vult de EAN van het product als die nog leeg is", async () => {
    await env.DB.prepare("UPDATE offers SET active = 0 WHERE id = 2").run();
    const f = fakeFetch({
      "https://www.coolblue.nl/robots.txt": { body: "" },
      [CB]: { body: `<script type="application/ld+json">{"@type":"Product","gtin13":"4548736173293","offers":{"@type":"Offer","price":5}}</script>` },
    });
    await runChecks(env, NOW, f);
    expect((await env.DB.prepare("SELECT ean FROM products WHERE id = 1").first()).ean).toBe("4548736173293");
  });
});

describe("GET /", () => {
  it("geeft per winkel de statussen van het afgelopen etmaal, zonder productnamen", async () => {
    const worker = (await import("../src/index.js")).default;
    const f = fakeFetch({
      "https://www.coolblue.nl/robots.txt": { body: "" },
      [CB]: { body: coolblue },
      "https://www.bol.com/robots.txt": { body: "" },
      [BOL]: { status: 403, body: "" },
    });
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    await runChecks(env, now, f);
    await runChecks(env, now, f);
    const res = await worker.fetch(new Request("https://x/"), env);
    const body = await res.json();
    expect(body).toMatchObject({ naam: "prijswacht", products: 1, offers: 2, checks: 2, last_24h: { coolblue: { ok: 1 }, bol: { geblokkeerd: 1 } } });
    expect(JSON.stringify(body)).not.toContain("Sony");
    expect((await worker.fetch(new Request("https://x/iets"), env)).status).toBe(404);
  });
});

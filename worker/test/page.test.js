import { describe, expect, it } from "vitest";
import { extractPage } from "../src/extract.js";
import { interpretPage } from "../src/interpret.js";
import amazonCaptcha from "./fixtures/amazon-captcha.html?raw";
import amazon from "./fixtures/amazon.html?raw";
import coolblue from "./fixtures/coolblue.html?raw";

const html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html" } });

async function run(body, shop, status = 200) {
  const page = await extractPage(html(body, status), shop);
  return interpretPage({ httpStatus: status, page, shop });
}

describe("pagina's van echte winkels", () => {
  it("coolblue: JSON-LD Product", async () => {
    const r = await run(coolblue, "coolblue");
    expect(r).toMatchObject({ status: "ok", priceCents: 35900, inStock: true, name: "Sony WH-1000XM6 Zwart" });
  });

  it("amazon: prijs uit het prijsblok bovenaan, niet uit andere verkopers", async () => {
    const r = await run(amazon, "amazon");
    expect(r).toMatchObject({ status: "ok", priceCents: 29889, inStock: true });
  });

  it("amazon: zonder toegankelijkheidslabel via hele euro's plus centen", async () => {
    const zonderLabel = amazon.replace(/<span id="apex-pricetopay-accessibility-label"[\s\S]*?<\/span>/, "");
    expect(zonderLabel).not.toContain("apex-pricetopay-accessibility-label");
    const r = await run(zonderLabel, "amazon");
    expect(r).toMatchObject({ status: "ok", priceCents: 29889 });
  });

  it("amazon: captcha met status 200 is geblokkeerd, geen prijs", async () => {
    const r = await run(amazonCaptcha, "amazon");
    expect(r).toMatchObject({ status: "geblokkeerd", priceCents: null, detail: "captcha" });
  });
});

describe("statussen", () => {
  it("403 en 503 zijn geblokkeerd", async () => {
    expect((await run("nee", "bol", 403)).status).toBe("geblokkeerd");
    expect(interpretPage({ httpStatus: 503, page: null, shop: "amazon" }).status).toBe("geblokkeerd");
  });

  it("404 is een fout, geen prijs", () => {
    expect(interpretPage({ httpStatus: 404, page: null, shop: "bol" })).toMatchObject({ status: "fout", priceCents: null, detail: "http 404" });
  });

  it("pagina zonder product: geen_prijs", async () => {
    expect(await run("<html><body>hallo</body></html>", "bol")).toMatchObject({ status: "geen_prijs", priceCents: null, detail: "geen product op pagina" });
  });

  it("product zonder prijs: geen_prijs, wel naam", async () => {
    const body = `<script type="application/ld+json">{"@type":"Product","name":"x","offers":{"@type":"Offer"}}</script>`;
    expect(await run(body, "bol")).toMatchObject({ status: "geen_prijs", name: "x", detail: "product zonder prijs" });
  });

  it("valt terug op meta-tags", async () => {
    const body = `<html><head><meta property="product:price:amount" content="49.95"><meta property="product:price:currency" content="EUR"></head></html>`;
    expect(await run(body, "megekko")).toMatchObject({ status: "ok", priceCents: 4995, detail: "meta" });
  });

  it("meta in andere valuta telt niet", async () => {
    const body = `<meta property="product:price:amount" content="49.95"><meta property="product:price:currency" content="GBP">`;
    expect((await run(body, "x")).status).toBe("geen_prijs");
  });

  it("JSON-LD verspreid over meerdere chunks", async () => {
    const ld = `<script type="application/ld+json">{"@type":"Product","name":"x","gtin13":"4548736173293","offers":{"@type":"Offer","price":"12.34","priceCurrency":"EUR","availability":"InStock"}}</script>`;
    const parts = ["<html><body>", ...ld.match(/.{1,7}/gs), "</body></html>"];
    const stream = new ReadableStream({
      start(c) {
        for (const p of parts) c.enqueue(new TextEncoder().encode(p));
        c.close();
      },
    });
    const page = await extractPage(new Response(stream, { headers: { "content-type": "text/html" } }), "bol");
    expect(interpretPage({ httpStatus: 200, page, shop: "bol" })).toMatchObject({ status: "ok", priceCents: 1234, gtin: "4548736173293" });
  });
});

describe("naam uit de paginatitel", async () => {
  const { nameFromTitle } = await import("../src/interpret.js");
  it.each([
    ["Sony WH-1000XM6 Zwart | Coolblue - Voor 23.59u, morgen in huis", "Sony WH-1000XM6 Zwart"],
    ["Amazon.nl : SONY WH-1000XM6 draadloos", "SONY WH-1000XM6 draadloos"],
    ["bol.com | Sony WH-1000XM6", "Sony WH-1000XM6"],
    ["Philips Airfryer XXL - HD9285/96 - MediaMarkt", "Philips Airfryer XXL - HD9285/96"],
    ["", null],
  ])("%s", (title, expected) => {
    expect(nameFromTitle(title)).toBe(expected);
  });

  it("coolblue: naam en afbeelding uit JSON-LD", async () => {
    const r = await run(coolblue, "coolblue");
    expect(r.name).toBe("Sony WH-1000XM6 Zwart");
    expect(r.image).toMatch(/^https:\/\/image\.coolblue\.nl\//);
  });

  it("amazon: naam uit de titel als er geen JSON-LD is", async () => {
    const r = await run(amazon, "amazon");
    expect(r.name).toBe("sony wh-1000xm6");
  });

  it("captcha geeft geen naam", async () => {
    expect((await run(amazonCaptcha, "amazon")).name).toBeNull();
  });
});

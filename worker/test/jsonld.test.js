import { describe, expect, it } from "vitest";
import { productFromJsonLd } from "../src/jsonld.js";

const j = (o) => JSON.stringify(o);

describe("productFromJsonLd", () => {
  it("leest een gewoon Product met Offer", () => {
    const p = productFromJsonLd([
      j({ "@type": "BreadcrumbList" }),
      j({
        "@context": "https://schema.org",
        "@type": "Product",
        name: " Sony WH-1000XM6 ",
        gtin13: "4548736173293",
        offers: { "@type": "Offer", price: "359.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
      }),
    ]);
    expect(p).toEqual({ name: "Sony WH-1000XM6", gtin: "4548736173293", priceCents: 35900, currency: "EUR", inStock: true });
  });

  it("vindt een Product in @graph en in een lijst", () => {
    const p = productFromJsonLd([
      j([{ "@graph": [{ "@type": ["Thing", "Product"], name: "x", offers: [{ "@type": "Offer", price: 12.5, availability: "OutOfStock" }] }] }]),
    ]);
    expect(p.priceCents).toBe(1250);
    expect(p.inStock).toBe(false);
  });

  it("neemt bij een AggregateOffer de laagste prijs", () => {
    const p = productFromJsonLd([j({ "@type": "Product", name: "x", offers: { "@type": "AggregateOffer", lowPrice: "299.99", highPrice: "349", priceCurrency: "EUR" } })]);
    expect(p.priceCents).toBe(29999);
  });

  it("leest een prijs uit priceSpecification", () => {
    const p = productFromJsonLd([j({ "@type": "Product", name: "x", offers: { "@type": "Offer", priceSpecification: { price: 19.95, priceCurrency: "EUR" } } })]);
    expect(p.priceCents).toBe(1995);
  });

  it("schema.org-punt is een decimaalteken, geen duizendtal", () => {
    const p = productFromJsonLd([j({ "@type": "Product", name: "x", offers: { "@type": "Offer", price: "1299.5" } })]);
    expect(p.priceCents).toBe(129950);
  });

  it("geen prijs bij een andere valuta", () => {
    const p = productFromJsonLd([j({ "@type": "Product", name: "x", offers: { "@type": "Offer", price: 10, priceCurrency: "USD" } })]);
    expect(p.priceCents).toBeNull();
    expect(p.name).toBe("x");
  });

  it("onbekende voorraad blijft onbekend", () => {
    const p = productFromJsonLd([j({ "@type": "Product", name: "x", offers: { "@type": "Offer", price: 10 } })]);
    expect(p.inStock).toBeNull();
  });

  it("negeert kapotte JSON en geeft null zonder Product", () => {
    expect(productFromJsonLd(["{kapot", j({ "@type": "Organization" })])).toBeNull();
  });

  it("verdraagt regeleinden in strings", () => {
    const p = productFromJsonLd(['{"@type":"Product","name":"a\nb","offers":{"@type":"Offer","price":5}}']);
    expect(p.priceCents).toBe(500);
  });

  it("weigert een ongeldige EAN", () => {
    const p = productFromJsonLd([j({ "@type": "Product", gtin13: "123", offers: { "@type": "Offer", price: 5 } })]);
    expect(p.gtin).toBeNull();
  });
});

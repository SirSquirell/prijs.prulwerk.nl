import { describe, expect, it } from "vitest";
import { normalizeOfferUrl, shopFromUrl } from "../src/shops.js";

describe("shopFromUrl", () => {
  it("herkent winkels aan de host", () => {
    expect(shopFromUrl("https://www.bol.com/nl/nl/p/x/1/")).toBe("bol");
    expect(shopFromUrl("https://www.coolblue.nl/product/1")).toBe("coolblue");
    expect(shopFromUrl("https://shop.example/p")).toBe("shop.example");
  });
});

describe("normalizeOfferUrl", () => {
  it("haalt fragment en trackingparameters eraf", () => {
    expect(normalizeOfferUrl("https://www.amazon.nl/dp/B0X?ref_=share&tag=x#top")).toBe("https://www.amazon.nl/dp/B0X");
    expect(normalizeOfferUrl("https://www.bol.com/nl/nl/p/x/9300000229857581/?bltgh=abc")).toBe("https://www.bol.com/nl/nl/p/x/9300000229857581/");
  });
  it("laat andere parameters staan", () => {
    expect(normalizeOfferUrl("https://shop.example/p?id=5")).toBe("https://shop.example/p?id=5");
  });
  it("weigert http", () => {
    expect(() => normalizeOfferUrl("http://www.coolblue.nl/x")).toThrow(/https/);
  });
});

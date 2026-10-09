import { describe, expect, it } from "vitest";
import { normalizeProductUrl, shopFromUrl } from "../src/shops.js";

describe("normalizeProductUrl", () => {
  it.each([
    ["https://www.coolblue.nl/product/962722/sony-wh-1000xm6-zwart.html?ref=abc#reviews", "https://www.coolblue.nl/product/962722/sony-wh-1000xm6-zwart.html"],
    ["Bekijk dit op bol: https://www.bol.com/nl/nl/p/sony/9300000229857581/?bltgh=x&promo=y", "https://www.bol.com/nl/nl/p/sony/9300000229857581/"],
    ["https://www.amazon.nl/Sony-WH-1000XM6/dp/B0F2TT8Q7M/ref=sr_1_1?keywords=sony&qid=1", "https://www.amazon.nl/dp/B0F2TT8Q7M"],
    ["https://www.amazon.nl/gp/product/b0f2tt8q7m?psc=1", "https://www.amazon.nl/dp/B0F2TT8Q7M"],
    ["http://www.mediamarkt.nl/nl/product/_sony-123.html?utm_source=x&kleur=zwart", "https://www.mediamarkt.nl/nl/product/_sony-123.html?kleur=zwart"],
  ])("%s", (input, expected) => {
    expect(normalizeProductUrl(input)).toBe(expected);
  });

  it.each([["geen link"], [""], ["ftp://x.nl/a"], ["https://localhost/a"], ["https://127.0.0.1/a"], ["https://intern/a"], ["https://www.amazon.nl/s?k=sony"], ["https://x.nl:8080/a"]])(
    "weigert %s",
    (input) => {
      expect(normalizeProductUrl(input)).toBeNull();
    },
  );

  it("winkelnaam", () => {
    expect(shopFromUrl("https://www.bol.com/nl/")).toBe("bol");
    expect(shopFromUrl("https://www.wehkamp.nl/x")).toBe("wehkamp.nl");
  });
});

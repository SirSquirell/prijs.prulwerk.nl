import { describe, expect, it } from "vitest";
import { normalizeGtin, parsePriceToCents } from "../src/price.js";

describe("parsePriceToCents", () => {
  it.each([
    [359, 35900],
    [298.89, 29889],
    [0.1 + 0.2, 30],
    ["359", 35900],
    ["298,89", 29889],
    ["€ 298,89", 29889],
    ["€ 298,89", 29889],
    ["1.299,00", 129900],
    ["1.299", 129900],
    ["1,299.00", 129900],
    ["12.345.678,90", 1234567890],
    ["359,-", 35900],
    ["359.-", 35900],
    ["29,9", 2990],
    ["298,89 EUR", 29889],
  ])("%s → %s", (input, expected) => {
    expect(parsePriceToCents(input)).toBe(expected);
  });

  it.each([[0], [-5], [NaN], [""], ["gratis"], ["12,3456"], ["1.2.3"], [null], [undefined], ["$ 12"], [{}]])(
    "geen gok bij %s",
    (input) => {
      expect(parsePriceToCents(input)).toBeNull();
    },
  );
});

describe("normalizeGtin", () => {
  it("accepteert een geldige EAN-13", () => {
    expect(normalizeGtin("4548736173293")).toBe("4548736173293");
  });
  it("maakt van UPC-12 een EAN-13", () => {
    expect(normalizeGtin("012345678905")).toBe("0012345678905");
  });
  it("maakt van GTIN-14 met voorloopnul een EAN-13", () => {
    expect(normalizeGtin("04548736173293")).toBe("4548736173293");
  });
  it("weigert een fout controlecijfer", () => {
    expect(normalizeGtin("4548736173296")).toBeNull();
  });
  it("weigert rommel", () => {
    expect(normalizeGtin("abc")).toBeNull();
    expect(normalizeGtin(null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { lowestNow, median, seriesStats, shiftDay, weekDelta } from "../src/stats.js";

describe("stats", () => {
  it("mediaan", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3); // 2,5 afgerond
    expect(median([])).toBeNull();
  });

  it("laag, mediaan, hoog", () => {
    expect(seriesStats([{ low: 34900 }, { low: 31900 }, { low: 35900 }])).toEqual({ low: 31900, median: 34900, high: 35900, days: 3 });
    expect(seriesStats([])).toEqual({ low: null, median: null, high: null, days: 0 });
  });

  it("laagste nu negeert mislukte checks, ook als er een oude prijs is", () => {
    const offers = [
      { shop: "bol", last_point_status: "geblokkeerd", last_price: null },
      { shop: "coolblue", last_point_status: "ok", last_price: 35900 },
      { shop: "amazon", last_point_status: "ok", last_price: 30071 },
      { shop: "mediamarkt", last_point_status: "fout", last_price: 10000 },
    ];
    expect(lowestNow(offers)).toEqual({ cents: 30071, shop: "amazon" });
    expect(lowestNow([{ shop: "bol", last_point_status: "geblokkeerd" }])).toBeNull();
  });

  it("laagste nu slaat een winkel over die zegt dat het uitverkocht is", () => {
    const offers = [
      { shop: "coolblue", last_point_status: "ok", last_price: 29900, last_in_stock: 0 },
      { shop: "amazon", last_point_status: "ok", last_price: 35900, last_in_stock: null },
    ];
    expect(lowestNow(offers)).toEqual({ cents: 35900, shop: "amazon" });
    expect(lowestNow([offers[0]])).toBeNull();
  });

  it("verschil met een week geleden", () => {
    const series = [
      { day: "2026-10-01", low: 34900 },
      { day: "2026-10-02", low: 33900 },
      { day: "2026-10-08", low: 32900 },
    ];
    expect(weekDelta(32900, series, "2026-10-08")).toEqual({ cents: -2000, since: "2026-10-01" });
    expect(weekDelta(32900, series, "2026-10-09")).toEqual({ cents: -1000, since: "2026-10-02" });
    expect(weekDelta(32900, [{ day: "2026-10-08", low: 32900 }], "2026-10-08")).toBeNull();
    expect(weekDelta(null, series, "2026-10-08")).toBeNull();
  });

  it("dagen schuiven over een maandgrens", () => {
    expect(shiftDay("2026-11-02", -7)).toBe("2026-10-26");
  });
});

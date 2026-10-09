// Rekenwerk op prijsreeksen. Puur, zonder database: zo is het te testen.

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

// series: [{ day, low }] → laag, mediaan, hoog over de dagelijkse laagste prijs.
export function seriesStats(series) {
  const lows = series.map((d) => d.low).filter((x) => Number.isFinite(x));
  if (!lows.length) return { low: null, median: null, high: null, days: 0 };
  return { low: Math.min(...lows), median: median(lows), high: Math.max(...lows), days: lows.length };
}

// Huidige prijs per aanbieding: alleen als de laatste check gelukt is. Anders onbekend, nooit de oude prijs.
// offers: [{ shop, last_point_status, last_price, ... }] (status van de laatste check, niet "bezig") → { cents, shop } of null.
export function lowestNow(offers) {
  let best = null;
  for (const o of offers) {
    if (o.last_point_status !== "ok" || !Number.isFinite(o.last_price)) continue;
    if (!best || o.last_price < best.cents) best = { cents: o.last_price, shop: o.shop };
  }
  return best;
}

// Verschil met een week geleden: laagste prijs nu tegen de laagste dagprijs van 7 dagen terug
// (of de oudste dag die er is, als de geschiedenis korter is). null als er niets te vergelijken valt.
export function weekDelta(nowCents, series, today) {
  if (!Number.isFinite(nowCents) || !series.length) return null;
  const weekAgo = shiftDay(today, -7);
  const ref = series.find((d) => d.day >= weekAgo && Number.isFinite(d.low));
  if (!ref || ref.day === today) return null;
  return { cents: nowCents - ref.low, since: ref.day };
}

export function shiftDay(day, days) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

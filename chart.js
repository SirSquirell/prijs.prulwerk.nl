// Lijngrafiek van de laagste prijs per dag. Klein en zonder library.
import { dayLabel, euro } from "./format.js";
import { s } from "./dom.js";

const W = 316;
const H = 150;
const PAD_Y = 14;
const PAD_X = 6; // ruimte voor de stip aan het eind

export function priceChart(series, { today } = {}) {
  const pts = series.filter((d) => Number.isFinite(d.low));
  const lows = pts.map((d) => d.low);
  const min = Math.min(...lows);
  const max = Math.max(...lows);
  const span = max - min || Math.max(100, max * 0.05);
  const lo = max === min ? min - span / 2 : min;
  const y = (v) => PAD_Y + (H - 2 * PAD_Y) * (1 - (v - lo) / span);

  // x op kalenderdagen, zodat gaten in de geschiedenis ook gaten blijven.
  const t = (day) => Date.parse(`${day}T12:00:00Z`);
  const end = t(today ?? pts[pts.length - 1].day);
  const start = Math.min(t(pts[0].day), end - 86_400_000);
  const x = (day) => PAD_X + ((W - 2 * PAD_X) * (t(day) - start)) / (end - start || 1);

  const line = pts.map((d) => `${x(d.day).toFixed(1)},${y(d.low).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const label = `prijsverloop: laagst ${euro(min)}, hoogst ${euro(max)}, nu ${euro(last.low)}`;

  return s(
    "svg",
    { class: "chart", viewBox: `0 0 ${W} ${H + 16}`, role: "img", "aria-label": label },
    s("line", { class: "grid", x1: 0, x2: W, y1: y(min), y2: y(min) }),
    s("line", { class: "grid", x1: 0, x2: W, y1: y(max), y2: y(max) }),
    s("polyline", { class: "line", points: line }),
    s("circle", { class: "dot", cx: x(last.day), cy: y(last.low), r: 5 }),
    s("text", { x: 0, y: H + 12 }, dayLabel(pts[0].day)),
    s("text", { x: W, y: H + 12, "text-anchor": "end" }, "nu"),
  );
}

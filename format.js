// Bedragen en tijden zoals de app ze laat zien.
const TZ = "Europe/Amsterdam";

export function euro(cents) {
  if (cents == null) return "onbekend";
  const whole = cents % 100 === 0;
  return "€ " + (cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

export function deltaText(delta) {
  if (!delta) return null;
  if (delta.cents === 0) return { text: "= gelijk", cls: "flat" };
  const amount = euro(Math.abs(delta.cents));
  return delta.cents < 0 ? { text: `▼ ${amount} deze week`, cls: "down" } : { text: `▲ ${amount} deze week`, cls: "up" };
}

export function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("nl-NL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const day = (x) => x.toLocaleDateString("nl-NL", { timeZone: TZ });
  if (day(d) === day(new Date())) return time;
  return `${d.toLocaleDateString("nl-NL", { timeZone: TZ, day: "numeric", month: "short" }).replace(".", "")} ${time}`;
}

export function dayLabel(day) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("nl-NL", { timeZone: TZ, day: "numeric", month: "short" }).replace(".", "");
}

const STATUS = {
  geblokkeerd: "winkel weigert ons",
  geen_prijs: "geen prijs gevonden",
  robots: "winkel wil geen bots",
  fout: "ophalen mislukt",
  bezig: "wordt nu gecheckt",
};

export function offerMeta(o) {
  if (o.status === "ok") return `${o.in_stock === false ? "niet op voorraad" : o.in_stock ? "op voorraad" : "voorraad onbekend"} · ${when(o.checked_at)}`;
  const reason = STATUS[o.status] ?? "nog niet gecheckt";
  return o.last_ok_at ? `${reason} · laatst ${euro(o.last_ok_price)} om ${when(o.last_ok_at)}` : reason;
}

export const BLACK_FRIDAY = "2026-11-27";
export const START = "2026-10-08";

export function blackFriday(now = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const ms = (d) => Date.parse(`${d}T00:00:00Z`);
  const left = Math.round((ms(BLACK_FRIDAY) - ms(today)) / 86_400_000);
  const total = (ms(BLACK_FRIDAY) - ms(START)) / 86_400_000;
  return { left, progress: Math.min(1, Math.max(0, 1 - left / total)) };
}

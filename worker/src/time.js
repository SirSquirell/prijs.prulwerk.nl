import { TIME_ZONE } from "./config.js";

export function isoNow(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function minutesAgo(iso, minutes) {
  return isoNow(new Date(Date.parse(iso) - minutes * 60_000));
}

// Kalenderdag in Nederland, "JJJJ-MM-DD".
export function localDay(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

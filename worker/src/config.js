// Alle knoppen van het ophalen op één plek.

// Besluit 0007: eerlijke UA in browservorm, met contactadres.
export const USER_AGENT = "Mozilla/5.0 (compatible; prijswacht/1.0; +https://prijs.prulwerk.nl)";
// Het token waarmee we onszelf in robots.txt herkennen.
export const ROBOTS_TOKEN = "prijswacht";

// Hoe vaak een aanbieding opnieuw wordt opgehaald.
export const CHECK_INTERVAL_MIN = 180;
// Aanbiedingen per cron-aanroep. De cron draait elke minuut; het gratis plan geeft 10 ms CPU per
// aanroep, dus één per keer. 1440 checks per dag is genoeg voor 180 aanbiedingen elke 3 uur.
export const BATCH_SIZE = 1;

export const FETCH_TIMEOUT_MS = 15_000;
export const ROBOTS_TTL_MIN = 24 * 60;
export const ROBOTS_MAX_BYTES = 200_000;

export const TIME_ZONE = "Europe/Amsterdam";

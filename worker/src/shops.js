// Winkelnaam uit de host. Onbekende winkels krijgen hun domeinnaam.
const SHOPS = [
  ["bol.com", "bol"],
  ["coolblue.nl", "coolblue"],
  ["coolblue.be", "coolblue"],
  ["amazon.nl", "amazon"],
  ["mediamarkt.nl", "mediamarkt"],
  ["alternate.nl", "alternate"],
  ["megekko.nl", "megekko"],
];

export function shopFromUrl(url) {
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  for (const [domain, name] of SHOPS) {
    if (host === domain || host.endsWith("." + domain)) return name;
  }
  return host;
}

// Dezelfde pagina is dezelfde aanbieding: fragment en bekende trackingparameters eraf. Alleen https.
const TRACKING = /^(utm_|ref_?$|tag$|bltgh$|referrer$|gclid$|fbclid$|srsltid$)/;
export function normalizeOfferUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error(`alleen https: ${raw}`);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  return url.href;
}

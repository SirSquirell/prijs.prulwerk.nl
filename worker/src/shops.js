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

const TRACKING = /^(utm_.*|gclid|fbclid|msclkid|ref|ref_|referrer|cid|bltgh|bltg|promo|tag|linkCode|camp|creative|psc|th|smid|qid|sr|keywords|crid|sprefix|dib|dib_tag|pd_rd_.*|pf_rd_.*|content-id|spm)$/i;

// Een geplakte of gedeelde link netjes maken. Geeft null als het geen bruikbare winkellink is.
// Deelmenu's sturen soms tekst met een link erin ("Bekijk dit op bol: https://..."): de eerste link telt.
export function normalizeProductUrl(input) {
  const raw = String(input ?? "").trim().match(/https?:\/\/[^\s<>"']+/i)?.[0];
  if (!raw || raw.length > 2000) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  // Alleen gewone domeinnamen: geen ip-adressen, localhost of interne namen.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host) || url.port || url.username) return null;
  url.protocol = "https:";
  url.hash = "";

  const shop = shopFromUrl(url.href);
  if (shop === "amazon") {
    const asin = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
    if (!asin) return null;
    return `https://${host}/dp/${asin.toUpperCase()}`;
  }
  if (["bol", "coolblue"].includes(shop)) {
    url.search = "";
  } else {
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  }
  return url.href;
}

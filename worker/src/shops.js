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

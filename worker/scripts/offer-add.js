// Product met één of meer winkellinks toevoegen, tot er een scherm voor is (fase 3).
//   npm run offer:add -- "Sony WH-1000XM6 zwart" https://www.coolblue.nl/product/... https://www.amazon.nl/dp/...
//   npm run offer:add -- --local "..." <url>        (tegen de lokale database van wrangler dev)
import { execFileSync } from "node:child_process";
import { normalizeOfferUrl, shopFromUrl } from "../src/shops.js";

const args = process.argv.slice(2);
const local = args[0] === "--local";
if (local) args.shift();
const [name, ...rawUrls] = args;
if (!name || !rawUrls.length) {
  console.error('gebruik: npm run offer:add -- [--local] "productnaam" <url> [<url> ...]');
  process.exit(1);
}

let urls;
try {
  urls = rawUrls.map(normalizeOfferUrl);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const target = local ? "--local" : "--remote";

// Bestaat een link al, dan geen weesproduct aanmaken.
const found = JSON.parse(
  execFileSync("npx", ["wrangler", "d1", "execute", "prijswacht", target, "--json", "--command", `SELECT url FROM offers WHERE url IN (${urls.map(q).join(",")})`], { encoding: "utf8" }),
);
const known = found.flatMap((r) => r.results ?? []).map((r) => r.url);
if (known.length) {
  console.error("bestaat al: " + known.join(", "));
  process.exit(1);
}

const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const sql = [
  `INSERT INTO products (name, created_at) VALUES (${q(name)}, ${q(now)});`,
  ...urls.map((url) => `INSERT OR IGNORE INTO offers (product_id, shop, url, created_at) VALUES ((SELECT max(id) FROM products), ${q(shopFromUrl(url))}, ${q(url)}, ${q(now)});`),
  // Beheerders volgen alles wat erbij komt.
  `INSERT OR IGNORE INTO watches (user_id, product_id, created_at) SELECT id, (SELECT max(id) FROM products), ${q(now)} FROM users WHERE is_admin = 1;`,
].join("\n");

execFileSync("npx", ["wrangler", "d1", "execute", "prijswacht", target, "--command", sql], { stdio: "inherit" });

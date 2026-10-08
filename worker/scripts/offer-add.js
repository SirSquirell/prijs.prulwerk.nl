// Product met één of meer winkellinks toevoegen, tot er een scherm voor is (fase 3).
//   npm run offer:add -- "Sony WH-1000XM6 zwart" https://www.coolblue.nl/product/... https://www.amazon.nl/dp/...
//   npm run offer:add -- --local "..." <url>        (tegen de lokale database van wrangler dev)
import { execFileSync } from "node:child_process";
import { shopFromUrl } from "../src/shops.js";

const args = process.argv.slice(2);
const local = args[0] === "--local";
if (local) args.shift();
const [name, ...urls] = args;
if (!name || !urls.length) {
  console.error('gebruik: npm run offer:add -- [--local] "productnaam" <url> [<url> ...]');
  process.exit(1);
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const sql = [
  `INSERT INTO products (name, created_at) VALUES (${q(name)}, ${q(now)});`,
  ...urls.map((raw) => {
    const url = new URL(raw);
    url.hash = "";
    return `INSERT OR IGNORE INTO offers (product_id, shop, url, created_at) VALUES ((SELECT max(id) FROM products), ${q(shopFromUrl(url.href))}, ${q(url.href)}, ${q(now)});`;
  }),
].join("\n");

execFileSync("npx", ["wrangler", "d1", "execute", "prijswacht", local ? "--local" : "--remote", "--command", sql], { stdio: "inherit" });

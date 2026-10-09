// Uitnodiging maken zonder app, vanuit een sessie met CLOUDFLARE_API_TOKEN.
//   node scripts/setup-invite.js            eerste beheerder: alleen als er nog niemand is en er geen open setup-link is
//   node scripts/setup-invite.js --herstel  nieuwe passkey voor de beheerder (passkey kwijt)
// De link verschijnt alleen hier. Nooit in een commit, status.md of CI-log zetten. Geldig 24 uur.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

const ORIGIN = "https://prijs.prulwerk.nl";
const HOURS = 24;
const herstel = process.argv.includes("--herstel");
const local = process.argv.includes("--local");

const d1 = (sql) => {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "prijswacht", local ? "--local" : "--remote", "--json", "--command", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out)[0].results;
};

const now = new Date();
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
let userId = "NULL";

if (herstel) {
  const admin = d1("SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1")[0];
  if (!admin) throw new Error("er is nog geen beheerder; draai zonder --herstel");
  userId = String(admin.id);
} else {
  const users = d1("SELECT count(*) AS n FROM users")[0].n;
  if (users > 0) {
    console.log("er zijn al gebruikers; voor een nieuwe passkey: --herstel");
    process.exit(0);
  }
  const open = d1(`SELECT count(*) AS n FROM invites WHERE make_admin = 1 AND used_at IS NULL AND expires_at > '${iso(now)}'`)[0].n;
  if (open > 0) {
    console.log("er staat al een open setup-link; die is alleen eerder getoond. Wacht tot hij verloopt of gebruik --herstel na de eerste registratie.");
    process.exit(0);
  }
}

const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("base64url");
const expires = iso(new Date(now.getTime() + HOURS * 3600_000));
d1(
  `INSERT INTO invites (token_hash, name, user_id, make_admin, created_at, expires_at) VALUES ('${hash}', 'Mathijs', ${userId}, 1, '${iso(now)}', '${expires}')`,
);
console.log(`\n${ORIGIN}/#uitnodiging=${token}\n(geldig tot ${expires})\n`);

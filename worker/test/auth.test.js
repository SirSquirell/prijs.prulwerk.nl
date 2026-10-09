import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createInvite } from "../src/auth.js";
import { sha256 } from "../src/crypto.js";
import worker from "../src/index.js";
import { isoNow } from "../src/time.js";
import { createAuthenticator } from "./helpers/authenticator.js";

const ORIGIN = "https://prijs.prulwerk.nl";

async function call(path, { body, token, method = body ? "POST" : "GET", origin = ORIGIN } = {}) {
  const headers = { Origin: origin, "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit Safari/604.1" };
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await worker.fetch(new Request(`https://api.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
}

async function register(invite, auth, name = "Mathijs") {
  const opts = await call("/api/registreren/opties", { body: { invite, name } });
  expect(opts.status).toBe(200);
  const response = await auth.register(opts.body.options);
  return call("/api/registreren", { body: { invite, challengeToken: opts.body.challengeToken, response } });
}

async function login(auth, override = {}) {
  const opts = await call("/api/inloggen/opties", { body: {} });
  const response = await auth.login(opts.body.options, override);
  return call("/api/inloggen", { body: { challengeToken: opts.body.challengeToken, response } });
}

beforeEach(async () => {
  for (const t of ["watches", "sessions", "passkeys", "invites", "used_challenges", "users", "price_points", "price_daily", "offers", "products"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await env.DB.prepare("INSERT INTO products (id, name, created_at) VALUES (1, 'Sony WH-1000XM6 zwart', '2026-10-08T00:00:00Z')").run();
});

const adminInvite = async (extra = {}) => (await createInvite(env.DB, { name: "Mathijs", makeAdmin: true, ...extra }, isoNow())).token;

describe("uitnodiging + passkey", () => {
  it("registreert de eerste beheerder, die meteen alles volgt", async () => {
    const invite = await adminInvite();
    const info = await call("/api/uitnodiging", { body: { invite } });
    expect(info.body).toEqual({ name: "Mathijs", existing: false });

    const res = await register(invite, await createAuthenticator());
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: expect.any(Number), name: "Mathijs", isAdmin: true });

    const me = await call("/api/ik", { token: res.body.token });
    expect(me.body.name).toBe("Mathijs");
    const items = await call("/api/items", { token: res.body.token });
    expect(items.body.items.map((i) => i.name)).toEqual(["Sony WH-1000XM6 zwart"]);
  });

  it("een uitnodiging werkt maar één keer", async () => {
    const invite = await adminInvite();
    expect((await register(invite, await createAuthenticator())).status).toBe(200);
    const again = await call("/api/registreren/opties", { body: { invite, name: "x" } });
    expect(again.status).toBe(410);
    expect(again.body.fout).toBe("deze link is al gebruikt of verlopen");
  });

  it("openen of opties vragen verbruikt de uitnodiging niet (whatsapp-voorbeeld, afgebroken poging)", async () => {
    const invite = await adminInvite();
    await call("/api/uitnodiging", { body: { invite } });
    await call("/api/registreren/opties", { body: { invite, name: "Mathijs" } });
    expect((await register(invite, await createAuthenticator())).status).toBe(200);
  });

  it("twee registraties met dezelfde uitnodiging tegelijk: één account, één passkey", async () => {
    const invite = await adminInvite();
    const a = await createAuthenticator();
    const b = await createAuthenticator();
    const oa = await call("/api/registreren/opties", { body: { invite, name: "a" } });
    const ob = await call("/api/registreren/opties", { body: { invite, name: "b" } });
    const ra = { invite, challengeToken: oa.body.challengeToken, response: await a.register(oa.body.options) };
    const rb = { invite, challengeToken: ob.body.challengeToken, response: await b.register(ob.body.options) };
    const [x, y] = await Promise.all([call("/api/registreren", { body: ra }), call("/api/registreren", { body: rb })]);
    expect([x.status, y.status].sort()).toEqual([200, 410]);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM users").first()).n).toBe(1);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM passkeys").first()).n).toBe(1);
  });

  it("verlopen uitnodiging werkt niet", async () => {
    const invite = (await createInvite(env.DB, { name: "x" }, "2026-01-01T00:00:00Z")).token;
    expect((await call("/api/uitnodiging", { body: { invite } })).status).toBe(410);
  });

  it("een andere origin wordt geweigerd", async () => {
    const invite = await adminInvite();
    const auth = await createAuthenticator();
    const opts = await call("/api/registreren/opties", { body: { invite, name: "x" } });
    const response = await auth.register(opts.body.options, { origin: "https://nep.example" });
    const res = await call("/api/registreren", { body: { invite, challengeToken: opts.body.challengeToken, response } });
    expect(res.status).toBe(400);
  });

  it("een challenge met geknoeide handtekening wordt geweigerd", async () => {
    const invite = await adminInvite();
    const auth = await createAuthenticator();
    const opts = await call("/api/registreren/opties", { body: { invite, name: "x" } });
    const response = await auth.register(opts.body.options);
    const [body] = opts.body.challengeToken.split(".");
    const res = await call("/api/registreren", { body: { invite, challengeToken: `${body}.AAAA`, response } });
    expect(res.status).toBe(400);
  });

  it("de challenge hoort bij die ene uitnodiging", async () => {
    const a = await adminInvite();
    const b = (await createInvite(env.DB, { name: "sanne" }, isoNow())).token;
    const auth = await createAuthenticator();
    const opts = await call("/api/registreren/opties", { body: { invite: a, name: "x" } });
    const response = await auth.register(opts.body.options);
    const res = await call("/api/registreren", { body: { invite: b, challengeToken: opts.body.challengeToken, response } });
    expect(res.status).toBe(400);
  });

  it("inloggen met passkey, zonder gebruikersnaam", async () => {
    const auth = await createAuthenticator();
    await register(await adminInvite(), auth);
    const res = await login(auth);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Mathijs");
    expect((await call("/api/ik", { token: res.body.token })).status).toBe(200);
  });

  it("gesynchroniseerde passkey (teller 0) kan steeds opnieuw inloggen, maar een challenge maar één keer", async () => {
    const auth = await createAuthenticator({ synced: true });
    await register(await adminInvite(), auth);
    expect((await login(auth)).status).toBe(200);
    expect((await login(auth)).status).toBe(200);
    const opts = await call("/api/inloggen/opties", { body: {} });
    const body = { challengeToken: opts.body.challengeToken, response: await auth.login(opts.body.options) };
    expect((await call("/api/inloggen", { body })).status).toBe(200);
    expect((await call("/api/inloggen", { body })).status).toBe(400);
  });

  it("onbekende passkey kan niet inloggen", async () => {
    await register(await adminInvite(), await createAuthenticator());
    expect((await login(await createAuthenticator())).status).toBe(401);
  });

  it("dezelfde inlogpoging twee keer insturen werkt maar één keer", async () => {
    const auth = await createAuthenticator();
    await register(await adminInvite(), auth);
    const opts = await call("/api/inloggen/opties", { body: {} });
    const response = await auth.login(opts.body.options);
    const body = { challengeToken: opts.body.challengeToken, response };
    expect((await call("/api/inloggen", { body })).status).toBe(200);
    expect((await call("/api/inloggen", { body })).status).not.toBe(200);
  });

  it("bewaart alleen hashes van tokens", async () => {
    const invite = await adminInvite();
    const res = await register(invite, await createAuthenticator());
    const inv = await env.DB.prepare("SELECT token_hash FROM invites").first();
    expect(inv.token_hash).toBe(await sha256(invite));
    const ses = await env.DB.prepare("SELECT token_hash, device FROM sessions").first();
    expect(ses.token_hash).toBe(await sha256(res.body.token));
    expect(ses.device).toBe("iphone · safari");
    expect(JSON.stringify(await env.DB.prepare("SELECT * FROM sessions").all())).not.toContain(res.body.token);
  });

  it("uitloggen maakt het token ongeldig", async () => {
    const res = await register(await adminInvite(), await createAuthenticator());
    await call("/api/uitloggen", { body: {}, token: res.body.token });
    expect((await call("/api/ik", { token: res.body.token })).status).toBe(401);
  });

  it("zonder of met fout token: 401", async () => {
    expect((await call("/api/items")).status).toBe(401);
    expect((await call("/api/items", { token: "x".repeat(43) })).status).toBe(401);
  });
});

describe("beheer", () => {
  async function adminToken() {
    return (await register(await adminInvite(), await createAuthenticator())).body.token;
  }

  it("beheerder nodigt een vriend uit; die is geen beheerder en volgt nog niets", async () => {
    const token = await adminToken();
    const made = await call("/api/beheer/uitnodigingen", { body: { name: "sanne" }, token });
    expect(made.body.link).toMatch(/^https:\/\/prijs\.prulwerk\.nl\/#uitnodiging=[A-Za-z0-9_-]{43}$/);
    const invite = made.body.link.split("=")[1];

    expect((await call("/api/uitnodiging", { body: { invite } })).body).toEqual({ name: "sanne", existing: false });
    const res = await register(invite, await createAuthenticator(), "Sanne");
    expect(res.body.user).toMatchObject({ name: "Sanne", isAdmin: false });
    expect((await call("/api/items", { token: res.body.token })).body.items).toEqual([]);
    expect((await call("/api/beheer/uitnodigingen", { token: res.body.token })).status).toBe(403);

    const list = await call("/api/beheer/uitnodigingen", { token });
    expect(list.body.invites.map((i) => i.status)).toEqual(["gebruikt", "gebruikt"]);
  });

  it("herstel: nieuwe passkey voor een bestaand account", async () => {
    const token = await adminToken();
    const sanne = await register((await call("/api/beheer/uitnodigingen", { body: { name: "sanne" }, token })).body.link.split("=")[1], await createAuthenticator(), "Sanne");
    const made = await call("/api/beheer/uitnodigingen", { body: { userId: sanne.body.user.id }, token });
    const invite = made.body.link.split("=")[1];
    expect((await call("/api/uitnodiging", { body: { invite } })).body).toEqual({ name: "Sanne", existing: true });
    const nieuw = await createAuthenticator();
    const res = await register(invite, nieuw);
    expect(res.body.user.id).toBe(sanne.body.user.id);
    expect((await login(nieuw)).body.user.name).toBe("Sanne");
  });

  it("intrekken: sessies en passkeys weg", async () => {
    const token = await adminToken();
    const auth = await createAuthenticator();
    const sanne = await register((await call("/api/beheer/uitnodigingen", { body: { name: "sanne" }, token })).body.link.split("=")[1], auth, "Sanne");
    expect((await call(`/api/beheer/gebruikers/${sanne.body.user.id}/intrekken`, { body: {}, token })).status).toBe(200);
    expect((await call("/api/ik", { token: sanne.body.token })).status).toBe(401);
    expect((await login(auth)).status).toBe(401);
  });
});

describe("cors", () => {
  it("alleen prijs.prulwerk.nl", async () => {
    const ok = await call("/api/inloggen/opties", { body: {} });
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const nee = await call("/api/inloggen/opties", { body: {}, origin: "https://kwaad.example" });
    expect(nee.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("preflight staat Authorization toe", async () => {
    const res = await worker.fetch(new Request("https://api.test/api/items", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
});

describe("invoer", () => {
  it("een body die geen object is geeft 400, geen 500", async () => {
    for (const raw of ["null", "[]", '"x"']) {
      const res = await worker.fetch(
        new Request("https://api.test/api/uitnodiging", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: raw }),
        env,
      );
      expect(res.status).toBe(400);
      expect((await res.json()).fout).toBe("ongeldige json");
    }
  });
});

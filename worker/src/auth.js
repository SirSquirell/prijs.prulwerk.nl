// Inloggen: uitnodiging + passkey (besluiten 0003 en 0008).
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { b64url, fromB64url, randomToken, sha256, sign, verifySigned } from "./crypto.js";
import { HttpError } from "./http.js";
import { isoNow } from "./time.js";

export const SESSION_DAYS = 30;
export const INVITE_DAYS = 7;
export const SETUP_INVITE_HOURS = 24;
const CHALLENGE_MIN = 5;
const ALGORITHMS = [-7, -257]; // ES256, RS256

const addMinutes = (iso, min) => isoNow(new Date(Date.parse(iso) + min * 60_000));

// ---------- sessies ----------

export async function createSession(db, userId, device, now) {
  const token = randomToken();
  await db
    .prepare(`INSERT INTO sessions (token_hash, user_id, device, created_at, last_seen_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?4, ?5)`)
    .bind(await sha256(token), userId, device, now, addMinutes(now, SESSION_DAYS * 24 * 60))
    .run();
  return token;
}

// Zoekt de gebruiker bij het Bearer-token. Wie de app gebruikt blijft ingelogd: eens per dag schuift de vervaldatum op.
export async function requireUser(env, request, now) {
  const m = (request.headers.get("Authorization") ?? "").match(/^Bearer ([A-Za-z0-9_-]{20,100})$/);
  if (!m) throw new HttpError(401, "niet ingelogd");
  const hash = await sha256(m[1]);
  const row = await env.DB.prepare(
    `SELECT s.token_hash, s.last_seen_at, u.id, u.name, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
  )
    .bind(hash, now)
    .first();
  if (!row) throw new HttpError(401, "niet ingelogd");
  if (row.last_seen_at < addMinutes(now, -24 * 60)) {
    await env.DB.prepare(`UPDATE sessions SET last_seen_at = ?2, expires_at = ?3 WHERE token_hash = ?1`)
      .bind(hash, now, addMinutes(now, SESSION_DAYS * 24 * 60))
      .run();
  }
  return { id: row.id, name: row.name, isAdmin: row.is_admin === 1, sessionHash: hash };
}

export async function requireAdmin(env, request, now) {
  const user = await requireUser(env, request, now);
  if (!user.isAdmin) throw new HttpError(403, "alleen voor beheer");
  return user;
}

// ---------- uitnodigingen ----------

export async function createInvite(db, { name = null, userId = null, makeAdmin = false, createdBy = null, hours = INVITE_DAYS * 24 }, now) {
  const token = randomToken();
  const expiresAt = addMinutes(now, hours * 60);
  await db
    .prepare(`INSERT INTO invites (token_hash, name, user_id, make_admin, created_by, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(await sha256(token), name, userId, makeAdmin ? 1 : 0, createdBy, now, expiresAt)
    .run();
  return { token, expiresAt };
}

export function inviteLink(env, token) {
  return `${env.ORIGIN}/#uitnodiging=${token}`;
}

async function findOpenInvite(db, token, now) {
  if (typeof token !== "string" || token.length > 100) return null;
  return db
    .prepare(
      `SELECT i.token_hash, i.name, i.user_id, i.make_admin, u.name AS user_name, u.webauthn_id
       FROM invites i LEFT JOIN users u ON u.id = i.user_id
       WHERE i.token_hash = ?1 AND i.used_at IS NULL AND i.expires_at > ?2`,
    )
    .bind(await sha256(token), now)
    .first();
}

export async function inviteInfo(env, body, now) {
  const invite = await findOpenInvite(env.DB, body.invite, now);
  if (!invite) throw new HttpError(410, "deze link is al gebruikt of verlopen");
  return { name: invite.user_name ?? invite.name ?? "", existing: invite.user_id != null };
}

// ---------- challenges: ondertekend, niet in D1 ----------

async function signChallenge(env, payload, now) {
  return sign(env.AUTH_SECRET, { ...payload, exp: addMinutes(now, CHALLENGE_MIN) });
}

async function openChallenge(env, token, purpose, now) {
  const payload = await verifySigned(env.AUTH_SECRET, token);
  if (!payload || payload.p !== purpose || !(payload.exp > now)) throw new HttpError(400, "verlopen, probeer opnieuw");
  return payload;
}

// Pas na een gelukte verificatie: een challenge werkt maar één keer.
async function spendChallenge(db, payload) {
  const row = await db
    .prepare(`INSERT INTO used_challenges (challenge, expires_at) VALUES (?1, ?2) ON CONFLICT (challenge) DO NOTHING RETURNING challenge`)
    .bind(payload.c, payload.exp)
    .first();
  if (!row) throw new HttpError(400, "verlopen, probeer opnieuw");
}

// ---------- registreren ----------

export async function registerOptions(env, body, now) {
  const invite = await findOpenInvite(env.DB, body.invite, now);
  if (!invite) throw new HttpError(410, "deze link is al gebruikt of verlopen");

  const name = invite.user_id ? invite.user_name : cleanName(body.name ?? invite.name);
  if (!name) throw new HttpError(400, "vul je naam in");
  const webauthnId = invite.webauthn_id ?? randomToken(16);

  const existing = invite.user_id
    ? (await env.DB.prepare(`SELECT credential_id, transports FROM passkeys WHERE user_id = ?1`).bind(invite.user_id).all()).results
    : [];

  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userName: `${name} · prijswacht`,
    userDisplayName: name,
    userID: fromB64url(webauthnId),
    attestationType: "none",
    supportedAlgorithmIDs: ALGORITHMS,
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    excludeCredentials: existing.map((p) => ({ id: p.credential_id, transports: p.transports ? JSON.parse(p.transports) : undefined })),
  });
  const challengeToken = await signChallenge(env, { c: options.challenge, p: "register", inv: invite.token_hash, wid: webauthnId, name }, now);
  return { options, challengeToken };
}

export async function registerVerify(env, body, now, device) {
  const payload = await openChallenge(env, body.challengeToken, "register", now);
  if (typeof body.invite !== "string" || (await sha256(body.invite)) !== payload.inv) throw new HttpError(400, "uitnodiging klopt niet");

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: payload.c,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: false,
      supportedAlgorithmIDs: ALGORITHMS,
    });
  } catch {
    throw new HttpError(400, "passkey niet geaccepteerd");
  }
  if (!verification.verified) throw new HttpError(400, "passkey niet geaccepteerd");

  await spendChallenge(env.DB, payload);
  const invite = await env.DB.prepare(`SELECT user_id, make_admin FROM invites WHERE token_hash = ?1`).bind(payload.inv).first();
  if (!invite) throw new HttpError(410, "deze link is al gebruikt of verlopen");
  const wid = invite.user_id == null ? payload.wid : (await env.DB.prepare(`SELECT webauthn_id FROM users WHERE id = ?1`).bind(invite.user_id).first())?.webauthn_id;

  // Eén transactie: gebruiker, passkey, (voor de beheerder) wat hij volgt, en de uitnodiging op gebruikt.
  // Elke stap alleen als de uitnodiging nog open is, zodat twee gelijktijdige pogingen er maar één opleveren.
  const open = `EXISTS (SELECT 1 FROM invites WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2)`;
  const { credential } = verification.registrationInfo;
  const results = await env.DB.batch([
    env.DB.prepare(`INSERT INTO users (name, webauthn_id, is_admin, created_at) SELECT ?3, ?4, ?5, ?2 WHERE ?6 IS NULL AND ${open}`).bind(
      payload.inv,
      now,
      payload.name,
      wid,
      invite.make_admin,
      invite.user_id,
    ),
    env.DB.prepare(
      `INSERT INTO passkeys (user_id, credential_id, public_key, sign_count, transports, created_at)
       SELECT u.id, ?4, ?5, ?6, ?7, ?2 FROM users u WHERE u.webauthn_id = ?3 AND ${open}`,
    ).bind(payload.inv, now, wid, credential.id, b64url(credential.publicKey), credential.counter, JSON.stringify(credential.transports ?? [])),
    env.DB.prepare(
      `INSERT OR IGNORE INTO watches (user_id, product_id, created_at)
       SELECT u.id, p.id, ?2 FROM users u, products p WHERE u.webauthn_id = ?3 AND ?4 = 1 AND ?5 IS NULL AND ${open}`,
    ).bind(payload.inv, now, wid, invite.make_admin, invite.user_id),
    env.DB.prepare(`UPDATE invites SET used_at = ?2 WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 RETURNING token_hash`).bind(payload.inv, now),
  ]);
  if (!results[3].results.length) throw new HttpError(410, "deze link is al gebruikt of verlopen");
  const userId = (await env.DB.prepare(`SELECT id FROM users WHERE webauthn_id = ?1`).bind(wid).first()).id;

  const token = await createSession(env.DB, userId, device, now);
  return { token, user: await userInfo(env.DB, userId) };
}

// ---------- inloggen ----------

export async function loginOptions(env, now) {
  const options = await generateAuthenticationOptions({ rpID: env.RP_ID, userVerification: "preferred" });
  return { options, challengeToken: await signChallenge(env, { c: options.challenge, p: "login" }, now) };
}

export async function loginVerify(env, body, now, device) {
  const payload = await openChallenge(env, body.challengeToken, "login", now);
  const credentialId = body.response?.id;
  if (typeof credentialId !== "string") throw new HttpError(400, "inloggen niet gelukt");
  const passkey = await env.DB.prepare(`SELECT id, user_id, credential_id, public_key, sign_count, transports FROM passkeys WHERE credential_id = ?1`)
    .bind(credentialId)
    .first();
  if (!passkey) throw new HttpError(401, "deze passkey kennen we niet");

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: payload.c,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: false,
      credential: {
        id: passkey.credential_id,
        publicKey: fromB64url(passkey.public_key),
        counter: passkey.sign_count,
        transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
      },
    });
  } catch {
    throw new HttpError(401, "inloggen niet gelukt");
  }
  if (!verification.verified) throw new HttpError(401, "inloggen niet gelukt");

  await spendChallenge(env.DB, payload);
  await env.DB.prepare(`UPDATE passkeys SET sign_count = ?2, last_used_at = ?3 WHERE id = ?1`)
    .bind(passkey.id, verification.authenticationInfo.newCounter, now)
    .run();
  const token = await createSession(env.DB, passkey.user_id, device, now);
  return { token, user: await userInfo(env.DB, passkey.user_id) };
}

export async function logout(env, user) {
  await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(user.sessionHash).run();
}

// ---------- beheer ----------

export async function listInvites(env, now) {
  const rows = (
    await env.DB.prepare(
      `SELECT i.name, u.name AS user_name, i.created_at, i.expires_at, i.used_at FROM invites i LEFT JOIN users u ON u.id = i.user_id
       ORDER BY i.created_at DESC LIMIT 50`,
    ).all()
  ).results;
  return rows.map((r) => ({
    name: r.user_name ?? r.name ?? "",
    created_at: r.created_at,
    expires_at: r.expires_at,
    status: r.used_at ? "gebruikt" : r.expires_at > now ? "open" : "verlopen",
  }));
}

export async function listUsers(env) {
  return (
    await env.DB.prepare(
      `SELECT u.id, u.name, u.is_admin, u.created_at,
         (SELECT count(*) FROM passkeys p WHERE p.user_id = u.id) AS passkeys,
         (SELECT max(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen_at
       FROM users u ORDER BY u.id`,
    ).all()
  ).results;
}

// Intrekken: alle sessies en passkeys weg. Het account en wat iemand volgt blijven staan.
export async function revokeUser(env, admin, userId) {
  if (userId === admin.id) throw new HttpError(400, "jezelf intrekken kan niet");
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(userId),
    env.DB.prepare(`DELETE FROM passkeys WHERE user_id = ?1`).bind(userId),
    env.DB.prepare(`UPDATE invites SET used_at = coalesce(used_at, 'ingetrokken') WHERE user_id = ?1`).bind(userId),
  ]);
}

export async function cleanupAuth(db, now) {
  await db.batch([
    db.prepare(`DELETE FROM used_challenges WHERE expires_at < ?1`).bind(now),
    db.prepare(`DELETE FROM sessions WHERE expires_at < ?1`).bind(now),
    db.prepare(`DELETE FROM invites WHERE used_at IS NULL AND expires_at < ?1`).bind(addMinutes(now, -30 * 24 * 60)),
  ]);
}

async function userInfo(db, userId) {
  const u = await db.prepare(`SELECT id, name, is_admin FROM users WHERE id = ?1`).bind(userId).first();
  return { id: u.id, name: u.name, isAdmin: u.is_admin === 1 };
}

function cleanName(raw) {
  const s = String(raw ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return s || null;
}

export function deviceName(request) {
  const ua = request.headers.get("User-Agent") ?? "";
  const os = /iPhone|iPad/.test(ua) ? "iphone" : /Android/.test(ua) ? "android" : /Mac OS X/.test(ua) ? "mac" : /Windows/.test(ua) ? "windows" : "onbekend";
  const browser = /Edg\//.test(ua) ? "edge" : /Firefox\//.test(ua) ? "firefox" : /Chrome\//.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : "";
  return [os, browser].filter(Boolean).join(" · ");
}

// Wat een ingelogde gebruiker ziet: zijn lijst en de details per item.
import { MAX_ACTIVE_OFFERS, MAX_WATCHES_PER_USER } from "./config.js";
import { HttpError } from "./http.js";
import { normalizeProductUrl, shopFromUrl } from "./shops.js";
import { lowestNow, seriesStats, shiftDay, weekDelta } from "./stats.js";
import { localDay } from "./time.js";

const OFFER_COLUMNS = `
  o.id, o.product_id, o.shop, o.url, o.last_status, o.last_checked_at,
  (SELECT status FROM price_points p WHERE p.offer_id = o.id ORDER BY checked_at DESC LIMIT 1) AS last_point_status,
  (SELECT price_cents FROM price_points p WHERE p.offer_id = o.id ORDER BY checked_at DESC LIMIT 1) AS last_price,
  (SELECT in_stock FROM price_points p WHERE p.offer_id = o.id ORDER BY checked_at DESC LIMIT 1) AS last_in_stock,
  (SELECT checked_at FROM price_points p WHERE p.offer_id = o.id AND status = 'ok' ORDER BY checked_at DESC LIMIT 1) AS last_ok_at,
  (SELECT price_cents FROM price_points p WHERE p.offer_id = o.id AND status = 'ok' ORDER BY checked_at DESC LIMIT 1) AS last_ok_price`;

// productFilter: SQL die product-id's oplevert, met ?2 als parameter. Geen lange IN-lijst: D1 staat
// hooguit 100 parameters per query toe.
async function dailyLows(db, productFilter, param, fromDay) {
  const rows = (
    await db
      .prepare(
        `SELECT o.product_id, d.day, min(d.min_cents) AS low FROM price_daily d JOIN offers o ON o.id = d.offer_id
         WHERE d.day >= ?1 AND o.active = 1 AND o.product_id IN (${productFilter}) GROUP BY o.product_id, d.day ORDER BY d.day`,
      )
      .bind(fromDay, param)
      .all()
  ).results;
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.product_id)) map.set(r.product_id, []);
    map.get(r.product_id).push({ day: r.day, low: r.low });
  }
  return map;
}

const WATCHED = "SELECT product_id FROM watches WHERE user_id = ?2";

export async function listItems(env, user, now) {
  const db = env.DB;
  const products = (
    await db
      .prepare(
        `SELECT p.id, p.name, p.image_url, w.target_cents FROM watches w JOIN products p ON p.id = w.product_id
         WHERE w.user_id = ?1 ORDER BY p.name COLLATE NOCASE`,
      )
      .bind(user.id)
      .all()
  ).results;
  const offers = (
    await db.prepare(`SELECT ${OFFER_COLUMNS} FROM offers o WHERE o.active = 1 AND o.product_id IN (SELECT product_id FROM watches WHERE user_id = ?1)`).bind(user.id).all()
  ).results;
  const today = localDay(now);
  const lows = await dailyLows(db, WATCHED, user.id, shiftDay(today, -8));

  const items = products.map((p) => {
    const mine = offers.filter((o) => o.product_id === p.id);
    const best = lowestNow(mine);
    return {
      id: p.id,
      name: p.name,
      shops: mine.length,
      price: best?.cents ?? null,
      shop: best?.shop ?? null,
      target: p.target_cents,
      pending: mine.every((o) => !o.last_point_status),
      delta: weekDelta(best?.cents, lows.get(p.id) ?? [], today),
    };
  });
  const lastCheck = offers.reduce((max, o) => (o.last_checked_at && o.last_checked_at > max ? o.last_checked_at : max), "");
  return { items, shops: offers.length, last_check: lastCheck || null };
}

export async function itemDetail(env, user, productId, now) {
  const db = env.DB;
  const product = await db
    .prepare(
      `SELECT p.id, p.name, p.ean, p.image_url, w.target_cents, w.alert_every_drop FROM watches w JOIN products p ON p.id = w.product_id
       WHERE w.user_id = ?1 AND p.id = ?2`,
    )
    .bind(user.id, productId)
    .first();
  if (!product) throw new HttpError(404, "niet gevonden");

  const offers = (await db.prepare(`SELECT ${OFFER_COLUMNS} FROM offers o WHERE o.active = 1 AND o.product_id = ?1 ORDER BY o.shop`).bind(productId).all()).results;
  const today = localDay(now);
  const series = (await dailyLows(db, "?2", productId, shiftDay(today, -89))).get(productId) ?? [];
  const best = lowestNow(offers);

  return {
    id: product.id,
    name: product.name,
    ean: product.ean,
    target: product.target_cents,
    price: best?.cents ?? null,
    shop: best?.shop ?? null,
    pending: offers.every((o) => !o.last_point_status),
    stats: seriesStats(series),
    series,
    offers: offers
      .map((o) => ({
        shop: o.shop,
        url: o.url,
        status: o.last_point_status,
        price: o.last_point_status === "ok" ? o.last_price : null,
        in_stock: o.last_point_status === "ok" && o.last_in_stock != null ? o.last_in_stock === 1 : null,
        checked_at: o.last_checked_at,
        last_ok_at: o.last_ok_at,
        last_ok_price: o.last_ok_price,
      }))
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)),
  };
}

// ---------- toevoegen, winkel erbij, niet meer volgen ----------

function cleanUrl(input) {
  const url = normalizeProductUrl(input);
  if (!url) throw new HttpError(400, "dat is geen winkellink die we kunnen volgen. kopieer de link van de productpagina.");
  return url;
}

async function ensureCapacity(db) {
  const { n } = await db.prepare(`SELECT count(*) AS n FROM offers WHERE active = 1`).first();
  if (n >= MAX_ACTIVE_OFFERS) throw new HttpError(503, "prijswacht volgt al zoveel winkels als hij aankan. zet eerst iets anders uit je lijst.");
}

// Link plakken: bestaat de winkellink al, dan volg je dat item (met zijn geschiedenis). Anders een nieuw item.
export async function addItem(env, user, body, now) {
  const db = env.DB;
  const url = cleanUrl(body?.url);
  const { n } = await db.prepare(`SELECT count(*) AS n FROM watches WHERE user_id = ?1`).bind(user.id).first();
  if (n >= MAX_WATCHES_PER_USER) throw new HttpError(400, `je volgt al ${MAX_WATCHES_PER_USER} items. zet er eerst een uit je lijst.`);

  let offer = await db.prepare(`SELECT id, product_id, active FROM offers WHERE url = ?1`).bind(url).first();
  let existing = !!offer;
  if (!offer) {
    await ensureCapacity(db);
    const shop = shopFromUrl(url);
    const product = await db.prepare(`INSERT INTO products (name, named, created_at) VALUES (?1, 0, ?2) RETURNING id`).bind(`nieuw item bij ${shop}`, now).first();
    offer = await db
      .prepare(`INSERT INTO offers (product_id, shop, url, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (url) DO NOTHING RETURNING id, product_id, active`)
      .bind(product.id, shop, url, now)
      .first();
    if (!offer) {
      // Iemand anders plakte dezelfde link net tegelijk.
      await db.prepare(`DELETE FROM products WHERE id = ?1`).bind(product.id).run();
      offer = await db.prepare(`SELECT id, product_id, active FROM offers WHERE url = ?1`).bind(url).first();
      existing = true;
    }
  } else if (!offer.active) {
    await ensureCapacity(db);
    await db.prepare(`UPDATE offers SET active = 1, last_checked_at = NULL WHERE product_id = ?1`).bind(offer.product_id).run();
  }
  await db.prepare(`INSERT OR IGNORE INTO watches (user_id, product_id, created_at) VALUES (?1, ?2, ?3)`).bind(user.id, offer.product_id, now).run();
  return { id: offer.product_id, existing };
}

// Nog een winkel bij een item dat je al volgt.
export async function addShop(env, user, productId, body, now) {
  const db = env.DB;
  const watch = await db.prepare(`SELECT 1 FROM watches WHERE user_id = ?1 AND product_id = ?2`).bind(user.id, productId).first();
  if (!watch) throw new HttpError(404, "niet gevonden");
  const url = cleanUrl(body?.url);
  const offer = await db.prepare(`SELECT product_id FROM offers WHERE url = ?1`).bind(url).first();
  if (offer) {
    if (offer.product_id === productId) return { id: productId };
    throw new HttpError(409, "die link hoort al bij een ander item in prijswacht.");
  }
  await ensureCapacity(db);
  await db.prepare(`INSERT INTO offers (product_id, shop, url, created_at) VALUES (?1, ?2, ?3, ?4)`).bind(productId, shopFromUrl(url), url, now).run();
  return { id: productId };
}

// Niet meer volgen. Volgt niemand het meer, dan stopt het ophalen; de geschiedenis blijft bewaard.
export async function unwatch(env, user, productId) {
  const db = env.DB;
  await db.batch([
    db.prepare(`DELETE FROM watches WHERE user_id = ?1 AND product_id = ?2`).bind(user.id, productId),
    db.prepare(`UPDATE offers SET active = 0 WHERE product_id = ?1 AND NOT EXISTS (SELECT 1 FROM watches WHERE product_id = ?1)`).bind(productId),
  ]);
}

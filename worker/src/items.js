// Wat een ingelogde gebruiker ziet: zijn lijst en de details per item.
import { HttpError } from "./http.js";
import { lowestNow, seriesStats, shiftDay, weekDelta } from "./stats.js";
import { localDay } from "./time.js";

const OFFER_COLUMNS = `
  o.id, o.product_id, o.shop, o.url, o.last_status, o.last_checked_at,
  (SELECT status FROM price_points p WHERE p.offer_id = o.id ORDER BY checked_at DESC LIMIT 1) AS last_point_status,
  (SELECT price_cents FROM price_points p WHERE p.offer_id = o.id ORDER BY checked_at DESC LIMIT 1) AS last_price,
  (SELECT in_stock FROM price_points p WHERE p.offer_id = o.id ORDER BY checked_at DESC LIMIT 1) AS last_in_stock,
  (SELECT checked_at FROM price_points p WHERE p.offer_id = o.id AND status = 'ok' ORDER BY checked_at DESC LIMIT 1) AS last_ok_at,
  (SELECT price_cents FROM price_points p WHERE p.offer_id = o.id AND status = 'ok' ORDER BY checked_at DESC LIMIT 1) AS last_ok_price`;

async function dailyLows(db, productIds, fromDay) {
  if (!productIds.length) return new Map();
  const marks = productIds.map((_, i) => `?${i + 2}`).join(",");
  const rows = (
    await db
      .prepare(
        `SELECT o.product_id, d.day, min(d.min_cents) AS low FROM price_daily d JOIN offers o ON o.id = d.offer_id
         WHERE d.day >= ?1 AND o.product_id IN (${marks}) AND o.active = 1 GROUP BY o.product_id, d.day ORDER BY d.day`,
      )
      .bind(fromDay, ...productIds)
      .all()
  ).results;
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.product_id)) map.set(r.product_id, []);
    map.get(r.product_id).push({ day: r.day, low: r.low });
  }
  return map;
}

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
  const ids = products.map((p) => p.id);
  const offers = ids.length
    ? (
        await db
          .prepare(`SELECT ${OFFER_COLUMNS} FROM offers o WHERE o.active = 1 AND o.product_id IN (${ids.map((_, i) => `?${i + 1}`).join(",")})`)
          .bind(...ids)
          .all()
      ).results
    : [];
  const today = localDay(now);
  const lows = await dailyLows(db, ids, shiftDay(today, -8));

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
  const series = (await dailyLows(db, [productId], shiftDay(today, -89))).get(productId) ?? [];
  const best = lowestNow(offers);

  return {
    id: product.id,
    name: product.name,
    ean: product.ean,
    target: product.target_cents,
    price: best?.cents ?? null,
    shop: best?.shop ?? null,
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

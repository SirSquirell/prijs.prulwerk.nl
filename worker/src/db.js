// Alle SQL op één plek.
import { localDay, minutesAgo } from "./time.js";

// Pakt de aanbiedingen die aan de beurt zijn en zet ze meteen op "bezig".
// Stond een aanbieding nog op "bezig", dan is de vorige poging halverwege gestopt (bijv. CPU-limiet):
// die poging wordt alsnog als fout vastgelegd, zodat hij zichtbaar is en niet stil verdwijnt.
export async function claimDue(db, now, intervalMin, limit) {
  const due = await db
    .prepare(
      `SELECT id, product_id, shop, url, last_status, last_checked_at FROM offers
       WHERE active = 1 AND (last_checked_at IS NULL OR last_checked_at <= ?1)
       ORDER BY last_checked_at IS NOT NULL, last_checked_at
       LIMIT ?2`,
    )
    .bind(minutesAgo(now, intervalMin), limit)
    .all();
  const offers = due.results ?? [];
  if (!offers.length) return [];

  const stmts = [];
  for (const o of offers) {
    if (o.last_status === "bezig") {
      stmts.push(
        db
          .prepare(`INSERT INTO price_points (offer_id, checked_at, status, detail) VALUES (?1, ?2, 'fout', 'afgebroken')`)
          .bind(o.id, o.last_checked_at),
      );
    }
    stmts.push(db.prepare(`UPDATE offers SET last_checked_at = ?2, last_status = 'bezig' WHERE id = ?1`).bind(o.id, now));
  }
  await db.batch(stmts);
  return offers;
}

export async function saveResult(db, offer, result, now) {
  const stmts = [
    db
      .prepare(
        `INSERT INTO price_points (offer_id, checked_at, status, http_status, price_cents, in_stock, source, omnibus_low_cents, detail)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'shop', ?7, ?8)`,
      )
      .bind(
        offer.id,
        now,
        result.status,
        result.httpStatus ?? null,
        result.priceCents,
        result.inStock == null ? null : result.inStock ? 1 : 0,
        result.omnibusLowCents ?? null,
        result.detail ?? null,
      ),
    db
      .prepare(`UPDATE offers SET last_checked_at = ?2, last_status = ?3, last_error = ?4 WHERE id = ?1`)
      .bind(offer.id, now, result.status, result.status === "ok" ? null : result.detail ?? result.status),
  ];
  if (result.status === "ok" && result.priceCents) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO price_daily (offer_id, day, min_cents, max_cents, close_cents) VALUES (?1, ?2, ?3, ?3, ?3)
           ON CONFLICT (offer_id, day) DO UPDATE SET
             min_cents = min(min_cents, excluded.min_cents),
             max_cents = max(max_cents, excluded.max_cents),
             close_cents = excluded.close_cents`,
        )
        .bind(offer.id, localDay(now), result.priceCents),
    );
  }
  if (result.status === "ok") {
    // Een geplakte link heeft eerst een tijdelijke naam; de eerste geslaagde check geeft de echte.
    if (result.name) stmts.push(db.prepare(`UPDATE products SET name = ?2, named = 1 WHERE id = ?1 AND named = 0`).bind(offer.product_id, result.name));
    if (result.image) stmts.push(db.prepare(`UPDATE products SET image_url = ?2 WHERE id = ?1 AND image_url IS NULL`).bind(offer.product_id, result.image));
    if (result.gtin) {
      stmts.push(
        db
          .prepare(`UPDATE products SET ean = ?2 WHERE id = ?1 AND ean IS NULL AND NOT EXISTS (SELECT 1 FROM products WHERE ean = ?2 AND id <> ?1)`)
          .bind(offer.product_id, result.gtin),
      );
    }
  }
  await db.batch(stmts);
  if (result.status === "ok" && result.gtin) await mergeByEan(db, offer.product_id, result.gtin);
}

// Hetzelfde product (zelfde EAN) bij twee winkels wordt één item. Het oudste item blijft; winkels, prijzen en
// wie het volgt verhuizen mee. Alles in één transactie.
export async function mergeByEan(db, productId, gtin) {
  const target = await db.prepare(`SELECT id FROM products WHERE ean = ?1 AND id <> ?2 ORDER BY id LIMIT 1`).bind(gtin, productId).first();
  if (!target) return null;
  const current = await db.prepare(`SELECT ean FROM products WHERE id = ?1`).bind(productId).first();
  if (!current || (current.ean != null && current.ean !== gtin)) return null;
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO watches (user_id, product_id, target_cents, alert_every_drop, created_at)
         SELECT user_id, ?2, target_cents, alert_every_drop, created_at FROM watches WHERE product_id = ?1`,
      )
      .bind(productId, target.id),
    db.prepare(`DELETE FROM watches WHERE product_id = ?1`).bind(productId),
    db.prepare(`UPDATE offers SET product_id = ?2 WHERE product_id = ?1`).bind(productId, target.id),
    db.prepare(`UPDATE offers SET active = 1 WHERE product_id = ?1 AND EXISTS (SELECT 1 FROM watches WHERE product_id = ?1)`).bind(target.id),
    db.prepare(`DELETE FROM products WHERE id = ?1`).bind(productId),
  ]);
  return target.id;
}

export async function getRobotsCache(db, origin) {
  return db.prepare(`SELECT fetched_at, http_status, body FROM robots WHERE origin = ?1`).bind(origin).first();
}

export async function putRobotsCache(db, origin, now, httpStatus, body) {
  await db
    .prepare(
      `INSERT INTO robots (origin, fetched_at, http_status, body) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (origin) DO UPDATE SET fetched_at = excluded.fetched_at, http_status = excluded.http_status, body = excluded.body`,
    )
    .bind(origin, now, httpStatus, body)
    .run();
}

// Voor /: per winkel hoe de checks van het afgelopen etmaal gingen. Geen productnamen.
export async function healthSummary(db, now) {
  const since = minutesAgo(now, 24 * 60);
  const [counts, perShop, last] = await db.batch([
    db.prepare(`SELECT (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM offers WHERE active = 1) AS offers, (SELECT count(*) FROM price_points) AS checks`),
    db
      .prepare(
        `SELECT o.shop, p.status, count(*) AS n FROM price_points p JOIN offers o ON o.id = p.offer_id
         WHERE p.checked_at >= ?1 GROUP BY o.shop, p.status ORDER BY o.shop, p.status`,
      )
      .bind(since),
    db.prepare(`SELECT max(checked_at) AS last_check FROM price_points`),
  ]);
  const shops = {};
  for (const row of perShop.results) (shops[row.shop] ??= {})[row.status] = row.n;
  return { ...counts.results[0], last_check: last.results[0].last_check, last_24h: shops };
}

-- Fase 1: producten, aanbiedingen en prijsgeschiedenis.
-- Bedragen in centen (integer). Tijden als ISO-tekst in UTC.

CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  ean         TEXT,
  name        TEXT NOT NULL,
  image_url   TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX products_ean ON products (ean);

CREATE TABLE offers (
  id               INTEGER PRIMARY KEY,
  product_id       INTEGER NOT NULL REFERENCES products (id),
  shop             TEXT NOT NULL,
  url              TEXT NOT NULL UNIQUE,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  last_checked_at  TEXT,
  last_status      TEXT,   -- ok, geblokkeerd, geen_prijs, robots, fout, bezig
  last_error       TEXT
);
CREATE INDEX offers_due ON offers (active, last_checked_at);

-- Elke check een rij, ook als het mislukt. price_cents NULL = onbekend, nooit een gok.
CREATE TABLE price_points (
  offer_id           INTEGER NOT NULL REFERENCES offers (id),
  checked_at         TEXT NOT NULL,
  status             TEXT NOT NULL,
  http_status        INTEGER,
  price_cents        INTEGER,
  in_stock           INTEGER,   -- 1, 0 of NULL (onbekend)
  source             TEXT NOT NULL DEFAULT 'shop',
  omnibus_low_cents  INTEGER,
  detail             TEXT
);
CREATE INDEX price_points_offer ON price_points (offer_id, checked_at);

-- Per dag (Europe/Amsterdam) voor grafieken, alleen uit geslaagde checks.
CREATE TABLE price_daily (
  offer_id     INTEGER NOT NULL REFERENCES offers (id),
  day          TEXT NOT NULL,
  min_cents    INTEGER NOT NULL,
  max_cents    INTEGER NOT NULL,
  close_cents  INTEGER NOT NULL,
  PRIMARY KEY (offer_id, day)
);

CREATE TABLE robots (
  origin      TEXT PRIMARY KEY,
  fetched_at  TEXT NOT NULL,
  http_status INTEGER,
  body        TEXT
);

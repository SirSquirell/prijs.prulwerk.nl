-- Fase 2: inloggen (uitnodiging + passkey), sessies, wie volgt wat.

CREATE TABLE users (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  webauthn_id  TEXT NOT NULL UNIQUE,   -- willekeurige user handle (base64url), niet de naam
  is_admin     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE TABLE passkeys (
  id             INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users (id),
  credential_id  TEXT NOT NULL UNIQUE,   -- base64url
  public_key     TEXT NOT NULL,          -- base64url (COSE)
  sign_count     INTEGER NOT NULL DEFAULT 0,
  transports     TEXT,
  created_at     TEXT NOT NULL,
  last_used_at   TEXT
);

-- Alleen de hash van het token. Gebruikt pas na een gelukte registratie, niet bij openen.
CREATE TABLE invites (
  token_hash  TEXT PRIMARY KEY,
  name        TEXT,                -- voorgestelde naam ("hoi sanne")
  user_id     INTEGER REFERENCES users (id),   -- gezet: nieuwe passkey voor een bestaand account
  make_admin  INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER REFERENCES users (id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id),
  device      TEXT,
  created_at  TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

-- Challenges zijn ondertekend en staan niet in D1 (besluit 0008). Alleen een gebruikte challenge komt
-- hier, na een gelukte verificatie, zodat hij niet twee keer werkt.
CREATE TABLE used_challenges (
  challenge   TEXT PRIMARY KEY,
  expires_at  TEXT NOT NULL
);

CREATE TABLE watches (
  user_id           INTEGER NOT NULL REFERENCES users (id),
  product_id        INTEGER NOT NULL REFERENCES products (id),
  target_cents      INTEGER,
  alert_every_drop  INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

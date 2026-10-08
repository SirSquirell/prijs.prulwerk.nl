# Architectuur

```
prijs.prulwerk.nl                  GitHub Pages, repo-root, geen buildstap
  index.html + app.js (ES modules), manifest.webmanifest, sw.js (PWA + push)
        │ fetch, Authorization: Bearer <sessietoken>
        ▼
prijswacht.<account>.workers.dev   Cloudflare Worker (map worker/)
  ├─ HTTP-API: auth, items, offers, prijsgeschiedenis, instellingen
  ├─ Cron Trigger: prijzen ophalen in batches
  ├─ D1 (SQLite): alle data
  ├─ Workers AI: winkelresultaten matchen, oordeelzinnen schrijven
  └─ Web Push: meldingen naar telefoon en laptop
```

Alles op het gratis plan van Cloudflare en GitHub. Eén account dat Mathijs moet koppelen: Cloudflare.

## Repo-indeling

```
/                 de frontend (Pages serveert dit rechtstreeks)
  index.html, app.js, styles.css, sw.js, manifest.webmanifest
  favicon.svg, favicon-light.svg, favicon-32.png, apple-touch-icon.png
  CNAME, .nojekyll
/worker/          de Cloudflare Worker (wrangler.toml, src/, test/, migrations/)
/docs/            deze brief, besluiten, status
```

De frontend heeft bewust geen bundler. Plain ES modules, eventueel één kleine library via een vaste
CDN-versie. Zo blijft "Pages serveert de root" kloppen zonder workflow.

## Datamodel (D1)

```sql
users        (id, name, created_at, is_admin)
passkeys     (id, user_id, credential_id, public_key, sign_count, created_at)
invites      (token_hash, created_by, expires_at, used_at)
sessions     (token_hash, user_id, device, created_at, expires_at)

products     (id, ean, name, image_url, created_at)
offers       (id, product_id, shop, url, active, last_checked_at, last_error)
price_points (offer_id, checked_at, status, http_status, price_cents, in_stock, source, omnibus_low_cents, detail)
price_daily  (offer_id, day, min_cents, max_cents, close_cents)   -- voor grafieken
robots       (origin, fetched_at, http_status, body)               -- robots.txt-cache, 24 uur

watches      (user_id, product_id, target_cents, alert_every_drop, created_at)
push_subs    (id, user_id, endpoint, p256dh, auth, created_at)
alerts_sent  (user_id, offer_id, kind, price_cents, sent_at)
settings     (user_id, quiet_from, quiet_to)
```

- Bedragen in **centen, integer**. Nooit floats.
- `price_points` krijgt elke check een rij. Bij ~20 items × 5 winkels × 6 checks per dag is dat
  ~220.000 rijen per jaar: klein.
- `source` zegt waar een prijs vandaan komt (`shop`, of later `tweakers`, `kieskeurig`, ...).
- `price_daily` wordt bijgewerkt na elke check, zodat grafieken niet de hele tabel lezen.
- Trends (90d laag, mediaan, hoog, prijsverhoging in 30 dagen) worden berekend, niet opgeslagen.
  SQLite heeft geen mediaan: die rekent de Worker uit.
- Migraties in `worker/migrations/`, toepassen met `wrangler d1 migrations apply`.

## Prijzen ophalen

- Eerst `schema.org` JSON-LD (`Product` / `Offer`) op de productpagina lezen: prijs, valuta, voorraad,
  GTIN. De meeste winkels hebben dat.
- Per winkel een kleine parser alleen waar JSON-LD ontbreekt of fout is.
- HTML verwerken met een tekstscan op `response.text()`, geen DOM. Eerst was het plan `HTMLRewriter`, maar
  gemeten op een echte Coolblue-pagina (1,6 MB) kost die 12-16 ms CPU, boven de 10 ms van het gratis plan.
  De tekstscan kost 6-9 ms.
- Cron elke minuut, één aanbieding per aanroep, elke aanbieding om de 3 uur (`worker/src/config.js`).
- Elke check krijgt een `status`: `ok`, `geblokkeerd` (403/429/503/captcha), `geen_prijs`, `robots`, `fout`.
  Het oordeel rekent alleen met `ok`.
- Beleefd: echte User-Agent met contactadres (besluit 0007), niet vaker dan elke paar uur per URL, `robots.txt`
  respecteren.
- Lukt het niet: `last_error` vullen, prijs als onbekend tonen, nooit de vorige prijs herhalen.

**Limieten van het gratis plan om te controleren voor je ontwerpt** (ze veranderen weleens; lees de
actuele documentatie): CPU-tijd per aanroep, aantal subrequests per aanroep, aantal Cron Triggers, de
D1-limieten en het dagbudget van Workers AI. Waarschijnlijk betekent dit: de cron verwerkt per keer
een batch aanbiedingen en houdt bij waar hij gebleven is.

## Winkels zoeken bij toevoegen

Standaard zonder extra API-key:

1. Link opgegeven: die pagina lezen, EAN en naam eruit halen.
2. Per bekende winkel de eigen zoekpagina bevragen met naam of EAN, resultaten lezen.
3. Workers AI beoordeelt twijfelgevallen ("is dit hetzelfde product?") en geeft een zekerheid.
   EAN-gelijk = zeker. Anders standaard uit.

Valt de vindkwaliteit tegen, dan beslist een council over Gemini met Google Search (gratis tier, wel
een API-key van Mathijs). Pas dan komt er iets op zijn takenlijst.

## Geschiedenis van andere sites

Optioneel, fase 6. Tweakers Pricewatch, Kieskeurig.nl en Beslist.nl hebben prijsgeschiedenis. Daarmee
werkt het oordeel ook voor items die pas laat zijn toegevoegd. Let op: hun voorwaarden verbieden
meestal geautomatiseerd ophalen, privé of niet. Een council beslist of en hoe (laag volume, alleen
bij toevoegen, als aparte `source` zodat het uit kan zonder dat de rest omvalt).

## Inloggen

Uitnodigingslink + passkey, geen e-mail, geen wachtwoord. Zie `docs/besluiten/0003-inloggen.md`.

- Mathijs is admin en kan uitnodigingslinks maken (eenmalig, 7 dagen geldig).
- Uitnodiging openen → naam invullen → passkey aanmaken → ingelogd.
- Daarna inloggen met de passkey. Passkeys synchroniseren via iCloud of Google, dus een nieuw
  apparaat werkt meestal meteen.
- Kwijt? Admin maakt een nieuwe uitnodiging voor hetzelfde account.
- Sessie: willekeurig token, alleen de hash in D1, 30 dagen, intrekbaar per apparaat.
- Token in de `Authorization`-header, niet in een cookie: frontend en API staan op verschillende
  sites en Safari blokkeert cookies van andere sites.
- Eerste admin: bij de eerste deploy maakt de Worker een eenmalige setup-uitnodiging die alleen in de
  deploy-output verschijnt.
- WebAuthn: gebruik een bekende library (bijv. SimpleWebAuthn), niet zelf schrijven.

## Meldingen

Web Push met VAPID. De agent genereert de sleutels zelf. Werkt in Chrome, Firefox, Edge en Safari, op
iPhone alleen als de site op het beginscherm staat (iOS 16.4+). Het scherm "account en meldingen"
legt dat in één zin uit.

Telegram is een optie voor later, alleen als Mathijs erom vraagt: daarvoor moet hij zelf een bot
aanmaken.

## AI

Workers AI, binnen hetzelfde Cloudflare-account, geen aparte key. Twee taken, verder niets:

1. Productmatch bij toevoegen beoordelen.
2. De zin bij een melding of oordeel schrijven, in de prijswacht-toon.

Valt de AI weg (dagbudget op), dan werkt alles nog: matchen alleen op EAN, meldingen met een vaste
template.

## Kosten

Doel €0 per maand. Alles wat geld kost gaat langs Mathijs.

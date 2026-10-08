# Status

Bijgewerkt: 2026-10-08

## Waar we staan

Fase 1 is gebouwd en getest, maar nog **niet live**: de deploy wacht op het Cloudflare-token
(`docs/mathijs-todo.md`, punt 1). Tot dat er is komt er geen data binnen.

## Werkt

- `worker/`: Cloudflare Worker met D1. De cron draait elke minuut en checkt dan één aanbieding die
  3 uur of langer niet is opgehaald. Zo blijft elke aanroep onder de 10 ms CPU van het gratis plan.
- Prijs uit schema.org JSON-LD, met een eigen parser voor Amazon (prijsblok bovenaan, niet de andere
  verkopers) en meta-tags als laatste redmiddel.
- Elke check komt in `price_points`, ook als hij mislukt. Status `ok`, `geblokkeerd`, `geen_prijs`,
  `robots` of `fout`. Een prijs die niet op te halen is blijft leeg en wordt nooit herhaald.
  `price_daily` houdt per Nederlandse kalenderdag min, max en slot bij.
- robots.txt wordt gerespecteerd (RFC 9309), een dag gecachet.
- `GET /` op de Worker: per winkel hoe de checks van het afgelopen etmaal gingen, zonder productnamen.
- 67 tests: prijsparser, EAN, JSON-LD, robots, echte pagina's van Coolblue en Amazon (ingekort), de
  captchapagina, en de cron tegen D1.
- Lokale proef tegen de echte winkels (vanaf de testcontainer, niet vanaf Cloudflare): Coolblue €359,00
  en Amazon €298,89 kwamen binnen, bol gaf 403.

## Werkt niet / open

- Niet gedeployed (token ontbreekt).
- bol blokkeert vanaf de testcontainer op IP. Amazon geeft soms een captcha. Hoe dat vanaf
  Cloudflare-IP's gaat weten we pas na de deploy: `GET /` laat het per winkel zien. Blijft een winkel
  blokkeren, dan volgt een council (besluit 0007).
- De EU-verplichte "laagste prijs 30 dagen" (omnibus) wordt nog niet uitgelezen. Coolblue en Amazon
  hadden hem niet op de pagina. De kolom staat klaar.
- Er is één testproduct (Sony WH-1000XM6 zwart, bij Coolblue, bol en Amazon). Meer toevoegen:
  `cd worker && npm run offer:add -- "naam" <url> [<url> ...]`.

## Volgende stap

1. Met het token: `cd worker && npm ci && ./scripts/deploy.sh`. Dat maakt de D1-database, past de
   migraties toe, zet het testproduct erin en deployt. Daarna `database_id` in `wrangler.toml` committen.
2. Na een uur `GET https://prijswacht.<subdomein>.workers.dev/` bekijken: welke winkels geven `ok`.
3. Fase 2: inloggen, lijst, item detail met grafiek, live op prijs.prulwerk.nl.

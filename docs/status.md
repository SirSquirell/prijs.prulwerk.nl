# Status

Bijgewerkt: 2026-10-08

## Waar we staan

Fase 1 is **live** sinds 9 oktober 2026, 09:17. De Worker draait op
https://prijswacht.prijswacht-worker.workers.dev/ en verzamelt prijzen. Eerste checks vanaf Cloudflare:
Coolblue €359,00, Amazon €300,71, bol 403.

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

- bol geeft ook vanaf Cloudflare 403. Amazon gaf in de testcontainer soms een captcha. `GET /` laat
  per winkel zien hoe het gaat. Na een paar dagen data: council over bol (besluit 0007).
- De EU-verplichte "laagste prijs 30 dagen" (omnibus) wordt nog niet uitgelezen. Coolblue en Amazon
  hadden hem niet op de pagina. De kolom staat klaar.
- Er is één testproduct (Sony WH-1000XM6 zwart, bij Coolblue, bol en Amazon). Meer toevoegen:
  `cd worker && npm run offer:add -- "naam" <url> [<url> ...]`.

## Volgende stap

1. Opnieuw deployen: `cd worker && npm ci && ./scripts/deploy.sh` (met `CLOUDFLARE_API_TOKEN`).
2. Over een paar dagen `GET /` bekijken en de council over bol houden.
3. Fase 2: inloggen, lijst, item detail met grafiek, live op prijs.prulwerk.nl.

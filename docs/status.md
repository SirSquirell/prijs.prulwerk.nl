# Status

Bijgewerkt: 2026-10-09

## Waar we staan

Fase 1 is live sinds 9 oktober 2026, 09:17: de Worker verzamelt prijzen. Fase 2 (inloggen, lijst,
itemdetail) is gebouwd, getest en de API is live. De frontend staat live op https://prijs.prulwerk.nl
zodra deze branch op `main` staat (GitHub Pages serveert `main` `/`). Het DNS-record staat.

## Werkt

**Prijzen (fase 1)**
- Worker https://prijswacht.prijswacht-worker.workers.dev met D1. Cron elke minuut, één aanbieding per
  aanroep, elke aanbieding om de 3 uur. Zo blijft elke aanroep onder de 10 ms CPU van het gratis plan.
- Prijs uit schema.org JSON-LD, eigen parser voor Amazon, meta-tags als laatste redmiddel.
- Elke check in `price_points` met een status (`ok`, `geblokkeerd`, `geen_prijs`, `robots`, `fout`). Een
  onbekende prijs blijft leeg. `price_daily` houdt per dag min, max en slot bij.
- robots.txt gerespecteerd. `GET /` toont per winkel hoe het afgelopen etmaal ging.
- Eerste checks vanaf Cloudflare: Coolblue €359,00, Amazon €300,71, bol 403.

**Inloggen en app (fase 2)**
- Uitnodigingslink + passkey (besluit 0003, uitgewerkt in 0008). Uitnodiging werkt één keer, 7 dagen
  (setup-link 24 uur), wordt pas verbruikt na een gelukte registratie. Sessie 30 dagen, schuift op
  zolang je de app gebruikt. Alleen hashes van tokens in D1.
- Beheer in de app (account): uitnodiging maken met naam, nieuwe link voor wie zijn passkey kwijt is,
  iemand intrekken, overzicht van uitnodigingen.
- Schermen: inloggen, uitnodiging, klaar (met uitleg beginscherm), je lijst met black friday-aftelling,
  item met grafiek (laagste prijs per dag, 90d laag/mediaan/hoog) en prijs per winkel, account.
- Waarschuwing in browsers van apps (whatsapp e.d.): eerst openen in safari of chrome.
- PWA: manifest, iconen (prulwerk-kaart met dalende lijn), service worker.
- CSP zonder externe scripts; de passkey-library staat in `vendor/`. Alle tekst via `textContent`.
- 91 tests, waaronder echte passkey-registraties en -logins met een nep-authenticator, plus een
  doorloop in Chromium met een virtuele passkey (uitnodiging → lijst → item → uitnodigen → uitloggen →
  inloggen).

## Werkt niet / open

- bol geeft 403, ook vanaf Cloudflare. Na een paar dagen data: council over bol (besluit 0007).
- De EU-verplichte "laagste prijs 30 dagen" wordt nog niet uitgelezen.
- Doelprijs en meldingen staan nog niet in de app (fase 4). Toevoegen vanuit de app is fase 3; tot dan:
  `cd worker && npm run offer:add -- "naam" <url> [<url> ...]` (beheerders volgen het meteen).
- "Enforce HTTPS" in de Pages-instellingen aanzetten zodra GitHub het certificaat heeft.

## Beheer

- Deployen: `cd worker && npm ci && ./scripts/deploy.sh` met `CLOUDFLARE_API_TOKEN` in de omgeving.
- Eerste beheerder of passkey kwijt: `node worker/scripts/setup-invite.js` (of `--herstel`). De link
  verschijnt alleen in die uitvoer, 24 uur geldig. Nooit in een commit of in dit bestand zetten.

## Volgende stap

Fase 3: item toevoegen met automatisch winkels zoeken en EAN-match.

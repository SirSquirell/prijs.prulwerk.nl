# Status

Bijgewerkt: 2026-10-09

## Waar we staan

Fase 3 (toevoegen) is live sinds 9 oktober. Plak een link bij "toevoegen", of deel hem op Android vanuit
de winkel-app naar prijswacht. Binnen een minuut staan naam en prijs erin.

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
- Doelprijs en meldingen staan nog niet in de app (fase 4).
- Op iPhone kan prijswacht niet in het deelmenu (Apple staat dat websites niet toe): kopiëren en plakken.
- "Enforce HTTPS" in de Pages-instellingen aanzetten zodra GitHub het certificaat heeft.

## Beheer

- Deployen: `cd worker && npm ci && ./scripts/deploy.sh` met `CLOUDFLARE_API_TOKEN` in de omgeving.
- Eerste beheerder of passkey kwijt: `node worker/scripts/setup-invite.js` (of `--herstel`). De link
  verschijnt alleen in die uitvoer, 24 uur geldig. Nooit in een commit of in dit bestand zetten.

**Toevoegen (fase 3, besluit 0009)**
- Link plakken of delen (Android, share target). Tracking-parameters gaan eraf, Amazon wordt `/dp/ASIN`.
- Eerste check binnen een minuut: naam, afbeelding, EAN en prijs van de pagina.
- Zelfde link bij een vriend: hetzelfde item met de geschiedenis die er al is. Zelfde EAN bij een andere
  winkel: wordt één item met meerdere winkels.
- Bij een item nog een winkel plakken, of stoppen met volgen. Volgt niemand het meer, dan stopt het
  ophalen; de geschiedenis blijft.
- Grenzen: 50 items per persoon, 170 actieve winkellinks in totaal (de cron haalt er 180 per 3 uur).

## Volgende stap

Fase 4: meldingen (push), doelprijs. Hieronder de scope uit de architect-review. Uit de architect-review van 9 oktober, voor fase 3-5 (keuzes die eerdere
besluiten raken gaan eerst langs een council):
- Fase 3 klein houden: links plakken, de cron haalt naam, EAN en prijs op, producten met dezelfde EAN
  samenvoegen. Niet zelf de zoekpagina's van winkels bevragen (CPU, blokkades).
- Workers AI waarschijnlijk niet nodig: matchen op EAN, teksten uit vaste zinnen (raakt besluit 0005).
- Over bol beslissen: "onbekend" accepteren, geen omwegen (raakt besluit 0007).
- Fase 4: meldingen vanuit de cron, stille uren als vaste 23-08, één bewakingsmelding als er 24 uur
  geen enkele geslaagde check was.
- Fase 5: oordeel tegen korte en gatenrijke geschiedenis bestand maken ("te weinig geschiedenis").
- Niet doen: omnibus-prijs uitlezen, geschiedenis van andere sites, apart black friday-scherm,
  opgeslagen oordelen, telegram, instelbare stille uren.
- Nu al: de verlanglijst van Mathijs en vrienden erin zetten, want elke dag eerder telt.

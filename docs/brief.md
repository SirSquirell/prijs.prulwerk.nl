# Brief: prijswacht

## In één zin

Je zegt welk product je wilt hebben, prijswacht volgt de prijs bij Nederlandse winkels, meldt het als
de prijs zakt, en zegt rond Black Friday of de korting echt is of nep.

## Voor wie

Mathijs en een paar vrienden. Privé, alleen op uitnodiging. Geen publieke aanmelding, geen
advertenties, geen affiliate-links nodig.

## Wat het moet doen

### 1. Item toevoegen
- Invoer: een productnaam ("sony wh-1000xm6") of een link naar een productpagina.
- Prijswacht zoekt hetzelfde product bij winkels die in Nederland leveren (bol, Coolblue, MediaMarkt,
  Amazon.nl, Alternate, Megekko, en wat er verder opduikt).
- Matchen op **EAN/GTIN**, niet op naam. Zelfde naam maar andere kleur of ouder model is een ander
  product.
- Twijfelgevallen staan standaard uit. De gebruiker vinkt aan wat hij wil volgen.
- Optioneel een doelprijs.

### 2. Prijzen volgen
- Elke paar uur per aanbieding: prijs en voorraad ophalen en opslaan. Daar zit geen AI bij.
- Een prijs die niet op te halen is wordt "onbekend", nooit een gok.

### 3. Melden
- Bij elke daling (als de gebruiker dat wil) en bij het halen van de doelprijs.
- Nooit dezelfde melding twee keer.
- Stille uren, standaard 23:00 tot 08:00.

### 4. Black Friday-oordeel
Per item met een prijsverandering in de Black Friday-week één oordeel:

| Oordeel | Regel |
|---|---|
| **echte deal** | prijs nu ≤ laagste prijs van de afgelopen 90 dagen, én minstens 10% onder de mediaan van 90 dagen |
| **nep-korting** | de prijs is in de 30 dagen ervoor opgehoogd, en de "korting" brengt hem niet onder het niveau van daarvoor |
| **meh** | wel lager dan gisteren, maar deze prijs is in de afgelopen 90 dagen al eerder gezien |

Het oordeel is vaste code, geen AI. De AI mag alleen de zin eromheen schrijven. Toon ook de laagste
prijs van de afgelopen 30 dagen die de winkel volgens de EU-regels zelf moet vermelden, als die op de
pagina staat.

Drempels (90 dagen, 10%, 30 dagen) zijn constanten in één bestand, met tests.

## Schermen

Zie `docs/design/`. Zes schermen: inloggen, je lijst, item toevoegen, item detail, Black
Friday-oordeel, account en meldingen. Het design is een richting, geen pixelspecificatie. Wijk af als
het beter werkt, maar houd de huisstijl.

**Afwijking van het design, al besloten:** het design toont inloggen met een e-maillink. Dat wordt
**uitnodigingslink + passkey** (zie `docs/besluiten/0003-inloggen.md`), omdat e-mail versturen een extra
account en DNS-records naast de mail van prulwerk.nl zou vragen. Pas het inlogscherm daarop aan.

## Wat het niet is

- Geen publieke prijsvergelijker. Geen SEO, geen landingspagina.
- Geen native app. Het is een website die je op je beginscherm zet (PWA).
- Geen aankoopknop, geen winkelwagen, geen betalingen.

## Planning

Vandaag is het 8 oktober 2026. Black Friday is vrijdag 27 november.

| Fase | Klaar uiterlijk | Wat |
|---|---|---|
| 1 | 15 okt | Worker + D1 + cron haalt prijzen op voor handmatig ingevoerde items. **Data verzamelen begint.** |
| 2 | 22 okt | Inloggen (uitnodiging + passkey), lijst, item detail met grafiek, live op prijs.prulwerk.nl |
| 3 | 29 okt | Item toevoegen met automatisch winkels zoeken en EAN-match |
| 4 | 5 nov | Pushmeldingen, doelprijs, stille uren |
| 5 | 12 nov | Oordeellogica + tests op echte data, generale repetitie met nepdata |
| 6 | 19 nov | Bugs, extra winkelparsers, eventueel geschiedenis aanvullen uit andere bronnen |
| - | 27 nov | Black Friday |

Fase 1 is heilig. De rest mag schuiven.

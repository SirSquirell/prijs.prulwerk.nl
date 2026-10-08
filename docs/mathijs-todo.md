# Wat Mathijs zelf moet doen

Zo kort mogelijk. Alleen wat echt niet anders kan. De agent vraagt het op het moment dat het nodig is,
niet vooraf.

## Nodig

1. **Cloudflare koppelen, één keer.** De agent draait `npx wrangler login`. Er opent een
   browservenster: inloggen bij Cloudflare (als dat nog niet zo is) en op **Allow** klikken. Klaar.
2. **DNS-record voor prijs.prulwerk.nl.** De agent zet het zelf via de Cloudflare-API of het dashboard
   als dat met de login van stap 1 kan. Lukt dat niet, dan vraagt hij één klik in het dashboard, met
   precies wat er moet staan.
3. **De app op je telefoon zetten.** Uitnodigingslink openen, passkey aanmaken, in Safari of Chrome
   "Zet op beginscherm", meldingen toestaan.

## Alleen als een council besluit dat het nodig is

- Gemini API-key (gratis), als winkels zoeken zonder websearch tegenvalt.
- Telegram-bot, als je meldingen liever via Telegram krijgt.

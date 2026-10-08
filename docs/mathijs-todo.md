# Wat Mathijs zelf moet doen

Zo kort mogelijk. Alleen wat echt niet anders kan. De agent vraagt het op het moment dat het nodig is,
niet vooraf.

## Nodig

1. **Cloudflare koppelen, één keer.** De agent draait in een cloudsessie zonder browser, dus
   `wrangler login` werkt daar niet. In plaats daarvan:
   - Cloudflare-dashboard → My Profile → API Tokens → Create Token → template **Edit Cloudflare
     Workers**. Voeg toe: Account → **D1** → Edit. Account: het prulwerk-account. Zones: prulwerk.nl.
   - Zet het token in de instellingen van de cloud-environment (titelbalk van de sessie → environment →
     Edit) als variabele `CLOUDFLARE_API_TOKEN`. Niet in de chat plakken.
   - Nieuwe sessie starten en "Go" zeggen. De agent doet de rest met `worker/scripts/deploy.sh`.

   Werk je lokaal met Claude Code, dan volstaat `npx wrangler login` en op **Allow** klikken.
2. **DNS-record voor prijs.prulwerk.nl.** De agent zet het zelf via de Cloudflare-API of het dashboard
   als dat met de login van stap 1 kan. Lukt dat niet, dan vraagt hij één klik in het dashboard, met
   precies wat er moet staan.
3. **De app op je telefoon zetten.** Uitnodigingslink openen, passkey aanmaken, in Safari of Chrome
   "Zet op beginscherm", meldingen toestaan.

## Alleen als een council besluit dat het nodig is

- Gemini API-key (gratis), als winkels zoeken zonder websearch tegenvalt.
- Telegram-bot, als je meldingen liever via Telegram krijgt.

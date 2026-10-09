# 0008: uitwerking van inloggen (uitnodiging + passkey)

Datum: 2026-10-09 · Status: besloten
Vraag: hoe werken we besluit 0003 concreet uit, veilig en zonder dat Mathijs iets hoeft te configureren?
Opties: het voorstel (challenges in D1, library via jsdelivr met SRI, uitnodiging 7 dagen) of aanpassingen.
Council: bouwer → voorstel met aanpassingen, dwarsligger → voorstel met aanpassingen (geen veto),
gebruiker → voorstel met aanpassingen
Besluit: het voorstel, met deze aanpassingen van de council:
- Challenges ondertekend met HMAC (`AUTH_SECRET`, zelf gegenereerd, `wrangler secret put`), niet in D1.
  Pas na een gelukte verificatie komt de challenge in `used_challenges`, zodat hij één keer werkt. Spam
  op de openbare endpoints kan zo het D1-schrijfbudget, en daarmee het prijzen verzamelen, niet opmaken.
- `@simplewebauthn/browser` als één bestand in `vendor/`, geen CDN. CSP met `script-src 'self'`.
  Alle tekst via `textContent`, want productnamen komen van winkelpagina's.
- Uitnodiging: token in het fragment (`#uitnodiging=`), meteen uit de adresbalk gehaald, altijd in de
  POST-body naar de Worker. Pas verbruikt na een gelukte registratie (atomair), zodat een
  whatsapp-voorbeeld of een afgebroken poging hem niet opmaakt. Setup-link 24 uur, andere 7 dagen.
- Passkeys: ES256 en RS256, attestation none, residentKey required, userVerification preferred,
  teller 0 toegestaan (gesynchroniseerde passkeys). Meerdere passkeys per account.
- Sessie 30 dagen, schuift eens per dag op zolang je de app gebruikt. Token in localStorage.
- In browsers van apps (whatsapp, instagram, ...) eerst "open in safari/chrome", geen passkey-poging.
- Beheer: uitnodiging met naam, nieuwe link voor een bestaand account, intrekken (sessies en passkeys
  weg). Herstel zonder app: `worker/scripts/setup-invite.js --herstel`.
- RP ID en origin als variabelen in `wrangler.toml`; lokaal `localhost` via `.dev.vars`.
Waarom: de zwakke plekken zijn niet het raden van tokens maar spam op D1 en XSS via winkeldata.
Risico en hoe we het afvangen: de RP ID `prijs.prulwerk.nl` ligt vast; verhuist de site, dan moet
iedereen via een nieuwe uitnodiging een nieuwe passkey maken. De setup-link verschijnt alleen in de
uitvoer van het script, nooit in een commit of CI-log.
Terugdraaien kan door: library of instellingen wisselen in `worker/src/auth.js`; gebruikers merken
daar niets van.

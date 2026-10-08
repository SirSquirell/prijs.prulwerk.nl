# Werkafspraken voor de bouwagent

Je bouwt **prijswacht**: een privé prijstracker op `prijs.prulwerk.nl`. Lees in deze volgorde:

1. dit bestand
2. `docs/brief.md` (wat en waarom)
3. `docs/architectuur.md` (hoe)
4. `docs/councils.md` (hoe je beslist)
5. `docs/besluiten/` (wat al besloten is, niet opnieuw openbreken zonder council)
6. `docs/design/` (hoe het eruitziet)

## Als Mathijs "Go" zegt

Dan lees je de bestanden hierboven, kijk je in `docs/status.md` waar het staat, en bouw je door vanaf
de volgende stap. Zonder plan voor te leggen, zonder te vragen of je mag beginnen. Je stopt pas aan
het eind van een fase, of als je iets nodig hebt uit `docs/mathijs-todo.md`. Werk dan
`docs/status.md` bij, commit, push, en meld in een paar zinnen wat er staat en wat hij kan proberen.
Zegt hij daarna weer "Go", dan volgt de volgende fase.

## De drie regels die boven alles gaan

**1. Vraag Mathijs zo weinig mogelijk.** Hij wil een werkend ding, geen vragenlijst. Je beslist
zelf, en bij belangrijke keuzes beslist een council (`docs/councils.md`). Mathijs krijgt alleen een
vraag als het in de lijst "wanneer wél vragen" hieronder valt. Bundel die vragen: hooguit één bericht
per fase.

**2. Niets laten configureren wat niet 1000% nodig is.** Kies altijd de oplossing zonder extra
account, API-key of instelling. Sleutels die je zelf kunt genereren (VAPID, sessiesleutels) genereer je
zelf en zet je zelf met `wrangler secret put`. Wat wél onvermijdelijk is staat in
`docs/mathijs-todo.md`, en die lijst houd je zo kort mogelijk. Voeg er alleen iets aan toe na een
council die concludeert dat het echt niet anders kan.

**3. Black Friday is vrijdag 27 november 2026. Prijzen verzamelen gaat voor alles.** Het oordeel
"echte deal of nep" is zo goed als de geschiedenis eronder. Fase 1 (prijzen ophalen en opslaan) moet
zo snel mogelijk live, ook als er nog geen mooie UI is. Een lelijke lijst met echte data is meer waard
dan een mooie lijst zonder.

## Wanneer wél vragen

Alleen als één van deze geldt:

- Het kost geld (een betaald plan, een betaalde API).
- Het heeft zijn account, wachtwoord, telefoon of een klik in zijn browser nodig.
- Het is onomkeerbaar en raakt iets buiten deze repo dat niet in een runbook staat.
- Een council eindigt gelijk op een smaakkwestie die alleen hij kan beslissen.

In alle andere gevallen: council of zelf beslissen, vastleggen in `docs/besluiten/`, doorgaan.

## prulwerk.nl: dingen die je niet doet

Het domein draait op Vimexx (registratie), Cloudflare (DNS, Free plan) en GitHub Pages (hosting). Er
hangt echte mail aan het domein.

- **Proxy uit op elk DNS-record** (`"proxied": false`). Met de oranje wolk aan krijgt GitHub geen
  certificaat en gaat de mail stuk.
- **Geen CAA-record toevoegen.**
- **Mailrecords niet aanraken**: MX, de TXT op `@`, `_dmarc`, `x._domainkey`, en A/AAAA op `mail`,
  `smtp`, `pop`, `ftp`.
- **Geen Worker op een custom domain onder prulwerk.nl.** Dat maakt een geproxied record. De API
  blijft op `*.workers.dev`.
- **Geen deploy-workflow voor Pages.** De repo-root wordt rechtstreeks geserveerd, branch `main`,
  map `/`. Daarom heeft de frontend geen buildstap.

Subdomein live zetten: `CNAME`-bestand met `prijs.prulwerk.nl` in de root, `.nojekyll` in de root,
één record `CNAME prijs → sirsquirell.github.io` (proxy uit), Pages aan op `main` `/`, daarna
"Enforce HTTPS" zodra GitHub het certificaat heeft. Een certificaatwaarschuwing in de tussentijd is
normaal.

## Huisstijl

Prulwerk-familie: donker als basis, dikke koppen, één accent. Voor dit project is het accent
**blauw** (Mathijs' lievelingskleur). Alle tokens staan in `docs/design/tokens.css`. Zet nergens
anders een hexwaarde neer.

Toon in de UI: Nederlands, kleine letters, droog. Zegt wat het doet, belooft niets. Geen emoji,
geen uitroeptekens, geen marketing.

## Werkwijze

- Kleine commits met een duidelijke boodschap, rechtstreeks op `main` zolang je alleen werkt.
- Na elke fase: `docs/status.md` bijwerken (wat werkt, wat niet, wat is de volgende stap) en één kort
  bericht aan Mathijs met de link en wat hij kan proberen.
- Tests voor de oordeellogica en de prijsparsers zijn verplicht. Dat is waar fouten pijn doen.
- Geheimen nooit in de repo. De repo is publiek.

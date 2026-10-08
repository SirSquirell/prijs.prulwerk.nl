# Design

Zes telefoonschermen, 390 × 844, in `schermen/`. Ze komen uit een designcanvas
(https://claude.ai/artifact/WogmLLTJpzGdwJq75xuxfU, privé, alleen voor Mathijs zichtbaar). De
`.dc.html`-bestanden draaien buiten dat canvas niet los. Lees ze als markup: indeling, teksten, maten
en stijlen staan er letterlijk in.

| Bestand | Scherm |
|---|---|
| `Main.dc.html` | inloggen (wordt uitnodiging + passkey, zie besluit 0003) |
| `Overzicht.dc.html` | je lijst, met black friday-aftelling |
| `Toevoegen.dc.html` | item toevoegen, winkels aanvinken |
| `Item.dc.html` | item detail: grafiek 90 dagen, prijs per winkel, doelprijs |
| `Deal.dc.html` | black friday-oordeel: echte deal, nep-korting, meh |
| `Meldingen.dc.html` | account, kanalen, wanneer melden, apparaten |

De prijzen in de schermen zijn voorbeelden.

## Stijl

- Tokens: `tokens.css`. Donker is de standaard, licht volgt het systeem. De schermen zijn alleen in
  donker getekend.
- Accent: blauw `#5B9DFF`. Geen tweede accent. `--warn` is alleen voor nep-korting, prijsstijging en
  destructieve acties.
- Koppen: Archivo 900, letter-spacing `-0.035em`, regelhoogte 0.92–0.96. Lopende tekst: Instrument
  Sans 400 (600 voor nadruk). Labels en data: JetBrains Mono. Via Google Fonts.
- Oordelen verschillen niet alleen in kleur: elk heeft een eigen icoon en woord (vinkje + "echte
  deal", kruis + "nep-korting", streep + "meh").
- Tikdoelen minimaal 44 px. Echte `<button>`, `<a>`, `<input>` met `<label>`.

## Icoon

Prulwerk-kaart (512 grid, radius 96, kaart `#101010`) met een dalende lijn: punten
`112,160 → 208,232 → 272,200` in `--text`, het laatste stuk `272,200 → 400,352` in blauw, lijndikte
44, ronde uiteinden. Lever `favicon.svg`, `favicon-light.svg` (kaart `#EFEFEF`, lijn `#12120F`),
`favicon-32.png` en `apple-touch-icon.png` (180 px, vol vlak) in de repo-root.

Head-blok:

```html
<meta name="theme-color" content="#050505" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F4F4F1" media="(prefers-color-scheme: light)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon-light.svg" type="image/svg+xml" media="(prefers-color-scheme: light)">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
```

## Wordmark

Linksboven "prijswacht" in Archivo 900. Klein rechtsboven `prulwerk.nl`, gelinkt naar
`https://prulwerk.nl/`: "prulwerk" in `--text`, ".nl" in `--prulwerk-lime`.

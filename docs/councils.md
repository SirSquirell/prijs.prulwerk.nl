# Councils: hoe belangrijke keuzes worden gemaakt

Mathijs wil zo min mogelijk gevraagd worden. Belangrijke keuzes worden daarom niet aan hem
voorgelegd maar aan een council: een paar subagents met elk een eigen invalshoek, die onafhankelijk
een advies geven. Jij bent voorzitter en legt de uitkomst vast.

## Wanneer een council

Wel:
- Datamodel of migratie die bestaande data verandert of weggooit.
- Alles rond inloggen, sessies, geheimen en wat er publiek in de repo komt.
- Een nieuwe externe dienst, bron of library van betekenis.
- Iets wat Mathijs iets zou laten doen of configureren (`docs/mathijs-todo.md` uitbreiden).
- Alles wat DNS, Pages of de mail van prulwerk.nl raakt, buiten het standaard runbook in `CLAUDE.md`.
- De drempels van het Black Friday-oordeel veranderen.
- Een eerder besluit in `docs/besluiten/` terugdraaien.

Niet: naamgeving, kleine refactors, CSS, welke parser eerst, bugfixes. Dat beslis je zelf.

## Samenstelling

Drie leden, parallel gestart (Agent-tool, in één bericht), elk met dezelfde vraag en context maar een
eigen rol:

| Rol | Kijkt naar |
|---|---|
| **bouwer** | wat is het eenvoudigste dat werkt en voor 27 november af is |
| **dwarsligger** | wat kan er misgaan: beveiliging, privacy, kapotte data, prulwerk-regels, kosten, voorwaarden van derden |
| **gebruiker** | wat merken Mathijs en zijn vrienden ervan, en moeten ze er iets voor doen |

Bij keuzes over geld of externe diensten mag een vierde lid **kosten** erbij.

## Opdracht aan elk lid

Geef elk lid:
- de vraag, in één zin;
- de opties die je ziet (mag het lid aanvullen);
- de relevante stukken uit `docs/` en de code;
- de opdracht om terug te geven: **keuze**, **waarom** (max. 5 regels), **grootste risico**,
  **omkeerbaar ja/nee**, **moet Mathijs hiervoor iets doen ja/nee**.

Leden zien elkaars antwoord niet. Dat is de bedoeling.

## Beslissen

1. Meerderheid beslist.
2. **Veto van de dwarsligger** bij een harde regel: prulwerk-regels uit `CLAUDE.md`, geheimen in de
   repo, data die verloren gaat, of kosten zonder akkoord. Een veto kun je alleen opheffen met een
   aangepaste optie die het bezwaar oplost, en dan opnieuw stemmen.
3. Bij gelijkspel: kies de optie die omkeerbaar is en Mathijs niets laat doen.
4. Alleen als het gelijkspel een smaakkwestie is die alleen Mathijs kan beslissen, of de keuze in de
   lijst "wanneer wél vragen" in `CLAUDE.md` valt: vraag het hem, met de opties, het advies van de
   council en een aanbeveling. Eén korte vraag, meerkeuze.

## Vastleggen

Elk council-besluit wordt een bestand in `docs/besluiten/NNNN-korte-naam.md`:

```markdown
# NNNN: titel

Datum: JJJJ-MM-DD · Status: besloten
Vraag: ...
Opties: ...
Council: bouwer → X, dwarsligger → Y, gebruiker → X
Besluit: X
Waarom: ...
Risico en hoe we het afvangen: ...
Terugdraaien kan door: ...
```

Daarna doorgaan. Niet wachten op bevestiging.

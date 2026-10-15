# 0009: item toevoegen door een link te plakken of te delen

Datum: 2026-10-09 · Status: besloten (Mathijs, op voorstel na de architect-review)
Vraag: hoe voegt een gebruiker iets toe, nu automatisch zoeken bij alle winkels duur en onbetrouwbaar is?
Opties: zoekpagina's van winkels bevragen (brief, fase 3); link plakken of delen.
Besluit: link plakken (iPhone) of delen via het deelmenu (Android, Web Share Target). De cron haalt
binnen een minuut naam, EAN en prijs op. Producten met dezelfde EAN worden één item met meerdere winkels.
Een tweede winkel voeg je toe door bij het item nog een link te plakken. Geen Workers AI nodig voor
matchen: EAN of niets.
Waarom: één pagina kost al 6-9 ms CPU; zes zoekpagina's per toevoeging past niet in het gratis plan, en
bol blokkeert, Amazon toont soms een captcha. Plakken werkt altijd en kost niets.
Risico: op iPhone kan een website op het beginscherm niet in het deelmenu (Apple). Daar is het kopiëren
en "plak link". Een item heeft alleen de winkels waarvan iemand een link plakte.
Terugdraaien kan door: zoeken later toevoegen naast plakken; het datamodel verandert er niet door.

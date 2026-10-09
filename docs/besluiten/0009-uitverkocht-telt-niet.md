# 0009: uitverkocht of pre-order telt niet als prijs

Datum: 2026-10-09 · Status: besloten
Vraag: telt een prijs van een winkel die zegt dat het product uitverkocht of pre-order is mee als laagste prijs en als dagwaarde?
Opties: A alles met status `ok` telt; B `in_stock = 0` telt niet mee voor de kopprijs en niet voor `price_daily`.
Council: niet nodig: bugfix in een afleidregel, de ruwe data in price_points blijft volledig
Besluit: B. `in_stock = 0` telt niet mee voor de kopprijs (`lowestNow`) en komt niet in `price_daily`. Onbekend
(`NULL`) telt wel mee, want veel winkels geven geen availability. Pre-order valt onder uitverkocht, omdat
`jsonld.js` dat al zo afbeeldt en een pre-orderprijs geen schapprijs is.
Waarom: een winkel die op een uitverkochte pagina een oude of pre-orderprijs laat staan zou anders de kopprijs
en een punt in de dagreeks worden, en op die reeks bouwt het oordeel "echte deal of nep".
Risico: een product dat alleen als pre-order bestaat bouwt geen geschiedenis op tot de release. Dat is bewust.
De winkel zelf toont in het itemscherm nog wel zijn prijs, met "niet op voorraad".
Terugdraaien kan door: de twee condities weghalen (`stats.js` en `db.js`) en `price_daily` herbouwen uit `price_points`.

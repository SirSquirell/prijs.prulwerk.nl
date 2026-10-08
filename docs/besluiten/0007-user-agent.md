# 0007: welke User-Agent de prijsfetcher stuurt

Datum: 2026-10-08 · Status: besloten
Vraag: welke User-Agent stuurt de prijsfetcher, nu Coolblue een kale bot-UA weigert en bol en Amazon blokkeren?
Opties: A eerlijke bot-UA; B Chrome-UA voor alle winkels; C per winkel een Chrome-UA waar robots.txt het pad
toestaat; D eerlijke UA in browservorm.
Council: bouwer → C (met D als standaard), dwarsligger → D, gebruiker → D
Besluit: D. `Mozilla/5.0 (compatible; prijswacht/1.0; +https://prijs.prulwerk.nl)`, voor alle winkels.
Waarom: eerlijk en met contactadres, en het komt langs simpele UA-filters (Coolblue gaf hiermee 200). Een
Chrome-UA in een publieke repo onder prulwerk.nl is bewust bot-detectie omzeilen, en het helpt niet tegen
wat we zagen: bol blokkeert op IP, Amazon toont soms een captcha.
Risico en hoe we het afvangen: winkels blijven blokkeren en we missen geschiedenis voor Black Friday. Daarom
slaat elke check een status op (`ok`, `geblokkeerd`, `geen_prijs`, `robots`, `fout`), nooit een gok, en
toont `GET /` op de Worker per winkel hoe het afgelopen etmaal ging. Binnen een paar dagen na livegang een
vervolgcouncil voor winkels die vanaf Cloudflare blijven blokkeren.
Terugdraaien kan door: `USER_AGENT` in `worker/src/config.js` aanpassen.

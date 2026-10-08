# 0002: backend op Cloudflare Workers + D1

Datum: 2026-10-08 · Status: besloten
Vraag: waar draaien de prijschecks en waar staat de data?
Besluit: één Cloudflare Worker op workers.dev met Cron Triggers en een D1-database.
Waarom: GitHub Pages is statisch. De DNS van prulwerk.nl staat al bij Cloudflare, het gratis plan
volstaat, Workers AI zit erbij zonder extra key.
Risico: limieten van het gratis plan (CPU, subrequests). Afvangen met batches in de cron.
Bewust geen custom domain: dat maakt een geproxied record onder prulwerk.nl, en de proxy blijft uit.
Terugdraaien kan door: D1 is SQLite, export en verhuizen is eenvoudig.

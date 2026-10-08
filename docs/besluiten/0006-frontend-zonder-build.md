# 0006: frontend zonder buildstap, in de repo-root

Datum: 2026-10-08 · Status: besloten
Vraag: hoe wordt de frontend gebouwd en gehost?
Besluit: plain HTML, CSS en ES modules in de root van deze repo. GitHub Pages serveert `main` `/`
rechtstreeks. De Worker staat in `worker/`.
Waarom: zo werken alle prulwerk-subdomeinen: geen deploy-workflow, niets om stuk te gaan.
Risico: geen bundler of TypeScript in de frontend. Bij zes schermen is dat te overzien.
Terugdraaien kan door: later een build naar een `gh-pages`-branch, als een council dat besluit.

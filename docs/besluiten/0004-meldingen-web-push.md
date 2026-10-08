# 0004: meldingen via Web Push

Datum: 2026-10-08 · Status: besloten
Vraag: hoe komen meldingen binnen?
Opties: Telegram-bot, e-mail, Web Push.
Besluit: Web Push. Telegram alleen als Mathijs er later om vraagt.
Waarom: Web Push heeft geen account nodig, de agent genereert de VAPID-sleutels zelf.
Risico: iPhone alleen vanaf het beginscherm. Uitgelegd op het meldingenscherm.
Terugdraaien kan door: een tweede kanaal toevoegen naast `push_subs`.

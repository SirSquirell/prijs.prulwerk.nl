# 0003: inloggen met uitnodigingslink + passkey

Datum: 2026-10-08 · Status: besloten
Vraag: hoe loggen gebruikers in?
Opties: e-maillink (zoals in het design), wachtwoord, Telegram-login, uitnodiging + passkey.
Besluit: uitnodiging + passkey. Geen wachtwoord, geen e-mail.
Waarom: e-mail versturen vraagt een extra account (bijv. Resend) en extra DNS-records naast de
mailrecords van prulwerk.nl. Telegram-login vraagt een bot die Mathijs zelf moet maken. Passkeys
werken zonder externe dienst en zijn veiliger dan een wachtwoord. Privé en op uitnodiging past bij
de doelgroep.
Risico: passkey kwijt. Afvangen: admin maakt een nieuwe uitnodiging voor hetzelfde account.
Terugdraaien kan door: e-maillink later toevoegen als tweede methode.

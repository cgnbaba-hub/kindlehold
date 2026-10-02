# Kindlehold — Hinweise für Claude Code

Lies zuerst `HANDOFF.md`: Stand, Befehle, Architektur, Arbeitsweise mit dem Nutzer und offene Punkte.
Kurz: auf Deutsch antworten (du), kurze Updates, nur auf Bitte pushen/deployen, ehrlich messen.
Vor dem Abschluss: `npm test` grün; bei sichtbaren Änderungen `npm run build` und passende Verifikation.

## Schwierigkeit: das Spiel darf nicht zu leicht werden (Wunsch des Nutzers, 2026-10-02)
- Wirtschaft, Transport, Ressourcen und Kampf sollen fordern, abgestuft nach dem gewählten
  Schwierigkeitsgrad (Story leichter, Normal fordernd, Hard hart). Komfort ist gut, solange er
  Planung belohnt (z. B. Lager an der richtigen Stelle), statt Engpässe einfach abzuschaffen.
- Wenn der Nutzer eine Erleichterung vorschlägt oder fragt, ob etwas effizienter gehen könnte
  (Verteilung, Transport, Produktion, Heilung …): **ausdrücklich sagen**, ob und wie sehr das die
  Spieldynamik entschärft. Dann Varianten mit Preis anbieten (Kosten, Unterhalt, Forschung,
  Platz, Risiko) und den Unterschied messen, z. B. mit `npm run balance` und `scripts/balance-duels.mjs`.
- Bei jeder neuen Erleichterung prüfen: Wird Normal dadurch messbar leichter (Siegzeit,
  Bevölkerung, Stillstand der Werkstätten)? Falls ja, Gegengewicht einbauen oder nur auf Story.

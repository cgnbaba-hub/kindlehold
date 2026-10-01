# Kindlehold im Vorstellungsgespräch — Leitfaden

Kurze Notizen, um das Projekt souverän und ehrlich zu zeigen. Nicht auswendig lernen – eher
als Gerüst für die eigenen Worte.

## Der Einstieg (30 Sekunden)

„Kindlehold ist ein 3D-Aufbaustrategiespiel im Browser, inspiriert von Die Siedler: sechs
Kapitel mit Geschichte, vier Gegnerfraktionen, eine Wirtschaft mit arbeitenden Siedlern.
Ich habe es mit Claude Code gebaut, einem KI-Coding-Agenten. Die Richtung, die Prioritäten, das
Testen und den Betrieb habe ich übernommen, den Code hat der Agent geschrieben. Es läuft live
auf meinem eigenen Server.“

Dann: Live-Link öffnen, 1–2 Minuten spielen (Siedlung, eine Schlacht), danach das Repository.

## Was ich gemacht habe (mein Anteil)

- **Produktvision und Prioritäten:** Was als Nächstes kommt, was gut genug ist, was nicht
  (z. B. „die Figuren sind noch nicht auf Siedler-Niveau“ → Wechsel auf modellierte Figuren).
- **Testen wie ein Spieler:** Fehler gefunden und präzise beschrieben – rutschende Füße,
  seltsam gehaltene Werkzeuge, Hänger und Flackern auf meinem Laptop.
- **Entscheidungen mit Abwägung:** Figurenpaket (Lizenz CC0 geprüft), Stil (Köpfe groß lassen),
  Freies Spiel zusätzlich zur Kampagne.
- **Betrieb:** eigener VPS, nginx im Container, Cloudflare-Tunnel, Deployment-Ablauf,
  Fehlersuche beim Zugriff (Deploy-Key abgelehnt → Lesen über HTTPS).
- **Den Agenten führen:** klare Aufträge, Rückmeldungen mit Beobachtungen statt Vermutungen,
  Arbeiten in Paketen mit Pull Request und Merge.

## Technische Punkte, die ich erklären kann

- **Simulation getrennt von Darstellung:** Die Spiellogik läuft in festen Schritten (20/s) und
  zeichnet nichts; die Grafik liest nur den Zustand. Vorteil: flüssig bei jeder Bildrate, und
  die Logik ist ohne Browser testbar.
- **Determinismus:** Zufall kommt aus einem Generator mit Startwert im Spielzustand. Gleiche
  Eingaben → gleiches Spiel. Deshalb kann ein Bot ganze Kapitel in Tests durchspielen.
- **Speichern = den Spielzustand als JSON sichern**, beim Laden streng prüfen (Schema,
  Migrationen für alte Spielstände).
- **Qualitätssicherung:** 153 automatische Tests, 17 Browser-Tests, Dauertests auf
  Speicherlecks, Screenshot-Prüfungen, automatische Tests bei jedem Push.
- **Leistung:** Hunderte Figuren in wenigen Zeichenaufrufen (Instancing, Animation auf der
  Grafikkarte); ein Regler schaltet bei Überlastung erst Effekte ab, dann die Auflösung;
  Diagnose-Log (F3) für Messwerte vom echten Gerät.

## Typische Fragen – und ehrliche Antworten

**„Hast du das selbst programmiert?“**
„Nein, geschrieben hat den Code der KI-Agent, und das steht auch in jedem Commit. Mein Teil war
alles drumherum: was gebaut wird, ob es gut ist, was kaputt ist und wie es live geht. Ich kann
erklären, wie das Spiel aufgebaut ist und warum.“

**„Was war die größte Schwierigkeit?“**
Zum Beispiel: Das Spiel lief nach einigen Minuten auf meinem Mac instabil, in den Tests aber
nicht (die laufen ohne echte Grafikkarte). Lösung: erst Notbremse bei Überlastung, dann ein
Diagnose-Log, um Messwerte von meinem Gerät zu holen statt zu raten.

**„Wie stellst du sicher, dass KI-Code funktioniert?“**
Automatische Tests auf mehreren Ebenen, jeder Arbeitsschritt als Pull Request, ich spiele jeden
Stand selbst, und Messungen statt Bauchgefühl (z. B. Dreiecke, Bildzeit vorher/nachher).

**„Was würdest du als Nächstes machen?“**
Straßen und Träger, ein Markt, Balance mit echten Spielern. (Längere
Warenketten und Zufallskarten sind schon drin.)

## Worauf achten

- Nie behaupten, den Code selbst geschrieben zu haben.
- Zahlen parat haben: 6 Kapitel, 4 Fraktionen, 153 Tests, 17 Browser-Tests, Live-Server.
- Das README vorher einmal durchlesen – es ist die Visitenkarte des Repos.

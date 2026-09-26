# Handoff — Stand für neue Sessions (Stand 2026-09-26, Stufe 2)

Kindlehold ist ein originales Browser-3D-Siedlungs-/RTS-Spiel (Three.js 0.186, Vite 8, reines JS,
ES-Module). Entwickelt wurde es in einer Claude-Code-Session auf einem Hostinger-VPS. Diese Datei
fasst zusammen, was eine neue Session (z. B. Claude Code im Web) wissen muss.

## Zusammenarbeit mit dem Nutzer

- Deutsch, informell („du“), kurze direkte Updates statt Textwände.
- Bei vagen Eingaben nachfragen statt raten.
- Commits sind im Projekt üblich (klein, häufig). Pushen, Deployen, Löschen und andere sichtbare
  oder schwer umkehrbare Aktionen nur auf ausdrückliche Bitte, vorher ankündigen.
- Ehrlich berichten: echte Messwerte, keine geschönten Bewertungen.
- Keine urheberrechtlich geschützten Assets, kein Auftreten als offizielles Remake.

## Wo das Spiel läuft

- Live: https://kindlehold.js-automata.work. Das ist ein nginx-Container `kindlehold-web` auf dem
  VPS (127.0.0.1:8098), erreichbar über einen Cloudflare-Tunnel.
- **Deployen geht nur auf dem VPS** (`SKIP_TUNNEL=1 deploy/scripts/publish-vps.sh`). Eine
  Cloud-Session kann nicht deployen. Änderungen pushen, der Nutzer deployt danach vom VPS aus.
- Zuletzt deployt: Commit `072565d`. Die Stufe-2-Änderungen liegen auf dem Branch
  `claude/dreamy-ptolemy-ef0rzl` und sind noch nicht deployt.

## Befehle

```bash
npm ci && npx playwright install chromium   # einmalig
npm run dev          # http://127.0.0.1:5180/  (?debug=1 stellt window.__GAME__ bereit)
npm test             # 82 node:test-Tests (Unit, Integration, deterministische Simulation)
npm run build
npm run verify -- --prod --nofps    # 12 Screenshot-Presets + JSON-Berichte (langsam)
npm run test:e2e -- --only=<name>   # UI-Tests in Headless-Chromium, --only filtert
npm run test:audio   # Lautstärke-Grenze (Spitze < 0.5) und hörbare Musik
```

- Ohne GPU (SwiftShader) dauert ein Screenshot-Preset etwa 4 Minuten. Deshalb lange Läufe im
  Hintergrund starten und in kurzen Abständen nachsehen.
- `vite build` nie ausführen, solange ein verify-/e2e-Lauf `dist/` ausliefert.
- Bei Testketten nicht per `| grep` prüfen, das verdeckt Fehlschläge. Besser:
  `npm test > log && grep -q "ℹ fail 0" log`.

## Architektur in Kürze

Details stehen in `ARCHITECTURE.md`, `GAME_DESIGN.md` und `docs/DECISIONS.md`.

- Feste 20-Hz-Simulation, deterministisch: sfc32-RNG im world-Objekt, kein `Math.random` und keine
  Uhrzeit in der Simulation. Das world-Objekt ist die Grenze für Speichern/Laden.
- Event-Bus und ModuleHost mit Fehlergrenzen. View-Code (`src/environment`, `src/terrain`, `src/effects`,
  `src/selection`) verändert die Simulation nie.
- Die komplette Grafik ist prozedural: Splat-Terrain-Shader (`src/terrain/terrain-view.js`), instanzierte
  Figuren und Vegetation. `sceneryRelief()` in `src/world/terrain-data.js` formt die Randberge, wirkt
  aber nur auf die Darstellung.
- Audio ist prozedurales WebAudio (`src/audio/index.js`) mit Kompressor und einer harten
  Pegelgrenze (0.5·tanh). Keine Rückkopplungsschleifen einbauen: Das hat früher einen
  ohrenbetäubenden Ton erzeugt.
- Steuerung (`src/input/index.js`, `src/camera/rts-camera.js`):
  - Rechte Maustaste ziehen verschiebt die Karte, ein kurzer Rechtsklick gibt Befehle.
  - Das Mausrad zoomt zum Cursor, die mittlere Maustaste dreht die Ansicht.
  - `rts.setOverride()` ist ein Foto-Kamera-Modus für das Keyart
    (`scripts/assets/render-menu-art.mjs`).
- Das interaktive Tutorial liegt in `src/ui/tutorial.js`. `settings.tutorialDone` merkt sich, ob es
  schon durchlaufen wurde; unter „How to Play“ lässt es sich neu starten.

## Stufe 2 „Siedler-Gefühl“ (Cloud-Session 2026-09-26)

Neu: Jahreszeiten mit Winter (Schnee, zugefrorener und begehbarer Fluss, langsame Felder),
Leibeigenen-Befehle (Arbeiter per Rechtsklick auf Baum oder Felsen schicken), Taler mit
Steuern und Zahltag (Speicherstand-Schema 3), eine
Erkundungs-Schwärze über unerkundetem Land und Porträts im Dialogfenster. Details und die
Liste für Stufe 3 stehen in `docs/SIEDLER_ROADMAP.md`. Prüflauf 2026-09-26: Tests 82/82,
Screenshot-Presets 14/14, e2e 10/10 (der 1280er-Layout-Test nach Korrektur einzeln wiederholt).

- Cloud-Session: Playwright findet den vorinstallierten Browser über
  `CHROMIUM_PATH=/opt/pw-browsers/chromium` (ohne diese Variable bleibt alles wie bisher).
- Neue Screenshot-Presets: `winter-overview` und `winter-settlement` (Demo-Zustand `winter`).

## Stand und Qualität

- 72/72 Tests grün, 12/12 Screenshot-Presets grün (Durchlauf vom 2026-09-24).
- e2e: 9/10 im letzten vollständigen Durchlauf. Der eine Fehler war ein wackliger Test (Klick genau
  auf dem Rand des gültigen Bauplatzes). Der Test ist jetzt robust und einzeln grün, ein neuer
  vollständiger Durchlauf steht aus. Auch nach den Berg-Änderungen lief kein vollständiger e2e-Lauf.
- Budget: höchstens 1,5 M Dreiecke. Aktuell etwa 1,40 M, also keine großen Mengen zusätzlicher
  Bäume oder Instanzen.
- Unabhängige Kritiker-Bewertungen: Grafik 7.0, Gameplay 6.8. Das Ziel von 8.5 ist nicht erreicht.
  Siehe `docs/FINAL_REVIEW.md`, `docs/critiques/`, `docs/KNOWN_ISSUES.md`, `docs/STATUS.json`.

## Offene Ideen / nächste Schritte

- Vollständigen e2e-Lauf wiederholen, danach `docs/STATUS.json` und `docs/KNOWN_ISSUES.md`
  aktualisieren.
- Gameplay-Tiefe: Arbeitsprioritäten, längere und abwechslungsreichere Überfälle, mehr Rückmeldung
  im Kampf.
- Grafik: Nahansicht der Figuren, Gebäudevielfalt, die Nahansicht der Randberge (noch recht
  dunstig).
- Danach neue Bewertung durch unabhängige Kritiker.

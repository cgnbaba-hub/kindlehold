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
npm test             # 130 node:test-Tests (Unit, Integration, deterministische Simulation)
npm run build
npm run verify -- --prod --nofps    # 12 Screenshot-Presets + JSON-Berichte (langsam)
npm run test:e2e -- --only=<name>   # UI-Tests in Headless-Chromium, --only filtert
npm run test:audio   # Lautstärke-Grenze (Spitze < 0.5) und hörbare Musik
npm run test:soak -- --minutes=16 --nobuild   # Bot spielt mit HUD; misst GPU-Ressourcen, DOM, Heap je Minute (~25 min)
node scripts/verification/gl-leaks.mjs --autoplay --frames=30   # WebGL-Puffer/Texturen/Uploads pro Frame
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

## Stufe 2.5 (Cloud-Session 2026-09-26, zweiter Teil)

Ausbaustufen (Burg, Häuser, Betriebe), Truppen-Forschung, Tag-Nacht-Rhythmus der Siedler, Wild
und Jäger, Taverne, Entdeckungspunkte (Händler, Steinmann, Ruine, Millbrook), bessere Figuren,
sichtbare Eisenadern, klarere Uhr. Details: `docs/SIEDLER_ROADMAP.md`. Balance-Check mit dem
Bot: `npm run balance` (7/8 gewonnen). Tests: 91/91.

## Stufe 2.7

Tempo-Menü, Bewohner-Übersicht (Tooltip + Fenster), Berater Osric mit Stimmung und Hinweisen,
Drill Yard mit Armbrustschützen und Hellebardieren, Rationen, Festmahl. Tests: 99/99.

## Stufe 2.8 „Das große Tal“

Karte 384 × 384 m, zweite Partei (Greyfen-Banditen, `p3`, `src/brigands/`), Diplomatie
(`src/diplomacy/`, Fenster über den Banner-Knopf an der Uhr), Marktpreise nach Angebot und
Nachfrage, zweiter Händler. Wer gegen wen kämpft, entscheidet `hostile()` in
`src/diplomacy/index.js`. Neue Parteien also dort eintragen, nicht `owner !== PLAYER` prüfen.
Tests: 107/107. e2e 11/11 (neu: `diplomacy-gift`), Audio-Check ok, Dreiecke im Überblick
1,436 M (Budget 1,5 M; dafür etwas weniger Deko-Wald). `npm run balance`: 6/8 (Hard 1/3, siehe
Roadmap). Menüs setzen den Fokus jetzt sofort, sonst ging auf langsamen Rechnern das erste Esc
verloren.

## Kapitel 4 „The Salt Road“

Neue Karte Saltmere (`src/world/maps/saltmere.js`), Legion von Varr (`src/ai/factions.js`),
Salzwirtschaft, Kapitel-Daten in `src/missions/scenarios/saltroad.js`. Eine Karte schnell prüfen:
Draufsicht als PNG mit einem kleinen Skript über `createTerrainData(mapById(id))`. Mit Blick auf
die Wegstation muss erreichbar sein: Holz, Stein, Eisen und (hier) Salz innerhalb von 34 m
Territorium. Presets: `saltmere-town`, `saltmere-lake`, `saltmere-manor`, `saltmere-pans`
(Parameter `chapter`).

## Grafik-Stufe: Licht und Nachbearbeitung

`src/render/post.js` (HDR-Puffer mit MSAA, SAO aus dem Tiefenpuffer, Bloom, Abschlusspass mit
Tonemapping, Farbabstimmung, Vignette und Miniatur-Unschärfe), Qualitätsstufen in
`QUALITY.*.post` (`src/app/render-context.js`). Himmelslicht und Wolken: `src/environment/sky-light.js`,
`CLOUDS`/`ENV`/`SHROUD.linear` in `src/render/structure-material.js`. Erdung: AO-Textur in
`src/terrain/terrain-view.js`. Vergleichen: `?post=off`, `?gfx=noao,nobloom,noibl,noclouds,notilt`,
`?post=ao` zeigt nur die Umgebungsverdeckung.
Lehren: (1) Mit Nachbearbeitung mischen die Materialien den Nebel in linearem Licht, das wirkt
dunstiger (Dichte 0,0019 statt 0,0026), und das Abdunkeln von unerkundetem Land muss in
linearem Licht stärker sein (`pow(k, 2.2)`). (2) Der physikalische Himmel als Umgebungslicht
ist viel zu hell und zu blau, deshalb die Farbverlauf-Kuppel. (3) Wolkenschatten schlucken den
Schattenkontrast, wenn eine Wolke über der Siedlung liegt; also dezent halten. (4) SAO in halber
Auflösung muss an Texelmitten des Tiefenpuffers abtasten und Normalen aus Nachbarn bilden, sonst
entstehen Streifen. (5) Schnelle Sichtprüfung ohne die langsamen Verify-Läufe: einmal
`?verify=1&demo=midgame` laden und viele Kamera-Presets nacheinander fotografieren.

## Figuren und Animationen (Stufe 3, Figuren-Teil 1)

Posen stehen jetzt in `src/units/poses.js` (flache Gelenkwinkel, `computePose`, `lerpPose`),
der Zeichner in `src/units/figures.js` setzt sie nur noch zusammen. Wichtig:
- Gang: Der Schrittzyklus kommt aus der gelaufenen Strecke (`STRIDE` in `src/units/view.js`),
  damit rutschen die Füße nicht, auch nicht bei 2×/3× Tempo. Vorher schwangen Arm und Bein
  derselben Seite gemeinsam (Passgang) – behoben, Test in `tests/unit/poses.test.js`.
- Übergänge: Wechselt eine Figur die Animation, wird 0,22 s überblendet (`BLEND`).
- Angriffe je Waffe (`weaponClass`: slash, heavy, thrust, bow, crossbow, sling) aus drei
  Schlüsselposen (Deckung, Ausholen, Treffer). Der Treffer liegt auf dem Tick, in dem der
  Schaden fällt; das Ausholen läuft, während die Abklingzeit (`u.cd`) endet.
- Gegenstände: `itemT/itemW` in der Pose steuern die Neigung in der Welt (waagrechter Speer,
  Schwert in Deckung). Speer, Hellebarde, Armbrust und Angel waren zuvor verkehrt herum
  modelliert (Spitze nach unten); sie werden jetzt mit `flip()` umgedreht gebaut. Der Bogen ist
  neu (Griff in der Mitte der Wurfarme) und bleibt in der Welt senkrecht.
- Sterben: erst knicken die Knie ein, dann kippt der Körper nach hinten; Waffen fallen mit.
- Modelle: geformter Oberkörper (Lathe), Hände als eigenes Teil (Hautfarbe), Ärmel (Stoff,
  Kettenhemd oder hochgekrempelt), runde Schuhe, drei lange Frisuren, sieben Hauttöne,
  Körperbau und Größe variieren. Hände und Sterne haben keinen Umriss (spart Dreiecke).
- Kosten gemessen: ca. +1,7 % Dreiecke und +11 Draw Calls in Siedlungsansichten.
- Tragen je Ware: Stamm auf der rechten Schulter, Sack über der linken, Stein und Eisen in den
  Armen (`carryArms`, `CARRY_AT`). Wartende Nachbarn (≤ 3,6 m) wenden sich zu und plaudern
  (`talk`, nur in der Ansicht), allein Wartende strecken sich ab und zu (`idleGesture`).
  Die Angelschnur hängt beim Angeln senkrecht von der Rutenspitze.
- Eigene Soldaten quittieren Befehle (`EV.UNIT_ORDER` → `ackOverlay`): Angriff = Waffe hoch,
  sonst Nicken und kurzer Gruß.
- Köche rühren mit der Kelle in einem Kessel über kleinem Feuer (Teil `pot`, nur bei `stir`).
  Wrens Pfeilhagel: Bogen schräg zum Himmel (`bowT` in der Pose).
Figuren-Studio: `?showcase=figures&group=settlers|carriers|army|enemies|leaders&anim=mix|idle|talk|walk|run|attack|work|die`,
`window.__STUDIO__.time(t)` hält die Uhr an (Einzelbilder für Bildfolgen).

## Grafik-Notbremse, Freies Spiel, Minenarbeiter (nach dem Grafik-Update)

Der Nutzer meldete nach ~7 Minuten einen Hänger mit dem Hinweis „Grafikkarte ausgelastet“.
Danach flackerte die Seite, Ressourcenwerte sprangen, der Berater-Avatar zuckte, und Bau-Symbole
sahen beim Überfahren anders aus. Das passt zu einer überlasteten GPU: Chrome zeichnet dann die
HTML-Teile nicht mehr zuverlässig neu. Der alte Regler senkte nur die Auflösung und pendelte
(runter, nach 20 s wieder hoch, wieder runter). Neu in `src/app/render-context.js` (`govern`):
- Erst Effekte abschalten (Umgebungsverdeckung → Leuchten + Miniatur-Unschärfe →
  Kantenglättung), erst danach Auflösung senken. `post.setEffects()` legt dafür keine Puffer
  neu an (nur das Abschalten der Kantenglättung einmal).
- Abgeschaltete Effekte bleiben für die Sitzung aus; die Auflösung steigt nie wieder auf eine
  Stufe, die zu langsam war (`ceiling`). Damit kein Pendeln mehr.
- Frames, die durch Simulation/HUD langsam sind (Skriptzeit außerhalb `draw()`), zählen nicht:
  Effekte abschalten hilft dort nicht.
- High rendert mit höchstens 1,25-facher Pixeldichte (vorher 1,5); ab 1,1 ohne MSAA.
- Beim ersten Besuch wählt `suggestedQuality()` (`src/app/settings.js`) die Stufe nach dem
  Grafikchip: Software → Low, integriert (Intel, Apple, AMD „Radeon Graphics“, Mobil) → Medium.
- Einstellungen → Grafik zeigt im Spiel Grafikchip, Auflösung und was abgeschaltet wurde.
Freies Spiel: `src/missions/scenarios/freeplay.js`, ein Szenario pro Karte gegen die dortige
Fraktion (`free-harrowmere` usw.), Ziel: den Sitz des Gegners zerstören; Menüpunkt „Free Play“.
Minenarbeiter: neue Animation `mine` (Hackenschläge im Amboss-Takt 1,1 s, fester Stand), Köche
rühren (`stir`). Prüfen: `anim.mjs`-artiges Skript, das 8 Bilder eines arbeitenden Siedlers
nebeneinanderlegt.

## Kapitel 6 „The Iron March“, Wren, Osric

Karte `src/world/maps/ironmarch.js`, Haus Morrow (`morrow` in `src/ai/factions.js`),
Kapitel-Daten `src/missions/scenarios/irondebt.js`. Mehrere Helden: Fähigkeiten und Passiv stehen
an der Einheit (`abilities`, `passive` in `src/units/defs.js`), `heroAbilities()` in
`src/heroes/index.js`; F/G (`abilityFlare`/`abilityKindle`) sind Platz 1/2 des gewählten Helden.
Weitere Helden im Szenario über `setup.heroes`. Ereignis-Aktion `commanderAtHall` lässt einen
späten Anführer am Tor erscheinen (`enemy.commanderLate`). Osrics Avatar: `OSRIC_AVATAR` in
`src/ui/portraits.js`, Logik in `src/ui/hud.js` (Rat mit Stufe `danger`/`warn`/`task`/`calm`),
Animationen in `styles.css` (`.advisor-*`, `av*`-Keyframes). Presets: `ironmarch-fort`,
`-vale`, `-hold`, `-delvholm`, `-figures` (Demo `ironline`). Nächster großer Wunsch des
Spielers: Grafik auf die nächste Stufe (Roadmap Punkt 0), gemeinsam angehen.
Stand: Tests 130/130, e2e 16/16, Presets `ironmarch-*` grün (1,32–1,36 M Dreiecke),
`npm run balance` Kapitel 6 8/8.
Lehre aus dem e2e `graphics-reset-recovers`: keine Endlos-CSS-Animationen im HUD (Osrics
Atmen hat nach einem Grafik-Reset den Haupt-Thread unter Software-GL ~15 s blockiert; gemessen
über verzögerte Toast-Timer). Einmalige Animationen und seltene Klassenwechsel sind in Ordnung.
Getippten Text nicht in einem `aria-live`-Bereich aktualisieren (Screenreader bekommen den Satz
einmal über ein `.sr-only`-Element).

## Kapitel 5 „The White Stag“

Karte Whitehart (`src/world/maps/whitehart.js`), Orden vom Weißen Hirsch (`stag` in
`src/ai/factions.js`), Kapitel-Daten in `src/missions/scenarios/whitestag.js`. Neu: Pioniere
(`vsBuildings` an der Einheit, Schadensart `siege`), Mauern (`walls` am Gebäude), besetzte Dörfer
(`occupiedBy` in `src/pois/index.js`), Außenposten (`enemy.outposts`), Bedingung `units`.
Flüsse auf neuen Karten: Ufer nicht zu steil machen (`bankWidth` reichlich), sonst sind die
Furten Sackgassen. Prüfen mit einem Walkability-Raster über `createNavGrid`. Presets:
`whitehart-camp`, `whitehart-vale`, `whitehart-chapterhouse`, `whitehart-outpost`,
`whitehart-figures` (Demo `stagline`). Stand: Tests 125/125, e2e 15/15, die fünf neuen Presets
grün (Dreiecke 1,44–1,49 M), `npm run balance` Kapitel 5 8/8.

## Stufe 3 (erster Teil): Kampagne

Drei Kapitel (`src/missions/scenarios/harrowmere.js`, `campaign.js`), Kampagnen-Menü,
Freischaltung, „Next chapter“, Kapitel-Intros (`src/ui/cinematic.js`), Kampagnen-Gedächtnis.
Balance je Kapitel: `npm run balance -- greyfen:normal:7 tollbreaker:hard:7`. Für Tests startet
`?start=1&chapter=greyfen` direkt ein Kapitel ohne Intro. Neue Kapitel: Datei in
`src/missions/scenarios/`, in `SCENARIOS`/`CAMPAIGN` eintragen und im Save-Schema
(`meta.scenarioId`) ergänzen.

## Stufe 2.9

Figuren-Politur (erster Schritt zu Stufe 3), Veteranen, Regen, Fischerhütte, Arbeiter nach
Knappheit, Bot handelt. Neue Presets: `figures-soldiers`, `figures-settlers`,
`rain-settlement`, `greyfen-hold`. Tests: 111/111, `npm run balance` 7/8.

## Hänger nach ~13 Minuten (Bericht nach 2.8)

Der Nutzer meldete einen ~10-s-Hänger beim ersten Kampf. Danach flackerten HTML-Knöpfe, das
Tempo-Menü war nur beim Überfahren sichtbar, und das Esc-Menü fehlte. Das passt zum
GPU-Watchdog von Chrome (GPU-Prozess wird nach ~10 s neu gestartet). Gemessen: kein Leck bei
GPU-Puffern, Texturen, Shadern, DOM oder Heap (`test:soak`, `gl-leaks.mjs`). Die Simulation
braucht 0,1 ms pro Tick, der Speicherstand hat 195 KB. Gegenmaßnahmen:
- Instanz-Puffer laden nur noch den genutzten Bereich hoch (`src/render/instancing.js`),
  etwa 10× weniger Upload pro Frame.
- Auflösungs-Regler in `src/app/render-context.js` (`govern`): Bei dauerhaft langsamen Frames
  sinkt die Auflösung stufenweise (inzwischen erst nach dem Abschalten von Effekten, siehe
  „Grafik-Notbremse“).
- WebGL-Kontextverlust: Das Spiel speichert automatisch, pausiert, zeigt einen Hinweis und
  läuft danach mit geringerer Auflösung weiter.
- Befehls- und Auswahlfenster ersetzen nur noch geänderte Knöpfe (`patchChildren` in hud.js),
  das beseitigt das Flackern und den verlorenen Hover.
Nicht reproduzierbar ohne echte GPU. Falls es wieder auftritt: Browser, GPU,
Qualitätsstufe und Spieltempo erfragen.

## Stufe 2.6

Kurze Nächte (6×, „Skip night“, Tempo bis 8×), nachwachsende Wälder, größere Felsen,
Plünderzüge der Rustfang, schönere Menüs, abwechslungsreiche Kampfgeräusche. Details:
`docs/SIEDLER_ROADMAP.md`. Tests: 95/95.

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

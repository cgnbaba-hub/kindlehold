# Kindlehold und „Die Siedler – Das Erbe der Könige“: Stufen-Roadmap

Das Ziel des Nutzers: so nah wie möglich an das Spielgefühl von *Die Siedler – Das Erbe der
Könige* (2004) heranzukommen, ohne das Spiel zu kopieren. Namen, Story, Grafik, Musik und
Zahlen bleiben eigene Arbeit (siehe `ASSET_REGISTER.md`). Übernommen werden nur
Genre-Ideen. Diese Datei ordnet den Stand in drei Stufen ein.

| Stufe | Bedeutung |
|---|---|
| 1 | Spielbarer Prototyp: Wirtschaft, Bauen, Kampf, ein Held, eine Mission (Stand 2026-09-24) |
| 2 | Erkennbares „Siedler-Gefühl“: Jahreszeiten, Erkundung, direkte Befehle, Porträts, Taler |
| 2.5 | Lebendiges Tal: Ausbaustufen, Tagesablauf, Nahrungskette, Wild, Entdeckungen, bessere Figuren |
| 3 | Nah am Vorbild: volle Wirtschaft mit Geld, Gebäudestufen, mehrere Helden und Karten, Kampagne |

## Stufe 2: umgesetzt (Session vom 2026-09-26)

| Merkmal im Vorbild | Umsetzung in Kindlehold | Code |
|---|---|---|
| Wetter und Winter: Schnee, zugefrorene Gewässer als neue Wege | Fester Zyklus aus 8 min Sommer und 3 min Winter, der erste Winter beginnt bei Minute 17. Schnee auf Boden, Dächern, Bäumen und Felsen, Schneefall, kühleres Licht. Der Fluss friert zu und ist dann überall begehbar, auch für die Rustfang. Vor dem Tauwetter kommt eine Warnung, wer dann noch auf dem Eis steht, wird nass und verletzt. Felder wachsen im Winter nur mit 50 %. | `src/weather/`, `src/environment/winter.js`, Shader in `terrain-view.js`, `water.js`, `structure-material.js` |
| Leibeigene, die man direkt zum Holzfällen oder Steinhauen schickt | Arbeiter anwählen, dann Rechtsklick auf Baum oder Felsen: Sie sammeln von Hand und tragen die Ware zur Burg. „Back to work“ schickt sie zurück an die normale Arbeit. | `src/economy/index.js` (`gather`/`release`), `src/input/index.js`, HUD |
| Unerkundete Karte liegt im Dunkeln | Das erkundete Gebiet wird als Bitmaske gespeichert. Unerkundetes Land ist dunkel, die Minimap zeigt nur Erkundetes. | `src/exploration/`, `src/environment/shroud.js`, `src/ui/minimap.js` |
| Missionsdialoge mit Porträts | Eigene SVG-Porträts für Maren, Osric, Wren und Vharek im Dialogfenster. Neue Sprechzeilen zu Winter und Eis. | `src/ui/portraits.js`, `src/ui/hud.js` |
| Taler, Steuern, Zahltag, Leibeigene kaufen | Alle 2 min ist Zahltag: Siedler zahlen Steuern, Soldaten bekommen Sold. Der Steuersatz an der Burg (niedrig, fair, hoch) wirkt auf die Stabilität. Für 40 Taler lässt sich an der Burg sofort ein Arbeiter anwerben. | `src/population/index.js`, HUD, Speicherstand-Schema 3 |
| Jahreszeit sichtbar | Die Uhr zeigt Sommer, Winter und einen Countdown. Die Minimap wird im Winter weiß. | `src/ui/hud.js`, `src/ui/minimap.js` |

Belegbilder: `docs/screenshots/evidence/level2-*.png`.

## Stufe 2.5: umgesetzt (Session vom 2026-09-26, zweiter Teil)

Grundlage war die Wunschliste des Nutzers nach dem ersten Anspielen.

| Wunsch | Umsetzung | Code |
|---|---|---|
| Bauplatz wird schnell zu klein | Die Burg wird in zwei Stufen ausgebaut: Castle (+14 m Gebiet, +4 Wohnraum, +25 % Steuern) und Fortress (+12 m, braucht die March Charter). Beide sind sichtbar mit Ringmauer, Türmen und Torhaus. | `UPGRADES` in `src/buildings/defs.js`, `src/construction/index.js`, `src/buildings/meshes.js` |
| Eisen schlecht zu finden | Rostrote Erzader mit Erzbrocken, ein Ring auf dem Boden, ein deutlicher Punkt auf der Minimap. Beim Platzieren von Mine oder Steinbruch pulsieren alle passenden Vorkommen. | `src/environment/vegetation.js`, `src/selection/view.js`, `src/ui/minimap.js` |
| Schönere Avatare | Variante A: Knie und Ellbogen, Gesichter (Augen, Brauen, Nase, Mund, Ohren), Haarfarben, Bärte, Röcke, Hüftschwung und Kopfnicken. Variante B (Skelett-Animation mit echten Modellen) bleibt für Stufe 3. | `src/units/figures.js` |
| Ausbaustufen für Gebäude und Truppen | Cottage → Stone House → Townhouse (+3/+3 Wohnraum), Betriebe auf Stufe 2 (+1 Arbeiter, +20 % Tempo). Neue Forschungen für Truppen: Steel Mail (+20 % Leben, +2 Rüstung) und Veteran Drill (+15 % Angriffstempo, +10 % Marsch, braucht das Castle). | wie oben, `src/technology/defs.js`, `src/combat/index.js`, `src/units/sim.js` |
| Arbeiter schlafen nachts | Siedler gehen ab 22 Uhr gestaffelt in das nächste Haus und kommen ab 5 Uhr wieder heraus. Schlafende sind sicher und essen nicht. Die Nacht vergeht doppelt so schnell, ausgeruhte Siedler arbeiten tagsüber 18 % schneller. Die Kaserne weckt Freiwillige für die Ausbildung. | `src/population/daily.js`, `src/app/simulation.js` |
| Etwas zu entdecken | Händler am Wegkreuz (Handel mit Taler), Aussichts-Steinmann (deckt 70 m auf), alte Wachruine jenseits des Flusses (Schatz), Weiler Millbrook (Verbündeter, wenn Maren ihn besucht: Familien und ein Tribut an jedem Zahltag). Beim Entdecken gibt es Dialoge mit Porträts. | `src/pois/`, `src/environment/pois-view.js` |
| Tiere, Jagd, Verarbeitung | Hirschrudel mit Weiden, Flucht und Nachwuchs. Die Jägerhütte liefert Fleisch, auch im Winter. Die Taverne verarbeitet 2 Proviant zu 3 warmen Mahlzeiten, die zuerst ausgegeben werden und die Stimmung heben. | `src/wildlife/`, `src/environment/wildlife-view.js`, `src/production/index.js` |
| Uhrzeit passt nicht zur Helligkeit | Die Uhr zeigte zuerst die gespielte Zeit. Jetzt steht dort „Day 2 · 10:30“, die Spielzeit steht im Tooltip. | `src/ui/hud.js` |
| Grenze im Winter unsichtbar | Die Gebietsgrenze wird bei Schnee dunkler und kräftiger. | `src/selection/view.js` |

Prüfung: 91 Tests, e2e 10/10, alle 14 Screenshot-Presets bestanden. Zwei Presets lagen zunächst
knapp über dem Budget von 1,5 M Dreiecken, nach dem Verschlanken der Figuren liegt das Maximum bei
1,43 M. Belegbilder: `docs/screenshots/evidence/level25-*.png` (Festung und Ausbaustufen,
schlafendes Dorf bei Nacht, Figuren mit Hirschrudel).

![Ausbaustufen](screenshots/evidence/level25-upgrades.png)

Nebenbei gefunden und behoben: Ein Siedler auf dem Weg zur Kaserne konnte gleichzeitig einen
Arbeitsplatz bekommen und blieb dann für immer stehen. Die Kaserne bildete in solchen Fällen
keine Soldaten mehr aus.

Ebenfalls behoben: Die neue Taverne nahm der Eisenmine die Proviant-Lieferungen weg, eine leere
Mine wird jetzt zuerst beliefert. Der erste Winter kommt erst bei Minute 17 (nach dem ersten
Überfall), damit Winter, erste Nacht und Überfall nicht zusammenfallen.

**Balance (Test-Bot, `npm run balance`, 40-Minuten-Grenze):** 7 von 8 Partien gewonnen. Story
25,7 min, Normal 4 von 4 (22,8–37,8 min), Hard 2 von 3 (34,9 und 35,6 min, einmal nicht fertig).
Vor den Änderungen der Stufen 2 und 2.5 gewann der Bot Hard auf allen Seeds, Hard ist also
schwerer geworden. Menschliche Spieler haben mit Ausbaustufen, Handel und Leibeigenen mehr
Werkzeuge als der Bot, getestet ist das aber nicht.

## Stufe 2.6: umgesetzt (Session vom 2026-09-26, dritter Teil)

| Wunsch | Umsetzung |
|---|---|
| Nacht viel zu lang | Die dunklen Stunden (20–6 Uhr) vergehen 6-mal so schnell, die sichtbare Nacht dauert etwa 1,5 Minuten. Mit „Skip night“ unter der Uhr springt man mit 8× bis zum Morgen. Ein Tageszähler zeigt „Day N“. |
| Schnellere Geschwindigkeiten | 0,5×, 1×, 2×, 4×, 8× (Knopf an der Uhr oder `[` / `]`). |
| Gegner zu passiv | Plünderzüge: Vor dem großen Überfall greifen kleine Trupps abgelegene Betriebe an und ziehen wieder ab, angekündigt durch ein Kriegshorn. Große Überfälle bevorzugen schlecht bewachte Gebäude. |
| Zu wenig Rohstoffe | Gefällte Bäume werden nachgepflanzt und wachsen in 2,5 Minuten nach (sichtbare Setzlinge). Felsen haben 150 statt 60 Stein, die Eisenader ist unerschöpflich. Träger holen zuerst, was im Lager knapp ist. |
| Menüs ausführlicher | Hauptmenü mit großen Buttons, Symbolen und Beschreibungen. Schwierigkeitskarten mit Symbol und Eckdaten. Bau- und Befehlsknöpfe zeigen Name und Kosten. |
| Mehr Sound-Vielfalt | Kampfgeräusche mit 3–4 Varianten und zufälliger Tonhöhe (Stahl auf Stahl, Klinge auf Schild, Schrammen, schwerer Hieb). Der Bogen bekommt ein Sehnen-Schwirren, Schleudern mehrere Würfe. Ein Horn kündigt Plünderer an. |

Balance (`npm run balance`): 7 von 8 Partien gewonnen (Story 29,8 min, Normal 4/4 mit 31–36 min,
Hard 2/3). Der Test-Bot achtet jetzt darauf, genug Träger übrig zu lassen. Ohne Träger
stand vorher die ganze Wirtschaft still.

## Stufe 2.7: umgesetzt

| Wunsch / Idee | Umsetzung |
|---|---|
| Ausklappbares Tempo-Menü | Klick auf die Tempoanzeige an der Uhr öffnet die Auswahl 0,5× bis 8×. |
| Was machen die Bewohner? | Beim Überfahren der Einwohnerzahl steht, wie viele bauen, tragen, sammeln, schlafen, welche Berufe sie haben und wie viele Soldaten es gibt. Ein Klick öffnet das Fenster „Your people“ mit Balken je Gruppe. |
| Berater wie in Stronghold | Osric, der Vogt, sitzt unten links. Ein farbiger Ring zeigt die Stimmung des Volkes (Content, Calm, Uneasy, Angry). Er gibt Hinweise wie Holzmangel, Hunger, volle Häuser, keine freien Hände, Unzufriedenheit, nahenden Winter und anrückende Plünderer. Ein Klick zeigt den nächsten Rat. |
| Mehr Truppen (eigene Idee) | Kasernen-Ausbau „Drill Yard“ (+25 % Ausbildungstempo). Er schaltet **Armbrustschützen** frei (Fernkampf, Bolzen durchschlagen die Hälfte der Rüstung) und **Hellebardiere** (schwere Elite, 250 Leben, 7 Rüstung, große Reichweite). |
| Rationen (eigene Idee, nach Stronghold) | An der Burg wählbar: halbe, normale oder großzügige Portionen. Das kostet mehr oder weniger Vorräte und wirkt auf die Stimmung (−10 / 0 / +8). |
| Festmahl (eigene Idee) | An der Burg: 80 Taler und 30 Proviant für ein Fest mit +15 Stimmung für drei Minuten, mit Funken und Musik. |

Prüfung: 99 Tests, `npm run balance` 7/8.

## Stufe 2.8: umgesetzt („Das große Tal“)

| Wunsch | Umsetzung |
|---|---|
| Deutlich größere Karte | Das Tal misst jetzt 384 × 384 m statt 256 × 256 m (2,25-fache Fläche). Neu: Westmarch-Hügel mit zweiter Eisenader, die Greyfen-Sümpfe im Nordwesten, die Saltbridge-Hügel mit Furt im Osten, das Barrowmoor im Südwesten. Dazu Wege, Wälder, Felsen, zwei Aussichts-Steinmale, die „Tollkeeper's Vault“ (200 Taler, 40 Eisen) und mehr Wild. |
| Mehrere Gegner | Zweite Partei: die **Greyfen-Banditen** unter **Morwen Greyfen** mit Langhaus, zwei Türmen, Räubern, Wilderern (Fernkampf) und eigenem Nachschub. Sie liegen mit den Rustfang in Fehde und kämpfen auch gegen sie. |
| Diplomatie | Jede Partei hat eine Beziehung von −100 bis +100 → Krieg, neutral oder verbündet. Fenster über den Banner-Knopf an der Uhr: **Geschenk** an die Greyfen (50 Taler, +18), **Frieden** gegen Blutgeld (80 Taler), **Kriegserklärung**, bei den Rustfang **Wegzoll** (120 Taler, 5 Minuten Waffenstillstand ohne Überfälle und Plünderer). Wer eine neutrale Partei angreift oder in der Nähe ihres Lagers baut, verschlechtert die Beziehung. Verbündete Greyfen schicken bei Rustfang-Überfällen Hilfe und liefern jeden Zahltag Wild und Holz. Im Krieg ziehen sie alle paar Minuten auf Raubzug. |
| Handel | Zweiter Händler auf dem **Saltbridge Market** (20 % günstiger). Die Preise folgen Angebot und Nachfrage: Wer viel kauft, treibt den Preis hoch, wer viel verkauft, drückt ihn. Mit der Zeit pendeln sich die Preise wieder ein. Neu: Stein und Eisen verkaufen. |

Prüfung: 107 Tests (neu: Diplomatie, Banditen, Markt, Speichern/Laden). `npm run balance`:
6 von 8 gewonnen (Story und alle 4 Normal-Partien, Hard 1/3). Auf der größeren Karte verliert
der Test-Bot auf Hard zweimal gegen die Rustfang-Wellen. In einer Partie ging ihm das Holz aus,
während 280 Stein im Lager lagen. Die Banditen blieben dabei neutral. Das ist eine Schwäche des
Bots (er handelt nicht und baut Holzfäller nicht nach), keine Folge der neuen Partei.


## Stufe 2.9: umgesetzt (erster Schritt zu den Figuren)

| Punkt | Umsetzung |
|---|---|
| Figuren-Politur | Stahlhelme sitzen jetzt richtig (vorher verdeckte der Kopf den Helm), Kapuzen schließen, Schulterstücke aus Metall, Wappenröcke, wehende Umhänge für Maren, Vharek und Morwen. Speere werden beim Marschieren aufrecht getragen, Schilde nach außen gehalten. Waren tragen die Siedler auf dem Kopf. Dazu Zucken bei Treffern, Umschauen und Gewichtsverlagerung in Ruhe, Strohhüte für Bauern, Schürzen für Köche. Gefallene behalten ihre Größe. |
| Veteranen | Soldaten sammeln Siege: nach 3 werden sie Veteran (+10 % Schaden und Leben), nach 8 Elite (+20 %). Goldene Sterne über dem Kopf, Anzeige im Auswahlfenster. Gilt auch für Gegner. |
| Regen | Etwa alle fünf Minuten ein Sommerschauer von 75 s: Regenstreifen, grauer Himmel, Regengeräusch, keine Vögel. Felder wachsen bei Regen 35 % schneller. Der Boden bleibt eine Weile nass. |
| Fischerhütte | Muss höchstens 30 m vom Harrow entfernt stehen. Der Fischer geht ans Ufer und wirft die Angel aus (3 Proviant pro Fang). Auf dem Eis im Winter geht es halb so schnell. |
| Arbeiterverteilung | Zuerst bekommt jeder Betrieb einen Arbeiter, und zwar vorrangig dort, wo die erzeugte Ware am knappsten ist. Vorher kam ein nachgebauter Steinbruch zuletzt dran, und die Siedlung saß ohne Stein fest. |
| Test-Bot | Handelt am Markt (verkauft Stein, kauft Holz, Eisen und Proviant) und baut einen Fischer. `npm run balance`: 7/8 gewonnen (Story, Normal 4/4, Hard 2/3). |
| Fehlerbehebung Hänger | Siehe HANDOFF: GPU-Entlastung, automatische Auflösungsanpassung, Erholung nach einem Treiber-Reset, flackerfreie Knöpfe. |

## Stufe 3 (erster Teil): die Kampagne

Die Stufen sind Etappen, kein Endpunkt. Ziel ist ein Spiel, das über mehrere Stunden mit Story trägt.

| Punkt | Umsetzung |
|---|---|
| Kampagne | Hauptmenü → „Campaign“: drei Kapitel, jedes wird durch den Sieg im vorigen freigeschaltet. Nach dem Sieg gibt es den Knopf „Next chapter“. In den Einstellungen lassen sich alle Kapitel freischalten. |
| Kapitel 2: The Greyfen Question | Ein Jahr später: Kindlehold ist eine Stadt mit Burg und Betrieben. Maren muss Millbrook besuchen. Danach die Entscheidung: Morwen mit Geschenken gewinnen oder die Greyfen-Festung zerstören. Zwei Überfälle überstehen, dann die wieder aufgebaute Furtfestung brechen. Kleine Story-Momente (Rauch über Millbrook, Morwens Forderung, Hilds Fischlieferung). |
| Kapitel 3: The Tollbreaker's Winter | Vharek eint die Bergclans. Vorräte und Wachtürme vor dem Schnee, dann drei Wellen eines großen Heeres. Solange das Heer ungebrochen ist, sind die Tore der Festung verrammelt. Danach zieht Vharek mit Leibgarde selbst über die Ostroad gegen Kindlehold. Sieg, wenn er fällt und seine Halle brennt. |
| Kampagnen-Gedächtnis | Kapitel 3 weiß, wie Kapitel 2 ausging: Die Greyfen sind Verbündete oder ihre Festung ist verschwunden. |
| Kapitel-Intros | Kamerafahrt mit Letterbox über das Tal, Porträt und Sprecherzeile, der Nebel ist ausgeblendet. Klick oder Taste überspringt, abschaltbar unter Gameplay → „Chapter intros“. |
| Story-Werkzeuge | Szenarien bekommen einen Startzustand (Stadt, Techs, Soldaten), Gegnerstärke, eine feste Besatzung, einmalige Story-Ereignisse (Dialog, Hinweise, Geschenke, anrückende Heere) und eigene Siegbedingungen. Alles steht als Daten in `src/missions/scenarios/`. |

Bot-Messung (`npm run balance -- greyfen:normal:7 tollbreaker:normal:7 …`): Kapitel 2 dauert 17–23 min,
Kapitel 3 22–26 min, alle gemessenen Partien gewonnen. Kapitel 1: 7/8 (Hard 2/3). In Kapitel 2 und 3 bleiben die Festungstore verrammelt, bis die Überfälle bzw. das Heer gebrochen sind (sonst wäre ein früher Sturm eine Abkürzung durch die Story). Menschliche Spieler brauchen erfahrungsgemäß
länger. Zusammen mit Kapitel 1 ergibt das etwa 2–3 Stunden Kampagne.

## Stufe 3 (zweiter Teil): Kapitel 4 „The Salt Road“

| Punkt | Umsetzung |
|---|---|
| Neue Karte „Saltmere“ | Eine Küstenniederung hinter dem östlichen Pass: großer Salzsee mit Möweninsel, Solebecken bei der Wegstation Lanternford, der Bach „Salt Run“ mit zwei Furten, die Salzstraße von West nach Ost, die Burg der Markgräfin auf der östlichen Anhöhe, dazu das Salzsiederdorf Pannholt, das Gasthaus an der Salzstraße, der Keller des Salzkönigs und zwei Steinmale. |
| Neuer Gegner | Die **Legion von Varr** unter der Markgräfin **Ysolde**: Pikeniere (defensiv), Armbrustschützen (Bolzen durchschlagen Rüstung), Ritter (schwer gepanzert). Dazu Steinburg und Steintürme, rote Wappenröcke und ein eigenes Porträt. Legionäre sind stärker als Rustfang-Räuber, deshalb kommen weniger pro Angriff. |
| Salz | **Salzpfannen** am Ufer versiegen nie. Die **Salzsiederei** (höchstens 12 m von einer Pfanne) recht Salz, das gegen Taler verkauft wird. Die Taler tragen die Träger zur Burg. Der Knopf erscheint nur auf Karten mit Salzpfannen. |
| Story | Maren baut über dem Pass eine Wegstation. Das Salzsiederdorf Pannholt schließt sich an. Die Markgräfin fordert ein Drittel jedes Sacks: Tribut zahlen (fünf ruhige Minuten) oder den ersten Angriff zurückschlagen. Nach zwei gebrochenen Angriffen öffnet die Burg ihre Tore. Das Ende deutet auf einen Auftraggeber im Tiefland (Siegel mit weißem Hirsch). |
| Technik | Karten-Register (Szenario → Karte, auch beim Laden), Seen und Inseln im Gelände, Fischer an jedem Gewässer, Kamera, Audio und Test-Bot kartenunabhängig, Gegner-Fraktionen (`src/ai/factions.js`), Veteranen aus früheren Kapiteln. |

Bot-Messung Kapitel 4: Story 1/1, Normal 3/3 (24–35 min Bot-Zeit), Hard 1/3 innerhalb von 40 min. Kapitel 1 auf Hard seit der Fischer-Umstellung 1/3 (vorher 2/3), gleiches Spiel, anderer chaotischer Bot-Verlauf. Die Kampagne hat damit vier Kapitel,
etwa 3–4 Stunden für menschliche Spieler (geschätzt, nicht gemessen).

## Stufe 3: was noch fehlt (ehrliche Liste, grob nach Wirkung sortiert)

1. **Echte animierte Figuren (Variante B):** Modelle mit Skelett, z. B. aus CC0-Paketen,
   mit Lauf-, Arbeits- und Kampfanimationen. Wegen der vielen Figuren sind dafür
   Leistungstricks nötig (Animation in Texturen vorberechnen, Detailstufen).
2. **Mehr Helden und eine Kampagne:** mehrere Karten, Zwischensequenzen mit Kamerafahrt,
   Sprachausgabe.
3. **Truppen als Trupps mit Hauptmann,** die man mit Taler nachkauft, dazu Belagerungswaffen.
4. **Längere Warenketten:** Mühle → Bäckerei, Schmiede für Werkzeuge, Fischer, Handelsrouten
   zwischen Siedlungen.
5. **Weiteres Wetter** (Regen mit Einfluss auf Felder und Wege) und echtes Sichtfeld im Nebel.
6. **Balance mit echten Spielern,** besonders auf Hard, und eine komponierte Musik.

## Hinweise zur Weiterarbeit

- Winter (`SEASON` in `src/weather/index.js`) und Nacht (`NIGHT` in `src/population/daily.js`)
  laufen fest nach Spielzeit ab, damit Speichern, Laden und Tests deterministisch bleiben.
- Schnee und Nebel laufen über gemeinsame Shader-Uniforms (`SNOW`, `SHROUD`) in
  `src/render/structure-material.js`. Neue Materialien sollten `patchStructureShader` benutzen
  (Overlays `shroudOverlay`), dann erhalten sie beides automatisch.
- Balance-Check: `npm run balance` lässt den Test-Bot 8 Partien über alle Schwierigkeiten spielen
  (etwa 1 Minute). Einzelne Läufe: `npm run balance -- hard:7 normal:42`.

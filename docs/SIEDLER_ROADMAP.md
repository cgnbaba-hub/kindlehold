# Kindlehold und „Die Siedler – Das Erbe der Könige“: Stufen-Roadmap

Das Ziel des Nutzers: so nah wie möglich an das Spielgefühl von *Die Siedler – Das Erbe der
Könige* (2004) heranzukommen, ohne das Spiel zu kopieren. Namen, Story, Grafik, Musik und
Zahlen bleiben eigene Arbeit (siehe `ASSET_REGISTER.md`). Übernommen werden nur
Genre-Ideen. Diese Datei ordnet den Stand in drei Stufen ein.

| Stufe | Bedeutung |
|---|---|
| 1 | Spielbarer Prototyp: Wirtschaft, Bauen, Kampf, ein Held, eine Mission (Stand 2026-09-24) |
| 2 | Erkennbares „Siedler-Gefühl“: Jahreszeiten, Erkundung, direkte Befehle, Figuren mit Gesicht |
| 3 | Nah am Vorbild: volle Wirtschaft mit Geld, Gebäudestufen, mehrere Helden und Karten, Kampagne |

## Stufe 2: umgesetzt (Session vom 2026-09-26)

| Merkmal im Vorbild | Umsetzung in Kindlehold | Code |
|---|---|---|
| Wetter und Winter: Schnee, zugefrorene Gewässer als neue Wege | Fester Zyklus aus 8 min Sommer und 3 min Winter. Schnee auf Boden, Dächern, Bäumen und Felsen, Schneefall, kühleres Licht. Der Fluss friert zu und ist dann überall begehbar, auch für die Rustfang. Vor dem Tauwetter kommt eine Warnung, wer dann noch auf dem Eis steht, wird nass und verletzt. Felder wachsen im Winter nur mit 30 %. | `src/weather/`, `src/environment/winter.js`, Shader in `terrain-view.js`, `water.js`, `structure-material.js` |
| Leibeigene, die man direkt zum Holzfällen oder Steinhauen schickt | Arbeiter anwählen, dann Rechtsklick auf Baum oder Felsen: Sie sammeln von Hand und tragen die Ware zur Burg. „Back to work“ schickt sie zurück an die normale Arbeit. | `src/economy/index.js` (`gather`/`release`), `src/input/index.js`, HUD |
| Unerkundete Karte liegt im Dunkeln | Das erkundete Gebiet wird als Bitmaske gespeichert. Unerkundetes Land ist dunkel, die Minimap zeigt nur Erkundetes. | `src/exploration/`, `src/environment/shroud.js`, `src/ui/minimap.js` |
| Missionsdialoge mit Porträts | Eigene SVG-Porträts für Maren, Osric, Wren und Vharek im Dialogfenster. Neue Sprechzeilen zu Winter und Eis. | `src/ui/portraits.js`, `src/ui/hud.js` |
| Taler, Steuern, Zahltag, Leibeigene kaufen | Alle 2 min ist Zahltag: Siedler zahlen Steuern, Soldaten bekommen Sold. Der Steuersatz an der Burg (niedrig, fair, hoch) wirkt auf die Stabilität. Für 40 Taler lässt sich an der Burg sofort ein Arbeiter anwerben. | `src/population/index.js`, HUD, Speicherstand-Schema 3 |
| Jahreszeit sichtbar | Die Uhr zeigt Sommer, Winter und einen Countdown. Die Minimap wird im Winter weiß. | `src/ui/hud.js`, `src/ui/minimap.js` |

Nachweis: 82 automatische Tests (davon 10 neu in `tests/simulation/seasons.test.js` und
`tests/simulation/treasury.test.js`), neue
Screenshot-Presets `winter-overview` und `winter-settlement`.

## Stufe 3: was noch fehlt (ehrliche Liste, grob nach Wirkung sortiert)

1. **Geld weiter ausbauen.** Die Grundform steht (Zahltag, Steuern, Sold, Arbeiter kaufen).
   Offen: Truppen und Forschung in Taler bezahlen, Handel (Ware gegen Taler) und eine
   Burg-Stufe, die mehr Steuern bringt.
2. **Gebäudestufen.** Ausbau von Burg, Wohnhäusern und Betrieben in 2 bis 3 Stufen, jede mit
   eigenem Modell. Das bringt viel Abwechslung ins Stadtbild.
3. **Arbeiter-Alltag.** Arbeiter essen auf einem Hof und schlafen in einem Wohnhaus.
   Fehlen diese, arbeiten sie langsamer (Motivation). Heute gibt es dafür nur eine
   gemeinsame Mahlzeit.
4. **Mehr Helden und Kampagne.** Mehrere Helden mit je zwei Fähigkeiten, mehrere Karten,
   Zwischensequenzen mit Kamerafahrt, Sprachausgabe.
5. **Truppen als Einheiten mit Hauptmann.** Hauptmann plus Soldaten, die man mit Geld
   nachkauft. Dazu Kanonen und Belagerung.
6. **Weiteres Wetter.** Regen mit Einfluss auf Felder und Wege. Echtes Sichtfeld im Nebel
   (Gegner nur dort sichtbar, wo gerade jemand steht).
7. **Grafik.** Skelett-Animationen statt gesteckter Figuren, detailliertere Gebäude,
   komponierte Musik statt generativer Musik.

## Hinweise zur Weiterarbeit

- Der Winter läuft fest nach Spielzeit ab (`SEASON` in `src/weather/index.js`), damit
  Speichern, Laden und Tests deterministisch bleiben.
- Schnee und Nebel laufen über gemeinsame Shader-Uniforms (`SNOW`, `SHROUD`) in
  `src/render/structure-material.js`. Neue Materialien sollten `patchStructureShader`
  benutzen, dann erhalten sie beides automatisch.
- Die Balance-Messungen der Spiellänge (`docs/KNOWN_ISSUES.md`) stammen noch aus der Zeit
  vor dem Winter. Der Bot gewinnt weiterhin, eine neue Messung steht aus.

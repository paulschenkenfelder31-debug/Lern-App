# Fahrklar – Arbeitsregeln

## Was Fahrklar ist

Fahrklar ist eine deutschsprachige Lern-App für den österreichischen Führerschein.
Sie bietet lokale Lernrunden, Wiederholungen, Prüfungssimulationen und ausführliche Statistiken.
Android und Web teilen dieselbe Oberfläche; ein optionales Firebase-Konto synchronisiert bestätigte Nutzer.

## Ziele in dieser Reihenfolge

1. Fragenkatalog: Rechte, Quelle und Aktualisierung rechtlich klären.
2. Release-Keystore: dauerhafte Android-Signierung einrichten, damit Updates ohne Neuinstallation funktionieren.
3. Oberfläche: deutsche, klare und zugängliche Lernoberfläche weiter verbessern.

## Harte Regeln

- WebView-Härtung nicht abschwächen.
- Keine fremden Fragen oder Bilder in Repository, Testdaten oder APK committen.
- Keine neuen Laufzeitabhängigkeiten ohne ausdrückliche Entscheidung.
- Niemals Zugangsdaten, API-Schlüssel oder private Schlüssel committen.
- Firebase-Regeln müssen Zugriff auf bestätigte Nutzer und deren eigene UID beschränken.
- Lokale Nutzung muss bei Netz- oder Dienstfehlern weiter funktionieren.
- Keine rechtliche Aktualität, amtliche Prüfung oder Datenvollständigkeit behaupten, die nicht verifiziert ist.
- Tests dürfen nur synthetische Inhalte verwenden.
- Änderungen klein, nachvollziehbar und rückwärtskompatibel halten.

## Stil

- Oberfläche und Nutzertexte auf Deutsch, mit Du-Ansprache.
- Kompakter, gut lesbarer Code; bestehende Muster zuerst wiederverwenden.
- Icons statt Emojis, nur aus einer frei nutzbaren Sammlung mit Lizenzhinweis.
- Barrierearme Kontraste, große Schrift und reduzierte Bewegung respektieren.

## Designsystem

Die Oberfläche hat zwei Register in einem System. **Verspielt** für Start, Lernpfad und Fortschritt: Lernpfad mit Knoten, Serie, Tagesziel, Blockschatten. **Ruhig** für Lernrunde und Prüfung: nichts lenkt ab, die Frage füllt den Bildschirm, der Hauptknopf sitzt unten in der Daumenzone.

- `render()` setzt am App-Container `data-register="calm"` für die Lernrunde, sonst `playful`. Regeln für Lernrunde und Prüfung gehören unter `#app[data-register="calm"]` – die ID ist nötig, weil spätere Regeln des verspielten Stils sonst bei gleicher Spezifität gewinnen.
- Farben nur über die Tokens der einzigen `:root`-Definition in `style.css`: `--bg --surface --text --text-muted --line --accent --accent-strong --accent-soft --on-accent --ok --ok-soft --bad --bad-soft --reward`. Ein Farbthema setzt nur `--accent`, `--accent-strong` und `--accent-soft`, jeweils hell und unter `body.dark`.
- Hauptknöpfe nutzen `--accent-strong` als Fläche und `--on-accent` als Schrift. Text in Akzentfarbe auf hellem Grund nutzt `--accent-strong`, nicht `--accent`.
- `tests/contrast.test.cjs` prüft die Kontrastpaare für alle vier Themen in hell und dunkel gegen 4,5 : 1 und schlägt fehl, sobald alte Variablennamen wie `--soft`, `--accent-dark` oder `--purple` wieder auftauchen.
- Spielmechanik muss wirken oder verschwinden. Elemente, die etwas anzeigen, aber nichts bewirken, bekommen eine Wirkung oder werden entfernt.

## Vor jedem Push

Diese beiden Befehle müssen erfolgreich sein:

```sh
node --test tests/*.test.cjs
gradle assembleDebug lintDebug
```

Bei Änderungen an Web-Build oder Android zusätzlich den passenden Build ausführen. Verifizierte Ausgaben im Protokoll festhalten.

Bei Änderungen an Oberfläche oder `style.css` zusätzlich die Referenzbilder vergleichen:

```sh
npm i --no-save playwright@1.58.2    # einmalig, ändert package.json nicht
npx playwright install chromium      # einmalig
node scripts/ui-baseline.mjs --compare
```

Das Skript fotografiert 70 Zustände bei 390 × 844 mit synthetischem Katalog, fester Uhrzeit und festem Zufall, meldet geänderte Bilder und schreibt einen Bericht mit Vorher-Nachher-Ansicht. Nach Durchsicht wird eine gewollte Änderung mit `node scripts/ui-baseline.mjs` zur neuen Referenz. Die Playwright-Version bleibt fest, weil eine andere Chromium-Version Schrift minimal anders rendert.

## Rechte

GitHub-Admin-Aktionen nur im Repository `paulschenkenfelder31-debug/Lern-App`.
Keine Rechte, Konten oder externen Dienste eigenmächtig erweitern.

## Arbeitsweise für Codex und Claude

Beim Start zuerst diese Datei und `docs/protokoll/README.md` lesen. Danach den letzten eigenen Protokolleintrag und den aktuellen Repository-/CI-Stand prüfen. Vor Änderungen offene Entscheidungen und Sicherheitsregeln beachten. Nach Änderungen Tests ausführen und einen neuen Eintrag in der eigenen Protokolldatei anlegen. Nie die Protokolldatei des anderen Werkzeugs überschreiben.

Größere Vorhaben bekommen vor dem Code einen Entwurf unter `docs/superpowers/specs/` und einen Umsetzungsplan unter `docs/superpowers/plans/`.

## Verweise

- Technische Spezifikation und Konten: `docs/`
- Entwürfe und Umsetzungspläne: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Arbeitsprotokoll: `docs/protokoll/`
- Fragenquelle und Rechte: `README.md`, Abschnitt „Fragenquelle und Rechte“
- Firebase-Einrichtung: `docs/accounts.md`
- Android-Updates: `docs/updates.md`

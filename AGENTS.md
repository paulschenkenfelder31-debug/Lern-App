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

## Vor jedem Push

Diese beiden Befehle müssen erfolgreich sein:

```sh
node --test tests/*.test.cjs
gradle assembleDebug lintDebug
```

Bei Änderungen an Web-Build oder Android zusätzlich den passenden Build ausführen. Verifizierte Ausgaben im Protokoll festhalten.

## Rechte

GitHub-Admin-Aktionen nur im Repository `paulschenkenfelder31-debug/Lern-App`.
Keine Rechte, Konten oder externen Dienste eigenmächtig erweitern.

## Arbeitsweise für Codex und Claude

Beim Start zuerst diese Datei und `docs/protokoll/README.md` lesen. Danach den letzten eigenen Protokolleintrag und den aktuellen Repository-/CI-Stand prüfen. Vor Änderungen offene Entscheidungen und Sicherheitsregeln beachten. Nach Änderungen Tests ausführen und einen neuen Eintrag in der eigenen Protokolldatei anlegen. Nie die Protokolldatei des anderen Werkzeugs überschreiben.

## Verweise

- Technische Spezifikation und Konten: `docs/`
- Arbeitsprotokoll: `docs/protokoll/`
- Fragenquelle und Rechte: `README.md`, Abschnitt „Fragenquelle und Rechte“
- Firebase-Einrichtung: `docs/accounts.md`
- Android-Updates: `docs/updates.md`

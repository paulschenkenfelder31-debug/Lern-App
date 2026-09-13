# 2026-09-13 · David · Screenshot-Netz, Git-Historie, E-Mails

Sitzung mit Claude Code, ohne David am Rechner. Auftrag: selbstständig weiterarbeiten und die zwei vorbereiteten E-Mails verschicken.

## Gemacht

* `scripts/ui-baseline.mjs` geschrieben. Das Skript baut `dist/`, startet einen lokalen Server ohne Abhängigkeiten, liefert einen synthetischen Katalog mit 120 Fragen nur im Speicher aus und fotografiert die App mit Playwright bei 390 × 844 und doppelter Pixeldichte. Grünes Farbthema hell und dunkel mit allen Bildschirmen, dazu Startbildschirm in Blau, Lila und Orange. Jeder Zustand wird zweimal fotografiert: sichtbarer Bildschirm und ganze Seite.
* Erfasste Zustände: Start, Üben, Prüfung, Fortschritt und Verlauf leer, Einstellungen, Lernrunde mit Frage, Auswahl, richtiger und falscher Auflösung, Pause, Beenden-Dialog, Seite nach Abbruch, Fortschritt und Verlauf mit Daten, Prüfungssimulation.
* 70 Referenzbilder unter `tests/ui-baseline/` erzeugt, zusammen 13 MB. Nicht committet.
* `AGENTS.md`, Abschnitt „Vor jedem Push", um die Befehle für den Bildvergleich ergänzt.
* Git-Historie aller 20 Commits auf eingecheckte Kataloginhalte geprüft.

## Verifiziert

* **Git-Historie sauber.** Hinzugefügte JSON- und Bilddateien über alle Commits: nur `firebase.json`, `package.json`, `web/icon-192.png`, `web/icon-512.png`. Keine Datei über 200 KB. Das F-Online-Feld `txt_text` taucht in drei Commits auf, aber ausschließlich als Feldname im Validierungscode (`core.js`, `MainActivity.java`, `web/functions/catalog.mjs`) und in Testdaten mit Texten wie „Synthetische Frage".
* **Bilder sind reproduzierbar.** Zwei Vergleichsläufe direkt hintereinander: jeweils „Unverändert: 70", Exit-Code 0.
* **Der Vergleich erkennt echte Änderungen.** Mit angehängtem `.card{outline:3px solid #ff0000}` meldet er 53 geänderte Bilder und endet mit Exit-Code 1. Die 17 unveränderten Bilder enthalten keine Karte. `style.css` danach per `git checkout` zurückgesetzt, `git diff` leer.
* **`package.json` unverändert.** Playwright ist mit `--no-save` installiert, `git status` zeigt keine Änderung an `package.json` und keine Lockdatei.
* Android-Werkzeugkette **nicht** vorhanden: JDK 21 ist installiert, `gradle` fehlt, kein Android SDK, kein Android Studio. Die Android-Tests liefen deshalb nicht.

## Entschieden

* **Zwei Fehler im eigenen Skript behoben, bevor die Referenz entstand.**
  * Die Seite „Fortschritt mit Daten" war zwischen zwei Läufen verschieden. Ursache: Die App misst aktive Antwortzeit mit `performance.now`, und die echte Klickdauer des Testbrowsers floss in die angezeigten Zeiten. `performance.now` liefert im Testbrowser jetzt immer 0. `Date` ist über Playwrights Uhr fest auf den 1. September 2026, 10:00 gestellt, `Math.random` hat einen festen Startwert.
  * In Ganzseitenbildern setzte Chromium die fixierte Navigationsleiste mitten ins Bild statt ans Ende. In Ganzseitenbildern ist die Navigation deshalb ausgeblendet; im sichtbaren Bildschirm bleibt sie.
* **Ein erster Gegentest war falsch aufgebaut.** Er änderte `--radius:22px` auf `8px` und der Vergleich meldete nichts. Grund war nicht das Skript: `style.css` definiert `--radius` zweimal auf `:root`, und die spätere Definition mit `20px` überschreibt die erste. Der Test veränderte einen Wert ohne Wirkung. Der zweite Gegentest mit einer sicher sichtbaren Änderung bestätigt das Skript.
* **Playwright nicht in `package.json`.** Die Null-Abhängigkeiten-Eigenschaft des Projekts bleibt erhalten. Die Version steht fest im Skriptkopf und in `AGENTS.md`.

## Offen

* **Antworten auf die zwei E-Mails abwarten.** Nach Neustart mit Gmail-Connector am selben Tag aus `daveghg03@gmail.com` verschickt: Informationsbegehren nach dem Informationsfreiheitsgesetz an `servicebuero@bmimi.gv.at` (Gmail-Nachricht `1a09a56048c6dd77`) und Genehmigungsanfrage an `info@f-online.at` (Gmail-Nachricht `1a09a561fc53c90d`). Die Anfrage an F-Online legt die abgeschaltete Ladefunktion offen. Die Antwort des Ministeriums entscheidet, ob der Katalog aus amtlicher Quelle bezogen werden kann.
* **Referenzbilder committen oder nicht.** 13 MB PNG im öffentlichen Repository wachsen mit jeder gewollten Designänderung weiter, weil Git alte Versionen behält. Ohne Commit hat aber nur, wer das Skript selbst ausführt, eine Referenz. Absprache zwischen Paul und David nötig. Möglicher Mittelweg: Bilder nicht committen, nur `manifest.json` mit den Prüfsummen – dann erkennt jeder Rechner Abweichungen, sofern Playwright-Version und Schriften gleich sind.
* **Doppelte `--radius`-Definition in `style.css`.** Die erste mit `22px` ist wirkungslos. Gehört zum Aufräumen beim Designsystem, nicht zu dieser Sitzung.
* **Android-Werkzeugkette einrichten.** Android Studio mit Platform 35 und Build-Tools 35.0.0, danach `gradle testDebugUnitTest assembleDebug lintDebug`.
* **Nichts committet.** Auf `main` liegen weiterhin unversionierte Änderungen: `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `docs/log/`, `scripts/ui-baseline.mjs`, `tests/ui-baseline/`.

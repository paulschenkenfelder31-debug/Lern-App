# Fahrklar – Ziele und Regeln für KI-Assistenten

Diese Datei ist die gemeinsame Grundlage für alle KI-Werkzeuge in diesem Repository. Codex liest sie direkt, Claude Code über [`CLAUDE.md`](CLAUDE.md). Regeln nur hier ändern, nicht an zwei Stellen pflegen.

## Was Fahrklar ist

Eine deutschsprachige, lokal speichernde Lern-App für die österreichische Führerschein-Theorieprüfung. Eine gemeinsame Codebasis erzeugt zwei Ausspielwege: eine Android-APK aus Java plus WebView und eine installierbare Web-PWA über Netlify. Es gibt kein Framework und keine Laufzeitabhängigkeiten – `package.json` enthält null Pakete, JUnit und Robolectric sind reine Testabhängigkeiten.

Die geteilte Logik liegt in `app/src/main/assets/core.js` und ist UMD-artig aufgebaut, damit Node sie testen kann. Die Oberfläche liegt in `app.js`, `style.css` und `index.html` im selben Verzeichnis und wird von APK und Web-Version gemeinsam benutzt.

## Ziele, nach Wichtigkeit geordnet

1. **Fragenkatalog rechtlich klären.** Ohne Katalog ist die App leer, alles andere ist zweitrangig. Der Direktdownload von F-Online ist abgeschaltet, weil die nötige schriftliche Genehmigung fehlt. Neben dem Urheberrecht an einzelnen Fragen gilt der Datenbankschutz nach §§ 76c und 76d UrhG auf die Sammlung als Ganzes.
2. **Dauerhaften Release-Keystore einrichten.** Die Pipeline erzeugt derzeit eine Debug-Testversion, weil zwei GitHub-Secrets fehlen. Der temporäre Debug-Schlüssel kann sich je Build ändern, dann verlangt Android eine Neuinstallation und der lokale Lernstand ist verloren. Anleitung in `docs/updates.md`, Einrichtung über `scripts/setup-signing.sh`.
3. **Oberfläche neu gestalten.** Beschlossene Richtung siehe „Designrichtung" unten.
4. **Bekannte Fehler beheben.** Siehe `docs/log/` und die Fehlerliste der jeweils letzten Einträge.

## Harte Regeln

* **Keine fremden Inhalte im Repository.** Weder Fragen noch Bilder von F-Online oder anderen Anbietern – nicht im Code, nicht in der APK, nicht in Testdaten. Tests verwenden ausschließlich synthetische Inhalte.
* **Sicherheitshärtung nicht abschwächen.** Jede Navigation in der WebView ist blockiert. `shouldInterceptRequest` arbeitet mit Whitelists: Assets über ein festes Regex aus sieben Dateinamen, Bilder nur von `img.f-online.at` mit Pfadmuster `/[0-9]+\.jpg` und zusätzlicher Prüfung der JPEG-Magic-Number. Dateizugriff und Cookies sind aus, in `index.html` gilt eine strikte CSP.
* **Gemini-Schlüssel bleibt verschlüsselt.** AES-GCM im Android Keystore, Dialog mit `FLAG_SECURE`. `normalizeKey` lehnt Zeichen außerhalb 33..126 ab und verhindert damit CRLF-Injection im `x-goog-api-key`-Header. Dafür existiert ein Test.
* **Nie Zugangsdaten committen.** Das Repository ist öffentlich. Die Web-Konfiguration in `app/src/main/assets/firebase-config.js` ist eine öffentliche Client-Konfiguration und ausdrücklich kein Geheimnis; alles andere gehört in GitHub-Secrets.
* **Keine neuen Laufzeitabhängigkeiten** ohne ausdrückliche Zustimmung beider Mitarbeiter.
* **Keine Pull Requests und keine Pushes nach `main` ohne Aufforderung.** Ein Branch pro Aufgabe.

## Stil

Deutschsprachige Oberfläche, du-Ansprache, sachlicher Ton ohne Übertreibung. Der Code ist bewusst extrem kompakt; neue Zeilen sollen sich einfügen und nicht ausscheren. Commit-Nachrichten und Dokumentation in normaler Prosa, unabhängig davon, in welchem Stil der Chat läuft.

## Designrichtung

Beschlossen am 10. September 2026: **zwei Register in einem Designsystem.**

* **Motivierend** für Start, Lernpfad und Fortschritt: Lernpfad mit Knoten, Serie, Tagesziel als Ring, warme Flächen. Baut den heutigen Stil aus.
* **Nüchtern** für Lernrunde und Prüfungssimulation: nichts lenkt ab, die Frage füllt den Bildschirm, der Primärbutton sitzt unten in der Daumenzone.

Gleiche Farben, gleiche Abstände, unterschiedliche Dichte.

Technisch setzt `render()` am App-Container `data-register="calm"` für die Lernrunde, sonst `playful`. Neue Regeln für Lernrunde und Prüfung gehören unter `#app[data-register="calm"]` – die ID ist nötig, weil spätere Regeln des verspielten Stils sonst bei gleicher Spezifität gewinnen. Farben nur über die Tokens der einzigen `:root`-Definition in `style.css` (`--text`, `--text-muted`, `--accent`, `--accent-strong`, `--on-accent`, `--ok`, `--bad` und weitere); jedes Farbthema setzt nur `--accent`, `--accent-strong` und `--accent-soft`. `tests/contrast.test.cjs` prüft die Kontrastpaare für alle vier Themen in hell und dunkel gegen 4,5 : 1.

Spielmechanik muss wirken oder verschwinden. Die Fokus-Herzen zeigen heute Fehler an und sperren nichts – der Hinweistext räumt das selbst ein. Solche Elemente entweder mit Wirkung versehen oder entfernen.

## Vor jedem Push

```sh
node --test tests/*.test.cjs
gradle testDebugUnitTest assembleDebug lintDebug
```

Erwartung: 50 von 50 Node-Tests, 24 Android-Testausführungen, Lint ohne Fehler. Ändert sich eine dieser Zahlen, gehört die neue Zahl in denselben Commit dokumentiert.

Für Oberflächenänderungen zusätzlich die Referenzbilder vergleichen:

```sh
npm i --no-save playwright@1.58.2    # einmalig, ändert package.json nicht
npx playwright install chromium      # einmalig
node scripts/ui-baseline.mjs --compare
```

Das Skript fotografiert 70 Zustände bei 390 × 844 mit einem synthetischen Katalog, fester Uhrzeit und festem Zufall. Es meldet geänderte Bilder und schreibt einen Bericht mit Vorher-Nachher-Ansicht. Eine gewollte Änderung wird mit `node scripts/ui-baseline.mjs` zur neuen Referenz. Die Playwright-Version bleibt fest: eine andere Chromium-Version rendert Schrift minimal anders, dann gilt jedes Bild als geändert.

## Wer darf was

| Person | GitHub | Rechte |
|---|---|---|
| Paul | `paulschenkenfelder31-debug` | Eigentümer, `admin` |
| David | `DavidLeitnerHTL` | `push`, `triage`, `pull` |

GitHub-Secrets, Release-Keystore, Branch-Schutz und Repository-Einstellungen kann nur Paul ändern.

## Ablage

| Was | Wohin |
|---|---|
| Entwürfe und Spezifikationen | `docs/superpowers/specs/YYYY-MM-DD-<thema>-design.md` |
| Arbeitsprotokoll | `docs/log/YYYY-MM-DD-<person>-<thema>.md` |
| Betriebsanleitungen | `docs/` |

## Protokoll führen

Jede Arbeitssitzung bekommt **eine eigene Datei** in `docs/log/`. Bewusst eine Datei pro Sitzung und keine gemeinsame Journaldatei: so schreiben zwei parallel arbeitende Werkzeuge nie in dieselben Zeilen, und es entstehen keine Merge-Konflikte.

Aufbau:

```markdown
# 2026-09-10 · David · Kurzes Thema

## Gemacht
## Verifiziert
## Entschieden
## Offen
```

Der Abschnitt **Verifiziert** ist der wichtigste. Dort steht, was tatsächlich ausgeführt wurde, mit der entscheidenden Ausgabezeile – nicht, was funktionieren sollte. Er verhindert, dass das andere Werkzeug eine Behauptung ohne Beweis übernimmt oder dieselbe Prüfung erneut aufsetzt.

Vor dem Beginn einer Aufgabe die letzten zwei bis drei Einträge lesen.

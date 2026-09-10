# Fahrklar – Lern-App für Android

Eine deutsche, lokal speichernde Lern-App für den österreichischen Führerschein.

## APK herunterladen

[**Neueste APK öffnen**](https://github.com/paulschenkenfelder31-debug/Lern-App/releases/latest)

Unter **Assets** auf **Fahrklar-Test.apk** tippen, herunterladen und auf dem Android-Handy öffnen. Android 8.0 oder neuer und eine aktuelle Android System WebView sind erforderlich. Falls Android danach fragt, die Installation für die verwendete Download-App erlauben.

Jeder Push nach `main` führt Logiktests, Android-Build und Lint aus und stellt bei Erfolg eine APK in GitHub Releases bereit. Alternativ liegt sie unter **Actions → Android APK → erfolgreicher Lauf → Fahrklar-APK**.

## Funktionen

- Deutsche Oberfläche mit vier Farbthemen, hellem/dunklem Design, größerer Schrift, reduzierbaren Animationen, Tagesziel und lokaler Lernserie.
- Lernrunden, Suche, Themenfilter, neue Fragen, zuletzt falsche Fragen und Merkliste.
- Kurze, normale oder intensive Lernrunden mit 10, 20 oder 30 Fragen. Optional bleiben Bildschirm und Fokus während einer Einheit aktiv; richtig/falsch kann haptisch bestätigt werden.
- Multiple Choice mit vollständiger Antwortauswertung und Bildunterstützung.
- Übungssimulationen pro gewähltem Modul: 20 zufällige Hauptfragen, verknüpfte Zusatzfragen nur nach richtiger Hauptfrage, 30 Minuten pro Modul, 80 % der möglichen Punkte als Übungsziel. Keine amtlich zertifizierte Simulation; die genaue amtliche Themenverteilung und Sonderregeln von AM/Fahrlehrer sind nicht nachgebildet.
- Alle Antworten und Simulationen mit Verlauf und Lösungssnapshots der damaligen Text-/Antwortversion. Historische Bilder werden über ihre Quell-ID referenziert und können sich beim Anbieter ändern.
- Trefferquote, aktive Fragen pro Minute, Lernzeit, Mittelwert/Median/P90 der Antwortzeit, Erstversuchsquote, Katalogabdeckung, Beherrschung nach drei richtigen Antworten in Folge, Tagesverlauf, schwache Themen, Prüfungserfolgsquote, Zeitraum- und Modulfilter.
- Keine Anmeldung, Werbung, Cloud-Synchronisation oder Analyse-Tracker. Android-Cloud-Backup ist deaktiviert. JSON-Sicherung und Wiederherstellung über den Android-Dateidialog.

## Fragenquelle und Rechte

Technisch geprüft am 09.09.2026: Die öffentliche F-Online-Website liefert ihre Gatsby-Seitendaten als JSON:

`https://www.f-online.app/page-data/at/fragenkatalog/alle-fragen/page-data.json`

Die geprüfte Antwort enthält 4.310 eindeutige Fragen, Antwortschlüssel, Bild-IDs, Klassen, Themen, Punkte und Haupt-/Zusatzfragen-Verknüpfungen. Dies ist eine öffentliche Website-Datenressource, **keine dokumentierte oder vertraglich zugesicherte API**. Die AGB schließen eine Garantie für Vollständigkeit und Aktualität aus. Der letzte erfolgreiche Abgleich wird in der App sichtbar angezeigt; daraus wird kein amtlicher Fragenstand abgeleitet.

F-Online verlangt in seinen [AGB](https://www.f-online.app/at/agb/) eine ausdrückliche schriftliche Genehmigung für die Weiterverwendung. Vor der Aktivierung muss diese Genehmigung für die beabsichtigte Nutzung mit `info@f-online.at` geklärt werden. Die App startet ohne Fragen; der Direktdownload ist anfangs ausgeschaltet und wird erst nach Bestätigung dieses Hinweises aktiviert. **Es sind keine F-Online-Fragen oder Bilder im Repository, in Testdaten oder in der APK enthalten.** Eine Lizenz des App-Codes würde keine Rechte am Fragenmaterial einräumen.

Der ebenfalls gefundene ältere [Node-Client](https://github.com/JohnDeved/f-Online-Nodejs-api) ist keine offizielle API-Freigabe; er benötigt eine Anmeldung und verweist auf die Kontaktaufnahme mit F-Online. Er wird nicht verwendet.

### Katalogmodule

| Quell-ID | Modul | Fragen beim geprüften Abruf |
|---|---|---:|
| 1 | Grundwissen | 1.052 |
| 2 | A | 322 |
| 3 | B | 374 |
| 4 | C | 612 |
| 5 | D | 498 |
| 6 | E | 372 |
| 7 | F | 386 |
| 8 | AM | 297 |
| 10 | Fahrlehrer | 397 |

Es gibt derzeit keine Fragen mit Klasse-ID 9 (BE) in dieser Ressource. BE wird daher nicht als verfügbar vorgetäuscht. A1/A2 sowie C1/D1 werden nicht als eigenständige Kataloge ausgewiesen. Unbekannte zukünftige Klassen werden nicht stillschweigend einer bestehenden Klasse zugeordnet.

### Aktualisierung und Offlinebetrieb

Nach Aktivierung prüft die App beim Öffnen höchstens einmal pro 24 Stunden auf Änderungen; zusätzlich ist ein manueller Abgleich möglich. Keine Hintergrundabfrage bei geschlossener App. `If-None-Match` reduziert Übertragungen, wenn der Anbieter ETags liefert. Bei Ausfällen, ungültigen Datensätzen, fehlenden Zusatzfragen oder einem plötzlichen Rückgang um mehr als 20 % bleibt der vorherige Katalog unverändert. Dateien werden atomar ersetzt. Ein Text-/Antwort-/Bild-ID-Wechsel setzt die Beherrschung der betroffenen Frage zurück, ohne frühere Statistiken zu löschen.

Bilder werden direkt vom Anbieter geladen, lokal gespeichert und können für die ausgewählten Module vorab heruntergeladen werden. Der Anbieter sieht bei Downloads technisch die IP-Adresse, erhält aber keine Antworten oder Lernstatistiken. Ohne notwendige Bilder ist die Antwortabgabe gesperrt. Der erste Bilddownload benötigt Internet und kann einige Minuten dauern.

## Signierung und Updates

Solange die beiden GitHub-Secrets noch fehlen, erstellt die Pipeline eine **Debug-Testversion**. Der temporäre Debug-Schlüssel kann sich je Build ändern. Android kann dann eine Neuinstallation verlangen; vorher in der App eine JSON-Sicherung exportieren und anschließend wiederherstellen. Kein privater Signierschlüssel wird öffentlich gespeichert.

Für dauerhafte Installation mit Updates ohne Neuinstallation muss der Eigentümer einmalig einen privaten Release-Keystore sicher aufbewahren und als GitHub Actions Secrets einrichten. Die Pipeline unterstützt das bereits und veröffentlicht danach automatisch dauerhaft signierte APKs. Die genauen Schritte stehen in [`docs/updates.md`](docs/updates.md); `scripts/setup-signing.sh` richtet die Secrets über die GitHub CLI ein. Beim einmaligen Wechsel von der Testsignatur zur Release-Signatur ist noch eine Neuinstallation nötig, danach lassen sich alle künftigen Versionen darüberinstallieren.

## Entwicklung

Android-Projekt mit Java und lokaler HTML/CSS/JavaScript-Oberfläche in einer eingeschränkten WebView. Die Oberfläche wird ausschließlich aus APK-Assets geladen. Externe Navigation wird blockiert, Bilder sind auf numerische JPEG-Pfade bei `img.f-online.at` beschränkt, Dateizugriff der WebView ist deaktiviert, und die JavaScript-Brücke ist nur der lokalen Oberfläche zugänglich.

Voraussetzungen: JDK 17, Android SDK 35, Build Tools 35.0.0, Gradle 8.11.1 und Node.js 22 für Tests.

```sh
node --test tests/*.test.cjs
gradle assembleDebug lintDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`.

Die Tests verwenden ausschließlich synthetische Inhalte. Sie prüfen Antwortauswertung, Katalogvalidierung, Fragenrevisionen, Prüfungsauswahl und Punktesumme, statistische Nenner, leere Zustände, Lernserien und Sicherungsvalidierung. Ein echter Gerätetest bleibt zusätzlich sinnvoll, insbesondere für Dateidialoge, Hintergrundverhalten und Bilddownloads.

### Piktogramme und erster Start
Die Oberfläche verwendet lokal eingebettete SVG-Piktogramme aus [Lucide](https://lucide.dev), Stand `75955ec47b764f253ded2baea7a1c2b3ec64efec`. Die vollständigen ISC- und Feather-MIT-Lizenztexte sind in `icons.js` enthalten und unter Einstellungen → Open-Source-Lizenzen lesbar. Die Icons benötigen keine Internetverbindung.

Ohne gespeicherten Katalog führen Übersicht, Lernen und Prüfung zur Download-Einführung. Ein laufender Download ist sichtbar und verhindert doppelte Anfragen. Fehler zeigen eine Wiederholen-Schaltfläche; ein fehlgeschlagener Abgleich entfernt den bisherigen Katalog nicht. Texte und Antworten sind nach dem Download offline verfügbar; die Bilder der gewählten Module können separat in den Einstellungen geladen werden.
# Gemini-Lernhilfe

Unter **Einstellungen → Deine KI-Lernhilfe → Gemini einrichten** lässt sich ein eigener Gemini-API-Key direkt auf dem Android-Gerät hinterlegen. Mit **Gemini-Verbindung testen** kann der Key anschließend geprüft werden, ohne zuerst eine Führerscheinfrage zu beantworten. Der Test verwendet die minimale dokumentierte Interactions-Anfrage mit `gemini-flash-latest` und einfachem Texteingang. Fehler werden lokal in sichere Kategorien übersetzt, ohne den Key oder die rohe Serverantwort an die Web-Oberfläche zu geben. Nach einer Antwort oder in einer abgeschlossenen Einheit erscheint **Einfach erklären**. Gemini erklärt die Kataloglösung in einfachem Deutsch und ergänzt einen Merksatz. Während einer aktiven Prüfungssimulation ist die Funktion gesperrt.

Eine Anfrage übermittelt ausschließlich die aktuelle Frage, Antwortoptionen, den Katalog-Antwortschlüssel und zugehörige Bilder an Google. Sie erfolgt nur nach Antippen; das eigene Gemini-Kontingent bzw. der eigene Tarif gilt. Fehlende Bilder brechen den Abruf ab, statt Gemini ohne wichtige Bildinformationen antworten zu lassen. Generierte Erklärungen sind gekennzeichnete Lernhilfen, können falsch sein und ändern weder Lösungen noch Statistiken.

Der Key wird in einem nativen Passwortdialog eingegeben und mit AES-GCM verschlüsselt; der Verschlüsselungsschlüssel liegt im Android Keystore. Der Web-Oberfläche stehen nur der Hinterlegt-Status und Aktionen zur Verfügung, keine Funktion zum Auslesen. Weder Quellcode/APK noch JSON-Sicherungen enthalten einen Nutzer-Key. Nach einer Neuinstallation muss er erneut eingetragen werden. Dies ist eine Integration mit eigenem Schlüssel pro Nutzer; ein gemeinsamer Betreiber-Key gehört in einen separaten Backend-Dienst und nicht in die APK.

Primär verwendet die App die aktuelle `interactions`-Schnittstelle mit dem Alias `gemini-flash-latest`, wie in Googles Dokumentation für neue Auth Keys gezeigt. Nur wenn dieser Endpunkt einen 404 meldet, fragt sie über `models.list` die verfügbaren Modelle ab und nutzt ein geeignetes Flash-Textmodell mit `generateContent`. Das gewählte Rückfallmodell wird lokal gespeichert und bei einem späteren 404 neu ermittelt. Die Authentifizierung erfolgt über `x-goog-api-key`. Erklärungen werden für bis zu 100 Fragenversionen nur im Arbeitsspeicher zwischengespeichert, nicht exportiert. Keine automatischen kostenpflichtigen Wiederholungsversuche. Kontingent-, Zugriffs- und Netzwerkfehler nennen nun Endpunkt und HTTP-Status, ohne Key oder rohe Serverantwort anzuzeigen.

## Spielerischer Lernpfad

Die Übersicht zeigt einen vertikalen Fahrklar-Lernpfad mit adaptiver Lernrunde, fälligen Wiederholungen, Prüfungssimulation und Meisterungsziel. Vollständig richtige Antworten bringen 10 XP, gemeisterte Fragen 20 XP und bestandene Übungssimulationen 100 XP. Je 500 XP steigt das lokale Level. Tagesaufgabe, Lernserie und Fokus-Anzeige machen Fortschritt schneller sichtbar. Fokus sinkt bei heutigen Fehlern, sperrt aber keine Übung und wird täglich neu berechnet. Alle Werte entstehen lokal aus dem vorhandenen Verlauf; es gibt kein Konto, keine Rangliste und keine Übertragung dieser Werte.

Unter **Einstellungen → Farbthema** stehen Waldgrün, Klarblau, Violett und Orange zur Auswahl. Jedes Thema verwendet für Navigation, Lernpfad, Levelkarte, Fortschrittsbalken und Ergebnisanzeige nur Abstufungen seiner Hauptfarbe. Gold bleibt auf Belohnungen und Tagesaufgaben beschränkt. Die Auswahl wird lokal gespeichert und funktioniert zusammen mit dem hellen und dunklen Design.

Die Einstellungen sind in **Persönlich**, **Dienste** sowie **Daten & Info** gegliedert. Selten benötigte Bereiche wie Offline-Bilder, Sicherung, Quellenhinweise und Lizenzen lassen sich platzsparend aufklappen. Seitenwechsel, Antwortauswahl und Fortschrittsbalken verwenden kurze Übergänge; sowohl die Systemeinstellung für reduzierte Bewegung als auch der eigene Schalter deaktivieren sie.

Die Tests prüfen Request-Felder, Bildzuordnung, Antwortschlüssel, unvollständige/abgelehnte Antworten, Prüfungssperre, Zwischenspeicherung und HTML-Escaping mit synthetischen Daten. Eine echte Gemini-Anfrage mit dem persönlichen Key und die hardwaregestützte Schlüsselspeicherung müssen auf dem Gerät geprüft werden.

Referenzen: [Gemini Interactions API](https://ai.google.dev/api/interactions-api), [Gemini API-Keys](https://ai.google.dev/gemini-api/docs/api-key), [Android Keystore](https://developer.android.com/privacy-and-security/keystore).

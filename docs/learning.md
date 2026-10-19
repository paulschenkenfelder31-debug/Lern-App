# Adaptives Lernen und neutrale Oberfläche

Android und Web verwenden weiter dieselben lokalen Assets. Es gibt keine neue Laufzeitabhängigkeit. Der Standard ist Neutral/Dunkel; gespeicherte Farbthemen und Hell/Dunkel-Einstellungen bleiben erhalten. Alle bestehenden Dienste und Schutzmechanismen bleiben in ihrem bisherigen Kontext verfügbar.

## Was als gelernt zählt

`Core.progress` spielt Antworten derselben Frage **und Version** in einer deterministischen Reihenfolge ab. Abgeleitete Zustände werden nicht als zweite Datenbank gespeichert. `learningConfig` in `core.js` enthält die veränderbaren Startheuristiken; sie sind kein wissenschaftlich optimiertes Lernverfahren.

| Zustand | Bedeutung |
| --- | --- |
| Neu | Noch keine auswertbare Antwort dieser Version |
| Im Lernen | Falsch beantwortet, geraten oder noch nicht unabhängig abgerufen |
| Wiederholen | Unabhängig richtig beantwortet; nächste Wiederholung geplant |
| Stabil gelernt | Drei erfolgreiche fällige Wiederholungen an verschiedenen Tagen |
| Erneut festigen | Früher stabil, nach einem Fehler erneut zu festigen |

Die erste unabhängige richtige Antwort plant den nächsten Abruf nach 1 Tag. Erfolgreiche fällige Abrufe erhöhen die Stufe auf 3, 7, 14 und 30 Tage; danach bleiben 30 Tage der obere Startwert. Stabilität entsteht erstmals nach der dritten erfolgreichen verzögerten Wiederholung, also typischerweise an Tag 11 nach Antworten an Tag 0, 1, 4 und 11. Es wird keine Bestehenswahrscheinlichkeit berechnet.

Für einen verzögerten Abruf muss die Frage fällig sein, seit dem letzten Versuch müssen mindestens 24 Stunden vergangen sein und der UTC-Kalendertag muss neu sein. Intervalle sind absolute 24-Stunden-Einheiten; die Anzeige verwendet die aktuelle lokale Zeitzone. Sommerzeitwechsel und ein Geräte-Zeitzonenwechsel können keine zusätzlichen Lerntage erzeugen. Langsames Antworten verändert weder Stufe noch Lernpunkte.

Falsch: nächster Abruf nach 24 Stunden, Stufe und aktuelle Erfolgsfolge zurücksetzen. Eine zuvor stabile Frage wechselt zu „Erneut festigen“. Ältere Antworten bleiben erhalten. Innerhalb einer Runde gibt es höchstens einen zusätzlichen Versuch, hinter **drei anderen Fragen**. Sind dafür zu wenige Fragen übrig, wird kein sofortiger Wiederholungsversuch angehängt.

Geraten: Stufe 0, früher Abruf, keine zusätzliche Stabilität. Nach ausgewählten richtigen Antworten kann die freiwillige Frage „Gewusst oder geraten?“ beantwortet werden. Hilfe, eine bereits betrachtete Lösung oder ein Versuch derselben Frage in derselben Sitzung zählen nicht als unabhängiger Abruf. Die erst nach Abgabe angezeigte Lösung entwertet die gerade abgegebene Antwort nicht. Zusätzliches Öffnen historischer Lösungen wird für die nächsten 24 Stunden als Hilfe gespeichert. Es werden keine KI-Erklärungen erfunden; Gemini wird weiterhin nur ausdrücklich angefragt und verändert den Katalogschlüssel nicht.

## Endliche Etappen

| Rundenlänge | Fällige Fragen | Neue Fragen | Schwächen | Älteres Wissen |
| --- | ---: | ---: | ---: | ---: |
| 5 | 2 | 1 | 1 | 1 |
| 10 | 5 | 2 | 2 | 1 |
| 20 | 10 | 5 | 3 | 2 |

Die Kategorien sind flexibel; leere Kategorien geben Plätze frei. Die Auswahl berücksichtigt nur den übergebenen, nach Modulen/Thema/Filter erlaubten Fragenpool und wählt jede Version höchstens einmal. Fällige Rückfälle und ältere Termine haben Vorrang; die Themen werden innerhalb der Kategorien ausgeglichen. Fragen mit einer gerade angesehenen Lösung werden in Empfehlungen zehn Minuten zurückgestellt; gezieltes Öffnen einer einzelnen Frage bleibt möglich. Zwei neue Fragen eines Themas können eine kleine Einführung bilden; danach werden Themen gemischt. Lernrunden dürfen wie bisher einzelne Zusatzfragen üben; die verknüpfte Freischaltung gilt unverändert in der Simulation.

Bei mindestens 40 fälligen Fragen werden neue Fragen vorübergehend zurückgestellt. Eine Empfehlung umfasst höchstens 20 Fragen; weitere Wiederholungen bleiben für folgende Etappen fällig. Es wird keine künstliche Erledigung oder Terminverschiebung vorgespiegelt. Die Startseite erklärt die Empfehlung und schätzt die Dauer erst ab fünf vorhandenen aktiven Antwortzeiten anhand ihres Medians. Die Schätzung enthält keine garantierte Erklärungs-/Lesezeit.

Lernpunkte würdigen neue unabhängige richtige Antworten höchstens einmal je Frage, Version und UTC-Tag. Wiederholungen mit Hilfe und geratenen Antworten bringen keine neuen Punkte. Historische Antwortpunkte und bereits belegte alte Meisterungs-/Simulationsboni bleiben sichtbar. Lernpunkte sind von Lernzuständen und Prüfungspunkten getrennt. Fehler-Herzen und Fokusabzüge wurden entfernt.

## Simulationen

Auswahl, 20 Hauptfragen je Modul, bedingte Zusatzfragen, 30-Minuten-Zeitlimit und 80-Prozent-Übungsziel bleiben unverändert. Die Uhr läuft im Hintergrund weiter. Es gibt keine adaptive Auswahl, KI-Hilfe oder Lösung vor dem Abschluss.

Neue Simulationsantworten haben zunächst `examStatus: pending`. Erst ein abgeschlossener Durchlauf setzt sie auf `finished` und macht abgegebene Antworten für den Lernplan nutzbar. Abgebrochene, übersprungene und unbeantwortete Simulationsfragen erzeugen keinen erfolgreichen Abruf. Eine echte abgegebene falsche Antwort aus einer abgeschlossenen Simulation plant dagegen eine Wiederholung. Historische Simulationsstatistiken und Lösungssnapshots bleiben erhalten.

## Datenkompatibilität

Der äußere Sicherungs-/Cloud-Datentyp bleibt `schema: 1`. Neue Antworten ergänzen `learningSchema: 2`, eine stabile `attemptId`, UTC-Abruftag, Retry-/Hilfe-/Raten-Flags und eine Konfliktrevision. Bereits gespeicherte Antworten werden nicht umgeschrieben. Ohne neue Metadaten sind sie konservativ bekannte Fragen und Fehler, jedoch kein nachträglich erfundener Nachweis unabhängiger Wiederholungen.

Gespeicherte Rundenlängen 10/20 bleiben erhalten, 30 wird auf 20 abgebildet; aktive Runden werden nicht gekürzt. Neue Runden bieten 5/10/20. Bookmarks, Katalogsnapshots, Konten und Sicherungen bleiben erhalten. Text-/Antwort-/Bild-ID-Änderungen erzeugen weiterhin eine neue Fragenversion. Veraltete oder entfernte Fragen bleiben im Verlauf, kommen jedoch nicht in neue Runden.

Antworten werden bei Cloud-Zusammenführungen anhand ihrer stabilen ID (bei Altbeständen anhand der vollständigen vorhandenen Identitätsfelder) dedupliziert. Zeitgleich eintreffende Sitzungen werden deterministisch zusammengeführt; Konflikte einer Antwort bevorzugen die höhere Revision. Aktuelle lokale Antworten und aktive Sitzungen bleiben bei einer laufenden Synchronisierung erhalten. Hilfezeitpunkte werden als begrenzte, abgeleitete Lernmetadaten im vorhandenen privaten Einstellungsdokument mitgesichert. Bestehende UID-/E-Mail-Schutzregeln bleiben unverändert.

Sicherungen prüfen die optionalen neuen Felder und akzeptieren weiterhin alte Sicherungen. Kein API-Key wird hinzugefügt. Lokales Lernen benötigt weiterhin weder Konto noch Internet. Katalogdownload und Bildrechte bleiben von der ausdrücklichen vorhandenen Quellenfreigabe abhängig.

## Prüfung der Oberfläche

`node --test tests/*.test.cjs` prüft Logik und Controller ohne zusätzliche Pakete. `npm run build:web` erstellt die gemeinsamen Web-Assets.

Der optionale Browserlauf `node scripts/check-ui.cjs` benötigt eine separat vorhandene Playwright-Installation und Chromium. `PLAYWRIGHT_MODULE_PATH` kann den Pfad zu Playwright angeben, `CHROMIUM_EXECUTABLE` einen vorhandenen Browser. `FAHRKLAR_SINGLE_PROCESS=1` erlaubt die Ausführung in einer Umgebung ohne Browser-Unterprozesse. Diese Werkzeuge sind keine Laufzeitabhängigkeit der App.

Der Browserlauf verwendet ausschließlich synthetische Fragen und Antworten, fängt App-Ressourcen lokal ab und kontaktiert weder Kataloganbieter noch Kontodienste. Er prüft 96 Kombinationen aus 360/390/768/1440 Pixel Breite, Hell/Dunkel, normaler/großer Schrift und sechs Hauptansichten. Weitere Prüfungen umfassen Einrichtung, Themenwahl, Lernen, Pause, Lösungen, Simulation, fehlende Bilder, Lade-/Fehlerzustände, Konto-Dialog, Seitenleiste, Tastaturfokus und reduzierte Bewegung. Screenshots liegen unter `docs/screenshots/`; die dort gezeigten Fragen und Lernstände sind Testdaten.

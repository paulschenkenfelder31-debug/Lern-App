# Fahrklar als Web-App deployen

Die Web-Version nutzt dieselbe Oberfläche und Lernlogik wie die Android-App. Sie läuft responsiv auf PC, Tablet und Smartphone und kann als PWA zum Startbildschirm hinzugefügt werden. Lernstand, Einstellungen und Verlauf bleiben lokal im jeweiligen Browser.

## Deployment mit Netlify

1. Bei Netlify **Add new site → Import an existing project** öffnen.
2. GitHub verbinden und `paulschenkenfelder31-debug/Lern-App` auswählen.
3. **Deploy** drücken. Build-Befehl, Ausgabeordner und Serverfunktionen werden automatisch aus `netlify.toml` übernommen.

Es werden keine Environment-Variablen oder Betreiber-API-Keys benötigt. Eine eigene Domain kann anschließend in Netlify unter **Domain management** verbunden werden.

## Enthaltene Web-Funktionen

- Vollständige Lernrunden, Wiederholungsplan, Prüfungssimulationen, Verlauf und Statistiken
- Responsive Bedienung für Maus, Tastatur und Touch
- Installierbare PWA mit Offline-Cache für App, letzten erfolgreichen Fragenkatalog und geladene Bilder
- Katalogabruf über eine gleich-originige Serverfunktion, weil die Quellseite Browser-Direktzugriffe nicht erlaubt
- Manuelle und tägliche Aktualisierung nach derselben ausdrücklichen Quellen-Zustimmung wie in Android
- JSON-Sicherung und Wiederherstellung über den Browser
- Gemini-Erklärungen mit dem persönlichen API-Key; der Key bleibt nur in der aktuellen Browser-Sitzung und wird nicht im Repository oder auf dem Server gespeichert

## Lokal prüfen

```sh
npm test
npm run build:web
```

`dist` enthält danach die fertige statische PWA. Für den aktuellen Fragenkatalog und Gemini werden beim produktiven Betrieb die beiden Netlify-Funktionen benötigt; ein reines Hochladen von `dist` auf einen statischen Dateihoster reicht dafür nicht.

Die Hinweise zu F-Online und der dort verlangten schriftlichen Nutzungsgenehmigung gelten unverändert auch für die Web-Version. Die App lädt den Katalog erst nach Bestätigung dieses Hinweises.

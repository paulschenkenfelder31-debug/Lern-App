# Lernrunde als Vollbild und Designsystem

Stand 13. September 2026. Freigegeben von David in zwei Abschnitten im Brainstorming. Designrichtung „zwei Register in einem System" siehe `AGENTS.md`.

## Ziel

Der Lernbildschirm soll die Frage in den Mittelpunkt stellen, die Hauptaktion immer in der Daumenzone halten und die Auflösung konkret benennen. Darunter bekommt die Oberfläche ein Designsystem, das lesbaren Kontrast in allen Themen garantiert und die zwei Register „ruhig" und „verspielt" technisch trennt.

## Umfang

1. Neuer Aufbau der Lernrunde in `session()` für Frage, Auflösung und Pause.
2. Die Prüfungssimulation übernimmt die neue Leiste und das angedockte Hauptfeld, sonst unverändert.
3. Neues Token-System in `style.css` mit einer Schicht, vier Farbthemen, hell und dunkel.
4. Registerattribut `data-register` am App-Container.
5. Neuer Node-Test für Kontrast.
6. Neue Referenzbilder im Screenshot-Netz.

## Nicht enthalten

* Prüfungsnavigation mit Fragenraster, Markieren und Rücksprung. Eigenes Spec.
* Aufteilen von `app.js` in Module.
* Änderungen an Bewertung, Wiederholungslogik oder `core.js`.
* Neue Farben, neues Logo, Webschriften.
* Umbau von Start, Pfad und Fortschritt über das Token-System hinaus. Diese Bildschirme bekommen die neuen Tokens, aber kein neues Layout.

## Befund, auf dem das Design beruht

Gemessen am Stand `06ead96` mit dem Screenshot-Netz und `getComputedStyle`.

* Nach falscher Antwort liegt „Nächste Frage" unterhalb des sichtbaren Bereichs von 390 × 844.
* Eine falsch gewählte Antwort bekommt einen grünen Rahmen mit rotem Unterstrich. Nach der Auflösung werden alle Antworttexte blass.
* Der Satz „Alle richtigen Antworten müssen ausgewählt sein" erscheint auch bei richtiger Antwort.
* Die Gemini-Karte steht zwischen Urteil und „Pause machen", auch ohne hinterlegten Schlüssel.
* Hauptknopf hell: weiß auf `#159a5b`, 3,62 : 1. Hauptknopf dunkel: weiß auf `#55d596`, 1,85 : 1. Grautext 11 px: etwa 4,1 : 1.
* `style.css`: 125 verschiedene Hex-Farben, 24 Schriftgrößen von 8 bis 72 px, 16 Eckenradien. `:root` zweimal definiert, Dunkelmodus über `body.dark` und `.dark`, `--purple` ist in jedem Thema gleich dem Akzent, `--radius:22px` ist wirkungslos.

## Abschnitt 1 · Lernrunde

### Leiste oben

Während `route === 'session'` ist der Markenkopf aus `index.html` ausgeblendet. `render()` setzt dafür `document.body.classList.toggle('in-session', route === 'session')`, CSS blendet `body.in-session > header` aus.

Die bisherigen zwei Zeilen und der Fortschrittsbalken werden durch eine Leiste ersetzt:

| Element | Lernrunde | Prüfung |
|---|---|---|
| Links | Knopf ✕, `data-action="abort"`, `aria-label="Einheit beenden"` | gleich |
| Zähler | `2 / 21` | `Grundwissen · 1 / 20` |
| Mitte | `<progress>` | gleich |
| Rechts | Zeitknopf mit Pause-Symbol, `data-action="pause"`, `aria-label="Pause"` | Countdown ohne Knopf |

Der bestehende Takt ersetzt alle 500 ms `textContent` von `#timer`. `id="timer"` sitzt deshalb auf einem inneren `<span>` nur mit der Zeit, das Pause-Symbol daneben im selben Knopf. Für ✕ kommt das Lucide-Symbol `x` in `icons.js` dazu; heute gibt es nur `circle-x`.

### Meta-Zeile

Unter der Leiste: Themenpfad und Punkte, rechts ein Lesezeichen-Symbolknopf mit `data-action="bookmark"`, `aria-label="Frage merken"` und `aria-pressed`. Die Fragennummer `#1052` entfällt aus der sichtbaren Zeile. `ZUSATZFRAGE` bleibt bei Prüfungen sichtbar.

### Antworten

Jede Antwort trägt einen Buchstaben `A`, `B`, `C` … aus `String.fromCharCode(65 + i)` statt eines leeren Kästchens. Ausgewählt: Buchstabenfeld gefüllt in Akzentfarbe. Der Hinweis lautet „Mehrere Antworten können richtig sein."

Nach der Auflösung genau drei Zustände, Texte bleiben voll deckend:

| Richtig | Gewählt | Darstellung | Kennzeichnung |
|---|---|---|---|
| ja | ja | grün | „Richtig" |
| ja | nein | grün | „Richtig · übersehen" |
| nein | ja | rot | „Falsch gewählt" |
| nein | nein | neutral | keine |

### Angedocktes Feld unten

Ein Container mit `position: sticky; bottom: 0`, Abstand nach unten mindestens `env(safe-area-inset-bottom)`. Er enthält:

* **Vor dem Prüfen:** Hauptknopf. Ohne Auswahl grau, deaktiviert, Beschriftung „Antwort auswählen". Mit Auswahl „Antwort prüfen", bei Prüfungen „Antwort abgeben →".
* **Nach dem Prüfen, richtig:** „Richtig." mit dem Hinweis „+10 XP", darunter „Nächste Frage →" oder „Lernrunde abschließen".
* **Nach dem Prüfen, falsch:** „Noch nicht ganz." und ein Satz nach den Regeln unten, darunter derselbe Knopf.

Satzregeln. `R` sind die übersehenen richtigen Buchstaben, `F` die falsch gewählten. Mehrere Buchstaben werden mit „, " und vor dem letzten mit „ und " verbunden.

* `R` und `F` nicht leer: „{R} war richtig, {F} war falsch." Bei mehreren Buchstaben „waren".
* Nur `R`: „{R} war auch richtig." beziehungsweise „waren auch richtig."
* Nur `F`: „{F} war falsch." beziehungsweise „waren falsch."

Der Satz „Alle richtigen Antworten müssen ausgewählt sein" entfällt.

### Gemini

`aiPanel(q)` steht nach der Auflösung in einem aufklappbaren `<details>` mit der Überschrift „Einfach erklärt", unterhalb der Antworten und oberhalb des angedockten Feldes. Standardmäßig zugeklappt. Der Inhalt bleibt unverändert, auch der Einrichtungshinweis ohne Schlüssel.

### Pause

„Pause machen" am Seitenende entfällt, die Pause liegt am Zeitknopf. Die Fußnote „Die aktive Antwortzeit zählt nur, solange du diese Frage bearbeitest." wandert auf den Pausenbildschirm. Die Fußnote der Prüfung „Ergebnisse und Lösungen erscheinen nach dem Abschluss." bleibt unter dem Hauptknopf.

## Abschnitt 2 · Designsystem

### Tokens

Eine einzige `:root`-Definition für das helle Grundschema, eine `body.dark`-Definition für das dunkle. Alle späteren `:root`- und `.dark`-Blöcke entfallen.

| Token | Zweck |
|---|---|
| `--bg`, `--surface` | Hintergrund, Karten |
| `--text`, `--text-muted` | Schrift, Nebentext |
| `--line` | Rahmen, Trennlinien |
| `--accent` | Flächen, Balken, Auswahl |
| `--accent-strong` | Hauptknopf-Fläche, Akzentschrift auf hellem Grund |
| `--accent-soft` | zarte Akzentfläche |
| `--on-accent` | Schrift auf `--accent-strong` |
| `--ok`, `--ok-soft` | Richtig |
| `--bad`, `--bad-soft` | Falsch |
| `--reward` | XP, Serie |

Jedes Farbthema `theme-green`, `theme-blue`, `theme-purple`, `theme-orange` setzt ausschließlich `--accent`, `--accent-strong`, `--accent-soft` und `--on-accent`, jeweils für hell und für `body.dark`. `--purple`, `--accent-dark`, `--accent-light`, `--accent-border`, `--result-bg`, `--soft`, `--green`, `--greenbg`, `--red`, `--redbg`, `--yellow` werden durch die neuen Namen ersetzt. Die Farbtöne der Themen bleiben erkennbar, nur Helligkeit wird angepasst, wo der Kontrast es verlangt.

### Kontrast

Mindestwert 4,5 : 1 für diese Paare, in allen vier Themen, hell und dunkel:

* `--text` auf `--bg` und auf `--surface`
* `--text-muted` auf `--bg` und auf `--surface`
* `--on-accent` auf `--accent-strong`
* `--accent-strong` auf `--surface` und auf `--bg`, weil Textknöpfe direkt auf dem Hintergrund stehen
* `--ok` auf `--ok-soft`, `--bad` auf `--bad-soft`

### Maßstäbe

* Schrift: 12, 14, 16, 18, 22, 28, 56 px. Keine Größe unter 12 px.
* Radius: 8, 12, 20 px und voll rund.
* Abstand: 4, 8, 12, 16, 24, 32 px.
* Schriftfamilie bleibt `system-ui`. Eine Webschrift widerspräche der CSP `style-src 'self'` und dem Offline-Betrieb der APK.
* Zeitangaben verwenden `font-variant-numeric: tabular-nums`.

### Register

`render()` setzt am Element `#app` das Attribut `data-register` auf `calm` für die Routen `session`, sonst auf `playful`.

* **calm:** Radius 12, Rahmen 1,5 px, keine Blockschatten, keine Verläufe, keine Bewegung außer dem XP-Hinweis.
* **playful:** Radius 20, Blockschatten, Verläufe erlaubt, Belohnungsanimationen.

Die Farb-Tokens sind in beiden Registern gleich.

## Tests und Absicherung

* **Kontrasttest** `tests/contrast.test.cjs`. Liest `style.css`, extrahiert die Token-Werte für jedes Thema in hell und dunkel und prüft die Paare aus dem Abschnitt Kontrast gegen 4,5 : 1. Der Test läuft mit `node --test` ohne Abhängigkeiten.
* **Logik der Auflösungssätze** als reine Funktion, damit sie in Node testbar ist, mit Fällen für einen und mehrere Buchstaben in beiden Listen.
* **Bestehende Node-Tests** bleiben grün, 36 von 36.
* **Screenshot-Netz.** Vor der Umstellung Vergleich gegen die bestehende Referenz, danach absichtlich viele Änderungen. Der Bericht wird Bild für Bild angesehen, erst dann `node scripts/ui-baseline.mjs` für die neue Referenz.
* **Android.** Lokal fehlt die Werkzeugkette. `gradle testDebugUnitTest assembleDebug lintDebug` läuft in der CI beim Push. `StartupTest.java` prüft nur Auslieferung und Sperrung von Assets, keine Texte oder Klassen der Lernrunde. Die Umstellung berührt ihn nicht, solange keine neue Asset-Datei hinzukommt — die Whitelist in `MainActivity` kennt genau sieben Dateinamen.

## Abnahmekriterien

* Bei 390 × 844 ist in der Lernrunde der Hauptknopf in jedem Zustand ohne Scrollen sichtbar, auch mit langer Frage und vier Antworten.
* Die Frage beginnt oberhalb von 20 Prozent der Bildschirmhöhe.
* Die Auflösung zeigt die Zustände aus der Tabelle und den Satz nach den Regeln.
* Der Kontrasttest besteht für alle 8 Kombinationen aus Thema und Modus.
* `style.css` enthält genau eine `:root`-Definition und keine `--purple`-Verwendung.
* Node-Tests bestehen.
* Die WebView-Härtung und die CSP in `index.html` sind unverändert.

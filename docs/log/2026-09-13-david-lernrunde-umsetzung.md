# 2026-09-13 · David · Lernrunde als Vollbild und Designsystem

Sitzung mit Claude Code auf dem Branch `redesign/lernrunde-designsystem`. Umgesetzt nach `docs/superpowers/plans/2026-09-13-lernrunde-designsystem.md`, Spec unter `docs/superpowers/specs/2026-09-13-lernrunde-designsystem-design.md`.

## Gemacht

* **Token-Schicht.** `style.css` hat nur noch eine `:root`-Definition und eine `body.dark`-Definition. Die Tokens heißen `--bg --surface --text --text-muted --line --accent --accent-strong --accent-soft --on-accent --ok --ok-soft --bad --bad-soft --reward --radius`. Die vier Farbthemen setzen nur noch `--accent`, `--accent-strong` und `--accent-soft`. Entfernt: `--muted --soft --green --greenbg --red --redbg --yellow --accent-dark --purple --accent-light --accent-border --result-bg`, die zweite `:root`-Definition und `.dark`.
* **Hauptknöpfe** nutzen `--accent-strong` als Fläche und `--on-accent` als Schrift. Im Dunkelmodus ist die Schrift dadurch fast schwarz statt weiß.
* **Lernrunde neu.** Markenkopf während der Einheit ausgeblendet. Leiste oben mit ✕, Zähler, Fortschritt und Zeitknopf, der zugleich pausiert. Antworten mit Buchstaben A, B, C. Nach dem Prüfen die Kennzeichnungen „Richtig", „Richtig · übersehen" und „Falsch gewählt" sowie ein Satz wie „A war richtig, B war falsch." Urteil und Hauptknopf in einem angedockten Feld unten. Gemini-Karte eingeklappt unter „Einfach erklärt". Fußnote zur aktiven Antwortzeit auf den Pausenbildschirm verschoben.
* **Register.** `render()` setzt `data-register="calm"` für die Lernrunde, sonst `playful`, und die Klasse `in-session` am `body`.
* **Neue Funktionen** in `app.js`: `answerLetters`, `answerTag`, `resolutionText`. Neues Symbol `x` in `icons.js`.
* **Tests.** Neu `tests/contrast.test.cjs` mit Kontrastprüfung und Registerregeln, dazu vier neue Tests in `tests/controller.test.cjs`. Der Element-Stub im Test-Setup hat `dataset:{}` bekommen.
* **Referenzbilder** unter `tests/ui-baseline/` neu geschrieben. Weiterhin nicht committet.
* `AGENTS.md`: Registerregel, Tokennamen und die neue Testzahl ergänzt.

## Verifiziert

* **Kontrasttest vor der Umstellung:** `ℹ fail 9` – zwei `:root`-Blöcke gefunden, `--text-muted` fehlte in allen acht Kombinationen.
* **Nach der Token-Umstellung:** Kontrast-, Kern-, Cloud- und Web-Tests `ℹ pass 25`, `ℹ fail 0`. Der Bildvergleich meldete alle 70 Bilder als geändert, Stichproben angesehen: Farbthemen unterscheidbar, Knopf im Dunkelmodus mit dunkler Schrift.
* **Neue Controller-Tests vor der Umsetzung:** `ℹ fail 1` mit `ReferenceError: resolutionText is not defined`, danach `ℹ fail 3` für die Markup-Tests.
* **Nach Umsetzung aller Tasks:** `node --test tests/*.test.cjs` ergibt `ℹ tests 50`, `ℹ pass 50`, `ℹ fail 0`.
* **Abnahmekriterien gemessen** mit Playwright, lange Frage und vier umbrechende Antworten, hell und dunkel, in den Zuständen Frage, Auswahl und falsche Auflösung: sechsmal `OK`, Hauptknopf jeweils bei `knopfOben 780`, `knopfUnten 832` innerhalb von 844 px, Frage beginnt bei `frageOben 128` und damit unter der Grenze von 169 px.
* **Neue Referenz stabil:** `70 Referenzbilder in tests/ui-baseline geschrieben.`, direkt danach `Unverändert: 70`.
* Android-Werkzeugkette weiterhin **nicht** lokal vorhanden, `gradle` wurde nicht ausgeführt. `StartupTest.java` prüft nur die Auslieferung von Assets; es kam keine neue Asset-Datei hinzu.

## Entschieden

* **Abweichung vom Plan: Registerregeln mit ID.** Der Plan sah `[data-register="calm"] .answer` vor. Im Bild behielten richtige und falsche Antworten trotzdem ihren Blockschatten, weil `.answer.correct` und `.answer.wrong` aus dem verspielten Stil später in der Datei stehen und bei gleicher Spezifität gewinnen. Die Regeln lauten jetzt `#app[data-register="calm"] …`, Test und `AGENTS.md` sind angepasst.
* **Abweichung vom Plan: Feld unten am Bildschirmrand.** Mit `position: sticky` allein blieb das angedockte Feld bei kurzer Frage mitten auf dem Bildschirm stehen. Die Lernrunde ist jetzt eine Flex-Spalte mit `min-height: 100dvh`, das Feld hat `margin-top: auto`.
* **Kontrastgrenze verschärft:** `--accent-strong` muss 4,5 : 1 auch auf `--bg` erreichen, nicht nur auf `--surface`, weil Textknöpfe direkt auf dem Hintergrund stehen. Spec entsprechend ergänzt.
* **Fragennummer** wie `#1052` aus der sichtbaren Lernrunde entfernt. Sie steht weiterhin im Verlauf.

## Offen

* **Nicht gepusht.** Neun Commits liegen lokal auf `redesign/lernrunde-designsystem`, von `b8e1841` bis zu diesem Protokoll. Push und Pull Request nur nach Absprache.
* **Android-Build** in der CI prüfen, sobald gepusht wird: `gradle testDebugUnitTest assembleDebug lintDebug`.
* **Referenzbilder committen oder nicht** – weiterhin zwischen Paul und David offen.
* **`color-mix()`** im Blockschatten des Hauptknopfs setzt eine aktuelle Android System WebView voraus. Auf einem echten Gerät mit älterer WebView prüfen; fehlt die Unterstützung, entfällt nur der Schatten.
* **Nicht Teil dieser Umsetzung:** Prüfungsnavigation mit Fragenraster, Aufteilen von `app.js`, Umbau von Start, Pfad und Fortschritt. Die restlichen 125 fest eingetragenen Hex-Farben in `style.css` außerhalb der Tokens sind nicht bereinigt.

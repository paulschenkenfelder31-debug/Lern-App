# 2026-09-10 · David · Umgebung eingerichtet, Designrichtung festgelegt

Erster Eintrag in diesem Protokoll. Sitzung mit Claude Code, lokal unter Windows 11.

## Gemacht

* Repository frisch geklont, Stand `06ead96 Fix first-time Firestore sync` auf `main`.
* `firebase-tools` global installiert und angemeldet, damit der Firebase-MCP-Server lokal ohne Dienstkonto läuft.
* Zwei MCP-Server eingerichtet: GitHub über den HTTP-Endpunkt mit dem Token der GitHub-CLI, Firebase über `firebase mcp` mit `GOOGLE_CLOUD_PROJECT=fahrklar-4c32c`.
* `AGENTS.md` und `CLAUDE.md` angelegt. `AGENTS.md` enthält Ziele, harte Regeln, Stil, Rechte und Ablage; `CLAUDE.md` verweist nur darauf. Grund: Codex und Claude Code lesen unterschiedliche Dateinamen, die Regeln sollen aber nur an einer Stelle gepflegt werden.
* `.superpowers/` in `.gitignore` eingetragen. Dort liegen lokale Entwurfsdateien der Brainstorming-Sitzung, die nicht ins öffentliche Repository gehören.
* Dieses Protokoll und sein Format eingeführt, beschrieben in `AGENTS.md`.

## Verifiziert

* `node --test tests/*.test.cjs` – 36 von 36 bestanden, 261 ms.
* `firebase login:list` – angemeldet als `daveghg03@gmail.com`.
* `firebase projects:list` – Projekt `fahrklar-4c32c`, Nummer `553567497097` sichtbar.
* Beide MCP-Server melden `Connected`.
* Android-Werkzeugkette in dieser Sitzung **nicht** geprüft. Die Zahlen aus der Übergabe – 24 Testausführungen, Lint ohne Fehler mit sechs Warnungen – stammen aus der vorherigen Sitzung und wurden hier nicht nachgestellt.

## Entschieden

* **Designrichtung: zwei Register in einem Designsystem.** Motivierend für Start, Lernpfad und Fortschritt, nüchtern für Lernrunde und Prüfungssimulation. Begründung: die beiden Bildschirmarten haben unterschiedliche Aufgaben, tragen heute aber dieselbe Verpackung. Details in `AGENTS.md`.
* **Arbeitsprotokoll als Ordner, nicht als eine gemeinsame Datei.** Eine Datei pro Sitzung schließt Merge-Konflikte aus, wenn beide Mitarbeiter gleichzeitig mit unterschiedlichen KI-Werkzeugen arbeiten.
* **Referenzbilder vor dem Redesign.** Bevor Layout geändert wird, entsteht ein Playwright-Netz mit Bildern aller Bildschirme in hell und dunkel. Ohne Netz fällt nicht auf, wenn eine CSS-Änderung andere Bildschirme mitverschiebt.

## Offen

* **Kompromittierter Dienstkontoschlüssel.** Der Schlüssel des Dienstkontos `claude-fahrklar` ist in einem früheren Chatverlauf gelandet und muss in der Google Cloud Console gelöscht werden. Lokal wird er nicht gebraucht, der MCP-Server läuft über den normalen Anmeldevorgang.
* **Release-Keystore.** Weiterhin nur eine Debug-Testversion in der Pipeline. Braucht Pauls `admin`-Rechte für die GitHub-Secrets.
* **Fragenkatalog.** Rechtlich unverändert offen.
* **Nächster Arbeitsschritt.** Playwright-Netz aufsetzen, danach Designsystem in `style.css` beschreiben, danach Bildschirm für Bildschirm umbauen, beginnend mit der Lernrunde.
* **Ob per Pull Request oder direkt auf einem Branch gearbeitet wird**, ist zwischen Paul und David noch nicht abgesprochen.

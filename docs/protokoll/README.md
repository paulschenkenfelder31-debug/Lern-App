# Arbeitsprotokoll

Codex und Claude führen getrennte, append-only Protokolldateien. Dadurch bearbeiten beide Werkzeuge nie denselben Block und Git-Konflikte werden vermieden.

## Dateien

- `docs/protokoll/YYYY-MM-DD-codex.md` – Einträge von Codex
- `docs/protokoll/YYYY-MM-DD-claude.md` – Einträge von Claude Code
- Bei mehreren Einträgen am selben Tag werden sie in derselben Datei untereinander angehängt.
- Bestehende Einträge werden nicht umformuliert oder gelöscht.

## Feste Form pro Eintrag

Jeder Eintrag muss genau diese Felder enthalten:

```md
## Datum: YYYY-MM-DD
- Wer:
- Was geändert:
- Was verifiziert (mit Ausgabe):
- Was offen:
- Entscheidung:
- Warum:
```

Der verifizierte Teil muss die konkrete Ausgabe oder den CI-Link nennen. Wenn ein Test nicht ausgeführt wurde, steht ausdrücklich „nicht ausgeführt“ mit dem Grund. Behauptungen ohne Verifizierung gehören unter „Was offen“, nicht unter „Was verifiziert“.

## Übergabe an das andere Werkzeug

Vor jeder Änderung den letzten Eintrag beider Werkzeuge lesen. Offene Punkte übernehmen oder im eigenen Eintrag ausdrücklich begründen, warum sie unverändert bleiben. Bei widersprüchlichen Entscheidungen nicht raten: in der nächsten Nutzerantwort nachfragen.

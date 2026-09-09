# App-Updates dauerhaft einrichten

Die App bietet in den Einstellungen **Nach App-Update suchen**. Sie prüft die neueste veröffentlichte APK deines GitHub-Repositories. Ein Download öffnet GitHub im Browser; Android übernimmt die Installation mit deiner Bestätigung. Es werden keine Lernstatistiken übertragen.

## Einmalig als Repository-Eigentümer

Android erlaubt ein Update mit Erhalt der App-Daten nur mit passender Signatur und höherer Versionsnummer. Die alten Test-APKs haben wechselnde Debug-Schlüssel; deren private Schlüssel wurden nicht gesichert. Die vorhandene Installation lässt sich deshalb nicht einfach auf den neuen Release-Schlüssel umsignieren.

1. In der bisherigen App unter **Einstellungen → Sicherung als JSON exportieren** deinen Lernstand sichern.
2. Auf deinem Computer das Repository öffnen/klonen. Benötigt werden Bash, Java 17 (keytool), OpenSSL und die GitHub CLI. Mit `gh auth login` als Repository-Eigentümer anmelden.
3. Im Repository einmal ausführen:

   ```bash
   bash scripts/setup-signing.sh
   ```

Das Skript erzeugt einen privaten Schlüssel außerhalb des Repositorys in `../fahrklar-signing-private`, setzt die beiden verschlüsselten Actions-Secrets `FAHRKLAR_KEYSTORE_BASE64` und `FAHRKLAR_KEYSTORE_PASSWORD` und startet den Build. Bereits vorhandene Signier-Secrets werden nicht überschrieben. Sichere diesen privaten Ordner dauerhaft; er enthält Schlüssel und Passwort. Niemals in Git committen oder hier im Chat teilen.

Falls das Setzen eines Secrets fehlschlägt: den bereits erzeugten Schlüssel behalten. Die beiden Secrets über die GitHub CLI aus genau diesem Ordner erneut setzen, statt einen neuen Schlüssel zu erzeugen. Für einen manuell bereitgestellten PKCS12-Keystore muss der Alias `fahrklar` heißen und Schlüssel- und Store-Passwort müssen übereinstimmen.

4. Unter **Releases** die **Fahrklar.apk** der neuen **Version** herunterladen. Falls Android beim Wechsel von der Testversion eine Neuinstallation verlangt, zuerst prüfen, dass die Sicherungsdatei vorhanden ist. Nach der Neuinstallation die Sicherung importieren und Fragen/Bilder erneut laden.
5. Ab dann neue **Fahrklar.apk**-Versionen über die bestehende App installieren. App-ID und Signierschlüssel bleiben gleich, die Versionsnummer steigt mit jedem Workflow-Lauf. Lernstand, Verlauf und gespeicherter Katalog bleiben bei normalen Updates erhalten.

## Verhalten des Builds

Ohne Secrets wird weiterhin eine klar gekennzeichnete Test-APK gebaut. Mit vollständigen Secrets wird eine nicht debuggable Release-APK signiert, zusätzlich getestet und geprüft. Unvollständige Secrets brechen den Build ab. Nach Veröffentlichung einer dauerhaften Version verhindert der Workflow einen versehentlichen Rückfall auf eine Testsignatur. Der private Keystore wird nur im temporären Verzeichnis des Runners dekodiert und anschließend gelöscht; er wird weder als Artifact noch als Release-Datei hochgeladen.

Die Einrichtung der Secrets ist hier noch **nicht durchgeführt**: Die in dieser Sitzung verfügbare GitHub-Verbindung bietet keine Secret-Verwaltung. Der Code und das Einrichtungsskript sind vorbereitet.

Quellen: [Android: App-Signierung](https://developer.android.com/studio/publish/app-signing), [GitHub: Secrets verwenden](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

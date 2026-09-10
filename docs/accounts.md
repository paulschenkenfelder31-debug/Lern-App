# Firebase-Konten einrichten

Die App verwendet Firebase Authentication (E-Mail/Passwort) und Cloud Firestore. Analytics wird trotz vorhandener `measurementId` nicht initialisiert.

## Einmalige Schritte in der Firebase Console

1. Unter **Authentication → Sign-in method** E-Mail/Passwort aktivieren.
2. Unter **Authentication → Templates** Absendername und deutsche Texte für Bestätigung und Passwort-Zurücksetzen festlegen.
3. Cloud Firestore im Native Mode in einer europäischen Region erstellen. Die Region lässt sich später nicht ändern.
4. Die Regeln aus `firestore.rules` mit der Firebase CLI veröffentlichen:

   ```sh
   npx firebase-tools login
   npx firebase-tools use fahrklar-4c32c
   npx firebase-tools deploy --only firestore:rules
   ```

5. Unter **Authentication → Settings → Authorized domains** die veröffentlichte Web-Domain hinzufügen.

## Sicherheitsmodell

Nur angemeldete Nutzer mit bestätigter E-Mail dürfen Dokumente unter ihrer eigenen UID lesen oder schreiben. Andere Pfade sind vollständig gesperrt. Der Firebase-Web-API-Key ist eine öffentliche Client-Konfiguration; er ersetzt keine Authentifizierung und verleiht allein keinen Datenzugriff.

Lernrunden werden einzeln gespeichert. Einstellungen und Merkliste haben je ein Dokument. Laufende Einheiten bleiben lokal. Beim ersten Login werden vorhandene lokale Sitzungen angehängt, statt den Cloud-Verlauf zu überschreiben.

Vor dem öffentlichen Start: Regeln im Firebase Emulator mit fremder UID, unbestätigter E-Mail und übergroßen Dokumenten negativ testen; anschließend App Check zunächst beobachten und später mit Play Integrity (Android) sowie reCAPTCHA Enterprise (Web) erzwingen.

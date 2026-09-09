#!/usr/bin/env bash
# Run once by the repository owner. No private key is committed or logged.
set -euo pipefail
umask 077
repo='paulschenkenfelder31-debug/Lern-App'
for tool in gh keytool openssl base64; do
  command -v "$tool" >/dev/null || { echo "Bitte zuerst $tool installieren." >&2; exit 1; }
done
gh auth status >/dev/null
existing="$(gh secret list --repo "$repo" --json name --jq '.[].name')"
if [[ "$existing" == *FAHRKLAR_KEYSTORE* ]]; then
  echo 'Signier-Secrets existieren bereits. Kein neuer Schlüssel erzeugt. Vorhandenen Schlüssel weiterverwenden.' >&2
  exit 1
fi
signing_dir="${1:-../fahrklar-signing-private}"
mkdir -m 700 "$signing_dir"
signing_dir="$(cd "$signing_dir" && pwd)"
openssl rand -hex 32 > "$signing_dir/password.txt"
export FAHRKLAR_KEYSTORE_PASSWORD
FAHRKLAR_KEYSTORE_PASSWORD="$(cat "$signing_dir/password.txt")"
keytool -genkeypair -noprompt -storetype PKCS12 -keystore "$signing_dir/fahrklar.p12" \
  -alias fahrklar -keyalg RSA -keysize 3072 -validity 10000 \
  -storepass:env FAHRKLAR_KEYSTORE_PASSWORD -keypass:env FAHRKLAR_KEYSTORE_PASSWORD \
  -dname 'CN=Fahrklar, O=Fahrklar, C=AT'
# Complete the password first, then activate the matching keystore.
printf '%s' "$FAHRKLAR_KEYSTORE_PASSWORD" | gh secret set FAHRKLAR_KEYSTORE_PASSWORD --repo "$repo"
base64 < "$signing_dir/fahrklar.p12" | tr -d '\n' | gh secret set FAHRKLAR_KEYSTORE_BASE64 --repo "$repo"
unset FAHRKLAR_KEYSTORE_PASSWORD
echo "Privater Schlüssel und Passwort liegen in: $signing_dir"
echo 'Diesen Ordner sicher sichern. Nicht ins Repository hochladen und nicht weitergeben.'
gh workflow run android.yml --repo "$repo" --ref main
echo 'Der erste dauerhaft signierte Build wurde gestartet.'

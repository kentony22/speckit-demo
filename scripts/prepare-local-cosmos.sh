#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
local_dir="$root/.local"
mkdir -p "$local_dir"
umask 077
work_dir="$(mktemp -d "$local_dir/cosmos.XXXXXX")"
trap 'rm -f "$work_dir/cosmos.pem" "$work_dir/cosmos.p12" "$work_dir/keytool.log"; rmdir "$work_dir"' EXIT

for ((attempt = 1; attempt <= 60; attempt++)); do
    if curl --noproxy localhost --max-time 2 -fsS http://localhost:8080/ready >/dev/null 2>&1; then
        break
    fi
    if ((attempt == 60)); then
        printf '%s\n' 'Cosmos DB エミュレーターの準備が完了しませんでした。' >&2
        exit 1
    fi
    sleep 1
done

openssl s_client -connect localhost:8081 -servername localhost </dev/null 2>/dev/null |
    openssl x509 -outform PEM > "$work_dir/cosmos.pem"

java_home="$(java -XshowSettings:properties -version 2>&1 | sed -n 's/^ *java\.home = //p')"
if ! keytool -importkeystore -noprompt -srckeystore "$java_home/lib/security/cacerts" \
    -srcstorepass changeit -destkeystore "$work_dir/cosmos.p12" -deststoretype PKCS12 \
    -deststorepass changeit > "$work_dir/keytool.log" 2>&1; then
    cat "$work_dir/keytool.log" >&2
    exit 1
fi

keytool -importcert -noprompt -alias cosmos-emulator -file "$work_dir/cosmos.pem" \
    -keystore "$work_dir/cosmos.p12" -storetype PKCS12 -storepass changeit >&2
mv "$work_dir/cosmos.p12" "$local_dir/cosmos.p12"
printf '%s\n' "$local_dir/cosmos.p12"

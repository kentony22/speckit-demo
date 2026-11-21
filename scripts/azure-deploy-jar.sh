#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_SUBSCRIPTION_ID:?}" "${AZURE_RESOURCE_GROUP:?}" "${AZURE_WEB_APP:?}"
jar="${1:?JAR path required}"
app_args=(--subscription "$AZURE_SUBSCRIPTION_ID" --resource-group "$AZURE_RESOURCE_GROUP" --name "$AZURE_WEB_APP")
rule="github-deploy-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"

cleanup_scm_rule() {
    local rules
    rules="$(az webapp config access-restriction show "${app_args[@]}" --output json)" || return 1
    if jq -e --arg rule "$rule" 'any(.scmIpSecurityRestrictions[]?; .name == $rule)' <<< "$rules" > /dev/null; then
        az webapp config access-restriction remove "${app_args[@]}" --scm-site true --rule-name "$rule" --output none || return 1
        rules="$(az webapp config access-restriction show "${app_args[@]}" --output json)" || return 1
    fi
    if ! jq -e --arg rule "$rule" '
        .scmIpSecurityRestrictionsUseMain == false and
        .scmIpSecurityRestrictionsDefaultAction == "Deny" and
        (.scmIpSecurityRestrictions | type) == "array" and
        all(.scmIpSecurityRestrictions[]; .name != $rule and .action != "Allow")
    ' <<< "$rules" > /dev/null; then
        echo 'SCM still has an allow rule or its deny-by-default policy could not be confirmed.' >&2
        return 1
    fi
}

if [[ "$jar" == --cleanup ]]; then
    cleanup_scm_rule
    exit
fi

runner_ip="$(curl -4fsS --connect-timeout 10 --max-time 20 https://api.ipify.org)"
python3 - "$runner_ip" <<'PY'
import ipaddress
import sys

address = ipaddress.IPv4Address(sys.argv[1])
if not address.is_global or address.is_multicast:
    sys.exit("Deployment runner has no usable public IPv4 address.")
PY
printf '::add-mask::%s\n' "$runner_ip"

cleanup() {
    local status=$?
    if ! cleanup_scm_rule; then
        echo 'Failed to remove the temporary SCM access rule.' >&2
        return 1
    fi
    return "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
az webapp config access-restriction add "${app_args[@]}" --scm-site true \
    --rule-name "$rule" --priority 100 --action Allow --ip-address "$runner_ip/32" --output none

scm_host="$(az webapp show "${app_args[@]}" --query "enabledHostNames[?contains(@, '.scm.')] | [0]" -o tsv)"
[[ -n "$scm_host" ]]
for ((attempt=1; attempt<=18; attempt++)); do
    status="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "https://$scm_host/api/deployments" || true)"
    if [[ "$status" == 401 || "$status" == 200 ]]; then
        break
    fi
    sleep 5
done
if [[ "$status" != 401 && "$status" != 200 ]]; then
    echo "SCM did not become reachable from the deployment runner (HTTP $status)." >&2
    exit 1
fi

az webapp deploy "${app_args[@]}" --src-path "$jar" --type jar --track-status true --timeout 600000 --output none

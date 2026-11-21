#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_SUBSCRIPTION_ID:?}" "${AZURE_RESOURCE_GROUP:?}" "${AZURE_LOCATION:?}"
: "${AZURE_APP_SERVICE_PLAN:?}" "${AZURE_WEB_APP:?}" "${AZURE_COSMOS_ACCOUNT:?}"
: "${AZURE_VERIFIER_IPV4:?}"

python3 - "$AZURE_VERIFIER_IPV4" <<'PY'
import ipaddress
import sys

try:
    ip = ipaddress.IPv4Address(sys.argv[1])
    if not ip.is_global or ip.is_multicast:
        raise ValueError()
except ValueError:
    sys.exit("Set AZURE_VERIFIER_IPV4 to the verifier's public IPv4 address, without a CIDR suffix.")
PY

group_id="/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$AZURE_RESOURCE_GROUP"
plan_id="$group_id/providers/Microsoft.Web/serverfarms/$AZURE_APP_SERVICE_PLAN"

# Refuse to overwrite an existing plan with unexpected capacity or SKU.
resources="$(az resource list --subscription "$AZURE_SUBSCRIPTION_ID" --resource-group "$AZURE_RESOURCE_GROUP" -o json)"
if jq -e --arg id "$plan_id" 'any(.[]; (.id | ascii_downcase) == ($id | ascii_downcase))' <<< "$resources" > /dev/null; then
    az appservice plan show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_APP_SERVICE_PLAN" -o json |
        jq -e '.sku.name == "F1" and .sku.capacity == 1 and .reserved' > /dev/null
fi

mkdir -p "${RUNNER_TEMP:-/tmp}/todo-azure"
template="${RUNNER_TEMP:-/tmp}/todo-azure/main.json"
preview="${RUNNER_TEMP:-/tmp}/todo-azure/what-if.json"
az bicep build --file infra/main.bicep --outfile "$template"
jq -e '
    def oftype($type): [.resources[] | select(.type == $type)];
    def one($type): oftype($type) | if length == 1 then .[0] else error($type) end;
    (one("Microsoft.Web/serverfarms") | .sku.name == "F1" and .sku.tier == "Free" and .sku.capacity == 1 and .properties.reserved) and
    (one("Microsoft.Web/sites") | .properties.siteConfig.linuxFxVersion == "JAVA|25-java25" and
        .properties.siteConfig.ipSecurityRestrictionsDefaultAction == "Deny" and
        .properties.siteConfig.scmIpSecurityRestrictionsDefaultAction == "Deny") and
    (one("Microsoft.DocumentDB/databaseAccounts") | .properties | .enableFreeTier and .disableLocalAuth and
        .capacity.totalThroughputLimit == 1000 and (.locations | length) == 1 and
        ((.capabilities // []) | length) == 0) and
    (one("Microsoft.DocumentDB/databaseAccounts/sqlDatabases") | .properties | (.options // {}) == {}) and
    (one("Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers") | .properties.options == {"throughput":400}) and
    ((oftype("Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions") | length) == 2) and
    ((oftype("Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments") | length) == 2) and
    ((oftype("Microsoft.Web/sites/basicPublishingCredentialsPolicies") | length) == 2) and
    (.resources | length) == 11
' "$template" > /dev/null

args=(
    --subscription "$AZURE_SUBSCRIPTION_ID"
    --resource-group "$AZURE_RESOURCE_GROUP"
    --template-file "$template"
    --parameters location="$AZURE_LOCATION" appServicePlanName="$AZURE_APP_SERVICE_PLAN"
    webAppName="$AZURE_WEB_APP" cosmosAccountName="$AZURE_COSMOS_ACCOUNT" verifierIpv4="$AZURE_VERIFIER_IPV4"
)
az deployment group validate "${args[@]}" --validation-level Provider --output none
az deployment group what-if "${args[@]}" --validation-level Provider --no-pretty-print -o json > "$preview"
jq -er '
    if .status != "Succeeded" or ((.diagnostics // []) | length) > 0 or
        any(.changes[]; (.changeType | IN("Create", "Modify", "NoChange", "Ignore") | not)) or
        any(.changes[]; .changeType == "Ignore" and ((.unsupportedReason // "") | length) > 0)
    then error("What-if reported unexpected changes or diagnostics")
    else .changes[] | select(.changeType != "Ignore") | [.changeType, .resourceId] | @tsv
    end
' "$preview" > "${preview%.json}.txt"
[[ -s "${preview%.json}.txt" ]]
{
    printf '\n### Azure preflight\n\n'
    printf '%s\n' 'Linux F1 / Java SE 25; Cosmos DB Free Tier, one region, fixed 400 RU/s and account limit 1,000 RU/s.'
    printf '\n%s\n' 'Run the subscription-wide Free Tier check with your Azure user account before deploying.'
    printf '\n```text\n'
    sed -E 's|/subscriptions/[^/]+|/subscriptions/<redacted>|g' "${preview%.json}.txt"
    printf '```\n'
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

if [[ "${1:-preview}" == "deploy" ]]; then
    az deployment group create "${args[@]}" --name "todo-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}" --mode Incremental --output none
fi

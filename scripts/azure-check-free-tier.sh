#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 4 ]]; then
    echo 'Usage: bash scripts/azure-check-free-tier.sh SUBSCRIPTION REGION RESOURCE_GROUP COSMOS_ACCOUNT' >&2
    exit 2
fi

AZURE_SUBSCRIPTION_ID="$(az account show --subscription "$1" --query id -o tsv)"
AZURE_LOCATION="$2"
AZURE_RESOURCE_GROUP="$3"
AZURE_COSMOS_ACCOUNT="$4"

if [[ "$(az account show --subscription "$AZURE_SUBSCRIPTION_ID" --query state -o tsv)" != "Enabled" ]]; then
    echo 'The deployment subscription is not Enabled.' >&2
    exit 1
fi

expected_cosmos_id="/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$AZURE_RESOURCE_GROUP/providers/Microsoft.DocumentDB/databaseAccounts/$AZURE_COSMOS_ACCOUNT"

# Query the entire subscription because Cosmos DB's free-tier slot is subscription-wide.
accounts="$(az cosmosdb list --subscription "$AZURE_SUBSCRIPTION_ID" -o json)"
if ! jq -e --arg target "$expected_cosmos_id" '
    def is_target: (.id | ascii_downcase) == ($target | ascii_downcase);
    (type == "array") and all(.[]; (.enableFreeTier | type) == "boolean" and
        (if is_target then .enableFreeTier else (.enableFreeTier | not) end))
' <<< "$accounts" > /dev/null; then
    echo 'Cannot confirm the Cosmos DB Free Tier slot or the target account already exists without Free Tier.' >&2
    exit 1
fi

if ! az appservice list-locations --subscription "$AZURE_SUBSCRIPTION_ID" --sku F1 --linux-workers-enabled -o json |
    jq -e --arg location "$AZURE_LOCATION" 'any(.[]; (.name | ascii_downcase | gsub(" "; "")) == $location)' > /dev/null; then
    echo 'Linux F1 is not listed in the deployment region.' >&2
    exit 1
fi

if ! az webapp list-runtimes --subscription "$AZURE_SUBSCRIPTION_ID" --os linux --runtime java -o json |
    jq -e 'any(.[]; .config == "JAVA:25-java25" and .support == "Active")' > /dev/null; then
    echo 'Java SE 25 is not listed as Active for Linux.' >&2
    exit 1
fi

echo 'Cosmos DB Free Tier slot, Linux F1 region and active Java SE 25 runtime verified.'

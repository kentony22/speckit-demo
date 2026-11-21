# To Do

個人向けのタスク登録デモ。画面下部にタスク名を入力し、Enter を押すと Cosmos DB に保存する。
登録したタスクはページを再読み込みしても一覧に残る。

## ローカル起動

必要なツールは Node.js 26.13.1、npm 11.20.0、JDK 25、Docker Compose、curl、OpenSSL。
バックエンドは Spring Boot 4.2.0。ビルドには Maven Wrapper を使う。

### 1. エミュレーター

Docker を起動し、リポジトリルートで次のコマンドを実行する。

```bash
docker compose up -d
./scripts/prepare-local-cosmos.sh
```

接続先は `https://localhost:8081`（HTTPS Gateway モード）。Java 用のトラストストアは
`.local/cosmos.p12` に保存される。コンテナーの再起動後に SSL エラーが出た場合は、
`./scripts/prepare-local-cosmos.sh` を再実行してからバックエンドを再起動する。

### 2. バックエンド

別のターミナルでリポジトリルートから Spring Boot を起動する。

```bash
cd backend
JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=\"$PWD/../.local/cosmos.p12\" -Djavax.net.ssl.trustStorePassword=changeit" \
    ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

### 3. フロントエンド

別のターミナルでリポジトリルートから Vite を起動し、ブラウザーで
[http://127.0.0.1:5173/](http://127.0.0.1:5173/) を開く。

```bash
cd frontend
npm ci
npm run dev
```

Vite は `/api/tasks` をポート8082の Spring Boot に転送する。
初回起動時に `task-notebook` DB と `tasks` コンテナー（パーティションキーは `/ownerId`）を作成する。
データは Compose ボリュームに保持される。

### 停止

バックエンドとフロントエンドのターミナルで Ctrl+C を押す。
エミュレーターはリポジトリルートで `docker compose stop` を実行して停止する。

## テスト

- フロントエンドの型チェックとビルドは `frontend` で `npm run build`。
- REST テストのみ実行する場合は `backend` で `./mvnw test`。エミュレーターの起動は不要。

Cosmos DB の結合テストも実行する場合は、エミュレーターを起動して証明書を準備し、
`backend` で次のコマンドを実行する。結合テストは実行ごとに別の所有者 ID を使う。

```bash
JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=\"$PWD/../.local/cosmos.p12\" -Djavax.net.ssl.trustStorePassword=changeit" \
    ./mvnw verify
```

### ブラウザーでの確認

空の状態から確認し直す場合は、バックエンド起動時に `TODO_OWNER_ID=acceptance-1` のように
未使用の所有者 ID を指定する。普段の一覧から分離した状態で確認できる。

| 条件 | 操作と期待結果 |
| --- | --- |
| AC-001 / SC-001 | 空の一覧を開くと「タスクはまだありません。」と表示される。 |
| AC-002 / SC-002 | 「牛乳を買う」と入力して Enter を押すと、画面遷移せず一覧に1件表示される。 |
| AC-003 / SC-003 | 異なる名前を合計3件登録してページを再読み込みすると、各タスクが1件ずつ表示される。 |
| AC-004 | 空欄、半角スペースのみ、全角スペースのみでそれぞれ Enter を押しても登録リクエストは送られず、エラー表示も一覧件数の変化もない。 |
| AC-005 | 一覧が表示された状態で、接続先のエミュレーターが停止しているときに登録を試すと、登録失敗が表示され、入力内容と件数は維持される。 |

### フェーズ1の検証結果

2026-11-21 にローカルのエミュレーターで検証。

- `npm run build` は型チェックとビルドに成功。
- `./mvnw verify` は REST テスト10件と Cosmos DB 結合テスト1件に成功。
- Chrome で AC-001〜AC-005 と SC-001〜SC-003 を確認。エミュレーター停止時は
  API が `503` を返し、画面でエラー表示、入力内容と一覧件数の維持を確認。

## GitHub Actions CI

`main` 向けの PR で [CI ワークフロー](.github/workflows/ci.yml) が動く。
PR の **Checks** タブで次の2つのジョブの結果を確認する。

- **Frontend build** — `frontend/.node-version` の Node.js を使用し、
  `npm ci` でロックファイルどおりに依存関係を入れ、`npm run build` を実行する。
- **Backend tests** — JDK 25 でローカルと同じ Compose 設定から Cosmos DB vNext エミュレーターを起動し、
  Java 用の証明書を準備して `./mvnw -B -ntp verify` を実行する。REST テストと Cosmos DB 結合テストが対象。

エミュレーターはジョブ専用のランナー内で動く。Azure の接続情報は不要。

## Azure の Bicep 定義

[infra/main.bicep](infra/main.bicep) をリポジトリルートからコンパイルする。

```bash
az bicep build --file infra/main.bicep --stdout
```

`location`、`appServicePlanName`、`webAppName`、`cosmosAccountName` は配備時に指定する。
Cosmos DB の `cosmosDatabaseName` と `cosmosContainerName` の既定値は `task-notebook` と `tasks`。

リソース作成前に、対象サブスクリプションとリージョンで Linux F1・Java SE 25 と Cosmos DB 無料枠の利用可否を確認する。
検証端末のパブリック IPv4 を `verifierIpv4` に指定する。Azure の画面と API はこの IP の `/32`
だけを許可する。デモでは合成データを使う。SCM は別の制限を持ち、配備中だけ Actions ランナーの
IP を一時許可する。SCM と FTP の基本認証は無効。

### T015 — 配備先と無料枠

| 設定 | 値 |
| --- | --- |
| サブスクリプション | `Azure-Learning-Lab`（`Enabled`） |
| リージョン | Japan West（`japanwest`） |
| リソースグループ | `rg-todo-demo-jpw` |
| App Service プラン | `asp-todo-learning-lab-jpw` |
| Web App | `app-todo-learning-lab-jpw` |
| Cosmos DB アカウント | `cosmos-todo-learning-lab-jpw` |
| Cosmos DB の DB・コンテナー | `task-notebook`・`tasks` |

2026-11-21 に `Azure-Learning-Lab` を明示して以下を確認した。

- `az appservice list-locations --sku F1 --linux-workers-enabled` の一覧に Japan West があり、
  `az webapp list-runtimes --os linux --runtime java` で `JAVA:25-java25` が `Active`。
- `Microsoft.Web` と `Microsoft.DocumentDB` は `Registered`。Japan West の App Service クォータ API は
  リージョン合計で使用0・上限30を返した。F1 個別の数値は一覧になく、App Service の検証 API で
  Linux F1 を1インスタンス指定した結果は `Success`。
- `az cosmosdb list` はアカウント0件。既存の Free Tier アカウントはなく、Japan West は
  `Microsoft.DocumentDB` の `databaseAccounts` の対応リージョン一覧に掲載されている。
- App Service の名前確認 API で Web App 名は利用可能、`az cosmosdb check-name-exists` で
  Cosmos DB のアカウント名は未使用。リソースグループは未作成。
- 計画の固定400 RU/s（1リージョン）は無料枠の1,000 RU/s以内。短いタスク名を使うデモとして
  1,000件を各1 KiBと仮定するとドキュメント本体は約1 MiB。インデックスを含む保存量は
  無料枠の25 GB以内で管理する。[Cosmos DB Free Tier](https://learn.microsoft.com/ja-jp/azure/cosmos-db/free-tier)

Japan East は構成全体の ARM 事前検証で F1 が `SubscriptionIsOverQuotaForSku`（上限0・必要1）となった。
Japan West は採用する名前で、Linux F1・Java SE 25・Cosmos DB Free Tier を含む構成全体の
`az deployment sub validate --validation-level ProviderNoRbac` が `Succeeded`。ARM what-if には
予定どおりリソースグループと5リソースの作成が表示された。確認時にリソースは作成していない。

### Azure 配備と確認

GitHub Environment `azure-learning-lab` は `main` のみに許可する。Entra アプリのフェデレーション対象は
`repo:kentony22/speckit-demo:environment:azure-learning-lab`。環境変数として `AZURE_CLIENT_ID`、
`AZURE_TENANT_ID`、`AZURE_SUBSCRIPTION_ID` を、環境シークレットとして `AZURE_VERIFIER_IPV4` を設定する。
配備 ID の Contributor 権限は `rg-todo-demo-jpw` に限る。無料枠の確認にはサブスクリプションの参照権限も使う。
Web App のシステム割り当てマネージド ID には、Cosmos DB のアカウントメタデータ参照と、`tasks` の読み取り・登録に必要なデータ権限を付与する。

1. `Azure deployment` を `main` の `preview` モードで実行し、Summary のリソース差分と無料枠設定を確認する。
2. 同じコミットで `deploy` モードを実行し、確認済み `preview` の実行 ID を指定する。
   ワークフローは無料枠と差分を再検証し、`npm ci`、`npm run build`、Maven の `-Pbundled-web verify` で作った JAR を配備する。
3. Summary の URL を許可した IP のブラウザーで開き、タスクを1件登録してから再読み込みし、登録内容を確認する。
   Actions ランナーからは画面と API の両方が HTTP 403 になることを確認する。

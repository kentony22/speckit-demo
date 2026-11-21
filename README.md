# To Do

個人向けのタスク登録デモです。画面下部の入力欄でタスク名を入力して Enter を押すと、Cosmos DB に保存され、
ページを再読み込みしても一覧で確認できます。

## ローカル起動

Node.js 26.13.1、npm 11.20.0、JDK 25、Docker Compose、curl、OpenSSL を使用します。
バックエンドは Maven Wrapper と Spring Boot 4.2.0 を使用します。Docker を起動してから、
リポジトリルートでエミュレーターを起動し、Java 用の証明書を準備します。

```bash
docker compose up -d
./scripts/prepare-local-cosmos.sh
```

エミュレーターは HTTPS の Gateway モードで `https://localhost:8081` に公開されます。
証明書は `.local/cosmos.p12` に保存されます。コンテナーの再起動後に SSL エラーが出た場合は
証明書の準備コマンドを再実行し、バックエンドを再起動してください。

別のターミナルでバックエンドを起動します。

```bash
cd backend
JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=\"$PWD/../.local/cosmos.p12\" -Djavax.net.ssl.trustStorePassword=changeit" \
    ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

もう1つのターミナルでフロントエンドを起動し、ブラウザーで
[http://127.0.0.1:5173/](http://127.0.0.1:5173/) を開きます。

```bash
cd frontend
npm ci
npm run dev
```

Spring Boot はポート8082で実行され、Vite が `/api/tasks` を転送します。
初回起動時に `task-notebook` DB とパーティションキーが `/ownerId` の
`tasks` コンテナーが作成されます。データは Compose ボリュームに保持されます。

## テスト

`frontend` で `npm run build` を実行し、型チェックとビルドを確認します。
`backend` で `./mvnw test` を実行すると、エミュレーターなしで REST テストを実行できます。
エミュレーターを起動し、証明書を準備した状態で `backend` から次のコマンドを実行すると、
追加で実際の Cosmos DB vNext を使った結合テストを実行します。
結合テストは実行ごとに独立した所有者 ID を使用します。

```bash
JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=\"$PWD/../.local/cosmos.p12\" -Djavax.net.ssl.trustStorePassword=changeit" \
    ./mvnw verify
```

### ブラウザーでの確認

空の状態から確認し直す場合は、バックエンド起動時に `TODO_OWNER_ID=acceptance-1` のように
未使用の所有者 ID を指定すると、通常のタスクを保持したまま別の一覧を使えます。

| 条件 | 操作と期待結果 |
| --- | --- |
| AC-001 / SC-001 | 空の一覧を開くと「タスクはまだありません。」と表示される。 |
| AC-002 / SC-002 | 「牛乳を買う」と入力して Enter を押すと、画面遷移せず一覧に1件表示される。 |
| AC-003 / SC-003 | 異なる名前を合計3件登録してページを再読み込みすると、各タスクが1件ずつ表示される。 |
| AC-004 | 空欄、半角スペースのみ、全角スペースのみでそれぞれ Enter を押しても登録リクエストは送られず、エラー表示も一覧件数の変化もない。 |
| AC-005 | 一覧が表示された状態で、接続先のエミュレーターが停止しているときに登録を試すと、登録失敗が表示され、入力内容と件数は維持される。 |

### フェーズ1の検証結果

2026-11-21 に、ローカルの実エミュレーターを使って検証しました。

- `npm run build` は型チェックとビルドに成功。
- `./mvnw verify` は REST テスト10件と Cosmos DB 結合テスト1件に成功。
- Chrome で AC-001〜AC-005 と SC-001〜SC-003 を確認。エミュレーター停止時は
  API が `503` を返し、画面でエラー表示、入力内容と一覧件数の維持を確認。

停止するには、アプリの各ターミナルで Ctrl+C を押し、リポジトリルートで
`docker compose stop` を実行します。

## GitHub Actions CI

`main` 向けのプルリクエストでは [CI ワークフロー](.github/workflows/ci.yml) が実行されます。
PR の **Checks** タブで次の2つのジョブが成功していることを確認します。

- **Frontend build** — `frontend/.node-version` の Node.js を使用し、
  `npm ci` でロックファイルどおりに依存関係をインストールしてから `npm run build` を実行します。
- **Backend tests** — JDK 25 でローカルと同じ Compose 設定から Cosmos DB vNext エミュレーターを起動し、
  Java 用の証明書を準備して `./mvnw -B -ntp verify` を実行します。REST テストと Cosmos DB 結合テストが対象です。

エミュレーターはジョブごとのランナー内で動きます。GitHub に Azure の接続情報を設定する必要はありません。

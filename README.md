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

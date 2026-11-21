# Quickstart: タスクの削除 確認手順

前提条件・ローカル起動手順は [README.md](../../README.md) を参照する。API 契約は [contracts/task-delete.md](contracts/task-delete.md)、データ条件は [data-model.md](data-model.md) を参照する。

## 1. 自動テストとビルド

```bash
# フロントエンドの検索テスト・型チェック・ビルド
cd frontend && npm test && npm run build

# バックエンドの単体テストおよび Cosmos DB vNext エミュレーター結合テスト
docker compose up -d
./scripts/prepare-local-cosmos.sh
cd backend
JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=\"$PWD/../.local/cosmos.p12\" -Djavax.net.ssl.trustStorePassword=changeit" \
    ./mvnw -B -ntp verify

# Bicep 検証
az bicep build --file infra/main.bicep --stdout > /dev/null
az bicep lint --file infra/main.bicep
```

## 2. ブラウザーでの受け入れ確認

専用所有者 ID（例: `TODO_OWNER_ID=delete-check-1`）でアプリを起動し、カスタムリスト1件とタスク2件（1件は重要・完了・リスト所属あり）を用意して確認する。

| 条件 | 操作 | 期待結果 |
| --- | --- | --- |
| AC-003 | 1件目をクリックして詳細パネルを開き、下部のゴミ箱アイコンから確認表示を開いて「キャンセル」を押す | 確認表示が閉じ、リクエストは送られず2件とも残る |
| AC-001 / SC-001 | 1件目の詳細パネル下部からゴミ箱アイコン →「削除する」を押す | 選んだ1件だけが消え、もう1件の状態とカスタムリストは維持される |
| AC-002 / SC-001 | ページを再読み込みする | 削除したタスクは再表示されず、残り1件だけが表示される |
| AC-004 / SC-003 | 「重要」ビュー、カスタムリスト、検索結果の各画面で表示中のタスクを削除確定する | 現在のビュー・検索語を維持したまま該当タスクだけが消え、0件になれば各画面の空メッセージが表示される |
| AC-005 | 削除 API が `503` を返す状態で「削除する」を押し、復旧後に再度「削除する」を押す | 失敗時はエラーが表示されタスクが一覧に残り、再試行で削除が完了する |

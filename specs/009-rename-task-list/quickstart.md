# Quickstart: カスタムリスト名の編集 確認手順

前提条件・ローカル起動手順は [README.md](../../README.md) を参照する。API 契約は [contracts/task-list-name.md](contracts/task-list-name.md)、データ条件は [data-model.md](data-model.md) を参照する。

## 1. 自動テストとビルド

```bash
# フロントエンドのテスト・型チェック・ビルド
cd frontend && npm test && npm run build

# バックエンドの単体テストおよび Cosmos DB vNext エミュレーター結合テスト
docker compose up -d
./scripts/prepare-local-cosmos.sh
cd backend
JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=\"$PWD/../.local/cosmos.p12\" -Djavax.net.ssl.trustStorePassword=changeit" \
    ./mvnw -B -ntp verify
```

## 2. ブラウザーでの受け入れ確認

専用所有者 ID（例: `TODO_OWNER_ID=rename-list-1`）でアプリを起動し、グループ1件・カスタムリスト2件・タスク1件（1件目のリストに所属、リストはグループに所属）を用意して確認する。

| 条件 | 操作 | 期待結果 |
| --- | --- | --- |
| AC-001 / SC-001 | 1件目のリストの鉛筆アイコン（またはリスト見出しテキストボックス）から新しい名前を入力して Enter（またはフォーカス外れ）で確定する | 選んだ1件だけの名前が左ナビゲーション・選択中見出し・タスクの所属リスト表示に反映され、グループ所属・タスク所属・もう1件のリストは維持される |
| AC-002 / SC-001 | ページを再読み込みする | 変更後のリスト名が表示され、グループ所属とリスト内のタスクが維持される |
| AC-003 / SC-002 | 編集中に名前を書き換えて Escape キーを押す | 編集が閉じ、元の名前のまま維持される |
| AC-004 / SC-002 | 空欄・半角空白・全角空白でそれぞれ Enter（またはフォーカス外れ）で確定を試みる | 入力エラーが表示され、リクエストは送られず元の名前が維持される |
| AC-005 | `PATCH /api/task-lists/{id}/name` が `503` を返す状態で確定を試し、復旧後に再度 Enter（またはフォーカス外れ）で確定する | 失敗メッセージが表示され入力内容と元の名前が保たれ、再試行で保存が完了する |

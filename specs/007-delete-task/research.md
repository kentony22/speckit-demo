# Research & Design Decisions: タスクの削除

## 1. 削除確認 UI の形式

- **Decision**: 既存の `TaskNameEditor.tsx` と同じインライン展開方式（`TaskDeleteAction.tsx`）で「削除」→「このタスクを削除しますか？」（`削除する` / `キャンセル`）を表示する。
- **Rationale**: `window.confirm()` はブラウザー組み込みダイアログのためテスト自動化・アクセシビリティ・エラー再試行表示（同一行での `role="alert"` 表示）と相性が悪い。インライン確認にすることで、既存の編集フォームと同じ操作感・デザイン・エラー再試行パターンに統一できる。
- **Alternatives considered**:
  - 確認なしで即時削除: 誤操作でタスクを失うリスクが高く、AC-003（確認からのキャンセル）を満たさないため不採用。
  - `window.confirm()` やモーダルダイアログ: エラー発生時にダイアログが閉じて再試行導線が分断されるため不採用。

## 2. HTTP メソッドとステータスコード

- **Decision**: `DELETE /api/tasks/{id}` とし、削除成功時は `204 No Content`（ボディなし）、未存在時は `404 TASK_NOT_FOUND`、Cosmos DB 障害時は `503 TASK_STORAGE_UNAVAILABLE` を返す。
- **Rationale**: 既存の `TaskController` のエラーコード体系（`TASK_NOT_FOUND`、`TASK_STORAGE_UNAVAILABLE`）と整合し、REST の標準的な `DELETE` + `204 No Content` 契約になる。
- **Alternatives considered**:
  - `200 OK` で削除済み JSON を返す: 削除後の不要なペイロード返却を避けるため `204 No Content` を選択。
  - 存在しない ID でも `204` を返す冪等応答: 既存の `PATCH` 系が未存在・別パーティション・リスト ID に対して一貫して `404 TASK_NOT_FOUND` を返しているため、統一性を優先した。

## 3. カスタムリスト文書との混同防止

- **Decision**: `CosmosTaskRepository.delete(String id)` の先頭で `TaskListDocument.isListId(id)` を検査し、リスト文書 ID であれば Cosmos DB を呼ばず `false`（Controller 側で `404 TASK_NOT_FOUND`）を返す。
- **Rationale**: タスク文書とカスタムリスト文書は同じ `tasks` コンテナー・同じ `/ownerId` パーティションに格納されているため、`patchTask` と同じガードを `delete` にも設けることでリスト文書の誤削除を確実に防げる。
- **Alternatives considered**:
  - 事前に `readItem` して `kind` を確認してから `deleteItem`: 1回余分な RU と往復が増える。リスト文書 ID は常に `list-` プレフィックスで作成される既存不変条件（`TaskListDocument.isListId`）を活用する方が一貫かつ低コスト。

## 4. Azure Cosmos DB データプレーン権限

- **Decision**: `infra/main.bicep` の既存 `tasksRole`（`To Do Task Read and Create` カスタムロール）の `dataActions` に `Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/delete` を追加する。
- **Rationale**: 現在のロール定義には `items/read`、`items/create`、`items/replace` のみがあり、`deleteItem` 実行時に Azure 環境で 403 になるのを防ぐため。既存リソース名・ロール割り当て・無料枠設定は変更しない。
- **Alternatives considered**:
  - 別ロールを新設する: 不要なロール定義・割り当てリソースを増やさず、既存のタスク用カスタムロールを拡張する 004 の方針と揃えた。

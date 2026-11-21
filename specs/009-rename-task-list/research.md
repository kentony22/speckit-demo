# Research & Design Decisions: カスタムリスト名の編集

## 1. HTTP 契約とエラーコードの一貫性

- **Decision**: `PATCH /api/task-lists/{id}/name` に `{"name":"新しい名前"}` を送り、成功時は `200 OK` で更新済み `ListResponse`（`{id, name, groupId}`）、無効名時は `400 TASK_LIST_NAME_REQUIRED`、対象なし時は `404 TASK_LIST_NOT_FOUND`、障害時は `503 TASK_STORAGE_UNAVAILABLE` を返す。
- **Rationale**: 既存の `PATCH /api/tasks/{id}/name`（003）および `PATCH /api/list-groups/{id}/name`（008）と URL 構造・検証ルール・エラーコード体系を完全に統一できる。
- **Alternatives considered**:
  - `PATCH /api/task-lists/{id}` で `name` と `groupId` を混在させる: 既存が `/group` と `/name` の項目別パッチで責務分離しているため、一貫性を優先した。

## 2. 文書種別の保護と部分更新

- **Decision**: `CosmosTaskRepository.updateListName(id, name)` は先頭で `TaskListDocument.isListId(id)` を確認し、`list-*` 以外（タスク ID やグループ ID）を即座に `Optional.empty()`（`404 TASK_LIST_NOT_FOUND`）として拒否し、Cosmos DB `patchItem` で `/name` のみを更新する。
- **Rationale**: 同じコンテナー・パーティション内に共存するタスク文書・グループ文書の誤更新を防ぎつつ、カスタムリストの `groupId` や `createdAt` を損なわず更新できる。
- **Alternatives considered**:
  - `replaceItem` で文書全体を書き換える: 同時更新時に `groupId` 等の他フィールドを上書きするリスクがあるため、部分更新（`patchItem`）を採用した。

## 3. フロントエンドの編集導線と状態同期

- **Decision**: 既存の `useTaskLists` の `updateList(updated)` を使い、左サイドバーの各カスタムリスト行（グループ配下・未分類とも）および選択中カスタムリスト画面からインラインで編集できるようにする。
- **Rationale**: サイドバー、リスト見出し、タスクの所属先セレクトはすべて `useTaskLists().lists` を単一の情報源としているため、`updateList` を呼ぶだけで全箇所が同時に同期し、入力エラー・キャンセル・保存失敗時再試行の挙動も 008 のグループ名編集と統一できる。
- **Alternatives considered**:
  - 選択中リスト画面のみに編集を限定する: 複数リストの名前を続けて整理したいときに毎回画面切り替えが必要になるため、サイドバー側からも直接編集できるようにした。

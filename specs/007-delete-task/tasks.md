---
description: "タスク削除機能の実装タスク"
---

# Tasks: タスクの削除

**Input**: Design documents from `/specs/007-delete-task/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/task-delete.md](contracts/task-delete.md), [quickstart.md](quickstart.md)

**Tests**: 憲章原則 I・III に従い、HTTP 契約テスト（MockMvc）と Cosmos DB vNext エミュレーター結合テストを含める。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., `US1`)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: ローカル検証環境と既存構成の確認

- [X] T001 `README.md` の前提条件・ローカルエミュレーター接続と `.specify/feature.json` の対象（`specs/007-delete-task`）を確認する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: バックエンドおよび Azure データロールの削除基盤を整備する

- [X] T002 `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` に [data-model.md](data-model.md) の `Task.id` 制約（所有者パーティション限定およびカスタムリスト ID の除外）を満たす `delete(String id)` を実装する
- [X] T003 [P] `infra/main.bicep` の既存 `tasksRole`（`To Do Task Read and Create`）の `dataActions` に `Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/delete` を追加する

**Checkpoint**: 削除リポジトリメソッドと Azure RBAC 権限が揃い、US1 の実装と検証へ進める。

---

## Phase 3: User Story 1 - タスクの削除 (Priority: P1) 🎯 MVP

**Goal**: 各タスク行から確認付きでタスク1件を削除でき、再読み込み後も非表示が保たれ、キャンセル・複数ビュー/検索中削除・失敗時再試行がすべて正しく動作する。

**Independent Test**: 2件のタスク（うち1件は完了・重要・カスタムリスト所属）から1件を削除し、残り1件とカスタムリストの維持、再読み込み、キャンセル、各ビュー・検索結果からの削除、および `503` 発生後の再試行を確認する。

### Tests for User Story 1

> **NOTE: 実装前にテストを追加し、API 契約と永続化・保護条件を検証する**

- [X] T004 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TaskControllerTest.java` に [contracts/task-delete.md](contracts/task-delete.md) の `DELETE /api/tasks/{id}` 契約テスト（`204` 成功、`404 TASK_NOT_FOUND`、`503 TASK_STORAGE_UNAVAILABLE`）を追加する
- [X] T005 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TasksCosmosIT.java` にタスク1件削除の永続化、他タスク・カスタムリストの保持、別パーティション拒否、カスタムリスト ID 削除拒否を検証する結合テストを追加する

### Implementation for User Story 1

- [X] T006 [US1] `backend/src/main/java/com/example/todo/tasks/TaskController.java` に [data-model.md](data-model.md) の `Task.id` と [contracts/task-delete.md](contracts/task-delete.md) に従う `DELETE /api/tasks/{id}` エンドポイントを実装する
- [X] T007 [P] [US1] `frontend/src/api/tasks.ts` に [contracts/task-delete.md](contracts/task-delete.md) に従う `deleteTask(id)` を追加する
- [X] T008 [US1] `frontend/src/TaskDeleteAction.tsx` に確認表示（「削除」→「このタスクを削除しますか？」／「削除する」／「キャンセル」）、二重送信防止、失敗時エラー表示と再試行を実装する
- [X] T009 [US1] `frontend/src/App.tsx` の `TaskRow` に `TaskDeleteAction` を組み込み、削除成功時に全タスク状態から対象 `Task.id` を除外して現在のビュー（すべてのタスク・重要・カスタムリスト）および検索条件を維持する

**Checkpoint**: US1 の API・永続化・UI がすべて揃い、単独でテスト・動作確認できる。

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 全体テスト・ビルド・Bicep 検証および結果記録

- [X] T010 `specs/007-delete-task/quickstart.md` に従い、フロントエンドの `npm test`・`npm run build`、バックエンドの `./mvnw -B -ntp verify`（単体＋Cosmos DB 結合テスト）、および `infra/main.bicep` の検証を実行し、結果をこのファイル末尾に記録する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 依存なし（`T001`）
- **Phase 2 (Foundational)**: `T001` 完了後。`T002` と `T003` は別ファイルのため並列実行可能
- **Phase 3 (User Story 1)**: `T002` 完了後。`T004`・`T005`・`T007` は並列着手可能。`T006` は `T002`・`T004` 完了後。`T008` は `T007` 完了後。`T009` は `T008` 完了後
- **Phase 4 (Polish)**: `T003`・`T005`・`T006`・`T009` すべて完了後に `T010` を実行

## Parallel Example: User Story 1

```text
# テスト追加とフロントエンド API クライアント追加を並列実行:
T004 [P] [US1] backend/src/test/java/com/example/todo/tasks/TaskControllerTest.java
T005 [P] [US1] backend/src/test/java/com/example/todo/tasks/TasksCosmosIT.java
T007 [P] [US1] frontend/src/api/tasks.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (`T001`) で前提確認
2. Phase 2 (`T002`, `T003`) でリポジトリ削除処理と Bicep 権限を整備
3. Phase 3 (`T004`〜`T009`) でテスト先行のうえバックエンド・フロントエンドを実装
4. Phase 4 (`T010`) でフロントテスト・ビルド・Maven 結合テスト・Bicep 検証を実行し、結果を記録

## 検証結果

- フロントエンド: `cd frontend && npm test && npm run build` が成功（検索テスト4件通過、`tsc --noEmit && vite build` 成功）。
- バックエンド: JDK 25 とローカル Cosmos DB vNext エミュレーター（`.local/cosmos.p12`）で `./mvnw -B -ntp -o -Dmaven.repo.local=/tmp/speckit-m2 verify -Pbundled-web` が成功。
  - 単体テスト `TaskControllerTest`: 39件成功（削除成功 `204`、`404 TASK_NOT_FOUND`、`503 TASK_STORAGE_UNAVAILABLE` を含む）。
  - Cosmos DB 結合テスト `TasksCosmosIT`: 7件成功（タスク1件削除と他タスク・カスタムリスト保持、再削除 `404`、別パーティションおよびカスタムリスト ID の削除拒否を含む）。
  - Cosmos DB 結合テスト `TaskListsCosmosIT`: 3件成功。
- Bicep: `az bicep build --file infra/main.bicep --stdout > /dev/null` および `az bicep lint --file infra/main.bicep` が成功（エラー・警告なし）。

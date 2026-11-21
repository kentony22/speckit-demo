---
description: "カスタムリスト削除機能の実装タスク"
---

# Tasks: カスタムリストの削除

**Input**: Design documents from `/specs/010-delete-task-list/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/delete-task-list.md](contracts/delete-task-list.md), [quickstart.md](quickstart.md)

**Tests**: 憲章原則 I・III に従い、HTTP 契約テスト（MockMvc）、Cosmos DB vNext エミュレーター結合テスト、およびフロントエンド状態遷移単体テスト（Node test）を含める。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., `US1`)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: ローカル検証環境・ブランチ・対象仕様の確認

- [X] T001 `README.md` の前提条件・ローカル Cosmos DB vNext エミュレーター接続と `.specify/feature.json` の対象（`specs/010-delete-task-list`）および `.gitignore` を確認する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: カスタムリスト削除と所属タスク未所属化のリポジトリ基盤を整備する

- [X] T002 `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` に `deleteList(String id)` を実装する（[data-model.md](data-model.md) の `TaskList.id`・`TaskList.ownerId`・`TaskList.kind`・`TaskListGroup.id` 制約に従い `listExists(id)` で対象確認後、同一所有者パーティションの所属タスクの `Task.listId` を `null` に部分更新してからリスト文書を削除する）

**Checkpoint**: リポジトリ層の安全なカスタムリスト削除・所属タスク未所属化が揃い、US1 のテストおよび実装へ進める。

---

## Phase 3: User Story 1 - カスタムリストの削除 (Priority: P1) 🎯 MVP

**Goal**: ユーザーが確認ステップ（確定／キャンセル）付きでカスタムリスト1件を削除でき、所属タスクは削除せず「リストなし」として「すべてのタスク」に残り、表示中のリストを削除した場合は「すべてのタスク」（`#tasks`）へ自然に戻る。

**Independent Test**: カスタムリスト2件・リストグループ1件・各リストに所属するタスクを用意し、削除確認と確定、所属タスクの未所属化、表示中リスト削除時の `#tasks` 遷移、再読み込み後の状態維持、キャンセル時の維持、失敗時の維持と再試行を単独で確認できる。

### Tests for User Story 1

> **NOTE: 実装前にテストを追加し、HTTP 契約・Cosmos DB 永続化・フロントエンド状態遷移を検証する**

- [X] T003 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TaskListControllerTest.java` に [contracts/delete-task-list.md](contracts/delete-task-list.md) の契約テスト（`DELETE /api/task-lists/{id}` の `204` 成功、`404 TASK_LIST_NOT_FOUND`、`503 TASK_STORAGE_UNAVAILABLE`）を追加する
- [X] T004 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java` にカスタムリスト削除の結合テスト（所属タスクの `listId` が `null` になり名前・完了・重要・旧形式フィールドが維持されること、他リストおよびリストグループが維持されること、空リスト削除、未存在 ID・別所有者リスト ID・タスク ID・グループ ID への `404 TASK_LIST_NOT_FOUND` とデータ無傷）を追加する
- [X] T005 [P] [US1] `frontend/tests/taskListDeletion.test.mjs` に削除後状態遷移の単体テスト（対象リストのみ除外、所属タスクのみ `listId: null` 化、表示中リスト削除時の `#tasks` 遷移、別ビュー表示中のハッシュ維持）を追加する

### Implementation for User Story 1

- [X] T006 [US1] `backend/src/main/java/com/example/todo/tasks/TaskListController.java` に [contracts/delete-task-list.md](contracts/delete-task-list.md) と [data-model.md](data-model.md) の `TaskList.id` 制約に従う `DELETE /api/task-lists/{id}`（成功 `204`、未存在等 `404 TASK_LIST_NOT_FOUND`、障害 `503 TASK_STORAGE_UNAVAILABLE`）を実装する
- [X] T007 [P] [US1] `frontend/src/api/tasks.ts` に `DELETE /api/task-lists/{id}` を呼び出す `deleteTaskList(id: string): Promise<void>` を追加する
- [X] T008 [P] [US1] `frontend/src/taskListDeletion.ts` にリスト削除後のリスト一覧・タスク一覧（[data-model.md](data-model.md) の `Task.listId` を `null` 化）・遷移先ハッシュを計算する純粋関数を実装する
- [X] T009 [US1] `frontend/src/TaskLists.tsx` の `useTaskLists` に `removeList(id)`（対象リスト除外と表示中リスト削除時の `#tasks` 遷移）を追加し、`TaskListNavigation` に各カスタムリスト（グループ配下・未分類の両方）向けの確認ステップ（確定／キャンセル・二重送信防止・失敗メッセージと再試行）付き削除 UI を実装する
- [X] T010 [US1] `frontend/src/App.tsx` にカスタムリスト削除時の連携（`removeList` と所属タスクの `Task.listId` を `null` 化する状態更新）を組み込む

**Checkpoint**: US1 のバックエンド・フロントエンド・テストがすべて揃い、単独で検証できる。

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 全体テスト・ビルドの実行および結果記録

- [X] T011 `specs/010-delete-task-list/quickstart.md` に従い、フロントエンドの `npm test`・`npm run build`、バックエンドの `./mvnw -B -ntp -o -Dmaven.repo.local=/tmp/speckit-m2 verify -Pbundled-web`（単体＋Cosmos DB 結合テスト）を実行し、結果をこのファイル末尾に記録する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 依存なし（`T001`）
- **Phase 2 (Foundational)**: `T001` 完了後（`T002`）
- **Phase 3 (User Story 1)**: `T002` 完了後。`T003`・`T004`・`T005`・`T007`・`T008` は並列実行可能。`T006` は `T002`・`T003` 完了後。`T009` は `T007`・`T008` 完了後。`T010` は `T008`・`T009` 完了後
- **Phase 4 (Polish)**: `T004`・`T005`・`T006`・`T010` 完了後に `T011` を実行

## Parallel Example: User Story 1

```text
# テスト追加とフロントエンド独立モジュールを並列実行:
T003 [P] [US1] backend/src/test/java/com/example/todo/tasks/TaskListControllerTest.java
T004 [P] [US1] backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java
T005 [P] [US1] frontend/tests/taskListDeletion.test.mjs
T007 [P] [US1] frontend/src/api/tasks.ts
T008 [P] [US1] frontend/src/taskListDeletion.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (`T001`) で前提確認
2. Phase 2 (`T002`) でリポジトリ層の安全なカスタムリスト削除を実装
3. Phase 3 (`T003`〜`T010`) でテスト先行のうえコントローラーとフロントエンドを実装
4. Phase 4 (`T011`) でフロントテスト・ビルド・Maven 結合テストを実行し、結果を記録

## 検証結果

- フロントエンド: `cd frontend && npm test && npm run build` が成功（Node 単体テスト7件通過：`taskListDeletion.test.mjs` 3件・`taskSearch.test.mjs` 4件、`tsc --noEmit && vite build` 成功）。
- バックエンド: JDK 25 とローカル Cosmos DB vNext エミュレーター（`.local/cosmos.p12`）で `./mvnw -B -ntp -o -Dmaven.repo.local=/tmp/speckit-m2 verify -Pbundled-web` が成功。
  - 単体テスト `TaskControllerTest`: 39件成功。
  - 単体テスト `TaskListControllerTest`: 44件成功（`DELETE /api/task-lists/{id}` の `204`・`404 TASK_LIST_NOT_FOUND`・`503 TASK_STORAGE_UNAVAILABLE` 契約検証を含む）。
  - Cosmos DB 結合テスト `TasksCosmosIT`: 7件成功。
  - Cosmos DB 結合テスト `TaskListsCosmosIT`: 9件成功（カスタムリスト削除、所属タスクの `listId: null` 化と名前・完了・重要・旧形式フィールド保持、他リストおよびリストグループ維持、空リスト削除、未存在・別所有者・タスク ID・グループ ID への `404 TASK_LIST_NOT_FOUND` 拒否とデータ保護を含む）。
- Azure / Bicep: 既存 `tasks` コンテナー・`/ownerId` パーティション・既存 RBAC 権限（`executeQuery`, `items/read`, `items/create`, `items/replace`, `items/delete`）の範囲内で完結しており、`infra/main.bicep` の変更なし。

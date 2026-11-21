---
description: "カスタムリスト名編集機能の実装タスク"
---

# Tasks: カスタムリスト名の編集

**Input**: Design documents from `/specs/009-rename-task-list/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/task-list-name.md](contracts/task-list-name.md), [quickstart.md](quickstart.md)

**Tests**: 憲章原則 I・III に従い、HTTP 契約テスト（MockMvc）と Cosmos DB vNext エミュレーター結合テストを含める。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., `US1`)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: ローカル検証環境と対象仕様の確認

- [X] T001 `README.md` の前提条件・ローカルエミュレーター接続と `.specify/feature.json` の対象（`specs/009-rename-task-list`）を確認する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: リポジトリ層にカスタムリスト名の部分更新処理を追加する

- [X] T002 `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` に [data-model.md](data-model.md) の `TaskList.id`（`list-*` 限定・所有者パーティション限定）および `TaskList.name` の制約に従い、`/name` のみを部分更新して `TaskList.groupId` を保持する `updateListName(String id, String name)` を実装する

**Checkpoint**: リポジトリのリスト名部分更新が揃い、US1 のテストと実装へ進める。

---

## Phase 3: User Story 1 - カスタムリスト名の編集 (Priority: P1) 🎯 MVP

**Goal**: 作成済みカスタムリストの名前をインライン編集で変更・永続化でき、左ナビゲーション・選択中見出し・タスク所属先選択欄へ即時反映され、キャンセル・空白エラー・保存失敗再試行が正しく動作する。

**Independent Test**: カスタムリスト2件（うち1件はグループ所属・タスク所属あり）から1件の名前を変更し、再読み込み、キャンセル、空白入力、および `503` 発生後の再試行を確認する。

### Tests for User Story 1

> **NOTE: 実装前にテストを追加し、HTTP 契約・永続化・保護条件を検証する**

- [X] T003 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TaskListControllerTest.java` に [contracts/task-list-name.md](contracts/task-list-name.md) の `PATCH /api/task-lists/{id}/name` 契約テスト（`200` 成功、`400 TASK_LIST_NAME_REQUIRED`、`404 TASK_LIST_NOT_FOUND`、`503 TASK_STORAGE_UNAVAILABLE`）を追加する
- [X] T004 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java` にカスタムリスト名変更の永続化、`groupId` と所属タスク・他リストの保持、および他所有者リスト・タスク ID・グループ ID の名前変更拒否を検証する結合テストを追加する

### Implementation for User Story 1

- [X] T005 [US1] `backend/src/main/java/com/example/todo/tasks/TaskListController.java` に [contracts/task-list-name.md](contracts/task-list-name.md) と [data-model.md](data-model.md) の `TaskList.name` 制約に従う `PATCH /api/task-lists/{id}/name` を実装する
- [X] T006 [P] [US1] `frontend/src/api/tasks.ts` に [contracts/task-list-name.md](contracts/task-list-name.md) に従う `updateTaskListName(listId, name)` を追加する
- [X] T007 [US1] `frontend/src/TaskLists.tsx` に `TaskListNameEditor`（保存・キャンセル・空白エラー・保存失敗時の入力保持と再試行）を追加し、`TaskListNavigation` のグループ配下・未分類リスト双方からインラインでリスト名を編集できるようにする
- [X] T008 [US1] `frontend/src/App.tsx` でカスタムリスト選択時のヘッダー付近からもリスト名を編集できるよう `TaskListNameEditor` を組み込み、保存後に `updateList` で画面全体へ反映する

**Checkpoint**: US1 のバックエンド・フロントエンド・テストがすべて揃い、単独で検証できる。

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 全体テスト・ビルドの実行および結果記録

- [X] T009 `specs/009-rename-task-list/quickstart.md` に従い、フロントエンドの `npm test`・`npm run build`、バックエンドの `./mvnw -B -ntp verify -Pbundled-web`（単体＋Cosmos DB 結合テスト）を実行し、結果をこのファイル末尾に記録する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 依存なし（`T001`）
- **Phase 2 (Foundational)**: `T001` 完了後（`T002`）
- **Phase 3 (User Story 1)**: `T002` 完了後。`T003`・`T004`・`T006` は並列実行可能。`T005` は `T002`・`T003` 完了後。`T007` は `T006` 完了後。`T008` は `T007` 完了後
- **Phase 4 (Polish)**: `T004`・`T005`・`T008` 完了後に `T009` を実行

## Parallel Example: User Story 1

```text
# テスト追加とフロントエンド API クライアント追加を並列実行:
T003 [P] [US1] backend/src/test/java/com/example/todo/tasks/TaskListControllerTest.java
T004 [P] [US1] backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java
T006 [P] [US1] frontend/src/api/tasks.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (`T001`) で前提確認
2. Phase 2 (`T002`) でリポジトリの部分更新を追加
3. Phase 3 (`T003`〜`T008`) でテスト先行のうえコントローラーとフロントエンドを実装
4. Phase 4 (`T009`) でフロントテスト・ビルド・Maven 結合テストを実行し、結果を記録

## 検証結果

- フロントエンド: `cd frontend && npm test && npm run build` が成功（検索テスト4件通過、`tsc --noEmit && vite build` 成功）。
- バックエンド: JDK 25 とローカル Cosmos DB vNext エミュレーター（`.local/cosmos.p12`）で `./mvnw -B -ntp -o -Dmaven.repo.local=/tmp/speckit-m2 verify -Pbundled-web` が成功。
  - 単体テスト `TaskControllerTest`: 39件成功。
  - 単体テスト `TaskListControllerTest`: 37件成功（`PATCH /api/task-lists/{id}/name` の成功・`400 TASK_LIST_NAME_REQUIRED`・`404 TASK_LIST_NOT_FOUND`・`503 TASK_STORAGE_UNAVAILABLE` を含む）。
  - Cosmos DB 結合テスト `TasksCosmosIT`: 7件成功。
  - Cosmos DB 結合テスト `TaskListsCosmosIT`: 6件成功（カスタムリスト名変更の永続化、`groupId` と所属タスク・他リスト保持、他所有者リスト・タスク ID・グループ ID の名前変更拒否を含む）。
- Azure / Bicep: 既存 `tasks` コンテナー・`/ownerId` パーティション・既存 RBAC 権限の範囲内で完結しており、無料枠構成の変更なし。

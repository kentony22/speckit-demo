---
description: "リストグループ機能の実装タスク"
---

# Tasks: リストグループ

**Input**: Design documents from `/specs/008-list-groups/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/list-groups.md](contracts/list-groups.md), [quickstart.md](quickstart.md)

**Tests**: 憲章原則 I・III に従い、HTTP 契約テスト（MockMvc）と Cosmos DB vNext エミュレーター結合テストを含める。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., `US1`)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: ローカル検証環境と対象仕様の確認

- [X] T001 `README.md` の前提条件・ローカルエミュレーター接続と `.specify/feature.json` の対象（`specs/008-list-groups`）を確認する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: リストグループの文書モデルとリポジトリ基盤を整備する

- [X] T002 [P] `backend/src/main/java/com/example/todo/tasks/TaskListGroupDocument.java` に [data-model.md](data-model.md) の `TaskListGroup.id`・`TaskListGroup.ownerId`・`TaskListGroup.kind`・`TaskListGroup.name`・`TaskListGroup.createdAt` を定義する
- [X] T003 [P] `backend/src/main/java/com/example/todo/tasks/TaskListDocument.java` に [data-model.md](data-model.md) の `TaskList.groupId` と旧文書互換コンストラクタを追加する
- [X] T004 `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` に `createListGroup`・`findListGroups`・`groupExists`・`updateListGroupName`（[data-model.md](data-model.md) の `TaskListGroup.name` 部分更新）・`updateListGroup`（[data-model.md](data-model.md) の `TaskList.groupId` 部分更新）およびタスク操作（`patchTask`・`delete`）からのグループ ID 除外ガードを実装する

**Checkpoint**: グループ文書・リスト所属更新リポジトリ・ドキュメント種別ガードが揃い、US1 の実装へ進める。

---

## Phase 3: User Story 1 - リストグループ (Priority: P1) 🎯 MVP

**Goal**: 画面左側でリストグループを作成・名前変更・開閉し、カスタムリストをグループへ割り当て・移動・解除でき、再読み込み後も状態と既存機能がすべて維持される。

**Independent Test**: グループ2件とカスタムリスト2件で、作成・名前変更・開閉、割り当て・移動・解除、再読み込み、空白エラー、`503` 発生後の再試行を確認する。

### Tests for User Story 1

> **NOTE: 実装前にテストを追加し、HTTP 契約・永続化・保護条件を検証する**

- [X] T005 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TaskListControllerTest.java` に [contracts/list-groups.md](contracts/list-groups.md) の契約テスト（`GET/POST /api/list-groups`、`PATCH /api/list-groups/{id}/name`、`PATCH /api/task-lists/{id}/group` の成功・`400`・`404`・`503`）を追加する
- [X] T006 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java` にグループ作成・名前変更、旧カスタムリストのグループ割り当て・移動・解除、タスク保持、別所有者グループ拒否、タスク更新/削除からのグループ ID 保護を検証する結合テストを追加する

### Implementation for User Story 1

- [X] T007 [US1] `backend/src/main/java/com/example/todo/tasks/TaskListController.java` に [contracts/list-groups.md](contracts/list-groups.md) と [data-model.md](data-model.md) の `TaskListGroup.name`・`TaskList.groupId` 制約に従う `GET/POST /api/list-groups`、`PATCH /api/list-groups/{id}/name` および `PATCH /api/task-lists/{id}/group` を実装し、`ListResponse` に `groupId` を含める
- [X] T008 [P] [US1] `frontend/src/api/tasks.ts` に `ListGroup` 型、`TaskList.groupId`、`listListGroups`、`createListGroup`、`updateListGroupName`、`updateTaskListGroup` を追加する
- [X] T009 [US1] `frontend/src/TaskLists.tsx` の `useTaskLists` にグループ取得・追加・名前更新・リスト更新を組み込み、`TaskListNavigation` にグループ開閉表示・グループ名インライン編集・未分類リスト表示・グループ作成フォーム、`TaskListGroupAssignment` に所属グループ切替 UI を実装する
- [X] T010 [US1] `frontend/src/App.tsx` に `TaskListGroupAssignment` を組み込み、カスタムリスト表示中にグループの割り当て・移動・解除を操作できるようにする

**Checkpoint**: US1 のバックエンド・フロントエンド・テストがすべて揃い、単独で検証できる。

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 全体テスト・ビルドの実行および結果記録

- [X] T011 `specs/008-list-groups/quickstart.md` に従い、フロントエンドの `npm test`・`npm run build`、バックエンドの `./mvnw -B -ntp verify -Pbundled-web`（単体＋Cosmos DB 結合テスト）を実行し、結果をこのファイル末尾に記録する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 依存なし（`T001`）
- **Phase 2 (Foundational)**: `T001` 完了後。`T002` と `T003` は並列実行可能。`T004` は `T002`・`T003` に依存
- **Phase 3 (User Story 1)**: `T004` 完了後。`T005`・`T006`・`T008` は並列実行可能。`T007` は `T004`・`T005` 完了後。`T009` は `T008` 完了後。`T010` は `T009` 完了後
- **Phase 4 (Polish)**: `T006`・`T007`・`T010` 完了後に `T011` を実行

## Parallel Example: User Story 1

```text
# モデル定義を並列実行:
T002 [P] backend/src/main/java/com/example/todo/tasks/TaskListGroupDocument.java
T003 [P] backend/src/main/java/com/example/todo/tasks/TaskListDocument.java

# テスト追加とフロントエンド API クライアント追加を並列実行:
T005 [P] [US1] backend/src/test/java/com/example/todo/tasks/TaskListControllerTest.java
T006 [P] [US1] backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java
T008 [P] [US1] frontend/src/api/tasks.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (`T001`) で前提確認
2. Phase 2 (`T002`〜`T004`) で文書モデルとリポジトリを整備
3. Phase 3 (`T005`〜`T010`) でテスト先行のうえコントローラーとフロントエンドを実装
4. Phase 4 (`T011`) でフロントテスト・ビルド・Maven 結合テストを実行し、結果を記録

## 検証結果

- フロントエンド: `cd frontend && npm test && npm run build` が成功（検索テスト4件通過、`tsc --noEmit && vite build` 成功）。
- バックエンド: JDK 25 とローカル Cosmos DB vNext エミュレーター（`.local/cosmos.p12`）で `./mvnw -B -ntp -o -Dmaven.repo.local=/tmp/speckit-m2 verify -Pbundled-web` が成功。
  - 単体テスト `TaskControllerTest`: 39件成功。
  - 単体テスト `TaskListControllerTest`: 28件成功（`GET/POST /api/list-groups`、`PATCH /api/list-groups/{id}/name`、`PATCH /api/task-lists/{id}/group` の成功・`400`・`404`・`503` 契約検証）。
  - Cosmos DB 結合テスト `TasksCosmosIT`: 7件成功。
  - Cosmos DB 結合テスト `TaskListsCosmosIT`: 5件成功（グループ作成・名前変更、旧カスタムリストのグループ割り当て・移動・解除、タスク保持、別所有者グループおよびリスト ID への名前変更拒否、タスク更新/削除からのグループ ID 保護を含む）。
- Azure / Bicep: 既存 `tasks` コンテナー・`/ownerId` パーティション・既存 RBAC 権限の範囲内で完結しており、無料枠構成の変更なし。

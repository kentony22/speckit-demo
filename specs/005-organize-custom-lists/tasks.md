---
description: "カスタムリストの実装タスク"
---

# Tasks: カスタムリスト

**Input**: [仕様](spec.md)、[計画](plan.md)、[データモデル](data-model.md)、[HTTP 契約](contracts/task-lists.md)。

## Phase 1: Setup

- [X] T001 `.specify/feature.json` の対象、`README.md` の起動手順、共有エミュレーターの応答を確認する。

## Phase 2: Foundational

- [X] T002 `backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java` に HTTP 契約と保存を確認する結合テストを作成する。T001 に依存する。

## Phase 3: User Story 1 — カスタムリスト (P1)

**Goal**: リストを作り、タスクを移動・解除する。各リストと全件一覧で同じタスクの状態を確認できる。

**Independent Test**: 空のリストを2件作り、既存タスクを割り当て・移動・解除し、再取得後の各一覧を確認する。

- [X] T003 `backend/src/main/java/com/example/todo/tasks/TaskListDocument.java` と `CosmosTaskRepository.java` に [data-model.md](data-model.md) の `TaskList.id`、`TaskList.ownerId`、`TaskList.kind`、`TaskList.name`、`TaskList.createdAt` の保存・取得を実装する。T002 に依存する。
- [X] T004 `backend/src/main/java/com/example/todo/tasks/TaskDocument.java`、`TaskController.java`、`TaskListController.java`、`CosmosTaskRepository.java` で [data-model.md](data-model.md) の `Task.listId` と HTTP 契約を実装する。T003 に依存する。
- [X] T005 `frontend/src/api/tasks.ts`、`frontend/src/TaskLists.tsx`、`frontend/src/App.tsx` に作成・選択・割り当てとエラー時の再試行を実装する。T004 に依存する。

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T006 `backend/pom.xml` の Maven 検証と `frontend/package.json` の本番ビルドを実行する。T005 に依存する。
- [X] T007 `specs/005-organize-custom-lists/quickstart.md` の AC-001〜AC-006 をブラウザーで検証し、結果を `specs/005-organize-custom-lists/tasks.md` に記録する。T006 に依存する。

## Dependencies & Execution Order

T001 → T002 → T003 → T004 → T005 → T006 → T007。API 契約が確定した後はフロントエンド実装とバックエンドの実行検証を別の作業として進められる。MVP は US1 の作成・閲覧・単一所属。ブラウザーで保存と再試行を確認して完了とする。

## 検証結果

- `./mvnw -o -Dmaven.repo.local=/tmp/speckit-m2 verify` で単体テスト22件、Cosmos DB エミュレーターを使った結合テスト5件が成功した。追加した2件では、旧形式のタスク、所属の移動と解除、全件取得、入力検証、所有者をまたぐ移動の拒否を確認した。
- `npm ci --offline --cache /tmp/speckit-npm` と `npm run build` が成功した。
- バンドル済みアプリを専用ポートで起動し、Chrome で AC-001〜AC-006 と SC-001〜SC-002 を確認した。保存失敗は、作成と割り当ての各レスポンスを1回だけ 503 にして再現し、状態の維持と再試行の成功を確認した。

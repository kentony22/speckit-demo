# Implementation Plan: カスタムリストの削除

**Branch**: `feature/010-delete-task-list` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-delete-task-list/spec.md`

## Summary

カスタムリスト1件を確認ステップ（確定／キャンセル）付きで削除する機能を追加する。バックエンドは `DELETE /api/task-lists/{id}` を新設し、`CosmosTaskRepository.deleteList(String id)` で対象が同一所有者パーティションのカスタムリスト（`list-` プレフィックス・`kind = "task-list"`）であることを検証したうえで、所属タスクの `/listId` のみを `null` に部分更新してからカスタムリスト文書を削除する（タスク自体は削除せず「すべてのタスク」に残す）。フロントエンドは左ナビゲーションの各カスタムリストに確認付き削除操作を追加し、削除成功時に所属タスクのクライアント状態を `listId: null` へ更新し、表示中のリストを削除した場合は「すべてのタスク」（`#tasks`）へ自然に戻す。

## Technical Context

**Language/Version**: TypeScript 5.9、Java 25

**Primary Dependencies**: 既存の React 19、Vite 7、Tailwind CSS 4、Spring Boot 4.2.0、Azure Cosmos DB Java SDK

**Storage**: 既存の Cosmos DB `tasks` コンテナー（`/ownerId` パーティション内で `task` / `task-list` / `list-group` 文書を `kind` と ID プレフィックスで分離）

**Testing**: MockMvc 単体テスト（`TaskListControllerTest`）、Cosmos DB vNext エミュレーター結合テスト（`TaskListsCosmosIT`）、Node テスト（`frontend/tests/*.test.mjs`）、`npm run build`

**Target Platform**: ブラウザー、ローカル Spring Boot、既存 Azure 無料枠構成

**Project Type**: To Do Web アプリ（`backend/` + `frontend/`）

**Performance Goals**: カスタムリスト削除は単一の `DELETE /api/task-lists/{id}` リクエストで完了し、フロントエンドは追加の再取得なしで一覧・タスク所属先・表示ビューを即時更新する。

**Constraints**: カスタムリスト削除時に所属タスクやリストグループを削除しないこと。旧形式タスクの任意フィールドを保持すること。タスク ID・グループ ID・別所有者リスト ID に対する削除要求を `404 TASK_LIST_NOT_FOUND` で拒否すること。Azure 無料枠構成（`infra/main.bicep` のコンテナー数・RBAC 権限）を変更しないこと。

**Scale/Scope**: 個人向け To Do のカスタムリスト1件の確認付き削除（Undo・ゴミ箱・一括削除・リストグループ削除は対象外）

## Constitution Check

設計前・設計後の両方で憲章 1.0.0 の全原則を確認済み（違反なし）。

- **I. ユーザー操作と期待結果を受け入れ条件にする**: `spec.md` の AC-001〜AC-005 を `TaskListControllerTest`（MockMvc）、`TaskListsCosmosIT`（Cosmos DB 結合テスト）、`frontend/tests/taskListDeletion.test.mjs`、および `quickstart.md` の画面確認手順に対応付ける。
- **II. 登録から再読み込み後の一覧表示までを先に作る**: 既存のタスク登録・一覧・編集・完了・重要・カスタムリスト・グループ・検索・タスク削除の動作と既存回帰テストを維持する。
- **III. ローカルと GitHub Actions で検証を再現する**: 既存の `README.md` 手順、Maven Wrapper（`./mvnw verify -Pbundled-web`）、`frontend` の `npm test`・`npm run build`、および `.github/workflows/ci.yml` でローカルと CI の両方を再現する。
- **IV. Azure 環境は Bicep で定義し、確認済みの無料枠を使う**: 既存の `tasks` コンテナー（`/ownerId`）および既存 RBAC 権限（`executeQuery`, `items/read`, `items/create`, `items/replace`, `items/delete`）の範囲内で完結し、`infra/main.bicep` の変更は不要。

## Project Structure

### Documentation (this feature)

```text
specs/010-delete-task-list/
├── plan.md                      # This file ($speckit-plan command output)
├── research.md                  # Phase 0 output ($speckit-plan command)
├── data-model.md                # Phase 1 output ($speckit-plan command)
├── quickstart.md                # Phase 1 output ($speckit-plan command)
├── contracts/
│   └── delete-task-list.md      # Phase 1 output ($speckit-plan command)
├── checklists/
│   └── requirements.md          # Specification quality checklist
└── tasks.md                     # Phase 2 output ($speckit-tasks command)
```

### Source Code (repository root)

```text
backend/
└── src/
    ├── main/java/com/example/todo/tasks/
    │   ├── CosmosTaskRepository.java      # deleteList(String id) を追加
    │   └── TaskListController.java        # DELETE /api/task-lists/{id} を追加
    └── test/java/com/example/todo/tasks/
        ├── TaskListControllerTest.java    # DELETE /api/task-lists/{id} の MockMvc 単体テストを追加
        └── TaskListsCosmosIT.java         # カスタムリスト削除・所属タスク未所属化・誤削除防止の結合テストを追加

frontend/
├── src/
│   ├── api/tasks.ts                       # deleteTaskList(id) を追加
│   ├── taskListDeletion.ts                # リスト削除後の状態更新・ハッシュ遷移の純粋関数を追加
│   ├── TaskLists.tsx                      # useTaskLists.removeList と確認付き削除 UI を追加
│   └── App.tsx                            # リスト削除時に所属タスクの listId を null 化する連携を追加
└── tests/
    └── taskListDeletion.test.mjs          # リスト削除状態遷移の Node 単体テストを追加
```

**Structure Decision**: 既存の `backend/`（Spring Boot）＋ `frontend/`（React/Vite）構成をそのまま拡張し、既存ファイル責務（`CosmosTaskRepository`, `TaskListController`, `api/tasks.ts`, `TaskLists.tsx`, `App.tsx`）に揃える。

## Complexity Tracking

憲章違反はないため該当項目なし。

# Implementation Plan: カスタムリスト名の編集

**Branch**: `feature/009-rename-task-list` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

## Summary

カスタムリストの名前を部分更新する `PATCH /api/task-lists/{id}/name` と、フロントエンドのインライン編集 UI を追加する。サーバー側は `list-*` 識別子かつ同一所有者パーティションのカスタムリスト文書のみ `/name` を部分更新し、`groupId` や配下タスクを保持する。フロントエンドは `useTaskLists` の単一状態（`lists`）を更新することで、左ナビゲーション・選択中リスト見出し・タスクの所属先選択欄へ即時反映する。

## Technical Context

| 項目 | 設計 |
| --- | --- |
| Language/Version | TypeScript 5.9、Java 25 |
| Primary Dependencies | 既存の React 19、Vite 7、Tailwind CSS 4、Spring Boot 4.2.0、Azure Cosmos DB Java SDK |
| Storage | 既存の Cosmos DB `tasks` コンテナー（`/ownerId` パーティション内の `kind: "task-list"` 文書） |
| Testing | MockMvc 単体テスト、Cosmos DB vNext エミュレーター結合テスト、Node テスト、`npm run build` |
| Target Platform | ブラウザー、ローカル Spring Boot、既存 Azure 無料枠構成 |
| Project Type | To Do Web アプリ |
| Performance Goals | 1回の `PATCH` リクエストで `/name` のみを部分更新し、クライアント状態を即時更新する。 |
| Constraints | タスク文書・グループ文書・他所有者のリスト文書を誤って更新できないこと。`groupId`・作成時刻・所属タスクを保持すること。Azure 無料枠構成と Bicep は変更しない。 |
| Scale/Scope | 個人向け一覧でのカスタムリスト名の編集・キャンセル・入力検証・再試行 |

## Constitution Check

設計前・設計後の両方で憲章 1.0.0 の全原則を確認済み。

- **I. ユーザー操作と期待結果を受け入れ条件にする**: `spec.md` の AC-001〜AC-005 を `TaskListControllerTest`（MockMvc）、`TaskListsCosmosIT`（Cosmos DB 結合テスト）、および `quickstart.md` の画面確認手順に対応付ける。
- **II. 登録から再読み込み後の一覧表示までを先に作る**: 既存の登録・一覧・完了・タスク名編集・重要・カスタムリスト・リストグループ・検索・削除の動作と回帰テストを維持する。
- **III. ローカルと GitHub Actions で検証を再現する**: 既存の `README.md` 手順、Maven Wrapper（`./mvnw verify`）、`frontend` の `npm test`・`npm run build`、および `.github/workflows/ci.yml` でローカルと CI の両方を再現する。
- **IV. Azure 環境は Bicep で定義し、確認済みの無料枠を使う**: 既存の `tasks` コンテナーと既存 RBAC 権限（`items/replace` を含む）の範囲内で完結し、新規 Azure リソース追加や Bicep 変更は不要。

## Project Structure

### Documentation (this feature)

- [research.md](research.md) — 設計判断と代替案の比較
- [data-model.md](data-model.md) — `TaskList.name` の制約と部分更新の定義
- [contracts/task-list-name.md](contracts/task-list-name.md) — `PATCH /api/task-lists/{id}/name` の HTTP 契約
- [quickstart.md](quickstart.md) — ローカル検証・受け入れ確認手順
- `tasks.md` — 実装タスクと依存順

### Source Code (repository root)

- `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` — `list-*` 限定で `/name` を部分更新する `updateListName(id, name)` を追加
- `backend/src/main/java/com/example/todo/tasks/TaskListController.java` — `PATCH /api/task-lists/{id}/name` エンドポイントを追加
- `backend/src/test/java/com/example/todo/tasks/TaskListControllerTest.java` — HTTP 契約の MockMvc 単体テストを追加
- `backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java` — リスト名変更の永続化・`groupId` とタスク保持・他所有者/タスク/グループ ID 拒否の結合テストを追加
- `frontend/src/api/tasks.ts` — `updateTaskListName(listId, name)` を追加
- `frontend/src/TaskLists.tsx` — `TaskListNameEditor` を追加し、`TaskListNavigation`（グループ配下・未分類リスト）からインラインでリスト名を編集できるようにする
- `frontend/src/App.tsx` — カスタムリスト選択時のヘッダー付近からもリスト名を編集できるよう `TaskListNameEditor` を組み込む

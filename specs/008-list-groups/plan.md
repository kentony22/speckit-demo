# Implementation Plan: リストグループ

**Branch**: `feature/008-list-groups` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

## Summary

カスタムリストを束ねて画面左側で折りたたみ・展開できるリストグループ機能を追加する。リストグループ文書（`kind: "list-group"`, `id: "group-..."`）と既存カスタムリスト文書の `groupId` 属性を同じ Cosmos DB `tasks` コンテナー（パーティションキー `/ownerId`）に保存し、フロントエンドの左ナビゲーションでグループ作成・名前変更・開閉とカスタムリストのグループ割り当て／移動／解除を行えるようにする。

## Technical Context

| 項目 | 設計 |
| --- | --- |
| Language/Version | TypeScript 5.9、Java 25 |
| Primary Dependencies | 既存の React 19、Vite 7、Tailwind CSS 4、Spring Boot 4.2.0、Azure Cosmos DB Java SDK |
| Storage | 既存の Cosmos DB `tasks` コンテナー（`/ownerId` パーティション内で `task` / `task-list` / `list-group` 文書を `kind` と ID プレフィックスで分離） |
| Testing | MockMvc 単体テスト、Cosmos DB vNext エミュレーター結合テスト、Node テスト、`npm run build` |
| Target Platform | ブラウザー、ローカル Spring Boot、既存 Azure 無料枠構成 |
| Project Type | To Do Web アプリ |
| Performance Goals | グループの開閉はクライアント状態で即時切り替え、追加 API 通信を行わない。グループ作成・名前変更・所属変更は単一リクエストで永続化する。 |
| Constraints | 既存の旧カスタムリスト文書（`groupId` 未定義）を未所属として読み取れること。タスク操作・リスト操作でグループ文書や他所有者の文書を誤操作できないこと。Azure 無料枠構成（コンテナー数・ロール）を増やさない。 |
| Scale/Scope | 個人のサイドバーでのリストグループ作成・名前変更・開閉、カスタムリストの単一グループ所属 |

## Constitution Check

設計前・設計後の両方で憲章 1.0.0 の全原則を確認済み。

- **I. ユーザー操作と期待結果を受け入れ条件にする**: `spec.md` の AC-001〜AC-007 を `TaskListControllerTest`（MockMvc）、`TaskListsCosmosIT`（Cosmos DB 結合テスト）、および `quickstart.md` の画面確認手順に対応付ける。
- **II. 登録から再読み込み後の一覧表示までを先に作る**: 既存のタスク登録・一覧・編集・完了・重要・カスタムリスト・検索・削除の動作と回帰テストを維持する。
- **III. ローカルと GitHub Actions で検証を再現する**: 既存の `README.md` 手順、Maven Wrapper（`./mvnw verify`）、`frontend` の `npm test`・`npm run build`、および `.github/workflows/ci.yml` でローカルと CI の両方を再現する。
- **IV. Azure 環境は Bicep で定義し、確認済みの無料枠を使う**: 既存の `tasks` コンテナーと既存 RBAC 権限（`executeQuery`, `items/read`, `items/create`, `items/replace`, `items/delete`）の範囲内で完結し、新規 Azure リソース追加や Bicep 変更は不要。

## Project Structure

### Documentation (this feature)

- [research.md](research.md) — 設計判断と代替案の比較
- [data-model.md](data-model.md) — `TaskListGroup` と `TaskList.groupId` のモデル定義と制約
- [contracts/list-groups.md](contracts/list-groups.md) — `/api/list-groups`、`PATCH /api/list-groups/{id}/name`、`PATCH /api/task-lists/{id}/group` の HTTP 契約
- [quickstart.md](quickstart.md) — ローカル検証・受け入れ確認手順
- `tasks.md` — 実装タスクと依存順

### Source Code (repository root)

- `backend/src/main/java/com/example/todo/tasks/TaskListGroupDocument.java` — リストグループ文書レコード（`ID_PREFIX = "group-"`, `KIND = "list-group"`）
- `backend/src/main/java/com/example/todo/tasks/TaskListDocument.java` — `groupId` フィールドと互換コンストラクタを追加
- `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` — グループ作成・一覧取得・名前更新・存在確認・リストの `groupId` 部分更新、およびタスク操作からのグループ ID ガードを追加
- `backend/src/main/java/com/example/todo/tasks/TaskListController.java` — `GET/POST /api/list-groups`、`PATCH /api/list-groups/{id}/name`、`PATCH /api/task-lists/{id}/group` を追加し、`ListResponse` に `groupId` を含める
- `backend/src/test/java/com/example/todo/tasks/TaskListControllerTest.java` — リストグループ HTTP 契約の MockMvc 単体テストを追加
- `backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java` — グループ作成・名前変更・旧リストのグループ移動と解除・別所有者拒否・タスク操作からのグループ ID 保護の結合テストを追加
- `frontend/src/api/tasks.ts` — `ListGroup` 型、`TaskList.groupId`、`listListGroups`、`createListGroup`、`updateListGroupName`、`updateTaskListGroup` を追加
- `frontend/src/TaskLists.tsx` — `useTaskLists` にグループ状態と更新を追加し、`TaskListNavigation` にグループ開閉表示・グループ名編集・グループ作成フォーム、`TaskListGroupAssignment` に所属グループ切替を追加
- `frontend/src/App.tsx` — カスタムリスト表示時に `TaskListGroupAssignment` を組み込む

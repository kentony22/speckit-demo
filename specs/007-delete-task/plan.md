# Implementation Plan: タスクの削除

**Branch**: `feature/007-delete-task` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

## Summary

タスクをクリックして開く詳細パネル下部にゴミ箱アイコンと確認ステップ付きの削除操作を配置する。確認後に `DELETE /api/tasks/{id}` で Cosmos DB の対象タスク文書だけを物理削除し、成功時はクライアント側の全タスク一覧から対象1件を取り除くことで、「タスク」「重要」「カスタムリスト」「検索結果」のどの画面でも現在のビューや検索語を維持したまま反映する。Azure の既存タスク用データロールには項目削除アクションを追加する。

## Technical Context

| 項目 | 設計 |
| --- | --- |
| Language/Version | TypeScript 5.9、Java 25 |
| Primary Dependencies | 既存の React 19、Vite 7、Tailwind CSS 4、Spring Boot 4.2.0、Azure Cosmos DB Java SDK |
| Storage | 既存の Cosmos DB `tasks` コンテナー（パーティションキー `/ownerId`） |
| Testing | MockMvc 単体テスト、Cosmos DB vNext エミュレーター結合テスト、Node テスト、`npm run build`、Bicep ビルド・lint |
| Target Platform | ブラウザー、ローカル Spring Boot、既存 Azure 構成（Linux F1 / Cosmos DB 無料枠） |
| Project Type | To Do Web アプリ |
| Performance Goals | 削除確定後は1回の `DELETE` リクエストのみで完了し、再取得なしで一覧表示を即時更新する。 |
| Constraints | カスタムリスト文書（`list-*`）および他所有者のタスクを誤って削除できないこと。既存の登録・編集・完了・重要・カスタムリスト・検索と Azure 無料枠構成を維持する。 |
| Scale/Scope | 個人向け一覧でのタスク1件単位の確認付き削除 |

## Constitution Check

設計前・設計後の両方で憲章 1.0.0 の全原則を確認済み。

- **I. ユーザー操作と期待結果を受け入れ条件にする**: `spec.md` の AC-001〜AC-005 を `TaskControllerTest`、`TasksCosmosIT`、および `quickstart.md` の画面確認手順に対応付ける。
- **II. 登録から再読み込み後の一覧表示までを先に作る**: 既存の登録・一覧・再読み込み・編集・完了・重要・カスタムリスト・検索を壊さず、既存テストと回帰確認を通す。
- **III. ローカルと GitHub Actions で検証を再現する**: 既存の `README.md` 手順、Maven Wrapper（`./mvnw verify`）、`frontend` の `npm test`・`npm run build`、および `.github/workflows/ci.yml`（Bicep 検証含む）でローカルと CI の両方を再現する。
- **IV. Azure 環境は Bicep で定義し、確認済みの無料枠を使う**: `infra/main.bicep` の既存 `tasksRole` に `items/delete` 権限のみを追加する。新規リソースの追加や SKU・無料枠設定の変更は行わない。

## Project Structure

### Documentation (this feature)

- [research.md](research.md) — 設計判断と代替案の比較
- [data-model.md](data-model.md) — 削除対象のエンティティ定義と状態遷移
- [contracts/task-delete.md](contracts/task-delete.md) — `DELETE /api/tasks/{id}` の HTTP 契約
- [quickstart.md](quickstart.md) — ローカル検証・受け入れ確認手順
- `tasks.md` — 実装タスクと依存順

### Source Code (repository root)

- `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` — タスク文書限定の `delete(String id)` を追加
- `backend/src/main/java/com/example/todo/tasks/TaskController.java` — `DELETE /api/tasks/{id}` エンドポイントを追加
- `backend/src/test/java/com/example/todo/tasks/TaskControllerTest.java` — HTTP 契約の単体テストを追加
- `backend/src/test/java/com/example/todo/tasks/TasksCosmosIT.java` — 削除の永続化・他タスク/リスト保護・他パーティション拒否の結合テストを追加
- `frontend/src/api/tasks.ts` — `deleteTask(id)` を追加
- `frontend/src/TaskDeleteAction.tsx` — 詳細パネル下部向けのゴミ箱アイコン・インライン確認・キャンセル・送信中・失敗時再試行の UI コンポーネントを追加
- `frontend/src/TaskDetailPanel.tsx` / `frontend/src/App.tsx` — `TaskDetailPanel` フッターに `TaskDeleteAction` を組み込み、`removeTask(id)` で状態更新と詳細パネル終了を行う
- `infra/main.bicep` — 既存 `tasksRole` に `Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/delete` を追加

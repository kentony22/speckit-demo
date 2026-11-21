# Implementation Plan: カスタムリスト

**Branch**: `feature/005-organize-custom-lists` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

## Summary

「タスク」（`#tasks`）に加え、左側のナビゲーションから作成済みのリストを選べるようにする。タスクを左側のカスタムリストへドラッグ＆ドロップして割り当て・移動し、「タスク」へドロップして解除する。また、カスタムリスト内から直接タスクを追加できる。保存した結果を反映し、失敗時は画面上の最後の保存状態と再試行手段を維持する。

## Technical Context

- **言語と実行環境** — TypeScript、React、Vite、JDK 25、Spring Boot 4.2、Maven。
- **保存** — Azure Cosmos DB for NoSQL の既存 `tasks` コンテナー、`/ownerId` パーティション、Java SDK の Gateway モード。
- **検証** — MockMvc、ローカルの Cosmos DB エミュレーター、Chromium、TypeScript ビルド。アプリは既存の CI に対応する。
- **範囲** — 作成・閲覧・割り当て・移動・解除。単一所有者のデモの前提を継承する。

## Constitution Check

| 原則 | 設計での対応 |
|---|---|
| I | AC-001〜AC-006 と SC-001〜SC-002 を [quickstart.md](quickstart.md) で検証する。 |
| II | 既存のタスク登録・一覧・完了操作を維持し、リストを追加した状態でも確認する。 |
| III | README の起動方法と結合テストを再利用する。 |
| IV | 既存のコンテナーとスループットを再利用する。今回はローカル実装と確認まで。既存 Azure 環境に配備する前に、データプレーンの部分更新権限と憲章の無料枠条件を確認する。 |

## Project Structure

- `backend/src/main/java/com/example/todo/tasks/` に保存モデルと API を追加する。
- `backend/src/test/java/com/example/todo/tasks/TaskListsCosmosIT.java` で API と永続化を確認する。
- `frontend/src/App.tsx` の一覧とナビゲーションを拡張し、`frontend/src/TaskLists.tsx` にリスト操作を置く。
- `frontend/src/api/tasks.ts` で既存の通信処理とタスク型を拡張する。

設計の根拠と制約は [research.md](research.md)、[データモデル](data-model.md)、[HTTP 契約](contracts/task-lists.md) に記録する。設計確認後の憲章チェックはすべて適合する。

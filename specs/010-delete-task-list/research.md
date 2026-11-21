# Research & Design Decisions: カスタムリストの削除

## 1. 削除順序と所属タスクの保護（未所属化してからリスト文書を削除）

- **Decision**: `CosmosTaskRepository.deleteList(String id)` は、まず `listExists(id)` で所有者パーティション内に対象のカスタムリストが存在することを確認したうえで、同一 `/ownerId` パーティション内で `(NOT IS_DEFINED(c.kind) OR c.kind = 'task') AND c.listId = @listId` に一致するタスクを取得し、各タスクの `/listId` のみを `null` に部分更新（`patchItem`）してから、最後にカスタムリスト文書を `deleteItem` で削除する。
- **Rationale**:
  - 所属タスクの `/listId` を `null` に戻してからリスト文書を削除することで、万一タスク更新の途中で Cosmos DB 障害（`503`）が発生してもリスト文書が残るため、ユーザーがそのまま再試行して残りの所属タスク解除とリスト削除を完了できる。
  - 部分更新（`CosmosPatchOperations.create().set("/listId", NullNode.getInstance())`）を使うため、タスク名・完了・重要・旧形式の任意フィールドを一切壊さない。
  - 既存タスクを削除せず未所属に戻す仕様（FR-002）をデータベース層で確実に保証でき、フロントエンド再読み込み後も整合する。
- **Alternatives considered**:
  - 先にリスト文書を削除してからタスクの `/listId` を更新する: タスク更新途中で失敗した場合、リスト文書が消えているため再試行時に `404` となり孤立した `listId` を持つタスクが残るリスクがあるため不採用。
  - トランザクションバッチ（`TransactionalBatch`）で一括実行する: Cosmos DB の `TransactionalBatch` は 1 バッチ最大 100 操作の上限があり、所属タスク数が多い場合に失敗するため不採用。通常のパーティション内クエリ＋逐次パッチ＋削除は件数上限がなく、途中失敗時も再試行で収束する。

## 2. ドキュメント種別・所有者境界の保護

- **Decision**: `CosmosTaskRepository.deleteList(String id)` の冒頭で `listExists(id)` を呼び出し、`TaskListDocument.isListId(id)`（`list-` プレフィックス）および同一 `ownerId` パーティション内の `kind == "task-list"` を検証する。一致しない場合（存在しない ID・別所有者のリスト ID・タスク ID・グループ ID `group-*`）はタスク更新も削除も行わず `false` を返し、コントローラーが `404 TASK_LIST_NOT_FOUND` を返す。
- **Rationale**: 単一コンテナー `tasks` に `task`・`task-list`・`list-group` の 3 種別が同居しているため、リポジトリ層で一貫してプレフィックス＋`kind`＋パーティションキーを検証することで誤削除を防ぐ。
- **Alternatives considered**:
  - `deleteItem` を直接呼び出す: タスク ID やグループ ID を渡された場合にタスクやグループを誤削除してしまうため不採用。

## 3. UI の確認ステップ・状態更新・表示中リスト削除時の遷移

- **Decision**:
  - 左ナビゲーション（`TaskListNavigation`）の各カスタムリスト行（グループ配下・未分類の両方）に「削除」ボタンを配置し、押下するとそのリスト直下にインライン確認パネル（「`{リスト名}` を削除しますか？ 所属しているタスクは「すべてのタスク」に残ります。」＋「削除する」／「キャンセル」）を表示する。
  - `TaskDeleteAction.tsx` と同様に `inFlight` ref と `deleting` 状態で連打・二重送信を防ぎ、失敗時は確認パネル内にエラーメッセージを表示してそのまま再試行できるようにする。
  - 削除成功時は、`lists` から対象リストを除き、`tasks` のうち `listId === deletedId` のタスクを `listId: null` に更新する。現在表示中のリスト（`hash === deletedId`）を削除した場合は `window.location.hash` とローカルの `hash` 状態を `tasks`（`#tasks`）へ更新し、別ビュー表示中の場合は現在の `hash` を維持する。
  - 状態遷移ロジック（リスト除外・タスク `listId` クリア・遷移先ハッシュ解決）を純粋関数として `frontend/src/taskListDeletion.ts` に切り出し、Node テストで単体検証する。
- **Rationale**: 既存のグループ「編集」操作（`TaskListNavigation`）やタスク「削除」確認 UI（`TaskDeleteAction`）と同じ操作体系に揃えることで、キーボード操作・アクセシビリティ・モバイル表示の一貫性を保ちつつ、表示中・非表示中どちらのリストでも 2 操作以内で安全に削除できる。
- **Alternatives considered**:
  - `window.confirm` ダイアログを使う: テスト・エラー再試行表示・文言制御（タスクが残ることの明示）や UI 一貫性に欠けるため不採用。
  - カスタムリストを開いているときのメイン領域ヘッダーだけに削除ボタンを置く: 他のビューを見ながら不要リストを片付けたい操作や、サイドバーの一覧管理導線と一貫しなくなるため、サイドバー各リスト行への配置を採用。

## 4. Azure 無料枠および Bicep 権限との整合

- **Decision**: `infra/main.bicep` は変更しない。
- **Rationale**: 既存の `tasks` コンテナー（`/ownerId`）と既存 `tasksRole` のデータアクション（`executeQuery`, `items/read`, `items/create`, `items/replace`, `items/delete`）が、今回必要な `readItem`・`queryItems`・`patchItem`・`deleteItem` をすべてカバーしているため。
- **Alternatives considered**: なし（追加リソース・追加権限不要）。

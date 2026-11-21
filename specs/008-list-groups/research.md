# Research & Design Decisions: リストグループ

## 1. ストレージ設計（既存コンテナー共有）

- **Decision**: リストグループは既存の `tasks` コンテナー（パーティションキー `/ownerId`）に `id: "group-<uuid>"`、`kind: "list-group"` の文書として保存し、カスタムリスト文書（`TaskListDocument`）に nullable な `groupId` を追加する。
- **Rationale**: 005 のカスタムリスト（`id: "list-<uuid>"`, `kind: "task-list"`）と同じ単一コンテナー設計に揃えることで、Cosmos DB 無料枠のスループット上限（1000 RU/s）と Bicep 定義を変更せずに導入できる。既存の `findAll()`（タスク取得）は `NOT IS_DEFINED(c.kind) OR c.kind = 'task'`、`findLists()` は `c.kind = 'task-list'` でフィルタしているため、既存の読み取りとも完全に分離される。
- **Alternatives considered**:
  - 専用の `list-groups` コンテナーを新設する: 400 RU/s の追加割り当てと Bicep・RBAC 割り当て変更が必要になり、無料枠消費と構成複雑度が増すため不採用。

## 2. タスク・リスト・グループ間の誤操作防止

- **Decision**: `CosmosTaskRepository` でタスク操作（`patchTask`, `delete`）が `list-*` および `group-*` を拒否し、リストのグループ変更（`updateListGroup`）が `list-*` 以外を拒否し、グループ名変更（`updateListGroupName`）とグループ削除（`deleteListGroup`）が `group-*` 以外を拒否し、`groupExists` が所有者パーティション内の `group-*` かつ `kind = "list-group"` のみを許可する。
- **Rationale**: 同一コンテナーに3種類の文書が共存するため、ID プレフィックスと `kind` の二重ガードで不正更新・誤削除を防ぐ。
- **Alternatives considered**:
  - コントローラー層だけで検証する: リポジトリの呼び出し経路が増えた場合に漏れやすいため、リポジトリ層で一貫して保護する。

## 3. UI でのグループ操作（開閉・名前変更・削除・リスト割り当て）

- **Decision**: 左ナビゲーションでは各グループを見出しボタン（`aria-expanded`）で折りたたみ・展開でき、同じ行からインライン編集でグループ名を変更し、確認ステップ付き（確定／キャンセル）でグループを削除できる。所属リストをグループ配下に、未分類リストを単独欄に表示する（重複なし）。リストのグループ割り当て・移動・解除は、カスタムリスト表示時のヘッダー付近に設ける `TaskListGroupAssignment` セレクト（`グループなし` / 各グループ）から1操作で変更できるようにする。
- **Rationale**: 005 のタスク所属先セレクト（`TaskListMembership`）や 007 のインライン確認付き削除（`TaskDeleteAction`）と同じ操作パターンにすることで、キーボード操作・スクリーンリーダー・テストのいずれでも扱いやすく、保存中／失敗再試行の状態も明確に表示できる。
- **Alternatives considered**:
  - ドラッグ＆ドロップのみにする: キーボード・モバイル・自動検証での操作性が下がるため、セレクト操作を基本とする。

## 4. グループ削除時の配下カスタムリストの扱い

- **Decision**: `DELETE /api/list-groups/{id}` では、同一所有者パーティションにグループが存在することを確認したうえで、その `groupId` を持つすべてのカスタムリストの `groupId` を `null` に部分更新してからグループ文書を削除し、`204 No Content` を返す。
- **Rationale**: グループを「分類フォルダ（解除可能）」として扱うことで、ユーザーのカスタムリストやタスクを誤って失うリスクを防げる。また、先に配下リストの `groupId` を解除してからグループ文書を削除する順序にすることで、途中で障害が起きてもグループ文書が残るため再試行で確実に完了できる。
- **Alternatives considered**:
  - 配下のカスタムリストやタスクまで連鎖削除する: 誤操作時のデータ損失が大きく、Microsoft To Do のグループ解除の挙動とも異なるため不採用。
  - 配下リストが残っている場合は削除を禁止する: 事前に手動で全リストを解除する手間が増えるため不採用。

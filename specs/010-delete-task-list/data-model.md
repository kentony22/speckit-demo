# データモデル

## TaskList（既存エンティティ・削除対象）

- `TaskList.id`: `"list-"` プレフィックス付きの一意な識別子。削除操作では `TaskListDocument.isListId(id)`（`"list-"` で始まること）を満たす必要がある。
- `TaskList.ownerId`: 所有者パーティションキー（サーバー側設定値）。削除対象は同一 `ownerId` パーティション内に実在する文書に限定される。
- `TaskList.kind`: 固定値 `"task-list"`。削除前に対象文書が `kind == "task-list"` であることを確認し、タスク文書およびリストグループ文書を誤削除しない。
- `TaskList.groupId`: 任意（nullable）。削除時に属していた `TaskListGroup` 自体は削除・変更しない。

## Task（既存エンティティ・リスト削除時の状態遷移）

- `Task.listId`: 任意（nullable）。所属先の `TaskList.id` を保持する。
- **リスト削除時の遷移**:
  - 削除対象の `TaskList.id` と同一 `ownerId` パーティションに属し、`(NOT IS_DEFINED(c.kind) OR c.kind = 'task')` かつ `Task.listId == deletedListId` を満たす全タスクについて、`Task.listId` を `null` に部分更新する。
  - タスク文書自体は削除しない。
  - `Task.id`・`Task.ownerId`・`Task.name`・`Task.createdAt`・`Task.completed`・`Task.important` および旧形式タスクの任意フィールドは変更せず保持する。
  - 削除対象以外のカスタムリストに所属しているタスク、または既に `Task.listId == null` のタスクは変更しない。

## TaskListGroup（既存エンティティ・影響なし）

- `TaskListGroup.id`: `"group-"` プレフィックス、`kind = "list-group"`。
- カスタムリスト削除操作に `TaskListGroup.id` が渡された場合は対象外として拒否（`404 TASK_LIST_NOT_FOUND`）し、グループ文書自体は変更・削除しない。
- グループ配下のカスタムリストが削除されても `TaskListGroup` 自体は保持される。

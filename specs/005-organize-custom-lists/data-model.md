# Data Model — カスタムリスト

| フィールド | 扱い |
|---|---|
| `TaskList.id` | `list-` と割り当てた UUID をつなげた識別子。 |
| `TaskList.ownerId` | 既存の所有者パーティションを使う。 |
| `TaskList.kind` | 固定値 `task-list`。 |
| `TaskList.name` | 空白以外を含む文字列。 |
| `TaskList.createdAt` | 作成日時。同じ日時では ID 順とし、左側の一覧は作成順に表示する。 |
| `Task.listId` | 任意のリスト ID。欠落または null は未割り当て。同じ所有者のリストを参照する。 |

割り当てまたは移動は所属先を設定し、解除は null を設定する。部分更新で名前、完了状態、作成日時を維持する。旧タスクの移行は不要。

# データモデル

## TaskList（既存エンティティの更新操作）

- `TaskList.id`: `"list-"` プレフィックス付きの識別子。名前変更は同一所有者パーティション（`ownerId`）内の `"list-"` 文書のみを対象とし、タスク ID や `"group-"` ID は拒否する。
- `TaskList.name`: 空白以外の文字を1文字以上含む文字列。空欄・半角空白のみ・全角空白のみは不可。有効な入力は前後の空白も含めてそのまま保存する。
- 名前変更時は `/name` のみを部分更新し、`TaskList.id`・`TaskList.ownerId`・`TaskList.kind`・`TaskList.createdAt`・`TaskList.groupId` および所属する `Task` 文書は変化しない。
- 画面上の編集状態は保存済みの名前と下書きを分離して保持し、キャンセル時は下書きを破棄、入力エラーまたは保存失敗時は下書きと保存済みの名前を維持する。

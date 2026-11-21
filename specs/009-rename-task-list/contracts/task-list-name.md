# HTTP Contract — カスタムリスト名の編集

| 操作 | 成功 | エラー |
|---|---|---|
| `PATCH /api/task-lists/{id}/name` | `{"name":"新しいリスト名"}` を受け付け、更新済みカスタムリスト `{id, name, groupId}` を `200` で返す。 | 空欄・空白だけ・文字列以外は `400 TASK_LIST_NAME_REQUIRED`。対象カスタムリストが見つからない（別所有者、タスク ID、グループ ID を含む）場合は `404 TASK_LIST_NOT_FOUND`。保存できなければ `503 TASK_STORAGE_UNAVAILABLE`。 |

`/name` のみを部分更新し、`groupId` と所属タスクは維持する。モデルの制約は [data-model.md](../data-model.md) を参照。

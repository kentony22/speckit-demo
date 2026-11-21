# HTTP Contract — リストグループ

| 操作 | 成功 | エラー |
|---|---|---|
| `GET /api/list-groups` | `200` と作成順の `[{id, name}]`。 | `503 TASK_STORAGE_UNAVAILABLE`。 |
| `POST /api/list-groups` | `{"name":"プライベート"}` を受け付け、`201` と `{id, name}`。 | 空欄・空白だけ・文字列以外は `400 LIST_GROUP_NAME_REQUIRED`。保存できなければ `503 TASK_STORAGE_UNAVAILABLE`。 |
| `PATCH /api/list-groups/{id}/name` | `{"name":"新しいグループ名"}` を受け付け、更新済み `{id, name}` を `200` で返す。 | 空欄・空白だけ・文字列以外は `400 LIST_GROUP_NAME_REQUIRED`。対象グループが見つからない（別所有者やタスク/リスト ID を含む）場合は `404 LIST_GROUP_NOT_FOUND`。保存できなければ `503 TASK_STORAGE_UNAVAILABLE`。 |
| `PATCH /api/task-lists/{id}/group` | `{"groupId":"group-..."}` で割り当て・移動、`{"groupId":null}` で解除。更新済みカスタムリスト `{id, name, groupId}` を `200` で返す。 | `groupId` が欠落、空文字、または文字列と `null` 以外なら `400 LIST_GROUP_ID_INVALID`。所属先グループが見つからない場合は `404 LIST_GROUP_NOT_FOUND`、対象カスタムリストが見つからない場合は `404 TASK_LIST_NOT_FOUND`。保存できなければ `503 TASK_STORAGE_UNAVAILABLE`。 |

既存の `GET /api/task-lists` および `POST /api/task-lists` の応答要素に `groupId`（未所属は `null`）を追加する。モデルの制約は [data-model.md](../data-model.md) を参照。

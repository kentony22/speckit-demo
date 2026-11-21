# HTTP Contract — カスタムリスト

| 操作 | 成功 | エラー |
|---|---|---|
| `GET /api/task-lists` | 200 と作成順の `[{id,name}]`。 | 503 `TASK_STORAGE_UNAVAILABLE`。 |
| `POST /api/task-lists` | `{"name":"仕事"}` を受け付け、201 と `{id,name}`。 | 空欄・空白だけ・文字列以外は 400 `TASK_LIST_NAME_REQUIRED`。保存できなければ 503。 |
| `PATCH /api/tasks/{id}/list` | `{"listId":"list-…"}` で割り当て・移動、`{"listId":null}` で解除。更新済みタスクを 200 で返す。 | `listId` が欠落、空、または文字列と null 以外なら 400 `TASK_LIST_ID_INVALID`。対象タスクまたは所属先が見つからない場合は、それぞれ 404 `TASK_NOT_FOUND` または `TASK_LIST_NOT_FOUND`。保存できなければ 503。 |

タスク応答に `listId` を加える。全件の GET は所属先にかかわらずタスクを一度ずつ返す。モデルの制約は [data-model.md](../data-model.md) を参照。

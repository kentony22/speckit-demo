# HTTP Contract — カスタムリストの削除

| 操作 | 成功 | エラー |
|---|---|---|
| `DELETE /api/task-lists/{id}` | `204 No Content`（応答ボディなし）。対象カスタムリストを削除し、同一所有者パーティション内でそのリストに所属していたタスクの `listId` を `null` に更新する（タスク自体は削除しない）。 | 対象カスタムリストが見つからない場合（未存在 ID、別所有者のリスト ID、タスク ID、リストグループ ID を含む）は `404 Not Found` と `{"code":"TASK_LIST_NOT_FOUND"}`。Cosmos DB 障害などで完了できない場合は `503 Service Unavailable` と `{"code":"TASK_STORAGE_UNAVAILABLE"}`。 |

## 既存エンドポイントとの整合

- 削除成功後、`GET /api/task-lists` の応答から削除済みリストが除外され、残りのカスタムリストは作成順で維持される。
- 削除成功後、`GET /api/tasks` の応答には元リスト所属タスクがそのまま残り、`listId` が `null` になっている（`name`・`completed`・`important`・`createdAt` は不変）。
- 削除成功後、`GET /api/list-groups` の応答は変化せず、既存のリストグループが維持される。

モデルの制約は [data-model.md](../data-model.md) を参照。

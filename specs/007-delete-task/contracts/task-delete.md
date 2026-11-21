# タスク削除の HTTP 契約

`DELETE /api/tasks/{id}` で指定した ID のタスクを1件削除する。リクエストボディは不要。

| 結果 | 応答 |
| --- | --- |
| 削除成功 | `204 No Content`（レスポンスボディなし） |
| タスクが見つからない、別所有者のタスク、またはカスタムリスト ID | `404 Not Found` と `{"code":"TASK_NOT_FOUND"}` |
| 保存先の障害で削除に失敗 | `503 Service Unavailable` と `{"code":"TASK_STORAGE_UNAVAILABLE"}` |

対象1件のタスク文書のみを削除する。既存の登録・一覧・完了・名前編集・重要指定・カスタムリストの契約は維持する。

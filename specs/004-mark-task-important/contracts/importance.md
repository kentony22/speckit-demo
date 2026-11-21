# 重要指定の契約

- `PATCH /api/tasks/{id}/importance` に `{"important": true}` または `{"important": false}` を送る。
- 成功は `200`。応答は `id`、`name`、`createdAt`、`completed`、`important` を持つ。既存の取得・登録・完了更新の応答にも `important` が加わる。
- 真偽値の欠落または型不正は `400 TASK_IMPORTANCE_REQUIRED`、対象なしは `404 TASK_NOT_FOUND`、ストレージ障害は `503 TASK_STORAGE_UNAVAILABLE`。
- 元の一覧は各行に重要マークを持つ。「重要」ビューには指定済みの行だけ表示する。重要マークはキーボードで操作でき、押下状態と対象名を読み取れる。

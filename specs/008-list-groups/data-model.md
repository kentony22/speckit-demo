# データモデル

## TaskListGroup

- `TaskListGroup.id`: `"group-"` プレフィックス付きの一意な識別子。
- `TaskListGroup.ownerId`: 所有者パーティションキー（サーバー側設定値）。
- `TaskListGroup.kind`: 固定値 `"list-group"`。タスク一覧・カスタムリスト一覧と文書種別を分離する。
- `TaskListGroup.name`: 空白以外の文字を1文字以上含む文字列。空欄・半角空白のみ・全角空白のみは不可。変更時は `/name` のみを部分更新し、ID・所有者・作成時刻・所属するカスタムリストは変化しない。
- `TaskListGroup.createdAt`: ISO-8601 UTC 形式の作成時刻。取得時は作成昇順（同時刻は `id` 昇順）。

## TaskList（既存エンティティの拡張）

- `TaskList.groupId`: 任意（nullable）。所属先の `TaskListGroup.id` を保持する。
  - 旧カスタムリスト文書のように `groupId` が未定義または `null` の場合は「未分類（グループ未所属）」として扱う。
  - 非 `null` の値を指定する場合は、同一 `ownerId` パーティションに実在する `TaskListGroup.id`（`group-` プレフィックスかつ `kind = "list-group"`）でなければならない。
- `TaskList` のグループ変更は `/groupId` のみを部分更新し、リスト名・作成時刻・所属するタスクには影響しない。

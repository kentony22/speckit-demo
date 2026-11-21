# Tasks: タスク名の編集

**入力** — [仕様](spec.md)、[計画](plan.md)、[データモデル](data-model.md)、[更新契約](contracts/task-name.md)

## Phase 1 — ローカル準備

- [X] T001 `README.md` を参照し、JDK、Node.js、エミュレーターの接続とテスト用所有者を準備する。

## Phase 2 — テスト基盤

- [X] T002 `backend/src/test/java/com/example/todo/tasks/TaskControllerTest.java` に更新契約の HTTP とモックテストの条件を用意する。依存 T001。

## Phase 3 — US1 タスク名を編集

- [X] T003 [US1] `backend/src/test/java/com/example/todo/tasks/TasksCosmosIT.java` で部分更新後の読み戻し、完了状態、別タスクを確認するケースを実装する。依存 T002。
- [X] T004 [US1] `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` と `TaskController.java` に、[data-model.md](data-model.md#task) の `Task.name` の検証と更新を追加する。依存 T002、T003。
- [X] T005 [US1] `frontend/src/api/tasks.ts`、`frontend/src/TaskNameEditor.tsx`、`frontend/src/App.tsx` に編集フォーム、保存、キャンセル、入力エラーと再試行を追加する。依存 T004。

## Phase 4 — 受け入れ確認

- [X] T006 `quickstart.md` の AC-001〜AC-005、バックエンド結合テストとフロントビルドを実行し、結果を記録する。依存 T005。

## 依存関係と実装戦略

T001 → T002 → T003 → T004 → T005 → T006。US1 の独立した確認は、2件のうち完了済みの1件を編集し、再読み込みして名前・完了状態・件数を照合すること。契約確定後は HTTP 結果のテストとブラウザー確認の準備を別ファイルで進められる。MVP は既存一覧での名前編集、保存、キャンセル、失敗時の再試行を含む。

## 検証結果

- `npm ci --offline` と `npm run build` が成功。
- JDK 25 と共有 Cosmos DB vNext エミュレーターで `./mvnw -B -ntp -o -Dmaven.repo.local=/tmp/speckit-m2 verify -Pbundled-web` を実行。API テスト31件、Cosmos DB 結合テスト4件が成功。
- Chrome のヘッドレス実行で、専用の所有者を使って AC-001〜AC-005 を確認。保存後の再読み込み、完了状態と件数の維持、キャンセル、空白入力で更新を送らないこと、503 後の入力保持と再試行が通過。

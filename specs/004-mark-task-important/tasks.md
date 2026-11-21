---
description: "重要指定の実装タスク"
---

# Tasks: タスクの重要指定

**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[data-model.md](data-model.md)、[契約](contracts/importance.md)、[quickstart.md](quickstart.md)

## フェーズ1 — セットアップ

- [X] T001 `README.md` の手順でローカル検証環境を確認する。

## フェーズ2 — 基盤

- [X] T002 旧文書と新規文書の `Task.important` を [data-model.md](data-model.md) に従って `backend/src/main/java/com/example/todo/tasks/TaskDocument.java` で扱う。依存 T001。

## フェーズ3 — US1 重要マークを操作する

**Goal**: 重要の付け外しと「重要」ビューを使い、再読み込みでも保存したマークと完了状態を確認できる。

**Independent Test**: 旧形式タスクと新規タスクを各1件用意し、マークの付与・解除、各操作後の再読み込み、保存エラーからの再試行を確認する。

- [X] T003 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TaskControllerTest.java` に API 検証を追加する。依存 T002。
- [X] T004 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TasksCosmosIT.java` で旧形式からの付与、解除、完了状態の保持を検証する。依存 T002。
- [X] T005 [US1] `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` でフラグだけを部分更新する。依存 T003、T004。
- [X] T006 [US1] `backend/src/main/java/com/example/todo/tasks/TaskController.java` に重要指定 API と応答を実装する。依存 T005。
- [X] T007 [US1] `frontend/src/api/tasks.ts` に重要状態と更新要求を追加する。依存 T006。
- [X] T008 [US1] `frontend/src/App.tsx` で重要マーク、再試行、「重要」ビューを実装する。依存 T007。

## フェーズ4 — 確認

- [X] T009 `infra/main.bicep` の既存タスク用ロールに更新アクションを宣言する。依存 T005。
- [X] T010 `specs/004-mark-task-important/quickstart.md` の検証手順を実行し、結果を記録する。依存 T008、T009。

## 依存関係と実装戦略

T001 → T002 → T003・T004 → T005 → T006 → T007 → T008 → T010。T009 は T005 後に着手できる。T003 と T004 は契約と永続化を別ファイルで先に確認する。MVP は US1 の全受け入れ条件を満たすこと。

## 検証結果

- JDK 25 で `./mvnw -Pbundled-web verify` を実行し、REST 27件と Cosmos DB エミュレーター結合4件が通過。ローカルの自己アタッチ制限に合わせ、Mockito をテスト JVM の Java エージェントとして指定した。
- `npm ci` と `npm run build` が成功。Bicep CLI 0.49.2 のビルドと lint が成功。
- Chrome とローカルアプリで AC-001〜AC-005 を確認。2件の行で重要指定と解除、各操作後の再読み込み、順序と完了状態の保持を確認した。HTTP 503 注入後の再試行が成功した。旧版 JAR で作成したタスクも未指定から重要に変更できた。

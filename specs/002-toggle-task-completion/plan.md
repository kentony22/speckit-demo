# Implementation Plan: タスクの完了と未完了への切り替え

**Branch**: `main`（計画作成時） | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: [完了状態の仕様](spec.md)と[タスク登録・一覧の実装計画](../001-add-list-tasks/plan.md)

## Summary

一覧の各タスクにある丸印を完了状態の切り替えボタンにする。React は変更先の状態を Spring Boot に送り、保存された状態を応答で受け取って該当行に反映する。Spring Boot は Cosmos DB の既存コンテナーで対象タスクの `completed` だけを部分更新する。完了状態のない既存データは読み取り時に未完了として扱い、最初の切り替えで状態を書き込む。

## Technical Context

| 項目 | 既存構成と今回の方針 |
| --- | --- |
| Language/Version | フロントエンドは TypeScript、バックエンドは JDK 25 |
| Primary Dependencies | React、Vite、Tailwind CSS、Spring Boot 4.2.0、Maven Wrapper、Azure Cosmos DB Java SDK 4.83.0 |
| Storage | Azure Cosmos DB for NoSQL。既存の `task-notebook` DB、`tasks` コンテナー、`/ownerId` パーティションを利用する。 |
| Testing | MockMvc の REST テスト、Cosmos DB vNext エミュレーターを使う既存の結合テスト、Chrome での受け入れ確認、GitHub Actions |
| Target Platform | ローカルのブラウザーと HTTPS Gateway 接続のエミュレーター、Azure App Service Linux F1 / Java SE 25 |
| Project Type | 個人向け Web アプリ。配備では React の静的ファイルと REST API を同じ JAR から配信する。 |
| Performance Goals | 状態の切り替えは1タスクにつき1回の部分更新で行う。更新した行は応答を使って描画する。 |
| Constraints | 既存の登録・一覧、表示順、アクセス制限、Cosmos DB の無料枠構成を維持する。 |
| Scale/Scope | 既存の1人用タスク一覧で、完了状態の表示と双方向の切り替えを追加する。 |

## Constitution Check

| 原則 | 計画時と設計後の確認 |
| --- | --- |
| I. 操作と期待結果 | AC-001〜AC-006 を末尾の検証表に対応付ける。 |
| II. 登録と再読み込みを先に成立させる | `001-add-list-tasks` の登録、一覧、再読み込み、空欄入力の受け入れ条件を回帰検証に含める。 |
| III. ローカルと GitHub Actions の再現性 | README の起動手順と既存の PR ワークフローを使う。旧形式データを結合テストで再現する。 |
| IV. Bicep と無料枠 | Azure の権限変更を既存の Bicep に定義する。後続の配備前に無料枠と what-if を確認する。 |

## Project Structure

### Documentation (this feature)

`specs/002-toggle-task-completion/` の `spec.md` と品質チェックリストを入力とし、設計判断、データモデル、API 契約、検証手順をこの `plan.md` に記録する。

### Source Code (repository root)

| パス | 実装時の変更点 |
| --- | --- |
| `frontend/src/App.tsx` | タスク行の操作ボタン、完了表示、保存中とエラーの表示 |
| `frontend/src/api/tasks.ts` | `Task.completed`、状態更新リクエスト、既存のエラー処理の再利用 |
| `backend/src/main/java/com/example/todo/tasks/` | `TaskController` の更新 API、`TaskDocument` の状態、`CosmosTaskRepository` の部分更新 |
| `backend/src/test/java/com/example/todo/tasks/` | `TaskControllerTest` と `TasksCosmosIT` の更新、互換性、異常系の検証 |
| `infra/main.bicep` | App Service のマネージド ID に、既存コンテナーの更新に必要なデータ権限を追加 |

## Phase 0 — 現行実装と設計の判断

- React の `App` はタスクの丸印を装飾として表示している。これを行ごとの操作に使えば、既存のブロック型レイアウトと一覧内の位置を維持できる。
- Spring Boot の `TaskController` は登録と一覧を提供し、`CosmosTaskRepository` がサーバーの `todo.owner-id` で対象パーティションを決める。更新にも同じ境界を適用し、API には変更先の真偽値を渡す。同じ要求が再送されても値は反転しない。
- Cosmos DB の `set` は、欠落したフィールドを追加し、存在するフィールドを更新できる。文書全体の置換を行う方式では読み取りと再書き込みが必要になり、他のフィールドに影響するため、単一フィールドの部分更新を採用する。 [Cosmos DB の部分更新](https://learn.microsoft.com/en-us/azure/cosmos-db/partial-document-update)
- App Service 用の既存カスタムロールは登録、読み取り、クエリに必要な権限を持つ。更新用に `Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/replace` を追加する設計とし、既存のロール ID と `tasks` コンテナーへの割り当てを使う。権限が原因で更新に失敗した場合は、Azure が返す権限名を確認し、原因が確定するまで配備後の検証を保留する。 [Cosmos DB データプレーン権限](https://learn.microsoft.com/en-us/azure/cosmos-db/reference-data-plane-security)

## Phase 1 — 設計と検証

### React の操作

1. 行頭の丸印を `button type="button"` にする。操作名で対象タスクが分かり、`aria-pressed` で完了状態を伝える。未完了は空の丸、完了はチェック印付きの丸で示す。クリック、タップ、キーボードで同じ操作ができる。
2. 表示中の状態から変更先を決め、対象の行だけを保存中にする。同じ行の連打を送信時に抑止し、別の行や入力欄は引き続き操作できるようにする。
3. 成功時は応答の `id` に対応する1件を差し替え、表示順と一覧件数を維持する。失敗時は確定済みの表示を保ち、対象行に再試行できることを伝える。通信が途切れて保存結果が不明な場合は、再読み込みで保存済みの状態を確認できる。

### REST API 契約

| 操作 | 契約 |
| --- | --- |
| `PATCH /api/tasks/{id}` | `Content-Type: application/json`。本文は `{"completed":true}` または `{"completed":false}`。真偽値を必須とし、欠落、`null`、文字列、数値は HTTP 400。 |
| 成功 | HTTP 200。更新後の `id`、`name`、`createdAt`、`completed` を返す。同じ値の再送でも HTTP 200 を返し、状態はその値に保つ。 |
| 対象なし | HTTP 404 と `TASK_NOT_FOUND`。サーバーが選んだ所有者パーティションに対象が存在しない場合に返す。 |
| 保存不可 | 既存のストレージ障害の処理に沿って、HTTP 503 と `TASK_STORAGE_UNAVAILABLE` を返す。 |
| `GET /api/tasks` と `POST /api/tasks` | 既存の要求形式とステータスを維持し、タスクの応答に真偽値の `completed` を追加する。新規登録の初期値は `false`。 |

Spring Boot では JSON のノード型を確認してから更新し、文字列や数値から真偽値への暗黙の変換を避ける。`ownerId` は更新リクエストから受け取らず、既存のサーバー設定から解決する。

### データモデルと保存

| 項目 | 取り扱い |
| --- | --- |
| `id` と `ownerId` | 既存の ID と所有者を使う。部分更新は ID と既存のパーティションキーによる1件指定。 |
| `name` と `createdAt` | 部分更新の対象から外し、既存の名前と作成日時を保つ。一覧は作成日時の降順、同時刻は ID 順。 |
| `completed` | Boolean フィールド。新規タスクでは `false` を保存する。既存データの欠落または `null` は読み取り時に `false` と解釈する。 |

リポジトリで `CosmosContainer.patchItem` と `set("/completed", value)` を使い、更新後の文書を応答に使う。欠落フィールドへの初回書き込みも同じ操作で行うため、一括移行は不要。成功した更新は既存の共有 Cosmos クライアントと Session 整合性の構成で読み取る。同じタスクに別の画面から更新が入った場合は、最後に保存された値を次の一覧取得で表示する。 [Java SDK の CosmosContainer](https://learn.microsoft.com/en-us/java/api/com.azure.cosmos.cosmoscontainer)

### 検証手順

[README のローカル起動・テスト手順](../../README.md)に従い、`docker compose up -d` と `./scripts/prepare-local-cosmos.sh` でエミュレーターを準備する。ブラウザー確認は `TODO_OWNER_ID` に専用の値を設定し、既存の利用データから分ける。GitHub Actions では PR のフロントビルド、`./mvnw -B -ntp verify` と Bicep のビルド・lint で検証する。固定済みの vNext イメージで部分更新を結合テストする。 [vNext エミュレーターの対応機能](https://learn.microsoft.com/en-us/azure/cosmos-db/emulator-linux)

| 対象 | 操作と期待結果 |
| --- | --- |
| AC-001・AC-002 | ブラウザーで未完了2件のうち1件を完了にし、チェック印と状態を確認する。未完了に戻せること、もう1件と一覧件数が変化しないことを確認する。 |
| AC-003 | 完了にしてブラウザーを再読み込みし、続けて未完了に戻して再読み込みする。各回で同じ ID の最後の保存状態が表示されることを確認する。結合テストでも各 PATCH 後に別の GET で確認する。 |
| AC-004 | エミュレーターに `completed` キーを含まない旧形式 JSON を直接登録する。GET で `false`、PATCH で `true`、再取得と文書の読み戻しで保存された `true` を確認する。ID・名前・作成日時・所有者が維持されることも確認する。ブラウザーでも旧形式の1件を完了にして再読み込みする。 |
| AC-005 | 新規登録時の表示と応答が未完了で、再取得でも `false` になることを確認する。登録時の Enter、空欄の抑止、一覧取得は従来の回帰項目として確認する。 |
| AC-006 | MockMvc でストレージ障害を再現し、503 を確認する。ブラウザーでは更新が失敗したときに確定済みの表示が保たれ、再試行で成功できることを確認する。 |
| API の境界 | 不正な真偽値は 400、存在しない ID と別パーティションにだけ存在する ID は 404。同じ値を繰り返し送っても反転しないことを REST または結合テストで確認する。 |
| 後続の Azure 配備 | Bicep のプレビューで意図した権限変更と無料枠構成を照合する。配備後は許可済みネットワークと合成タスクで、マネージド ID による双方向の更新、再読み込み、許可外からの HTTP 403 を確認する。 |

設計後の憲章チェックは全4項目を満たす。実装時に確認する点は、固定済みエミュレーターでの部分更新と、Azure 上のマネージド ID による更新権限。

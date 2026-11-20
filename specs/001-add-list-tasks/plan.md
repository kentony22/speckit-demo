# Implementation Plan: To DO — タスクの登録と一覧表示

**Branch**: `main` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-add-list-tasks/spec.md`

## Summary

画面下部から登録したタスクを同じ画面の一覧に表示し、ページ再読み込み時に保存済みのタスクを取得する。
最初に React、Spring Boot、Cosmos DB vNext エミュレーターを使ってローカルで一連の動作を確認する。
次に PR の CI と手動の Azure 配備を整備し、Spring Boot の単一 JAR から画面と API を提供する。

## Technical Context

| 項目 | 計画 |
| --- | --- |
| 言語・ビルド | フロントは TypeScript、React、Vite、Tailwind CSS。バックエンドは JDK 25、Spring Boot 4.2.0、Maven Wrapper。Node.js、npm、Azure SDK、エミュレーターは実装時に検証済みの版を固定する。 |
| 永続化 | Azure Cosmos DB for NoSQL。Spring Boot から Azure Cosmos DB Java SDK v4（`com.azure:azure-cosmos`）を使用する。 |
| 開発環境 | Docker Compose で Linux 版 Cosmos DB vNext エミュレーターを起動し、ホスト上の Java SDK が HTTPS の Gateway モードで接続する。Vite は `/api` をローカルの Spring Boot にプロキシする。 |
| テスト | JUnit で入力検証、REST の応答、保存失敗時の処理を確認する。エミュレーターとの結合テストとブラウザーでの受け入れ確認を行う。 |
| 配備先 | Azure App Service Linux F1、Java SE 25。Azure 上の Cosmos DB と App Service は Bicep で定義する。 |
| 性能と範囲 | 個人ユーザー1人、単一の小規模タスク一覧。編集、完了、重要の指定、カスタムリスト、検索は後続。画面再読み込み後に全件を確認できることを優先する。 |

Spring Boot 4.2.0 は Maven Central 向けに正式公開されている。App Service の Linux 言語サポートにも
Java 25 が掲載されている。対象環境での F1 との組み合わせは配備前に確認する。
[Spring Boot 4.2.0 リリース](https://spring.io/blog/2026/11/19/spring-boot-4-2-0-available-now/)・[App Service ランタイム](https://learn.microsoft.com/en-us/azure/app-service/language-support-policy)

## Constitution Check

| 憲章の原則 | 設計に反映した内容 | 完了時の確認 |
| --- | --- | --- |
| I. 操作と期待結果を記録する | 仕様の AC-001〜AC-005 をローカル検証に対応付ける。 | 各受け入れ条件の結果を記録する。 |
| II. 登録から再読み込み後の一覧表示までを先に作る | マイルストーン1で画面、API、DB をつなぐ。 | 登録済みのタスクが再読み込み後も表示される。 |
| III. ローカルと GitHub Actions で検証を再現する | 起動・テスト手順を README に記載し、PR でビルドとテストを実行する。 | 手順どおりにローカルで動き、PR の検証が通る。 |
| IV. Bicep と確認済みの無料枠を使う | Bicep に F1、Cosmos DB の無料枠、1リージョン、固定400 RU/s、上限1,000 RU/s を定義する。 | 対象サブスクリプションで利用条件を確認し、what-if の差分を確認してから作成する。 |

設計レビューで I〜III を計画に反映した。IV の利用資格とクォータは、対象環境が決まった時点で
配備前に確認する。無料枠と指定構成を確認できない場合は、ローカル開発と PR 検証まで進め、Azure への配備は保留する。

## Project Structure

### Documentation (this feature)

```text
specs/001-add-list-tasks/
├── spec.md
├── checklists/requirements.md
└── plan.md
```

### Source Code (repository root)

以下のファイルとディレクトリは後続の実装で追加する。

```text
frontend/                 # React の画面、型、API 呼び出し、ビルド設定
backend/
├── pom.xml               # JDK 25、Maven、Spring Boot、静的ファイル同梱
├── src/main/             # REST API、入力検証、Cosmos DB 接続
└── src/test/             # 単体、HTTP、エミュレーター結合テスト
compose.yaml              # ローカルの Cosmos DB vNext
infra/main.bicep          # Azure の App Service、Cosmos DB、アクセス設定
.github/workflows/
├── ci.yml                # PR 検証
└── deploy.yml            # 手動配備
README.md                 # 起動、テスト、配備前確認の手順
```

フロントとバックエンドは個別にビルドできる構成にし、Azure では同じオリジンの
`/` と `/api/tasks` を1つの JAR で配信する。

## マイルストーン1 — ローカルで動かす

### データモデルとパーティション設計

- DB 名は `task-notebook`、コンテナー名は `tasks`、パーティションキーのパスは `/ownerId` とする。
- タスク1件を `id`（サーバー生成 UUID）、`ownerId`（サーバー設定の `demo-user`）、
  `name`（タスク名）、`createdAt`（UTC の日時）を持つ JSON ドキュメントとして保存する。
  `ownerId` はブラウザーのリクエストから受け取らない。
- 登録時はドキュメントとリクエストのパーティションキーに同じ `ownerId` を使う。一覧取得時は
  Java SDK のクエリオプションにも同じキーを指定し、結果ページを最後まで読み取る。
  1人分の登録と全件取得が1つの論理パーティションで完結し、別パーティションへのクエリを避けられる。
  ID をパーティションキーにするとタスクの追加先が分かれ、ユーザー単位の一覧取得が
  複数パーティションにまたがる。単一ユーザーのデモでは、全タスクを同じパーティションに
  置く方がこのアクセスパターンに合う。
  [Cosmos DB Java SDK のクエリ最適化](https://learn.microsoft.com/en-us/azure/cosmos-db/performance-tips-query-sdk)
- App Service は単一インスタンスで稼働させ、Spring Boot のプロセス内で Cosmos クライアントを共有する。
  Cosmos DB の Session 整合性とクライアントのセッショントークンを使い、保存直後の GET でも書き込みを読み取れるようにする。
  [Cosmos DB の Session 整合性](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-manage-consistency)
- 実装の初期値として、取得したタスクをサーバー側で `createdAt` の降順、同値なら `id` 順に整列する。
  表示順は仕様で未確定のため、この順序は受け入れ条件に含めない。デモの規模なら取得後に整列できる。

### REST API と画面

| 操作 | 応答 |
| --- | --- |
| `GET /api/tasks` | `200` とタスクの配列。0件では `[]`。DB エラー時は `503` を返し、画面でも未登録状態と区別する。 |
| `POST /api/tasks`、本文は `{"name":"牛乳を買う"}` | DB の保存成功後に `201` と登録済みタスクを返す。名前の欠落、空欄、空白だけの入力は `400`、保存失敗は `503`。 |

応答のタスク項目は `id`、`name`、`createdAt`。エラーには画面で判別できるエラーコードを使い、
DB の内部情報や接続情報を含めない。空白には全角スペースも含め、フロントとバックエンドで同じ
判定を使う。API 側でも必ず検証し、無効な入力で書き込みを行わない。

初回表示と再読み込みでは GET の結果を使う。初期ロードが完了して0件なら未登録メッセージを出す。
画面下部の入力欄で Enter を押すと登録する。空欄・空白のみの場合と日本語 IME の変換確定時は登録しない。
登録時は処理中の連打を防ぎ、`201` を受け取ってから戻ったタスクを同じ一覧に反映し、入力欄を空にする。
保存に失敗した場合は件数と入力を保ち、画面上で失敗を伝える。

### ローカル環境と検証

1. Compose でエミュレーターを `--protocol https` で起動する。API ポート8081と準備確認用ポート8080は
   ループバックに割り当て、`/ready` の成功を待つ。Spring Boot のローカルポートは8082とする。
   必要なデータをコンテナー再作成時も保持できるよう `/data` に Compose のボリュームを使う。
2. エミュレーターの証明書を開発・CI 専用の Java トラストストアにインポートし、JVM に指定する。
   証明書を変更する再起動後は、トラストストアを更新する。
   ローカル用キーと `https://localhost:8081` を使い、`gatewayMode()` で接続する。ローカル初期化で
   DB とコンテナーを存在しない場合だけ作成し、既存コンテナーのキー定義を確認する。
   エミュレーターでは登録・一覧の互換性を確認し、認証と実際の RU 設定は Azure で検証する。
   [Cosmos DB vNext エミュレーター](https://learn.microsoft.com/en-us/azure/cosmos-db/emulator-linux)
3. README に必要なバージョン、Compose 起動、証明書設定、Maven と Vite の起動・テストコマンドを記載する。
   ブラウザーの登録・再読み込みと、空欄・空白の拒否まで、README を使って再現する。

| 受け入れ条件 | 確認方法 |
| --- | --- |
| AC-001 | 空のテスト用コンテナーで画面を開き、未登録の表示を確認する。 |
| AC-002 | 画面下部で「牛乳を買う」と入力して Enter を押し、同じ画面に1件増えることを確認する。 |
| AC-003 | 3件を登録して画面を再読み込みし、3件それぞれが1件ずつ残ることを確認する。結合テストでは登録後の GET で Cosmos DB に保存された内容を検証する。 |
| AC-004 | 空欄、半角スペースだけ、全角スペースだけで Enter を押し、登録リクエストやエラー表示が発生せず、件数が変わらないことを確認する。REST テストでも `400` と書き込みなしを確認する。 |
| AC-005 | テストで保存失敗を再現し、失敗が表示され、一覧件数と入力内容が保たれることを確認する。 |

## マイルストーン2 — CI と Azure への配備

### PR の検証と JAR の組み立て

- `pull_request` でフロントの `npm ci` と `npm run build`、バックエンドの JDK 25 を使った
  Maven Wrapper の `verify` を実行する。結合テストに同じ vNext イメージと HTTPS 設定を使い、
  テストデータをジョブ間で分離する。PR の検証に Azure の認証情報は不要。
- 配備用ビルドでは `frontend/dist/` を Maven のビルド出力の `static/` にコピーしてから
  Spring Boot の実行可能 JAR にまとめる。JAR 内の `BOOT-INF/classes/static/` に `index.html` と
  アセットが含まれることを確認し、同じ JAR を配備する。画面は相対パスで REST API を呼ぶ。

### Azure の構成と無料枠の確認

- Bicep で Linux F1 の App Service プランと Java SE 25 の Web App を定義する。Cosmos DB は
  NoSQL のプロビジョニング済みスループット構成とし、アカウント作成時に
  `properties.enableFreeTier: true`、`properties.capacity.totalThroughputLimit: 1000` を設定する。
  `locations` は1リージョン、`tasks` コンテナーの `options.throughput` は固定400 RU/s とする。
  DB 側の共有スループットとオートスケールは設定しない。
  [Cosmos DB の Bicep 定義](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/manage-with-bicep)・[アカウントのスループット上限](https://learn.microsoft.com/en-us/azure/cosmos-db/limit-total-account-throughput)
- 対象サブスクリプションで Cosmos DB の無料アカウント枠が空いているか、F1 のクォータ・リージョンと
  Java SE 25 のランタイムが利用できるか、保存量などの利用見込みが無料枠に収まるかを確認する。
  F1 は `az appservice list-locations --sku F1 --linux-workers-enabled`、ランタイムは
  `az webapp list-runtimes --os linux --runtime java` を確認する。`linuxFxVersion` の候補は
  `JAVA|25-java25` とし、実際のサブスクリプションとリージョンで ARM の検証も行う。
  what-if は変更の予測に使い、無料枠の資格は別途確認する。
  [Cosmos DB 無料枠](https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier)・[App Service Linux 料金](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/)・[App Service CLI](https://learn.microsoft.com/en-us/cli/azure/appservice)・[Java ランタイムの確認](https://learn.microsoft.com/en-us/azure/app-service/configure-language-java-deploy-run)
- Azure では App Service のマネージド ID と Cosmos DB のデータプレーン RBAC で接続する。
  アプリに必要なメタデータ参照、タスクの作成・取得・クエリ権限を付与し、DB とコンテナーの
  作成は Bicep 側で行う。
  [Cosmos DB の Microsoft Entra 認証と RBAC](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-connect-role-based-access-control)

### 手動ワークフロー

1. `workflow_dispatch` で対象環境を選び、前述のテストと JAR の組み立てを実行する。
2. 配備ジョブを GitHub Environment にひも付け、事前に設定した Entra フェデレーションと
   `id-token: write` を使って `azure/login` で OIDC 認証する。対象リソースグループでの Bicep 配備と
   JAR 配備に必要な権限を、このワークフローの ID に付与する。
   [GitHub Actions から Azure への OIDC 接続](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)
3. 無料枠の確認結果を確認し、対象リソースグループ、同じ Bicep とパラメーターで
   `az deployment group what-if` を実行する。無償構成を確認できない場合、または意図しない
   作成・変更や解消できない差分診断がある場合は、リソース作成に進まない。
   [Bicep what-if](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-what-if)
4. `az deployment group create` でリソースを作成・更新し、`az webapp deploy --type jar` で
   テスト済みの JAR を配備する。ランタイムと Cosmos DB の設定が計画どおりであることを確認する。
   [App Service への Java 配備](https://learn.microsoft.com/en-us/azure/app-service/configure-language-java-deploy-run)
5. アプリの起動を期限付きで待ち、対象環境へのアクセスを許可された経路で `/` と静的アセットを確認する。
   `POST /api/tasks` に実行ごとに識別できるテスト名を送り `201` を確認し、別の GET で同じ ID と
   名前を取得できること、空白の POST が `400` になることを確認する。初回の配備確認では
   ブラウザーでも登録と再読み込みを確認する。書き込みを伴う確認はデモ環境と合成データに限定する。

## 未決事項

| 項目 | 確認・決定の時期 |
| --- | --- |
| 配備先サブスクリプション、リージョン、リソースグループとリソース名 | Azure 配備前に決める。F1 と Java SE 25 の組み合わせ、F1 クォータ、Cosmos DB 無料枠の空き、ストレージなどの無料枠条件を対象環境で確認する。 |
| デモ画面・API の公開範囲と配備後確認のアクセス方法 | Azure 配備前に決める。個人データを扱う場合は、画面と API の双方で許可した利用者だけがアクセスでき、ワークフローも認可された経路で確認できる構成にする。 |
| 未登録・エラーの文言とタスクの表示順 | 画面実装時に確定する。作成日時の新しい順を初期値とする。 |
| Node.js、Cosmos DB Java SDK、vNext イメージの固定バージョン | ローカル実装時に JDK 25 との組み合わせで登録・一覧取得を確認して固定する。 |

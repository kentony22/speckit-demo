# Tasks: To DO — タスクの登録と一覧表示

**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[プロジェクト憲章](../../.specify/memory/constitution.md)

## タスクの読み方

各タスクの「依存」に示す ID が完了してから着手する。`[P]` は依存解消後に別ファイルのタスクと並行できること、`[US1]` は仕様のユーザーストーリー1に対応することを示す。パスはリポジトリルート基準。

## フェーズ1 — ローカルでタスク登録・一覧表示

**目標** — 画面下部から登録し、Cosmos DB に保存したタスクを同じ画面で確認できるようにする。

### セットアップと共通基盤

- [X] T001 [P] `frontend/package.json`、`frontend/package-lock.json`、`frontend/vite.config.ts`、`frontend/src/index.css` に React・TypeScript・Vite・Tailwind CSS をセットアップし、Node.js と npm の版を固定し、`/api` をローカルの Spring Boot（8082）にプロキシする。依存なし。
- [X] T002 [P] `backend/pom.xml`、`backend/mvnw`、`backend/.mvn/wrapper/maven-wrapper.properties` に JDK 25・Spring Boot 4.2.0・Maven Wrapper・Cosmos DB Java SDK v4・JUnit のビルド構成を作り、SDK の版を固定する。`backend/src/main/java/com/example/todo/TaskApplication.java` に起動クラスを置く。依存なし。
- [X] T003 [P] `compose.yaml` に検証済みの Cosmos DB vNext イメージ、HTTPS、ループバックの API ポート8081・準備確認ポート8080、`/ready` の確認、`/data` のボリュームを設定する。依存なし。
- [X] T004 `scripts/prepare-local-cosmos.sh` でエミュレーターの起動を待ち、証明書をローカル・CI 専用の Java トラストストアに取り込めるようにする。証明書が再生成された場合は再取得できるようにする。依存 T002、T003。
- [X] T005 `backend/src/main/resources/application-local.yml` と `backend/src/main/java/com/example/todo/cosmos/LocalCosmosConfiguration.java` で HTTPS の Gateway モードのクライアントを共有し、ローカル用キーで接続する。`task-notebook` DB と `/ownerId` をキーとする `tasks` コンテナーを必要時に作成し、既存コンテナーのキー定義も確認する。依存 T004。

### US1 — タスクを登録してあとから確認する（P1）

**独立検証** — 空のローカル環境で画面を開き、下部の入力欄から登録する。同じ一覧に表示されることを確認し、ページを再読み込みして登録済みタスクを確認する。

- [X] T006 [P] [US1] `backend/src/main/java/com/example/todo/tasks/TaskDocument.java` と `backend/src/main/java/com/example/todo/tasks/CosmosTaskRepository.java` に JSON 保存と一覧取得を実装する。サーバーで UUID・UTC 作成日時・固定の所有者 ID を設定し、書き込みと一覧取得を同じ `/ownerId` に限定する。取得結果は全ページを読む。依存 T005。
- [X] T007 [P] [US1] `frontend/src/api/tasks.ts` に `GET /api/tasks` と `POST /api/tasks` のクライアントを作り、成功応答と入力・保存・取得エラーを扱う。依存 T001。
- [X] T008 [US1] `backend/src/main/java/com/example/todo/tasks/TaskController.java` に一覧と登録の REST API を実装する。計画どおり `200`・`201`・`400`・`503` を返し、空欄と半角・全角空白だけの名前を保存前に拒否する。依存 T006。
- [X] T009 [US1] `frontend/src/App.tsx` と `frontend/src/index.css` にタスク一覧と画面下部の入力欄を実装する。初期取得で未登録と取得失敗を区別し、Enter で登録する。空欄・空白だけの状態ではリクエストもエラー表示も行わず、保存成功時に一覧を更新する。保存失敗時は入力と一覧を保ってエラーを表示する。依存 T007。
- [X] T010 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TaskControllerTest.java` に REST テストを追加し、空の一覧、登録成功、欠落・空欄・半角／全角空白の拒否と書き込み未実行、保存・取得失敗時の応答を確認する。依存 T008。
- [X] T011 [P] [US1] `backend/src/test/java/com/example/todo/tasks/TasksCosmosIT.java` と `backend/pom.xml` に結合テストと実行設定を追加し、分離したデータで REST の登録後に別の GET を行い、実際のエミュレーターから名前と ID を取得できることを確認する。依存 T008。
- [X] T012 [US1] `README.md` にバージョン、Compose・証明書設定・Maven・Vite の起動とテスト手順を記載し、その手順で AC-001〜AC-005 と SC-001〜SC-003 を確認する。画面で0件表示、登録後の表示、3件の再読み込み、空欄と半角・全角空白の拒否、保存失敗時の表示と件数維持を確認して結果を記録する。依存 T009、T010、T011。

**完了条件** — README の手順でローカル起動とテストを再現できる。HTTPS の Gateway 接続と `/ownerId` のコンテナー構成が機能し、バックエンドテストが通り、ブラウザーで AC-001〜AC-005 と SC-001〜SC-003 を確認できる。

## フェーズ2 — GitHub Actions で CI

- [X] T013 `.github/workflows/ci.yml` に `pull_request` のフロント・バックエンドジョブを設定する。固定した Node.js で `npm ci` と `npm run build`、JDK 25 で Maven Wrapper の `verify` を実行する。バックエンドでは同じ vNext イメージと証明書設定を使い、結合テスト用のデータを分離する。依存 T012。
- [X] T014 `README.md` に PR の検証内容と確認手順を記載し、PR の実行結果からフロントのビルド、バックエンドのテストと Cosmos DB 結合テストの成功を確認する。依存 T013。

**完了条件** — PR を対象とする GitHub Actions で両ジョブが実際に成功する。PR の検証には Azure 認証が不要で、ローカルと同じバックエンドテストを実行できる。

## フェーズ3 — Azure への配備

### 対象環境とアクセスの確定

- [X] T015 [P] 配備用のローカルメモに対象サブスクリプション、リージョン、リソースグループとリソース名を記録する。対象環境で Linux F1 のクォータと Java SE 25 の併用可否、Cosmos DB 無料アカウント枠の空き、スループット・ストレージの利用見込みを確認し、根拠を記録する。未確認ならリソース作成を保留する。依存 T014。
    - F1 の可否、構成全体の ARM 事前検証、Cosmos DB Free Tier の空きを確認。配備先と確認結果の詳細は Git の追跡対象外のローカルメモに記録。
- [X] T016 [P] `backend/pom.xml` でビルド済み `frontend/dist/` を Maven のビルド出力の `static/` に取り込み、実行可能 JAR を組み立てる。JAR 内に `index.html` と静的アセットが入り、同じオリジンの画面と API が応答することを確認する。依存 T014。
- [X] T017 `README.md` に画面と API の公開範囲、配備後の確認に使うアクセス経路と認証方法を決定して記録する。個人データを扱う場合は画面と API の双方にアクセス制御を適用する。依存 T015。

### 配備の実装と検証

- [X] T018 [P] `infra/main.bicep` に Linux F1・Java SE 25 の単一インスタンス、HTTPS、マネージド ID と決定済みのアクセス設定を定義する。Cosmos DB NoSQL は作成時に `enableFreeTier: true`、1リージョン、`tasks` の固定400 RU/s、`capacity.totalThroughputLimit: 1000` とする。`/ownerId` の定義と Cosmos DB データプレーン RBAC を含める。依存 T015、T017。
    - 検証者 IP の許可、SCM の分離、Cosmos DB データプレーン RBAC を定義。Bicep CLI 0.49.2 でコンパイルと lint を確認。
- [X] T019 [P] `backend/src/main/resources/application-azure.yml` と `backend/src/main/java/com/example/todo/cosmos/AzureCosmosConfiguration.java` に Azure 用の接続を実装する。App Service のマネージド ID で Bicep が作成したコンテナーを使い、共有 Cosmos クライアントと Session 整合性を設定する。依存 T017。
- [X] T020 GitHub Environment と Entra フェデレーションを設定し、対象環境の設定詳細を Git の追跡対象外のローカルメモに記録する。GitHub Actions の配備 ID に対象リソースグループでの Bicep と JAR の配備権限を付与する。依存 T017、T018。
    - `main` 限定の Environment、OIDC フェデレーション、環境シークレット4件、専用リソースグループ限定の Contributor のみを確認。リソースグループ内は空。
- [X] T021 `.github/workflows/deploy.yml` に `workflow_dispatch`、テストと JAR ビルド、OIDC 認証、対象環境での ARM 検証と what-if、リソース作成・更新、テスト済み JAR の配備を実装する。無料条件が未確認、または what-if に想定外・未解決の差分がある場合は作成前に停止する。依存 T016、T018、T019、T020。
    - 手動プレビューで OIDC、ARM プロバイダー検証、what-if が成功。差分は定義した11件の作成のみで、プレビュー後も専用リソースグループ内は空。実配備は配備直前の無料枠再確認後に実施する。
    - 初回の Bicep 適用とテスト済み JAR の配備が成功。SCM の一時許可の削除を確認。
- [ ] T022 `.github/workflows/deploy.yml` に起動待ちと配備後の確認を追加する。決定済みの認証とアクセス経路を使い、画面と静的アセット、合成タスクの POST `201`、別の GET で同一 ID と名前の取得、空白の POST `400` を確認する。依存 T021。
- [ ] T023 `README.md` に手動ワークフローの実行と結果確認の手順を記録する。無料枠を確認済みの環境で実行し、適用後の F1・Java SE 25 と Cosmos DB 設定、配備後の確認結果、初回のブラウザー登録と再読み込みを確認する。依存 T022。

**完了条件** — 対象環境の無料条件とアクセス方式が確定し、手動ワークフローが OIDC、what-if、Bicep 配備、JAR 配備、動作確認まで成功する。配備先で画面と API が動作し、登録した合成タスクが再読み込み後も確認できる。

## 依存関係と実装順

- フェーズ1は `T001〜T012` で完結する。フェーズ2は `T012` の完了後、フェーズ3は `T014` の完了後に着手する。
- US1 は唯一のユーザーストーリー。ローカル基盤を使って実装し、独立検証で完了を判定する。
- 並行実行例として、最初に `T001・T002・T003`、API 実装後に `T010・T011` をそれぞれ並行できる。フロントは `T007` の完了後、REST API と並行して `T009` を進められる。

## 実装戦略

MVP はフェーズ1。Spec Kit で実装する際は、`$speckit-implement フェーズ1（T001〜T012）のみ実行し、フェーズ1の完了条件を確認して終了してください` と指定する。続くフェーズは、前のフェーズの完了条件を満たした時点で順に実施する。

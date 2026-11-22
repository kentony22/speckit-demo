# speckit-demo

**Spec Kit** を用いた仕様駆動開発（Spec-Driven Development）で構築した、To Do Web アプリケーションのデモ。
各機能の仕様・設計・タスクは [`specs/`](specs/) 配下で管理する。

## 主な機能

- タスクの登録・一覧表示・完了切替・重要マーク・名前編集・削除
- カスタムリストとリストグループの作成・名前編集・削除・開閉
- ドラッグ＆ドロップによるタスクのリスト移動／解除、およびリストのグループ移動／解除
- 全タスク横断のインクリメンタル検索
- レスポンシブレイアウト・ダークモード切替

## 技術アセット一覧

| 領域 | 技術・ツール |
| --- | --- |
| 仕様駆動開発 | Spec Kit（[`specs/`](specs/)、`.specify/`、`.agents/skills/`） |
| フロントエンド | React 19.2 / TypeScript 5.9 / Vite 7.3 / Tailwind CSS 4.2 / Node.js 26.13.1 / npm 11.20.0 |
| バックエンド | Java 25 / Spring Boot 4.2.0 / Maven Wrapper |
| データベース・SDK | Azure Cosmos DB for NoSQL（`azure-cosmos` 4.83.0 / `azure-identity` 1.19.0） |
| ローカル検証環境 | Docker Compose / Azure Cosmos DB Linux vNext エミュレーター |
| インフラ（IaC） | Azure App Service（Linux F1・Java SE 25） / Azure Cosmos DB Free Tier / Bicep（[`infra/main.bicep`](infra/main.bicep)） |
| CI / CD | GitHub Actions（[`ci.yml`](.github/workflows/ci.yml) / [`deploy.yml`](.github/workflows/deploy.yml)・OIDC 認証） |

## ローカル起動

必要なツールは Node.js 26.13.1、npm 11.20.0、JDK 25、Docker Compose、curl、OpenSSL。

### 1. エミュレーター

Docker を起動し、リポジトリルートで次のコマンドを実行する。

```bash
docker compose up -d
./scripts/prepare-local-cosmos.sh
```

接続先は `https://localhost:8081`（HTTPS Gateway モード）。Java 用のトラストストアは
`.local/cosmos.p12` に保存される。コンテナーの再起動後に SSL エラーが出た場合は、
`./scripts/prepare-local-cosmos.sh` を再実行してからバックエンドを再起動する。

### 2. バックエンド

別のターミナルでリポジトリルートから Spring Boot を起動する。

```bash
cd backend
JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=\"$PWD/../.local/cosmos.p12\" -Djavax.net.ssl.trustStorePassword=changeit" \
    ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

### 3. フロントエンド

別のターミナルでリポジトリルートから Vite を起動し、ブラウザーで
[http://127.0.0.1:5173/](http://127.0.0.1:5173/) を開く。

```bash
cd frontend
npm ci
npm run dev
```

Vite は `/api` をポート8082の Spring Boot に転送する。
初回起動時に `task-notebook` DB と `tasks` コンテナー（パーティションキーは `/ownerId`）を作成する。
データは Compose ボリュームに保持される。

### 停止

バックエンドとフロントエンドのターミナルで Ctrl+C を押す。
エミュレーターはリポジトリルートで `docker compose stop` を実行して停止する。

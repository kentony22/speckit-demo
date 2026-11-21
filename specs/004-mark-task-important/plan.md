# Implementation Plan: タスクの重要指定

**Branch**: `feature/004-mark-task-important` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

## Summary

タスク行に重要マークを追加し、同じタスク列から「重要」ビューを表示する。重要状態は既存タスク文書の1項目として保存し、完了状態と独立して変更できる。

## Technical Context

| 項目 | 設計 |
| --- | --- |
| Language/Version | TypeScript、Java 25 |
| Primary Dependencies | 既存の React、Vite、Spring Boot、Cosmos DB Java SDK |
| Storage | Cosmos DB の既存タスク文書と所有者パーティション |
| Testing | MockMvc、Cosmos DB エミュレーター、Chrome の受け入れ確認 |
| Target Platform | ブラウザー、ローカル Spring Boot、既存 Azure 構成 |
| Project Type | To Do Web アプリ |
| Performance Goals | 重要ビューを開く操作では追加リクエストを送らず、読み込んだ順序で直ちに表示する。 |
| Constraints | 登録済みの旧文書を読み取れること。既存の無料枠構成と完了指定を保つ。 |
| Scale/Scope | 個人の一覧、重要フラグの付け外し、「重要」ビュー |

## Constitution Check

設計前と設計後に確認した。AC-001〜AC-005 は [検証手順](quickstart.md) で操作と期待結果に対応付ける。既存の登録、再読み込み、完了の再保存は Maven の既存テストを通す。ローカル起動は既存 README の手順を使い、REST と永続化の検証は既存 GitHub Actions が実行する Maven テストに含める。Azure のタスク用データロールに既存文書の更新権限だけを宣言する。リソース構成、無料枠設定、既存ロール割り当てを保つ。

## Project Structure

### Documentation (this feature)

- [research.md](research.md) の設計判断
- [data-model.md](data-model.md) のデータ定義
- [API と画面の契約](contracts/importance.md)
- [quickstart.md](quickstart.md) の再現手順
- 実装順は `tasks.md` に記録する。

### Source Code (repository root)

- `frontend/src/App.tsx` でマークと「重要」ビューを実装する。
- `frontend/src/api/tasks.ts` で状態表現と更新 API を扱う。
- `backend/src/main/java/com/example/todo/tasks/` に文書の互換性と部分更新を実装する。
- `backend/src/test/java/com/example/todo/tasks/` で API と永続化を検証する。
- `infra/main.bicep` の既存タスク用ロールに更新権限を追加する。

## Integration

画面ではタスクの単一の状態を使い、重要ビューは表示時に抽出する。状態更新が失敗した場合は最後に保存した表示を保持し、同じマークから再試行できる。ビューの選択は URL の `#important` と `#tasks` で表し、再読み込みで復元する。

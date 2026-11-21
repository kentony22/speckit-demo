# Implementation Plan: タスク名の編集

**Branch**: `feature/003-edit-task-name` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

## Summary

一覧の各タスクに編集操作を追加する。編集中は保存済みの名前と下書きを分け、保存成功時に対象行の名前を更新する。Spring Boot から同じ Cosmos DB パーティション内の対象文書に名前の部分更新を行う。

## Technical Context

- React、TypeScript、Vite と既存の Spring Boot / JDK 25 を使う。
- 保存先は既存の Cosmos DB `tasks` コンテナー。ローカルの結合テストでは同じ vNext エミュレーターを使う。
- 既存の一覧表示、登録、完了操作は同じ画面に残る。編集は1タスクの名前を1回の更新で保存する。

## Constitution Check

仕様の AC-001〜AC-005 を API テスト、エミュレーター結合テスト、ブラウザー操作に対応付ける。既存の登録・一覧・完了は回帰テストの対象に含める。既存のローカル手順と CI の Maven テスト・フロントビルドを利用する。Azure 配備は後続工程で扱い、Bicep と無料枠の確認を前提とする。設計後も各原則を満たす。

## Project Structure

- `frontend/src/TaskNameEditor.tsx` に編集、入力エラー、キャンセル、再試行をまとめる。`frontend/src/App.tsx` の既存タスク行へ組み込む。
- `frontend/src/api/tasks.ts` に名前の更新を追加する。
- `backend/src/main/java/com/example/todo/tasks/TaskController.java` と `CosmosTaskRepository.java` に検証と1項目の部分更新を追加する。
- [データモデル](data-model.md)、[更新契約](contracts/task-name.md)、[判断記録](research.md)、[確認手順](quickstart.md) を参照する。

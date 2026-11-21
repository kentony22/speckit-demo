# Implementation Plan: タスク名の検索

**Branch**: `feature/006-search-task-names` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

## Summary

検索欄の入力に応じて、既存の全タスク一覧をタスク名の部分一致で絞り込む。通常ビューの一覧と検索語を独立させ、検索語を消すと元の一覧を表示する。

## Technical Context

- **言語と依存関係** — TypeScript 5.9、React 19、Vite 7、Tailwind CSS 4、Node.js 26
- **データ** — 既存の `GET /api/tasks` の全件データと順序を使用。検索語は画面の状態として保持する
- **検証** — Node のテストランナー、フロントエンドの型チェックとビルド、Chrome でのローカル操作
- **対象** — 個人向け Web アプリ。検索は入力更新ごとに全件データを一度走査する
- **統合条件** — 通常ビューの一覧を表示側で選択し、検索処理には全件と通常ビューの一覧を渡す。ハッシュと通常ビューの選択は既存のナビゲーションが管理する

## Constitution Check

計画前と設計後に確認し、すべての適用原則を満たす。

- I — AC-001〜004 に対応するテストと操作手順を用意する。
- II — 既存の登録・永続化・再読み込みフローを維持し、ローカル確認に含める。
- III — ローカルの手順を [quickstart.md](quickstart.md) に記録し、既存 CI のフロントエンドビルドに検索のテストを含める。
- IV — Azure 環境の変更と配備は今回の対象外。

## Project Structure

| パス | 変更内容 |
| --- | --- |
| `specs/006-search-task-names/` | 仕様、計画、調査、データモデル、画面契約、確認手順、タスク |
| `frontend/src/App.tsx` | 検索欄と結果表示を既存の一覧に組み込む |
| `frontend/src/taskSearch.ts` | 全件データと通常ビューを入力とする検索処理 |
| `frontend/tests/taskSearch.test.mjs` | リスト横断、照合、該当なし、元のビューの復元を検証 |
| `frontend/package.json`、`.github/workflows/ci.yml` | ローカルと CI から検索テストを実行 |

---
description: "タスク名の検索の実装と確認"
---

# Tasks: タスク名の検索

**Input**: `specs/006-search-task-names/` の仕様・計画・調査・データモデル・画面契約・確認手順

## Phase 1: Setup

- [X] T001 `.specify/feature.json` の対象ディレクトリと `specs/006-search-task-names/checklists/requirements.md` の完了状態を確認する

## Phase 2: Foundational

- [X] T002 `frontend/src/App.tsx` と `frontend/src/api/tasks.ts` で全件データの取得・順序・更新を確認し、検索の入力として再利用する

## Phase 3: User Story 1 - タスク名の検索 (P1)

**Goal**: 検索欄でリスト横断の名前検索を行い、解除時に元の一覧を表示する。

**Independent Test**: 2つのリストにまたがる一致タスクと不一致のタスクから、相対順・完了状態・大小文字・該当なし・復帰を確認する。

- [X] T003 [US1] `frontend/tests/taskSearch.test.mjs` に AC-001〜004 の検索ロジックを確認するフィクスチャを追加し、実装前の失敗を確認する
- [X] T004 [US1] `frontend/src/taskSearch.ts` に全件と通常ビューを受け取る絞り込み処理を実装し、`specs/006-search-task-names/data-model.md` のタスク名（`Task.name`）と検索語を照合する
- [X] T005 [P] [US1] `frontend/package.json` に検索のテストコマンドを追加する
- [X] T006 [US1] `frontend/src/App.tsx` に独立した検索語の状態、検索欄、表示一覧、該当なし表示を組み込む

## Phase 4: 検証

- [X] T007 [P] `.github/workflows/ci.yml` で検索テストを実行する
- [X] T008 `specs/006-search-task-names/quickstart.md` に基づき、ローカルテストと可能な Chrome 操作を検証し、統合後の確認と実行結果を記録する

## Dependencies & Execution Order

T001 → T002 → US1 → 検証。US1 内は T003 → T004 → T006 の順で進める。T005 は T004 と独立して作業できる。T007 は T005 に依存し、T008 は T006 と T007 の完了後に行う。

## Parallel Example: User Story 1

フィクスチャを用意した後、検索処理（T004）と npm のテストコマンド（T005）は別ファイルで作業できる。

## Implementation Strategy

MVP は US1。検索処理と画面を基準ブランチで独立して確認する。他のビューを統合した後のブラウザー確認は [quickstart.md](quickstart.md) に示す。

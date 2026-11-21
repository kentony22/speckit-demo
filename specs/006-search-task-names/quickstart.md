# Quickstart: タスク名の検索

リポジトリの [README](../../README.md) に記載の Node.js、JDK、Cosmos DB エミュレーターを使用する。ローカル確認には専用の `TODO_OWNER_ID` を指定する。

```sh
cd frontend
npm ci
npm test
npm run build
```

Chrome でローカルのアプリを開き、「Azureに配備する」「Azure の準備」「Azureの手順を確認する」「牛乳を買う」を登録する。いずれかの Azure タスクを完了にし、ページを再読み込みする。

| 条件 | 操作と期待結果 |
| --- | --- |
| AC-001 | 「Azure」で検索すると、完了済みの行も含めて名前に一致する行だけが全件一覧の相対順に表示される。別リスト間の絞り込みはテストのフィクスチャでも確認する。 |
| AC-002 | 「 azure 」で同じ行が表示される。 |
| AC-003 | 「該当なし」で検索すると「一致するタスクがありません」が表示される。登録0件の状態で検索語を空にした場合は「タスクはまだありません。」が表示される。 |
| AC-004 | 空欄または全角スペースだけにすると、全タスクの一覧に戻り、URL とタスクの内容は維持される。別ビューへの復帰はテストのフィクスチャでも確認する。 |

## 他機能との統合後の確認

カスタムリストの実装と統合したら、AC-001 の仕様にある2件を別々のリストに登録し、検索をどちらかの `#list-…` から行う。結果が全件一覧の相対順で2件表示されることを確認する。双方の機能と統合したら、`#important` と `#list-…` からそれぞれ検索し、空欄と空白のみの両方で検索を解除する。それぞれ元のハッシュと表示一覧が保たれていることを確認する。

## ローカル検証結果（2026-11-21）

- `cd frontend && npm ci --offline --cache /tmp/speckit-npm`: 成功（82パッケージ）
- `cd frontend && npm test`: 成功（4/4件 — AC-001〜004、リスト横断、`#important` / `#list-personal` からの検索と復元、元データ非変更をフィクスチャで確認）
- `cd frontend && npm run build`: 成功（`tsc --noEmit` と `vite build`）
- Chrome（Playwright `playwright-core`、ビルド済み `frontend/dist` とインメモリ `/api/tasks` スタブによる `http://localhost:18306/#tasks` 検証）: 成功（登録・完了切替・再読み込み、空一覧と検索0件の区別、AC-001〜004、URLハッシュ `#tasks` 維持を確認）
- 親エージェントの追加確認で、React を同梱した JAR の Maven `verify` が成功した。REST テスト22件、Cosmos DB エミュレーター結合テスト3件。
- 追加の Chrome 確認では、Spring Boot と Cosmos DB エミュレーターを使い、3件のうち名前が一致する2件の表示、該当なし、全件一覧への復帰を確認した。`#important` と `#list-…` の実画面での確認は統合後に行う。

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSearchQuery, resolveVisibleTasks } from '../src/taskSearch.ts';

const canonicalTasks = [
    {
        id: 'task-1',
        name: 'Azureに配備する',
        createdAt: '2026-11-21T03:00:00Z',
        completed: true,
        important: false,
        listId: 'list-work',
    },
    {
        id: 'task-2',
        name: '牛乳を買う',
        createdAt: '2026-11-21T02:00:00Z',
        completed: false,
        important: true,
        listId: 'list-personal',
    },
    {
        id: 'task-3',
        name: 'Azureの手順を確認する',
        createdAt: '2026-11-21T01:00:00Z',
        completed: false,
        important: false,
        listId: 'list-personal',
    },
];

test('AC-001: 所属リストや完了状態をまたいで全タスクの相対順で名前一致を抽出する', () => {
    const personalListTasks = canonicalTasks.filter((task) => task.listId === 'list-personal');

    const result = resolveVisibleTasks(canonicalTasks, personalListTasks, 'Azure');

    assert.equal(result.isSearching, true);
    assert.equal(result.normalizedQuery, 'azure');
    assert.deepEqual(
        result.tasks.map((task) => task.id),
        ['task-1', 'task-3'],
    );
    assert.equal(result.tasks[0].completed, true);
});

test('AC-002: 前後の半角・全角空白を無視し英字の大小文字を区別せず、内部の空白は照合に使う', () => {
    const tasks = [
        { id: '1', name: 'Azure の準備', createdAt: '2026-11-21T03:00:00Z', completed: false },
        { id: '2', name: 'Azureの準備', createdAt: '2026-11-21T02:00:00Z', completed: false },
        { id: '3', name: '買い物', createdAt: '2026-11-21T01:00:00Z', completed: false },
    ];

    assert.equal(normalizeSearchQuery(' azure '), 'azure');
    assert.equal(normalizeSearchQuery('　AZURE\t\n'), 'azure');

    const spacedResult = resolveVisibleTasks(tasks, tasks, ' azure ');
    assert.equal(spacedResult.isSearching, true);
    assert.deepEqual(
        spacedResult.tasks.map((task) => task.id),
        ['1', '2'],
    );

    const fullWidthSpacedResult = resolveVisibleTasks(tasks, tasks, '　AZURE　');
    assert.deepEqual(
        fullWidthSpacedResult.tasks.map((task) => task.id),
        ['1', '2'],
    );

    const internalSpaceResult = resolveVisibleTasks(tasks, tasks, ' azure の ');
    assert.deepEqual(
        internalSpaceResult.tasks.map((task) => task.id),
        ['1'],
    );
});

test('AC-003: 一致するタスクがない場合は検索中の空結果を返し、未検索の空一覧と区別できる', () => {
    const noMatch = resolveVisibleTasks(canonicalTasks, canonicalTasks, '該当なし');
    assert.equal(noMatch.isSearching, true);
    assert.deepEqual(noMatch.tasks, []);

    const emptyCatalogWithQuery = resolveVisibleTasks([], [], 'Azure');
    assert.equal(emptyCatalogWithQuery.isSearching, true);
    assert.deepEqual(emptyCatalogWithQuery.tasks, []);

    const emptyCatalogWithoutQuery = resolveVisibleTasks([], [], '');
    assert.equal(emptyCatalogWithoutQuery.isSearching, false);
    assert.deepEqual(emptyCatalogWithoutQuery.tasks, []);
});

test('AC-004: 検索語を空欄・空白のみにすると重要ビューやカスタムリストの一覧へ戻り元データを変えない', () => {
    const snapshot = structuredClone(canonicalTasks);
    const importantView = {
        hash: '#important',
        tasks: canonicalTasks.filter((task) => task.important),
    };
    const customListView = {
        hash: '#list-personal',
        tasks: canonicalTasks.filter((task) => task.listId === 'list-personal'),
    };

    for (const view of [importantView, customListView]) {
        const searching = resolveVisibleTasks(canonicalTasks, view.tasks, 'Azure');
        assert.equal(searching.isSearching, true);
        assert.deepEqual(
            searching.tasks.map((task) => task.id),
            ['task-1', 'task-3'],
        );

        for (const clearedQuery of ['', '   ', '　', ' \t　\n ']) {
            const restored = resolveVisibleTasks(canonicalTasks, view.tasks, clearedQuery);
            assert.equal(restored.isSearching, false);
            assert.equal(restored.normalizedQuery, '');
            assert.deepEqual(restored.tasks, view.tasks);
        }
    }

    assert.equal(importantView.hash, '#important');
    assert.equal(customListView.hash, '#list-personal');
    assert.deepEqual(canonicalTasks, snapshot);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    clearDeletedListFromTasks,
    removeDeletedTaskList,
    resolveHashAfterListDelete,
} from '../src/taskListDeletion.ts';

test('AC-001: 削除対象リストだけを一覧から取り除き他のリストを保持する', () => {
    const lists = [
        { id: 'list-shopping', name: '買い物', groupId: 'group-personal' },
        { id: 'list-work', name: '仕事', groupId: null },
    ];

    const remaining = removeDeletedTaskList(lists, 'list-shopping');

    assert.deepEqual(remaining, [{ id: 'list-work', name: '仕事', groupId: null }]);
    assert.equal(lists.length, 2);
});

test('AC-001: 削除対象リストに所属していたタスクだけをリストなしに戻し他属性と他タスクを保持する', () => {
    const tasks = [
        { id: 'task-1', name: '牛乳を買う', completed: true, important: true, listId: 'list-shopping' },
        { id: 'task-2', name: '報告書を書く', completed: false, important: false, listId: 'list-work' },
        { id: 'task-3', name: '未分類タスク', completed: false, important: false, listId: null },
    ];

    const updated = clearDeletedListFromTasks(tasks, 'list-shopping');

    assert.equal(updated.length, 3);
    assert.deepEqual(updated[0], {
        id: 'task-1',
        name: '牛乳を買う',
        completed: true,
        important: true,
        listId: null,
    });
    assert.deepEqual(updated[1], tasks[1]);
    assert.deepEqual(updated[2], tasks[2]);
    assert.equal(tasks[0].listId, 'list-shopping');
});

test('AC-002: 表示中のカスタムリストを削除したときは tasks へ戻り、別ビュー表示中は維持する', () => {
    assert.equal(resolveHashAfterListDelete('list-shopping', 'list-shopping'), 'tasks');
    assert.equal(resolveHashAfterListDelete('list-work', 'list-shopping'), 'list-work');
    assert.equal(resolveHashAfterListDelete('important', 'list-shopping'), 'important');
    assert.equal(resolveHashAfterListDelete('tasks', 'list-shopping'), 'tasks');
    assert.equal(resolveHashAfterListDelete('', 'list-shopping'), '');
});

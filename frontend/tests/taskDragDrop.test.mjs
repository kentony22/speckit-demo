import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldMoveListToGroup, shouldMoveTaskToList } from '../src/taskDragDrop.ts';

test('タスクを別リストへ追加・移動するときのみ true を返し、同じ所属先では再送信しない', () => {
    assert.equal(shouldMoveTaskToList({ listId: null }, 'list-1'), true);
    assert.equal(shouldMoveTaskToList({ listId: undefined }, 'list-1'), true);
    assert.equal(shouldMoveTaskToList({ listId: 'list-1' }, 'list-2'), true);
    assert.equal(shouldMoveTaskToList({ listId: 'list-1' }, 'list-1'), false);
    assert.equal(shouldMoveTaskToList({ listId: 'list-1' }, null), true);
    assert.equal(shouldMoveTaskToList({ listId: null }, null), false);
    assert.equal(shouldMoveTaskToList(undefined, 'list-1'), false);
});

test('カスタムリストを別グループへ移動または解除するときのみ true を返す', () => {
    assert.equal(shouldMoveListToGroup({ groupId: null }, 'group-1'), true);
    assert.equal(shouldMoveListToGroup({ groupId: 'group-1' }, 'group-2'), true);
    assert.equal(shouldMoveListToGroup({ groupId: 'group-1' }, 'group-1'), false);
    assert.equal(shouldMoveListToGroup({ groupId: 'group-1' }, null), true);
    assert.equal(shouldMoveListToGroup({ groupId: null }, null), false);
    assert.equal(shouldMoveListToGroup(undefined, 'group-1'), false);
});

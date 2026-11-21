import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveInitialTheme, toggleTheme } from '../src/theme.ts';

test('保存済みテーマを優先し、未保存時は OS 設定に従う', () => {
    assert.equal(resolveInitialTheme('dark', false), 'dark');
    assert.equal(resolveInitialTheme('light', true), 'light');
    assert.equal(resolveInitialTheme(null, true), 'dark');
    assert.equal(resolveInitialTheme(null, false), 'light');
    assert.equal(resolveInitialTheme('unknown', true), 'dark');
});

test('toggleTheme は light と dark を交互に切り替える', () => {
    assert.equal(toggleTheme('light'), 'dark');
    assert.equal(toggleTheme('dark'), 'light');
});

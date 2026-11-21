import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createTaskList, isBlankTaskName, listTaskLists, updateTaskList } from './api/tasks';
import type { Task, TaskList } from './api/tasks';

export function useTaskLists() {
    const [lists, setLists] = useState<TaskList[]>([]);
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [hash, setHash] = useState(() => window.location.hash.slice(1));

    useEffect(() => {
        const request = new AbortController();
        listTaskLists(request.signal).then((items) => {
            if (!request.signal.aborted) {
                setLists(items);
                setLoadState('ready');
            }
        }).catch(() => {
            if (!request.signal.aborted) {
                setLoadState('error');
            }
        });
        return () => request.abort();
    }, [loadAttempt]);

    useEffect(() => {
        function updateHash() {
            setHash(window.location.hash.slice(1));
        }
        window.addEventListener('hashchange', updateHash);
        return () => window.removeEventListener('hashchange', updateHash);
    }, []);

    return {
        lists,
        loadState,
        isImportantView: hash === 'important',
        selectedList: lists.find((list) => list.id === hash),
        addList: (list: TaskList) => setLists((items) => [...items, list]),
        retryLoad: () => {
            setLoadState('loading');
            setLoadAttempt((attempt) => attempt + 1);
        },
    };
}

export function TaskListNavigation({ lists, loadState, isImportantView, selectedList, addList, retryLoad }: ReturnType<typeof useTaskLists>) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    const [saving, setSaving] = useState(false);
    const linkClass = 'block truncate rounded-lg px-3.5 py-2 outline-offset-4 focus-visible:outline-2 sm:px-4';
    const activeClass = 'bg-selection font-semibold text-ink';

    async function create(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (inFlight.current || loadState !== 'ready') {
            return;
        }
        if (isBlankTaskName(name)) {
            setError('リスト名を入力してください。');
            return;
        }
        inFlight.current = true;
        setSaving(true);
        setError('');
        try {
            addList(await createTaskList(name));
            setName('');
        } catch {
            setError('リストを作成できませんでした。もう一度お試しください。');
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    }

    return (
        <>
            <nav aria-label="メイン" className="min-w-0 space-y-1">
                <a href="#tasks" aria-current={!isImportantView && !selectedList ? 'page' : undefined} className={`${linkClass} ${!isImportantView && !selectedList ? activeClass : 'hover:bg-block'}`}>
                    すべてのタスク
                </a>
                <a href="#important" aria-current={isImportantView ? 'page' : undefined} className={`${linkClass} ${isImportantView ? activeClass : 'hover:bg-block'}`}>
                    重要
                </a>
                {lists.map((list) => (
                    <a key={list.id} href={`#${list.id}`} aria-current={selectedList?.id === list.id ? 'page' : undefined} className={`${linkClass} ${selectedList?.id === list.id ? activeClass : 'hover:bg-block'}`}>
                        {list.name}
                    </a>
                ))}
            </nav>
            <form onSubmit={create} className="grid gap-2">
                <label htmlFor="task-list-name" className="text-sm font-semibold">リスト名</label>
                <input
                    id="task-list-name"
                    value={name}
                    disabled={saving || loadState !== 'ready'}
                    aria-describedby={error ? 'task-list-create-error' : undefined}
                    aria-invalid={error === 'リスト名を入力してください。'}
                    onChange={(event) => {
                        setName(event.target.value);
                        setError('');
                    }}
                    className="w-full rounded-lg bg-block px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-accent"
                />
                <button type="submit" disabled={saving || loadState !== 'ready'} className="justify-self-start rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {saving ? '作成中…' : 'リストを作成'}
                </button>
                {error && <p id="task-list-create-error" role="alert" className="text-sm text-[#942e28]">{error}</p>}
                {loadState === 'error' && (
                    <div role="alert" className="text-sm">
                        <p>リストを取得できませんでした。</p>
                        <button type="button" className="mt-1 font-semibold underline" onClick={retryLoad}>再試行</button>
                    </div>
                )}
            </form>
        </>
    );
}

export function TaskListMembership({ task, lists, onUpdated }: { task: Task; lists: TaskList[]; onUpdated: (task: Task) => void }) {
    const inFlight = useRef(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');

    async function changeList(value: string) {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setSaveState('saving');
        try {
            onUpdated(await updateTaskList(task.id, value || null));
            setSaveState('idle');
        } catch {
            setSaveState('error');
        } finally {
            inFlight.current = false;
        }
    }

    return (
        <div className="mt-2 text-sm">
            <label className="flex flex-wrap items-center gap-2">
                <span className="text-muted">所属先</span>
                <select
                    aria-label={`${task.name} の所属先`}
                    value={task.listId ?? ''}
                    disabled={saveState === 'saving'}
                    onChange={(event) => void changeList(event.target.value)}
                    className="min-w-0 max-w-full rounded-lg border border-marker px-2 py-1 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                >
                    <option value="">リストなし</option>
                    {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                </select>
            </label>
            {saveState === 'saving' && <p role="status" className="mt-1">所属先を保存中…</p>}
            {saveState === 'error' && <p role="alert" className="mt-1 text-[#942e28]">所属先を変更できませんでした。もう一度お試しください。</p>}
        </div>
    );
}

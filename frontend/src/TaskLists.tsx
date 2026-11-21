import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
    createListGroup,
    createTaskList,
    isBlankTaskName,
    listListGroups,
    listTaskLists,
    updateListGroupName,
    updateTaskList,
    updateTaskListGroup,
} from './api/tasks';
import type { ListGroup, Task, TaskList } from './api/tasks';

export function useTaskLists() {
    const [lists, setLists] = useState<TaskList[]>([]);
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [groups, setGroups] = useState<ListGroup[]>([]);
    const [groupsLoadState, setGroupsLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [groupsLoadAttempt, setGroupsLoadAttempt] = useState(0);
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
        const request = new AbortController();
        listListGroups(request.signal).then((items) => {
            if (!request.signal.aborted) {
                setGroups(items);
                setGroupsLoadState('ready');
            }
        }).catch(() => {
            if (!request.signal.aborted) {
                setGroupsLoadState('error');
            }
        });
        return () => request.abort();
    }, [groupsLoadAttempt]);

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
        groups,
        groupsLoadState,
        isImportantView: hash === 'important',
        selectedList: lists.find((list) => list.id === hash),
        addList: (list: TaskList) => setLists((items) => [...items, list]),
        updateList: (updated: TaskList) => setLists((items) => items.map((item) => item.id === updated.id ? updated : item)),
        addGroup: (group: ListGroup) => setGroups((items) => [...items, group]),
        updateGroup: (updated: ListGroup) => setGroups((items) => items.map((item) => item.id === updated.id ? updated : item)),
        retryLoad: () => {
            setLoadState('loading');
            setLoadAttempt((attempt) => attempt + 1);
        },
        retryGroupsLoad: () => {
            setGroupsLoadState('loading');
            setGroupsLoadAttempt((attempt) => attempt + 1);
        },
    };
}

function ListGroupNameEditor({
    group,
    onSaved,
    onCancel,
}: {
    group: ListGroup;
    onSaved: (group: ListGroup) => void;
    onCancel: () => void;
}) {
    const [draft, setDraft] = useState(group.name);
    const [error, setError] = useState<'blank' | 'save' | null>(null);
    const [saving, setSaving] = useState(false);
    const inFlight = useRef(false);

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (inFlight.current) {
            return;
        }
        if (isBlankTaskName(draft)) {
            setError('blank');
            return;
        }
        inFlight.current = true;
        setSaving(true);
        setError(null);
        try {
            onSaved(await updateListGroupName(group.id, draft));
        } catch {
            setError('save');
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    }

    return (
        <form onSubmit={save} className="space-y-1.5 rounded-lg bg-block p-2 text-sm shadow-xs">
            <input
                autoFocus
                value={draft}
                readOnly={saving}
                aria-label={`${group.name} のグループ名`}
                aria-invalid={error === 'blank'}
                onChange={(event) => {
                    setDraft(event.target.value);
                    setError(null);
                }}
                className="w-full rounded border border-marker px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-accent"
            />
            {error && (
                <p role="alert" className="text-xs text-[#942e28]">
                    {error === 'blank' ? 'グループ名を入力してください。' : 'グループ名を変更できませんでした。もう一度お試しください。'}
                </p>
            )}
            <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                <button type="submit" disabled={saving} className="rounded bg-accent px-2.5 py-1 text-white disabled:opacity-50">
                    {saving ? '保存中…' : '保存'}
                </button>
                <button type="button" disabled={saving} onClick={onCancel} className="rounded px-2.5 py-1 text-accent disabled:opacity-50">
                    キャンセル
                </button>
            </div>
        </form>
    );
}

export function TaskListNavigation({
    lists,
    loadState,
    groups,
    groupsLoadState,
    isImportantView,
    selectedList,
    addList,
    addGroup,
    updateGroup,
    retryLoad,
    retryGroupsLoad,
}: ReturnType<typeof useTaskLists>) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    const [saving, setSaving] = useState(false);

    const [groupName, setGroupName] = useState('');
    const [groupError, setGroupError] = useState('');
    const groupInFlight = useRef(false);
    const [groupSaving, setGroupSaving] = useState(false);

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

    const linkClass = 'block truncate rounded-lg px-3.5 py-2 outline-offset-4 focus-visible:outline-2 sm:px-4';
    const activeClass = 'bg-selection font-semibold text-ink';

    const groupIdSet = new Set(groups.map((group) => group.id));
    const ungroupedLists = lists.filter((list) => !list.groupId || !groupIdSet.has(list.groupId));

    function toggleGroup(groupId: string) {
        setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    }

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

    async function createGroup(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (groupInFlight.current || groupsLoadState !== 'ready') {
            return;
        }
        if (isBlankTaskName(groupName)) {
            setGroupError('グループ名を入力してください。');
            return;
        }
        groupInFlight.current = true;
        setGroupSaving(true);
        setGroupError('');
        try {
            addGroup(await createListGroup(groupName));
            setGroupName('');
        } catch {
            setGroupError('グループを作成できませんでした。もう一度お試しください。');
        } finally {
            groupInFlight.current = false;
            setGroupSaving(false);
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

                {groups.map((group) => {
                    const groupLists = lists.filter((list) => list.groupId === group.id);
                    const expanded = !collapsedGroups[group.id];
                    return (
                        <div key={group.id} className="pt-1">
                            {editingGroupId === group.id ? (
                                <ListGroupNameEditor
                                    group={group}
                                    onSaved={(updated) => {
                                        updateGroup(updated);
                                        setEditingGroupId(null);
                                    }}
                                    onCancel={() => setEditingGroupId(null)}
                                />
                            ) : (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        aria-expanded={expanded}
                                        onClick={() => toggleGroup(group.id)}
                                        className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3.5 py-2 text-left text-sm font-semibold text-ink hover:bg-block focus-visible:outline-2 focus-visible:outline-accent sm:px-4"
                                    >
                                        <span className="min-w-0 truncate">{group.name}</span>
                                        <span aria-hidden="true" className="shrink-0 text-xs text-muted">
                                            {groupLists.length} {expanded ? '▾' : '▸'}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`${group.name} の編集`}
                                        onClick={() => setEditingGroupId(group.id)}
                                        className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-accent"
                                    >
                                        編集
                                    </button>
                                </div>
                            )}
                            {expanded && (
                                <div className="mt-1 space-y-1 pl-3">
                                    {groupLists.length === 0 ? (
                                        <p className="px-3.5 py-1.5 text-xs text-muted sm:px-4">リストはまだありません。</p>
                                    ) : (
                                        groupLists.map((list) => (
                                            <a
                                                key={list.id}
                                                href={`#${list.id}`}
                                                aria-current={selectedList?.id === list.id ? 'page' : undefined}
                                                className={`${linkClass} ${selectedList?.id === list.id ? activeClass : 'hover:bg-block'}`}
                                            >
                                                {list.name}
                                            </a>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {ungroupedLists.map((list) => (
                    <a
                        key={list.id}
                        href={`#${list.id}`}
                        aria-current={selectedList?.id === list.id ? 'page' : undefined}
                        className={`${linkClass} ${selectedList?.id === list.id ? activeClass : 'hover:bg-block'}`}
                    >
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

            <form onSubmit={createGroup} className="grid gap-2">
                <label htmlFor="list-group-name" className="text-sm font-semibold">グループ名</label>
                <input
                    id="list-group-name"
                    value={groupName}
                    disabled={groupSaving || groupsLoadState !== 'ready'}
                    aria-describedby={groupError ? 'list-group-create-error' : undefined}
                    aria-invalid={groupError === 'グループ名を入力してください。'}
                    onChange={(event) => {
                        setGroupName(event.target.value);
                        setGroupError('');
                    }}
                    className="w-full rounded-lg bg-block px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-accent"
                />
                <button type="submit" disabled={groupSaving || groupsLoadState !== 'ready'} className="justify-self-start rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {groupSaving ? '作成中…' : 'グループを作成'}
                </button>
                {groupError && <p id="list-group-create-error" role="alert" className="text-sm text-[#942e28]">{groupError}</p>}
                {groupsLoadState === 'error' && (
                    <div role="alert" className="text-sm">
                        <p>グループを取得できませんでした。</p>
                        <button type="button" className="mt-1 font-semibold underline" onClick={retryGroupsLoad}>再試行</button>
                    </div>
                )}
            </form>
        </>
    );
}

export function TaskListGroupAssignment({
    list,
    groups,
    onUpdated,
}: {
    list: TaskList;
    groups: ListGroup[];
    onUpdated: (list: TaskList) => void;
}) {
    const inFlight = useRef(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');

    async function changeGroup(value: string) {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setSaveState('saving');
        try {
            onUpdated(await updateTaskListGroup(list.id, value || null));
            setSaveState('idle');
        } catch {
            setSaveState('error');
        } finally {
            inFlight.current = false;
        }
    }

    return (
        <div className="mb-4 text-sm">
            <label className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-muted">グループ</span>
                <select
                    aria-label={`${list.name} のグループ`}
                    value={list.groupId ?? ''}
                    disabled={saveState === 'saving'}
                    onChange={(event) => void changeGroup(event.target.value)}
                    className="min-w-0 max-w-full rounded-lg border border-marker bg-block px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                >
                    <option value="">グループなし</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
            </label>
            {saveState === 'saving' && <p role="status" className="mt-1">グループを保存中…</p>}
            {saveState === 'error' && <p role="alert" className="mt-1 text-[#942e28]">グループを変更できませんでした。もう一度お試しください。</p>}
        </div>
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

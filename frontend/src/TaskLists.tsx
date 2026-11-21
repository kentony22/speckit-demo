import { useEffect, useRef, useState } from 'react';
import type { DragEvent, FormEvent, KeyboardEvent } from 'react';
import {
    createListGroup,
    createTaskList,
    deleteListGroup,
    deleteTaskList,
    isBlankTaskName,
    listListGroups,
    listTaskLists,
    updateListGroupName,
    updateTaskListName,
} from './api/tasks';
import type { ListGroup, TaskList } from './api/tasks';
import {
    ChevronIcon,
    FolderIcon,
    FolderPlusIcon,
    HomeIcon,
    ListIcon,
    PencilIcon,
    PlusIcon,
    StarIcon,
    TrashIcon,
} from './Icons';
import { LIST_DRAG_MIME, TASK_DRAG_MIME } from './taskDragDrop';
import { removeDeletedTaskList, resolveHashAfterListDelete } from './taskListDeletion';

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
        removeList: (id: string) => {
            setLists((items) => removeDeletedTaskList(items, id));
            const nextHash = resolveHashAfterListDelete(hash, id);
            if (nextHash !== hash) {
                window.location.hash = `#${nextHash}`;
                setHash(nextHash);
            }
        },
        addGroup: (group: ListGroup) => setGroups((items) => [...items, group]),
        updateGroup: (updated: ListGroup) => setGroups((items) => items.map((item) => item.id === updated.id ? updated : item)),
        removeGroup: (groupId: string) => {
            setGroups((items) => items.filter((item) => item.id !== groupId));
            setLists((items) => items.map((item) => item.groupId === groupId ? { ...item, groupId: null } : item));
        },
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
    const skipBlurCommit = useRef(false);

    async function commit() {
        if (inFlight.current) {
            return;
        }
        if (isBlankTaskName(draft)) {
            setError('blank');
            return;
        }
        if (draft === group.name) {
            onCancel();
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

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Escape') {
            event.preventDefault();
            if (saving) {
                return;
            }
            skipBlurCommit.current = true;
            onCancel();
            return;
        }
        if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
            event.preventDefault();
            skipBlurCommit.current = true;
            void commit();
        }
    }

    return (
        <div className="px-4 py-1.5">
            <div className="flex items-center gap-3">
                <FolderIcon className="size-[18px] shrink-0 text-accent" />
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
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        if (skipBlurCommit.current) {
                            skipBlurCommit.current = false;
                            return;
                        }
                        void commit();
                    }}
                    className="min-w-0 flex-1 rounded border border-accent bg-block px-2 py-1 text-sm font-medium text-ink focus:outline-none"
                />
            </div>
            {saving && <p role="status" className="mt-1 pl-7 text-xs text-muted">保存中…</p>}
            {error && (
                <p role="alert" className="mt-1 pl-7 text-xs text-danger">
                    {error === 'blank' ? 'グループ名を入力してください。' : 'グループ名を変更できませんでした。もう一度お試しください。'}
                </p>
            )}
        </div>
    );
}

export function TaskListNameEditor({
    list,
    variant = 'sidebar',
    indented = false,
    onSaved,
    onCancel,
}: {
    list: TaskList;
    variant?: 'sidebar' | 'heading';
    indented?: boolean;
    onSaved: (list: TaskList) => void;
    onCancel?: () => void;
}) {
    const [draft, setDraft] = useState(list.name);
    const [error, setError] = useState<'blank' | 'save' | null>(null);
    const [saving, setSaving] = useState(false);
    const inFlight = useRef(false);
    const skipBlurCommit = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setDraft(list.name);
        setError(null);
    }, [list.id, list.name]);

    async function commit() {
        if (inFlight.current) {
            return;
        }
        if (isBlankTaskName(draft)) {
            setError('blank');
            return;
        }
        if (draft === list.name) {
            setError(null);
            onCancel?.();
            return;
        }
        inFlight.current = true;
        setSaving(true);
        setError(null);
        try {
            const updated = await updateTaskListName(list.id, draft);
            onSaved(updated);
            setDraft(updated.name);
        } catch {
            setError('save');
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Escape') {
            event.preventDefault();
            if (saving) {
                return;
            }
            skipBlurCommit.current = true;
            setDraft(list.name);
            setError(null);
            if (onCancel) {
                onCancel();
            } else {
                inputRef.current?.blur();
            }
            return;
        }
        if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
            event.preventDefault();
            skipBlurCommit.current = true;
            void commit().then(() => {
                if (!onCancel) {
                    inputRef.current?.blur();
                }
            });
        }
    }

    if (variant === 'heading') {
        return (
            <div className="min-w-0 flex-1">
                <input
                    ref={inputRef}
                    value={draft}
                    readOnly={saving}
                    aria-label={`${list.name} のリスト名`}
                    aria-invalid={error === 'blank'}
                    onChange={(event) => {
                        setDraft(event.target.value);
                        setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        if (skipBlurCommit.current) {
                            skipBlurCommit.current = false;
                            return;
                        }
                        void commit();
                    }}
                    className="w-full max-w-md rounded border border-transparent bg-transparent px-1.5 py-0.5 text-2xl leading-8 font-semibold tracking-tight text-accent transition-colors hover:border-border hover:bg-block focus:border-accent focus:bg-block focus:outline-none"
                />
                {saving && <p role="status" className="mt-1 px-1.5 text-xs text-muted">保存中…</p>}
                {error && (
                    <p role="alert" className="mt-1 px-1.5 text-xs text-danger">
                        {error === 'blank' ? 'リスト名を入力してください。' : 'リスト名を変更できませんでした。もう一度お試しください。'}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className={`py-1.5 pr-4 ${indented ? 'pl-3' : 'pl-4'}`}>
            <div className="flex items-center gap-3">
                <ListIcon className="size-[18px] shrink-0 text-accent" />
                <input
                    ref={inputRef}
                    autoFocus
                    value={draft}
                    readOnly={saving}
                    aria-label={`${list.name} のリスト名`}
                    aria-invalid={error === 'blank'}
                    onChange={(event) => {
                        setDraft(event.target.value);
                        setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        if (skipBlurCommit.current) {
                            skipBlurCommit.current = false;
                            return;
                        }
                        void commit();
                    }}
                    className="min-w-0 flex-1 rounded border border-accent bg-block px-2 py-1 text-sm text-ink focus:outline-none"
                />
            </div>
            {saving && <p role="status" className="mt-1 pl-7 text-xs text-muted">保存中…</p>}
            {error && (
                <p role="alert" className="mt-1 pl-7 text-xs text-danger">
                    {error === 'blank' ? 'リスト名を入力してください。' : 'リスト名を変更できませんでした。もう一度お試しください。'}
                </p>
            )}
        </div>
    );
}

function ListGroupDeleteConfirm({
    group,
    onDeleted,
    onCancel,
}: {
    group: ListGroup;
    onDeleted: (groupId: string) => void;
    onCancel: () => void;
}) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(false);
    const inFlight = useRef(false);

    async function confirmDelete() {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setDeleting(true);
        setError(false);
        try {
            await deleteListGroup(group.id);
            onDeleted(group.id);
        } catch {
            setError(true);
        } finally {
            inFlight.current = false;
            setDeleting(false);
        }
    }

    return (
        <div className="mx-2 my-1 space-y-1.5 rounded-md border border-border bg-canvas p-2.5 text-xs shadow-xs">
            <p className="font-semibold text-ink">「{group.name}」を削除しますか？</p>
            <p className="text-muted">所属しているリストは未分類として残ります。</p>
            {error && (
                <p role="alert" className="text-danger">
                    グループを削除できませんでした。もう一度お試しください。
                </p>
            )}
            <div className="flex flex-wrap gap-1.5 font-semibold">
                <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void confirmDelete()}
                    className="rounded bg-danger px-2.5 py-1 text-danger-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                    {deleting ? '削除中…' : '削除する'}
                </button>
                <button
                    type="button"
                    disabled={deleting}
                    onClick={onCancel}
                    className="rounded px-2.5 py-1 text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                    キャンセル
                </button>
            </div>
        </div>
    );
}

function TaskListDeleteConfirmation({
    list,
    onDeleted,
    onCancel,
}: {
    list: TaskList;
    onDeleted: (id: string) => void;
    onCancel: () => void;
}) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(false);
    const inFlight = useRef(false);

    async function confirmDelete() {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setDeleting(true);
        setError(false);
        try {
            await deleteTaskList(list.id);
            onDeleted(list.id);
        } catch {
            setError(true);
        } finally {
            inFlight.current = false;
            setDeleting(false);
        }
    }

    return (
        <div className="mx-2 my-1 space-y-1.5 rounded-md border border-border bg-canvas p-2.5 text-xs shadow-xs">
            <p className="font-semibold text-ink">「{list.name}」を削除しますか？</p>
            <p className="text-muted">所属するタスクは削除されず「タスク」に残ります。</p>
            {error && (
                <p role="alert" className="text-danger">
                    リストを削除できませんでした。もう一度お試しください。
                </p>
            )}
            <div className="flex flex-wrap gap-1.5 font-semibold">
                <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void confirmDelete()}
                    className="rounded bg-danger px-2.5 py-1 text-danger-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                    {deleting ? '削除中…' : '削除する'}
                </button>
                <button
                    type="button"
                    disabled={deleting}
                    onClick={onCancel}
                    className="rounded px-2.5 py-1 text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                    キャンセル
                </button>
            </div>
        </div>
    );
}

type TaskCounts = {
    all: number;
    important: number;
    byListId: Record<string, number>;
};

export function TaskListNavigation({
    lists,
    loadState,
    groups,
    groupsLoadState,
    isImportantView,
    selectedList,
    addList,
    updateList,
    addGroup,
    updateGroup,
    removeGroup,
    retryLoad,
    retryGroupsLoad,
    counts,
    draggingTaskId,
    onDropTaskToList,
    onDropListToGroup,
    onListDeleted,
    onNavigate,
}: ReturnType<typeof useTaskLists> & {
    counts: TaskCounts;
    draggingTaskId: string | null;
    onDropTaskToList: (taskId: string, targetListId: string | null) => void;
    onDropListToGroup: (listId: string, targetGroupId: string | null) => void;
    onListDeleted: (id: string) => void;
    onNavigate?: () => void;
}) {
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
    const [editingListId, setEditingListId] = useState<string | null>(null);
    const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
    const [deletingListId, setDeletingListId] = useState<string | null>(null);
    const [draggingListId, setDraggingListId] = useState<string | null>(null);
    const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

    useEffect(() => {
        if (!draggingTaskId && !draggingListId) {
            setDropTargetKey(null);
        }
    }, [draggingTaskId, draggingListId]);

    const isAllActive = !isImportantView && !selectedList;
    const baseItem = 'relative flex items-center gap-3 px-4 py-2.5 text-sm transition-colors outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-accent';
    const activeItem = 'bg-selection font-semibold text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-accent';
    const inactiveItem = 'text-ink hover:bg-hover';
    const dropHighlight = 'bg-selection ring-2 ring-inset ring-accent';

    const groupIdSet = new Set(groups.map((group) => group.id));
    const ungroupedLists = lists.filter((list) => !list.groupId || !groupIdSet.has(list.groupId));
    const draggedList = draggingListId ? lists.find((list) => list.id === draggingListId) : undefined;

    function toggleGroup(groupId: string) {
        setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    }

    function hasTaskPayload(event: DragEvent): boolean {
        return Boolean(draggingTaskId) || event.dataTransfer.types.includes(TASK_DRAG_MIME);
    }

    function hasListPayload(event: DragEvent): boolean {
        return Boolean(draggingListId) || event.dataTransfer.types.includes(LIST_DRAG_MIME);
    }

    function readTaskId(event: DragEvent): string | null {
        return event.dataTransfer.getData(TASK_DRAG_MIME) || draggingTaskId;
    }

    function readListId(event: DragEvent): string | null {
        return event.dataTransfer.getData(LIST_DRAG_MIME) || draggingListId;
    }

    function handleTaskDragOver(event: DragEvent, targetKey: string) {
        if (!hasTaskPayload(event)) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (dropTargetKey !== targetKey) {
            setDropTargetKey(targetKey);
        }
    }

    function handleTaskDrop(event: DragEvent, targetListId: string | null) {
        if (!hasTaskPayload(event)) {
            return;
        }
        event.preventDefault();
        const taskId = readTaskId(event);
        setDropTargetKey(null);
        if (taskId) {
            onDropTaskToList(taskId, targetListId);
        }
    }

    function handleGroupDragOver(event: DragEvent, groupId: string) {
        if (hasListPayload(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (dropTargetKey !== groupId) {
                setDropTargetKey(groupId);
            }
            return;
        }
        if (hasTaskPayload(event) && collapsedGroups[groupId]) {
            setCollapsedGroups((prev) => ({ ...prev, [groupId]: false }));
        }
    }

    function handleGroupDrop(event: DragEvent, groupId: string) {
        if (!hasListPayload(event)) {
            return;
        }
        event.preventDefault();
        const listId = readListId(event);
        setDropTargetKey(null);
        setDraggingListId(null);
        if (listId) {
            setCollapsedGroups((prev) => ({ ...prev, [groupId]: false }));
            onDropListToGroup(listId, groupId);
        }
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

    function renderListRow(list: TaskList, indented = false) {
        if (editingListId === list.id) {
            return (
                <TaskListNameEditor
                    key={list.id}
                    list={list}
                    indented={indented}
                    onSaved={(updated) => {
                        updateList(updated);
                        setEditingListId(null);
                    }}
                    onCancel={() => setEditingListId(null)}
                />
            );
        }
        const active = selectedList?.id === list.id;
        const count = counts.byListId[list.id] ?? 0;
        const isTaskDropOver = dropTargetKey === list.id && Boolean(draggingTaskId);
        const isDraggingThisList = draggingListId === list.id;
        return (
            <div key={list.id}>
                <div
                    draggable={deletingListId !== list.id}
                    onDragStart={(event) => {
                        event.dataTransfer.setData(LIST_DRAG_MIME, list.id);
                        event.dataTransfer.setData('text/plain', list.name);
                        event.dataTransfer.effectAllowed = 'move';
                        setDraggingListId(list.id);
                    }}
                    onDragEnd={() => {
                        setDraggingListId(null);
                        setDropTargetKey(null);
                    }}
                    onDragOver={(event) => handleTaskDragOver(event, list.id)}
                    onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTargetKey === list.id) {
                            setDropTargetKey(null);
                        }
                    }}
                    onDrop={(event) => handleTaskDrop(event, list.id)}
                    className={`group/item relative flex items-center transition-colors ${isTaskDropOver ? dropHighlight : active ? activeItem : inactiveItem} ${isDraggingThisList ? 'opacity-50' : ''}`}
                >
                    <a
                        href={`#${list.id}`}
                        draggable={false}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 text-sm outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-accent ${indented ? 'pl-3' : 'pl-4'}`}
                    >
                        <ListIcon className={`size-[18px] shrink-0 ${active || isTaskDropOver ? 'text-accent' : 'text-muted'}`} />
                        <span className="min-w-0 flex-1 truncate">{list.name}</span>
                        {isTaskDropOver ? (
                            <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg">
                                移動
                            </span>
                        ) : (
                            count > 0 && <span className="shrink-0 text-xs text-muted">{count}</span>
                        )}
                    </a>
                    <div className="flex shrink-0 items-center gap-0.5 pr-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/item:opacity-100 sm:focus-within:opacity-100">
                        <button
                            type="button"
                            aria-label={`${list.name} の編集`}
                            title="リスト名を編集"
                            onClick={() => {
                                setDeletingListId(null);
                                setEditingListId(list.id);
                            }}
                            className="grid size-6 place-items-center rounded text-muted hover:bg-block hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                        >
                            <PencilIcon className="size-3.5" />
                        </button>
                        <button
                            type="button"
                            aria-label={`${list.name} の削除`}
                            title="リストを削除"
                            onClick={() => {
                                setEditingListId(null);
                                setDeletingListId(list.id);
                            }}
                            className="grid size-6 place-items-center rounded text-muted hover:bg-block hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
                        >
                            <TrashIcon className="size-3.5" />
                        </button>
                    </div>
                </div>
                {deletingListId === list.id && (
                    <TaskListDeleteConfirmation
                        key={list.id}
                        list={list}
                        onDeleted={(id) => {
                            setDeletingListId(null);
                            onListDeleted(id);
                        }}
                        onCancel={() => setDeletingListId(null)}
                    />
                )}
            </div>
        );
    }

    const isTasksDropOver = dropTargetKey === 'tasks' && Boolean(draggingTaskId);
    const isUngroupDropOver = dropTargetKey === 'ungrouped' && Boolean(draggingListId);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <nav aria-label="メイン" className="min-w-0 flex-1 overflow-y-auto py-2">
                <a
                    href="#important"
                    onClick={onNavigate}
                    aria-current={isImportantView ? 'page' : undefined}
                    className={`${baseItem} ${isImportantView ? activeItem : inactiveItem}`}
                >
                    <StarIcon className={`size-[18px] shrink-0 ${isImportantView ? 'text-accent' : 'text-muted'}`} />
                    <span className="min-w-0 flex-1 truncate">重要</span>
                    {counts.important > 0 && <span className="text-xs text-muted">{counts.important}</span>}
                </a>
                <a
                    href="#tasks"
                    onClick={onNavigate}
                    onDragOver={(event) => handleTaskDragOver(event, 'tasks')}
                    onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTargetKey === 'tasks') {
                            setDropTargetKey(null);
                        }
                    }}
                    onDrop={(event) => handleTaskDrop(event, null)}
                    aria-current={isAllActive ? 'page' : undefined}
                    className={`${baseItem} ${isTasksDropOver ? dropHighlight : isAllActive ? activeItem : inactiveItem}`}
                >
                    <HomeIcon className={`size-[18px] shrink-0 ${isAllActive || isTasksDropOver ? 'text-accent' : 'text-muted'}`} />
                    <span className="min-w-0 flex-1 truncate">タスク</span>
                    {isTasksDropOver ? (
                        <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg">
                            リスト解除
                        </span>
                    ) : (
                        counts.all > 0 && <span className="text-xs text-muted">{counts.all}</span>
                    )}
                </a>

                <div className="my-2.5 border-t border-border" />

                {draggingTaskId && (
                    <p className="mx-3 mb-1.5 rounded border border-dashed border-accent/60 bg-selection/70 px-2.5 py-1 text-[11px] font-medium text-accent">
                        リストへドロップして追加・移動（「タスク」で解除）
                    </p>
                )}

                {groups.map((group) => {
                    const groupLists = lists.filter((list) => list.groupId === group.id);
                    const expanded = !collapsedGroups[group.id];
                    const isGroupDropOver = dropTargetKey === group.id && Boolean(draggingListId);
                    return (
                        <div key={group.id}>
                            {editingGroupId === group.id ? (
                                <ListGroupNameEditor
                                    group={group}
                                    onSaved={(updated) => {
                                        updateGroup(updated);
                                        setEditingGroupId(null);
                                    }}
                                    onCancel={() => setEditingGroupId(null)}
                                />
                            ) : deletingGroupId === group.id ? (
                                <ListGroupDeleteConfirm
                                    group={group}
                                    onDeleted={(deletedId) => {
                                        removeGroup(deletedId);
                                        setDeletingGroupId(null);
                                    }}
                                    onCancel={() => setDeletingGroupId(null)}
                                />
                            ) : (
                                <div
                                    onDragOver={(event) => handleGroupDragOver(event, group.id)}
                                    onDragLeave={(event) => {
                                        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTargetKey === group.id) {
                                            setDropTargetKey(null);
                                        }
                                    }}
                                    onDrop={(event) => handleGroupDrop(event, group.id)}
                                    className={`group/item flex items-center text-ink transition-colors ${isGroupDropOver ? dropHighlight : 'hover:bg-hover'}`}
                                >
                                    <button
                                        type="button"
                                        aria-expanded={expanded}
                                        onClick={() => toggleGroup(group.id)}
                                        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 pl-4 text-left text-sm font-medium outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-accent"
                                    >
                                        <FolderIcon className={`size-[18px] shrink-0 ${isGroupDropOver ? 'text-accent' : 'text-muted'}`} />
                                        <span className="min-w-0 flex-1 truncate">{group.name}</span>
                                        {isGroupDropOver ? (
                                            <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg">
                                                追加
                                            </span>
                                        ) : (
                                            <>
                                                <span className="shrink-0 text-xs text-muted">{groupLists.length}</span>
                                                <ChevronIcon open={expanded} className="size-3.5 shrink-0 text-muted" />
                                            </>
                                        )}
                                    </button>
                                    <div className="flex shrink-0 items-center gap-0.5 pr-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/item:opacity-100 sm:focus-within:opacity-100">
                                        <button
                                            type="button"
                                            aria-label={`${group.name} の編集`}
                                            title="グループ名を編集"
                                            onClick={() => {
                                                setDeletingGroupId(null);
                                                setEditingGroupId(group.id);
                                            }}
                                            className="grid size-6 place-items-center rounded text-muted hover:bg-block hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                                        >
                                            <PencilIcon className="size-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`${group.name} の削除`}
                                            title="グループを削除"
                                            onClick={() => {
                                                setEditingGroupId(null);
                                                setDeletingGroupId(group.id);
                                            }}
                                            className="grid size-6 place-items-center rounded text-muted hover:bg-block hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
                                        >
                                            <TrashIcon className="size-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                            {expanded && (
                                <div className="ml-6 border-l border-border">
                                    {groupLists.length === 0 ? (
                                        <p className="py-1.5 pr-4 pl-3 text-xs text-muted">リストはまだありません。</p>
                                    ) : (
                                        groupLists.map((list) => renderListRow(list, true))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {draggedList?.groupId && (
                    <div
                        onDragOver={(event) => {
                            if (!hasListPayload(event)) {
                                return;
                            }
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            if (dropTargetKey !== 'ungrouped') {
                                setDropTargetKey('ungrouped');
                            }
                        }}
                        onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTargetKey === 'ungrouped') {
                                setDropTargetKey(null);
                            }
                        }}
                        onDrop={(event) => {
                            if (!hasListPayload(event)) {
                                return;
                            }
                            event.preventDefault();
                            const listId = readListId(event);
                            setDropTargetKey(null);
                            setDraggingListId(null);
                            if (listId) {
                                onDropListToGroup(listId, null);
                            }
                        }}
                        className={`mx-3 my-1.5 rounded border border-dashed px-2.5 py-2 text-center text-xs font-medium transition-colors ${isUngroupDropOver ? 'border-accent bg-selection text-accent' : 'border-border bg-canvas text-muted'}`}
                    >
                        ここにドロップしてグループから外す
                    </div>
                )}

                {ungroupedLists.map((list) => renderListRow(list))}

                <div className="mt-2 space-y-1 px-2">
                    <form onSubmit={create}>
                        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors focus-within:bg-hover hover:bg-hover">
                            <PlusIcon className="size-[18px] shrink-0 text-accent" />
                            <label htmlFor="task-list-name" className="sr-only">新しいリスト</label>
                            <input
                                id="task-list-name"
                                value={name}
                                placeholder="新しいリスト"
                                disabled={saving || loadState !== 'ready'}
                                aria-describedby={error ? 'task-list-create-error' : undefined}
                                aria-invalid={error === 'リスト名を入力してください。'}
                                onChange={(event) => {
                                    setName(event.target.value);
                                    setError('');
                                }}
                                className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-accent focus:outline-none disabled:opacity-50"
                            />
                            {name.length > 0 && (
                                <button
                                    type="submit"
                                    disabled={saving || loadState !== 'ready'}
                                    className="shrink-0 rounded bg-accent px-2.5 py-1 text-xs font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
                                >
                                    {saving ? '作成中…' : '追加'}
                                </button>
                            )}
                        </div>
                        {error && (
                            <p id="task-list-create-error" role="alert" className="mt-1 px-2 text-xs text-danger">
                                {error}
                            </p>
                        )}
                        {loadState === 'error' && (
                            <div role="alert" className="mt-2 rounded-md bg-canvas p-2.5 text-xs text-danger">
                                <p>リストを取得できませんでした。</p>
                                <button type="button" className="mt-1 font-semibold underline" onClick={retryLoad}>
                                    再試行
                                </button>
                            </div>
                        )}
                    </form>

                    <form onSubmit={createGroup}>
                        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors focus-within:bg-hover hover:bg-hover">
                            <FolderPlusIcon className="size-[18px] shrink-0 text-muted" />
                            <label htmlFor="list-group-name" className="sr-only">新しいグループ</label>
                            <input
                                id="list-group-name"
                                value={groupName}
                                placeholder="新しいグループ"
                                disabled={groupSaving || groupsLoadState !== 'ready'}
                                aria-describedby={groupError ? 'list-group-create-error' : undefined}
                                aria-invalid={groupError === 'グループ名を入力してください。'}
                                onChange={(event) => {
                                    setGroupName(event.target.value);
                                    setGroupError('');
                                }}
                                className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none disabled:opacity-50"
                            />
                            {groupName.length > 0 && (
                                <button
                                    type="submit"
                                    disabled={groupSaving || groupsLoadState !== 'ready'}
                                    className="shrink-0 rounded bg-accent px-2.5 py-1 text-xs font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
                                >
                                    {groupSaving ? '作成中…' : '追加'}
                                </button>
                            )}
                        </div>
                        {groupError && (
                            <p id="list-group-create-error" role="alert" className="mt-1 px-2 text-xs text-danger">
                                {groupError}
                            </p>
                        )}
                        {groupsLoadState === 'error' && (
                            <div role="alert" className="mt-2 rounded-md bg-canvas p-2.5 text-xs text-danger">
                                <p>グループを取得できませんでした。</p>
                                <button type="button" className="mt-1 font-semibold underline" onClick={retryGroupsLoad}>
                                    再試行
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </nav>
        </div>
    );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
    createTask,
    isBlankTaskName,
    listTasks,
    TaskRequestError,
    updateTaskCompletion,
    updateTaskImportance,
    updateTaskList,
    updateTaskListGroup,
} from './api/tasks';
import type { Task } from './api/tasks';
import { CheckIcon, ChevronIcon, CloseIcon, HomeIcon, ListIcon, MenuIcon, MoonIcon, PlusIcon, SearchIcon, SettingsIcon, StarIcon } from './Icons';
import TaskDetailPanel from './TaskDetailPanel';
import { shouldMoveListToGroup, shouldMoveTaskToList, TASK_DRAG_MIME } from './taskDragDrop';
import { TaskListNameEditor, TaskListNavigation, useTaskLists } from './TaskLists';
import { clearDeletedListFromTasks } from './taskListDeletion';
import { resolveVisibleTasks } from './taskSearch';
import { applyTheme, loadInitialTheme, toggleTheme } from './theme';
import type { Theme } from './theme';

type TaskUpdate = Partial<Omit<Task, 'id'>>;
type TaskStatusField = 'completed' | 'important';

function TaskRow({
    task,
    listName,
    selected,
    dragging,
    onSelect,
    onDragStart,
    onDragEnd,
    onUpdated,
}: {
    task: Task;
    listName?: string;
    selected: boolean;
    dragging: boolean;
    onSelect: () => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    onUpdated: (id: string, update: TaskUpdate) => void;
}) {
    const inFlight = useRef(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');

    async function toggleStatus(field: TaskStatusField) {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setSaveState('saving');
        try {
            const updated = await (field === 'completed'
                ? updateTaskCompletion(task.id, !task.completed)
                : updateTaskImportance(task.id, !task.important));
            onUpdated(updated.id, { [field]: updated[field] });
            setSaveState('idle');
        } catch {
            setSaveState('error');
        } finally {
            inFlight.current = false;
        }
    }

    return (
        <li
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData(TASK_DRAG_MIME, task.id);
                event.dataTransfer.setData('text/plain', task.name);
                event.dataTransfer.effectAllowed = 'move';
                onDragStart();
            }}
            onDragEnd={onDragEnd}
            className={`group flex cursor-grab items-center gap-3 rounded-md border border-border px-4 py-3 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.06),0_1.6px_3.6px_rgba(0,0,0,0.04)] transition-colors active:cursor-grabbing ${selected ? 'bg-selection' : 'bg-block hover:bg-hover/60'} ${dragging ? 'opacity-50' : ''}`}
        >
            <button
                type="button"
                aria-label={`${task.name} の完了`}
                aria-pressed={task.completed}
                aria-disabled={saveState === 'saving'}
                onClick={(event) => {
                    event.stopPropagation();
                    void toggleStatus('completed');
                }}
                className="-ml-1 grid size-7 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent aria-disabled:opacity-60"
            >
                <span
                    aria-hidden="true"
                    className={`grid size-[18px] place-items-center rounded-full border transition-colors ${task.completed ? 'border-accent bg-accent text-accent-fg' : 'border-accent text-transparent hover:text-accent/60'}`}
                >
                    <CheckIcon className="size-3" />
                </span>
            </button>

            <button
                type="button"
                onClick={onSelect}
                aria-expanded={selected}
                className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
                <span className={`block wrap-anywhere whitespace-pre-wrap text-[15px] ${task.completed ? 'text-muted line-through' : 'text-ink'}`}>
                    {task.name}
                </span>
                {listName && <span className="mt-0.5 block text-xs text-muted">{listName}</span>}
                {saveState === 'saving' && <span role="status" className="mt-1 block text-xs text-muted">保存中…</span>}
                {saveState === 'error' && (
                    <span role="alert" className="mt-1 block text-xs text-danger">
                        状態を変更できませんでした。もう一度お試しください。
                    </span>
                )}
            </button>

            <button
                type="button"
                aria-label={`${task.name} の重要`}
                aria-pressed={task.important}
                aria-disabled={saveState === 'saving'}
                onClick={(event) => {
                    event.stopPropagation();
                    void toggleStatus('important');
                }}
                className={`-mr-1 grid size-8 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent aria-disabled:opacity-60 ${task.important ? 'text-accent' : 'text-marker hover:text-accent'}`}
            >
                <StarIcon filled={task.important} className="size-[18px]" />
            </button>
        </li>
    );
}

const DESKTOP_SIDEBAR_QUERY = '(min-width: 768px)';

function isDesktopViewport(): boolean {
    if (typeof window === 'undefined') {
        return true;
    }
    if (typeof window.matchMedia === 'function') {
        return window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches;
    }
    return window.innerWidth >= 768;
}

export default function App() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const taskLists = useTaskLists();
    const { isImportantView, selectedList } = taskLists;
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [name, setName] = useState('');
    const [addFocused, setAddFocused] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [completedOpen, setCompletedOpen] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(() => isDesktopViewport());
    const desktopClosedByUser = useRef(false);
    const [theme, setTheme] = useState<Theme>(() => loadInitialTheme());
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsMenuRef = useRef<HTMLDivElement>(null);
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const [moveStatus, setMoveStatus] = useState<{ kind: 'saving' | 'error'; message: string } | null>(null);
    const movingTaskIds = useRef<Set<string>>(new Set());
    const movingListIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }
        const media = window.matchMedia(DESKTOP_SIDEBAR_QUERY);
        function handleMediaChange(event: MediaQueryListEvent) {
            if (!event.matches) {
                setSidebarOpen(false);
            } else if (!desktopClosedByUser.current) {
                setSidebarOpen(true);
            }
        }
        media.addEventListener('change', handleMediaChange);
        return () => media.removeEventListener('change', handleMediaChange);
    }, []);

    function openSidebar() {
        if (isDesktopViewport()) {
            desktopClosedByUser.current = false;
        }
        setSidebarOpen(true);
    }

    function closeSidebar() {
        if (isDesktopViewport()) {
            desktopClosedByUser.current = true;
        }
        setSidebarOpen(false);
    }

    useEffect(() => {
        applyTheme(theme, false);
    }, [theme]);

    useEffect(() => {
        if (!settingsOpen) {
            return;
        }
        function handlePointerDown(event: MouseEvent) {
            if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
                setSettingsOpen(false);
            }
        }
        function handleKeyDown(event: globalThis.KeyboardEvent) {
            if (event.key === 'Escape') {
                setSettingsOpen(false);
            }
        }
        document.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [settingsOpen]);

    function handleToggleTheme() {
        setTheme((current) => {
            const next = toggleTheme(current);
            applyTheme(next, true);
            return next;
        });
    }

    useEffect(() => {
        const request = new AbortController();
        listTasks(request.signal).then((items) => {
            if (!request.signal.aborted) {
                setTasks(items);
                setLoadState('ready');
            }
        }).catch(() => {
            if (!request.signal.aborted) {
                setLoadState('error');
            }
        });
        return () => request.abort();
    }, [loadAttempt]);

    const listNameById = useMemo(() => {
        const map: Record<string, string> = {};
        for (const list of taskLists.lists) {
            map[list.id] = list.name;
        }
        return map;
    }, [taskLists.lists]);

    const counts = useMemo(() => {
        const byListId: Record<string, number> = {};
        let all = 0;
        let important = 0;
        for (const task of tasks) {
            if (!task.completed) {
                all += 1;
                if (task.important) {
                    important += 1;
                }
                if (task.listId) {
                    byListId[task.listId] = (byListId[task.listId] ?? 0) + 1;
                }
            }
        }
        return { all, important, byListId };
    }, [tasks]);

    async function addTask() {
        if (saving || loadState !== 'ready' || isBlankTaskName(name)) {
            return;
        }
        setSaveError('');
        setSaving(true);
        const targetListId = !isImportantView && selectedList ? selectedList.id : null;
        const markImportant = isImportantView;
        try {
            const created = await createTask(name);
            setName('');
            if (targetListId) {
                try {
                    const assigned = await updateTaskList(created.id, targetListId);
                    setTasks((items) => [assigned, ...items]);
                } catch {
                    setTasks((items) => [created, ...items]);
                    setSaveError('タスクは作成されましたが、このリストへの追加に失敗しました。');
                }
            } else if (markImportant) {
                try {
                    const starred = await updateTaskImportance(created.id, true);
                    setTasks((items) => [starred, ...items]);
                } catch {
                    setTasks((items) => [created, ...items]);
                    setSaveError('タスクは作成されましたが、重要の設定に失敗しました。');
                }
            } else {
                setTasks((items) => [created, ...items]);
            }
        } catch (error) {
            if (!(error instanceof TaskRequestError && error.code === 'TASK_NAME_REQUIRED')) {
                setSaveError('タスクを登録できませんでした。もう一度お試しください。');
            }
        } finally {
            setSaving(false);
        }
    }

    function updateTask(id: string, update: TaskUpdate) {
        setTasks((items) => items.map((item) => item.id === id ? { ...item, ...update } : item));
    }

    function removeTask(id: string) {
        setTasks((items) => items.filter((item) => item.id !== id));
        setSelectedTaskId((current) => current === id ? null : current);
    }

    function handleListDeleted(id: string) {
        taskLists.removeList(id);
        setTasks((items) => clearDeletedListFromTasks(items, id));
    }

    async function handleDropTaskToList(taskId: string, targetListId: string | null) {
        const task = tasks.find((item) => item.id === taskId);
        if (!shouldMoveTaskToList(task, targetListId) || movingTaskIds.current.has(taskId)) {
            return;
        }
        movingTaskIds.current.add(taskId);
        setMoveStatus({ kind: 'saving', message: 'リストへ移動中…' });
        try {
            const updated = await updateTaskList(taskId, targetListId);
            updateTask(updated.id, { listId: updated.listId });
            setMoveStatus(null);
        } catch {
            setMoveStatus({
                kind: 'error',
                message: 'タスクの所属先を変更できませんでした。もう一度お試しください。',
            });
        } finally {
            movingTaskIds.current.delete(taskId);
        }
    }

    async function handleDropListToGroup(listId: string, targetGroupId: string | null) {
        const list = taskLists.lists.find((item) => item.id === listId);
        if (!shouldMoveListToGroup(list, targetGroupId) || movingListIds.current.has(listId)) {
            return;
        }
        movingListIds.current.add(listId);
        setMoveStatus({ kind: 'saving', message: 'グループを変更中…' });
        try {
            const updated = await updateTaskListGroup(listId, targetGroupId);
            taskLists.updateList(updated);
            setMoveStatus(null);
        } catch {
            setMoveStatus({
                kind: 'error',
                message: 'リストのグループを変更できませんでした。もう一度お試しください。',
            });
        } finally {
            movingListIds.current.delete(listId);
        }
    }

    function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        // IME confirmation may report key code 229 even when isComposing is false.
        if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
            return;
        }
        event.preventDefault();
        if (!event.repeat) {
            void addTask();
        }
    }

    const viewTasks = isImportantView
        ? tasks.filter((task) => task.important)
        : selectedList
            ? tasks.filter((task) => task.listId === selectedList.id)
            : tasks;
    const { isSearching, tasks: visibleTasks } = resolveVisibleTasks(tasks, viewTasks, searchQuery);
    const activeTasks = visibleTasks.filter((task) => !task.completed);
    const completedTasks = visibleTasks.filter((task) => task.completed);
    const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

    const headingTitle = isSearching
        ? `「${searchQuery.trim()}」の検索結果`
        : isImportantView
            ? '重要'
            : selectedList?.name ?? 'タスク';

    const showAddCard = !isSearching;

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
            <header className="flex h-12 shrink-0 items-center gap-3 bg-header px-3 text-white shadow-xs sm:px-4">
                <div className="flex shrink-0 items-center">
                    <span className="pl-1 text-base font-semibold tracking-tight whitespace-nowrap md:pl-2">To Do</span>
                </div>

                <div className="flex min-w-0 flex-1 justify-start sm:justify-center">
                    {!mobileSearchOpen && searchQuery.length === 0 && (
                        <button
                            type="button"
                            aria-label="タスク名を検索"
                            title="検索"
                            onClick={() => {
                                setMobileSearchOpen(true);
                                requestAnimationFrame(() => searchInputRef.current?.focus());
                            }}
                            className="grid size-8 shrink-0 place-items-center rounded bg-block text-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white sm:hidden"
                        >
                            <SearchIcon className="size-4" />
                        </button>
                    )}
                    <div
                        className={`${mobileSearchOpen || searchQuery.length > 0 ? 'block w-full' : 'hidden'} relative sm:block sm:w-[400px] sm:shrink-0`}
                    >
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-accent" />
                        <input
                            ref={searchInputRef}
                            type="search"
                            value={searchQuery}
                            aria-label="タスク名を検索"
                            onChange={(event) => setSearchQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    setSearchQuery('');
                                    setMobileSearchOpen(false);
                                    event.currentTarget.blur();
                                }
                            }}
                            onBlur={() => {
                                if (searchQuery.length === 0) {
                                    setMobileSearchOpen(false);
                                }
                            }}
                            className="h-8 w-full rounded bg-block pr-8 pl-9 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                        />
                        {(searchQuery.length > 0 || mobileSearchOpen) && (
                            <button
                                type="button"
                                aria-label="検索をクリア"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    setSearchQuery('');
                                    setMobileSearchOpen(false);
                                }}
                                className={`absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-hover hover:text-ink ${searchQuery.length === 0 ? 'sm:hidden' : ''}`}
                            >
                                <CloseIcon className="size-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div ref={settingsMenuRef} className="relative flex shrink-0 items-center justify-end">
                    <button
                        type="button"
                        aria-label="設定"
                        title="設定"
                        aria-expanded={settingsOpen}
                        aria-haspopup="menu"
                        onClick={() => setSettingsOpen((open) => !open)}
                        className={`grid size-8 place-items-center rounded text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white ${settingsOpen ? 'bg-white/20' : ''}`}
                    >
                        <SettingsIcon className="size-[18px]" />
                    </button>

                    {settingsOpen && (
                        <div
                            role="menu"
                            aria-label="設定メニュー"
                            className="absolute top-full right-0 z-40 mt-2 w-72 rounded-md border border-border bg-block p-4 text-ink shadow-lg"
                        >
                            <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
                                <span className="text-sm font-semibold text-ink">設定</span>
                                <button
                                    type="button"
                                    aria-label="設定を閉じる"
                                    onClick={() => setSettingsOpen(false)}
                                    className="grid size-6 place-items-center rounded text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                                >
                                    <CloseIcon className="size-3.5" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between gap-3 py-1">
                                <span id="dark-mode-label" className="flex items-center gap-2 text-sm text-ink">
                                    <MoonIcon className="size-4 shrink-0 text-muted" />
                                    <span>ダークモードを有効にする</span>
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={theme === 'dark'}
                                    aria-labelledby="dark-mode-label"
                                    onClick={handleToggleTheme}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${theme === 'dark' ? 'border-accent bg-accent' : 'border-marker bg-hover'}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`inline-block size-3.5 rounded-full transition-transform ${theme === 'dark' ? 'translate-x-4.5 bg-accent-fg' : 'translate-x-0.5 bg-muted'}`}
                                    />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <div className="relative flex min-h-0 flex-1">
                {sidebarOpen && (
                    <button
                        type="button"
                        aria-label="メニューを閉じる"
                        onClick={closeSidebar}
                        className="fixed inset-x-0 top-12 bottom-0 z-20 bg-black/25 md:hidden"
                    />
                )}

                <aside
                    className={`${sidebarOpen ? 'flex' : 'hidden'} fixed inset-y-12 left-0 z-30 w-[260px] flex-col border-r border-border bg-sidebar shadow-lg md:static md:inset-auto md:z-auto md:shrink-0 md:shadow-none`}
                >
                    <div className="flex items-center px-4 pt-4 pb-1">
                        <button
                            type="button"
                            aria-label="メニューを閉じる"
                            title="メニューを閉じる"
                            aria-expanded={sidebarOpen}
                            onClick={closeSidebar}
                            className="grid size-8 place-items-center rounded text-ink transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                        >
                            <MenuIcon className="size-5" />
                        </button>
                    </div>
                    <TaskListNavigation
                        {...taskLists}
                        counts={counts}
                        draggingTaskId={draggingTaskId}
                        onDropTaskToList={(taskId, targetListId) => void handleDropTaskToList(taskId, targetListId)}
                        onDropListToGroup={(listId, targetGroupId) => void handleDropListToGroup(listId, targetGroupId)}
                        onListDeleted={handleListDeleted}
                        onNavigate={() => {
                            if (!isDesktopViewport()) {
                                setSidebarOpen(false);
                            }
                        }}
                    />
                </aside>

                <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-canvas">
                    <section
                        id="tasks"
                        aria-labelledby="tasks-heading"
                        className={`w-full pt-4 pb-6 ${sidebarOpen ? 'px-4 md:px-7' : 'pr-4 pl-4 md:pr-7'}`}
                    >
                        <div className="mb-4 flex items-start gap-2.5 text-accent">
                            {!sidebarOpen && (
                                <button
                                    type="button"
                                    aria-label="メニューを開く"
                                    title="メニューを開く"
                                    aria-expanded={sidebarOpen}
                                    onClick={openSidebar}
                                    className="grid size-8 shrink-0 place-items-center rounded text-ink transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                                >
                                    <MenuIcon className="size-5" />
                                </button>
                            )}
                            {isSearching ? (
                                <SearchIcon className="mt-1.5 size-5 shrink-0" />
                            ) : isImportantView ? (
                                <StarIcon className="mt-1.5 size-5 shrink-0" />
                            ) : selectedList ? (
                                <ListIcon className="mt-1.5 size-5 shrink-0" />
                            ) : (
                                <HomeIcon className="mt-1.5 size-5 shrink-0" />
                            )}
                            {!isSearching && selectedList ? (
                                <h1 id="tasks-heading" className="min-w-0 flex-1">
                                    <span className="sr-only">{selectedList.name}</span>
                                    <TaskListNameEditor
                                        key={selectedList.id}
                                        list={selectedList}
                                        variant="heading"
                                        onSaved={taskLists.updateList}
                                    />
                                </h1>
                            ) : (
                                <h1 id="tasks-heading" className="min-w-0 truncate text-2xl leading-8 font-semibold tracking-tight wrap-anywhere">
                                    {headingTitle}
                                </h1>
                            )}
                        </div>

                        {moveStatus && (
                            <div
                                role={moveStatus.kind === 'error' ? 'alert' : 'status'}
                                className={`mb-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${moveStatus.kind === 'error' ? 'border-danger/30 bg-block text-danger' : 'border-border bg-block text-muted'}`}
                            >
                                <span>{moveStatus.message}</span>
                                {moveStatus.kind === 'error' && (
                                    <button
                                        type="button"
                                        onClick={() => setMoveStatus(null)}
                                        className="shrink-0 font-semibold underline"
                                    >
                                        閉じる
                                    </button>
                                )}
                            </div>
                        )}

                        {showAddCard && (
                            <div className="mb-4">
                                <div className="flex items-center gap-3 rounded-md border border-border bg-block px-4 py-3 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.06)] focus-within:border-accent/60">
                                    <span
                                        aria-hidden="true"
                                        className="grid size-6 shrink-0 place-items-center text-accent"
                                    >
                                        {addFocused || name.length > 0 ? (
                                            <span className="size-[18px] rounded-full border border-accent" />
                                        ) : (
                                            <PlusIcon className="size-5" />
                                        )}
                                    </span>
                                    <input
                                        value={name}
                                        placeholder="タスクの追加"
                                        readOnly={saving}
                                        aria-label="タスクの追加"
                                        enterKeyHint="done"
                                        onFocus={() => setAddFocused(true)}
                                        onBlur={() => setAddFocused(false)}
                                        onKeyDown={handleInputKeyDown}
                                        onChange={(event) => {
                                            setName(event.target.value);
                                            setSaveError('');
                                        }}
                                        className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-accent focus:outline-none"
                                    />
                                    {name.length > 0 && (
                                        <button
                                            type="button"
                                            disabled={saving || loadState !== 'ready' || isBlankTaskName(name)}
                                            onClick={() => void addTask()}
                                            className="shrink-0 rounded border border-border bg-block px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-selection disabled:opacity-40"
                                        >
                                            {saving ? '登録中…' : '追加'}
                                        </button>
                                    )}
                                </div>
                                {saving && <p role="status" className="mt-1.5 text-xs text-muted">登録中…</p>}
                                {saveError && <p role="alert" className="mt-1.5 text-xs text-danger">{saveError}</p>}
                            </div>
                        )}

                        {loadState === 'loading' && <p role="status" className="py-4 text-sm text-muted">読み込み中…</p>}
                        {loadState === 'error' && (
                            <div role="alert" className="rounded-md border border-border bg-block p-4 text-sm shadow-xs">
                                <p>タスクを取得できませんでした。</p>
                                <button
                                    type="button"
                                    className="mt-2 font-semibold text-accent underline"
                                    onClick={() => {
                                        setLoadState('loading');
                                        setLoadAttempt((attempt) => attempt + 1);
                                    }}
                                >
                                    再試行
                                </button>
                            </div>
                        )}
                        {loadState === 'ready' && visibleTasks.length === 0 && (
                            <p role="status" className="rounded-md border border-border bg-block px-4 py-4 text-sm text-muted shadow-xs">
                                {isSearching
                                    ? '一致するタスクがありません'
                                    : isImportantView
                                        ? '重要なタスクはまだありません。'
                                        : 'タスクはまだありません。'}
                            </p>
                        )}

                        {activeTasks.length > 0 && (
                            <ul className="space-y-2">
                                {activeTasks.map((task) => (
                                    <TaskRow
                                        key={task.id}
                                        task={task}
                                        listName={!selectedList && task.listId ? listNameById[task.listId] : undefined}
                                        selected={selectedTaskId === task.id}
                                        dragging={draggingTaskId === task.id}
                                        onSelect={() => setSelectedTaskId((current) => current === task.id ? null : task.id)}
                                        onDragStart={() => setDraggingTaskId(task.id)}
                                        onDragEnd={() => setDraggingTaskId(null)}
                                        onUpdated={updateTask}
                                    />
                                ))}
                            </ul>
                        )}

                        {completedTasks.length > 0 && (
                            <div className="mt-5">
                                <button
                                    type="button"
                                    aria-expanded={completedOpen}
                                    onClick={() => setCompletedOpen((open) => !open)}
                                    className="mb-2 flex items-center gap-2 rounded px-1.5 py-1 text-sm font-semibold text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                                >
                                    <ChevronIcon open={completedOpen} className="size-4 text-muted" />
                                    <span>完了済み</span>
                                    <span className="font-normal text-muted">{completedTasks.length}</span>
                                </button>
                                {completedOpen && (
                                    <ul className="space-y-2">
                                        {completedTasks.map((task) => (
                                            <TaskRow
                                                key={task.id}
                                                task={task}
                                                listName={!selectedList && task.listId ? listNameById[task.listId] : undefined}
                                                selected={selectedTaskId === task.id}
                                                dragging={draggingTaskId === task.id}
                                                onSelect={() => setSelectedTaskId((current) => current === task.id ? null : task.id)}
                                                onDragStart={() => setDraggingTaskId(task.id)}
                                                onDragEnd={() => setDraggingTaskId(null)}
                                                onUpdated={updateTask}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </section>
                </main>

                {selectedTask && (
                    <>
                        <button
                            type="button"
                            aria-label="詳細を閉じる"
                            onClick={() => setSelectedTaskId(null)}
                            className="fixed inset-x-0 top-12 bottom-0 z-20 bg-black/20 lg:hidden"
                        />
                        <TaskDetailPanel
                            task={selectedTask}
                            listName={selectedTask.listId ? listNameById[selectedTask.listId] : undefined}
                            onUpdated={updateTask}
                            onDeleted={removeTask}
                            onClose={() => setSelectedTaskId(null)}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

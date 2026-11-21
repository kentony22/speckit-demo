import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createTask, isBlankTaskName, listTasks, TaskRequestError, updateTaskCompletion, updateTaskImportance } from './api/tasks';
import type { Task, TaskList } from './api/tasks';
import TaskNameEditor from './TaskNameEditor';
import { TaskListMembership, TaskListNavigation, useTaskLists } from './TaskLists';
import { resolveVisibleTasks } from './taskSearch';

type TaskUpdate = Partial<Omit<Task, 'id'>>;
type TaskStatusField = 'completed' | 'important';

function TaskRow({ task, lists, onUpdated }: {
    task: Task;
    lists: TaskList[];
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
        <li className="flex items-start gap-3.5 rounded-xl bg-block px-4 py-4 shadow-xs sm:text-lg">
            <button
                type="button"
                aria-label={`${task.name} の完了`}
                aria-pressed={task.completed}
                aria-disabled={saveState === 'saving'}
                onClick={() => void toggleStatus('completed')}
                className="-my-1 -ml-1 grid size-8 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent aria-disabled:opacity-60"
            >
                <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full border-2 border-marker text-sm leading-none font-bold ${task.completed ? 'bg-selection' : ''}`}>
                    {task.completed && '✓'}
                </span>
            </button>
            <div className="min-w-0 grow">
                <span className={`wrap-anywhere whitespace-pre-wrap ${task.completed ? 'text-muted line-through' : ''}`}>{task.name}</span>
                <TaskNameEditor task={task} onSaved={(name) => onUpdated(task.id, { name })} />
                {saveState === 'saving' && <p role="status" className="mt-1 text-sm">保存中…</p>}
                {saveState === 'error' && <p role="alert" className="mt-1 text-sm text-[#942e28]">状態を変更できませんでした。もう一度お試しください。</p>}
                {lists.length > 0 && <TaskListMembership task={task} lists={lists} onUpdated={(updated) => onUpdated(updated.id, { listId: updated.listId })} />}
            </div>
            <button
                type="button"
                aria-label={`${task.name} の重要`}
                aria-pressed={task.important}
                aria-disabled={saveState === 'saving'}
                onClick={() => void toggleStatus('important')}
                className={`-my-1 grid size-8 shrink-0 place-items-center rounded-full text-xl leading-none focus-visible:outline-2 focus-visible:outline-accent aria-disabled:opacity-60 ${task.important ? 'text-accent' : 'text-muted'}`}
            >
                <span aria-hidden="true">{task.important ? '★' : '☆'}</span>
            </button>
        </li>
    );
}

export default function App() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const taskLists = useTaskLists();
    const { isImportantView, selectedList } = taskLists;
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [name, setName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);

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

    async function addTask() {
        if (saving || loadState !== 'ready' || isBlankTaskName(name)) {
            return;
        }
        setSaveError('');
        setSaving(true);
        try {
            const task = await createTask(name);
            setTasks((items) => [task, ...items]);
            setName('');
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

    return (
        <div className="grid min-h-dvh grid-rows-[auto_1fr] sm:grid-cols-[clamp(11rem,25vw,15rem)_minmax(0,1fr)] sm:grid-rows-[1fr]">
            <aside className="flex min-w-0 flex-col gap-4 bg-sidebar px-4 py-3.5 sm:gap-6 sm:py-9">
                <div className="flex items-center gap-2.5 whitespace-nowrap font-bold sm:px-2 sm:text-lg">
                    <span aria-hidden="true" className="relative size-5 shrink-0 rounded-[4px] border-2 border-current after:absolute after:top-[2px] after:left-[5px] after:h-[9px] after:w-[5px] after:rotate-45 after:border-r-2 after:border-b-2" />
                    To Do
                </div>
                <TaskListNavigation {...taskLists} />
            </aside>

            <main className="flex min-w-0 flex-col bg-canvas">
                <section id="tasks" aria-labelledby="tasks-heading" className="grow px-5 pt-7 pb-6 sm:px-8 sm:pt-10 lg:px-12">
                    <h1 id="tasks-heading" className="mb-5 text-3xl font-extrabold tracking-tight wrap-anywhere sm:mb-6 sm:text-4xl">
                        {isImportantView ? '重要' : selectedList?.name ?? 'すべてのタスク'}
                    </h1>
                    <div className="relative mb-5 sm:mb-6">
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 20 20"
                            fill="none"
                            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-marker"
                        >
                            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                            <path d="M13.5 13.5L17.5 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <input
                            type="search"
                            value={searchQuery}
                            placeholder="タスク名を検索"
                            aria-label="タスク名を検索"
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="w-full rounded-xl bg-block py-3 pr-4 pl-[3.125rem] shadow-xs placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-lg"
                        />
                    </div>
                    {loadState === 'loading' && <p role="status">読み込み中…</p>}
                    {loadState === 'error' && (
                        <div role="alert" className="rounded-xl bg-block p-4 shadow-xs">
                            <p>タスクを取得できませんでした。</p>
                            <button type="button" className="mt-2 font-semibold underline" onClick={() => {
                                setLoadState('loading');
                                setLoadAttempt((attempt) => attempt + 1);
                            }}>
                                再試行
                            </button>
                        </div>
                    )}
                    {loadState === 'ready' && visibleTasks.length === 0 && (
                        <p role="status" className="rounded-xl bg-block px-4 py-4 text-muted shadow-xs">
                            {isSearching
                                ? '一致するタスクがありません'
                                : isImportantView
                                    ? '重要なタスクはまだありません。'
                                    : 'タスクはまだありません。'}
                        </p>
                    )}
                    <ul className="space-y-3">
                        {visibleTasks.map((task) => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                lists={taskLists.lists}
                                onUpdated={updateTask}
                            />
                        ))}
                    </ul>
                </section>
                {!isImportantView && !selectedList && (
                    <div className="sticky bottom-0 bg-canvas px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-4 lg:px-12">
                        <div className="relative">
                            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 rounded-full border-2 border-marker" />
                            <input
                                value={name}
                                placeholder="タスクの追加"
                                readOnly={saving}
                                aria-label="タスクの追加"
                                enterKeyHint="done"
                                onKeyDown={handleInputKeyDown}
                                onChange={(event) => {
                                    setName(event.target.value);
                                    setSaveError('');
                                }}
                                className="w-full rounded-xl bg-block py-4 pr-4 pl-[3.125rem] shadow-xs placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-lg"
                            />
                        </div>
                        {saving && <p role="status" className="mt-2 text-sm">登録中…</p>}
                        {saveError && <p role="alert" className="mt-2 text-sm text-[#942e28]">{saveError}</p>}
                    </div>
                )}
            </main>
        </div>
    );
}

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createTask, isBlankTaskName, listTasks, TaskRequestError, updateTaskCompletion } from './api/tasks';
import type { Task } from './api/tasks';

function TaskRow({ task, onUpdated }: { task: Task; onUpdated: (task: Task) => void }) {
    const inFlight = useRef(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');

    async function toggleCompletion() {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setSaveState('saving');
        try {
            const updated = await updateTaskCompletion(task.id, !task.completed);
            onUpdated(updated);
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
                onClick={toggleCompletion}
                className="-my-1 -ml-1 grid size-8 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent aria-disabled:opacity-60"
            >
                <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full border-2 border-marker text-sm leading-none font-bold ${task.completed ? 'bg-selection' : ''}`}>
                    {task.completed && '✓'}
                </span>
            </button>
            <div className="min-w-0">
                <span className={`wrap-anywhere whitespace-pre-wrap ${task.completed ? 'text-muted line-through' : ''}`}>{task.name}</span>
                {saveState === 'saving' && <p role="status" className="mt-1 text-sm">保存中…</p>}
                {saveState === 'error' && <p role="alert" className="mt-1 text-sm text-[#942e28]">状態を変更できませんでした。もう一度お試しください。</p>}
            </div>
        </li>
    );
}

export default function App() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [name, setName] = useState('');
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

    function replaceTask(updated: Task) {
        setTasks((items) => items.map((item) => item.id === updated.id ? updated : item));
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

    return (
        <div className="grid min-h-dvh grid-rows-[auto_1fr] sm:grid-cols-[clamp(11rem,25vw,15rem)_minmax(0,1fr)] sm:grid-rows-[1fr]">
            <aside className="flex items-center justify-between gap-4 bg-sidebar px-4 py-3.5 sm:flex-col sm:items-stretch sm:justify-start sm:gap-8 sm:px-4 sm:py-9">
                <div className="flex items-center gap-2.5 whitespace-nowrap font-bold sm:px-2 sm:text-lg">
                    <span aria-hidden="true" className="relative size-5 shrink-0 rounded-[4px] border-2 border-current after:absolute after:top-[2px] after:left-[5px] after:h-[9px] after:w-[5px] after:rotate-45 after:border-r-2 after:border-b-2" />
                    To Do
                </div>
                <nav aria-label="メイン">
                    <a href="#tasks" aria-current="page" className="block rounded-lg bg-selection px-3.5 py-2 font-semibold text-ink outline-offset-4 focus-visible:outline-2 sm:px-4 sm:py-3">
                        タスク
                    </a>
                </nav>
            </aside>

            <main className="flex min-w-0 flex-col bg-canvas">
                <section id="tasks" aria-labelledby="tasks-heading" className="grow px-5 pt-7 pb-6 sm:px-8 sm:pt-10 lg:px-12">
                    <h1 id="tasks-heading" className="mb-5 text-3xl font-extrabold tracking-tight sm:mb-6 sm:text-4xl">タスク</h1>
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
                    {loadState === 'ready' && tasks.length === 0 && (
                        <p role="status" className="rounded-xl bg-block px-4 py-4 text-muted shadow-xs">
                            タスクはまだありません。
                        </p>
                    )}
                    <ul className="space-y-3">
                        {tasks.map((task) => (
                            <TaskRow key={task.id} task={task} onUpdated={replaceTask} />
                        ))}
                    </ul>
                </section>
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
            </main>
        </div>
    );
}

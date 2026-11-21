import { useEffect, useRef, useState } from 'react';
import { updateTaskCompletion, updateTaskImportance } from './api/tasks';
import type { Task } from './api/tasks';
import { CheckIcon, ListIcon, PanelCloseIcon, StarIcon } from './Icons';
import TaskDeleteAction from './TaskDeleteAction';
import TaskNameEditor from './TaskNameEditor';

type TaskUpdate = Partial<Omit<Task, 'id'>>;
type TaskStatusField = 'completed' | 'important';

function formatCreatedAt(createdAt: string): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const now = new Date();
    const isToday =
        date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
    if (isToday) {
        return '作成: 今日';
    }
    return `作成: ${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export default function TaskDetailPanel({
    task,
    listName,
    onUpdated,
    onDeleted,
    onClose,
}: {
    task: Task;
    listName?: string;
    onUpdated: (id: string, update: TaskUpdate) => void;
    onDeleted: (id: string) => void;
    onClose: () => void;
}) {
    const inFlight = useRef(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    useEffect(() => {
        setConfirmingDelete(false);
        setSaveState('idle');
    }, [task.id]);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

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
        <aside
            aria-label="タスクの詳細"
            className="fixed inset-y-12 right-0 z-30 flex w-full max-w-[360px] flex-col border-l border-border bg-canvas shadow-lg lg:static lg:inset-auto lg:z-auto lg:w-[360px] lg:shrink-0 lg:shadow-none"
        >
            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                <div className="rounded-md border border-border bg-block p-3.5 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.06)]">
                    <div className="flex items-start gap-2.5">
                        <button
                            type="button"
                            aria-label={`${task.name} の完了`}
                            aria-pressed={task.completed}
                            aria-disabled={saveState === 'saving'}
                            onClick={() => void toggleStatus('completed')}
                            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent aria-disabled:opacity-60"
                        >
                            <span
                                aria-hidden="true"
                                className={`grid size-[18px] place-items-center rounded-full border transition-colors ${task.completed ? 'border-accent bg-accent text-accent-fg' : 'border-accent text-transparent hover:text-accent/60'}`}
                            >
                                <CheckIcon className="size-3" />
                            </span>
                        </button>
                        <TaskNameEditor key={task.id} task={task} onSaved={(name) => onUpdated(task.id, { name })} />
                        <button
                            type="button"
                            aria-label={`${task.name} の重要`}
                            aria-pressed={task.important}
                            aria-disabled={saveState === 'saving'}
                            onClick={() => void toggleStatus('important')}
                            className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent aria-disabled:opacity-60 ${task.important ? 'text-accent' : 'text-marker hover:text-accent'}`}
                        >
                            <StarIcon filled={task.important} className="size-[18px]" />
                        </button>
                    </div>
                    {saveState === 'saving' && <p role="status" className="mt-2 pl-8 text-xs text-muted">保存中…</p>}
                    {saveState === 'error' && (
                        <p role="alert" className="mt-2 pl-8 text-xs text-danger">
                            状態を変更できませんでした。もう一度お試しください。
                        </p>
                    )}
                </div>

                <div className="rounded-md border border-border bg-block px-3.5 py-3 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-3 text-sm">
                        <ListIcon className="size-[18px] shrink-0 text-muted" />
                        <span className="shrink-0 text-muted">リスト</span>
                        <span className="min-w-0 flex-1 truncate text-right font-medium text-ink">
                            {listName ?? 'リストなし'}
                        </span>
                    </div>
                    <p className="mt-1.5 pl-7 text-xs text-muted">
                        タスクを左のリストへドラッグ＆ドロップして追加・移動できます。
                    </p>
                </div>
            </div>

            <footer className="border-t border-border bg-canvas px-4 py-3">
                {confirmingDelete ? (
                    <TaskDeleteAction
                        key={task.id}
                        task={task}
                        confirming={confirmingDelete}
                        onConfirmingChange={setConfirmingDelete}
                        onDeleted={onDeleted}
                    />
                ) : (
                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            aria-label="詳細を閉じる"
                            title="詳細を閉じる"
                            onClick={onClose}
                            className="grid size-8 place-items-center rounded text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                        >
                            <PanelCloseIcon className="size-[18px]" />
                        </button>
                        <span className="text-xs text-muted">{formatCreatedAt(task.createdAt)}</span>
                        <TaskDeleteAction
                            key={task.id}
                            task={task}
                            confirming={confirmingDelete}
                            onConfirmingChange={setConfirmingDelete}
                            onDeleted={onDeleted}
                        />
                    </div>
                )}
            </footer>
        </aside>
    );
}

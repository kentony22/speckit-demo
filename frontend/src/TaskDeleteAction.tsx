import { useRef, useState } from 'react';
import { deleteTask } from './api/tasks';
import type { Task } from './api/tasks';
import { TrashIcon } from './Icons';

export default function TaskDeleteAction({
    task,
    confirming,
    onConfirmingChange,
    onDeleted,
}: {
    task: Task;
    confirming: boolean;
    onConfirmingChange: (next: boolean) => void;
    onDeleted: (id: string) => void;
}) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(false);
    const inFlight = useRef(false);

    function cancel() {
        if (deleting) {
            return;
        }
        onConfirmingChange(false);
        setError(false);
    }

    async function confirmDelete() {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setDeleting(true);
        setError(false);
        try {
            await deleteTask(task.id);
            onDeleted(task.id);
        } catch {
            setError(true);
        } finally {
            inFlight.current = false;
            setDeleting(false);
        }
    }

    if (!confirming) {
        return (
            <button
                type="button"
                aria-label={`${task.name} の削除`}
                title="タスクを削除"
                onClick={() => {
                    onConfirmingChange(true);
                    setError(false);
                }}
                className="grid size-8 place-items-center rounded text-muted transition-colors hover:bg-hover hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
            >
                <TrashIcon className="size-[18px]" />
            </button>
        );
    }

    return (
        <div className="w-full space-y-2 rounded-md border border-danger/30 bg-block p-3 text-xs shadow-xs">
            <p className="font-semibold text-ink">このタスクを削除しますか？</p>
            {error && (
                <p role="alert" className="text-danger">
                    タスクを削除できませんでした。もう一度お試しください。
                </p>
            )}
            <div className="flex flex-wrap gap-2 font-semibold">
                <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void confirmDelete()}
                    className="rounded bg-danger px-3 py-1.5 text-danger-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                >
                    {deleting ? '削除中…' : '削除する'}
                </button>
                <button
                    type="button"
                    disabled={deleting}
                    onClick={cancel}
                    className="rounded border border-border bg-block px-3 py-1.5 text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                >
                    キャンセル
                </button>
            </div>
        </div>
    );
}

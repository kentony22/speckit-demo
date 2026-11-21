import { useRef, useState } from 'react';
import { deleteTask } from './api/tasks';
import type { Task } from './api/tasks';

export default function TaskDeleteAction({ task, onDeleted }: { task: Task; onDeleted: (id: string) => void }) {
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(false);
    const inFlight = useRef(false);

    function cancel() {
        if (deleting) {
            return;
        }
        setConfirming(false);
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
                className="ml-3 rounded text-sm font-semibold text-[#942e28] underline outline-offset-2 focus-visible:outline-2"
                onClick={() => {
                    setConfirming(true);
                    setError(false);
                }}
            >
                削除
            </button>
        );
    }

    return (
        <div className="mt-2 space-y-2 rounded-lg border border-marker/40 p-2.5 text-sm">
            <p className="font-semibold">このタスクを削除しますか？</p>
            {error && (
                <p role="alert" className="text-[#942e28]">
                    タスクを削除できませんでした。もう一度お試しください。
                </p>
            )}
            <div className="flex flex-wrap gap-2 font-semibold">
                <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void confirmDelete()}
                    className="rounded-lg bg-[#942e28] px-3 py-1.5 text-white focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                >
                    {deleting ? '削除中…' : '削除する'}
                </button>
                <button
                    type="button"
                    disabled={deleting}
                    onClick={cancel}
                    className="rounded-lg px-3 py-1.5 text-accent focus-visible:outline-2 disabled:opacity-60"
                >
                    キャンセル
                </button>
            </div>
        </div>
    );
}

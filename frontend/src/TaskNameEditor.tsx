import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { isBlankTaskName, updateTaskName } from './api/tasks';
import type { Task } from './api/tasks';

export default function TaskNameEditor({ task, onSaved }: { task: Task; onSaved: (name: string) => void }) {
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState<'blank' | 'save' | null>(null);
    const [saving, setSaving] = useState(false);
    const inFlight = useRef(false);
    const inputId = useId();
    const errorId = useId();

    function closeEditor() {
        setDraft(null);
        setError(null);
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (draft === null || inFlight.current) {
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
            const updated = await updateTaskName(task.id, draft);
            onSaved(updated.name);
            closeEditor();
        } catch {
            setError('save');
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    }

    if (draft === null) {
        return (
            <button
                type="button"
                aria-label={`${task.name} の編集`}
                className="ml-3 rounded text-sm font-semibold text-accent underline outline-offset-2 focus-visible:outline-2"
                onClick={() => setDraft(task.name)}
            >
                編集
            </button>
        );
    }
    return (
        <form onSubmit={save} className="mt-2 space-y-2">
            <label htmlFor={inputId} className="block text-sm font-semibold">タスク名</label>
            <input
                autoFocus
                id={inputId}
                value={draft}
                readOnly={saving}
                aria-invalid={error === 'blank'}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                    setDraft(event.target.value);
                    setError(null);
                }}
                className="w-full rounded-lg border border-marker px-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
            />
            {error && <p id={errorId} role="alert" className="text-sm text-[#942e28]">
                {error === 'blank' ? '空白以外の文字を入力してください。' : 'タスク名を保存できませんでした。もう一度お試しください。'}
            </p>}
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
                <button type="submit" disabled={saving} className="rounded-lg bg-selection px-3 py-2 focus-visible:outline-2 disabled:opacity-60">
                    {saving ? '保存中…' : '保存'}
                </button>
                <button type="button" disabled={saving} onClick={closeEditor} className="rounded-lg px-3 py-2 text-accent focus-visible:outline-2 disabled:opacity-60">
                    キャンセル
                </button>
            </div>
        </form>
    );
}

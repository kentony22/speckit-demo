import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { isBlankTaskName, updateTaskName } from './api/tasks';
import type { Task } from './api/tasks';

export default function TaskNameEditor({ task, onSaved }: { task: Task; onSaved: (name: string) => void }) {
    const [draft, setDraft] = useState(task.name);
    const [error, setError] = useState<'blank' | 'save' | null>(null);
    const [saving, setSaving] = useState(false);
    const inFlight = useRef(false);
    const skipBlurCommit = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = useId();
    const errorId = useId();

    useEffect(() => {
        setDraft(task.name);
        setError(null);
    }, [task.id, task.name]);

    async function commit() {
        if (inFlight.current) {
            return;
        }
        if (isBlankTaskName(draft)) {
            setError('blank');
            return;
        }
        if (draft === task.name) {
            setError(null);
            return;
        }
        inFlight.current = true;
        setSaving(true);
        setError(null);
        try {
            const updated = await updateTaskName(task.id, draft);
            onSaved(updated.name);
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
            event.stopPropagation();
            if (saving) {
                return;
            }
            skipBlurCommit.current = true;
            setDraft(task.name);
            setError(null);
            inputRef.current?.blur();
            return;
        }
        if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
            event.preventDefault();
            skipBlurCommit.current = true;
            void commit().then(() => {
                inputRef.current?.blur();
            });
        }
    }

    return (
        <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">タスク名</label>
            <input
                ref={inputRef}
                id={inputId}
                value={draft}
                readOnly={saving}
                aria-label={`${task.name} の編集`}
                aria-invalid={error === 'blank'}
                aria-describedby={error ? errorId : undefined}
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
                className={`w-full rounded border border-transparent px-1.5 py-0.5 text-base font-semibold transition-colors hover:border-border focus:border-accent focus:bg-canvas focus:outline-none ${task.completed ? 'text-muted line-through' : 'text-ink'}`}
            />
            {saving && <p role="status" className="mt-1 px-1.5 text-xs text-muted">保存中…</p>}
            {error && (
                <p id={errorId} role="alert" className="mt-1 px-1.5 text-xs text-danger">
                    {error === 'blank' ? '空白以外の文字を入力してください。' : 'タスク名を保存できませんでした。もう一度お試しください。'}
                </p>
            )}
        </div>
    );
}

export type Task = {
    id: string;
    name: string;
    createdAt: string;
};

export function isBlankTaskName(name: string): boolean {
    return /^\p{White_Space}*$/u.test(name);
}

export class TaskRequestError extends Error {
    constructor(readonly code: string) {
        super(code);
    }
}

async function request<T>(options?: RequestInit): Promise<T> {
    const response = await fetch('/api/tasks', options);
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new TaskRequestError(body?.code ?? 'TASK_REQUEST_FAILED');
    }
    return response.json() as Promise<T>;
}

export function listTasks(signal: AbortSignal): Promise<Task[]> {
    return request<Task[]>({ signal, cache: 'no-store' });
}

export function createTask(name: string): Promise<Task> {
    return request<Task>({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
}

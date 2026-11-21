export type Task = {
    id: string;
    name: string;
    createdAt: string;
    completed: boolean;
    important: boolean;
};

export function isBlankTaskName(name: string): boolean {
    return /^\p{White_Space}*$/u.test(name);
}

export class TaskRequestError extends Error {
    constructor(readonly code: string) {
        super(code);
    }
}

const tasksPath = '/api/tasks';

async function request<T>(path: string, options: RequestInit): Promise<T> {
    const response = await fetch(path, options);
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new TaskRequestError(body?.code ?? 'TASK_REQUEST_FAILED');
    }
    return response.json() as Promise<T>;
}

export function listTasks(signal: AbortSignal): Promise<Task[]> {
    return request<Task[]>(tasksPath, { signal, cache: 'no-store' });
}

export function createTask(name: string): Promise<Task> {
    return request<Task>(tasksPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
}

export function updateTaskCompletion(id: string, completed: boolean): Promise<Task> {
    return request<Task>(`${tasksPath}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
    });
}

export function updateTaskName(id: string, name: string): Promise<Task> {
    return request<Task>(`${tasksPath}/${encodeURIComponent(id)}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
}

export function updateTaskImportance(id: string, important: boolean): Promise<Task> {
    return request<Task>(`${tasksPath}/${encodeURIComponent(id)}/importance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ important }),
    });
}

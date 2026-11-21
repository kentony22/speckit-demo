export type Task = {
    id: string;
    name: string;
    createdAt: string;
    completed: boolean;
    important: boolean;
    listId?: string | null;
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

export type TaskList = {
    id: string;
    name: string;
    groupId?: string | null;
};

export type ListGroup = {
    id: string;
    name: string;
};

const taskListsPath = '/api/task-lists';
const listGroupsPath = '/api/list-groups';

export function listTaskLists(signal: AbortSignal): Promise<TaskList[]> {
    return request<TaskList[]>(taskListsPath, { signal, cache: 'no-store' });
}

export function createTaskList(name: string): Promise<TaskList> {
    return request<TaskList>(taskListsPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
}

export function listListGroups(signal: AbortSignal): Promise<ListGroup[]> {
    return request<ListGroup[]>(listGroupsPath, { signal, cache: 'no-store' });
}

export function createListGroup(name: string): Promise<ListGroup> {
    return request<ListGroup>(listGroupsPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
}

export function updateListGroupName(groupId: string, name: string): Promise<ListGroup> {
    return request<ListGroup>(`${listGroupsPath}/${encodeURIComponent(groupId)}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
}

export function updateTaskListGroup(listId: string, groupId: string | null): Promise<TaskList> {
    return request<TaskList>(`${taskListsPath}/${encodeURIComponent(listId)}/group`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
    });
}

export function updateTaskList(id: string, listId: string | null): Promise<Task> {
    return request<Task>(`${tasksPath}/${encodeURIComponent(id)}/list`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId }),
    });
}

export async function deleteTask(id: string): Promise<void> {
    const response = await fetch(`${tasksPath}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new TaskRequestError(body?.code ?? 'TASK_REQUEST_FAILED');
    }
}

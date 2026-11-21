import type { Task, TaskList } from './api/tasks';

export const TASK_DRAG_MIME = 'application/x-todo-task-id';
export const LIST_DRAG_MIME = 'application/x-todo-list-id';

export function shouldMoveTaskToList(
    task: Pick<Task, 'listId'> | undefined,
    targetListId: string | null,
): boolean {
    if (!task) {
        return false;
    }
    return (task.listId ?? null) !== targetListId;
}

export function shouldMoveListToGroup(
    list: Pick<TaskList, 'groupId'> | undefined,
    targetGroupId: string | null,
): boolean {
    if (!list) {
        return false;
    }
    return (list.groupId ?? null) !== targetGroupId;
}

export function removeDeletedTaskList<T extends { id: string }>(lists: readonly T[], deletedListId: string): T[] {
    return lists.filter((list) => list.id !== deletedListId);
}

export function clearDeletedListFromTasks<T extends { listId?: string | null }>(
    tasks: readonly T[],
    deletedListId: string,
): T[] {
    return tasks.map((task) => task.listId === deletedListId ? { ...task, listId: null } : task);
}

export function resolveHashAfterListDelete(currentHash: string, deletedListId: string): string {
    return currentHash === deletedListId ? 'tasks' : currentHash;
}

export type SearchableTask = {
    readonly name: string;
};

export type TaskSearchResult<T extends SearchableTask> = {
    readonly normalizedQuery: string;
    readonly isSearching: boolean;
    readonly tasks: readonly T[];
};

const edgeWhitespace = /^\p{White_Space}+|\p{White_Space}+$/gu;

export function normalizeSearchQuery(query: string): string {
    return query.replace(edgeWhitespace, '').toLowerCase();
}

export function matchesTaskName(task: SearchableTask, normalizedQuery: string): boolean {
    if (normalizedQuery === '') {
        return true;
    }
    return task.name.toLowerCase().includes(normalizedQuery);
}

export function resolveVisibleTasks<T extends SearchableTask>(
    allTasks: readonly T[],
    viewTasks: readonly T[],
    query: string,
): TaskSearchResult<T> {
    const normalizedQuery = normalizeSearchQuery(query);
    if (normalizedQuery === '') {
        return {
            normalizedQuery,
            isSearching: false,
            tasks: viewTasks,
        };
    }

    return {
        normalizedQuery,
        isSearching: true,
        tasks: allTasks.filter((task) => matchesTaskName(task, normalizedQuery)),
    };
}

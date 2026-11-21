export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'todo-theme';

export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
    if (stored === 'light' || stored === 'dark') {
        return stored;
    }
    return prefersDark ? 'dark' : 'light';
}

export function toggleTheme(current: Theme): Theme {
    return current === 'dark' ? 'light' : 'dark';
}

export function loadInitialTheme(): Theme {
    if (typeof window === 'undefined') {
        return 'light';
    }
    let stored: string | null = null;
    try {
        stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
        stored = null;
    }
    const prefersDark = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return resolveInitialTheme(stored, prefersDark);
}

export function applyTheme(theme: Theme, persist = false): void {
    if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = theme;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'dark' ? '#0b3962' : '#0f4c81');
        }
    }
    if (persist && typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // Ignore storage errors in private browsing modes.
        }
    }
}

export function MenuIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className}>
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
    );
}

export function SearchIcon({ className = 'size-4' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
            <circle cx="8.75" cy="8.75" r="5.75" />
            <path d="M13.2 13.2L17 17" />
        </svg>
    );
}

export function CloseIcon({ className = 'size-4' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
            <path d="M5 5l10 10M15 5L5 15" />
        </svg>
    );
}

export function HomeIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M3 9.5L10 3.5l7 6" />
            <path d="M5 8.5v7.5a1 1 0 001 1h8a1 1 0 001-1V8.5" />
        </svg>
    );
}

export function StarIcon({ filled = false, className = 'size-5' }: { filled?: boolean; className?: string }) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M10 2.75l2.24 4.54 5.01.73-3.62 3.53.85 4.99L10 14.18l-4.48 2.36.85-4.99-3.62-3.53 5.01-.73L10 2.75z" />
        </svg>
    );
}

export function ListIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
            <path d="M7 5.5h10M7 10h10M7 14.5h10" />
            <circle cx="3.5" cy="5.5" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="3.5" cy="10" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="3.5" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function PlusIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={className}>
            <path d="M10 4v12M4 10h12" />
        </svg>
    );
}

export function CheckIcon({ className = 'size-3.5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M3.5 8.5l3 3 6-6.5" />
        </svg>
    );
}

export function TrashIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M3.5 5.5h13" />
            <path d="M7.5 5.5V4a1 1 0 011-1h3a1 1 0 011 1v1.5" />
            <path d="M5.5 5.5l.8 10.5a1.2 1.2 0 001.2 1h5a1.2 1.2 0 001.2-1l.8-10.5" />
            <path d="M8.5 9v5M11.5 9v5" />
        </svg>
    );
}

export function ChevronIcon({ open = false, className = 'size-4' }: { open?: boolean; className?: string }) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${className} transition-transform ${open ? 'rotate-90' : ''}`}
        >
            <path d="M7.5 5.5L12.5 10l-5 4.5" />
        </svg>
    );
}

export function PanelCloseIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="2.5" y="3.5" width="15" height="13" rx="1.8" />
            <path d="M12.5 3.5v13" />
            <path d="M6.5 10h4m0 0L8.8 8.3M10.5 10l-1.7 1.7" />
        </svg>
    );
}

export function FolderIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M2.5 5.5a1.5 1.5 0 011.5-1.5h3.6l1.7 2H16a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5v-9z" />
        </svg>
    );
}

export function FolderPlusIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M2.5 5.5a1.5 1.5 0 011.5-1.5h3.6l1.7 2H16a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5v-9z" />
            <path d="M10 8.5v4M8 10.5h4" />
        </svg>
    );
}

export function PencilIcon({ className = 'size-4' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M13.8 3.7a1.8 1.8 0 012.5 2.5L7.1 15.4l-3.6 1 1-3.6 9.3-9.1z" />
        </svg>
    );
}

export function SettingsIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="10" cy="10" r="2.75" />
            <path d="M16.2 12.1a1.2 1.2 0 00.24 1.32l.04.04a1.45 1.45 0 01-2.05 2.05l-.04-.04a1.2 1.2 0 00-1.32-.24 1.2 1.2 0 00-.73 1.1v.12a1.45 1.45 0 01-2.9 0v-.06a1.2 1.2 0 00-.78-1.1 1.2 1.2 0 00-1.32.24l-.04.04a1.45 1.45 0 01-2.05-2.05l.04-.04a1.2 1.2 0 00.24-1.32 1.2 1.2 0 00-1.1-.73h-.12a1.45 1.45 0 010-2.9h.06a1.2 1.2 0 001.1-.78 1.2 1.2 0 00-.24-1.32l-.04-.04a1.45 1.45 0 012.05-2.05l.04.04a1.2 1.2 0 001.32.24h.06a1.2 1.2 0 00.73-1.1v-.12a1.45 1.45 0 012.9 0v.06a1.2 1.2 0 00.73 1.1 1.2 1.2 0 001.32-.24l.04-.04a1.45 1.45 0 012.05 2.05l-.04.04a1.2 1.2 0 00-.24 1.32v.06a1.2 1.2 0 001.1.73h.12a1.45 1.45 0 010 2.9h-.06a1.2 1.2 0 00-1.1.73z" />
        </svg>
    );
}

export function MoonIcon({ className = 'size-5' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M15.8 12.2A6.2 6.2 0 017.8 4.2a6.5 6.5 0 108 8z" />
        </svg>
    );
}

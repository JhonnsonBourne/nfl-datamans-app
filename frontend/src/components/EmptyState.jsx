/**
 * Empty State Component
 * Provides helpful empty states with actionable CTAs
 */

export function EmptyState({ 
    icon = '📊', 
    title = 'No data available', 
    message = 'Try adjusting your filters or selecting a different season.',
    actionLabel,
    onAction,
    children 
}) {
    return (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">{icon}</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">{message}</p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="btn-primary"
                >
                    {actionLabel}
                </button>
            )}
            {children}
        </div>
    );
}

export function NoResultsState({ filters, onReset }) {
    return (
        <EmptyState
            icon="🔍"
            title="No players found"
            message={`No players match your current filters. Try adjusting the ${filters || 'season, position, or minimum threshold'} to see more results.`}
            actionLabel="Reset Filters"
            onAction={onReset}
        />
    );
}

export function ErrorState({ error, onRetry }) {
    return (
        <EmptyState
            icon="⚠️"
            title="Something went wrong"
            message={error || "We encountered an error loading the data. Please try again."}
            actionLabel="Retry"
            onAction={onRetry}
        />
    );
}







/**
 * Loading Skeleton Component
 * Provides skeleton screens for better loading UX
 */

export function TableSkeleton({ rows = 10, cols = 8 }) {
    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
                {/* Header */}
                <div className="h-12 bg-gray-200 rounded mb-4"></div>
                
                {/* Table */}
                <div className="space-y-3">
                    {Array.from({ length: rows }).map((_, i) => (
                        <div key={i} className="flex space-x-4">
                            {Array.from({ length: cols }).map((_, j) => (
                                <div
                                    key={j}
                                    className={`h-10 bg-gray-200 rounded ${j === 0 ? 'flex-1' : 'w-24'}`}
                                ></div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function CardSkeleton() {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
    );
}

export function FilterSkeleton() {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i}>
                        <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                        <div className="h-10 bg-gray-200 rounded"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function Spinner({ size = 'md' }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16'
    };

    return (
        <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-primary-600 border-t-transparent`}></div>
    );
}







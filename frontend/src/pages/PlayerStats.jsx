import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import PerformanceProfiler, { trackCall, getOrCreateProfiler } from '../utils/performanceProfiler';
import { Link } from 'react-router-dom';
import { getPlayerStats, reportError } from '../services/api';
import { TableSkeleton, FilterSkeleton, Spinner } from '../components/LoadingSkeleton';
import { NoResultsState, ErrorState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

// Maximum rows to render at once to prevent UI freeze
const MAX_VISIBLE_ROWS = 200;

// Performance logging utility
const perfLog = (label, fn) => {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    if (duration > 10) { // Only log slow operations (>10ms)
        console.log(`⏱️ [PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
    return result;
};

// Debug logging utility
const debugLog = (label, data) => {
    console.log(`🔍 [DEBUG] ${label}:`, data);
};

function PlayerStats() {
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState(2025);
    const [selectedPosition, setSelectedPosition] = useState('ALL');
    const [minThreshold, setMinThreshold] = useState(0);
    const [includeNgs, setIncludeNgs] = useState(false);
    const [showColumnControls, setShowColumnControls] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState(new Set());
    const [showDebug, setShowDebug] = useState(false);
    const [tableDimensions, setTableDimensions] = useState({ tableWidth: 0, containerWidth: 0 });
    const [visibleRowCount, setVisibleRowCount] = useState(MAX_VISIBLE_ROWS);
    const tableContainerRef = useRef(null);
    const { showToast, ToastContainer } = useToast();
    
    // Track render count for debugging
    const renderCountRef = useRef(0);
    const lastRenderTimeRef = useRef(Date.now());
    
    // Debug log storage (accessible via window object for debugging)
    const debugLogsRef = useRef([]);
    const cellValueCacheRef = useRef(new Map()); // Declare early for debug API
    
    // Performance profiler for analyzing hangs - use global helper
    const profilerRef = useRef(null);
    
    // Get or create profiler - this ensures it's always available globally
    if (typeof window !== 'undefined') {
        profilerRef.current = getOrCreateProfiler('PlayerStats');
    }
    
    useEffect(() => {
        // Ensure profiler stays active
        if (profilerRef.current && !profilerRef.current.isProfiling) {
            profilerRef.current.start();
        }
        return () => {
            // Don't stop profiler on unmount - keep it for debugging
        };
    }, []);
    
    // Expose debug API to window immediately (before component fully mounts)
    if (typeof window !== 'undefined' && !window.__playerStatsDebug) {
        window.__playerStatsDebug = {
            getLogs: () => debugLogsRef.current,
            clearLogs: () => { debugLogsRef.current = []; },
            getState: () => ({
                allDataLength: allData.length,
                filteredDataLength: filteredData.length,
                selectedPosition,
                minThreshold,
                visibleRowCount,
                renderCount: renderCountRef.current,
                cacheSize: cellValueCacheRef.current.size
            }),
            addLog: (level, message, data = {}) => {
                const entry = {
                    timestamp: Date.now(),
                    level,
                    message,
                    data,
                    renderCount: renderCountRef.current
                };
                debugLogsRef.current.push(entry);
                if (debugLogsRef.current.length > 100) {
                    debugLogsRef.current.shift();
                }
                console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${level.toUpperCase()}] ${message}`, data);
            },
            // Performance profiler methods - use direct access to ensure it works
            getProfilerSummary: () => {
                const profiler = profilerRef.current || window.__performanceProfiler?.PlayerStats;
                return profiler?.getSummary() || null;
            },
            getProfilerReport: () => {
                const profiler = profilerRef.current || window.__performanceProfiler?.PlayerStats;
                return profiler?.getDetailedReport() || null;
            },
            exportProfilerData: () => {
                const profiler = profilerRef.current || window.__performanceProfiler?.PlayerStats;
                if (profiler) {
                    return profiler.exportData();
                } else {
                    console.error('Profiler not available. Make sure the component has mounted.');
                    return null;
                }
            },
            clearProfilerData: () => {
                const profiler = profilerRef.current || window.__performanceProfiler?.PlayerStats;
                return profiler?.clear() || null;
            },
        };
        console.log('🚀 [PLAYER_STATS] Debug API initialized at window.__playerStatsDebug');
        console.log('📊 [PROFILER] Performance profiler available:');
        console.log('   - window.__playerStatsDebug.getProfilerSummary()');
        console.log('   - window.__playerStatsDebug.getProfilerReport()');
        console.log('   - window.__playerStatsDebug.exportProfilerData()');
        console.log('   - window.__performanceProfiler.PlayerStats (direct access)');
    }
    
    const profiler = profilerRef.current;
    
    // Update debug API state on each render
    useEffect(() => {
        if (window.__playerStatsDebug) {
            window.__playerStatsDebug.getState = () => ({
                allDataLength: allData.length,
                filteredDataLength: filteredData.length,
                selectedPosition,
                minThreshold,
                visibleRowCount,
                renderCount: renderCountRef.current,
                cacheSize: cellValueCacheRef.current.size
            });
            // Ensure profiler is accessible
            if (profilerRef.current && !window.__performanceProfiler?.PlayerStats) {
                if (!window.__performanceProfiler) {
                    window.__performanceProfiler = {};
                }
                window.__performanceProfiler.PlayerStats = profilerRef.current;
            }
        }
    });
    
    // Track renders and detect rapid re-renders
    useEffect(() => {
        // Get profiler instance (may not be available on first render)
        const currentProfiler = profilerRef.current || window.__performanceProfiler?.PlayerStats;
        
        if (currentProfiler) {
            currentProfiler.markRenderStart();
        }
        
        renderCountRef.current += 1;
        const now = Date.now();
        const timeSinceLastRender = now - lastRenderTimeRef.current;
        lastRenderTimeRef.current = now;
        
        // Track render with profiler
        if (currentProfiler) {
            currentProfiler.trackRender(renderCountRef.current, {
                selectedPosition,
                selectedSeason,
                minThreshold,
                visibleRowCount,
                allDataLength: allData.length,
                filteredDataLength: filteredData.length,
                sortedDataLength: sortedData?.length || 0,
                columnsCount: columns.length,
                cacheSize: cellValueCacheRef.current.size,
            });
        }
        
        if (timeSinceLastRender < 50 && renderCountRef.current > 5) {
            console.warn(`⚠️ [RENDER] Rapid re-renders detected! Render #${renderCountRef.current} (${timeSinceLastRender}ms since last)`);
        }
    });

    // Default sort to fantasy_points_ppr for 'ALL', will be updated by useEffect when position changes
    const [sortConfig, setSortConfig] = useState({ key: 'fantasy_points_ppr', direction: 'desc' });
    
    // Log render (throttled to avoid spam)
    // FIXED: Added proper dependencies to avoid referencing undefined variables
    useEffect(() => {
        const timeSinceLastRender = Date.now() - lastRenderTimeRef.current;
        // Always log first few renders to confirm logging is working
        if (renderCountRef.current <= 3 || renderCountRef.current % 5 === 0 || timeSinceLastRender > 100) {
            console.log(`🔄 [RENDER] Render #${renderCountRef.current}`, {
                allDataLength: allData.length,
                filteredDataLength: filteredData.length,
                selectedPosition,
                minThreshold,
                visibleRowCount,
                timeSinceLastRender: `${timeSinceLastRender}ms`,
                totalRenderCellValueCalls: renderCellValueCallCount.current
            });
            
            // Reset counter periodically to avoid overflow
            if (renderCellValueCallCount.current > 10000) {
                console.log(`  🔄 Resetting renderCellValue call counter`);
                renderCellValueCallCount.current = 0;
            }
        }
    }, [allData.length, filteredData.length, selectedPosition, minThreshold, visibleRowCount]);

    // Helper functions defined before useMemo hooks to avoid ReferenceError
    const getThresholdMetric = (position) => {
        switch (position) {
            case 'QB': return { key: 'attempts', label: 'Pass Attempts' };
            case 'RB': return { key: 'carries', label: 'Carries' };
            case 'WR':
            case 'TE': return { key: 'routes', label: 'Routes' };
            default: return { key: 'fantasy_points_ppr', label: 'Fantasy Points' };
        }
    };

    // Check if NextGen Stats columns are available in the data
    // OPTIMIZED: Only check first 10 players to avoid expensive iteration
    const hasNextGenStats = useMemo(() => {
        if (allData.length === 0) return false;
        // Check first few players only (much faster than checking all 1800+)
        const sampleSize = Math.min(10, allData.length);
        return allData.slice(0, sampleSize).some(player => 
            Object.keys(player).some(key => key.startsWith('ngs_'))
        );
    }, [allData.length]); // Only depend on length, not the entire array

    const getColumnsForPosition = (position) => {
        const base = [
            { k: 'player', l: 'Player', a: 'left' },
            { k: 'team', l: 'Team', a: 'left' },
            { k: 'position', l: 'Pos', a: 'center' },
            { k: 'games', l: 'G', a: 'right' },
            { k: 'fantasy', l: 'Fant', a: 'right', h: true },
            { k: 'fantasy_points_pg', l: 'FP/G', a: 'right' }
        ];

        if (position === 'QB') {
            return [
                ...base,
                // Passing Totals
                { k: 'completions', l: 'Cmp', a: 'right' },
                { k: 'attempts', l: 'Att', a: 'right' },
                { k: 'passing_yards', l: 'Yds', a: 'right' },
                { k: 'passing_tds', l: 'TD', a: 'right', h: true },
                { k: 'interceptions', l: 'INT', a: 'right' },
                // Passing Efficiency/Rates
                { k: 'completion_percentage', l: 'Cmp%', a: 'right' },
                { k: 'passing_cpoe', l: 'CPOE', a: 'right' },
                { k: 'td_percentage', l: 'TD%', a: 'right' },
                { k: 'int_percentage', l: 'INT%', a: 'right' },
                { k: 'yards_per_attempt', l: 'Y/A', a: 'right' },
                { k: 'air_yards_per_attempt', l: 'AY/A', a: 'right' },
                // Passing Advanced
                { k: 'passing_epa', l: 'EPA', a: 'right' },
                { k: 'epa_per_dropback', l: 'EPA/DB', a: 'right', h: true },
                { k: 'fantasy_points_per_dropback', l: 'FP/DB', a: 'right' },
                { k: 'passing_air_yards', l: 'Air Yds', a: 'right' },
                { k: 'passing_first_downs', l: '1D', a: 'right' },
                // Sacks
                { k: 'sacks', l: 'Sk', a: 'right' },
                { k: 'sack_percentage', l: 'Sk%', a: 'right' },
                // Rushing
                { k: 'rushing_yards', l: 'Rush Yds', a: 'right' },
                { k: 'rushing_tds', l: 'Rush TD', a: 'right' },
                // Per Game
                { k: 'passing_yards_pg', l: 'Yds/G', a: 'right' },
                { k: 'passing_tds_pg', l: 'TD/G', a: 'right' }
            ];
        }

        if (position === 'RB') {
            return [
                ...base,
                // Rushing Totals
                { k: 'carries', l: 'Att', a: 'right' },
                { k: 'rushing_yards', l: 'Rush Yds', a: 'right' },
                { k: 'rushing_tds', l: 'Rush TD', a: 'right', h: true },
                { k: 'rushing_first_downs', l: '1D', a: 'right' },
                { k: 'rushing_fumbles', l: 'Fmb', a: 'right' },
                // Rushing Efficiency
                { k: 'yards_per_carry', l: 'Y/A', a: 'right' },
                { k: 'rushing_epa', l: 'EPA', a: 'right' },
                // Receiving
                { k: 'targets', l: 'Tgt', a: 'right' },
                { k: 'receptions', l: 'Rec', a: 'right' },
                { k: 'receiving_yards', l: 'Rec Yds', a: 'right' },
                { k: 'receiving_tds', l: 'Rec TD', a: 'right' },
                { k: 'yards_per_reception', l: 'Y/R', a: 'right' },
                // Advanced Receiving
                { k: 'target_share', l: 'Tgt Share', a: 'right' },
                { k: 'wopr', l: 'WOPR', a: 'right' },
                // Per Game
                { k: 'rushing_yards_pg', l: 'Rush/G', a: 'right' },
                { k: 'receiving_yards_pg', l: 'Rec/G', a: 'right' },
            ];
        }

        if (position === 'WR' || position === 'TE') {
            return [
                ...base,
                // Receiving Totals
                { k: 'targets', l: 'Tgt', a: 'right' },
                { k: 'receptions', l: 'Rec', a: 'right' },
                { k: 'receiving_yards', l: 'Yds', a: 'right' },
                { k: 'receiving_tds', l: 'TD', a: 'right', h: true },
                { k: 'receiving_first_downs', l: '1D', a: 'right' },
                { k: 'receiving_fumbles', l: 'Fmb', a: 'right' },
                // Routes & Route-Based Metrics
                { k: 'routes', l: 'Routes', a: 'right', h: true },
                { k: 'yprr', l: 'YPRR', a: 'right', h: true },
                { k: 'tprr', l: 'TPRR', a: 'right' },
                // Receiving Efficiency
                { k: 'catch_percentage', l: 'Catch%', a: 'right' },
                { k: 'yards_per_reception', l: 'Y/R', a: 'right' },
                { k: 'yards_per_target', l: 'Y/Tgt', a: 'right' },
                // Advanced Receiving
                { k: 'receiving_air_yards', l: 'Air Yds', a: 'right' },
                { k: 'adot', l: 'ADOT', a: 'right' },
                { k: 'receiving_yards_after_catch', l: 'YAC', a: 'right' },
                { k: 'receiving_epa', l: 'EPA', a: 'right' },
                { k: 'epa_per_route', l: 'EPA/Route', a: 'right' },
                { k: 'epa_per_game', l: 'EPA/G', a: 'right' },
                { k: 'racr', l: 'RACR', a: 'right' },
                { k: 'target_share', l: 'Tgt Share', a: 'right' },
                { k: 'air_yards_share', l: 'Air Share', a: 'right' },
                { k: 'wopr', l: 'WOPR', a: 'right' },
                // NextGen Stats (if available)
                ...(hasNextGenStats ? [
                    { k: 'ngs_avg_separation', l: 'Separation', a: 'right', tooltip: 'Avg separation at catch (yards)' },
                    { k: 'ngs_avg_cushion', l: 'Cushion', a: 'right', tooltip: 'Avg starting cushion (yards)' },
                    { k: 'ngs_avg_intended_air_yards', l: 'Int Air Yds', a: 'right', tooltip: 'Avg intended air yards per target' },
                    { k: 'ngs_avg_yac_above_expectation', l: 'YAC+', a: 'right', tooltip: 'YAC above/below expectation', h: true },
                    { k: 'ngs_avg_yac', l: 'YAC Avg', a: 'right', tooltip: 'Average yards after catch' },
                    { k: 'ngs_percent_share_of_intended_air_yards', l: 'Air Share%', a: 'right', tooltip: 'Share of team intended air yards' }
                ] : []),
                // Per Game
                { k: 'receiving_yards_pg', l: 'Yds/G', a: 'right' },
                { k: 'targets_pg', l: 'Tgt/G', a: 'right' }
            ];
        }

        // Default columns for other positions
        // For "ALL" position, show NextGen Stats if available
        // FIXED: Removed allData dependency - use hasNextGenStats boolean instead
        if (position === 'ALL' && hasNextGenStats) {
            // If hasNextGenStats is true, we know NGS data exists
            // No need to iterate through allData again
            return [
                ...base,
                // Add NextGen Stats columns for ALL view when NextGen Stats are available
                { k: 'ngs_avg_separation', l: 'Separation', a: 'right', tooltip: 'Avg separation at catch (yards)' },
                { k: 'ngs_avg_cushion', l: 'Cushion', a: 'right', tooltip: 'Avg starting cushion (yards)' },
                { k: 'ngs_avg_intended_air_yards', l: 'Int Air Yds', a: 'right', tooltip: 'Avg intended air yards per target' },
                { k: 'ngs_avg_yac_above_expectation', l: 'YAC+', a: 'right', tooltip: 'YAC above/below expectation', h: true },
                { k: 'ngs_avg_yac', l: 'YAC Avg', a: 'right', tooltip: 'Average yards after catch' },
                { k: 'ngs_percent_share_of_intended_air_yards', l: 'Air Share%', a: 'right', tooltip: 'Share of team intended air yards' }
            ];
        }
        
        return [
            ...base
        ];
    };

    // Track renderCellValue calls for performance debugging
    const renderCellValueCallCount = useRef(0);
    const renderCellValueCallLog = useRef([]);
    
    const renderCellValue = (player, col) => {
        renderCellValueCallCount.current += 1;
        
        // Track function call with profiler
        const currentProfiler = profilerRef.current || window.__performanceProfiler?.PlayerStats;
        if (currentProfiler) {
            return trackCall(currentProfiler, 'renderCellValue', () => {
                return renderCellValueImpl(player, col);
            }, { column: col.k });
        } else {
            // Fallback if profiler not available
            return renderCellValueImpl(player, col);
        }
    };
    
    const renderCellValueImpl = (player, col) => {
        
        // Log if we're calling this excessively
        if (renderCellValueCallCount.current % 1000 === 0) {
            console.warn(`⚠️ [RENDER_CELL_VALUE] Called ${renderCellValueCallCount.current} times`);
        }
        
        // Access player name fields safely
        if (col.k === 'player') return player.player_name || player.player_display_name || player.player || 'Unknown';
        if (col.k === 'team') return player.recent_team || player.team || '-';
        if (col.k === 'position') return player.position || '-';
        if (col.k === 'fantasy') return player.fantasy_points_ppr || 0;
        if (col.k === 'games') return player.games || 0;

        // Calculated metrics - QB
        if (col.k === 'completion_percentage') return ((player.completions || 0) / (player.attempts || 1)) * 100;
        if (col.k === 'td_percentage') return ((player.passing_tds || 0) / (player.attempts || 1)) * 100;
        if (col.k === 'int_percentage') return ((player.interceptions || 0) / (player.attempts || 1)) * 100;
        if (col.k === 'yards_per_attempt') return (player.passing_yards || 0) / (player.attempts || 1);
        if (col.k === 'yards_per_completion') return (player.passing_yards || 0) / (player.completions || 1);
        if (col.k === 'sack_percentage') return ((player.sacks || 0) / ((player.attempts || 0) + (player.sacks || 0))) * 100;

        // Advanced QB
        if (col.k === 'air_yards_per_attempt') return (player.passing_air_yards || 0) / (player.attempts || 1);

        // Dropback metrics (Attempts + Sacks)
        const dropbacks = (player.attempts || 0) + (player.sacks || 0);
        if (col.k === 'epa_per_dropback') return (player.passing_epa || 0) / (dropbacks || 1);
        if (col.k === 'fantasy_points_per_dropback') return (player.fantasy_points_ppr || 0) / (dropbacks || 1);

        // Calculated metrics - RB
        if (col.k === 'yards_per_carry') return (player.rushing_yards || 0) / (player.carries || 1);

        // Calculated metrics - WR/TE
        if (col.k === 'yards_per_reception') return (player.receiving_yards || 0) / (player.receptions || 1);
        if (col.k === 'yards_per_target') return (player.receiving_yards || 0) / (player.targets || 1);
        if (col.k === 'catch_percentage') return ((player.receptions || 0) / (player.targets || 1)) * 100;

        // Route-based metrics (YPRR = Yards Per Route Run, TPRR = Targets Per Route Run)
        if (col.k === 'yprr') return (player.receiving_yards || 0) / (player.routes || 1);
        if (col.k === 'tprr') return (player.targets || 0) / (player.routes || 1);

        // ADOT (Average Depth of Target) = Total Air Yards / Total Targets
        if (col.k === 'adot') return (player.receiving_air_yards || 0) / (player.targets || 1);

        // RACR (Receiver Air Conversion Ratio) = Receiving Yards / Total Air Yards
        if (col.k === 'racr') {
            const airYards = player.receiving_air_yards || 0;
            if (airYards === 0) return 0;
            return (player.receiving_yards || 0) / airYards;
        }

        // EPA per route and per game
        if (col.k === 'epa_per_route') return (player.receiving_epa || 0) / (player.routes || 1);
        
        // Per game stats
        const games = player.games || 1;
        if (col.k === 'fantasy_points_pg') return (player.fantasy_points_ppr || 0) / games;
        if (col.k === 'passing_yards_pg') return (player.passing_yards || 0) / games;
        if (col.k === 'passing_tds_pg') return (player.passing_tds || 0) / games;
        if (col.k === 'rushing_yards_pg') return (player.rushing_yards || 0) / games;
        if (col.k === 'receiving_yards_pg') return (player.receiving_yards || 0) / games;
        if (col.k === 'targets_pg') return (player.targets || 0) / games;
        if (col.k === 'epa_per_game') return (player.receiving_epa || 0) / games;

        // Direct field access - return the value or 0
        // For NextGen Stats, return null if not available (don't default to 0)
        if (col.k.startsWith('ngs_')) {
            return player[col.k] ?? null;
        }
        return player[col.k] || 0;
    };

    const renderCell = (player, col, preCalculatedValue = null) => {
        // CRITICAL FIX: Use pre-calculated value if provided to avoid duplicate renderCellValue calls
        const value = preCalculatedValue !== null ? preCalculatedValue : renderCellValue(player, col);
        if (typeof value === 'string') return value;
        if (value === null || value === undefined) return '-';
        if (col.k === 'games') return value;

        // Integer columns (always 0 decimals)
        const integerCols = [
            'completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions',
            'carries', 'rushing_yards', 'rushing_tds', 'rushing_fumbles', 'rushing_first_downs',
            'targets', 'receptions', 'receiving_yards', 'receiving_tds', 'receiving_fumbles', 'receiving_first_downs',
            'passing_first_downs', 'routes', 'receiving_air_yards', 'receiving_yards_after_catch',
            'sacks', 'sack_yards', 'passing_air_yards', 'passing_yards_after_catch'
        ];

        if (integerCols.includes(col.k)) {
            return Math.round(value).toLocaleString();
        }

        // Rate stats (Percentages)
        if (col.k === 'completion_percentage' || col.k === 'catch_percentage' ||
            col.k === 'td_percentage' || col.k === 'int_percentage' ||
            col.k === 'sack_percentage' || col.k === 'td_per_attempt' ||
            col.k === 'int_per_attempt' || col.k === 'target_share' ||
            col.k === 'air_yards_share') {

            let displayValue = value;
            if (col.k === 'target_share' || col.k === 'air_yards_share') {
                displayValue = value * 100;
            }
            // For WR/TE, use 2 decimals for all percentages. For others, use 1.
            const decimals = (selectedPosition === 'WR' || selectedPosition === 'TE') ? 2 : 1;
            return displayValue.toFixed(decimals) + '%';
        }

        // Default float formatting
        // For WR/TE, use 2 decimals for all rate stats. For others, use 1.
        const decimals = (selectedPosition === 'WR' || selectedPosition === 'TE') ? 2 : 1;

        // Special case for fantasy points
        if (col.k === 'fantasy' || col.k === 'fantasy_points_ppr' || col.k === 'fantasy_points_pg') {
            return value.toFixed(decimals);
        }

        // NextGen Stats columns - always use 2 decimals for WRs/TEs
        if (col.k.startsWith('ngs_')) {
            const ngsDecimals = (selectedPosition === 'WR' || selectedPosition === 'TE') ? 2 : 1;
            // Handle percentage columns
            if (col.k.includes('percent') || col.k.includes('share')) {
                return (value * 100).toFixed(ngsDecimals) + '%';
            }
            return value.toFixed(ngsDecimals);
        }

        // All other float columns (yprr, tprr, yards_per_reception, yards_per_target, 
        // receiving_epa, racr, wopr, receiving_yards_pg, targets_pg, etc.)
        return value.toFixed(decimals);
    };

    const handleSort = (columnKey) => {
        let direction = 'desc';
        if (sortConfig.key === columnKey && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key: columnKey, direction });
    };

    const sortedData = useMemo(() => {
        const startTime = performance.now();
        const beforeCallCount = renderCellValueCallCount.current;
        
        // Track this operation with profiler - ALWAYS log to console for debugging
        const profiler = profilerRef.current || window.__performanceProfiler?.PlayerStats;
        console.log(`🔀 [SORT] Starting sort - Profiler available: ${!!profiler}`, {
            filteredDataLength: filteredData.length,
            sortKey: sortConfig.key,
            sortDirection: sortConfig.direction,
            profilerExists: !!profiler
        });
        
        if (profiler) {
            profiler.markRenderStart();
        } else {
            console.warn('⚠️ [SORT] Profiler not available!');
        }
        
        if (!sortConfig.key) {
            console.log(`  ⏭️  No sort key, returning filteredData`);
            return filteredData;
        }

        const result = perfLog(`Sort ${filteredData.length} rows by ${sortConfig.key}`, () => {
            // Optimize: Try direct property access first (much faster)
            const sortKey = sortConfig.key;
            const hasDirectAccess = filteredData.length > 0 && sortKey in filteredData[0];
            
            if (hasDirectAccess) {
                // Direct property access - much faster!
                return [...filteredData].sort((a, b) => {
                    const aVal = a[sortKey] ?? 0;
                    const bVal = b[sortKey] ?? 0;
                    
                    const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/[^0-9.-]/g, '')) || 0;
                    const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/[^0-9.-]/g, '')) || 0;

                    if (aNum < bNum) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aNum > bNum) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                });
            } else {
                // CRITICAL FIX: Pre-calculate sort values BEFORE sorting to avoid calling renderCellValue thousands of times
                // Sort algorithm does O(n log n) comparisons, so without pre-calculation we'd call renderCellValue O(n log n) times
                // With pre-calculation, we only call it O(n) times (once per row)
                const dataWithSortValues = filteredData.map(item => ({
                    item,
                    sortValue: (() => {
                        const val = renderCellValue(item, { k: sortConfig.key });
                        const str = String(val).replace(/[^0-9.-]/g, '');
                        const num = parseFloat(str);
                        return isNaN(num) ? val : num;
                    })()
                }));
                
                // Now sort by pre-calculated values (much faster!)
                dataWithSortValues.sort((a, b) => {
                    if (a.sortValue < b.sortValue) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (a.sortValue > b.sortValue) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                });
                
                // Extract original items
                return dataWithSortValues.map(entry => entry.item);
            }
        });
        
        const duration = performance.now() - startTime;
        const callsMade = renderCellValueCallCount.current - beforeCallCount;
        console.log(`✅ [SORT] Complete: ${result.length} rows in ${duration.toFixed(2)}ms (${callsMade} renderCellValue calls)`);
        
        // Track this operation with profiler - ALWAYS log timing
        const profilerAfter = profilerRef.current || window.__performanceProfiler?.PlayerStats;
        if (profilerAfter) {
            profilerAfter.trackFunctionCall('sortedData_useMemo', duration, {
                rowCount: filteredData.length,
                sortKey: sortConfig.key,
                callsMade
            });
            console.log(`📊 [SORT] Tracked with profiler: ${duration.toFixed(2)}ms`);
        } else {
            console.warn(`⚠️ [SORT] Profiler not available after sort!`);
        }
        
        // Warn if this took too long - CRITICAL for debugging
        if (duration > 100) {
            console.error(`🚨 [SORT] SLOW OPERATION: ${duration.toFixed(2)}ms - ${filteredData.length} rows, ${callsMade} renderCellValue calls`);
            // Also log to window for easy access
            if (typeof window !== 'undefined') {
                window.__lastSlowSort = { duration, rows: filteredData.length, calls: callsMade, timestamp: Date.now() };
            }
        }
        
        return result;
    }, [filteredData, sortConfig]);

    const allColumns = useMemo(() => getColumnsForPosition(selectedPosition), [selectedPosition, hasNextGenStats]);
    
    // Group columns into categories
    const columnCategories = useMemo(() => {
        const categories = {
            essential: [], // Always visible: Player, Team, Pos, G, Fant, FP/G
            basic: [],     // Basic stats: Tgt, Rec, Yds, TD, etc.
            advanced: [],  // Advanced metrics: YPRR, EPA, RACR, etc.
            nextgen: []    // NextGen Stats
        };
        
        allColumns.forEach(col => {
            // Essential columns (always visible)
            if (['player', 'team', 'position', 'games', 'fantasy', 'fantasy_points_pg'].includes(col.k)) {
                categories.essential.push(col);
            }
            // NextGen Stats
            else if (col.k.startsWith('ngs_')) {
                categories.nextgen.push(col);
            }
            // Advanced metrics (calculated, rates, shares)
            else if (['yprr', 'tprr', 'catch_percentage', 'adot', 'epa_per_route', 'epa_per_game', 
                      'racr', 'target_share', 'air_yards_share', 'wopr', 'yards_per_reception', 
                      'yards_per_target', 'receiving_epa'].includes(col.k)) {
                categories.advanced.push(col);
            }
            // Basic stats (totals, counts)
            else {
                categories.basic.push(col);
            }
        });
        
        return categories;
    }, [allColumns]);
    
    // Initialize visible columns on mount or position change
    // CRITICAL FIX: Only update if columns actually changed to prevent infinite loops
    useEffect(() => {
        // Reset visibility when position or columns change
        const defaultVisible = new Set();
        allColumns.forEach(col => {
            // Always show essential columns
            if (['player', 'team', 'position', 'games', 'fantasy', 'fantasy_points_pg'].includes(col.k)) {
                defaultVisible.add(col.k);
            }
            // Show common basic stats by default
            else if (['targets', 'receptions', 'receiving_yards', 'receiving_tds', 'routes', 
                      'carries', 'rushing_yards', 'rushing_tds', 'attempts', 'passing_yards', 'passing_tds'].includes(col.k)) {
                defaultVisible.add(col.k);
            }
            // Show key advanced metrics by default
            else if (['yprr', 'epa_per_route', 'adot'].includes(col.k)) {
                defaultVisible.add(col.k);
            }
        });
        
        // CRITICAL: Only update if the Set contents actually changed
        // Compare sizes and contents to prevent unnecessary updates
        const currentKeys = Array.from(visibleColumns).sort().join(',');
        const newKeys = Array.from(defaultVisible).sort().join(',');
        
        if (currentKeys !== newKeys) {
            console.log(`📋 [VISIBLE_COLUMNS] Updating: ${visibleColumns.size} → ${defaultVisible.size} columns`);
            setVisibleColumns(defaultVisible);
        }
    }, [selectedPosition, allColumns.length]); // Reset when position or column count changes
    
    // Filter columns based on visibility
    const columns = useMemo(() => {
        if (visibleColumns.size === 0) {
            // If no visibility set, show all
            return allColumns;
        }
        return allColumns.filter(col => visibleColumns.has(col.k));
    }, [allColumns, visibleColumns]);
    
    // Measure table dimensions (only when actually rendered)
    // OPTIMIZED: Use requestAnimationFrame to avoid blocking, and only measure when table is visible
    useEffect(() => {
        if (!tableContainerRef.current || sortedData.length === 0) return;
        
        // Use requestAnimationFrame to avoid blocking the main thread
        const rafId = requestAnimationFrame(() => {
            const table = tableContainerRef.current?.querySelector('table');
            if (table) {
                const dims = {
                    tableWidth: table.offsetWidth,
                    containerWidth: tableContainerRef.current.offsetWidth,
                    tableScrollWidth: table.scrollWidth,
                    containerScrollWidth: tableContainerRef.current.scrollWidth
                };
                setTableDimensions(prev => {
                    // Only update if dimensions actually changed
                    if (prev.tableWidth !== dims.tableWidth || prev.containerWidth !== dims.containerWidth) {
                        if (showDebug) {
                            console.log('Table Dimensions:', dims);
                        }
                        return dims;
                    }
                    return prev;
                });
            }
        });
        
        return () => cancelAnimationFrame(rafId);
    }, [columns.length, visibleRowCount, showDebug]); // Removed sortedData.length - only measure when columns/visible rows change

    // Calculate min/max for each column for color gradients
    // OPTIMIZED: Only calculate for visible columns and limit to first 100 rows for performance
    const columnRanges = useMemo(() => {
        const startTime = performance.now();
        const profiler = profilerRef.current || window.__performanceProfiler?.PlayerStats;
        
        console.log(`📊 [COLUMN_RANGES] Starting calculation`, {
            sortedDataLength: sortedData.length,
            columnsCount: columns.length
        });
        
        // Track start with profiler
        if (profiler) {
            profiler.markRenderStart();
        }
        
        const ranges = {};
        
        // Skip calculation if too much data - prevents UI freeze
        if (sortedData.length > 500) {
            // For large datasets, sample first 100 rows for range calculation
            const sampleData = sortedData.slice(0, 100);
            console.log(`  📉 Using sample: ${sampleData.length} rows (from ${sortedData.length})`);
            
            columns.forEach(col => {
                if (col.k === 'player' || col.k === 'team' || col.k === 'position') return;
                
                // Direct property access is much faster than renderCellValue
                const values = sampleData
                    .map(p => p[col.k])
                    .filter(v => typeof v === 'number' && !isNaN(v));

                if (values.length > 0) {
                    ranges[col.k] = {
                        min: Math.min(...values),
                        max: Math.max(...values)
                    };
                }
            });
        } else {
            console.log(`  📈 Using full dataset: ${sortedData.length} rows`);
            // CRITICAL FIX: Always use direct property access, never renderCellValue
            // renderCellValue is expensive and called thousands of times otherwise
            columns.forEach(col => {
                if (col.k === 'player' || col.k === 'team' || col.k === 'position') return;

                // Direct property access - MUCH faster than renderCellValue
                const values = sortedData
                    .map(p => {
                        // Try direct property first (fastest)
                        let val = p[col.k];
                        
                        // For calculated fields, use simple direct access
                        // Don't call renderCellValue - it's too expensive
                        if (val === undefined || val === null) {
                            // Only handle common calculated fields with simple logic
                            if (col.k === 'completion_percentage') {
                                val = p.completions && p.attempts ? (p.completions / p.attempts) * 100 : null;
                            } else if (col.k === 'yards_per_attempt') {
                                val = p.passing_yards && p.attempts ? p.passing_yards / p.attempts : null;
                            } else if (col.k === 'yards_per_carry') {
                                val = p.rushing_yards && p.carries ? p.rushing_yards / p.carries : null;
                            } else if (col.k === 'yards_per_reception') {
                                val = p.receiving_yards && p.receptions ? p.receiving_yards / p.receptions : null;
                            } else {
                                val = null; // Skip complex calculations for range calculation
                            }
                        }
                        
                        return typeof val === 'number' && !isNaN(val) ? val : null;
                    })
                    .filter(v => v !== null);

                if (values.length > 0) {
                    ranges[col.k] = {
                        min: Math.min(...values),
                        max: Math.max(...values)
                    };
                }
            });
        }
        
        const duration = performance.now() - startTime;
        console.log(`✅ [COLUMN_RANGES] Complete: ${Object.keys(ranges).length} columns in ${duration.toFixed(2)}ms`);
        
        // Track this operation with profiler
        if (profiler) {
            profiler.trackFunctionCall('columnRanges_useMemo', duration, {
                rowCount: sortedData.length,
                columnCount: columns.length,
                rangesCalculated: Object.keys(ranges).length
            });
        }
        
        // Warn if this took too long
        if (duration > 500) {
            console.error(`🚨 [COLUMN_RANGES] TOO SLOW: ${duration.toFixed(2)}ms - this is blocking the UI!`);
        }
        
        return ranges;
    }, [sortedData, columns]);

    // CRITICAL FIX: Memoize cell values to prevent recalculating on every render
    // AGGRESSIVE OPTIMIZATION: Use ref to persist cache across renders and only update when data actually changes
    // Note: cellValueCacheRef declared earlier for debug API access
    const lastCacheKeyRef = useRef('');
    
    // Create stable cache key - Use allColumnsKey which only changes when column count changes
    const columnKeys = allColumnsKey;
    
    const sortedDataKey = useMemo(() => {
        if (sortedData.length === 0) return 'empty';
        const first = sortedData[0]?.player_id || sortedData[0]?.player_name || '0';
        const last = sortedData[sortedData.length - 1]?.player_id || sortedData[sortedData.length - 1]?.player_name || '0';
        return `${sortedData.length}-${first}-${last}`;
    }, [sortedData.length, sortedData[0]?.player_id, sortedData[sortedData.length - 1]?.player_id]);
    
    const cacheKey = `${sortedDataKey}-${columnKeys}-${visibleRowCount}`;
    
    // CRITICAL FIX: Don't build cache synchronously - it blocks the UI thread!
    // Use state + useEffect to build cache asynchronously
    const [cellValueCache, setCellValueCache] = useState(new Map());
    
    useEffect(() => {
        // If cache key hasn't changed, keep existing cache
        if (cacheKey === lastCacheKeyRef.current && cellValueCacheRef.current.size > 0) {
            return; // Don't rebuild
        }
        
        // CRITICAL: Limit cache size to prevent UI freeze
        const maxRows = Math.min(visibleRowCount, 50); // Reduced to 50 rows max
        const rowsToCache = sortedData.slice(0, maxRows);
        const totalCells = rowsToCache.length * columns.length;
        
        // If too many cells, skip caching entirely and calculate on-demand
        if (totalCells > 1000) {
            console.warn(`⚠️ [CELL_CACHE] Too many cells (${totalCells}), skipping cache to prevent freeze`);
            setCellValueCache(new Map()); // Empty cache - will calculate on-demand
            cellValueCacheRef.current = new Map();
            lastCacheKeyRef.current = cacheKey;
            return;
        }
        
        console.log(`💾 [CELL_CACHE] Building cache for ${rowsToCache.length} rows × ${columns.length} cols (${totalCells} cells)...`);
        
        // Build cache asynchronously using setTimeout to break up work
        const buildCacheAsync = () => {
            const startTime = performance.now();
            const cache = new Map();
            let processed = 0;
            const batchSize = 25; // Process 25 cells per batch
            
            const processBatch = () => {
                const endIdx = Math.min(processed + batchSize, totalCells);
                
                while (processed < endIdx) {
                    const rowIdx = Math.floor(processed / columns.length);
                    const colIdx = processed % columns.length;
                    
                    if (rowIdx >= rowsToCache.length) break;
                    
                    const player = rowsToCache[rowIdx];
                    const col = columns[colIdx];
                    const playerKey = player.player_id || player.player_name || `row-${rowIdx}`;
                    // CRITICAL: Match the cache key format used in render loop (with dash)
                    const cellCacheKey = `${playerKey}-${col.k}`;
                    
                    if (!cache.has(cellCacheKey)) {
                        cache.set(cellCacheKey, renderCellValue(player, col));
                    }
                    
                    processed++;
                }
                
                if (processed < totalCells) {
                    // Schedule next batch (yield to browser)
                    setTimeout(processBatch, 0);
                } else {
                    // Done building cache
                    cellValueCacheRef.current = cache;
                    lastCacheKeyRef.current = cacheKey;
                    setCellValueCache(cache);
                    
                    const duration = performance.now() - startTime;
                    console.log(`💾 [CELL_CACHE] Built cache: ${cache.size} values in ${duration.toFixed(2)}ms`);
                }
            };
            
            // Start processing
            setTimeout(processBatch, 0);
        };
        
        buildCacheAsync();
    }, [cacheKey, sortedData.length, columns.length, visibleRowCount, renderCellValue]);

    // Get color gradient for a cell
    const getColorGradient = (value, min, max, columnKey) => {
        if (value === null || value === undefined || min === undefined || max === undefined || min === max) {
            return '';
        }

        const normalized = (value - min) / (max - min);

        // Stats where higher is bad
        const isNegative = ['interceptions', 'int_percentage', 'int_per_attempt', 'sack_percentage',
            'rushing_fumbles', 'receiving_fumbles', 'sacks'].includes(columnKey);

        if (isNegative) {
            // Red gradient for bad stats
            return `rgba(239, 68, 68, ${normalized * 0.3 + 0.05})`;
        } else {
            // Green gradient for good stats
            return `rgba(34, 197, 94, ${normalized * 0.3 + 0.05})`;
        }
    };

    const loadData = async () => {
        const startTime = performance.now();
        console.log(`📥 [LOAD_DATA] Starting data load`, {
            selectedSeason,
            includeNgs,
            selectedPosition
        });
        
        try {
            setLoading(true);
            // Only include NextGen Stats for WR/TE positions
            const shouldIncludeNgs = includeNgs && (selectedPosition === 'WR' || selectedPosition === 'TE' || selectedPosition === 'ALL');
            console.log(`  → Fetching data with includeNgs=${shouldIncludeNgs}`);
            
            // CRITICAL FIX: Use position-based limits to prevent backend timeouts
            // Railway has ~30s timeout, so we need to keep requests fast
            // Reduced limits to prevent 502 Bad Gateway errors
            let limit = 1000; // Default for ALL (reduced from 2000)
            if (selectedPosition === 'QB') limit = 200;
            else if (selectedPosition === 'RB') limit = 400;
            else if (selectedPosition === 'WR') limit = 600;
            else if (selectedPosition === 'TE') limit = 300;
            
            console.log(`  → Using limit: ${limit} (position: ${selectedPosition})`);
            
            const fetchStart = performance.now();
            const result = await getPlayerStats([selectedSeason], limit, shouldIncludeNgs, 'receiving');
            const fetchDuration = performance.now() - fetchStart;
            
            console.log(`  ✓ Fetch complete: ${result.data?.length || 0} players in ${fetchDuration.toFixed(2)}ms`);
            
            setAllData(result.data || []);
            
            // Debug: Check if NextGen Stats are in the response
            if (shouldIncludeNgs && result.data && result.data.length > 0) {
                const samplePlayer = result.data[0];
                const ngsKeys = Object.keys(samplePlayer).filter(key => key.startsWith('ngs_'));
                console.log('  📊 NextGen Stats check:', {
                    shouldIncludeNgs,
                    totalPlayers: result.data.length,
                    samplePlayerKeys: Object.keys(samplePlayer).slice(0, 10),
                    ngsKeysFound: ngsKeys,
                    hasNgs: ngsKeys.length > 0
                });
            }
            
            setError(null);
            
            const totalDuration = performance.now() - startTime;
            console.log(`✅ [LOAD_DATA] Complete in ${totalDuration.toFixed(2)}ms`);
        } catch (err) {
            const duration = performance.now() - startTime;
            console.error(`❌ [LOAD_DATA] Error after ${duration.toFixed(2)}ms:`, err);
            setError(err.message);
            // Report error to backend for debugging
            reportError(err, {
                component: 'PlayerStats',
                action: 'loadData',
                season: selectedSeason,
                position: selectedPosition,
                includeNgs: includeNgs,
            });
        } finally {
            setLoading(false);
        }
    };

    // Memoize filterByPosition to prevent recreation on every render
    const filterByPosition = useCallback(() => {
        const startTime = performance.now();
        const profiler = profilerRef.current || window.__performanceProfiler?.PlayerStats;
        
        console.log(`🔍 [FILTER] Starting filter`, {
            allDataLength: allData.length,
            selectedPosition,
            minThreshold
        });
        
        // Track start with profiler
        if (profiler) {
            profiler.markRenderStart();
        }
        
        let data = allData;

        // 1. Filter by Position
        if (selectedPosition !== 'ALL') {
            const beforePos = data.length;
            data = perfLog(`Filter by position (${selectedPosition})`, () => 
                data.filter(p => p.position === selectedPosition)
            );
            console.log(`  ✓ Position filter: ${beforePos} → ${data.length} rows`);
        }

        // 2. Filter by Minimum Threshold
        const thresholdMetric = getThresholdMetric(selectedPosition);
        if (minThreshold > 0) {
            const beforeThresh = data.length;
            data = perfLog(`Filter by threshold (${thresholdMetric.key} >= ${minThreshold})`, () =>
                data.filter(p => {
                    const val = p[thresholdMetric.key] || 0;
                    return val >= minThreshold;
                })
            );
            console.log(`  ✓ Threshold filter: ${beforeThresh} → ${data.length} rows`);
        }

        const duration = performance.now() - startTime;
        console.log(`✅ [FILTER] Complete: ${data.length} rows in ${duration.toFixed(2)}ms`);
        
        // Track this operation with profiler
        if (profiler) {
            profiler.trackFunctionCall('filterByPosition', duration, {
                inputRows: allData.length,
                outputRows: data.length,
                position: selectedPosition,
                threshold: minThreshold
            });
        }
        
        // Warn if this took too long
        if (duration > 500) {
            console.error(`🚨 [FILTER] TOO SLOW: ${duration.toFixed(2)}ms - this is blocking the UI!`);
        }
        
        setFilteredData(data);
    }, [allData, selectedPosition, minThreshold]);

    useEffect(() => {
        loadData();
    }, [selectedSeason, includeNgs]);

    useEffect(() => {
        console.log(`🎯 [POSITION_CHANGE] Position changed to: ${selectedPosition}`);
        
        // Reset threshold, sort, and visible rows when position changes
        let newThreshold = 0;
        let newSortKey = 'fantasy_points_ppr';

        if (selectedPosition === 'QB') {
            newThreshold = 50; // Min 50 attempts
            newSortKey = 'passing_epa';
        } else if (selectedPosition === 'RB') {
            newThreshold = 30; // Min 30 carries
            newSortKey = 'rushing_epa';
        } else if (selectedPosition === 'WR' || selectedPosition === 'TE') {
            newThreshold = 50; // Min 50 routes
            newSortKey = 'receiving_epa';
        } else {
            newThreshold = 10; // Min 10 fantasy points
            newSortKey = 'fantasy_points_ppr';
        }

        console.log(`  → Setting threshold: ${newThreshold}, sortKey: ${newSortKey}`);
        
        setMinThreshold(newThreshold);
        setSortConfig({ key: newSortKey, direction: 'desc' });
        setVisibleRowCount(MAX_VISIBLE_ROWS); // Reset to default when changing position
        
        console.log(`✅ [POSITION_CHANGE] Complete`);
    }, [selectedPosition]);

    useEffect(() => {
        console.log(`🔄 [FILTER_EFFECT] Triggered`, {
            allDataLength: allData.length,
            selectedPosition,
            minThreshold
        });
        // CRITICAL FIX: Add guard to prevent infinite loops
        if (allData.length === 0) {
            console.log(`  ⏭️  Skipping filter - no data yet`);
            setFilteredData([]);
            return;
        }
        filterByPosition();
    }, [filterByPosition, allData.length]); // Add allData.length to prevent stale closures

    // Calculate max value for the slider based on current data
    // CRITICAL FIX: Use filteredData instead of filtering allData again (avoids duplicate work)
    const maxThresholdValue = useMemo(() => {
        const metric = getThresholdMetric(selectedPosition).key;
        if (!filteredData.length) return 100;

        // Use already-filtered data instead of filtering again
        const maxVal = Math.max(...filteredData.map(p => p[metric] || 0));
        return Math.ceil(maxVal / 10) * 10; // Round up to nearest 10
    }, [filteredData, selectedPosition]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <nav className="mb-4" aria-label="Breadcrumb">
                    <ol className="flex items-center space-x-2 text-sm text-gray-600">
                        <li><Link to="/" className="hover:text-primary-600 transition-colors">Home</Link></li>
                        <li className="text-gray-400">/</li>
                        <li className="text-gray-900 font-medium">Player Stats</li>
                    </ol>
                </nav>
                
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">📊 Player Stats</h1>
                </div>
                
                <FilterSkeleton />
                <TableSkeleton rows={10} cols={8} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <nav className="mb-4" aria-label="Breadcrumb">
                    <ol className="flex items-center space-x-2 text-sm text-gray-600">
                        <li><Link to="/" className="hover:text-primary-600 transition-colors">Home</Link></li>
                        <li className="text-gray-400">/</li>
                        <li className="text-gray-900 font-medium">Player Stats</li>
                    </ol>
                </nav>
                
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">📊 Player Stats</h1>
                </div>
                
                <ErrorState 
                    error={error} 
                    onRetry={() => {
                        setError(null);
                        loadData();
                    }} 
                />
            </div>
        );
    }

    const thresholdMetric = getThresholdMetric(selectedPosition);

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Breadcrumbs */}
            <nav className="mb-4" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-2 text-sm text-gray-600">
                    <li><Link to="/" className="hover:text-primary-600 transition-colors">Home</Link></li>
                    <li className="text-gray-400">/</li>
                    <li className="text-gray-900 font-medium">Player Stats</li>
                </ol>
            </nav>
            
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">📊 Player Stats</h1>
                {/* Debug button - always visible, can click even during hang */}
                <button
                    onClick={() => {
                        const profiler = window.__performanceProfiler?.PlayerStats;
                        if (profiler) {
                            try {
                                profiler.exportData();
                                alert('Profiler data exported! Check downloads.');
                            } catch (e) {
                                // Try localStorage fallback
                                const saved = localStorage.getItem('__profiler_autosave');
                                if (saved) {
                                    const blob = new Blob([saved], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `profiler-autosave-${Date.now()}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    alert('Saved profiler data exported!');
                                } else {
                                    alert('No profiler data available yet.');
                                }
                            }
                        } else {
                            alert('Profiler not available');
                        }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                    style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 9999 }}
                    title="Export profiler data (click even if page is frozen)"
                >
                    🔍 Export Profiler Data
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Season
                        </label>
                        <select
                            value={selectedSeason}
                            onChange={(e) => setSelectedSeason(Number(e.target.value))}
                            className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        >
                            {[2025, 2024, 2023, 2022, 2021, 2020].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Position
                        </label>
                        <select
                            value={selectedPosition}
                            onChange={(e) => setSelectedPosition(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        >
                            <option value="ALL">All Positions</option>
                            <option value="QB">QB</option>
                            <option value="RB">RB</option>
                            <option value="WR">WR</option>
                            <option value="TE">TE</option>
                        </select>
                    </div>
                    {(selectedPosition === 'WR' || selectedPosition === 'TE' || selectedPosition === 'ALL') && (
                        <div className="flex items-end">
                            <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-md hover:bg-gray-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={includeNgs}
                                    onChange={(e) => setIncludeNgs(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    Include NextGen Stats
                                </span>
                            </label>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Min {thresholdMetric.label}: <span className="text-primary-600 font-semibold">{minThreshold}</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max={maxThresholdValue}
                            value={minThreshold}
                            onChange={(e) => setMinThreshold(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                                background: `linear-gradient(to right, #2563eb 0%, #2563eb ${(minThreshold / maxThresholdValue) * 100}%, #e5e7eb ${(minThreshold / maxThresholdValue) * 100}%, #e5e7eb 100%)`
                            }}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0</span>
                            <span>{maxThresholdValue}</span>
                        </div>
                    </div>

                    <div className="flex items-end">
                        <div className="text-sm text-gray-600">
                            <p className="font-medium">Showing {sortedData.length} players</p>
                            <div className="flex items-center gap-4">
                                <p className="text-xs text-gray-500">Click column to sort</p>
                                {hasNextGenStats && (
                                    <p className="text-xs text-green-600">✓ NextGen Stats loaded</p>
                                )}
                            </div>
                            <button
                                onClick={() => setShowColumnControls(!showColumnControls)}
                                className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-gray-700"
                            >
                                {showColumnControls ? '▼' : '▶'} Columns
                            </button>
                        </div>
                        
                        {showColumnControls && (
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Column Visibility</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {Object.entries(columnCategories).map(([category, cols]) => (
                                        <div key={category} className="space-y-2">
                                            <h4 className="text-xs font-semibold text-gray-600 uppercase">
                                                {category === 'essential' ? 'Essential' : 
                                                 category === 'basic' ? 'Basic Stats' :
                                                 category === 'advanced' ? 'Advanced' : 'NextGen'}
                                            </h4>
                                            <div className="space-y-1">
                                                {cols.map(col => (
                                                    <label key={col.k} className="flex items-center text-xs text-gray-700 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                visibleColumns.size === 0 
                                                                    ? true  // If empty set, all are shown
                                                                    : visibleColumns.has(col.k) || ['player', 'team', 'position', 'games', 'fantasy', 'fantasy_points_pg'].includes(col.k)
                                                            }
                                                            onChange={(e) => {
                                                                // If currently showing all (empty set), initialize with all columns first
                                                                let newVisible;
                                                                if (visibleColumns.size === 0) {
                                                                    // Initialize with all columns
                                                                    newVisible = new Set(allColumns.map(c => c.k));
                                                                } else {
                                                                    newVisible = new Set(visibleColumns);
                                                                }
                                                                
                                                                if (e.target.checked) {
                                                                    newVisible.add(col.k);
                                                                } else {
                                                                    // Don't allow hiding essential columns
                                                                    if (!['player', 'team', 'position', 'games', 'fantasy', 'fantasy_points_pg'].includes(col.k)) {
                                                                        newVisible.delete(col.k);
                                                                    }
                                                                }
                                                                setVisibleColumns(newVisible);
                                                            }}
                                                            disabled={['player', 'team', 'position', 'games', 'fantasy', 'fantasy_points_pg'].includes(col.k)}
                                                            className="mr-2"
                                                        />
                                                        <span className={['player', 'team', 'position', 'games', 'fantasy', 'fantasy_points_pg'].includes(col.k) ? 'text-gray-500' : ''}>
                                                            {col.l}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        onClick={() => {
                                            // Show all columns by setting to empty set (which means show all)
                                            setVisibleColumns(new Set());
                                        }}
                                        className="text-xs btn-primary px-3 py-1.5"
                                    >
                                        Show All
                                    </button>
                                    <button
                                        onClick={() => {
                                            const essential = new Set(['player', 'team', 'position', 'games', 'fantasy', 'fantasy_points_pg']);
                                            setVisibleColumns(essential);
                                        }}
                                        className="text-xs btn-secondary px-3 py-1.5"
                                    >
                                        Essential Only
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {sortedData.length > 0 ? (
                <div className="bg-white rounded-lg shadow-md" style={{ overflow: 'visible', width: '100%' }}>
                    <div className="mb-2 flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowDebug(!showDebug)}
                                className="text-xs btn-ghost px-3 py-1.5"
                            >
                                {showDebug ? 'Hide' : 'Show'} Debug Info
                            </button>
                            <button
                                onClick={() => {
                                    try {
                                        // Export to CSV
                                        const headers = columns.map(c => c.l).join(',');
                                        // Use cached values for CSV export too
                                        const rows = sortedData.map(player => {
                                            const playerKey = `${player.player_id || player.player_name || 'unknown'}-`;
                                            return columns.map(col => {
                                                const cacheKey = `${playerKey}${col.k}`;
                                                const val = cellValueCache.get(cacheKey) ?? renderCellValue(player, col);
                                                // Handle commas and quotes in CSV
                                                if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                                                    return `"${val.replace(/"/g, '""')}"`;
                                                }
                                                return val ?? '';
                                            }).join(',');
                                        }).join('\n');
                                        const csv = `${headers}\n${rows}`;
                                        const blob = new Blob([csv], { type: 'text/csv' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `nfl-player-stats-${selectedSeason}-${selectedPosition.toLowerCase()}.csv`;
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        showToast(`Exported ${sortedData.length} players to CSV`, 'success');
                                    } catch (err) {
                                        showToast('Failed to export CSV', 'error');
                                        console.error('Export error:', err);
                                    }
                                }}
                                className="text-xs btn-primary px-3 py-1.5"
                                title="Export to CSV"
                            >
                                📥 Export CSV
                            </button>
                        </div>
                        {showDebug && (
                            <div className="text-xs text-gray-600">
                                Columns: {columns.length} | 
                                Table Min Width: {Math.max(columns.length * 120, 1200)}px
                            </div>
                        )}
                    </div>
                    <div 
                        ref={tableContainerRef}
                        className="table-wrapper"
                        style={{ 
                            maxHeight: '80vh',
                            width: '100%',
                            overflowX: 'scroll',
                            overflowY: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            position: 'relative',
                            display: 'block'
                        }}
                    >
                        <table 
                            className="border-collapse" 
                            style={{ 
                                width: `${Math.max(columns.length * 120, 1200)}px`,
                                minWidth: `${Math.max(columns.length * 120, 1200)}px`,
                                display: 'table',
                                tableLayout: 'auto'
                            }}
                        >
                            <thead className="bg-gray-50 sticky top-0 z-20 border-b-2 border-gray-300">
                                <tr>
                                    {columns.map((col, idx) => {
                                        const isSticky = ['player', 'team', 'position'].includes(col.k);
                                        return (
                                            <th
                                                key={col.k}
                                                onClick={() => handleSort(col.k)}
                                                style={isSticky ? {
                                                    position: 'sticky',
                                                    left: idx === 0 ? 0 : idx === 1 ? 120 : 180,
                                                    zIndex: 21,
                                                    backgroundColor: '#f9fafb'
                                                } : {}}
                                                className={`px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 active:bg-gray-200 select-none transition-all duration-150 whitespace-nowrap ${col.a === 'right' ? 'text-right' : col.a === 'center' ? 'text-center' : 'text-left'
                                                    }`}
                                            >
                                                <div className={`flex items-center gap-1 ${col.a === 'right' ? 'justify-end' : col.a === 'center' ? 'justify-center' : 'justify-start'}`} title={col.tooltip || ''}>
                                                    <span>{col.l}</span>
                                                    {col.tooltip && (
                                                        <span className="text-gray-400 text-xs cursor-help" title={col.tooltip}>
                                                            ℹ️
                                                        </span>
                                                    )}
                                                    {sortConfig.key === col.k && (
                                                        <span className="text-primary-600 font-bold">
                                                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {sortedData.slice(0, visibleRowCount).map((player, rowIdx) => {
                                    // CRITICAL FIX: Get cached values instead of recalculating
                                    const cacheKeyPrefix = `${player.player_id || player.player_name || 'unknown'}-`;
                                    
                                    return (
                                        <tr
                                            key={player.player_id || rowIdx}
                                            className="hover:bg-primary-50 transition-colors duration-150 even:bg-gray-50/50"
                                        >
                                            {columns.map((col, colIdx) => {
                                                // Use cached value - MUCH faster than recalculating
                                                const cacheKey = `${cacheKeyPrefix}${col.k}`;
                                                const value = cellValueCache.get(cacheKey) ?? renderCellValue(player, col);
                                                
                                                const range = columnRanges[col.k];
                                                const bgcolor = (col.k !== 'player' && col.k !== 'team' && col.k !== 'position' && range)
                                                    ? getColorGradient(value, range.min, range.max, col.k)
                                                    : '';
                                                const isSticky = ['player', 'team', 'position'].includes(col.k);

                                                return (
                                                    <td
                                                        key={col.k}
                                                        style={{
                                                            backgroundColor: bgcolor,
                                                            ...(isSticky ? {
                                                                position: 'sticky',
                                                                left: colIdx === 0 ? 0 : colIdx === 1 ? 120 : 180,
                                                                zIndex: 10,
                                                                backgroundColor: bgcolor || (rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb')
                                                            } : {})
                                                        }}
                                                        className={`px-4 py-3 text-sm whitespace-nowrap border-r border-gray-100 last:border-r-0 ${col.a === 'right' ? 'text-right' : col.a === 'center' ? 'text-center' : 'text-left'
                                                            } ${col.k === 'player' ? 'font-medium text-gray-900' :
                                                                col.k === 'fantasy' ? 'text-primary-600 font-bold' :
                                                                    col.h ? 'font-semibold text-gray-900' : 'text-gray-700'
                                                            }`}
                                                    >
                                                        {renderCell(player, col, value)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Load More / Pagination */}
                    {sortedData.length > visibleRowCount && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
                            <p className="text-sm text-gray-600 mb-2">
                                Showing {visibleRowCount} of {sortedData.length} players
                            </p>
                            <button
                                onClick={() => setVisibleRowCount(prev => Math.min(prev + 100, sortedData.length))}
                                className="btn-primary px-4 py-2 text-sm"
                            >
                                Load More ({Math.min(100, sortedData.length - visibleRowCount)} more)
                            </button>
                            {visibleRowCount < sortedData.length && (
                                <button
                                    onClick={() => setVisibleRowCount(sortedData.length)}
                                    className="btn-secondary px-4 py-2 text-sm ml-2"
                                >
                                    Show All
                                </button>
                            )}
                        </div>
                    )}
                    {showDebug && (
                        <div className="p-2 bg-yellow-50 border-t text-xs">
                            <div>Container Width: {tableDimensions.containerWidth}px</div>
                            <div>Table Width: {tableDimensions.tableWidth}px</div>
                            <div>Can Scroll: {tableDimensions.tableWidth > tableDimensions.containerWidth ? 'YES' : 'NO'}</div>
                            <div>Columns Visible: {columns.length}</div>
                            <div>Rows Rendered: {Math.min(visibleRowCount, sortedData.length)} / {sortedData.length}</div>
                        </div>
                    )}
                </div>
            ) : (
                <NoResultsState 
                    filters={`season (${selectedSeason}), position (${selectedPosition}), and minimum ${thresholdMetric.label.toLowerCase()} (${minThreshold})`}
                    onReset={() => {
                        setSelectedSeason(2025);
                        setSelectedPosition('ALL');
                        setMinThreshold(0);
                    }}
                />
            )}
            
            <ToastContainer />
        </div>
    );
}

export default PlayerStats;

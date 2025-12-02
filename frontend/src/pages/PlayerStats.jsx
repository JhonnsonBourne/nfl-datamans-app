import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getPlayerStats, reportError } from '../services/api';
import { TableSkeleton, FilterSkeleton, Spinner } from '../components/LoadingSkeleton';
import { NoResultsState, ErrorState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

export default function PlayerStats() {
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
    const tableContainerRef = useRef(null);
    const { showToast, ToastContainer } = useToast();

    // Default sort to fantasy_points_ppr for 'ALL', will be updated by useEffect when position changes
    const [sortConfig, setSortConfig] = useState({ key: 'fantasy_points_ppr', direction: 'desc' });

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
    // Check all players, not just the first one (first might not be WR/TE)
    const hasNextGenStats = useMemo(() => {
        if (allData.length === 0) return false;
        // Check if any player has NextGen Stats columns
        return allData.some(player => 
            Object.keys(player).some(key => key.startsWith('ngs_'))
        );
    }, [allData]);

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
        // For "ALL" position, show NextGen Stats if available and we have WR/TE players
        if (position === 'ALL' && hasNextGenStats) {
            // Check if we have any WR/TE players with NextGen Stats
            const hasWrTeWithNgs = allData.some(p => 
                (p.position === 'WR' || p.position === 'TE') && 
                Object.keys(p).some(key => key.startsWith('ngs_'))
            );
            
            if (hasWrTeWithNgs) {
                return [
                    ...base,
                    // Add NextGen Stats columns for ALL view when WR/TE players are present
                    { k: 'ngs_avg_separation', l: 'Separation', a: 'right', tooltip: 'Avg separation at catch (yards)' },
                    { k: 'ngs_avg_cushion', l: 'Cushion', a: 'right', tooltip: 'Avg starting cushion (yards)' },
                    { k: 'ngs_avg_intended_air_yards', l: 'Int Air Yds', a: 'right', tooltip: 'Avg intended air yards per target' },
                    { k: 'ngs_avg_yac_above_expectation', l: 'YAC+', a: 'right', tooltip: 'YAC above/below expectation', h: true },
                    { k: 'ngs_avg_yac', l: 'YAC Avg', a: 'right', tooltip: 'Average yards after catch' },
                    { k: 'ngs_percent_share_of_intended_air_yards', l: 'Air Share%', a: 'right', tooltip: 'Share of team intended air yards' }
                ];
            }
        }
        
        return [
            ...base
        ];
    };

    const renderCellValue = (player, col) => {
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

    const renderCell = (player, col) => {
        const value = renderCellValue(player, col);
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
        if (!sortConfig.key) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = renderCellValue(a, { k: sortConfig.key });
            const bVal = renderCellValue(b, { k: sortConfig.key });

            const aStr = String(aVal).replace(/[^0-9.-]/g, '');
            const bStr = String(bVal).replace(/[^0-9.-]/g, '');
            const aNum = parseFloat(aStr);
            const bNum = parseFloat(bStr);

            const aFinal = isNaN(aNum) ? aVal : aNum;
            const bFinal = isNaN(bNum) ? bVal : bNum;

            if (aFinal < bFinal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aFinal > bFinal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortConfig]);

    const allColumns = useMemo(() => getColumnsForPosition(selectedPosition), [selectedPosition, hasNextGenStats, allData]);
    
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
        setVisibleColumns(defaultVisible);
    }, [selectedPosition, allColumns.length]); // Reset when position or column count changes
    
    // Filter columns based on visibility
    const columns = useMemo(() => {
        if (visibleColumns.size === 0) {
            // If no visibility set, show all
            return allColumns;
        }
        return allColumns.filter(col => visibleColumns.has(col.k));
    }, [allColumns, visibleColumns]);
    
    // Measure table dimensions (only when dimensions change)
    useEffect(() => {
        if (tableContainerRef.current && sortedData.length > 0) {
            const table = tableContainerRef.current.querySelector('table');
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
        }
    }, [columns.length, sortedData.length, showDebug]);

    // Calculate min/max for each column for color gradients
    const columnRanges = useMemo(() => {
        const ranges = {};

        columns.forEach(col => {
            if (col.k === 'player' || col.k === 'team' || col.k === 'position') return;

            const values = sortedData.map(p => {
                const val = renderCellValue(p, col);
                return typeof val === 'number' ? val : null;
            }).filter(v => v !== null && !isNaN(v));

            if (values.length > 0) {
                ranges[col.k] = {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            }
        });
        return ranges;
    }, [sortedData, columns]);

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
        try {
            setLoading(true);
            // Only include NextGen Stats for WR/TE positions
            const shouldIncludeNgs = includeNgs && (selectedPosition === 'WR' || selectedPosition === 'TE' || selectedPosition === 'ALL');
            const result = await getPlayerStats([selectedSeason], 10000, shouldIncludeNgs, 'receiving');
            setAllData(result.data || []);
            
            // Debug: Check if NextGen Stats are in the response
            if (shouldIncludeNgs && result.data && result.data.length > 0) {
                const samplePlayer = result.data[0];
                const ngsKeys = Object.keys(samplePlayer).filter(key => key.startsWith('ngs_'));
                console.log('NextGen Stats check:', {
                    shouldIncludeNgs,
                    totalPlayers: result.data.length,
                    samplePlayerKeys: Object.keys(samplePlayer).slice(0, 10),
                    ngsKeysFound: ngsKeys,
                    hasNgs: ngsKeys.length > 0
                });
            }
            
            setError(null);
        } catch (err) {
            setError(err.message);
            console.error('Error loading data:', err);
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

    const filterByPosition = () => {
        let data = allData;

        // 1. Filter by Position
        if (selectedPosition !== 'ALL') {
            data = data.filter(p => p.position === selectedPosition);
        }

        // 2. Filter by Minimum Threshold
        const thresholdMetric = getThresholdMetric(selectedPosition);
        if (minThreshold > 0) {
            data = data.filter(p => {
                const val = p[thresholdMetric.key] || 0;
                return val >= minThreshold;
            });
        }

        setFilteredData(data);
    };

    useEffect(() => {
        loadData();
    }, [selectedSeason, includeNgs]);

    useEffect(() => {
        // Reset threshold and sort when position changes
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

        setMinThreshold(newThreshold);
        setSortConfig({ key: newSortKey, direction: 'desc' });
    }, [selectedPosition]);

    useEffect(() => {
        filterByPosition();
    }, [allData, selectedPosition, minThreshold]);

    // Calculate max value for the slider based on current data
    const maxThresholdValue = useMemo(() => {
        const metric = getThresholdMetric(selectedPosition).key;
        if (!allData.length) return 100;

        // Filter data by position first to get relevant max
        const relevantData = selectedPosition === 'ALL'
            ? allData
            : allData.filter(p => p.position === selectedPosition);

        const maxVal = Math.max(...relevantData.map(p => p[metric] || 0));
        return Math.ceil(maxVal / 10) * 10; // Round up to nearest 10
    }, [allData, selectedPosition]);

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
                                        const rows = sortedData.map(player => 
                                            columns.map(col => {
                                                const val = renderCellValue(player, col);
                                                // Handle commas and quotes in CSV
                                                if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                                                    return `"${val.replace(/"/g, '""')}"`;
                                                }
                                                return val ?? '';
                                            }).join(',')
                                        ).join('\n');
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
                                {sortedData.map((player, rowIdx) => (
                                    <tr
                                        key={rowIdx}
                                        className="hover:bg-primary-50 transition-colors duration-150 even:bg-gray-50/50"
                                    >
                                        {columns.map((col, colIdx) => {
                                            const value = renderCellValue(player, col);
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
                                                    {renderCell(player, col)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {showDebug && (
                        <div className="p-2 bg-yellow-50 border-t text-xs">
                            <div>Container Width: {tableDimensions.containerWidth}px</div>
                            <div>Table Width: {tableDimensions.tableWidth}px</div>
                            <div>Can Scroll: {tableDimensions.tableWidth > tableDimensions.containerWidth ? 'YES' : 'NO'}</div>
                            <div>Columns Visible: {columns.length}</div>
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

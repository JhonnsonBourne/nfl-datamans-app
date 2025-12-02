import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getPlayerStats, reportError } from '../services/api';
import { perfLogger, measureAsync } from '../utils/performanceLogger';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
} from '@tanstack/react-table';
import { 
    Paper, 
    ScrollArea, 
    Table, 
    Select, 
    Slider, 
    Checkbox, 
    Button, 
    Group, 
    Stack, 
    Text, 
    Title, 
    Badge,
    Skeleton,
    Alert,
    Tooltip,
    ActionIcon,
    Collapse,
    Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

export default function PlayerStats() {
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState('2025');
    const [selectedPosition, setSelectedPosition] = useState('ALL');
    const [minThreshold, setMinThreshold] = useState(0);
    // NextGen Stats are now always included, no toggle needed
    const [columnVisibility, setColumnVisibility] = useState({});
    const [showColumnControls, setShowColumnControls] = useState(false);
    const [sorting, setSorting] = useState([{ id: 'fantasy', desc: true }]);
    
    // Performance tracking
    const renderCount = useRef(0);
    const lastRenderTime = useRef(performance.now());
    
    // Track component renders
    useEffect(() => {
        renderCount.current++;
        const now = performance.now();
        const timeSinceLastRender = now - lastRenderTime.current;
        lastRenderTime.current = now;
        
        if (perfLogger.enabled) {
            perfLogger.record('PlayerStats render', timeSinceLastRender, {
                renderCount: renderCount.current,
                filteredDataLength: filteredData.length,
                allDataLength: allData.length,
                columnsCount: columns?.length || 0
            });
        }
    });

    // Helper functions
    const getThresholdMetric = (position) => {
        switch (position) {
            case 'QB': return { key: 'attempts', label: 'Pass Attempts', max: 300 };
            case 'RB': return { key: 'carries', label: 'Carries', max: 200 };
            case 'WR':
            case 'TE': return { key: 'routes', label: 'Routes', max: 300 };
            default: return { key: 'fantasy_points_ppr', label: 'Fantasy Points', max: 200 };
        }
    };

    const thresholdMetric = getThresholdMetric(selectedPosition);

    // Check if NextGen Stats are available
    const hasNextGenStats = useMemo(() => {
        if (allData.length === 0) return false;
        return allData.some(player => 
            Object.keys(player).some(key => key.startsWith('ngs_'))
        );
    }, [allData]);

    // Calculate cell value (for computed metrics)
    // Most efficiency metrics are now calculated on the backend, so we just return the value
    const getCellValue = useCallback((player, columnId) => {
        // Direct field
        if (columnId === 'player') return player.player_display_name || player.player || 'Unknown';
        if (columnId === 'team') return player.recent_team || player.team || player.team_abbr || '';
        if (columnId === 'position') return player.position || '';
        if (columnId === 'games') return player.games || 0;
        if (columnId === 'fantasy') return player.fantasy_points_ppr || 0;

        // Backend-calculated efficiency metrics (prefer backend values, fallback to calculation for backwards compatibility)
        // QB Metrics
        if (columnId === 'completion_percentage') return player.completion_pct ?? ((player.completions || 0) / (player.attempts || 1)) * 100;
        if (columnId === 'yards_per_attempt') return player.yards_per_attempt ?? ((player.passing_yards || 0) / (player.attempts || 1));
        if (columnId === 'td_percentage') return player.td_percentage ?? ((player.passing_tds || 0) / (player.attempts || 1)) * 100;
        if (columnId === 'int_percentage') return player.int_percentage ?? ((player.interceptions || 0) / (player.attempts || 1)) * 100;
        if (columnId === 'sack_percentage') return player.sack_percentage ?? ((player.sacks || 0) / ((player.attempts || 0) + (player.sacks || 0))) * 100;
        if (columnId === 'air_yards_per_attempt') return player.air_yards_per_attempt ?? ((player.passing_air_yards || 0) / (player.attempts || 1));
        if (columnId === 'epa_per_dropback') return player.epa_per_dropback ?? ((player.passing_epa || 0) / ((player.attempts || 0) + (player.sacks || 0) || 1));
        if (columnId === 'fantasy_points_per_dropback') return player.fantasy_points_per_dropback ?? ((player.fantasy_points_ppr || 0) / ((player.attempts || 0) + (player.sacks || 0) || 1));

        // RB Metrics
        if (columnId === 'yards_per_carry') return player.yards_per_carry ?? ((player.rushing_yards || 0) / (player.carries || 1));
        if (columnId === 'rushing_td_rate') return player.rushing_td_rate ?? ((player.rushing_tds || 0) / (player.carries || 1)) * 100;
        if (columnId === 'rushing_epa_per_carry') return player.rushing_epa_per_carry ?? ((player.rushing_epa || 0) / (player.carries || 1));
        if (columnId === 'carries_pg') return player.carries_pg ?? ((player.carries || 0) / (player.games || 1));
        if (columnId === 'yards_per_touch') return player.yards_per_touch ?? (((player.rushing_yards || 0) + (player.receiving_yards || 0)) / ((player.carries || 0) + (player.receptions || 0) || 1));
        if (columnId === 'receiving_epa_per_target') return player.receiving_epa_per_target ?? ((player.receiving_epa || 0) / (player.targets || 1));

        // WR/TE Metrics
        if (columnId === 'yards_per_reception') return player.yards_per_reception ?? ((player.receiving_yards || 0) / (player.receptions || 1));
        if (columnId === 'yards_per_target') return player.yards_per_target ?? ((player.receiving_yards || 0) / (player.targets || 1));
        if (columnId === 'catch_percentage') return player.catch_percentage ?? ((player.receptions || 0) / (player.targets || 1)) * 100;
        if (columnId === 'yprr') return player.yprr ?? ((player.receiving_yards || 0) / (player.routes || 1));
        if (columnId === 'tprr') return player.tprr ?? ((player.targets || 0) / (player.routes || 1));
        if (columnId === 'adot') return player.adot ?? ((player.receiving_air_yards || 0) / (player.targets || 1));
        if (columnId === 'racr') return player.racr ?? ((player.receiving_air_yards || 0) > 0 ? (player.receiving_yards || 0) / (player.receiving_air_yards || 0) : 0);
        if (columnId === 'epa_per_route') return player.epa_per_route ?? ((player.receiving_epa || 0) / (player.routes || 1));
        if (columnId === 'td_rate') return player.td_rate ?? ((player.receiving_tds || 0) / (player.targets || 1)) * 100;
        if (columnId === 'first_down_rate') return player.first_down_rate ?? ((player.receiving_first_downs || 0) / (player.receptions || 1)) * 100;

        // Per game stats
        const games = player.games || 1;
        if (columnId === 'fantasy_points_pg') return player.fantasy_points_pg ?? ((player.fantasy_points_ppr || 0) / games);
        if (columnId === 'passing_yards_pg') return player.passing_yards_pg ?? ((player.passing_yards || 0) / games);
        if (columnId === 'passing_tds_pg') return player.passing_tds_pg ?? ((player.passing_tds || 0) / games);
        if (columnId === 'rushing_yards_pg') return player.rushing_yards_pg ?? ((player.rushing_yards || 0) / games);
        if (columnId === 'receiving_yards_pg') return player.receiving_yards_pg ?? ((player.receiving_yards || 0) / games);
        if (columnId === 'targets_pg') return player.targets_pg ?? ((player.targets || 0) / games);
        if (columnId === 'receptions_pg') return player.receptions_pg ?? ((player.receptions || 0) / games);
        if (columnId === 'receiving_tds_pg') return player.receiving_tds_pg ?? ((player.receiving_tds || 0) / games);
        if (columnId === 'epa_per_game') return player.epa_per_game ?? ((player.receiving_epa || 0) / games);

        // NextGen Stats
        if (columnId.startsWith('ngs_')) {
            return player[columnId] ?? null;
        }

        return player[columnId] || 0;
    }, []);

    // Format cell value for display
    const formatCellValue = useCallback((value, columnId) => {
        if (typeof value === 'string') return value;
        if (value === null || value === undefined) return '-';
        if (columnId === 'games') return value;

        const integerCols = [
            'completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions',
            'carries', 'rushing_yards', 'rushing_tds', 'rushing_fumbles', 'rushing_first_downs',
            'targets', 'receptions', 'receiving_yards', 'receiving_tds', 'receiving_fumbles', 
            'receiving_first_downs', 'passing_first_downs', 'routes', 'receiving_air_yards',
            'receiving_yards_after_catch', 'sacks', 'sack_yards', 'passing_air_yards', 'games',
            // RB totals
            'total_yards', 'total_tds', 'total_touches',
            // NGS rush totals - display as whole numbers
            'ngs_rush_attempts', 'ngs_rush_yards', 'ngs_rush_touchdowns'
        ];
        
        // NGS total columns that should show 1 decimal (they're calculated totals)
        if (columnId === 'ngs_expected_rush_yards' || columnId === 'ngs_rush_yards_over_expected') {
            return value.toFixed(1);
        }

        if (integerCols.includes(columnId)) {
            return Math.round(value).toLocaleString();
        }

        const percentageCols = ['completion_percentage', 'catch_percentage', 'td_percentage', 
            'int_percentage', 'sack_percentage', 'target_share', 'air_yards_share', 'td_rate', 
            'first_down_rate', 'rushing_td_rate'];
        
        if (percentageCols.includes(columnId)) {
            let displayValue = value;
            // These columns come as decimals (0-1), need to multiply by 100
            if (columnId === 'target_share' || columnId === 'air_yards_share') {
                displayValue = value * 100;
            }
            return displayValue.toFixed(2) + '%';
        }

        // NextGen percent columns - ALREADY percentages (0-100), don't multiply!
        const ngsPercentCols = [
            'ngs_percent_attempts_gte_eight_defenders',
            'ngs_aggressiveness',
            'ngs_expected_completion_percentage',
            'ngs_completion_percentage',
        ];
        if (ngsPercentCols.includes(columnId)) {
            return value.toFixed(1) + '%';
        }

        // NGS CPOE can be negative, show with sign
        if (columnId === 'ngs_completion_percentage_above_expectation') {
            const sign = value >= 0 ? '+' : '';
            return sign + value.toFixed(1) + '%';
        }

        // Other NGS percent/share columns (if any)
        if (columnId.startsWith('ngs_') && (columnId.includes('percent') || columnId.includes('share'))) {
            return value.toFixed(1) + '%';
        }

        return value.toFixed(2);
    }, []);

    // Get color for cell based on value
    // OPTIMIZED: Use pre-calculated min/max from columnRanges
    const getCellColor = useCallback((value, columnId, rangeData) => {
        if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) return '';
        if (!rangeData || rangeData.min === undefined || rangeData.max === undefined) return '';
        
        const { min, max } = rangeData;
        if (min === max) return '';

        const normalized = (value - min) / (max - min);

        const negativeStats = ['interceptions', 'int_percentage', 'sack_percentage',
            'rushing_fumbles', 'receiving_fumbles', 'sacks'];

        if (negativeStats.includes(columnId)) {
            return `rgba(239, 68, 68, ${normalized * 0.3 + 0.05})`;
        }
        return `rgba(34, 197, 94, ${normalized * 0.3 + 0.05})`;
    }, []);

    // Define columns based on position
    const getColumnsForPosition = useCallback((position) => {
        const baseColumns = [
            { id: 'player', header: 'Player', accessorFn: row => getCellValue(row, 'player'), size: 150 },
            { id: 'team', header: 'Team', accessorFn: row => getCellValue(row, 'team'), size: 60 },
            { id: 'position', header: 'Pos', accessorFn: row => getCellValue(row, 'position'), size: 50 },
            { id: 'games', header: 'G', accessorFn: row => getCellValue(row, 'games'), size: 40 },
            { id: 'fantasy', header: 'Fant', accessorFn: row => getCellValue(row, 'fantasy'), size: 60 },
            { id: 'fantasy_points_pg', header: 'FP/G', accessorFn: row => getCellValue(row, 'fantasy_points_pg'), size: 60 },
        ];

        const qbColumns = [
            // === PASSING VOLUME ===
            { id: 'completions', header: 'Cmp', accessorFn: row => row.completions || 0, size: 50 },
            { id: 'attempts', header: 'Att', accessorFn: row => row.attempts || 0, size: 50 },
            { id: 'passing_yards', header: 'Yds', accessorFn: row => row.passing_yards || 0, size: 60 },
            { id: 'passing_tds', header: 'TD', accessorFn: row => row.passing_tds || 0, size: 40 },
            { id: 'interceptions', header: 'INT', accessorFn: row => row.interceptions || 0, size: 40 },
            { id: 'sacks', header: 'Sck', accessorFn: row => row.sacks || 0, size: 45 },
            
            // === PASSING EFFICIENCY ===
            { id: 'completion_percentage', header: 'Cmp%', accessorFn: row => getCellValue(row, 'completion_percentage'), size: 60 },
            { id: 'yards_per_attempt', header: 'Y/A', accessorFn: row => getCellValue(row, 'yards_per_attempt'), size: 50 },
            { id: 'td_percentage', header: 'TD%', accessorFn: row => getCellValue(row, 'td_percentage'), size: 50 },
            { id: 'int_percentage', header: 'INT%', accessorFn: row => getCellValue(row, 'int_percentage'), size: 50 },
            { id: 'sack_percentage', header: 'Sck%', accessorFn: row => getCellValue(row, 'sack_percentage'), size: 55 },
            
            // === EPA & ADVANCED ===
            { id: 'passing_epa', header: 'EPA', accessorFn: row => row.passing_epa || 0, size: 60 },
            { id: 'epa_per_dropback', header: 'EPA/DB', accessorFn: row => getCellValue(row, 'epa_per_dropback'), size: 65 },
            { id: 'passing_cpoe', header: 'CPOE', accessorFn: row => row.passing_cpoe ?? row.dakota, size: 55 },
            
            // === AIR YARDS ===
            { id: 'passing_air_yards', header: 'Air Yds', accessorFn: row => row.passing_air_yards || 0, size: 65 },
            { id: 'air_yards_per_attempt', header: 'AY/A', accessorFn: row => getCellValue(row, 'air_yards_per_attempt'), size: 55 },
            
            // === RUSHING (QB scrambles/designed runs) ===
            { id: 'carries', header: 'Rush', accessorFn: row => row.carries || 0, size: 50 },
            { id: 'rushing_yards', header: 'Rush Yds', accessorFn: row => row.rushing_yards || 0, size: 70 },
            { id: 'rushing_tds', header: 'Rush TD', accessorFn: row => row.rushing_tds || 0, size: 60 },
        ];

        const rbColumns = [
            // === RUSHING VOLUME ===
            { id: 'carries', header: 'Att', accessorFn: row => row.carries || 0, size: 50 },
            { id: 'rushing_yards', header: 'Rush Yds', accessorFn: row => row.rushing_yards || 0, size: 70 },
            { id: 'rushing_tds', header: 'Rush TD', accessorFn: row => row.rushing_tds || 0, size: 60 },
            { id: 'rushing_first_downs', header: 'Rush 1D', accessorFn: row => row.rushing_first_downs || 0, size: 60 },
            
            // === RUSHING PER GAME ===
            { id: 'carries_pg', header: 'Att/G', accessorFn: row => getCellValue(row, 'carries_pg'), size: 55 },
            { id: 'rushing_yards_pg', header: 'Rush/G', accessorFn: row => getCellValue(row, 'rushing_yards_pg'), size: 60 },
            
            // === RUSHING EFFICIENCY ===
            { id: 'yards_per_carry', header: 'Y/A', accessorFn: row => getCellValue(row, 'yards_per_carry'), size: 50 },
            { id: 'rushing_td_rate', header: 'Rush TD%', accessorFn: row => getCellValue(row, 'rushing_td_rate'), size: 65 },
            { id: 'rushing_epa', header: 'Rush EPA', accessorFn: row => row.rushing_epa || 0, size: 65 },
            { id: 'rushing_epa_per_carry', header: 'EPA/Att', accessorFn: row => getCellValue(row, 'rushing_epa_per_carry'), size: 65 },
            
            // === RECEIVING VOLUME ===
            { id: 'targets', header: 'Tgt', accessorFn: row => row.targets || 0, size: 50 },
            { id: 'receptions', header: 'Rec', accessorFn: row => row.receptions || 0, size: 50 },
            { id: 'receiving_yards', header: 'Rec Yds', accessorFn: row => row.receiving_yards || 0, size: 65 },
            { id: 'receiving_tds', header: 'Rec TD', accessorFn: row => row.receiving_tds || 0, size: 55 },
            
            // === RECEIVING PER GAME ===
            { id: 'targets_pg', header: 'Tgt/G', accessorFn: row => getCellValue(row, 'targets_pg'), size: 55 },
            { id: 'receiving_yards_pg', header: 'Rec/G', accessorFn: row => getCellValue(row, 'receiving_yards_pg'), size: 55 },
            
            // === RECEIVING EFFICIENCY ===
            { id: 'catch_percentage', header: 'Catch%', accessorFn: row => getCellValue(row, 'catch_percentage'), size: 65 },
            { id: 'yards_per_reception', header: 'Y/Rec', accessorFn: row => getCellValue(row, 'yards_per_reception'), size: 55 },
            { id: 'yards_per_target', header: 'Y/Tgt', accessorFn: row => getCellValue(row, 'yards_per_target'), size: 55 },
            { id: 'receiving_epa', header: 'Rec EPA', accessorFn: row => row.receiving_epa || 0, size: 60 },
            
            // === TOTAL PRODUCTION ===
            { id: 'total_yards', header: 'Tot Yds', accessorFn: row => (row.rushing_yards || 0) + (row.receiving_yards || 0), size: 65 },
            { id: 'total_tds', header: 'Tot TD', accessorFn: row => (row.rushing_tds || 0) + (row.receiving_tds || 0), size: 55 },
            { id: 'total_touches', header: 'Touches', accessorFn: row => (row.carries || 0) + (row.receptions || 0), size: 65 },
            { id: 'yards_per_touch', header: 'Y/Tch', accessorFn: row => getCellValue(row, 'yards_per_touch'), size: 55 },
            
            // === MARKET SHARE ===
            { id: 'target_share', header: 'Tgt Share', accessorFn: row => row.target_share || 0, size: 70 },
            { id: 'wopr', header: 'WOPR', accessorFn: row => row.wopr || 0, size: 55 },
            
            // === MISCELLANEOUS ===
            { id: 'rushing_fumbles', header: 'Fmb', accessorFn: row => row.rushing_fumbles || 0, size: 45 },
        ];

        const wrTeColumns = [
            // === VOLUME (Season Totals) ===
            { id: 'targets', header: 'Tgt', accessorFn: row => row.targets || 0, size: 50 },
            { id: 'receptions', header: 'Rec', accessorFn: row => row.receptions || 0, size: 50 },
            { id: 'receiving_yards', header: 'Yds', accessorFn: row => row.receiving_yards || 0, size: 60 },
            { id: 'receiving_tds', header: 'TD', accessorFn: row => row.receiving_tds || 0, size: 40 },
            { id: 'receiving_first_downs', header: '1D', accessorFn: row => row.receiving_first_downs || 0, size: 40 },
            { id: 'routes', header: 'Routes', accessorFn: row => row.routes || 0, size: 60 },
            
            // === PER GAME ===
            { id: 'targets_pg', header: 'Tgt/G', accessorFn: row => getCellValue(row, 'targets_pg'), size: 55 },
            { id: 'receptions_pg', header: 'Rec/G', accessorFn: row => getCellValue(row, 'receptions_pg'), size: 55 },
            { id: 'receiving_yards_pg', header: 'Yds/G', accessorFn: row => getCellValue(row, 'receiving_yards_pg'), size: 55 },
            
            // === EFFICIENCY ===
            { id: 'catch_percentage', header: 'Catch%', accessorFn: row => getCellValue(row, 'catch_percentage'), size: 65 },
            { id: 'yards_per_reception', header: 'Y/Rec', accessorFn: row => getCellValue(row, 'yards_per_reception'), size: 55 },
            { id: 'yards_per_target', header: 'Y/Tgt', accessorFn: row => getCellValue(row, 'yards_per_target'), size: 55 },
            { id: 'td_rate', header: 'TD%', accessorFn: row => getCellValue(row, 'td_rate'), size: 50 },
            
            // === ROUTE-BASED ===
            { id: 'yprr', header: 'YPRR', accessorFn: row => getCellValue(row, 'yprr'), size: 55 },
            { id: 'tprr', header: 'TPRR', accessorFn: row => getCellValue(row, 'tprr'), size: 55 },
            
            // === AIR YARDS & DEPTH ===
            { id: 'adot', header: 'ADOT', accessorFn: row => getCellValue(row, 'adot'), size: 55 },
            { id: 'receiving_air_yards', header: 'Air Yds', accessorFn: row => row.receiving_air_yards || 0, size: 65 },
            { id: 'receiving_yards_after_catch', header: 'YAC', accessorFn: row => row.receiving_yards_after_catch || 0, size: 55 },
            { id: 'racr', header: 'RACR', accessorFn: row => getCellValue(row, 'racr'), size: 55 },
            
            // === MARKET SHARE ===
            { id: 'target_share', header: 'Tgt Share', accessorFn: row => row.target_share || 0, size: 70 },
            { id: 'air_yards_share', header: 'Air Share', accessorFn: row => row.air_yards_share || 0, size: 70 },
            { id: 'wopr', header: 'WOPR', accessorFn: row => row.wopr || 0, size: 55 },
            
            // === EPA (Expected Points Added) ===
            { id: 'receiving_epa', header: 'EPA', accessorFn: row => row.receiving_epa || 0, size: 55 },
            { id: 'epa_per_route', header: 'EPA/Rt', accessorFn: row => getCellValue(row, 'epa_per_route'), size: 60 },
            { id: 'epa_per_game', header: 'EPA/G', accessorFn: row => getCellValue(row, 'epa_per_game'), size: 55 },
            
            // === MISCELLANEOUS ===
            { id: 'receiving_fumbles', header: 'Fmb', accessorFn: row => row.receiving_fumbles || 0, size: 45 },
        ];

        // NextGen Stats - Receiving (for WR/TE)
        const ngsReceivingColumns = hasNextGenStats ? [
            { id: 'ngs_avg_separation', header: 'Sep', accessorFn: row => row.ngs_avg_separation, size: 50 },
            { id: 'ngs_avg_cushion', header: 'Cush', accessorFn: row => row.ngs_avg_cushion, size: 50 },
            { id: 'ngs_avg_intended_air_yards', header: 'NGS ADOT', accessorFn: row => row.ngs_avg_intended_air_yards, size: 70 },
            { id: 'ngs_avg_yac', header: 'NGS YAC', accessorFn: row => row.ngs_avg_yac, size: 60 },
            { id: 'ngs_avg_yac_above_expectation', header: 'YAC+', accessorFn: row => row.ngs_avg_yac_above_expectation, size: 55 },
        ] : [];

        // NextGen Stats - Rushing (for RB)
        // Based on https://nextgenstats.nfl.com/stats/rushing
        // Raw data: expected_rush_yards is TOTAL, rush_yards_over_expected is TOTAL
        const ngsRushingColumns = hasNextGenStats ? [
            { id: 'ngs_efficiency', header: 'Eff', accessorFn: row => row.ngs_efficiency, size: 50 },
            { id: 'ngs_avg_time_to_los', header: 'Time LOS', accessorFn: row => row.ngs_avg_time_to_los, size: 70 },
            { id: 'ngs_avg_rush_yards', header: 'Y/A', accessorFn: row => row.ngs_avg_rush_yards, size: 50 },  // Actual Y/A from NGS
            { id: 'ngs_expected_rush_yards', header: 'Exp Yds', accessorFn: row => row.ngs_expected_rush_yards, size: 70 },  // Total expected yards
            { id: 'ngs_exp_yards_per_att', header: 'Exp Y/A', accessorFn: row => {
                // Calculate expected yards per attempt (NGS specific, not in backend)
                const expYards = row.ngs_expected_rush_yards;
                const attempts = row.ngs_rush_attempts || row.carries || 1;
                return expYards && attempts ? expYards / attempts : null;
            }, size: 60 },
            { id: 'ngs_rush_yards_over_expected', header: 'RYOE', accessorFn: row => row.ngs_rush_yards_over_expected, size: 60 },  // Total RYOE
            { id: 'ngs_rush_yards_over_expected_per_att', header: 'RYOE/Att', accessorFn: row => row.ngs_rush_yards_over_expected_per_att, size: 70 },
            { id: 'ngs_percent_attempts_gte_eight_defenders', header: '8+ Box%', accessorFn: row => row.ngs_percent_attempts_gte_eight_defenders, size: 70 },
        ] : [];

        // NextGen Stats - Passing (for QB)
        // Based on https://nextgenstats.nfl.com/stats/passing
        const ngsPassingColumns = hasNextGenStats ? [
            { id: 'ngs_avg_time_to_throw', header: 'TT', accessorFn: row => row.ngs_avg_time_to_throw, size: 50 },  // Time to Throw
            { id: 'ngs_avg_air_yards_differential', header: 'AYD', accessorFn: row => row.ngs_avg_air_yards_differential, size: 55 },  // Air Yards Differential
            { id: 'ngs_aggressiveness', header: 'Agg%', accessorFn: row => row.ngs_aggressiveness, size: 55 },  // Aggressiveness
            { id: 'ngs_avg_intended_air_yards', header: 'IAY', accessorFn: row => row.ngs_avg_intended_air_yards, size: 55 },  // Intended Air Yards (ADOT)
            { id: 'ngs_avg_completed_air_yards', header: 'CAY', accessorFn: row => row.ngs_avg_completed_air_yards, size: 55 },  // Completed Air Yards
            { id: 'ngs_avg_air_yards_to_sticks', header: 'AYTS', accessorFn: row => row.ngs_avg_air_yards_to_sticks, size: 55 },  // Air Yards to Sticks
            { id: 'ngs_max_air_distance', header: 'Max AD', accessorFn: row => row.ngs_max_air_distance, size: 65 },  // Max Air Distance
            { id: 'ngs_expected_completion_percentage', header: 'xCmp%', accessorFn: row => row.ngs_expected_completion_percentage, size: 60 },  // Expected Completion %
            { id: 'ngs_completion_percentage_above_expectation', header: 'CPOE', accessorFn: row => row.ngs_completion_percentage_above_expectation, size: 60 },  // CPOE from NGS
        ] : [];

        if (position === 'QB') return [...baseColumns, ...qbColumns, ...ngsPassingColumns];
        if (position === 'RB') return [...baseColumns, ...rbColumns, ...ngsRushingColumns];
        if (position === 'WR' || position === 'TE') return [...baseColumns, ...wrTeColumns, ...ngsReceivingColumns];
        
        // ALL position - show basic receiving columns
        return [...baseColumns, ...wrTeColumns.slice(0, 6)];
    }, [getCellValue, hasNextGenStats]);

    const columns = useMemo(() => getColumnsForPosition(selectedPosition), [selectedPosition, getColumnsForPosition]);

    // Create table instance
    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            sorting,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });
    
    // Note: Virtualization removed - Mantine Table doesn't work well with absolute positioning
    // The table is already optimized with dynamic data limits and memoization
    const { rows } = table.getRowModel();

    // Calculate column value ranges for color gradients
    // OPTIMIZED: Only calculate ranges for visible columns and cache min/max
    const columnRanges = useMemo(() => {
        const timer = perfLogger.start('columnRanges calculation');
        const ranges = {};
        const rowCount = filteredData.length;
        const columnCount = columns.length;
        
        columns.forEach(col => {
            if (['player', 'team', 'position'].includes(col.id)) return;
            
            // Only calculate if column is visible
            if (columnVisibility[col.id] === false) return;
            
            const values = [];
            for (let i = 0; i < rowCount; i++) {
                const val = col.accessorFn(filteredData[i]);
                if (typeof val === 'number' && !isNaN(val)) {
                    values.push(val);
                }
            }
            
            if (values.length > 0) {
                // Pre-calculate min/max for faster getCellColor
                ranges[col.id] = {
                    values,
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            }
        });
        
        const duration = timer.end();
        perfLogger.record('columnRanges calculation', duration, {
            rows: rowCount,
            columns: columnCount,
            rangesCalculated: Object.keys(ranges).length
        });
        
        return ranges;
    }, [filteredData, columns, columnVisibility]);

    // Load data
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const timer = perfLogger.start('loadData');
            
            // Always include NextGen Stats, determine stat_type based on position
            const shouldIncludeNgs = true;
            const ngsStatType = selectedPosition === 'RB' ? 'rushing' : 
                               selectedPosition === 'QB' ? 'passing' : 
                               'receiving';
            
            // IMPORTANT: Backend applies limit BEFORE position filtering
            // So we need a high limit to ensure we get enough players of the selected position
            // The frontend will filter by position after receiving the data
            let limit = 10000;
            // Keep high limits to ensure we get enough players of each position
            // Backend returns top N players overall, then frontend filters by position
            if (selectedPosition === 'QB') limit = 500; // Need more to account for filtering
            else if (selectedPosition === 'RB') limit = 1000; // Need more to account for filtering
            else if (selectedPosition === 'WR') limit = 1500; // Need more to account for filtering
            else if (selectedPosition === 'TE') limit = 800; // Need more to account for filtering
            else limit = 5000; // ALL positions - need high limit
            
            const result = await measureAsync(
                'getPlayerStats API call',
                () => getPlayerStats([parseInt(selectedSeason)], limit, shouldIncludeNgs, ngsStatType),
                { season: selectedSeason, position: selectedPosition, limit, includeNgs: shouldIncludeNgs, ngsStatType }
            );
            
            const dataLength = result.data?.length || 0;
            const data = result.data || [];
            
            // Debug: Log RB count
            if (selectedPosition === 'RB') {
                const rbCount = data.filter(p => p.position === 'RB').length;
                console.log(`[PlayerStats] Total data loaded: ${dataLength}, RBs found: ${rbCount}`);
                console.log(`[PlayerStats] Sample RB positions:`, data.filter(p => p.position === 'RB').slice(0, 10).map(p => ({ name: p.player_display_name, position: p.position, carries: p.carries })));
            }
            
            setAllData(data);
            setError(null);
            
            const duration = timer.end();
            perfLogger.record('loadData total', duration, {
                dataLength,
                position: selectedPosition,
                limit,
                includeNgs: shouldIncludeNgs,
                ngsStatType
            });
        } catch (err) {
            setError(err.message);
            reportError(err, { component: 'PlayerStats', action: 'loadData' });
        } finally {
            setLoading(false);
        }
    }, [selectedSeason, selectedPosition]);

    // Filter data
    const filterByPosition = useCallback(() => {
        const timer = perfLogger.start('filterByPosition');
        let data = allData;
        const initialLength = data.length;
        
        if (selectedPosition !== 'ALL') {
            data = data.filter(p => p.position === selectedPosition);
        }
        if (minThreshold > 0) {
            const key = thresholdMetric.key;
            data = data.filter(p => (p[key] || 0) >= minThreshold);
        }
        
        setFilteredData(data);
        
        const duration = timer.end();
        perfLogger.record('filterByPosition', duration, {
            initialLength,
            filteredLength: data.length,
            position: selectedPosition,
            threshold: minThreshold
        });
    }, [allData, selectedPosition, minThreshold, thresholdMetric.key]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        filterByPosition();
    }, [allData, selectedPosition, minThreshold, filterByPosition]);

    // Track if this is the initial load to set defaults only once
    const isInitialLoad = useRef(true);
    
    // Update sort when position changes, but only set threshold on initial load
    useEffect(() => {
        let newSortKey = 'fantasy';

        if (selectedPosition === 'QB') {
            newSortKey = 'passing_epa';
        } else if (selectedPosition === 'RB') {
            newSortKey = 'rushing_epa';
        } else if (selectedPosition === 'WR' || selectedPosition === 'TE') {
            newSortKey = 'receiving_epa';
        }

        // Only set default threshold on initial load, not when user changes position
        if (isInitialLoad.current) {
            let newThreshold = 0;
            if (selectedPosition === 'QB') {
                newThreshold = 50;
            } else if (selectedPosition === 'RB') {
                newThreshold = 30;
            } else if (selectedPosition === 'WR' || selectedPosition === 'TE') {
                newThreshold = 50;
            }
            setMinThreshold(newThreshold);
            isInitialLoad.current = false;
        }
        
        setSorting([{ id: newSortKey, desc: true }]);
    }, [selectedPosition]);

    // Export to CSV
    const exportToCsv = () => {
        try {
            const headers = columns.map(c => c.header).join(',');
            const rows = table.getRowModel().rows.map(row => 
                row.getVisibleCells().map(cell => {
                    const val = cell.getValue();
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
            a.download = `nfl-stats-${selectedSeason}-${selectedPosition.toLowerCase()}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            notifications.show({
                title: 'Export Complete',
                message: `Exported ${filteredData.length} players to CSV`,
                color: 'green',
            });
        } catch (err) {
            notifications.show({
                title: 'Export Failed',
                message: err.message,
                color: 'red',
            });
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Skeleton height={50} mb="md" />
                <Skeleton height={400} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Alert color="red" title="Error loading data">
                    {error}
                    <Button onClick={loadData} mt="md" size="sm">Retry</Button>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={2}>Player Stats</Title>
                    <Text c="dimmed" size="sm">
                        Deep dive into player performance with advanced filtering and metrics
                    </Text>
                </div>
                <Badge size="lg" variant="light">
                    {filteredData.length} Players
                </Badge>
            </Group>

            {/* Filters */}
            <Paper shadow="sm" p="md" mb="lg" withBorder>
                <Group grow mb="md">
                    <Select
                        label="Season"
                        value={selectedSeason}
                        onChange={setSelectedSeason}
                        data={[
                            { value: '2025', label: '2025' },
                            { value: '2024', label: '2024' },
                            { value: '2023', label: '2023' },
                        ]}
                    />
                    <Select
                        label="Position"
                        value={selectedPosition}
                        onChange={setSelectedPosition}
                        data={[
                            { value: 'ALL', label: 'All Positions' },
                            { value: 'QB', label: 'QB' },
                            { value: 'RB', label: 'RB' },
                            { value: 'WR', label: 'WR' },
                            { value: 'TE', label: 'TE' },
                        ]}
                    />
                </Group>

                <Box mb="md">
                    <Text size="sm" fw={500} mb="xs">
                        Min {thresholdMetric.label}: {minThreshold}
                    </Text>
                    <Slider
                        value={minThreshold}
                        onChange={setMinThreshold}
                        min={0}
                        max={thresholdMetric.max}
                        marks={[
                            { value: 0, label: '0' },
                            { value: thresholdMetric.max, label: String(thresholdMetric.max) },
                        ]}
                    />
                </Box>

                {hasNextGenStats && (
                    <Badge color="green" variant="light">✓ NextGen Stats loaded</Badge>
                )}
            </Paper>

            {/* Table Controls */}
            <Group justify="space-between" mb="md">
                <Group>
                    <Button 
                        variant="light" 
                        size="sm"
                        onClick={() => setShowColumnControls(!showColumnControls)}
                    >
                        {showColumnControls ? '▼' : '▶'} Columns
                    </Button>
                    <Button 
                        variant="light" 
                        size="sm"
                        onClick={exportToCsv}
                    >
                        📥 Export CSV
                    </Button>
                </Group>
                <Text size="sm" c="dimmed">
                    Click column headers to sort
                </Text>
            </Group>

            {/* Column Visibility */}
            <Collapse in={showColumnControls}>
                <Paper shadow="xs" p="md" mb="md" withBorder>
                    <Text fw={500} mb="sm">Column Visibility</Text>
                    <Group gap="xs" wrap="wrap">
                        {table.getAllLeafColumns().map(column => (
                            <Checkbox
                                key={column.id}
                                label={column.columnDef.header}
                                checked={column.getIsVisible()}
                                onChange={column.getToggleVisibilityHandler()}
                                disabled={['player', 'team', 'position'].includes(column.id)}
                                size="xs"
                            />
                        ))}
                    </Group>
                    <Group mt="md" gap="xs">
                        <Button 
                            size="xs" 
                            variant="light"
                            onClick={() => table.toggleAllColumnsVisible(true)}
                        >
                            Show All
                        </Button>
                        <Button 
                            size="xs" 
                            variant="light"
                            onClick={() => {
                                table.getAllLeafColumns().forEach(col => {
                                    col.toggleVisibility(['player', 'team', 'position', 'games', 'fantasy', 'fantasy_points_pg'].includes(col.id));
                                });
                            }}
                        >
                            Essential Only
                        </Button>
                    </Group>
                </Paper>
            </Collapse>

            {/* Table */}
            <Paper shadow="sm" withBorder>
                <ScrollArea h={600} type="always" scrollbarSize={10} offsetScrollbars>
                    <Table striped highlightOnHover stickyHeader style={{ minWidth: columns.length * 90 }}>
                        <Table.Thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <Table.Tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => {
                                        const isSticky = ['player', 'team', 'position'].includes(header.id);
                                        const isLastSticky = header.id === 'position';
                                        return (
                                            <Table.Th
                                                key={header.id}
                                                onClick={header.column.getToggleSortingHandler()}
                                                style={{ 
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    minWidth: header.column.columnDef.size,
                                                    position: isSticky ? 'sticky' : undefined,
                                                    left: header.id === 'player' ? 0 : header.id === 'team' ? 150 : header.id === 'position' ? 210 : undefined,
                                                    zIndex: isSticky ? 10 : undefined,
                                                    backgroundColor: '#f8f9fa',
                                                    boxShadow: isLastSticky ? '4px 0 6px -2px rgba(0,0,0,0.1)' : undefined,
                                                }}
                                            >
                                                <Group gap={4} wrap="nowrap">
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    {header.column.getIsSorted() && (
                                                        <Text span fw={700} c="blue">
                                                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                                                        </Text>
                                                    )}
                                                </Group>
                                            </Table.Th>
                                        );
                                    })}
                                </Table.Tr>
                            ))}
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.map(row => (
                                <Table.Tr key={row.id}>
                                    {row.getVisibleCells().map(cell => {
                                        const value = cell.getValue();
                                        const columnId = cell.column.id;
                                        const isSticky = ['player', 'team', 'position'].includes(columnId);
                                        const isLastSticky = columnId === 'position';
                                        // OPTIMIZED: Use pre-calculated min/max from columnRanges
                                        const rangeData = columnRanges[columnId];
                                        const bgColor = !isSticky && rangeData 
                                            ? getCellColor(value, columnId, rangeData)
                                            : undefined;
                                        
                                        // Get player ID for link
                                        const playerId = cell.row.original.player_id || cell.row.original.gsis_id;

                                        return (
                                            <Table.Td
                                                key={cell.id}
                                                style={{
                                                    whiteSpace: 'nowrap',
                                                    backgroundColor: bgColor || (isSticky ? '#fff' : undefined),
                                                    position: isSticky ? 'sticky' : undefined,
                                                    left: columnId === 'player' ? 0 : columnId === 'team' ? 150 : columnId === 'position' ? 210 : undefined,
                                                    zIndex: isSticky ? 5 : undefined,
                                                    fontWeight: columnId === 'player' ? 500 : undefined,
                                                    boxShadow: isLastSticky ? '4px 0 6px -2px rgba(0,0,0,0.1)' : undefined,
                                                }}
                                            >
                                                {columnId === 'player' && playerId ? (
                                                    <Link 
                                                        to={`/player/${playerId}`}
                                                        style={{ 
                                                            color: '#228be6', 
                                                            textDecoration: 'none',
                                                            fontWeight: 500,
                                                        }}
                                                        onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                                                        onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                                                    >
                                                        {formatCellValue(value, columnId)}
                                                    </Link>
                                                ) : (
                                                    formatCellValue(value, columnId)
                                                )}
                                            </Table.Td>
                                        );
                                    })}
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>
            </Paper>

            {/* Scroll hint */}
            {columns.length > 8 && (
                <Text size="xs" c="dimmed" ta="center" mt="xs">
                    ← Scroll horizontally to see all {columns.length} columns →
                </Text>
            )}
            
            {/* Performance Debug Panel */}
            {perfLogger.enabled && (
                <Paper shadow="xs" p="md" mt="lg" withBorder>
                    <Group justify="space-between" mb="sm">
                        <Text fw={500}>Performance Metrics</Text>
                        <Group gap="xs">
                            <Button size="xs" variant="light" onClick={() => perfLogger.printSummary()}>
                                Print Summary
                            </Button>
                            <Button size="xs" variant="light" onClick={() => perfLogger.clear()}>
                                Clear
                            </Button>
                        </Group>
                    </Group>
                    <Stack gap="xs">
                        <Text size="sm">Renders: {renderCount.current}</Text>
                        <Text size="sm">Data: {allData.length} total, {filteredData.length} filtered</Text>
                        <Text size="sm">Columns: {columns.length}</Text>
                        <Text size="xs" c="dimmed">
                            Enable in console: localStorage.setItem('perfLogging', 'true')
                        </Text>
                    </Stack>
                </Paper>
            )}

            {filteredData.length === 0 && !loading && (
                <Paper shadow="sm" p="xl" withBorder mt="lg">
                    <Stack align="center" gap="md">
                        <Text size="lg" fw={500}>No players found</Text>
                        <Text c="dimmed">Try adjusting your filters</Text>
                        <Button onClick={() => {
                            setSelectedPosition('ALL');
                            setMinThreshold(0);
                        }}>
                            Reset Filters
                        </Button>
                    </Stack>
                </Paper>
            )}
        </div>
    );
}


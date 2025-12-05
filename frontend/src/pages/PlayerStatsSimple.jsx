import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPlayerStats } from '../services/api';
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
    Collapse,
    Box,
} from '@mantine/core';

export default function PlayerStatsSimple() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize state from URL params or defaults
    const [selectedSeason, setSelectedSeason] = useState(searchParams.get('season') || '2025');
    const [selectedPosition, setSelectedPosition] = useState(searchParams.get('position') || 'ALL');
    const [threshold, setThreshold] = useState(parseInt(searchParams.get('threshold') || '0', 10));
    const [columnVisibility, setColumnVisibility] = useState({});
    const [showColumnControls, setShowColumnControls] = useState(false);
    const [sorting, setSorting] = useState([{ id: 'fantasy_points_ppr', desc: true }]);

    // Update URL params when state changes
    useEffect(() => {
        const params = new URLSearchParams();
        params.set('season', selectedSeason);
        params.set('position', selectedPosition);
        params.set('threshold', threshold.toString());
        setSearchParams(params, { replace: true });
    }, [selectedSeason, selectedPosition, threshold, setSearchParams]);

    // Calculate limit based on position
    // Reduced limits to prevent backend timeouts (Railway has ~30s timeout)
    // Position filtering happens client-side, so we need enough data but not too much
    const limit = selectedPosition === 'ALL' ? 1000
        : selectedPosition === 'QB' ? 200
        : selectedPosition === 'RB' ? 400
        : selectedPosition === 'WR' ? 600
        : selectedPosition === 'TE' ? 300
        : 1000;

    // Determine NGS stat type
    const ngsStatType = selectedPosition === 'RB' ? 'rushing'
        : selectedPosition === 'QB' ? 'passing'
            : 'receiving';

    // Threshold metric based on position
    const thresholdMetric = selectedPosition === 'QB' ? { key: 'attempts', label: 'Pass Attempts', max: 300 }
        : selectedPosition === 'RB' ? { key: 'carries', label: 'Carries', max: 200 }
            : selectedPosition === 'WR' || selectedPosition === 'TE' ? { key: 'routes', label: 'Routes', max: 300 }
                : { key: 'fantasy_points_ppr', label: 'Fantasy Points', max: 200 };

    // Fetch data - position is in query key so changing it triggers fresh fetch
    const { data: queryResult, isLoading, error, refetch } = useQuery({
        queryKey: ['playerStats', selectedSeason, selectedPosition, limit, ngsStatType],
        queryFn: () => getPlayerStats([parseInt(selectedSeason)], limit, true, ngsStatType),
        staleTime: 5 * 60 * 1000,
    });

    const allData = queryResult?.data || [];

    // Filter by position and threshold
    const filteredData = useMemo(() => {
        let data = selectedPosition === 'ALL' ? allData : allData.filter(p => p.position === selectedPosition);

        if (threshold > 0) {
            const key = thresholdMetric.key;
            data = data.filter(p => (p[key] || 0) >= threshold);
        }

        return data;
    }, [allData, selectedPosition, threshold, thresholdMetric.key]);

    // Check if NextGen Stats are available
    const hasNextGenStats = useMemo(() => {
        if (allData.length === 0) return false;
        return Object.keys(allData[0] || {}).some(key => key.startsWith('ngs_'));
    }, [allData]);

    // Helper to get cell value with calculations
    const getCellValue = (player, columnId) => {
        // Direct fields
        if (columnId === 'player') return player.player_display_name || player.player || 'Unknown';
        if (columnId === 'team') return player.recent_team || player.team || player.team_abbr || '';
        if (columnId === 'position') return player.position || '';
        if (columnId === 'games') return player.games || 0;
        if (columnId === 'fantasy') return player.fantasy_points_ppr || 0;

        // Passing stats
        if (columnId === 'completions') return player.completions || 0;
        if (columnId === 'attempts') return player.attempts || 0;
        if (columnId === 'passing_yards') return player.passing_yards || 0;
        if (columnId === 'passing_tds') return player.passing_tds || 0;
        if (columnId === 'interceptions') return player.interceptions || 0;
        if (columnId === 'passing_cpoe') return player.passing_cpoe || 0;
        if (columnId === 'passing_epa') return player.passing_epa || 0;
        if (columnId === 'passing_air_yards') return player.passing_air_yards || 0;
        if (columnId === 'passing_first_downs') return player.passing_first_downs || 0;
        if (columnId === 'sacks') return player.sacks || 0;

        // Rushing stats
        if (columnId === 'carries') return player.carries || 0;
        if (columnId === 'rushing_yards') return player.rushing_yards || 0;
        if (columnId === 'rushing_tds') return player.rushing_tds || 0;
        if (columnId === 'rushing_first_downs') return player.rushing_first_downs || 0;
        if (columnId === 'rushing_fumbles') return player.rushing_fumbles || 0;
        if (columnId === 'rushing_epa') return player.rushing_epa || 0;

        // Receiving stats
        if (columnId === 'targets') return player.targets || 0;
        if (columnId === 'receptions') return player.receptions || 0;
        if (columnId === 'receiving_yards') return player.receiving_yards || 0;
        if (columnId === 'receiving_tds') return player.receiving_tds || 0;
        if (columnId === 'receiving_first_downs') return player.receiving_first_downs || 0;
        if (columnId === 'receiving_fumbles') return player.receiving_fumbles || 0;
        if (columnId === 'routes') return player.routes || 0;
        if (columnId === 'receiving_air_yards') return player.receiving_air_yards || 0;
        if (columnId === 'receiving_yards_after_catch') return player.receiving_yards_after_catch || 0;
        if (columnId === 'receiving_epa') return player.receiving_epa || 0;

        // Calculated fields - use backend values when available, otherwise calculate
        if (columnId === 'completion_percentage') return player.completion_pct ?? ((player.completions || 0) / (player.attempts || 1)) * 100;
        if (columnId === 'yards_per_attempt') return player.yards_per_attempt ?? ((player.passing_yards || 0) / (player.attempts || 1));
        if (columnId === 'yards_per_carry') return player.yards_per_carry ?? ((player.rushing_yards || 0) / (player.carries || 1));
        if (columnId === 'yards_per_reception') return player.yards_per_reception ?? ((player.receiving_yards || 0) / (player.receptions || 1));
        if (columnId === 'yards_per_target') return player.yards_per_target ?? ((player.receiving_yards || 0) / (player.targets || 1));
        if (columnId === 'yprr') return player.yprr ?? ((player.receiving_yards || 0) / (player.routes || 1));
        if (columnId === 'tprr') return player.tprr ?? ((player.targets || 0) / (player.routes || 1));
        if (columnId === 'adot') return player.adot ?? ((player.receiving_air_yards || 0) / (player.targets || 1));
        if (columnId === 'racr') return player.racr ?? ((player.receiving_air_yards || 0) > 0 ? (player.receiving_yards || 0) / (player.receiving_air_yards || 0) : 0);
        if (columnId === 'catch_percentage') return player.catch_percentage ?? ((player.receptions || 0) / (player.targets || 1)) * 100;

        // QB-specific calculations
        if (columnId === 'td_percentage') return player.td_percentage ?? ((player.passing_tds || 0) / (player.attempts || 1)) * 100;
        if (columnId === 'int_percentage') return player.int_percentage ?? ((player.interceptions || 0) / (player.attempts || 1)) * 100;
        if (columnId === 'sack_percentage') return player.sack_percentage ?? ((player.sacks || 0) / ((player.attempts || 0) + (player.sacks || 0))) * 100;
        if (columnId === 'air_yards_per_attempt') return player.air_yards_per_attempt ?? ((player.passing_air_yards || 0) / (player.attempts || 1));

        const dropbacks = (player.attempts || 0) + (player.sacks || 0);
        if (columnId === 'epa_per_dropback') return player.epa_per_dropback ?? ((player.passing_epa || 0) / (dropbacks || 1));
        if (columnId === 'fantasy_points_per_dropback') return player.fantasy_points_per_dropback ?? ((player.fantasy_points_ppr || 0) / (dropbacks || 1));

        // Advanced Receiving
        if (columnId === 'target_share') return player.target_share || 0;
        if (columnId === 'air_yards_share') return player.air_yards_share || 0;
        if (columnId === 'wopr') return player.wopr || 0;
        if (columnId === 'epa_per_route') return player.epa_per_route ?? ((player.receiving_epa || 0) / (player.routes || 1));
        if (columnId === 'epa_per_game') return player.epa_per_game ?? ((player.receiving_epa || 0) / (player.games || 1));

        // Per game stats
        const games = player.games || 1;
        if (columnId === 'fantasy_points_pg') return player.fantasy_points_pg ?? ((player.fantasy_points_ppr || 0) / games);
        if (columnId === 'targets_pg') return player.targets_pg ?? ((player.targets || 0) / games);
        if (columnId === 'receiving_yards_pg') return player.receiving_yards_pg ?? ((player.receiving_yards || 0) / games);
        if (columnId === 'passing_yards_pg') return player.passing_yards_pg ?? ((player.passing_yards || 0) / games);
        if (columnId === 'passing_tds_pg') return player.passing_tds_pg ?? ((player.passing_tds || 0) / games);
        if (columnId === 'rushing_yards_pg') return player.rushing_yards_pg ?? ((player.rushing_yards || 0) / games);

        // NextGen Stats
        if (columnId.startsWith('ngs_')) {
            return player[columnId] ?? null;
        }

        return player[columnId] || 0;
    };

    // Define all columns with comprehensive stats
    const columns = useMemo(() => {
        // Helper to create a formatted cell renderer
        const formattedCell = (columnId) => ({ getValue }) => {
            const value = getValue();
            return formatValue(value, columnId);
        };

        const baseColumns = [
            {
                id: 'player_display_name',
                header: 'Player',
                accessorFn: row => getCellValue(row, 'player'),
                size: 180,
                minSize: 150,
                cell: ({ row, getValue }) => {
                    const playerId = row.original.player_id || row.original.gsis_id;
                    const value = getValue();
                    return playerId ? (
                        <Link to={`/player/${playerId}`} style={{ color: '#228be6', textDecoration: 'none', fontWeight: 500 }}>
                            {value}
                        </Link>
                    ) : value;
                }
            },
            { id: 'recent_team', header: 'Team', accessorFn: row => getCellValue(row, 'team'), size: 60, minSize: 50 },
            { id: 'position', header: 'Pos', accessorFn: row => getCellValue(row, 'position'), size: 50, minSize: 45 },
            { id: 'games', header: 'G', accessorFn: row => getCellValue(row, 'games'), size: 50, minSize: 40, cell: formattedCell('games') },
            { id: 'fantasy_points_ppr', header: 'Fant', accessorFn: row => getCellValue(row, 'fantasy'), size: 70, minSize: 60, cell: formattedCell('fantasy_points_ppr') },
            { id: 'fantasy_points_pg', header: 'FP/G', accessorFn: row => getCellValue(row, 'fantasy_points_pg'), size: 70, minSize: 60, cell: formattedCell('fantasy_points_pg') },
        ];

        if (selectedPosition === 'QB') {
            return [
                ...baseColumns,
                // Passing Totals
                { id: 'completions', header: 'Comp', accessorFn: row => getCellValue(row, 'completions'), cell: formattedCell('completions') },
                { id: 'attempts', header: 'Att', accessorFn: row => getCellValue(row, 'attempts'), cell: formattedCell('attempts') },
                { id: 'passing_yards', header: 'Pass Yds', accessorFn: row => getCellValue(row, 'passing_yards'), cell: formattedCell('passing_yards') },
                { id: 'passing_tds', header: 'Pass TD', accessorFn: row => getCellValue(row, 'passing_tds'), cell: formattedCell('passing_tds') },
                { id: 'interceptions', header: 'Int', accessorFn: row => getCellValue(row, 'interceptions'), cell: formattedCell('interceptions') },
                { id: 'passing_first_downs', header: '1D', accessorFn: row => getCellValue(row, 'passing_first_downs'), cell: formattedCell('passing_first_downs') },
                { id: 'sacks', header: 'Sck', accessorFn: row => getCellValue(row, 'sacks'), cell: formattedCell('sacks') },
                { id: 'passing_air_yards', header: 'Air Yds', accessorFn: row => getCellValue(row, 'passing_air_yards'), cell: formattedCell('passing_air_yards') },
                // Passing Efficiency
                { id: 'completion_percentage', header: 'Cmp%', accessorFn: row => getCellValue(row, 'completion_percentage'), cell: formattedCell('completion_percentage') },
                { id: 'yards_per_attempt', header: 'Y/A', accessorFn: row => getCellValue(row, 'yards_per_attempt'), cell: formattedCell('yards_per_attempt') },
                { id: 'td_percentage', header: 'TD%', accessorFn: row => getCellValue(row, 'td_percentage'), cell: formattedCell('td_percentage') },
                { id: 'int_percentage', header: 'Int%', accessorFn: row => getCellValue(row, 'int_percentage'), cell: formattedCell('int_percentage') },
                { id: 'sack_percentage', header: 'Sck%', accessorFn: row => getCellValue(row, 'sack_percentage'), cell: formattedCell('sack_percentage') },
                { id: 'passing_epa', header: 'EPA', accessorFn: row => getCellValue(row, 'passing_epa'), cell: formattedCell('passing_epa') },
                { id: 'epa_per_dropback', header: 'EPA/DB', accessorFn: row => getCellValue(row, 'epa_per_dropback'), cell: formattedCell('epa_per_dropback') },
                { id: 'passing_cpoe', header: 'CPOE', accessorFn: row => getCellValue(row, 'passing_cpoe'), cell: formattedCell('passing_cpoe') },
                { id: 'fantasy_points_per_dropback', header: 'FP/DB', accessorFn: row => getCellValue(row, 'fantasy_points_per_dropback'), cell: formattedCell('fantasy_points_per_dropback') },
                { id: 'air_yards_per_attempt', header: 'AY/A', accessorFn: row => getCellValue(row, 'air_yards_per_attempt'), cell: formattedCell('air_yards_per_attempt') },
                // Rushing
                { id: 'carries', header: 'Rush Att', accessorFn: row => getCellValue(row, 'carries'), cell: formattedCell('carries') },
                { id: 'rushing_yards', header: 'Rush Yds', accessorFn: row => getCellValue(row, 'rushing_yards'), cell: formattedCell('rushing_yards') },
                { id: 'rushing_tds', header: 'Rush TD', accessorFn: row => getCellValue(row, 'rushing_tds'), cell: formattedCell('rushing_tds') },
                // Per Game
                { id: 'passing_yards_pg', header: 'Yds/G', accessorFn: row => getCellValue(row, 'passing_yards_pg'), cell: formattedCell('passing_yards_pg') },
                { id: 'passing_tds_pg', header: 'TD/G', accessorFn: row => getCellValue(row, 'passing_tds_pg'), cell: formattedCell('passing_tds_pg') },
            ];
        }

        if (selectedPosition === 'RB') {
            return [
                ...baseColumns,
                // Rushing Totals
                { id: 'carries', header: 'Att', accessorFn: row => getCellValue(row, 'carries'), cell: formattedCell('carries') },
                { id: 'rushing_yards', header: 'Rush Yds', accessorFn: row => getCellValue(row, 'rushing_yards'), cell: formattedCell('rushing_yards') },
                { id: 'rushing_tds', header: 'Rush TD', accessorFn: row => getCellValue(row, 'rushing_tds'), cell: formattedCell('rushing_tds') },
                { id: 'rushing_first_downs', header: '1D', accessorFn: row => getCellValue(row, 'rushing_first_downs'), cell: formattedCell('rushing_first_downs') },
                { id: 'rushing_fumbles', header: 'Fmb', accessorFn: row => getCellValue(row, 'rushing_fumbles'), cell: formattedCell('rushing_fumbles') },
                // Rushing Efficiency
                { id: 'yards_per_carry', header: 'Y/A', accessorFn: row => getCellValue(row, 'yards_per_carry'), cell: formattedCell('yards_per_carry') },
                { id: 'rushing_epa', header: 'EPA', accessorFn: row => getCellValue(row, 'rushing_epa'), cell: formattedCell('rushing_epa') },
                // Receiving
                { id: 'targets', header: 'Tgt', accessorFn: row => getCellValue(row, 'targets'), cell: formattedCell('targets') },
                { id: 'receptions', header: 'Rec', accessorFn: row => getCellValue(row, 'receptions'), cell: formattedCell('receptions') },
                { id: 'receiving_yards', header: 'Rec Yds', accessorFn: row => getCellValue(row, 'receiving_yards'), cell: formattedCell('receiving_yards') },
                { id: 'receiving_tds', header: 'Rec TD', accessorFn: row => getCellValue(row, 'receiving_tds'), cell: formattedCell('receiving_tds') },
                { id: 'yards_per_reception', header: 'Y/R', accessorFn: row => getCellValue(row, 'yards_per_reception'), cell: formattedCell('yards_per_reception') },
                // Advanced Receiving
                { id: 'target_share', header: 'Tgt Share', accessorFn: row => getCellValue(row, 'target_share'), cell: formattedCell('target_share') },
                { id: 'wopr', header: 'WOPR', accessorFn: row => getCellValue(row, 'wopr'), cell: formattedCell('wopr') },
                // Per Game
                { id: 'rushing_yards_pg', header: 'Rush/G', accessorFn: row => getCellValue(row, 'rushing_yards_pg'), cell: formattedCell('rushing_yards_pg') },
                { id: 'receiving_yards_pg', header: 'Rec/G', accessorFn: row => getCellValue(row, 'receiving_yards_pg'), cell: formattedCell('receiving_yards_pg') },
            ];
        }

        if (selectedPosition === 'WR' || selectedPosition === 'TE') {
            return [
                ...baseColumns,
                // Receiving Totals
                { id: 'targets', header: 'Tgt', accessorFn: row => getCellValue(row, 'targets'), size: 60, minSize: 50, cell: formattedCell('targets') },
                { id: 'receptions', header: 'Rec', accessorFn: row => getCellValue(row, 'receptions'), size: 60, minSize: 50, cell: formattedCell('receptions') },
                { id: 'receiving_yards', header: 'Yds', accessorFn: row => getCellValue(row, 'receiving_yards'), size: 80, minSize: 70, cell: formattedCell('receiving_yards') },
                { id: 'receiving_tds', header: 'TD', accessorFn: row => getCellValue(row, 'receiving_tds'), size: 50, minSize: 45, cell: formattedCell('receiving_tds') },
                { id: 'receiving_first_downs', header: '1st', accessorFn: row => getCellValue(row, 'receiving_first_downs'), size: 50, minSize: 45, cell: formattedCell('receiving_first_downs') },
                { id: 'receiving_fumbles', header: 'Fmb', accessorFn: row => getCellValue(row, 'receiving_fumbles'), size: 50, minSize: 45, cell: formattedCell('receiving_fumbles') },
                // Routes & Route-Based Metrics
                { id: 'routes', header: 'Rts', accessorFn: row => getCellValue(row, 'routes'), size: 60, minSize: 50, cell: formattedCell('routes') },
                { id: 'yprr', header: 'YPRR', accessorFn: row => getCellValue(row, 'yprr'), size: 70, minSize: 60, cell: formattedCell('yprr') },
                { id: 'tprr', header: 'TPRR', accessorFn: row => getCellValue(row, 'tprr'), size: 70, minSize: 60, cell: formattedCell('tprr') },
                // Receiving Efficiency
                { id: 'catch_percentage', header: 'Catch%', accessorFn: row => getCellValue(row, 'catch_percentage'), size: 75, minSize: 65, cell: formattedCell('catch_percentage') },
                { id: 'yards_per_reception', header: 'Y/R', accessorFn: row => getCellValue(row, 'yards_per_reception'), size: 65, minSize: 55, cell: formattedCell('yards_per_reception') },
                { id: 'yards_per_target', header: 'Y/Tgt', accessorFn: row => getCellValue(row, 'yards_per_target'), size: 70, minSize: 60, cell: formattedCell('yards_per_target') },
                // Advanced Receiving
                { id: 'receiving_air_yards', header: 'Air Yds', accessorFn: row => getCellValue(row, 'receiving_air_yards'), size: 80, minSize: 70, cell: formattedCell('receiving_air_yards') },
                { id: 'adot', header: 'aDOT', accessorFn: row => getCellValue(row, 'adot'), size: 70, minSize: 60, cell: formattedCell('adot') },
                { id: 'receiving_yards_after_catch', header: 'YAC', accessorFn: row => getCellValue(row, 'receiving_yards_after_catch'), size: 70, minSize: 60, cell: formattedCell('receiving_yards_after_catch') },
                { id: 'receiving_epa', header: 'EPA', accessorFn: row => getCellValue(row, 'receiving_epa'), size: 70, minSize: 60, cell: formattedCell('receiving_epa') },
                { id: 'epa_per_route', header: 'EPA/Rt', accessorFn: row => getCellValue(row, 'epa_per_route'), size: 80, minSize: 70, cell: formattedCell('epa_per_route') },
                { id: 'epa_per_game', header: 'EPA/G', accessorFn: row => getCellValue(row, 'epa_per_game'), size: 80, minSize: 70, cell: formattedCell('epa_per_game') },
                { id: 'racr', header: 'RACR', accessorFn: row => getCellValue(row, 'racr'), size: 70, minSize: 60, cell: formattedCell('racr') },
                { id: 'target_share', header: 'Tgt%', accessorFn: row => getCellValue(row, 'target_share'), size: 70, minSize: 60, cell: formattedCell('target_share') },
                { id: 'air_yards_share', header: 'Air%', accessorFn: row => getCellValue(row, 'air_yards_share'), size: 70, minSize: 60, cell: formattedCell('air_yards_share') },
                { id: 'wopr', header: 'WOPR', accessorFn: row => getCellValue(row, 'wopr'), size: 70, minSize: 60, cell: formattedCell('wopr') },
                // NextGen Stats (if available)
                ...(hasNextGenStats ? [
                    { id: 'ngs_avg_separation', header: 'Sep', accessorFn: row => getCellValue(row, 'ngs_avg_separation'), size: 65, minSize: 55, cell: formattedCell('ngs_avg_separation') },
                    { id: 'ngs_avg_cushion', header: 'Cush', accessorFn: row => getCellValue(row, 'ngs_avg_cushion'), size: 65, minSize: 55, cell: formattedCell('ngs_avg_cushion') },
                    { id: 'ngs_avg_intended_air_yards', header: 'iAir', accessorFn: row => getCellValue(row, 'ngs_avg_intended_air_yards'), size: 70, minSize: 60, cell: formattedCell('ngs_avg_intended_air_yards') },
                    { id: 'ngs_avg_yac_above_expectation', header: 'YAC+', accessorFn: row => getCellValue(row, 'ngs_avg_yac_above_expectation'), size: 70, minSize: 60, cell: formattedCell('ngs_avg_yac_above_expectation') },
                    { id: 'ngs_avg_yac', header: 'YAC', accessorFn: row => getCellValue(row, 'ngs_avg_yac'), size: 65, minSize: 55, cell: formattedCell('ngs_avg_yac') },
                    { id: 'ngs_percent_share_of_intended_air_yards', header: 'iAir%', accessorFn: row => getCellValue(row, 'ngs_percent_share_of_intended_air_yards'), size: 70, minSize: 60, cell: formattedCell('ngs_percent_share_of_intended_air_yards') },
                ] : []),
                // Per Game
                { id: 'receiving_yards_pg', header: 'Yds/G', accessorFn: row => getCellValue(row, 'receiving_yards_pg'), size: 75, minSize: 65, cell: formattedCell('receiving_yards_pg') },
                { id: 'targets_pg', header: 'Tgt/G', accessorFn: row => getCellValue(row, 'targets_pg'), size: 70, minSize: 60, cell: formattedCell('targets_pg') },
            ];
        }

        // Default for ALL
        return [...baseColumns];
    }, [selectedPosition, hasNextGenStats]);

    // Calculate column ranges for color coding
    const columnRanges = useMemo(() => {
        const ranges = {};
        columns.forEach(col => {
            if (['player_display_name', 'recent_team', 'position'].includes(col.id)) return;

            const values = filteredData
                .map(row => {
                    if (col.accessorFn) return col.accessorFn(row);
                    if (col.accessorKey) return row[col.accessorKey];
                    return null;
                })
                .filter(val => typeof val === 'number' && !isNaN(val));

            if (values.length > 0) {
                ranges[col.id] = { min: Math.min(...values), max: Math.max(...values) };
            }
        });
        return ranges;
    }, [filteredData, columns]);

    // Get background color for cells
    const getCellColor = (value, columnId) => {
        if (!columnRanges[columnId] || typeof value !== 'number') return undefined;
        const { min, max } = columnRanges[columnId];
        if (min === max) return undefined;

        const normalized = (value - min) / (max - min);
        const negativeStats = ['interceptions'];

        if (negativeStats.includes(columnId)) {
            return `rgba(239, 68, 68, ${normalized * 0.3 + 0.05})`;
        }
        return `rgba(34, 197, 94, ${normalized * 0.3 + 0.05})`;
    };

    // Format cell values with appropriate precision
    const formatValue = (value, columnId) => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'string') return value;

        // Integer columns (counting stats)
        const intCols = ['completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions',
            'carries', 'rushing_yards', 'rushing_tds', 'targets', 'receptions', 'receiving_yards',
            'receiving_tds', 'routes', 'games', 'passing_first_downs', 'rushing_first_downs',
            'receiving_first_downs', 'rushing_fumbles', 'receiving_fumbles', 'sacks',
            'passing_air_yards', 'receiving_air_yards', 'receiving_yards_after_catch', 'fantasy_points_ppr'];

        if (intCols.includes(columnId)) return Math.round(value).toLocaleString();

        // Share percentages (these come as decimals 0-1 and need *100)
        const sharePercentageCols = ['target_share', 'air_yards_share'];
        if (sharePercentageCols.includes(columnId)) {
            const percentValue = value < 1 ? value * 100 : value;
            return percentValue.toFixed(1) + '%';
        }

        // Regular percentage columns (already in 0-100 range)
        const percentageCols = ['completion_percentage', 'catch_percentage',
            'td_percentage', 'int_percentage', 'sack_percentage', 'ngs_percent_share_of_intended_air_yards'];
        if (percentageCols.includes(columnId)) {
            return value.toFixed(1) + '%';
        }
        if (columnId.includes('pct') || columnId.includes('percentage')) return value.toFixed(1) + '%';

        // WOPR and RACR are ratios, not percentages - display with 2 decimals
        if (columnId === 'wopr' || columnId === 'racr') return value.toFixed(2);

        // EPA and similar advanced metrics (2 decimals for precision)
        const epaColumns = ['passing_epa', 'rushing_epa', 'receiving_epa', 'epa_per_dropback',
            'epa_per_route', 'epa_per_game', 'passing_cpoe', 'fantasy_points_per_dropback',
            'ngs_avg_yac_above_expectation'];
        if (epaColumns.includes(columnId)) return value.toFixed(2);

        // YPRR - Yards Per Route Run (2 decimal places for precision)
        if (columnId === 'yprr') return value.toFixed(2);

        // TPRR - Targets Per Route Run (shown as percentage)
        if (columnId === 'tprr') return (value * 100).toFixed(1) + '%';

        // Rate stats (1 decimal for readability)
        const rateColumns = ['yards_per_attempt', 'yards_per_carry', 'yards_per_reception',
            'yards_per_target', 'adot',
            'passing_yards_pg', 'passing_tds_pg', 'rushing_yards_pg', 'receiving_yards_pg',
            'targets_pg', 'fantasy_points_pg'];
        if (rateColumns.includes(columnId)) return value.toFixed(1);

        // NextGen Stats (1 decimal for separation/cushion/air yards)
        if (columnId.startsWith('ngs_')) return value.toFixed(1);

        // Default: 1 decimal place
        return value.toFixed(1);
    };

    // Create table instance
    const table = useReactTable({
        data: filteredData,
        columns,
        state: { sorting, columnVisibility },
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    if (isLoading) {
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
                <Alert color="red" title="Error">
                    {error.message || 'Failed to load data'}
                    <Button onClick={() => refetch()} mt="md" size="sm">Retry</Button>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={2}>Player Stats</Title>
                    <Text c="dimmed" size="sm">{filteredData.length} of {allData.length} players</Text>
                </div>
                <Badge size="lg">{filteredData.length} Players</Badge>
            </Group>

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
                        Min {thresholdMetric.label}: {threshold}
                    </Text>
                    <Slider
                        value={threshold}
                        onChange={setThreshold}
                        min={0}
                        max={thresholdMetric.max}
                        marks={[
                            { value: 0, label: '0' },
                            { value: thresholdMetric.max, label: String(thresholdMetric.max) },
                        ]}
                    />
                </Box>
            </Paper>

            <Group justify="space-between" mb="md">
                <Button
                    variant="light"
                    size="sm"
                    onClick={() => setShowColumnControls(!showColumnControls)}
                >
                    {showColumnControls ? '▼' : '▶'} Columns
                </Button>
            </Group>

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
                                disabled={['player_display_name', 'recent_team', 'position'].includes(column.id)}
                                size="xs"
                            />
                        ))}
                    </Group>
                </Paper>
            </Collapse>

            <Paper shadow="sm" withBorder>
                <ScrollArea h={600}>
                    <Table striped highlightOnHover stickyHeader>
                        <Table.Thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <Table.Tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => {
                                        const columnId = header.column.id;
                                        const isNumeric = !['player_display_name', 'recent_team', 'position'].includes(columnId);
                                        const textAlign = isNumeric ? 'right' : 'left';

                                        return (
                                            <Table.Th
                                                key={header.id}
                                                onClick={header.column.getToggleSortingHandler()}
                                                style={{
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    textAlign: textAlign
                                                }}
                                            >
                                                <Group gap={4} wrap="nowrap" justify={isNumeric ? 'flex-end' : 'flex-start'}>
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
                            {table.getRowModel().rows.map(row => (
                                <Table.Tr key={row.id}>
                                    {row.getVisibleCells().map(cell => {
                                        const value = cell.getValue();
                                        const bgColor = getCellColor(value, cell.column.id);
                                        const columnId = cell.column.id;

                                        // Determine text alignment based on column type
                                        const isNumeric = !['player_display_name', 'recent_team', 'position'].includes(columnId);
                                        const textAlign = isNumeric ? 'right' : 'left';

                                        return (
                                            <Table.Td
                                                key={cell.id}
                                                style={{
                                                    whiteSpace: 'nowrap',
                                                    backgroundColor: bgColor,
                                                    textAlign: textAlign,
                                                    fontVariantNumeric: isNumeric ? 'tabular-nums' : 'normal'
                                                }}
                                            >
                                                {cell.column.columnDef.cell
                                                    ? flexRender(cell.column.columnDef.cell, cell.getContext())
                                                    : formatValue(value, cell.column.id)
                                                }
                                            </Table.Td>
                                        );
                                    })}
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>
            </Paper>
        </div>
    );
}

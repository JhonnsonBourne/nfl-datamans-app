/**
 * OPTIMIZED Player Stats Page
 * 
 * Performance improvements:
 * 1. Uses React Query for caching and background updates
 * 2. Debounced threshold slider
 * 3. Optimized column range calculations
 * 4. Memoized cell rendering
 * 5. Virtual scrolling ready (can add @tanstack/react-virtual)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPlayerStats, reportError } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';
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
import { notifications } from '@mantine/notifications';

export default function PlayerStatsOptimized() {
    const [selectedSeason, setSelectedSeason] = useState('2025');
    const [selectedPosition, setSelectedPosition] = useState('ALL');
    const [threshold, setThreshold] = useState(0);
    const debouncedThreshold = useDebounce(threshold, 300); // Debounce slider
    
    const [columnVisibility, setColumnVisibility] = useState({});
    const [showColumnControls, setShowColumnControls] = useState(false);
    const [sorting, setSorting] = useState([{ id: 'fantasy', desc: true }]);
    
    // Determine NGS stat type based on position
    const ngsStatType = useMemo(() => {
        if (selectedPosition === 'RB') return 'rushing';
        if (selectedPosition === 'QB') return 'passing';
        return 'receiving';
    }, [selectedPosition]);

    // Calculate optimal limit based on position
    // Reduced limits since we'll use backend filtering when possible
    const limit = useMemo(() => {
        if (selectedPosition === 'ALL') return 2000;
        if (selectedPosition === 'QB') return 200;
        if (selectedPosition === 'RB') return 400;
        if (selectedPosition === 'WR') return 600;
        if (selectedPosition === 'TE') return 300;
        return 1000;
    }, [selectedPosition]);

    // Use React Query for data fetching with caching
    const { data: queryResult, isLoading, error, refetch } = useQuery({
        queryKey: ['playerStats', selectedSeason, selectedPosition, limit, ngsStatType],
        queryFn: () => getPlayerStats([parseInt(selectedSeason)], limit, true, ngsStatType),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        refetchOnWindowFocus: false,
    });

    const allData = queryResult?.data || [];
    const loading = isLoading;

    // Helper to get threshold metric
    const getThresholdMetric = useCallback((position) => {
        switch (position) {
            case 'QB': return { key: 'attempts', label: 'Pass Attempts', max: 300 };
            case 'RB': return { key: 'carries', label: 'Carries', max: 200 };
            case 'WR':
            case 'TE': return { key: 'routes', label: 'Routes', max: 300 };
            default: return { key: 'fantasy_points_ppr', label: 'Fantasy Points', max: 200 };
        }
    }, []);

    const thresholdMetric = useMemo(() => getThresholdMetric(selectedPosition), [selectedPosition, getThresholdMetric]);

    // Filter data - OPTIMIZED: Only filter when debounced threshold changes
    const filteredData = useMemo(() => {
        let data = allData;
        
        // Position filtering (if not ALL)
        if (selectedPosition !== 'ALL') {
            data = data.filter(p => p.position === selectedPosition);
        }
        
        // Threshold filtering (debounced)
        if (debouncedThreshold > 0) {
            const key = thresholdMetric.key;
            data = data.filter(p => (p[key] || 0) >= debouncedThreshold);
        }
        
        return data;
    }, [allData, selectedPosition, debouncedThreshold, thresholdMetric.key]);

    // Check if NextGen Stats are available - OPTIMIZED: Only check once
    const hasNextGenStats = useMemo(() => {
        if (allData.length === 0) return false;
        // Check first player only (all should have same structure)
        return Object.keys(allData[0] || {}).some(key => key.startsWith('ngs_'));
    }, [allData]);

    // Get cell value - MEMOIZED
    const getCellValue = useCallback((player, columnId) => {
        // Direct fields
        if (columnId === 'player') return player.player_display_name || player.player || 'Unknown';
        if (columnId === 'team') return player.recent_team || player.team || player.team_abbr || '';
        if (columnId === 'position') return player.position || '';
        if (columnId === 'games') return player.games || 0;
        if (columnId === 'fantasy') return player.fantasy_points_ppr || 0;

        // Use backend-calculated values when available, fallback to calculation
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
        
        // Per game stats
        const games = player.games || 1;
        if (columnId === 'fantasy_points_pg') return player.fantasy_points_pg ?? ((player.fantasy_points_ppr || 0) / games);
        if (columnId === 'targets_pg') return player.targets_pg ?? ((player.targets || 0) / games);
        if (columnId === 'receptions_pg') return player.receptions_pg ?? ((player.receptions || 0) / games);
        if (columnId === 'receiving_yards_pg') return player.receiving_yards_pg ?? ((player.receiving_yards || 0) / games);

        // NextGen Stats
        if (columnId.startsWith('ngs_')) {
            return player[columnId] ?? null;
        }

        return player[columnId] || 0;
    }, []);

    // Format cell value - MEMOIZED
    const formatCellValue = useCallback((value, columnId) => {
        if (typeof value === 'string') return value;
        if (value === null || value === undefined) return '-';
        if (columnId === 'games') return value;

        const integerCols = ['completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions',
            'carries', 'rushing_yards', 'rushing_tds', 'targets', 'receptions', 'receiving_yards', 
            'receiving_tds', 'routes', 'games'];
        
        if (integerCols.includes(columnId)) {
            return Math.round(value).toLocaleString();
        }

        const percentageCols = ['completion_percentage', 'catch_percentage', 'target_share', 'air_yards_share'];
        if (percentageCols.includes(columnId)) {
            const displayValue = columnId === 'target_share' || columnId === 'air_yards_share' ? value * 100 : value;
            return displayValue.toFixed(2) + '%';
        }

        return value.toFixed(2);
    }, []);

    // Get cell color - OPTIMIZED: Uses pre-calculated ranges
    const getCellColor = useCallback((value, columnId, rangeData) => {
        if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) return '';
        if (!rangeData || rangeData.min === undefined || rangeData.max === undefined) return '';
        
        const { min, max } = rangeData;
        if (min === max) return '';

        const normalized = (value - min) / (max - min);
        const negativeStats = ['interceptions', 'sacks'];
        
        if (negativeStats.includes(columnId)) {
            return `rgba(239, 68, 68, ${normalized * 0.3 + 0.05})`;
        }
        return `rgba(34, 197, 94, ${normalized * 0.3 + 0.05})`;
    }, []);

    // Define columns - SIMPLIFIED for performance
    const getColumnsForPosition = useCallback((position) => {
        const baseColumns = [
            { id: 'player', header: 'Player', accessorFn: row => getCellValue(row, 'player'), size: 150 },
            { id: 'team', header: 'Team', accessorFn: row => getCellValue(row, 'team'), size: 60 },
            { id: 'position', header: 'Pos', accessorFn: row => getCellValue(row, 'position'), size: 50 },
            { id: 'games', header: 'G', accessorFn: row => getCellValue(row, 'games'), size: 40 },
            { id: 'fantasy', header: 'Fant', accessorFn: row => getCellValue(row, 'fantasy'), size: 60 },
            { id: 'fantasy_points_pg', header: 'FP/G', accessorFn: row => getCellValue(row, 'fantasy_points_pg'), size: 60 },
        ];

        if (position === 'QB') {
            return [...baseColumns,
                { id: 'attempts', header: 'Att', accessorFn: row => row.attempts || 0, size: 50 },
                { id: 'passing_yards', header: 'Yds', accessorFn: row => row.passing_yards || 0, size: 60 },
                { id: 'passing_tds', header: 'TD', accessorFn: row => row.passing_tds || 0, size: 40 },
                { id: 'completion_percentage', header: 'Cmp%', accessorFn: row => getCellValue(row, 'completion_percentage'), size: 60 },
                { id: 'passing_epa', header: 'EPA', accessorFn: row => row.passing_epa || 0, size: 60 },
            ];
        }

        if (position === 'RB') {
            return [...baseColumns,
                { id: 'carries', header: 'Att', accessorFn: row => row.carries || 0, size: 50 },
                { id: 'rushing_yards', header: 'Rush Yds', accessorFn: row => row.rushing_yards || 0, size: 70 },
                { id: 'rushing_tds', header: 'Rush TD', accessorFn: row => row.rushing_tds || 0, size: 60 },
                { id: 'yards_per_carry', header: 'Y/A', accessorFn: row => getCellValue(row, 'yards_per_carry'), size: 50 },
                { id: 'rushing_epa', header: 'Rush EPA', accessorFn: row => row.rushing_epa || 0, size: 65 },
                { id: 'targets', header: 'Tgt', accessorFn: row => row.targets || 0, size: 50 },
                { id: 'receptions', header: 'Rec', accessorFn: row => row.receptions || 0, size: 50 },
            ];
        }

        // WR/TE
        return [...baseColumns,
            { id: 'targets', header: 'Tgt', accessorFn: row => row.targets || 0, size: 50 },
            { id: 'receptions', header: 'Rec', accessorFn: row => row.receptions || 0, size: 50 },
            { id: 'receiving_yards', header: 'Yds', accessorFn: row => row.receiving_yards || 0, size: 60 },
            { id: 'receiving_tds', header: 'TD', accessorFn: row => row.receiving_tds || 0, size: 40 },
            { id: 'routes', header: 'Routes', accessorFn: row => row.routes || 0, size: 60 },
            { id: 'yprr', header: 'YPRR', accessorFn: row => getCellValue(row, 'yprr'), size: 55 },
            { id: 'receiving_epa', header: 'EPA', accessorFn: row => row.receiving_epa || 0, size: 55 },
        ];
    }, [getCellValue]);

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

    const { rows } = table.getRowModel();

    // OPTIMIZED: Column ranges calculation - only for visible columns, cached
    const columnRanges = useMemo(() => {
        const ranges = {};
        const visibleColumns = columns.filter(col => 
            columnVisibility[col.id] !== false && 
            !['player', 'team', 'position'].includes(col.id)
        );
        
        visibleColumns.forEach(col => {
            const values = filteredData
                .map(row => col.accessorFn(row))
                .filter(val => typeof val === 'number' && !isNaN(val));
            
            if (values.length > 0) {
                ranges[col.id] = {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            }
        });
        
        return ranges;
    }, [filteredData, columns, columnVisibility]);

    // Set default threshold on position change
    useEffect(() => {
        if (selectedPosition === 'QB') setThreshold(50);
        else if (selectedPosition === 'RB') setThreshold(30);
        else if (selectedPosition === 'WR' || selectedPosition === 'TE') setThreshold(50);
        else setThreshold(0);
        
        // Update sort
        let newSortKey = 'fantasy';
        if (selectedPosition === 'QB') newSortKey = 'passing_epa';
        else if (selectedPosition === 'RB') newSortKey = 'rushing_epa';
        else if (selectedPosition === 'WR' || selectedPosition === 'TE') newSortKey = 'receiving_epa';
        setSorting([{ id: newSortKey, desc: true }]);
    }, [selectedPosition]);

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
                    {error.message || 'Failed to load player stats'}
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
                    <Text c="dimmed" size="sm">
                        {filteredData.length} of {allData.length} players
                    </Text>
                </div>
                <Badge size="lg" variant="light">
                    {filteredData.length} Players
                </Badge>
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

                {hasNextGenStats && (
                    <Badge color="green" variant="light">✓ NextGen Stats loaded</Badge>
                )}
            </Paper>

            <Group justify="space-between" mb="md">
                <Group>
                    <Button 
                        variant="light" 
                        size="sm"
                        onClick={() => setShowColumnControls(!showColumnControls)}
                    >
                        {showColumnControls ? '▼' : '▶'} Columns
                    </Button>
                </Group>
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
                                disabled={['player', 'team', 'position'].includes(column.id)}
                                size="xs"
                            />
                        ))}
                    </Group>
                </Paper>
            </Collapse>

            <Paper shadow="sm" withBorder>
                <ScrollArea h={600} type="always">
                    <Table striped highlightOnHover stickyHeader>
                        <Table.Thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <Table.Tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <Table.Th
                                            key={header.id}
                                            onClick={header.column.getToggleSortingHandler()}
                                            style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
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
                                    ))}
                                </Table.Tr>
                            ))}
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.map(row => (
                                <Table.Tr key={row.id}>
                                    {row.getVisibleCells().map(cell => {
                                        const value = cell.getValue();
                                        const columnId = cell.column.id;
                                        const rangeData = columnRanges[columnId];
                                        const bgColor = rangeData ? getCellColor(value, columnId, rangeData) : undefined;
                                        const playerId = cell.row.original.player_id || cell.row.original.gsis_id;

                                        return (
                                            <Table.Td
                                                key={cell.id}
                                                style={{ whiteSpace: 'nowrap', backgroundColor: bgColor }}
                                            >
                                                {columnId === 'player' && playerId ? (
                                                    <Link 
                                                        to={`/player/${playerId}`}
                                                        style={{ color: '#228be6', textDecoration: 'none', fontWeight: 500 }}
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
        </div>
    );
}


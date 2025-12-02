import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
    Container, Title, Text, Group, Paper, Badge, Grid, Skeleton,
    Alert, Avatar, Tabs, Table, Progress, Stack, Anchor, Box,
    SimpleGrid, Card, ThemeIcon, Divider, Button, Tooltip, SegmentedControl,
    ActionIcon, ScrollArea
} from '@mantine/core';
import { IconChartLine, IconUsers, IconExternalLink, IconChevronRight, IconFlame, IconCalendar, IconHistory } from '@tabler/icons-react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
    ResponsiveContainer, Legend, Area, AreaChart, ComposedChart, Bar
} from 'recharts';
import { getPlayerProfile, getSimilarPlayers } from '../services/api';

// Calculate similarity between two players based on position-specific stats
const calculatePlayerSimilarity = (player1Stats, player2Stats, position, type = 'season') => {
    if (!player1Stats || !player2Stats) return 0;
    
    // Season stats
    const seasonStatsByPosition = {
        QB: ['passing_yards', 'passing_tds', 'interceptions', 'completions', 'attempts', 'rushing_yards', 'fantasy_points_ppr'],
        RB: ['rushing_yards', 'rushing_tds', 'receptions', 'receiving_yards', 'targets', 'carries', 'fantasy_points_ppr'],
        WR: ['targets', 'receptions', 'receiving_yards', 'receiving_tds', 'receiving_air_yards', 'fantasy_points_ppr'],
        TE: ['targets', 'receptions', 'receiving_yards', 'receiving_tds', 'fantasy_points_ppr'],
    };
    
    // Career stats for profile comparison
    const careerStatsByPosition = {
        QB: ['career_passing_yards', 'career_passing_tds', 'career_interceptions', 'career_rushing_yards', 'seasons_played', 'games_played'],
        RB: ['career_rushing_yards', 'career_rushing_tds', 'career_receptions', 'career_receiving_yards', 'seasons_played', 'games_played'],
        WR: ['career_receptions', 'career_receiving_yards', 'career_receiving_tds', 'seasons_played', 'games_played'],
        TE: ['career_receptions', 'career_receiving_yards', 'career_receiving_tds', 'seasons_played', 'games_played'],
    };
    
    const stats = type === 'career' 
        ? (careerStatsByPosition[position] || careerStatsByPosition.WR)
        : (seasonStatsByPosition[position] || seasonStatsByPosition.WR);
    
    let sumSquaredDiff = 0;
    let validStats = 0;
    
    stats.forEach(stat => {
        const val1 = player1Stats[stat] || 0;
        const val2 = player2Stats[stat] || 0;
        const max = Math.max(Math.abs(val1), Math.abs(val2), 1);
        const normalizedDiff = (val1 - val2) / max;
        sumSquaredDiff += normalizedDiff * normalizedDiff;
        validStats++;
    });
    
    if (validStats === 0) return 0;
    const distance = Math.sqrt(sumSquaredDiff / validStats);
    return Math.max(0, 100 - (distance * 50));
};

// Similar Player Card Component - supports both season and career display
function SimilarPlayerCard({ player, similarity, rank, type = 'season' }) {
    const positionColors = {
        QB: 'red', RB: 'blue', WR: 'green', TE: 'orange'
    };
    const color = positionColors[player.position] || 'gray';
    const isCareer = type === 'career';
    
    // Get display stats based on type
    const getStats = () => {
        if (isCareer) {
            if (player.position === 'QB') {
                return [
                    { label: 'Career Yds', value: (player.career_passing_yards || 0).toLocaleString() },
                    { label: 'Career TD', value: player.career_passing_tds || 0, color: 'green' },
                    { label: 'Seasons', value: player.seasons_played || 0 },
                ];
            } else if (player.position === 'RB') {
                return [
                    { label: 'Career Rush', value: (player.career_rushing_yards || 0).toLocaleString() },
                    { label: 'Career Rec', value: (player.career_receiving_yards || 0).toLocaleString() },
                    { label: 'Tot TD', value: (player.career_rushing_tds || 0) + (player.career_receiving_tds || 0), color: 'green' },
                ];
            } else {
                return [
                    { label: 'Career Yds', value: (player.career_receiving_yards || 0).toLocaleString() },
                    { label: 'Career Rec', value: player.career_receptions || 0 },
                    { label: 'Career TD', value: player.career_receiving_tds || 0, color: 'green' },
                ];
            }
        } else {
            if (player.position === 'QB') {
                return [
                    { label: 'Fantasy', value: player.fantasy_points_ppr?.toFixed(0) || 0, color: 'violet' },
                    { label: 'Pass Yds', value: player.passing_yards?.toLocaleString() || 0 },
                    { label: 'TD/INT', value: `${player.passing_tds || 0}/${player.interceptions || 0}` },
                ];
            } else if (player.position === 'RB') {
                return [
                    { label: 'Fantasy', value: player.fantasy_points_ppr?.toFixed(0) || 0, color: 'violet' },
                    { label: 'Rush', value: player.rushing_yards?.toLocaleString() || 0 },
                    { label: 'Rec', value: player.receiving_yards?.toLocaleString() || 0 },
                ];
            } else {
                return [
                    { label: 'Fantasy', value: player.fantasy_points_ppr?.toFixed(0) || 0, color: 'violet' },
                    { label: 'Rec Yds', value: player.receiving_yards?.toLocaleString() || 0 },
                    { label: 'Rec TD', value: player.receiving_tds || 0 },
                ];
            }
        }
    };
    
    const stats = getStats();
    
    return (
        <Card 
            component={Link} 
            to={`/player/${player.player_id}`}
            shadow="sm" 
            padding="md" 
            radius="md" 
            withBorder
            style={{ textDecoration: 'none', color: 'inherit' }}
        >
            <Group justify="space-between" mb="xs">
                <Badge size="lg" variant="light" color={
                    similarity >= 85 ? 'green' : 
                    similarity >= 70 ? 'teal' : 
                    similarity >= 55 ? 'yellow' : 'orange'
                }>
                    {similarity.toFixed(0)}% Match
                </Badge>
                <Text size="xs" c="dimmed">#{rank}</Text>
            </Group>
            <Group gap="sm" wrap="nowrap">
                <Avatar 
                    src={player.headshot_url || `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.espn_id || 0}.png&w=350&h=254`}
                    size={50}
                    radius="md"
                />
                <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={600} truncate>{player.player_display_name || player.player}</Text>
                    <Group gap="xs">
                        <Badge size="xs" color={color}>{player.position}</Badge>
                        <Text size="xs" c="dimmed">{player.recent_team || player.team}</Text>
                        {isCareer && player.seasons_played && (
                            <Text size="xs" c="dimmed">• {player.seasons_played} yrs</Text>
                        )}
                    </Group>
                </Box>
            </Group>
            <Divider my="sm" />
            <SimpleGrid cols={3} spacing="xs">
                {stats.map((stat, idx) => (
                    <Box key={idx} ta="center">
                        <Text size="xs" c="dimmed">{stat.label}</Text>
                        <Text size="sm" fw={idx === 0 ? 600 : 500} c={stat.color}>{stat.value}</Text>
                    </Box>
                ))}
            </SimpleGrid>
        </Card>
    );
}

// Team colors for styling
const TEAM_COLORS = {
    ARI: '#97233F', ATL: '#A71930', BAL: '#241773', BUF: '#00338D',
    CAR: '#0085CA', CHI: '#0B162A', CIN: '#FB4F14', CLE: '#311D00',
    DAL: '#003594', DEN: '#FB4F14', DET: '#0076B6', GB: '#203731',
    HOU: '#03202F', IND: '#002C5F', JAX: '#006778', KC: '#E31837',
    LAC: '#0080C6', LAR: '#003594', LV: '#000000', MIA: '#008E97',
    MIN: '#4F2683', NE: '#002244', NO: '#D3BC8D', NYG: '#0B2265',
    NYJ: '#125740', PHI: '#004C54', PIT: '#FFB612', SEA: '#002244',
    SF: '#AA0000', TB: '#D50A0A', TEN: '#0C2340', WAS: '#5A1414',
};

// Position colors
const POSITION_COLORS = {
    QB: 'red', RB: 'blue', WR: 'green', TE: 'orange',
    K: 'gray', DEF: 'dark', OL: 'cyan', DL: 'violet',
    LB: 'pink', DB: 'teal',
};

// Format stat value
const formatStat = (value, type = 'number') => {
    if (value === null || value === undefined) return '-';
    if (type === 'integer') return Math.round(value).toLocaleString();
    if (type === 'percent') return (value * 100).toFixed(1) + '%';
    if (type === 'decimal') return value.toFixed(2);
    return value.toLocaleString();
};

// Calculate age from birthdate
const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

// Stat card component
function StatCard({ label, value, subValue, color = 'blue' }) {
    return (
        <Card shadow="sm" padding="md" radius="md" withBorder>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>{label}</Text>
            <Text size="xl" fw={700} c={color}>{value}</Text>
            {subValue && <Text size="xs" c="dimmed">{subValue}</Text>}
        </Card>
    );
}

// Bio info row
function InfoRow({ label, value }) {
    if (!value) return null;
    return (
        <Group justify="space-between" py="xs" style={{ borderBottom: '1px solid #eee' }}>
            <Text size="sm" c="dimmed">{label}</Text>
            <Text size="sm" fw={500}>{value}</Text>
        </Group>
    );
}

// Performance Chart Component
function PerformanceChart({ data, position, metric }) {
    const chartData = useMemo(() => {
        return data.map(g => ({
            week: `Wk ${g.week}`,
            weekNum: g.week,
            yards: position === 'QB' ? g.passing_yards : position === 'RB' ? g.rushing_yards : g.receiving_yards,
            totalYards: position === 'RB' ? (g.rushing_yards || 0) + (g.receiving_yards || 0) : undefined,
            tds: position === 'QB' ? g.passing_tds : position === 'RB' ? (g.rushing_tds || 0) + (g.receiving_tds || 0) : g.receiving_tds,
            fantasy: g.fantasy_points_ppr || 0,
            epa: position === 'QB' ? g.passing_epa : position === 'RB' ? (g.rushing_epa || 0) + (g.receiving_epa || 0) : g.receiving_epa,
            result: g.result,
            opponent: g.opponent,
        })).sort((a, b) => a.weekNum - b.weekNum);
    }, [data, position]);

    const avgFantasy = chartData.length > 0 
        ? (chartData.reduce((s, d) => s + d.fantasy, 0) / chartData.length).toFixed(1) 
        : 0;

    return (
        <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 8 }}
                    formatter={(value, name) => [typeof value === 'number' ? value.toFixed(1) : value, name]}
                />
                <Legend />
                {metric === 'fantasy' && (
                    <>
                        <Bar yAxisId="left" dataKey="fantasy" name="Fantasy Pts" fill="#7c3aed" opacity={0.8} />
                        <Line yAxisId="left" type="monotone" dataKey="fantasy" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    </>
                )}
                {metric === 'yards' && (
                    <>
                        <Area yAxisId="left" type="monotone" dataKey="yards" name="Yards" fill="#3b82f6" fillOpacity={0.3} stroke="#3b82f6" strokeWidth={2} />
                        {position === 'RB' && (
                            <Line yAxisId="left" type="monotone" dataKey="totalYards" name="Total Yds" stroke="#10b981" strokeWidth={2} />
                        )}
                    </>
                )}
                {metric === 'epa' && (
                    <Area yAxisId="left" type="monotone" dataKey="epa" name="EPA" fill="#f59e0b" fillOpacity={0.3} stroke="#f59e0b" strokeWidth={2} />
                )}
            </ComposedChart>
        </ResponsiveContainer>
    );
}

// Game Log Section Component with Charts and Hot Links
function GameLogSection({ gameLogs, position, playerTeam, seasonTotals = {}, careerTotals = {} }) {
    const [selectedSeason, setSelectedSeason] = useState(null);
    const tableContainerRef = useRef(null);
    const [chartMetric, setChartMetric] = useState('fantasy');
    const [showChart, setShowChart] = useState(true);
    
    // Get unique seasons from game logs
    const seasons = [...new Set(gameLogs.map(g => g.season))].sort((a, b) => b - a);
    
    // Set default season to most recent
    useEffect(() => {
        if (seasons.length > 0 && !selectedSeason) {
            setSelectedSeason(seasons[0]);
        }
    }, [seasons, selectedSeason]);
    
    // Filter game logs by selected season
    const filteredLogs = gameLogs
        .filter(g => g.season === selectedSeason)
        .sort((a, b) => a.week - b.week);
    
    // Virtualization for game logs table
    const virtualizer = useVirtualizer({
        count: filteredLogs.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 50, // Estimated row height
        overscan: 5, // Render 5 extra rows above/below viewport
    });
    
    // Get season totals from backend (pre-calculated) or fallback to calculation
    const getSeasonTotals = useMemo(() => {
        const totals = seasonTotals[selectedSeason] || {};
        if (Object.keys(totals).length > 0) {
            // Use backend-calculated totals
            return totals;
        }
        // Fallback: calculate from filteredLogs (for backwards compatibility)
        if (filteredLogs.length === 0) return {};
        const len = filteredLogs.length;
        return {
            games: len,
            fantasy_points_ppr: filteredLogs.reduce((s, g) => s + (g.fantasy_points_ppr || 0), 0),
            passing_yards: filteredLogs.reduce((s, g) => s + (g.passing_yards || 0), 0),
            rushing_yards: filteredLogs.reduce((s, g) => s + (g.rushing_yards || 0), 0),
            receiving_yards: filteredLogs.reduce((s, g) => s + (g.receiving_yards || 0), 0),
            passing_epa: filteredLogs.reduce((s, g) => s + (g.passing_epa || 0), 0),
            rushing_epa: filteredLogs.reduce((s, g) => s + (g.rushing_epa || 0), 0),
            receiving_epa: filteredLogs.reduce((s, g) => s + (g.receiving_epa || 0), 0),
        };
    }, [selectedSeason, seasonTotals, filteredLogs]);
    
    // Calculate averages for display (use backend totals when available)
    const avgStats = useMemo(() => {
        const totals = getSeasonTotals;
        const games = totals.games || filteredLogs.length || 1;
        if (games === 0) return {};
        
        return {
            fantasy: (totals.fantasy_points_ppr || 0) / games,
            yards: position === 'QB' 
                ? (totals.passing_yards || 0) / games
                : position === 'RB'
                ? (totals.rushing_yards || 0) / games
                : (totals.receiving_yards || 0) / games,
            epa: (position === 'QB' ? (totals.passing_epa || 0) :
                  position === 'RB' ? (totals.rushing_epa || 0) + (totals.receiving_epa || 0) :
                  (totals.receiving_epa || 0)) / games,
        };
    }, [getSeasonTotals, filteredLogs.length, position]);
    
    if (gameLogs.length === 0) {
        return (
            <Paper shadow="sm" p="md" withBorder>
                <Text c="dimmed">No game logs available</Text>
            </Paper>
        );
    }
    
    return (
        <Stack gap="md">
            {/* Season Selector & Chart Toggle */}
            <Paper shadow="sm" p="md" withBorder>
                <Group justify="space-between" wrap="wrap">
                    <Group>
                        <Text fw={500}>Select Season:</Text>
                        <Group gap="xs">
                            {seasons.map(season => (
                                <Badge
                                    key={season}
                                    size="lg"
                                    variant={selectedSeason === season ? 'filled' : 'outline'}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedSeason(season)}
                                >
                                    {season}
                                </Badge>
                            ))}
                        </Group>
                    </Group>
                    <Group>
                        <Button 
                            size="xs" 
                            variant={showChart ? 'filled' : 'outline'}
                            leftSection={<IconChartLine size={14} />}
                            onClick={() => setShowChart(!showChart)}
                        >
                            {showChart ? 'Hide Chart' : 'Show Chart'}
                        </Button>
                    </Group>
                </Group>
            </Paper>

            {/* Performance Trend Chart */}
            {showChart && filteredLogs.length > 1 && (
                <Paper shadow="sm" p="md" withBorder>
                    <Group justify="space-between" mb="md">
                        <Group>
                            <ThemeIcon size="lg" variant="light" color="violet">
                                <IconChartLine size={20} />
                            </ThemeIcon>
                            <Title order={4}>Performance Trends</Title>
                        </Group>
                        <SegmentedControl
                            size="xs"
                            value={chartMetric}
                            onChange={setChartMetric}
                            data={[
                                { value: 'fantasy', label: 'Fantasy' },
                                { value: 'yards', label: 'Yards' },
                                { value: 'epa', label: 'EPA' },
                            ]}
                        />
                    </Group>
                    
                    {/* Averages */}
                    <SimpleGrid cols={3} mb="md">
                        <Card padding="xs" withBorder>
                            <Text size="xs" c="dimmed">Avg Fantasy/G</Text>
                            <Text size="lg" fw={700} c="violet">{avgStats.fantasy}</Text>
                        </Card>
                        <Card padding="xs" withBorder>
                            <Text size="xs" c="dimmed">Avg Yards/G</Text>
                            <Text size="lg" fw={700} c="blue">{avgStats.yards}</Text>
                        </Card>
                        <Card padding="xs" withBorder>
                            <Text size="xs" c="dimmed">Avg EPA/G</Text>
                            <Text size="lg" fw={700} c="orange">{avgStats.epa}</Text>
                        </Card>
                    </SimpleGrid>
                    
                    <PerformanceChart data={filteredLogs} position={position} metric={chartMetric} />
                </Paper>
            )}
            
            {/* Game Log Table */}
            <Paper shadow="sm" p="md" withBorder>
                <Title order={4} mb="md">
                    {selectedSeason} Game Log ({filteredLogs.length} games)
                </Title>
                
                <Box h={500} style={{ overflow: 'auto' }} ref={tableContainerRef}>
                    <Table striped highlightOnHover withTableBorder style={{ minWidth: 900 }}>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th style={{ position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 1 }}>Wk</Table.Th>
                                <Table.Th>Opp</Table.Th>
                                <Table.Th>Result</Table.Th>
                                {position === 'QB' && (
                                    <>
                                        <Table.Th>C/A</Table.Th>
                                        <Table.Th>Yds</Table.Th>
                                        <Table.Th>TD</Table.Th>
                                        <Table.Th>INT</Table.Th>
                                        <Table.Th>Cmp%</Table.Th>
                                        <Table.Th>RTG</Table.Th>
                                        <Table.Th>EPA</Table.Th>
                                        <Table.Th>Sck</Table.Th>
                                        <Table.Th>Rush</Table.Th>
                                        <Table.Th>R Yds</Table.Th>
                                        <Table.Th>R TD</Table.Th>
                                    </>
                                )}
                                {position === 'RB' && (
                                    <>
                                        <Table.Th>Att</Table.Th>
                                        <Table.Th>Yds</Table.Th>
                                        <Table.Th>Y/A</Table.Th>
                                        <Table.Th>TD</Table.Th>
                                        <Table.Th>EPA</Table.Th>
                                        <Table.Th>Tgt</Table.Th>
                                        <Table.Th>Rec</Table.Th>
                                        <Table.Th>R Yds</Table.Th>
                                        <Table.Th>R TD</Table.Th>
                                        <Table.Th>Tot Yds</Table.Th>
                                        <Table.Th>Tot TD</Table.Th>
                                        <Table.Th>Fmb</Table.Th>
                                    </>
                                )}
                                {(position === 'WR' || position === 'TE') && (
                                    <>
                                        <Table.Th>Tgt</Table.Th>
                                        <Table.Th>Rec</Table.Th>
                                        <Table.Th>Yds</Table.Th>
                                        <Table.Th>Y/R</Table.Th>
                                        <Table.Th>TD</Table.Th>
                                        <Table.Th>EPA</Table.Th>
                                        <Table.Th>Air Yds</Table.Th>
                                        <Table.Th>YAC</Table.Th>
                                        <Table.Th>1D</Table.Th>
                                        <Table.Th>Catch%</Table.Th>
                                    </>
                                )}
                                <Table.Th style={{ position: 'sticky', right: 0, backgroundColor: '#fff', zIndex: 1 }}>Fpts</Table.Th>
                                <Table.Th></Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                position: 'relative',
                            }}
                        >
                            {virtualizer.getVirtualItems().map(virtualRow => {
                                const game = filteredLogs[virtualRow.index];
                                const idx = virtualRow.index;
                                return (
                                    <Table.Tr
                                        key={idx}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                            cursor: game.game_id ? 'pointer' : 'default',
                                        }}
                                    >
                                    <Table.Td fw={500} style={{ position: 'sticky', left: 0, backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa', zIndex: 1 }}>
                                        {game.week}
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap={4} wrap="nowrap">
                                            <Text size="xs" c="dimmed">{game.is_home ? 'vs' : '@'}</Text>
                                            <Text fw={500}>{game.opponent || game.opponent_team || '-'}</Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        {game.result && (
                                            <Group gap={4} wrap="nowrap">
                                                <Badge 
                                                    size="xs" 
                                                    color={game.result === 'W' ? 'green' : game.result === 'L' ? 'red' : 'gray'}
                                                    variant="filled"
                                                >
                                                    {game.result}
                                                </Badge>
                                                <Text size="sm">
                                                    {game.team_score !== null && game.opp_score !== null 
                                                        ? `${game.team_score}-${game.opp_score}` 
                                                        : '-'}
                                                </Text>
                                            </Group>
                                        )}
                                    </Table.Td>
                                    {position === 'QB' && (
                                        <>
                                            <Table.Td>{game.completions || 0}/{game.attempts || 0}</Table.Td>
                                            <Table.Td fw={500}>{formatStat(game.passing_yards, 'integer')}</Table.Td>
                                            <Table.Td c={game.passing_tds > 0 ? 'green' : undefined} fw={500}>
                                                {game.passing_tds || 0}
                                            </Table.Td>
                                            <Table.Td c={game.interceptions > 0 ? 'red' : undefined}>
                                                {game.interceptions || 0}
                                            </Table.Td>
                                            <Table.Td>
                                                {game.attempts > 0 
                                                    ? ((game.completions / game.attempts) * 100).toFixed(1) + '%' 
                                                    : '-'}
                                            </Table.Td>
                                            <Table.Td>
                                                {game.attempts > 0 ? calculatePasserRating(game).toFixed(1) : '-'}
                                            </Table.Td>
                                            <Table.Td c={game.passing_epa > 0 ? 'green' : game.passing_epa < 0 ? 'red' : undefined}>
                                                {formatStat(game.passing_epa, 'decimal')}
                                            </Table.Td>
                                            <Table.Td>{game.sacks || 0}</Table.Td>
                                            <Table.Td>{game.carries || 0}</Table.Td>
                                            <Table.Td>{formatStat(game.rushing_yards, 'integer')}</Table.Td>
                                            <Table.Td c={game.rushing_tds > 0 ? 'green' : undefined}>
                                                {game.rushing_tds || 0}
                                            </Table.Td>
                                        </>
                                    )}
                                    {position === 'RB' && (
                                        <>
                                            <Table.Td>{game.carries || 0}</Table.Td>
                                            <Table.Td fw={500}>{formatStat(game.rushing_yards, 'integer')}</Table.Td>
                                            <Table.Td>
                                                {game.carries > 0 
                                                    ? (game.rushing_yards / game.carries).toFixed(1) 
                                                    : '-'}
                                            </Table.Td>
                                            <Table.Td c={game.rushing_tds > 0 ? 'green' : undefined} fw={500}>
                                                {game.rushing_tds || 0}
                                            </Table.Td>
                                            <Table.Td c={(game.rushing_epa || 0) > 0 ? 'green' : (game.rushing_epa || 0) < 0 ? 'red' : undefined}>
                                                {formatStat((game.rushing_epa || 0) + (game.receiving_epa || 0), 'decimal')}
                                            </Table.Td>
                                            <Table.Td>{game.targets || 0}</Table.Td>
                                            <Table.Td>{game.receptions || 0}</Table.Td>
                                            <Table.Td>{formatStat(game.receiving_yards, 'integer')}</Table.Td>
                                            <Table.Td c={game.receiving_tds > 0 ? 'green' : undefined}>
                                                {game.receiving_tds || 0}
                                            </Table.Td>
                                            <Table.Td fw={500} c="blue">
                                                {(game.rushing_yards || 0) + (game.receiving_yards || 0)}
                                            </Table.Td>
                                            <Table.Td c="green">
                                                {(game.rushing_tds || 0) + (game.receiving_tds || 0)}
                                            </Table.Td>
                                            <Table.Td c={game.rushing_fumbles > 0 ? 'red' : undefined}>
                                                {game.rushing_fumbles || 0}
                                            </Table.Td>
                                        </>
                                    )}
                                    {(position === 'WR' || position === 'TE') && (
                                        <>
                                            <Table.Td>{game.targets || 0}</Table.Td>
                                            <Table.Td>{game.receptions || 0}</Table.Td>
                                            <Table.Td fw={500}>{formatStat(game.receiving_yards, 'integer')}</Table.Td>
                                            <Table.Td>
                                                {game.receptions > 0 
                                                    ? (game.receiving_yards / game.receptions).toFixed(1) 
                                                    : '-'}
                                            </Table.Td>
                                            <Table.Td c={game.receiving_tds > 0 ? 'green' : undefined} fw={500}>
                                                {game.receiving_tds || 0}
                                            </Table.Td>
                                            <Table.Td c={(game.receiving_epa || 0) > 0 ? 'green' : (game.receiving_epa || 0) < 0 ? 'red' : undefined}>
                                                {formatStat(game.receiving_epa, 'decimal')}
                                            </Table.Td>
                                            <Table.Td>{formatStat(game.receiving_air_yards, 'integer')}</Table.Td>
                                            <Table.Td>{formatStat(game.receiving_yards_after_catch, 'integer')}</Table.Td>
                                            <Table.Td>{game.receiving_first_downs || 0}</Table.Td>
                                            <Table.Td>
                                                {game.targets > 0 
                                                    ? ((game.receptions / game.targets) * 100).toFixed(0) + '%'
                                                    : '-'}
                                            </Table.Td>
                                        </>
                                    )}
                                    <Table.Td fw={700} c="violet" style={{ position: 'sticky', right: 40, backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa', zIndex: 1 }}>
                                        {formatStat(game.fantasy_points_ppr, 'decimal')}
                                    </Table.Td>
                                    <Table.Td style={{ position: 'sticky', right: 0, backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa', zIndex: 1 }}>
                                        {game.game_id && (
                                            <Tooltip label="View Game Details">
                                                <ActionIcon 
                                                    component={Link} 
                                                    to={`/game/${game.game_id}`}
                                                    variant="subtle" 
                                                    color="blue"
                                                    size="sm"
                                                >
                                                    <IconExternalLink size={14} />
                                                </ActionIcon>
                                            </Tooltip>
                                        )}
                                    </Table.Td>
                                    </Table.Tr>
                                );
                            })}
                        </Table.Tbody>
                        {/* Season totals row */}
                        <Table.Tfoot>
                            <Table.Tr style={{ fontWeight: 600, backgroundColor: '#e9ecef' }}>
                                <Table.Td style={{ position: 'sticky', left: 0, backgroundColor: '#e9ecef', zIndex: 1 }}>Tot</Table.Td>
                                <Table.Td>{filteredLogs.length}G</Table.Td>
                                <Table.Td>
                                    {(() => {
                                        const totals = getSeasonTotals;
                                        const wins = totals.wins || filteredLogs.filter(g => g.result === 'W').length;
                                        const losses = totals.losses || filteredLogs.filter(g => g.result === 'L').length;
                                        const ties = totals.ties || filteredLogs.filter(g => g.result === 'T').length;
                                        return `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
                                    })()}
                                </Table.Td>
                                {position === 'QB' && (() => {
                                    const totals = getSeasonTotals;
                                    return (
                                        <>
                                            <Table.Td>{totals.completions || 0}/{totals.attempts || 0}</Table.Td>
                                            <Table.Td>{formatStat(totals.passing_yards || 0, 'integer')}</Table.Td>
                                            <Table.Td>{totals.passing_tds || 0}</Table.Td>
                                            <Table.Td>{totals.interceptions || 0}</Table.Td>
                                            <Table.Td>
                                                {totals.completion_pct !== undefined 
                                                    ? totals.completion_pct.toFixed(1) + '%'
                                                    : totals.attempts > 0 
                                                        ? ((totals.completions || 0) / totals.attempts * 100).toFixed(1) + '%' 
                                                        : '-'}
                                            </Table.Td>
                                            <Table.Td>-</Table.Td>
                                            <Table.Td>{formatStat(totals.passing_epa || 0, 'decimal')}</Table.Td>
                                            <Table.Td>{totals.sacks || 0}</Table.Td>
                                            <Table.Td>{totals.carries || 0}</Table.Td>
                                            <Table.Td>{formatStat(totals.rushing_yards || 0, 'integer')}</Table.Td>
                                            <Table.Td>{totals.rushing_tds || 0}</Table.Td>
                                        </>
                                    );
                                })()}
                                {position === 'RB' && (() => {
                                    const totals = getSeasonTotals;
                                    return (
                                        <>
                                            <Table.Td>{totals.carries || 0}</Table.Td>
                                            <Table.Td>{formatStat(totals.rushing_yards || 0, 'integer')}</Table.Td>
                                            <Table.Td>
                                                {totals.yards_per_carry !== undefined 
                                                    ? totals.yards_per_carry.toFixed(1)
                                                    : totals.carries > 0 
                                                        ? ((totals.rushing_yards || 0) / totals.carries).toFixed(1) 
                                                        : '-'}
                                            </Table.Td>
                                            <Table.Td>{totals.rushing_tds || 0}</Table.Td>
                                            <Table.Td>{formatStat((totals.rushing_epa || 0) + (totals.receiving_epa || 0), 'decimal')}</Table.Td>
                                            <Table.Td>{totals.targets || 0}</Table.Td>
                                            <Table.Td>{totals.receptions || 0}</Table.Td>
                                            <Table.Td>{formatStat(totals.receiving_yards || 0, 'integer')}</Table.Td>
                                            <Table.Td>{totals.receiving_tds || 0}</Table.Td>
                                            <Table.Td c="blue">{(totals.rushing_yards || 0) + (totals.receiving_yards || 0)}</Table.Td>
                                            <Table.Td c="green">{(totals.rushing_tds || 0) + (totals.receiving_tds || 0)}</Table.Td>
                                            <Table.Td>{totals.rushing_fumbles || 0}</Table.Td>
                                        </>
                                    );
                                })()}
                                {(position === 'WR' || position === 'TE') && (() => {
                                    const totals = getSeasonTotals;
                                    return (
                                        <>
                                            <Table.Td>{totals.targets || 0}</Table.Td>
                                            <Table.Td>{totals.receptions || 0}</Table.Td>
                                            <Table.Td>{formatStat(totals.receiving_yards || 0, 'integer')}</Table.Td>
                                            <Table.Td>
                                                {totals.yards_per_reception !== undefined 
                                                    ? totals.yards_per_reception.toFixed(1)
                                                    : totals.receptions > 0 
                                                        ? ((totals.receiving_yards || 0) / totals.receptions).toFixed(1) 
                                                        : '-'}
                                            </Table.Td>
                                            <Table.Td>{totals.receiving_tds || 0}</Table.Td>
                                            <Table.Td>{formatStat(totals.receiving_epa || 0, 'decimal')}</Table.Td>
                                            <Table.Td>{formatStat(totals.receiving_air_yards || 0, 'integer')}</Table.Td>
                                            <Table.Td>{formatStat(totals.receiving_yards_after_catch || 0, 'integer')}</Table.Td>
                                            <Table.Td>{totals.receiving_first_downs || 0}</Table.Td>
                                            <Table.Td>
                                                {totals.catch_percentage !== undefined 
                                                    ? totals.catch_percentage.toFixed(0) + '%'
                                                    : totals.targets > 0 
                                                        ? (((totals.receptions || 0) / totals.targets) * 100).toFixed(0) + '%' 
                                                        : '-'}
                                            </Table.Td>
                                        </>
                                    );
                                })()}
                                <Table.Td c="violet" style={{ position: 'sticky', right: 40, backgroundColor: '#e9ecef', zIndex: 1 }}>
                                    {formatStat(getSeasonTotals.fantasy_points_ppr || 0, 'decimal')}
                                </Table.Td>
                                <Table.Td style={{ position: 'sticky', right: 0, backgroundColor: '#e9ecef', zIndex: 1 }}></Table.Td>
                            </Table.Tr>
                        </Table.Tfoot>
                    </Table>
                </Box>
            </Paper>
        </Stack>
    );
}

// Calculate passer rating
function calculatePasserRating(game) {
    const cmp = game.completions || 0;
    const att = game.attempts || 0;
    const yds = game.passing_yards || 0;
    const tds = game.passing_tds || 0;
    const ints = game.interceptions || 0;
    
    if (att === 0) return 0;
    
    const a = Math.min(Math.max(((cmp / att) - 0.3) * 5, 0), 2.375);
    const b = Math.min(Math.max(((yds / att) - 3) * 0.25, 0), 2.375);
    const c = Math.min(Math.max((tds / att) * 20, 0), 2.375);
    const d = Math.min(Math.max(2.375 - ((ints / att) * 25), 0), 2.375);
    
    return ((a + b + c + d) / 6) * 100;
}

export default function PlayerProfile() {
    const { playerId } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [similarPlayers, setSimilarPlayers] = useState([]);
    const [careerSimilarPlayers, setCareerSimilarPlayers] = useState([]);
    const [loadingSimilar, setLoadingSimilar] = useState(false);
    const [similarityTab, setSimilarityTab] = useState('career');
    const navigate = useNavigate();

    // Load main profile (fast, doesn't wait for similar players)
    useEffect(() => {
        const loadProfile = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await getPlayerProfile(playerId);
                setProfile(data);
            } catch (err) {
                setError(err.message || 'Failed to load player profile');
            } finally {
                setLoading(false);
            }
        };

        if (playerId) {
            loadProfile();
        }
    }, [playerId]);

    // Load similar players separately (doesn't block main profile load)
    useEffect(() => {
        if (!profile || !playerId) return;
        
        const loadSimilarPlayers = async () => {
            const position = profile?.roster?.position || profile?.info?.position;
            if (!position || !['QB', 'RB', 'WR', 'TE'].includes(position)) {
                return;
            }

            try {
                setLoadingSimilar(true);
                // Load similar players from backend (optimized, runs in parallel)
                const [seasonSimilar, careerSimilar] = await Promise.all([
                    getSimilarPlayers(playerId, position, 'season', 3, 2025).catch(() => ({ data: [] })),
                    getSimilarPlayers(playerId, position, 'career', 3).catch(() => ({ data: [] }))
                ]);
                
                setSimilarPlayers(seasonSimilar.data || []);
                setCareerSimilarPlayers(careerSimilar.data || []);
            } catch (simErr) {
                console.log('Could not load similar players:', simErr);
            } finally {
                setLoadingSimilar(false);
            }
        };

        loadSimilarPlayers();
    }, [playerId, profile]);

    if (loading) {
        return (
            <Container size="lg" py="xl">
                <Skeleton height={200} mb="xl" />
                <Grid>
                    <Grid.Col span={4}><Skeleton height={300} /></Grid.Col>
                    <Grid.Col span={8}><Skeleton height={300} /></Grid.Col>
                </Grid>
            </Container>
        );
    }

    if (error) {
        return (
            <Container size="lg" py="xl">
                <Alert color="red" title="Error loading player">
                    {error}
                    <Anchor component={Link} to="/player-stats" ml="md">Back to Player Stats</Anchor>
                </Alert>
            </Container>
        );
    }

    // Extract player data from various sources
    const info = profile?.info || {};
    const roster = profile?.roster || {};
    const stats = profile?.stats || [];
    const gameLogs = profile?.game_logs || [];
    const seasonTotals = profile?.season_totals || {};
    const careerTotals = profile?.career_totals || {};

    // Get player details
    const playerName = info.display_name || info.name || info.full_name || roster.player_name || 'Unknown Player';
    const position = info.position || roster.position || '-';
    const team = roster.team || info.team_abbr || '-';
    const teamColor = TEAM_COLORS[team] || '#333';
    const positionColor = POSITION_COLORS[position] || 'gray';
    
    // Player photo - try multiple sources
    const photoUrl = info.headshot_url || info.headshot || info.espn_headshot || 
                     roster.headshot_url || roster.headshot ||
                     `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${info.espn_id}.png&w=350&h=254` ||
                     null;

    // Bio info
    const height = info.height || roster.height;
    const weight = info.weight || roster.weight;
    const age = calculateAge(info.birth_date || roster.birth_date);
    const college = info.college || roster.college;
    const draftInfo = info.draft_year ? `${info.draft_year} Round ${info.draft_round}, Pick ${info.draft_pick}` : null;
    const experience = info.years_exp || roster.years_exp;
    const jerseyNumber = info.jersey_number || roster.jersey_number;

    // Get current season stats
    const currentSeasonStats = stats.find(s => s.season === 2025) || stats.find(s => s.season === 2024) || {};
    const currentStats = currentSeasonStats.stats || currentSeasonStats;

    return (
        <Container size="lg" py="xl">
            {/* Header */}
            <Paper 
                shadow="md" 
                radius="lg" 
                p="xl" 
                mb="xl"
                style={{ 
                    background: `linear-gradient(135deg, ${teamColor}15 0%, white 100%)`,
                    borderLeft: `4px solid ${teamColor}`
                }}
            >
                <Group align="flex-start" gap="xl">
                    <Avatar 
                        src={photoUrl} 
                        alt={playerName}
                        size={150}
                        radius="md"
                        style={{ border: `3px solid ${teamColor}` }}
                    >
                        {playerName.split(' ').map(n => n[0]).join('')}
                    </Avatar>
                    
                    <Box style={{ flex: 1 }}>
                        <Group gap="md" mb="xs">
                            {jerseyNumber && (
                                <Text size="xl" fw={700} c={teamColor}>#{jerseyNumber}</Text>
                            )}
                            <Title order={1}>{playerName}</Title>
                        </Group>
                        
                        <Group gap="sm" mb="md" justify="space-between" wrap="wrap">
                            <Group gap="sm">
                                <Badge size="lg" color={positionColor} variant="filled">{position}</Badge>
                                <Badge size="lg" variant="outline" style={{ borderColor: teamColor, color: teamColor }}>
                                    {team}
                                </Badge>
                                {age && <Badge size="lg" variant="light">Age {age}</Badge>}
                                {experience !== null && experience !== undefined && (
                                    <Badge size="lg" variant="light">
                                        {experience === 0 ? 'Rookie' : `${experience} yr${experience > 1 ? 's' : ''}`}
                                    </Badge>
                                )}
                            </Group>
                            <Button 
                                component={Link}
                                to={`/comparison?player=${playerId}&position=${position}`}
                                leftSection={<IconUsers size={16} />}
                                variant="light"
                                color="blue"
                            >
                                Compare Player
                            </Button>
                        </Group>

                        <Group gap="xl">
                            {height && <Text size="sm"><strong>Height:</strong> {height}</Text>}
                            {weight && <Text size="sm"><strong>Weight:</strong> {weight} lbs</Text>}
                            {college && <Text size="sm"><strong>College:</strong> {college}</Text>}
                        </Group>
                    </Box>
                </Group>
            </Paper>

            {/* Quick Stats */}
            {currentStats && Object.keys(currentStats).length > 0 && (
                <SimpleGrid cols={{ base: 2, sm: 4, md: 6 }} mb="xl">
                    {position === 'QB' && (
                        <>
                            <StatCard label="Pass Yards" value={formatStat(currentStats.passing_yards, 'integer')} />
                            <StatCard label="Pass TD" value={formatStat(currentStats.passing_tds, 'integer')} color="green" />
                            <StatCard label="INT" value={formatStat(currentStats.interceptions, 'integer')} color="red" />
                            <StatCard label="Comp %" value={currentStats.attempts ? formatStat(currentStats.completions / currentStats.attempts, 'percent') : '-'} />
                            <StatCard label="Rush Yards" value={formatStat(currentStats.rushing_yards, 'integer')} />
                            <StatCard label="Fantasy" value={formatStat(currentStats.fantasy_points_ppr, 'decimal')} color="violet" />
                        </>
                    )}
                    {position === 'RB' && (
                        <>
                            <StatCard label="Rush Yards" value={formatStat(currentStats.rushing_yards, 'integer')} />
                            <StatCard label="Rush TD" value={formatStat(currentStats.rushing_tds, 'integer')} color="green" />
                            <StatCard label="Rec Yards" value={formatStat(currentStats.receiving_yards, 'integer')} />
                            <StatCard label="Rec TD" value={formatStat(currentStats.receiving_tds, 'integer')} color="green" />
                            <StatCard label="Touches" value={formatStat((currentStats.carries || 0) + (currentStats.receptions || 0), 'integer')} />
                            <StatCard label="Fantasy" value={formatStat(currentStats.fantasy_points_ppr, 'decimal')} color="violet" />
                        </>
                    )}
                    {(position === 'WR' || position === 'TE') && (
                        <>
                            <StatCard label="Targets" value={formatStat(currentStats.targets, 'integer')} />
                            <StatCard label="Receptions" value={formatStat(currentStats.receptions, 'integer')} />
                            <StatCard label="Rec Yards" value={formatStat(currentStats.receiving_yards, 'integer')} />
                            <StatCard label="Rec TD" value={formatStat(currentStats.receiving_tds, 'integer')} color="green" />
                            <StatCard label="Y/R" value={currentStats.receptions ? formatStat(currentStats.receiving_yards / currentStats.receptions, 'decimal') : '-'} />
                            <StatCard label="Fantasy" value={formatStat(currentStats.fantasy_points_ppr, 'decimal')} color="violet" />
                        </>
                    )}
                </SimpleGrid>
            )}

            {/* Similar Players Section - Like PlayerProfiler */}
            {(loadingSimilar || similarPlayers.length > 0 || careerSimilarPlayers.length > 0) && (
                <Paper shadow="sm" p="lg" mb="xl" withBorder radius="md">
                    <Group justify="space-between" mb="md">
                        <Group gap="xs">
                            <IconFlame size={20} color="#f59e0b" />
                            <Title order={4}>Most Similar Players</Title>
                            {loadingSimilar && <Text size="xs" c="dimmed">Loading...</Text>}
                        </Group>
                        <Group gap="sm">
                            <SegmentedControl
                                size="xs"
                                value={similarityTab}
                                onChange={setSimilarityTab}
                                data={[
                                    { value: 'career', label: '🏆 Career' },
                                    { value: 'season', label: '📅 2025 Season' },
                                ]}
                            />
                            <Button
                                component={Link}
                                to={`/comparison?player=${playerId}&position=${position}`}
                                variant="light"
                                size="xs"
                                rightSection={<IconChevronRight size={14} />}
                            >
                                Compare All
                            </Button>
                        </Group>
                    </Group>
                    
                    {similarityTab === 'career' ? (
                        <>
                            <Text size="sm" c="dimmed" mb="md">
                                Players with the most similar career profiles (yards, TDs, seasons played)
                            </Text>
                            {loadingSimilar ? (
                                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                    {[1, 2, 3].map(i => (
                                        <Skeleton key={i} height={120} radius="md" />
                                    ))}
                                </SimpleGrid>
                            ) : careerSimilarPlayers.length > 0 ? (
                                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                    {careerSimilarPlayers.map((player, idx) => (
                                        <SimilarPlayerCard
                                            key={player.player_id}
                                            player={player}
                                            similarity={player.similarity}
                                            rank={idx + 1}
                                            type="career"
                                        />
                                    ))}
                                </SimpleGrid>
                            ) : (
                                <Text c="dimmed" ta="center" py="md">Loading career comparisons...</Text>
                            )}
                        </>
                    ) : (
                        <>
                            <Text size="sm" c="dimmed" mb="md">
                                Players with the most similar 2025 season stats
                            </Text>
                            {loadingSimilar ? (
                                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                    {[1, 2, 3].map(i => (
                                        <Skeleton key={i} height={120} radius="md" />
                                    ))}
                                </SimpleGrid>
                            ) : similarPlayers.length > 0 ? (
                                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                    {similarPlayers.map((player, idx) => (
                                        <SimilarPlayerCard
                                            key={player.player_id}
                                            player={player}
                                            similarity={player.similarity}
                                            rank={idx + 1}
                                            type="season"
                                        />
                                    ))}
                                </SimpleGrid>
                            ) : (
                                <Text c="dimmed" ta="center" py="md">Loading season comparisons...</Text>
                            )}
                        </>
                    )}
                </Paper>
            )}

            {/* Tabs for detailed info */}
            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                    <Tabs.Tab value="overview">Overview</Tabs.Tab>
                    <Tabs.Tab value="stats">Season Stats</Tabs.Tab>
                    <Tabs.Tab value="gamelog">Game Log</Tabs.Tab>
                    <Tabs.Tab value="career">Career</Tabs.Tab>
                    <Tabs.Tab value="bio">Bio</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="overview" pt="md">
                    <Grid>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                            <Paper shadow="sm" p="md" withBorder>
                                <Title order={4} mb="md">Player Information</Title>
                                <InfoRow label="Full Name" value={playerName} />
                                <InfoRow label="Position" value={position} />
                                <InfoRow label="Team" value={team} />
                                <InfoRow label="Jersey Number" value={jerseyNumber} />
                                <InfoRow label="Height" value={height} />
                                <InfoRow label="Weight" value={weight ? `${weight} lbs` : null} />
                                <InfoRow label="Age" value={age} />
                                <InfoRow label="College" value={college} />
                                <InfoRow label="Experience" value={experience !== null ? `${experience} year${experience !== 1 ? 's' : ''}` : null} />
                                <InfoRow label="Draft" value={draftInfo} />
                            </Paper>
                        </Grid.Col>
                        
                        <Grid.Col span={{ base: 12, md: 6 }}>
                            <Paper shadow="sm" p="md" withBorder>
                                <Title order={4} mb="md">Current Season Summary</Title>
                                {currentSeasonStats.season && (
                                    <Badge mb="md" size="lg">{currentSeasonStats.season} Season</Badge>
                                )}
                                {currentStats.games && (
                                    <Text mb="md" c="dimmed">Games Played: {currentStats.games}</Text>
                                )}
                                
                                {/* Position-specific stats summary */}
                                <Stack gap="xs">
                                    {position === 'QB' && (
                                        <>
                                            <Group justify="space-between">
                                                <Text size="sm">Passing</Text>
                                                <Text size="sm" fw={500}>
                                                    {currentStats.completions || 0}/{currentStats.attempts || 0}, {currentStats.passing_yards || 0} yds, {currentStats.passing_tds || 0} TD, {currentStats.interceptions || 0} INT
                                                </Text>
                                            </Group>
                                            <Group justify="space-between">
                                                <Text size="sm">Rushing</Text>
                                                <Text size="sm" fw={500}>
                                                    {currentStats.carries || 0} att, {currentStats.rushing_yards || 0} yds, {currentStats.rushing_tds || 0} TD
                                                </Text>
                                            </Group>
                                        </>
                                    )}
                                    {position === 'RB' && (
                                        <>
                                            <Group justify="space-between">
                                                <Text size="sm">Rushing</Text>
                                                <Text size="sm" fw={500}>
                                                    {currentStats.carries || 0} att, {currentStats.rushing_yards || 0} yds, {currentStats.rushing_tds || 0} TD
                                                </Text>
                                            </Group>
                                            <Group justify="space-between">
                                                <Text size="sm">Receiving</Text>
                                                <Text size="sm" fw={500}>
                                                    {currentStats.receptions || 0}/{currentStats.targets || 0}, {currentStats.receiving_yards || 0} yds, {currentStats.receiving_tds || 0} TD
                                                </Text>
                                            </Group>
                                        </>
                                    )}
                                    {(position === 'WR' || position === 'TE') && (
                                        <Group justify="space-between">
                                            <Text size="sm">Receiving</Text>
                                            <Text size="sm" fw={500}>
                                                {currentStats.receptions || 0}/{currentStats.targets || 0}, {currentStats.receiving_yards || 0} yds, {currentStats.receiving_tds || 0} TD
                                            </Text>
                                        </Group>
                                    )}
                                    {currentStats.fantasy_points_ppr && (
                                        <Group justify="space-between">
                                            <Text size="sm">Fantasy Points (PPR)</Text>
                                            <Text size="sm" fw={500} c="violet">
                                                {formatStat(currentStats.fantasy_points_ppr, 'decimal')}
                                            </Text>
                                        </Group>
                                    )}
                                </Stack>
                            </Paper>
                        </Grid.Col>
                    </Grid>
                </Tabs.Panel>

                <Tabs.Panel value="stats" pt="md">
                    <Paper shadow="sm" p="md" withBorder>
                        <Title order={4} mb="md">Season-by-Season Stats</Title>
                        {stats.length === 0 ? (
                            <Text c="dimmed">No stats available</Text>
                        ) : (
                            <Table striped highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Season</Table.Th>
                                        <Table.Th>G</Table.Th>
                                        {position === 'QB' && (
                                            <>
                                                <Table.Th>Cmp/Att</Table.Th>
                                                <Table.Th>Pass Yds</Table.Th>
                                                <Table.Th>TD</Table.Th>
                                                <Table.Th>INT</Table.Th>
                                            </>
                                        )}
                                        {position === 'RB' && (
                                            <>
                                                <Table.Th>Rush Att</Table.Th>
                                                <Table.Th>Rush Yds</Table.Th>
                                                <Table.Th>Rush TD</Table.Th>
                                                <Table.Th>Rec</Table.Th>
                                                <Table.Th>Rec Yds</Table.Th>
                                            </>
                                        )}
                                        {(position === 'WR' || position === 'TE') && (
                                            <>
                                                <Table.Th>Tgt</Table.Th>
                                                <Table.Th>Rec</Table.Th>
                                                <Table.Th>Yds</Table.Th>
                                                <Table.Th>TD</Table.Th>
                                                <Table.Th>Y/R</Table.Th>
                                            </>
                                        )}
                                        <Table.Th>Fantasy</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {stats.map((seasonData, idx) => {
                                        const s = seasonData.stats || seasonData;
                                        return (
                                            <Table.Tr key={idx}>
                                                <Table.Td fw={500}>{seasonData.season || '-'}</Table.Td>
                                                <Table.Td>{seasonData.games || s.games || '-'}</Table.Td>
                                                {position === 'QB' && (
                                                    <>
                                                        <Table.Td>{s.completions || 0}/{s.attempts || 0}</Table.Td>
                                                        <Table.Td>{formatStat(s.passing_yards, 'integer')}</Table.Td>
                                                        <Table.Td>{s.passing_tds || 0}</Table.Td>
                                                        <Table.Td>{s.interceptions || 0}</Table.Td>
                                                    </>
                                                )}
                                                {position === 'RB' && (
                                                    <>
                                                        <Table.Td>{s.carries || 0}</Table.Td>
                                                        <Table.Td>{formatStat(s.rushing_yards, 'integer')}</Table.Td>
                                                        <Table.Td>{s.rushing_tds || 0}</Table.Td>
                                                        <Table.Td>{s.receptions || 0}</Table.Td>
                                                        <Table.Td>{formatStat(s.receiving_yards, 'integer')}</Table.Td>
                                                    </>
                                                )}
                                                {(position === 'WR' || position === 'TE') && (
                                                    <>
                                                        <Table.Td>{s.targets || 0}</Table.Td>
                                                        <Table.Td>{s.receptions || 0}</Table.Td>
                                                        <Table.Td>{formatStat(s.receiving_yards, 'integer')}</Table.Td>
                                                        <Table.Td>{s.receiving_tds || 0}</Table.Td>
                                                        <Table.Td>{s.receptions ? formatStat(s.receiving_yards / s.receptions, 'decimal') : '-'}</Table.Td>
                                                    </>
                                                )}
                                                <Table.Td fw={500} c="violet">{formatStat(s.fantasy_points_ppr, 'decimal')}</Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Paper>
                </Tabs.Panel>

                <Tabs.Panel value="gamelog" pt="md">
                    <GameLogSection gameLogs={gameLogs} position={position} seasonTotals={seasonTotals} careerTotals={careerTotals} />
                </Tabs.Panel>

                <Tabs.Panel value="career" pt="md">
                    <Paper shadow="sm" p="md" withBorder>
                        <Title order={4} mb="md">Career Totals</Title>
                        {Object.keys(careerTotals).length === 0 && stats.length === 0 ? (
                            <Text c="dimmed">No career stats available</Text>
                        ) : (
                            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
                                {position === 'QB' && (
                                    <>
                                        <StatCard 
                                            label="Career Pass Yards" 
                                            value={formatStat(careerTotals.passing_yards || stats.reduce((sum, s) => sum + (s.stats?.passing_yards || s.passing_yards || 0), 0), 'integer')} 
                                        />
                                        <StatCard 
                                            label="Career Pass TD" 
                                            value={formatStat(careerTotals.passing_tds || stats.reduce((sum, s) => sum + (s.stats?.passing_tds || s.passing_tds || 0), 0), 'integer')} 
                                            color="green"
                                        />
                                        <StatCard 
                                            label="Career INT" 
                                            value={formatStat(careerTotals.interceptions || stats.reduce((sum, s) => sum + (s.stats?.interceptions || s.interceptions || 0), 0), 'integer')} 
                                            color="red"
                                        />
                                        <StatCard 
                                            label="Games" 
                                            value={careerTotals.games || stats.reduce((sum, s) => sum + (s.games || s.stats?.games || 0), 0)} 
                                        />
                                        {careerTotals.completion_pct && (
                                            <StatCard 
                                                label="Career Comp%" 
                                                value={careerTotals.completion_pct.toFixed(1) + '%'} 
                                            />
                                        )}
                                        {careerTotals.yards_per_attempt && (
                                            <StatCard 
                                                label="Career Y/A" 
                                                value={careerTotals.yards_per_attempt.toFixed(2)} 
                                            />
                                        )}
                                    </>
                                )}
                                {position === 'RB' && (
                                    <>
                                        <StatCard 
                                            label="Career Rush Yards" 
                                            value={formatStat(careerTotals.rushing_yards || stats.reduce((sum, s) => sum + (s.stats?.rushing_yards || s.rushing_yards || 0), 0), 'integer')} 
                                        />
                                        <StatCard 
                                            label="Career Rush TD" 
                                            value={formatStat(careerTotals.rushing_tds || stats.reduce((sum, s) => sum + (s.stats?.rushing_tds || s.rushing_tds || 0), 0), 'integer')} 
                                            color="green"
                                        />
                                        <StatCard 
                                            label="Career Rec Yards" 
                                            value={formatStat(careerTotals.receiving_yards || stats.reduce((sum, s) => sum + (s.stats?.receiving_yards || s.receiving_yards || 0), 0), 'integer')} 
                                        />
                                        <StatCard 
                                            label="Games" 
                                            value={careerTotals.games || stats.reduce((sum, s) => sum + (s.games || s.stats?.games || 0), 0)} 
                                        />
                                        {careerTotals.yards_per_carry && (
                                            <StatCard 
                                                label="Career Y/A" 
                                                value={careerTotals.yards_per_carry.toFixed(2)} 
                                            />
                                        )}
                                    </>
                                )}
                                {(position === 'WR' || position === 'TE') && (
                                    <>
                                        <StatCard 
                                            label="Career Rec Yards" 
                                            value={formatStat(careerTotals.receiving_yards || stats.reduce((sum, s) => sum + (s.stats?.receiving_yards || s.receiving_yards || 0), 0), 'integer')} 
                                        />
                                        <StatCard 
                                            label="Career Receptions" 
                                            value={formatStat(careerTotals.receptions || stats.reduce((sum, s) => sum + (s.stats?.receptions || s.receptions || 0), 0), 'integer')} 
                                        />
                                        <StatCard 
                                            label="Career Rec TD" 
                                            value={formatStat(careerTotals.receiving_tds || stats.reduce((sum, s) => sum + (s.stats?.receiving_tds || s.receiving_tds || 0), 0), 'integer')} 
                                            color="green"
                                        />
                                        <StatCard 
                                            label="Games" 
                                            value={careerTotals.games || stats.reduce((sum, s) => sum + (s.games || s.stats?.games || 0), 0)} 
                                        />
                                        {careerTotals.catch_percentage && (
                                            <StatCard 
                                                label="Career Catch%" 
                                                value={careerTotals.catch_percentage.toFixed(1) + '%'} 
                                            />
                                        )}
                                        {careerTotals.yards_per_reception && (
                                            <StatCard 
                                                label="Career Y/Rec" 
                                                value={careerTotals.yards_per_reception.toFixed(2)} 
                                            />
                                        )}
                                    </>
                                )}
                            </SimpleGrid>
                        )}
                    </Paper>
                </Tabs.Panel>

                <Tabs.Panel value="bio" pt="md">
                    <Paper shadow="sm" p="md" withBorder>
                        <Title order={4} mb="md">Full Bio</Title>
                        <Grid>
                            <Grid.Col span={{ base: 12, md: 6 }}>
                                <Title order={5} mb="sm">Personal</Title>
                                <InfoRow label="Full Name" value={playerName} />
                                <InfoRow label="Birth Date" value={info.birth_date || roster.birth_date} />
                                <InfoRow label="Age" value={age} />
                                <InfoRow label="Height" value={height} />
                                <InfoRow label="Weight" value={weight ? `${weight} lbs` : null} />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, md: 6 }}>
                                <Title order={5} mb="sm">Career</Title>
                                <InfoRow label="Position" value={position} />
                                <InfoRow label="Current Team" value={team} />
                                <InfoRow label="Jersey Number" value={jerseyNumber} />
                                <InfoRow label="Experience" value={experience !== null ? `${experience} year${experience !== 1 ? 's' : ''}` : null} />
                                <InfoRow label="College" value={college} />
                                <InfoRow label="Draft" value={draftInfo} />
                                <InfoRow label="Draft Team" value={info.draft_club} />
                            </Grid.Col>
                        </Grid>
                        
                        {/* IDs for debugging/linking */}
                        <Divider my="lg" />
                        <Title order={5} mb="sm">Player IDs</Title>
                        <Group gap="md">
                            {info.gsis_id && <Badge variant="outline">GSIS: {info.gsis_id}</Badge>}
                            {info.espn_id && <Badge variant="outline">ESPN: {info.espn_id}</Badge>}
                            {info.yahoo_id && <Badge variant="outline">Yahoo: {info.yahoo_id}</Badge>}
                            {info.sleeper_id && <Badge variant="outline">Sleeper: {info.sleeper_id}</Badge>}
                        </Group>
                    </Paper>
                </Tabs.Panel>
            </Tabs>

            {/* Back link */}
            <Group mt="xl">
                <Anchor component={Link} to="/player-stats">← Back to Player Stats</Anchor>
            </Group>
        </Container>
    );
}


import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Container, Title, Text, Group, Paper, Badge, Grid, Select, Table,
    Stack, Box, Tabs, ThemeIcon, Skeleton, SimpleGrid, Card, Progress,
    ScrollArea, Tooltip, Avatar, SegmentedControl, ActionIcon
} from '@mantine/core';
import { IconShield, IconTrophy, IconChartBar, IconTarget, IconArrowUp, IconArrowDown, IconArrowsSort } from '@tabler/icons-react';
import { getTeamStats, getStrengthOfSchedule } from '../services/api';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
    ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell, ReferenceLine,
    Legend
} from 'recharts';

// Team colors and info
const TEAM_INFO = {
    ARI: { name: 'Cardinals', color: '#97233F', division: 'NFC West' },
    ATL: { name: 'Falcons', color: '#A71930', division: 'NFC South' },
    BAL: { name: 'Ravens', color: '#241773', division: 'AFC North' },
    BUF: { name: 'Bills', color: '#00338D', division: 'AFC East' },
    CAR: { name: 'Panthers', color: '#0085CA', division: 'NFC South' },
    CHI: { name: 'Bears', color: '#0B162A', division: 'NFC North' },
    CIN: { name: 'Bengals', color: '#FB4F14', division: 'AFC North' },
    CLE: { name: 'Browns', color: '#311D00', division: 'AFC North' },
    DAL: { name: 'Cowboys', color: '#003594', division: 'NFC East' },
    DEN: { name: 'Broncos', color: '#FB4F14', division: 'AFC West' },
    DET: { name: 'Lions', color: '#0076B6', division: 'NFC North' },
    GB: { name: 'Packers', color: '#203731', division: 'NFC North' },
    HOU: { name: 'Texans', color: '#03202F', division: 'AFC South' },
    IND: { name: 'Colts', color: '#002C5F', division: 'AFC South' },
    JAX: { name: 'Jaguars', color: '#006778', division: 'AFC South' },
    KC: { name: 'Chiefs', color: '#E31837', division: 'AFC West' },
    LAC: { name: 'Chargers', color: '#0080C6', division: 'AFC West' },
    LAR: { name: 'Rams', color: '#003594', division: 'NFC West' },
    LV: { name: 'Raiders', color: '#000000', division: 'AFC West' },
    MIA: { name: 'Dolphins', color: '#008E97', division: 'AFC East' },
    MIN: { name: 'Vikings', color: '#4F2683', division: 'NFC North' },
    NE: { name: 'Patriots', color: '#002244', division: 'AFC East' },
    NO: { name: 'Saints', color: '#D3BC8D', division: 'NFC South' },
    NYG: { name: 'Giants', color: '#0B2265', division: 'NFC East' },
    NYJ: { name: 'Jets', color: '#125740', division: 'AFC East' },
    PHI: { name: 'Eagles', color: '#004C54', division: 'NFC East' },
    PIT: { name: 'Steelers', color: '#FFB612', division: 'AFC North' },
    SEA: { name: 'Seahawks', color: '#002244', division: 'NFC West' },
    SF: { name: '49ers', color: '#AA0000', division: 'NFC West' },
    TB: { name: 'Buccaneers', color: '#D50A0A', division: 'NFC South' },
    TEN: { name: 'Titans', color: '#0C2340', division: 'AFC South' },
    WAS: { name: 'Commanders', color: '#5A1414', division: 'NFC East' },
};

// Team logo URL
const getTeamLogo = (abbr) => `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr?.toLowerCase()}.png`;

// Format EPA with color
const formatEPA = (value, invert = false) => {
    if (value === null || value === undefined || isNaN(value)) return { value: '-', color: 'gray' };
    const num = parseFloat(value);
    const isGood = invert ? num < 0 : num > 0;
    return {
        value: (num > 0 ? '+' : '') + num.toFixed(3),
        color: isGood ? 'green' : num < 0 ? 'red' : 'gray'
    };
};

// EPA Tier Badge
function EPATierBadge({ epa, type = 'offense' }) {
    const value = parseFloat(epa) || 0;
    const isDefense = type === 'defense';
    
    let tier, color;
    if (isDefense) {
        // For defense, negative is good (opponent gets less EPA)
        if (value <= -0.08) { tier = 'Elite'; color = 'green'; }
        else if (value <= -0.03) { tier = 'Good'; color = 'teal'; }
        else if (value <= 0.03) { tier = 'Average'; color = 'gray'; }
        else if (value <= 0.08) { tier = 'Poor'; color = 'orange'; }
        else { tier = 'Bad'; color = 'red'; }
    } else {
        // For offense, positive is good
        if (value >= 0.10) { tier = 'Elite'; color = 'green'; }
        else if (value >= 0.05) { tier = 'Good'; color = 'teal'; }
        else if (value >= -0.02) { tier = 'Average'; color = 'gray'; }
        else if (value >= -0.06) { tier = 'Poor'; color = 'orange'; }
        else { tier = 'Bad'; color = 'red'; }
    }
    
    return <Badge size="xs" color={color} variant="light">{tier}</Badge>;
}

// Team Row Component
function TeamRow({ team, rank }) {
    const info = TEAM_INFO[team.abbr] || { name: team.abbr, color: '#333' };
    const offEpa = formatEPA(team.offensive_epa_per_play);
    const defEpa = formatEPA(team.defensive_epa_per_play, true);
    const netEpa = formatEPA(team.net_epa_per_play);
    
    return (
        <Table.Tr>
            <Table.Td>
                <Text fw={600} size="sm">{rank}</Text>
            </Table.Td>
            <Table.Td>
                <Group gap="sm" wrap="nowrap">
                    <Avatar 
                        src={getTeamLogo(team.abbr)} 
                        size={28} 
                        radius="sm"
                    />
                    <Box>
                        <Text fw={600} size="sm">{info.name}</Text>
                        <Text size="xs" c="dimmed">{team.abbr}</Text>
                    </Box>
                </Group>
            </Table.Td>
            <Table.Td ta="center">
                <Text fw={500}>{team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''}</Text>
            </Table.Td>
            <Table.Td ta="right">
                <Group gap={4} justify="flex-end">
                    <Text c={offEpa.color} fw={500}>{offEpa.value}</Text>
                    <EPATierBadge epa={team.offensive_epa_per_play} type="offense" />
                </Group>
            </Table.Td>
            <Table.Td ta="right">
                <Text c={formatEPA(team.pass_offense_epa_per_play).color} size="sm">
                    {formatEPA(team.pass_offense_epa_per_play).value}
                </Text>
            </Table.Td>
            <Table.Td ta="right">
                <Text c={formatEPA(team.rush_offense_epa_per_play).color} size="sm">
                    {formatEPA(team.rush_offense_epa_per_play).value}
                </Text>
            </Table.Td>
            <Table.Td ta="right">
                <Group gap={4} justify="flex-end">
                    <Text c={defEpa.color} fw={500}>{defEpa.value}</Text>
                    <EPATierBadge epa={team.defensive_epa_per_play} type="defense" />
                </Group>
            </Table.Td>
            <Table.Td ta="right">
                <Text c={formatEPA(team.pass_defense_epa_per_play, true).color} size="sm">
                    {formatEPA(team.pass_defense_epa_per_play, true).value}
                </Text>
            </Table.Td>
            <Table.Td ta="right">
                <Text c={formatEPA(team.rush_defense_epa_per_play, true).color} size="sm">
                    {formatEPA(team.rush_defense_epa_per_play, true).value}
                </Text>
            </Table.Td>
            <Table.Td ta="right">
                <Text fw={600} c={netEpa.color}>{netEpa.value}</Text>
            </Table.Td>
            <Table.Td ta="right">
                <Text>{team.points_for}</Text>
            </Table.Td>
            <Table.Td ta="right">
                <Text>{team.points_against}</Text>
            </Table.Td>
            <Table.Td ta="right">
                <Text fw={500} c={team.point_diff > 0 ? 'green' : team.point_diff < 0 ? 'red' : 'gray'}>
                    {team.point_diff > 0 ? '+' : ''}{team.point_diff}
                </Text>
            </Table.Td>
        </Table.Tr>
    );
}

// Custom shape for team logos in scatter plot
const TeamLogoShape = ({ cx, cy, payload }) => {
    const logoSize = 32;
    const logoUrl = getTeamLogo(payload.abbr);
    
    return (
        <g>
            {/* White circle background for better visibility */}
            <circle
                cx={cx}
                cy={cy}
                r={logoSize / 2 + 2}
                fill="white"
                stroke={TEAM_INFO[payload.abbr]?.color || '#666'}
                strokeWidth={2}
            />
            {/* Team logo - most logos are already square/circular */}
            <image
                x={cx - logoSize / 2}
                y={cy - logoSize / 2}
                width={logoSize}
                height={logoSize}
                href={logoUrl}
                preserveAspectRatio="xMidYMid meet"
            />
        </g>
    );
};

// EPA Quadrant Chart
function EPAQuadrantChart({ teams }) {
    const chartData = teams.map(team => ({
        ...team,
        name: team.abbr,
        x: team.offensive_epa_per_play || 0,
        y: -(team.defensive_epa_per_play || 0), // Invert so up is good defense
        z: Math.abs(team.net_epa_per_play || 0) * 500 + 100,
    }));

    // Calculate axis domains based on data
    const xValues = chartData.map(d => d.x);
    const yValues = chartData.map(d => d.y);
    const xMin = Math.min(-0.15, Math.min(...xValues) - 0.02);
    const xMax = Math.max(0.15, Math.max(...xValues) + 0.02);
    const yMin = Math.min(-0.15, Math.min(...yValues) - 0.02);
    const yMax = Math.max(0.15, Math.max(...yValues) + 0.02);

    return (
        <ResponsiveContainer width="100%" height={450}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Offensive EPA" 
                    domain={[xMin, xMax]}
                    tickFormatter={(v) => v.toFixed(2)}
                    label={{ value: 'Offensive EPA/Play →', position: 'bottom', offset: 40 }}
                />
                <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Defensive EPA" 
                    domain={[yMin, yMax]}
                    tickFormatter={(v) => v.toFixed(2)}
                    label={{ value: '← Better Defense (lower opp EPA)', angle: -90, position: 'left', offset: 40 }}
                />
                <ZAxis type="number" dataKey="z" range={[100, 500]} />
                <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                <RechartsTooltip 
                    content={({ payload }) => {
                        if (!payload || !payload[0]) return null;
                        const team = payload[0].payload;
                        const info = TEAM_INFO[team.abbr] || {};
                        return (
                            <Paper p="xs" shadow="sm" withBorder style={{ background: 'white' }}>
                                <Group gap="xs" mb="xs">
                                    <Avatar src={getTeamLogo(team.abbr)} size={24} />
                                    <Text fw={600}>{info.name || team.abbr}</Text>
                                </Group>
                                <Text size="xs">Record: {team.wins}-{team.losses}</Text>
                                <Text size="xs">Off EPA: {team.offensive_epa_per_play?.toFixed(3)}</Text>
                                <Text size="xs">Def EPA: {team.defensive_epa_per_play?.toFixed(3)}</Text>
                                <Text size="xs">Net: {team.net_epa_per_play?.toFixed(3)}</Text>
                            </Paper>
                        );
                    }}
                />
                <Scatter data={chartData} shape={TeamLogoShape}>
                    {chartData.map((entry, index) => (
                        <Cell 
                            key={`cell-${index}`} 
                            fill={TEAM_INFO[entry.abbr]?.color || '#666'} 
                        />
                    ))}
                </Scatter>
            </ScatterChart>
        </ResponsiveContainer>
    );
}

// Stat Card
function StatCard({ title, value, subValue, icon: Icon, color = 'blue' }) {
    return (
        <Card shadow="sm" padding="md" radius="md" withBorder>
            <Group justify="space-between">
                <Box>
                    <Text size="xs" c="dimmed" tt="uppercase">{title}</Text>
                    <Text size="xl" fw={700} c={color}>{value}</Text>
                    {subValue && <Text size="xs" c="dimmed">{subValue}</Text>}
                </Box>
                <ThemeIcon size={40} radius="md" color={color} variant="light">
                    <Icon size={20} />
                </ThemeIcon>
            </Group>
        </Card>
    );
}

// Sortable header component
function SortableHeader({ children, sortKey, currentSort, currentDirection, onSort }) {
    const isActive = currentSort === sortKey;
    return (
        <Group gap={4} style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort(sortKey)}>
            {children}
            {isActive ? (
                currentDirection === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />
            ) : (
                <IconArrowsSort size={14} style={{ opacity: 0.3 }} />
            )}
        </Group>
    );
}

// Helper function to sort teams
function sortTeams(teams, sortKey, direction) {
    return [...teams].sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];
        
        // Handle null/undefined - treat as 0 or put at end
        if (aVal == null) aVal = direction === 'asc' ? Infinity : -Infinity;
        if (bVal == null) bVal = direction === 'asc' ? Infinity : -Infinity;
        
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return direction === 'asc' ? comparison : -comparison;
    });
}

export default function TeamStats() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState('2025');
    const [gameType, setGameType] = useState('REG');
    const [sortBy, setSortBy] = useState('net_epa_per_play');
    const [sortDirection, setSortDirection] = useState('desc');
    const [activeTab, setActiveTab] = useState('rankings');
    
    // Sorting state for each table
    const [defenseSortBy, setDefenseSortBy] = useState('defensive_epa_per_play');
    const [defenseSortDirection, setDefenseSortDirection] = useState('asc');
    const [offenseSortBy, setOffenseSortBy] = useState('offensive_epa_per_play');
    const [offenseSortDirection, setOffenseSortDirection] = useState('desc');
    
    // Strength of Schedule state
    const [sosData, setSosData] = useState([]);
    const [sosLoading, setSosLoading] = useState(false);
    const [sosSortBy, setSosSortBy] = useState('projected_sos');
    const [sosSortDirection, setSosSortDirection] = useState('desc');
    
    // Handle sorting for main table
    const handleSort = (key) => {
        if (sortBy === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(key);
            setSortDirection('desc');
        }
    };
    
    // Handle sorting for defense table
    const handleDefenseSort = (key) => {
        if (defenseSortBy === key) {
            setDefenseSortDirection(defenseSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setDefenseSortBy(key);
            setDefenseSortDirection('asc'); // Default to ascending for defense (lower is better)
        }
    };
    
    // Handle sorting for offense table
    const handleOffenseSort = (key) => {
        if (offenseSortBy === key) {
            setOffenseSortDirection(offenseSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setOffenseSortBy(key);
            setOffenseSortDirection('desc'); // Default to descending for offense (higher is better)
        }
    };
    
    // Get sorted teams for each table
    const sortedTeams = useMemo(() => sortTeams(teams, sortBy, sortDirection), [teams, sortBy, sortDirection]);
    const sortedDefenseTeams = useMemo(() => sortTeams(teams, defenseSortBy, defenseSortDirection), [teams, defenseSortBy, defenseSortDirection]);
    const sortedOffenseTeams = useMemo(() => sortTeams(teams, offenseSortBy, offenseSortDirection), [teams, offenseSortBy, offenseSortDirection]);

    useEffect(() => {
        loadData();
    }, [selectedSeason, gameType]);

    useEffect(() => {
        if (activeTab === 'sos') {
            loadSosData();
        }
    }, [selectedSeason, gameType, activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await getTeamStats(parseInt(selectedSeason), gameType);
            setTeams(result.data || []);
            
        } catch (err) {
            console.error('Failed to load team data:', err);
            setError(err.message || 'Failed to load team data');
        } finally {
            setLoading(false);
        }
    };

    const loadSosData = async () => {
        try {
            setSosLoading(true);
            const result = await getStrengthOfSchedule(parseInt(selectedSeason), gameType);
            setSosData(result.data || []);
        } catch (err) {
            console.error('Failed to load SOS data:', err);
        } finally {
            setSosLoading(false);
        }
    };

    const handleSosSort = (key) => {
        if (sosSortBy === key) {
            setSosSortDirection(sosSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSosSortBy(key);
            setSosSortDirection('desc');
        }
    };

    const sortedSosData = useMemo(() => sortTeams(sosData, sosSortBy, sosSortDirection), [sosData, sosSortBy, sosSortDirection]);


    // Calculate league stats
    const leagueStats = useMemo(() => {
        if (teams.length === 0) return {};
        const avgPPG = teams.reduce((s, t) => s + (t.ppg || 0), 0) / teams.length;
        const bestOff = [...teams].sort((a, b) => (b.offensive_epa_per_play || 0) - (a.offensive_epa_per_play || 0))[0];
        const bestDef = [...teams].sort((a, b) => (a.defensive_epa_per_play || 0) - (b.defensive_epa_per_play || 0))[0];
        return { avgPPG, bestOff, bestDef };
    }, [teams]);

    if (loading) {
        return (
            <Container size="xl" py="xl">
                <Skeleton height={50} mb="xl" />
                <SimpleGrid cols={4} mb="xl">
                    <Skeleton height={100} />
                    <Skeleton height={100} />
                    <Skeleton height={100} />
                    <Skeleton height={100} />
                </SimpleGrid>
                <Skeleton height={400} />
            </Container>
        );
    }

    if (error) {
        return (
            <Container size="xl" py="xl">
                <Paper p="xl" withBorder>
                    <Title order={3} c="red" mb="md">Error Loading Data</Title>
                    <Text>{error}</Text>
                    <Text size="sm" c="dimmed" mt="md">
                        {gameType === 'POST' && selectedSeason === '2025' 
                            ? 'Playoffs have not started for 2025 yet. Try Regular Season.'
                            : 'Try a different season or game type filter.'}
                    </Text>
                </Paper>
            </Container>
        );
    }

    return (
        <Container size="xl" py="xl">
            {/* Header */}
            <Group justify="space-between" mb="xl">
                <Box>
                    <Title order={1}>🛡️ NFL Power Ratings</Title>
                    <Text c="dimmed">Team rankings powered by EPA from play-by-play data</Text>
                </Box>
                <Group gap="sm">
                    <Select
                        value={selectedSeason}
                        onChange={setSelectedSeason}
                        data={['2025', '2024', '2023', '2022', '2021', '2020']}
                        w={100}
                        size="sm"
                    />
                    <SegmentedControl
                        value={gameType}
                        onChange={setGameType}
                        data={[
                            { value: 'REG', label: 'Regular Season' },
                            { value: 'POST', label: 'Playoffs' },
                            { value: 'ALL', label: 'All Games' },
                        ]}
                        size="sm"
                    />
                </Group>
            </Group>

            {/* Quick Stats */}
            <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
                <StatCard
                    title="Best Offense"
                    value={leagueStats.bestOff ? TEAM_INFO[leagueStats.bestOff.abbr]?.name || leagueStats.bestOff.abbr : '-'}
                    subValue={leagueStats.bestOff ? `${(leagueStats.bestOff.offensive_epa_per_play || 0).toFixed(3)} EPA/play` : ''}
                    icon={IconTarget}
                    color="green"
                />
                <StatCard
                    title="Best Defense"
                    value={leagueStats.bestDef ? TEAM_INFO[leagueStats.bestDef.abbr]?.name || leagueStats.bestDef.abbr : '-'}
                    subValue={leagueStats.bestDef ? `${(leagueStats.bestDef.defensive_epa_per_play || 0).toFixed(3)} EPA/play` : ''}
                    icon={IconShield}
                    color="blue"
                />
                <StatCard
                    title="League Avg PPG"
                    value={leagueStats.avgPPG?.toFixed(1) || '-'}
                    subValue="Points per game"
                    icon={IconChartBar}
                    color="violet"
                />
                <StatCard
                    title="Teams"
                    value={teams.length}
                    subValue={`${selectedSeason} ${gameType === 'REG' ? 'Regular' : gameType === 'POST' ? 'Playoffs' : 'All Games'}`}
                    icon={IconTrophy}
                    color="orange"
                />
            </SimpleGrid>

            {/* Tabs */}
            <Tabs value={activeTab} onChange={setActiveTab} mb="lg">
                <Tabs.List>
                    <Tabs.Tab value="rankings">Power Rankings</Tabs.Tab>
                    <Tabs.Tab value="epa-tiers">EPA Tiers</Tabs.Tab>
                    <Tabs.Tab value="offense">Offensive Stats</Tabs.Tab>
                    <Tabs.Tab value="defense">Defensive Stats</Tabs.Tab>
                    <Tabs.Tab value="sos">Strength of Schedule</Tabs.Tab>
                </Tabs.List>
            </Tabs>

            {activeTab === 'rankings' && (
                <Paper shadow="sm" p="lg" radius="md" withBorder>
                    <Group justify="space-between" mb="md">
                        <Title order={4}>Team Rankings by EPA</Title>
                        <Select
                            value={sortBy}
                            onChange={setSortBy}
                            data={[
                                { value: 'net_epa_per_play', label: 'Net EPA' },
                                { value: 'offensive_epa_per_play', label: 'Offensive EPA' },
                                { value: 'defensive_epa_per_play', label: 'Defensive EPA' },
                                { value: 'wins', label: 'Wins' },
                                { value: 'point_diff', label: 'Point Differential' },
                            ]}
                            w={180}
                            size="sm"
                        />
                    </Group>
                    
                    <ScrollArea>
                        <Table striped highlightOnHover withTableBorder>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th w={50}>#</Table.Th>
                                    <Table.Th>Team</Table.Th>
                                    <Table.Th ta="center">Record</Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="offensive_epa_per_play" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            Off EPA
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="pass_offense_epa_per_play" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            Pass
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="rush_offense_epa_per_play" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            Rush
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="defensive_epa_per_play" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            Def EPA
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="pass_defense_epa_per_play" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            Pass
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="rush_defense_epa_per_play" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            Rush
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="net_epa_per_play" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            Net
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="points_for" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            PF
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="points_against" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            PA
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="point_diff" currentSort={sortBy} currentDirection={sortDirection} onSort={handleSort}>
                                            +/-
                                        </SortableHeader>
                                    </Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {sortedTeams.map((team, idx) => (
                                    <TeamRow key={team.abbr} team={team} rank={idx + 1} />
                                ))}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                </Paper>
            )}

            {activeTab === 'epa-tiers' && (
                <Stack gap="lg">
                    <Paper shadow="sm" p="lg" radius="md" withBorder>
                        <Title order={4} mb="sm">EPA Quadrant Chart</Title>
                        <Text size="sm" c="dimmed" mb="md">
                            Teams in the <strong>top-right</strong> have elite offense AND defense. 
                            X-axis = Offensive EPA/play (right is better), Y-axis = Defensive EPA (up is better defense).
                        </Text>
                        <EPAQuadrantChart teams={sortedTeams} />
                        <SimpleGrid cols={4} mt="md">
                            <Box ta="center" p="sm" bg="green.0" style={{ borderRadius: 8 }}>
                                <Text size="xs" fw={600}>🏆 Top Right</Text>
                                <Text size="xs" c="dimmed">Elite Teams</Text>
                            </Box>
                            <Box ta="center" p="sm" bg="blue.0" style={{ borderRadius: 8 }}>
                                <Text size="xs" fw={600}>🛡️ Top Left</Text>
                                <Text size="xs" c="dimmed">Defensive Teams</Text>
                            </Box>
                            <Box ta="center" p="sm" bg="orange.0" style={{ borderRadius: 8 }}>
                                <Text size="xs" fw={600}>🎯 Bottom Right</Text>
                                <Text size="xs" c="dimmed">Offensive Teams</Text>
                            </Box>
                            <Box ta="center" p="sm" bg="red.0" style={{ borderRadius: 8 }}>
                                <Text size="xs" fw={600}>📉 Bottom Left</Text>
                                <Text size="xs" c="dimmed">Struggling Teams</Text>
                            </Box>
                        </SimpleGrid>
                    </Paper>

                    {/* EPA Tier Lists */}
                    <Grid>
                        <Grid.Col span={6}>
                            <Paper shadow="sm" p="lg" radius="md" withBorder>
                                <Title order={4} mb="md" c="green">🎯 Offensive EPA Tiers</Title>
                                <Stack gap="xs">
                                    {[...teams].sort((a, b) => (b.offensive_epa_per_play || 0) - (a.offensive_epa_per_play || 0)).map((team, idx) => (
                                        <Group key={team.abbr} justify="space-between" p="xs" bg={idx < 5 ? 'green.0' : idx < 12 ? 'blue.0' : idx < 22 ? 'gray.0' : 'red.0'} style={{ borderRadius: 6 }}>
                                            <Group gap="sm">
                                                <Text size="sm" fw={500} w={24}>{idx + 1}</Text>
                                                <Avatar src={getTeamLogo(team.abbr)} size={24} />
                                                <Text size="sm" fw={500}>{TEAM_INFO[team.abbr]?.name || team.abbr}</Text>
                                            </Group>
                                            <Text size="sm" fw={600} c={(team.offensive_epa_per_play || 0) > 0 ? 'green' : 'red'}>
                                                {(team.offensive_epa_per_play || 0) > 0 ? '+' : ''}{(team.offensive_epa_per_play || 0).toFixed(3)}
                                            </Text>
                                        </Group>
                                    ))}
                                </Stack>
                            </Paper>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Paper shadow="sm" p="lg" radius="md" withBorder>
                                <Title order={4} mb="md" c="blue">🛡️ Defensive EPA Tiers</Title>
                                <Stack gap="xs">
                                    {[...teams].sort((a, b) => (a.defensive_epa_per_play || 0) - (b.defensive_epa_per_play || 0)).map((team, idx) => (
                                        <Group key={team.abbr} justify="space-between" p="xs" bg={idx < 5 ? 'green.0' : idx < 12 ? 'blue.0' : idx < 22 ? 'gray.0' : 'red.0'} style={{ borderRadius: 6 }}>
                                            <Group gap="sm">
                                                <Text size="sm" fw={500} w={24}>{idx + 1}</Text>
                                                <Avatar src={getTeamLogo(team.abbr)} size={24} />
                                                <Text size="sm" fw={500}>{TEAM_INFO[team.abbr]?.name || team.abbr}</Text>
                                            </Group>
                                            <Text size="sm" fw={600} c={(team.defensive_epa_per_play || 0) < 0 ? 'green' : 'red'}>
                                                {(team.defensive_epa_per_play || 0) > 0 ? '+' : ''}{(team.defensive_epa_per_play || 0).toFixed(3)}
                                            </Text>
                                        </Group>
                                    ))}
                                </Stack>
                            </Paper>
                        </Grid.Col>
                    </Grid>
                </Stack>
            )}

            {activeTab === 'offense' && (
                <Paper shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={4} mb="md">Offensive Statistics</Title>
                    <Text size="sm" c="dimmed" mb="md">
                        Comprehensive offensive statistics from play-by-play data. 
                        Stats similar to <a href="https://sumersports.com/teams/offensive/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-blue-6)' }}>Sumer Sports</a>.
                        <Text size="xs" c="dimmed" mt="xs" style={{ display: 'block' }}>
                            💡 Scroll horizontally to see all columns
                        </Text>
                    </Text>
                    <Box style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                        <Table striped highlightOnHover withTableBorder style={{ minWidth: 2000 }}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th style={{ position: 'sticky', left: 0, background: 'white', zIndex: 10, minWidth: 40 }}>#</Table.Th>
                                    <Table.Th style={{ position: 'sticky', left: 40, background: 'white', zIndex: 10, minWidth: 160 }}>Team</Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="offensive_epa_per_play" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="EPA per Play"><Text size="xs">EPA/Play</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_total_epa" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total EPA"><Text size="xs">Total EPA</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_success_pct" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Success Rate (% of plays with EPA > 0)"><Text size="xs">Success%</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="pass_offense_epa_per_play" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="EPA per Pass Play"><Text size="xs">EPA/Pass</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="rush_offense_epa_per_play" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="EPA per Rush Play"><Text size="xs">EPA/Rush</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="passing_yards" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total Passing Yards"><Text size="xs">Pass Yds</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_comp_pct" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Completion %"><Text size="xs">Comp%</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="passing_tds" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Passing TDs"><Text size="xs">Pass TD</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="rushing_yards" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total Rushing Yards"><Text size="xs">Rush Yds</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="rushing_tds" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Rushing TDs"><Text size="xs">Rush TD</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_adot" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Average Depth of Target"><Text size="xs">ADoT</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_sack_pct" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Sack Rate (Sacks / Dropbacks)"><Text size="xs">Sack%</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_scramble_pct" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Scramble Rate"><Text size="xs">Scrm%</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_int_pct" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Interception Rate"><Text size="xs">INT%</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="receiving_yards" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total Receiving Yards"><Text size="xs">Rec Yds</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="receptions" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total Receptions"><Text size="xs">Rec</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="targets" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total Targets"><Text size="xs">Tgt</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="receiving_tds" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Receiving TDs"><Text size="xs">Rec TD</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="carries" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total Carries"><Text size="xs">Carries</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_total_yards" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total Yards (Pass + Rush)"><Text size="xs">Tot Yds</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_total_tds" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total TDs"><Text size="xs">Tot TD</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_first_downs" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total First Downs"><Text size="xs">1st Dn</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="off_turnovers" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Total Turnovers"><Text size="xs">TO</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="points_for" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Points For"><Text size="xs">PF</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <SortableHeader sortKey="ppg" currentSort={offenseSortBy} currentDirection={offenseSortDirection} onSort={handleOffenseSort}>
                                            <Tooltip label="Points Per Game"><Text size="xs">PPG</Text></Tooltip>
                                        </SortableHeader>
                                    </Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {sortedOffenseTeams.map((team, idx) => (
                                    <Table.Tr key={team.abbr}>
                                        <Table.Td style={{ position: 'sticky', left: 0, background: 'white', zIndex: 9 }}>{idx + 1}</Table.Td>
                                        <Table.Td style={{ position: 'sticky', left: 40, background: 'white', zIndex: 9 }}>
                                            <Group gap="sm" wrap="nowrap">
                                                <Avatar src={getTeamLogo(team.abbr)} size={24} />
                                                <Text fw={500} size="sm">{TEAM_INFO[team.abbr]?.name || team.abbr}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.offensive_epa_per_play || 0) > 0 ? 'green' : 'red'} fw={600}>
                                            {(team.offensive_epa_per_play || 0).toFixed(2)}
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.off_total_epa || 0) > 0 ? 'green' : 'red'}>
                                            {(team.off_total_epa || 0).toFixed(1)}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.off_success_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.pass_offense_epa_per_play || 0) > 0 ? 'green' : 'red'}>
                                            {(team.pass_offense_epa_per_play || 0).toFixed(2)}
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.rush_offense_epa_per_play || 0) > 0 ? 'green' : 'red'}>
                                            {(team.rush_offense_epa_per_play || 0).toFixed(2)}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.passing_yards || 0).toLocaleString()}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.off_comp_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {team.passing_tds || 0}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.rushing_yards || 0).toLocaleString()}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {team.rushing_tds || 0}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.off_adot || 0).toFixed(1)}
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.off_sack_pct || 0) < 5 ? 'green' : (team.off_sack_pct || 0) > 8 ? 'red' : 'inherit'}>
                                            {(team.off_sack_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.off_scramble_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.off_int_pct || 0) < 2 ? 'green' : (team.off_int_pct || 0) > 3 ? 'red' : 'inherit'}>
                                            {(team.off_int_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.receiving_yards || 0).toLocaleString()}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.receptions || 0).toLocaleString()}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.targets || 0).toLocaleString()}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {team.receiving_tds || 0}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.carries || 0).toLocaleString()}
                                        </Table.Td>
                                        <Table.Td ta="right" fw={500}>
                                            {(team.off_total_yards || 0).toLocaleString()}
                                        </Table.Td>
                                        <Table.Td ta="right" fw={500}>
                                            {team.off_total_tds || 0}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {team.off_first_downs || 0}
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.off_turnovers || 0) < 15 ? 'green' : (team.off_turnovers || 0) > 25 ? 'red' : 'inherit'}>
                                            {team.off_turnovers || 0}
                                        </Table.Td>
                                        <Table.Td ta="right" fw={500} c="violet">
                                            {team.points_for || 0}
                                        </Table.Td>
                                        <Table.Td ta="right" fw={500} c="violet">
                                            {(team.ppg || 0).toFixed(1)}
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Box>
                </Paper>
            )}

            {activeTab === 'defense' && (
                <Paper shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={4} mb="md">Defensive Statistics</Title>
                    <Text size="sm" c="dimmed" mb="md">
                        EPA calculated from play-by-play data. Lower (negative) defensive EPA is better. 
                        Stats similar to <a href="https://sumersports.com/teams/defensive/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-blue-6)' }}>Sumer Sports</a>.
                        <Text size="xs" c="dimmed" mt="xs" style={{ display: 'block' }}>
                            📊 Pressure Rate (includes hurries) available 2016-2024. Sack+Hit Rate (consistent definition) available for all seasons.
                        </Text>
                        {parseInt(selectedSeason) > 2024 && (
                            <Text size="xs" c="orange" mt="xs" style={{ display: 'block' }}>
                                ⚠️ Note: Blitz Rate and Coverage % require participation data (available 2016-2024 only). These will show N/A for {selectedSeason}.
                            </Text>
                        )}
                        <Text size="xs" c="dimmed" mt="xs" style={{ display: 'block' }}>
                            💡 Scroll horizontally to see all columns
                        </Text>
                    </Text>
                    <Box style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                        <Table striped highlightOnHover withTableBorder style={{ minWidth: 2100 }}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th style={{ position: 'sticky', left: 0, background: 'white', zIndex: 10, minWidth: 40 }}>#</Table.Th>
                                    <Table.Th style={{ position: 'sticky', left: 40, background: 'white', zIndex: 10, minWidth: 160 }}>Team</Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Defensive EPA per Play (lower is better)">
                                            <SortableHeader sortKey="defensive_epa_per_play" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">EPA/Play</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Total Defensive EPA">
                                            <SortableHeader sortKey="defensive_epa" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Total EPA</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Defensive Success Rate (% of plays with EPA ≤ 0)">
                                            <SortableHeader sortKey="def_success_pct" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Success%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="EPA per Pass Play Allowed">
                                            <SortableHeader sortKey="pass_defense_epa_per_play" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">EPA/Pass</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="EPA per Rush Play Allowed">
                                            <SortableHeader sortKey="rush_defense_epa_per_play" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">EPA/Rush</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Total Passing Yards Allowed">
                                            <SortableHeader sortKey="def_pass_yards_allowed" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Pass Yds</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Completion % Allowed">
                                            <SortableHeader sortKey="def_comp_pct" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Comp%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Passing TDs Allowed">
                                            <SortableHeader sortKey="def_pass_td_allowed" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Pass TD</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Total Rushing Yards Allowed">
                                            <SortableHeader sortKey="def_rush_yards_allowed" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Rush Yds</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Rushing TDs Allowed">
                                            <SortableHeader sortKey="def_rush_td_allowed" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Rush TD</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Average Depth of Target Against">
                                            <SortableHeader sortKey="def_adot" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">ADoT</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Sack Rate (Sacks / Dropbacks)">
                                            <SortableHeader sortKey="def_sack_pct" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Sack%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Scramble Rate Allowed">
                                            <SortableHeader sortKey="def_scramble_pct" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Scrm%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Interception Rate">
                                            <SortableHeader sortKey="def_int_pct" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">INT%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Pressure Rate (includes hurries) - Available 2016-2024 only">
                                            <SortableHeader sortKey="def_pressure_rate" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Prss%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Sack+Hit Rate (Sacks + QB Hits / Dropbacks) - Consistent across all seasons">
                                            <SortableHeader sortKey="def_sack_hit_rate" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Sack+Hit%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label={parseInt(selectedSeason) > 2024 ? "Blitz Rate (5+ pass rushers) - Requires participation data (available 2016-2024 only)" : "Blitz Rate (5+ pass rushers)"}>
                                            <SortableHeader sortKey="def_blitz_rate" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Blitz%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label={parseInt(selectedSeason) > 2024 ? "Man Coverage Rate - Requires participation data (available 2016-2024 only)" : "Man Coverage Rate"}>
                                            <SortableHeader sortKey="def_man_coverage_pct" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Man%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label={parseInt(selectedSeason) > 2024 ? "Zone Coverage Rate - Requires participation data (available 2016-2024 only)" : "Zone Coverage Rate"}>
                                            <SortableHeader sortKey="def_zone_coverage_pct" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">Zone%</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                    <Table.Th ta="right">
                                        <Tooltip label="Avg Time to Throw Allowed (seconds)">
                                            <SortableHeader sortKey="def_avg_time_to_throw" currentSort={defenseSortBy} currentDirection={defenseSortDirection} onSort={handleDefenseSort}>
                                                <Text size="xs">TTT</Text>
                                            </SortableHeader>
                                        </Tooltip>
                                    </Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {sortedDefenseTeams.map((team, idx) => (
                                    <Table.Tr key={team.abbr}>
                                        <Table.Td style={{ position: 'sticky', left: 0, background: 'white', zIndex: 9 }}>{idx + 1}</Table.Td>
                                        <Table.Td style={{ position: 'sticky', left: 40, background: 'white', zIndex: 9 }}>
                                            <Group gap="sm" wrap="nowrap">
                                                <Avatar src={getTeamLogo(team.abbr)} size={24} />
                                                <Text fw={500} size="sm">{TEAM_INFO[team.abbr]?.name || team.abbr}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.defensive_epa_per_play || 0) < 0 ? 'green' : 'red'} fw={600}>
                                            {(team.defensive_epa_per_play || 0).toFixed(2)}
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.defensive_epa || 0) < 0 ? 'green' : 'red'}>
                                            {(team.defensive_epa || 0).toFixed(1)}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.def_success_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.pass_defense_epa_per_play || 0) < 0 ? 'green' : 'red'}>
                                            {(team.pass_defense_epa_per_play || 0).toFixed(2)}
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.rush_defense_epa_per_play || 0) < 0 ? 'green' : 'red'}>
                                            {(team.rush_defense_epa_per_play || 0).toFixed(2)}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.def_pass_yards_allowed || 0).toLocaleString()}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.def_comp_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {team.def_pass_td_allowed || 0}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.def_rush_yards_allowed || 0).toLocaleString()}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {team.def_rush_td_allowed || 0}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.def_adot || 0).toFixed(1)}
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.def_sack_pct || 0) > 7 ? 'green' : 'inherit'}>
                                            {(team.def_sack_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {(team.def_scramble_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.def_int_pct || 0) > 2.5 ? 'green' : 'inherit'}>
                                            {(team.def_int_pct || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.def_pressure_rate || 0) > 35 ? 'green' : 'inherit'} fw={(team.def_pressure_rate || 0) > 35 ? 600 : 400}>
                                            {team.def_pressure_rate != null ? `${team.def_pressure_rate.toFixed(1)}%` : <Text c="dimmed" size="xs">N/A</Text>}
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.def_sack_hit_rate || 0) > 18 ? 'green' : 'inherit'} fw={(team.def_sack_hit_rate || 0) > 18 ? 600 : 400}>
                                            {(team.def_sack_hit_rate || 0).toFixed(1)}%
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.def_blitz_rate || 0) > 30 ? 'orange' : 'inherit'}>
                                            {team.def_blitz_rate != null ? `${team.def_blitz_rate.toFixed(1)}%` : <Text c="dimmed" size="xs">N/A</Text>}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {team.def_man_coverage_pct != null ? `${team.def_man_coverage_pct.toFixed(0)}%` : <Text c="dimmed" size="xs">N/A</Text>}
                                        </Table.Td>
                                        <Table.Td ta="right">
                                            {team.def_zone_coverage_pct != null ? `${team.def_zone_coverage_pct.toFixed(0)}%` : <Text c="dimmed" size="xs">N/A</Text>}
                                        </Table.Td>
                                        <Table.Td ta="right" c={(team.def_avg_time_to_throw || 0) < 2.4 ? 'green' : 'inherit'}>
                                            {team.def_avg_time_to_throw != null ? `${team.def_avg_time_to_throw.toFixed(2)}s` : <Text c="dimmed" size="xs">N/A</Text>}
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Box>
                </Paper>
            )}

            {activeTab === 'sos' && (
                <Paper shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={4} mb="md">Strength of Schedule</Title>
                    <Text size="sm" c="dimmed" mb="md">
                        Strength of Schedule (SOS) measures the average quality of opponents a team faces.
                        Higher SOS values indicate harder schedules. Rankings: 1 = hardest schedule, 32 = easiest.
                        Similar to <a href="https://www.nfeloapp.com/nfl-power-ratings/nfl-strength-of-schedule/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-blue-6)' }}>nfelo</a>.
                    </Text>
                    {sosLoading ? (
                        <Stack gap="md">
                            <Skeleton height={50} />
                            <Skeleton height={400} />
                        </Stack>
                    ) : (
                        <Box style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                            <Table striped highlightOnHover withTableBorder style={{ minWidth: 1000 }}>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th style={{ position: 'sticky', left: 0, background: 'white', zIndex: 10, minWidth: 40 }}>#</Table.Th>
                                        <Table.Th style={{ position: 'sticky', left: 40, background: 'white', zIndex: 10, minWidth: 160 }}>Team</Table.Th>
                                        <Table.Th ta="right">
                                            <SortableHeader sortKey="team_rating" currentSort={sosSortBy} currentDirection={sosSortDirection} onSort={handleSosSort}>
                                                <Tooltip label="Team Rating (Net EPA/Play)"><Text size="xs">Team Rating</Text></Tooltip>
                                            </SortableHeader>
                                        </Table.Th>
                                        <Table.Th ta="right">
                                            <SortableHeader sortKey="projected_sos" currentSort={sosSortBy} currentDirection={sosSortDirection} onSort={handleSosSort}>
                                                <Tooltip label="Projected Strength of Schedule (full season)"><Text size="xs">Projected SOS</Text></Tooltip>
                                            </SortableHeader>
                                        </Table.Th>
                                        <Table.Th ta="center">
                                            <Tooltip label="Projected SOS Rank (1 = hardest)"><Text size="xs">Rank</Text></Tooltip>
                                        </Table.Th>
                                        <Table.Th ta="right">
                                            <SortableHeader sortKey="played_sos" currentSort={sosSortBy} currentDirection={sosSortDirection} onSort={handleSosSort}>
                                                <Tooltip label="Played Strength of Schedule (games completed)"><Text size="xs">Played SOS</Text></Tooltip>
                                            </SortableHeader>
                                        </Table.Th>
                                        <Table.Th ta="center">
                                            <Tooltip label="Played SOS Rank (1 = hardest)"><Text size="xs">Rank</Text></Tooltip>
                                        </Table.Th>
                                        <Table.Th ta="right">
                                            <SortableHeader sortKey="remaining_sos" currentSort={sosSortBy} currentDirection={sosSortDirection} onSort={handleSosSort}>
                                                <Tooltip label="Remaining Strength of Schedule (games remaining)"><Text size="xs">Remaining SOS</Text></Tooltip>
                                            </SortableHeader>
                                        </Table.Th>
                                        <Table.Th ta="center">
                                            <Tooltip label="Remaining SOS Rank (1 = hardest)"><Text size="xs">Rank</Text></Tooltip>
                                        </Table.Th>
                                        <Table.Th ta="center">
                                            <Tooltip label="Number of games played"><Text size="xs">Played</Text></Tooltip>
                                        </Table.Th>
                                        <Table.Th ta="center">
                                            <Tooltip label="Number of games remaining"><Text size="xs">Remaining</Text></Tooltip>
                                        </Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {sortedSosData.map((team, idx) => (
                                        <Table.Tr key={team.abbr}>
                                            <Table.Td style={{ position: 'sticky', left: 0, background: 'white', zIndex: 9 }}>{idx + 1}</Table.Td>
                                            <Table.Td style={{ position: 'sticky', left: 40, background: 'white', zIndex: 9 }}>
                                                <Group gap="sm" wrap="nowrap">
                                                    <Avatar src={getTeamLogo(team.abbr)} size={24} />
                                                    <Text fw={500} size="sm">{TEAM_INFO[team.abbr]?.name || team.abbr}</Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td ta="right" c={(team.team_rating || 0) > 0 ? 'green' : 'red'} fw={500}>
                                                {(team.team_rating || 0).toFixed(3)}
                                            </Table.Td>
                                            <Table.Td ta="right" c={(team.projected_sos || 0) > 0 ? 'red' : 'green'} fw={500}>
                                                {team.projected_sos != null ? (team.projected_sos > 0 ? '+' : '') + team.projected_sos.toFixed(3) : 'N/A'}
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                {team.projected_sos_rank != null ? (
                                                    <Badge color={team.projected_sos_rank <= 10 ? 'red' : team.projected_sos_rank >= 23 ? 'green' : 'gray'} variant="light">
                                                        {team.projected_sos_rank}
                                                    </Badge>
                                                ) : 'N/A'}
                                            </Table.Td>
                                            <Table.Td ta="right" c={(team.played_sos || 0) > 0 ? 'red' : 'green'}>
                                                {team.played_sos != null ? (team.played_sos > 0 ? '+' : '') + team.played_sos.toFixed(3) : 'N/A'}
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                {team.played_sos_rank != null ? (
                                                    <Badge color={team.played_sos_rank <= 10 ? 'red' : team.played_sos_rank >= 23 ? 'green' : 'gray'} variant="light">
                                                        {team.played_sos_rank}
                                                    </Badge>
                                                ) : 'N/A'}
                                            </Table.Td>
                                            <Table.Td ta="right" c={(team.remaining_sos || 0) > 0 ? 'red' : 'green'}>
                                                {team.remaining_sos != null ? (team.remaining_sos > 0 ? '+' : '') + team.remaining_sos.toFixed(3) : 'N/A'}
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                {team.remaining_sos_rank != null ? (
                                                    <Badge color={team.remaining_sos_rank <= 10 ? 'red' : team.remaining_sos_rank >= 23 ? 'green' : 'gray'} variant="light">
                                                        {team.remaining_sos_rank}
                                                    </Badge>
                                                ) : 'N/A'}
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                {team.played_opponent_count || 0}
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                {team.remaining_opponent_count || 0}
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Box>
                    )}
                </Paper>
            )}
        </Container>
    );
}

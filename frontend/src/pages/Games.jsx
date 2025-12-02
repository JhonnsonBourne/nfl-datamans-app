import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Container, Title, Text, Group, Paper, Badge, Grid, Skeleton,
    Alert, Stack, Select, Card, ThemeIcon, Divider, Box,
    SimpleGrid, SegmentedControl, Tooltip, ActionIcon, Center
} from '@mantine/core';
import { IconAlertCircle, IconRefresh, IconTrophy, IconChevronRight } from '@tabler/icons-react';
import axios from 'axios';

// Team colors
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

// Team logo URLs (ESPN CDN)
const getTeamLogo = (team) => 
    `https://a.espncdn.com/i/teamlogos/nfl/500/${team?.toLowerCase()}.png`;

// Format date
const formatGameDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Game Card Component
function GameCard({ game, detailed = false }) {
    const homeWon = game.home_score > game.away_score;
    const awayWon = game.away_score > game.home_score;
    const isComplete = game.home_score !== null && game.away_score !== null;
    
    return (
        <Card 
            component={Link}
            to={`/game/${game.game_id}`}
            shadow="sm" 
            padding="md" 
            radius="md" 
            withBorder
            style={{ 
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                borderLeft: `4px solid ${TEAM_COLORS[game.home_team] || '#666'}`,
            }}
            className="game-card"
        >
            <Stack gap="xs">
                {/* Game time/status */}
                <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                        {formatGameDate(game.gameday)} {game.gametime && `• ${game.gametime}`}
                    </Text>
                    <Badge 
                        size="sm" 
                        variant={isComplete ? 'filled' : 'outline'}
                        color={isComplete ? 'green' : 'blue'}
                    >
                        {isComplete ? 'Final' : 'Upcoming'}
                    </Badge>
                </Group>
                
                {/* Away Team */}
                <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                        <img 
                            src={getTeamLogo(game.away_team)} 
                            alt={game.away_team}
                            style={{ width: 32, height: 32, objectFit: 'contain' }}
                            loading="lazy"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <Box>
                            <Text fw={awayWon ? 700 : 500} size="md">{game.away_team}</Text>
                            {detailed && game.top_passer && game.top_passer.team === game.away_team && (
                                <Text size="xs" c="dimmed">
                                    {game.top_passer.name}: {game.top_passer.yards} yds
                                </Text>
                            )}
                        </Box>
                    </Group>
                    <Text 
                        fw={awayWon ? 700 : 500} 
                        size="xl" 
                        c={awayWon ? 'green' : undefined}
                    >
                        {game.away_score ?? '-'}
                    </Text>
                </Group>
                
                {/* Home Team */}
                <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                        <img 
                            src={getTeamLogo(game.home_team)} 
                            alt={game.home_team}
                            style={{ width: 32, height: 32, objectFit: 'contain' }}
                            loading="lazy"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <Box>
                            <Text fw={homeWon ? 700 : 500} size="md">{game.home_team}</Text>
                            {detailed && game.top_passer && game.top_passer.team === game.home_team && (
                                <Text size="xs" c="dimmed">
                                    {game.top_passer.name}: {game.top_passer.yards} yds
                                </Text>
                            )}
                        </Box>
                    </Group>
                    <Text 
                        fw={homeWon ? 700 : 500} 
                        size="xl" 
                        c={homeWon ? 'green' : undefined}
                    >
                        {game.home_score ?? '-'}
                    </Text>
                </Group>
                
                {/* Top performers for this game */}
                {detailed && isComplete && (
                    <>
                        <Divider my="xs" />
                        <SimpleGrid cols={3} spacing="xs">
                            {game.top_passer && (
                                <Box>
                                    <Text size="xs" c="dimmed" fw={500}>Pass</Text>
                                    <Text size="xs" truncate>{game.top_passer.name}</Text>
                                    <Text size="xs" c="blue" fw={500}>{game.top_passer.yards} yds</Text>
                                </Box>
                            )}
                            {game.top_rusher && (
                                <Box>
                                    <Text size="xs" c="dimmed" fw={500}>Rush</Text>
                                    <Text size="xs" truncate>{game.top_rusher.name}</Text>
                                    <Text size="xs" c="orange" fw={500}>{game.top_rusher.yards} yds</Text>
                                </Box>
                            )}
                            {game.top_receiver && (
                                <Box>
                                    <Text size="xs" c="dimmed" fw={500}>Rec</Text>
                                    <Text size="xs" truncate>{game.top_receiver.name}</Text>
                                    <Text size="xs" c="green" fw={500}>{game.top_receiver.yards} yds</Text>
                                </Box>
                            )}
                        </SimpleGrid>
                    </>
                )}
                
                {/* Click indicator */}
                <Center>
                    <Text size="xs" c="dimmed">
                        Click for details <IconChevronRight size={12} style={{ verticalAlign: 'middle' }} />
                    </Text>
                </Center>
            </Stack>
        </Card>
    );
}

// Week Leaders Card
function WeekLeadersCard({ leaders }) {
    if (!leaders) return null;
    
    return (
        <Paper shadow="sm" p="md" withBorder>
            <Group mb="md">
                <ThemeIcon size="lg" variant="light" color="yellow">
                    <IconTrophy size={20} />
                </ThemeIcon>
                <Title order={4}>Week Leaders</Title>
            </Group>
            
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {leaders.passing && (
                    <Card padding="sm" withBorder>
                        <Badge mb="xs" color="blue">Passing</Badge>
                        <Text 
                            fw={600} 
                            component={Link} 
                            to={`/player/${leaders.passing.player_id}`}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            {leaders.passing.player_name}
                        </Text>
                        <Text size="sm" c="dimmed">{leaders.passing.team}</Text>
                        <Text size="lg" fw={700} c="blue">{leaders.passing.passing_yards} yds</Text>
                        <Text size="xs" c="dimmed">
                            {leaders.passing.passing_tds} TD • {leaders.passing.interceptions} INT
                        </Text>
                    </Card>
                )}
                
                {leaders.rushing && (
                    <Card padding="sm" withBorder>
                        <Badge mb="xs" color="orange">Rushing</Badge>
                        <Text 
                            fw={600}
                            component={Link}
                            to={`/player/${leaders.rushing.player_id}`}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            {leaders.rushing.player_name}
                        </Text>
                        <Text size="sm" c="dimmed">{leaders.rushing.team}</Text>
                        <Text size="lg" fw={700} c="orange">{leaders.rushing.rushing_yards} yds</Text>
                        <Text size="xs" c="dimmed">
                            {leaders.rushing.carries} att • {leaders.rushing.rushing_tds} TD
                        </Text>
                    </Card>
                )}
                
                {leaders.receiving && (
                    <Card padding="sm" withBorder>
                        <Badge mb="xs" color="green">Receiving</Badge>
                        <Text 
                            fw={600}
                            component={Link}
                            to={`/player/${leaders.receiving.player_id}`}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            {leaders.receiving.player_name}
                        </Text>
                        <Text size="sm" c="dimmed">{leaders.receiving.team}</Text>
                        <Text size="lg" fw={700} c="green">{leaders.receiving.receiving_yards} yds</Text>
                        <Text size="xs" c="dimmed">
                            {leaders.receiving.receptions}/{leaders.receiving.targets} rec • {leaders.receiving.receiving_tds} TD
                        </Text>
                    </Card>
                )}
            </SimpleGrid>
        </Paper>
    );
}

export default function Games() {
    const [season, setSeason] = useState(2025);
    const [week, setWeek] = useState(13); // Default to recent week
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('detailed'); // 'compact' or 'detailed'

    // Generate week options
    const weekOptions = useMemo(() => {
        const weeks = [];
        for (let w = 1; w <= 18; w++) {
            weeks.push({ value: w.toString(), label: `Week ${w}` });
        }
        return weeks;
    }, []);

    // Generate season options
    const seasonOptions = useMemo(() => {
        const seasons = [];
        for (let y = 2025; y >= 2020; y--) {
            seasons.push({ value: y.toString(), label: y.toString() });
        }
        return seasons;
    }, []);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const response = await axios.get(`http://localhost:8000/v1/week/${season}/${week}`, {
                    params: { include_leaders: true }
                });
                setData(response.data);
            } catch (err) {
                console.error('Error fetching games:', err);
                setError(err.response?.data?.detail || err.message || 'Failed to load games');
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [season, week]);

    const handleRefresh = () => {
        setData(null);
        setLoading(true);
        // Re-trigger effect by slightly changing state
        setWeek(w => w);
    };

    return (
        <Container size="xl" py="xl">
            {/* Header */}
            <Group justify="space-between" mb="xl">
                <Box>
                    <Title order={1}>🏈 NFL Scoreboard</Title>
                    <Text c="dimmed">Week-by-week scores and top performers</Text>
                </Box>
                <Group>
                    <Select
                        value={season.toString()}
                        onChange={(v) => setSeason(parseInt(v))}
                        data={seasonOptions}
                        w={100}
                    />
                    <Select
                        value={week.toString()}
                        onChange={(v) => setWeek(parseInt(v))}
                        data={weekOptions}
                        w={120}
                    />
                    <SegmentedControl
                        value={viewMode}
                        onChange={setViewMode}
                        data={[
                            { value: 'compact', label: 'Compact' },
                            { value: 'detailed', label: 'Detailed' },
                        ]}
                    />
                    <Tooltip label="Refresh">
                        <ActionIcon variant="light" onClick={handleRefresh}>
                            <IconRefresh size={18} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>

            {/* Loading state */}
            {loading && (
                <Stack>
                    <Skeleton height={100} radius="md" />
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
                        {[1,2,3,4,5,6,7,8].map(i => (
                            <Skeleton key={i} height={200} radius="md" />
                        ))}
                    </SimpleGrid>
                </Stack>
            )}

            {/* Error state */}
            {error && (
                <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="xl">
                    {error}
                </Alert>
            )}

            {/* Content */}
            {!loading && !error && data && (
                <Stack gap="xl">
                    {/* Week Leaders */}
                    {data.week_leaders && (
                        <WeekLeadersCard leaders={data.week_leaders} />
                    )}

                    {/* Games Grid */}
                    <Paper shadow="sm" p="md" withBorder>
                        <Group justify="space-between" mb="md">
                            <Title order={3}>
                                {season} Week {week} • {data.game_count || 0} Games
                            </Title>
                        </Group>
                        
                        {data.games && data.games.length > 0 ? (
                            <SimpleGrid 
                                cols={{ base: 1, sm: 2, md: viewMode === 'detailed' ? 2 : 3, lg: viewMode === 'detailed' ? 3 : 4 }}
                                spacing="md"
                            >
                                {data.games.map((game, idx) => (
                                    <GameCard 
                                        key={game.game_id || idx} 
                                        game={game} 
                                        detailed={viewMode === 'detailed'}
                                    />
                                ))}
                            </SimpleGrid>
                        ) : (
                            <Center py="xl">
                                <Text c="dimmed">No games found for this week</Text>
                            </Center>
                        )}
                    </Paper>
                </Stack>
            )}
            
            {/* CSS for hover effects */}
            <style>{`
                .game-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
            `}</style>
        </Container>
    );
}




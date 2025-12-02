import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Container, Title, Text, Group, Paper, Badge, Grid, Skeleton,
    Alert, Stack, Table, Card, ThemeIcon, Divider, Box,
    SimpleGrid, Tabs, Anchor, Center, Progress
} from '@mantine/core';
import { IconAlertCircle, IconArrowLeft, IconTrophy } from '@tabler/icons-react';
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

// Team logo URLs
const getTeamLogo = (team) => 
    `https://a.espncdn.com/i/teamlogos/nfl/500/${team?.toLowerCase()}.png`;

// Format stat
const formatStat = (value, type = 'number') => {
    if (value === null || value === undefined) return '-';
    if (type === 'integer') return Math.round(value).toLocaleString();
    if (type === 'percent') return (value * 100).toFixed(1) + '%';
    if (type === 'decimal') return value.toFixed(1);
    return value;
};

// Player stat row component
function PlayerStatRow({ player, statType, team }) {
    const teamColor = TEAM_COLORS[team] || '#666';
    
    if (statType === 'passing') {
        return (
            <Table.Tr>
                <Table.Td>
                    <Group gap="xs">
                        <Box w={4} h={24} style={{ backgroundColor: teamColor, borderRadius: 2 }} />
                        <Anchor component={Link} to={`/player/${player.player_id}`} fw={500}>
                            {player.player_display_name || player.player_name}
                        </Anchor>
                    </Group>
                </Table.Td>
                <Table.Td>{player.completions || 0}/{player.attempts || 0}</Table.Td>
                <Table.Td fw={500}>{formatStat(player.passing_yards, 'integer')}</Table.Td>
                <Table.Td c={player.passing_tds > 0 ? 'green' : undefined}>{player.passing_tds || 0}</Table.Td>
                <Table.Td c={player.interceptions > 0 ? 'red' : undefined}>{player.interceptions || 0}</Table.Td>
                <Table.Td>{player.sacks || 0}</Table.Td>
                <Table.Td>
                    {player.completion_pct !== undefined 
                        ? player.completion_pct.toFixed(1) + '%'
                        : player.attempts > 0 
                            ? ((player.completions / player.attempts) * 100).toFixed(1) + '%' 
                            : '-'}
                </Table.Td>
                <Table.Td c="violet" fw={500}>{formatStat(player.fantasy_points_ppr, 'decimal')}</Table.Td>
            </Table.Tr>
        );
    }
    
    if (statType === 'rushing') {
        return (
            <Table.Tr>
                <Table.Td>
                    <Group gap="xs">
                        <Box w={4} h={24} style={{ backgroundColor: teamColor, borderRadius: 2 }} />
                        <Anchor component={Link} to={`/player/${player.player_id}`} fw={500}>
                            {player.player_display_name || player.player_name}
                        </Anchor>
                    </Group>
                </Table.Td>
                <Table.Td>{player.carries || 0}</Table.Td>
                <Table.Td fw={500}>{formatStat(player.rushing_yards, 'integer')}</Table.Td>
                <Table.Td>
                    {player.yards_per_carry !== undefined 
                        ? player.yards_per_carry.toFixed(1)
                        : player.carries > 0 
                            ? (player.rushing_yards / player.carries).toFixed(1) 
                            : '-'}
                </Table.Td>
                <Table.Td c={player.rushing_tds > 0 ? 'green' : undefined}>{player.rushing_tds || 0}</Table.Td>
                <Table.Td c={player.rushing_fumbles > 0 ? 'red' : undefined}>{player.rushing_fumbles || 0}</Table.Td>
                <Table.Td c="violet" fw={500}>{formatStat(player.fantasy_points_ppr, 'decimal')}</Table.Td>
            </Table.Tr>
        );
    }
    
    if (statType === 'receiving') {
        return (
            <Table.Tr>
                <Table.Td>
                    <Group gap="xs">
                        <Box w={4} h={24} style={{ backgroundColor: teamColor, borderRadius: 2 }} />
                        <Anchor component={Link} to={`/player/${player.player_id}`} fw={500}>
                            {player.player_display_name || player.player_name}
                        </Anchor>
                    </Group>
                </Table.Td>
                <Table.Td>{player.targets || 0}</Table.Td>
                <Table.Td>{player.receptions || 0}</Table.Td>
                <Table.Td fw={500}>{formatStat(player.receiving_yards, 'integer')}</Table.Td>
                <Table.Td>
                    {player.yards_per_reception !== undefined 
                        ? player.yards_per_reception.toFixed(1)
                        : player.receptions > 0 
                            ? (player.receiving_yards / player.receptions).toFixed(1) 
                            : '-'}
                </Table.Td>
                <Table.Td c={player.receiving_tds > 0 ? 'green' : undefined}>{player.receiving_tds || 0}</Table.Td>
                <Table.Td c="violet" fw={500}>{formatStat(player.fantasy_points_ppr, 'decimal')}</Table.Td>
            </Table.Tr>
        );
    }
    
    return null;
}

// Team Box component
function TeamBox({ team, score, isWinner, color }) {
    return (
        <Card 
            shadow="sm" 
            padding="lg" 
            radius="md" 
            withBorder
            style={{ 
                borderTop: `4px solid ${color}`,
                backgroundColor: isWinner ? 'rgba(0, 200, 0, 0.05)' : undefined 
            }}
        >
            <Stack align="center" gap="sm">
                <img 
                    src={getTeamLogo(team)} 
                    alt={team}
                    loading="lazy"
                    style={{ width: 80, height: 80, objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
                <Text size="xl" fw={700}>{team}</Text>
                <Text size="3rem" fw={900} c={isWinner ? 'green' : undefined}>
                    {score ?? '-'}
                </Text>
                {isWinner && (
                    <Badge color="green" size="lg" leftSection={<IconTrophy size={14} />}>
                        Winner
                    </Badge>
                )}
            </Stack>
        </Card>
    );
}

export default function GameDetail() {
    const { gameId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('passing');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const response = await axios.get(`http://localhost:8000/v1/game/${gameId}`, {
                    params: { include_player_stats: true }
                });
                setData(response.data);
            } catch (err) {
                console.error('Error fetching game:', err);
                setError(err.response?.data?.detail || err.message || 'Failed to load game');
            } finally {
                setLoading(false);
            }
        };
        
        if (gameId) {
            fetchData();
        }
    }, [gameId]);

    // Organize player stats by team and type
    const organizedStats = useMemo(() => {
        if (!data?.player_stats) return { home: {}, away: {} };
        
        const stats = {
            home: { passing: [], rushing: [], receiving: [] },
            away: { passing: [], rushing: [], receiving: [] }
        };
        
        data.player_stats.forEach(player => {
            const team = player.recent_team || player.team;
            const side = team === data.home_team ? 'home' : 'away';
            
            // Passing
            if (player.attempts > 0) {
                stats[side].passing.push(player);
            }
            
            // Rushing
            if (player.carries > 0) {
                stats[side].rushing.push(player);
            }
            
            // Receiving
            if (player.targets > 0 || player.receptions > 0) {
                stats[side].receiving.push(player);
            }
        });
        
        // Sort each category
        ['home', 'away'].forEach(side => {
            stats[side].passing.sort((a, b) => (b.passing_yards || 0) - (a.passing_yards || 0));
            stats[side].rushing.sort((a, b) => (b.rushing_yards || 0) - (a.rushing_yards || 0));
            stats[side].receiving.sort((a, b) => (b.receiving_yards || 0) - (a.receiving_yards || 0));
        });
        
        return stats;
    }, [data]);

    const homeWon = data?.home_score > data?.away_score;
    const awayWon = data?.away_score > data?.home_score;

    if (loading) {
        return (
            <Container size="lg" py="xl">
                <Skeleton height={60} mb="xl" />
                <Grid>
                    <Grid.Col span={5}><Skeleton height={200} /></Grid.Col>
                    <Grid.Col span={2}><Skeleton height={200} /></Grid.Col>
                    <Grid.Col span={5}><Skeleton height={200} /></Grid.Col>
                </Grid>
                <Skeleton height={400} mt="xl" />
            </Container>
        );
    }

    if (error) {
        return (
            <Container size="lg" py="xl">
                <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
                    {error}
                </Alert>
                <Anchor component={Link} to="/games" mt="md" display="block">
                    ← Back to Scoreboard
                </Anchor>
            </Container>
        );
    }

    return (
        <Container size="xl" py="xl">
            {/* Back link */}
            <Anchor component={Link} to="/games" mb="md" display="block">
                <Group gap="xs">
                    <IconArrowLeft size={16} />
                    <Text>Back to Scoreboard</Text>
                </Group>
            </Anchor>

            {/* Game Header */}
            <Paper shadow="sm" p="xl" mb="xl" withBorder>
                <Text ta="center" c="dimmed" mb="md">
                    {data?.season} Season • Week {data?.week}
                    {data?.game_info?.gameday && ` • ${data.game_info.gameday}`}
                    {data?.game_info?.stadium && ` • ${data.game_info.stadium}`}
                </Text>
                
                <Grid align="center">
                    <Grid.Col span={{ base: 12, sm: 5 }}>
                        <TeamBox 
                            team={data?.away_team} 
                            score={data?.away_score}
                            isWinner={awayWon}
                            color={TEAM_COLORS[data?.away_team] || '#666'}
                        />
                    </Grid.Col>
                    
                    <Grid.Col span={{ base: 12, sm: 2 }}>
                        <Center>
                            <Stack align="center" gap="xs">
                                <Text size="xl" fw={700} c="dimmed">@</Text>
                                {data?.game_info?.overtime && (
                                    <Badge color="yellow">OT</Badge>
                                )}
                            </Stack>
                        </Center>
                    </Grid.Col>
                    
                    <Grid.Col span={{ base: 12, sm: 5 }}>
                        <TeamBox 
                            team={data?.home_team} 
                            score={data?.home_score}
                            isWinner={homeWon}
                            color={TEAM_COLORS[data?.home_team] || '#666'}
                        />
                    </Grid.Col>
                </Grid>
            </Paper>

            {/* Player Stats */}
            <Paper shadow="sm" p="md" withBorder>
                <Title order={3} mb="md">Player Statistics</Title>
                
                <Tabs value={activeTab} onChange={setActiveTab}>
                    <Tabs.List>
                        <Tabs.Tab value="passing">Passing</Tabs.Tab>
                        <Tabs.Tab value="rushing">Rushing</Tabs.Tab>
                        <Tabs.Tab value="receiving">Receiving</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="passing" pt="md">
                        <Grid>
                            {/* Away Team Passing */}
                            <Grid.Col span={{ base: 12, lg: 6 }}>
                                <Card padding="md" withBorder>
                                    <Group mb="md">
                                        <img 
                                            src={getTeamLogo(data?.away_team)} 
                                            alt={data?.away_team}
                                            loading="lazy"
                                            style={{ width: 32, height: 32 }}
                                        />
                                        <Title order={5}>{data?.away_team} Passing</Title>
                                    </Group>
                                    <Table striped highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Player</Table.Th>
                                                <Table.Th>C/A</Table.Th>
                                                <Table.Th>Yds</Table.Th>
                                                <Table.Th>TD</Table.Th>
                                                <Table.Th>INT</Table.Th>
                                                <Table.Th>Sck</Table.Th>
                                                <Table.Th>%</Table.Th>
                                                <Table.Th>Fpts</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {organizedStats.away.passing.map((player, idx) => (
                                                <PlayerStatRow key={idx} player={player} statType="passing" team={data?.away_team} />
                                            ))}
                                            {organizedStats.away.passing.length === 0 && (
                                                <Table.Tr><Table.Td colSpan={8}><Text c="dimmed" ta="center">No passing stats</Text></Table.Td></Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Card>
                            </Grid.Col>
                            
                            {/* Home Team Passing */}
                            <Grid.Col span={{ base: 12, lg: 6 }}>
                                <Card padding="md" withBorder>
                                    <Group mb="md">
                                        <img 
                                            src={getTeamLogo(data?.home_team)}
                                            loading="lazy" 
                                            alt={data?.home_team}
                                            style={{ width: 32, height: 32 }}
                                        />
                                        <Title order={5}>{data?.home_team} Passing</Title>
                                    </Group>
                                    <Table striped highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Player</Table.Th>
                                                <Table.Th>C/A</Table.Th>
                                                <Table.Th>Yds</Table.Th>
                                                <Table.Th>TD</Table.Th>
                                                <Table.Th>INT</Table.Th>
                                                <Table.Th>Sck</Table.Th>
                                                <Table.Th>%</Table.Th>
                                                <Table.Th>Fpts</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {organizedStats.home.passing.map((player, idx) => (
                                                <PlayerStatRow key={idx} player={player} statType="passing" team={data?.home_team} />
                                            ))}
                                            {organizedStats.home.passing.length === 0 && (
                                                <Table.Tr><Table.Td colSpan={8}><Text c="dimmed" ta="center">No passing stats</Text></Table.Td></Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Card>
                            </Grid.Col>
                        </Grid>
                    </Tabs.Panel>

                    <Tabs.Panel value="rushing" pt="md">
                        <Grid>
                            {/* Away Team Rushing */}
                            <Grid.Col span={{ base: 12, lg: 6 }}>
                                <Card padding="md" withBorder>
                                    <Group mb="md">
                                        <img 
                                            src={getTeamLogo(data?.away_team)} 
                                            alt={data?.away_team}
                                            loading="lazy"
                                            style={{ width: 32, height: 32 }}
                                        />
                                        <Title order={5}>{data?.away_team} Rushing</Title>
                                    </Group>
                                    <Table striped highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Player</Table.Th>
                                                <Table.Th>Att</Table.Th>
                                                <Table.Th>Yds</Table.Th>
                                                <Table.Th>Y/A</Table.Th>
                                                <Table.Th>TD</Table.Th>
                                                <Table.Th>Fmb</Table.Th>
                                                <Table.Th>Fpts</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {organizedStats.away.rushing.map((player, idx) => (
                                                <PlayerStatRow key={idx} player={player} statType="rushing" team={data?.away_team} />
                                            ))}
                                            {organizedStats.away.rushing.length === 0 && (
                                                <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">No rushing stats</Text></Table.Td></Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Card>
                            </Grid.Col>
                            
                            {/* Home Team Rushing */}
                            <Grid.Col span={{ base: 12, lg: 6 }}>
                                <Card padding="md" withBorder>
                                    <Group mb="md">
                                        <img 
                                            src={getTeamLogo(data?.home_team)}
                                            loading="lazy" 
                                            alt={data?.home_team}
                                            style={{ width: 32, height: 32 }}
                                        />
                                        <Title order={5}>{data?.home_team} Rushing</Title>
                                    </Group>
                                    <Table striped highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Player</Table.Th>
                                                <Table.Th>Att</Table.Th>
                                                <Table.Th>Yds</Table.Th>
                                                <Table.Th>Y/A</Table.Th>
                                                <Table.Th>TD</Table.Th>
                                                <Table.Th>Fmb</Table.Th>
                                                <Table.Th>Fpts</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {organizedStats.home.rushing.map((player, idx) => (
                                                <PlayerStatRow key={idx} player={player} statType="rushing" team={data?.home_team} />
                                            ))}
                                            {organizedStats.home.rushing.length === 0 && (
                                                <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">No rushing stats</Text></Table.Td></Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Card>
                            </Grid.Col>
                        </Grid>
                    </Tabs.Panel>

                    <Tabs.Panel value="receiving" pt="md">
                        <Grid>
                            {/* Away Team Receiving */}
                            <Grid.Col span={{ base: 12, lg: 6 }}>
                                <Card padding="md" withBorder>
                                    <Group mb="md">
                                        <img 
                                            src={getTeamLogo(data?.away_team)} 
                                            alt={data?.away_team}
                                            loading="lazy"
                                            style={{ width: 32, height: 32 }}
                                        />
                                        <Title order={5}>{data?.away_team} Receiving</Title>
                                    </Group>
                                    <Table striped highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Player</Table.Th>
                                                <Table.Th>Tgt</Table.Th>
                                                <Table.Th>Rec</Table.Th>
                                                <Table.Th>Yds</Table.Th>
                                                <Table.Th>Y/R</Table.Th>
                                                <Table.Th>TD</Table.Th>
                                                <Table.Th>Fpts</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {organizedStats.away.receiving.map((player, idx) => (
                                                <PlayerStatRow key={idx} player={player} statType="receiving" team={data?.away_team} />
                                            ))}
                                            {organizedStats.away.receiving.length === 0 && (
                                                <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">No receiving stats</Text></Table.Td></Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Card>
                            </Grid.Col>
                            
                            {/* Home Team Receiving */}
                            <Grid.Col span={{ base: 12, lg: 6 }}>
                                <Card padding="md" withBorder>
                                    <Group mb="md">
                                        <img 
                                            src={getTeamLogo(data?.home_team)}
                                            loading="lazy" 
                                            alt={data?.home_team}
                                            style={{ width: 32, height: 32 }}
                                        />
                                        <Title order={5}>{data?.home_team} Receiving</Title>
                                    </Group>
                                    <Table striped highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Player</Table.Th>
                                                <Table.Th>Tgt</Table.Th>
                                                <Table.Th>Rec</Table.Th>
                                                <Table.Th>Yds</Table.Th>
                                                <Table.Th>Y/R</Table.Th>
                                                <Table.Th>TD</Table.Th>
                                                <Table.Th>Fpts</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {organizedStats.home.receiving.map((player, idx) => (
                                                <PlayerStatRow key={idx} player={player} statType="receiving" team={data?.home_team} />
                                            ))}
                                            {organizedStats.home.receiving.length === 0 && (
                                                <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">No receiving stats</Text></Table.Td></Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Card>
                            </Grid.Col>
                        </Grid>
                    </Tabs.Panel>
                </Tabs>
            </Paper>
        </Container>
    );
}




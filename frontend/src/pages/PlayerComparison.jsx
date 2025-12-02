import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Container, Title, Text, Group, Paper, Badge, Grid, Select, TextInput,
    Stack, Box, Table, Button, ScrollArea, Avatar, ThemeIcon, Skeleton,
    SimpleGrid, Card, Progress, Tooltip, ActionIcon, Divider
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconUsers, IconChartBar, IconArrowRight, IconX, IconFlame } from '@tabler/icons-react';
import { getPlayerStats, getPlayers, getPlayerProfile } from '../services/api';
import { useSimilarPlayers } from '../hooks/useSimilarPlayers';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

// Position colors
const POSITION_COLORS = {
    QB: { bg: '#fee2e2', text: '#dc2626', mantine: 'red' },
    RB: { bg: '#dbeafe', text: '#2563eb', mantine: 'blue' },
    WR: { bg: '#dcfce7', text: '#16a34a', mantine: 'green' },
    TE: { bg: '#ffedd5', text: '#ea580c', mantine: 'orange' },
};

// Removed calculateSimilarity - now using backend endpoint

// Player card in the selection list
function PlayerListItem({ name, playerData, similarity, isSelected, isReference, sortBy, referencePlayer, onClick }) {
    const position = playerData?.position || '?';
    const colors = POSITION_COLORS[position] || { bg: '#f3f4f6', text: '#374151', mantine: 'gray' };
    const fantasyPts = playerData?.fantasy_points_ppr?.toFixed(1) || '0';
    const team = playerData?.recent_team || playerData?.team || '?';
    
    return (
        <Paper
            p="xs"
            radius="md"
            withBorder
            onClick={onClick}
            style={{ 
                cursor: 'pointer',
                borderColor: isReference ? '#22c55e' : isSelected ? '#3b82f6' : undefined,
                borderWidth: isReference || isSelected ? 2 : 1,
                backgroundColor: isReference ? '#f0fdf4' : isSelected ? '#eff6ff' : undefined,
            }}
        >
            <Group gap="sm" wrap="nowrap">
                <Avatar size="sm" color={colors.mantine} radius="xl">
                    {position}
                </Avatar>
                <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" wrap="nowrap">
                        <Text size="sm" fw={500} truncate style={{ flex: 1 }}>{name}</Text>
                        {isReference && (
                            <Badge size="xs" color="green" variant="filled">REF</Badge>
                        )}
                    </Group>
                    <Group gap="xs">
                        <Text size="xs" c="dimmed">{fantasyPts} pts</Text>
                        <Text size="xs" c="dimmed">•</Text>
                        <Text size="xs" c="dimmed">{team}</Text>
                    </Group>
                </Box>
                <Group gap="xs" wrap="nowrap">
                    {sortBy === 'similarity' && referencePlayer && !isReference && (
                        <Badge 
                            size="sm" 
                            variant="light"
                            color={similarity >= 80 ? 'green' : similarity >= 60 ? 'yellow' : similarity >= 40 ? 'orange' : 'gray'}
                        >
                            {similarity.toFixed(0)}%
                        </Badge>
                    )}
                    {isSelected && (
                        <ThemeIcon size="sm" color="blue" variant="light" radius="xl">
                            <IconUsers size={12} />
                        </ThemeIcon>
                    )}
                </Group>
            </Group>
        </Paper>
    );
}

// Comparison card for selected player
function PlayerCompareCard({ player, onRemove }) {
    const position = player?.position || '?';
    const colors = POSITION_COLORS[position] || { bg: '#f3f4f6', text: '#374151', mantine: 'gray' };
    
    return (
        <Card shadow="sm" padding="md" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
                <Badge color={colors.mantine}>{position}</Badge>
                <ActionIcon size="sm" variant="subtle" color="gray" onClick={onRemove}>
                    <IconX size={14} />
                </ActionIcon>
            </Group>
            <Text fw={600} size="lg" truncate>{player.player_display_name}</Text>
            <Text size="sm" c="dimmed">{player.recent_team || player.team}</Text>
            <Divider my="sm" />
            <SimpleGrid cols={2} spacing="xs">
                <Box>
                    <Text size="xs" c="dimmed">Fantasy</Text>
                    <Text fw={600} c="violet">{player.fantasy_points_ppr?.toFixed(1) || 0}</Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed">Games</Text>
                    <Text fw={600}>{player.games || 0}</Text>
                </Box>
                {position === 'QB' && (
                    <>
                        <Box>
                            <Text size="xs" c="dimmed">Pass Yds</Text>
                            <Text fw={500}>{player.passing_yards || 0}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">TD/INT</Text>
                            <Text fw={500}>{player.passing_tds || 0}/{player.interceptions || 0}</Text>
                        </Box>
                    </>
                )}
                {position === 'RB' && (
                    <>
                        <Box>
                            <Text size="xs" c="dimmed">Rush Yds</Text>
                            <Text fw={500}>{player.rushing_yards || 0}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">Rec Yds</Text>
                            <Text fw={500}>{player.receiving_yards || 0}</Text>
                        </Box>
                    </>
                )}
                {(position === 'WR' || position === 'TE') && (
                    <>
                        <Box>
                            <Text size="xs" c="dimmed">Rec</Text>
                            <Text fw={500}>{player.receptions || 0}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">Rec Yds</Text>
                            <Text fw={500}>{player.receiving_yards || 0}</Text>
                        </Box>
                    </>
                )}
            </SimpleGrid>
            <Button
                component={Link}
                to={`/player/${player.player_id}`}
                variant="light"
                fullWidth
                mt="sm"
                size="xs"
                rightSection={<IconArrowRight size={14} />}
            >
                View Profile
            </Button>
        </Card>
    );
}

export default function PlayerComparison() {
    const [searchParams] = useSearchParams();
    const [comparisonData, setComparisonData] = useState([]); // Selected players for comparison
    const [selectedSeason, setSelectedSeason] = useState('2025');
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300); // 300ms debounce
    const [availablePlayers, setAvailablePlayers] = useState([]); // Player list for search (names only)
    const [playerDataMap, setPlayerDataMap] = useState({}); // Full player data cache
    const [positionFilter, setPositionFilter] = useState('all');
    const [initialPositionSet, setInitialPositionSet] = useState(false);
    const [sortBy, setSortBy] = useState('similarity');
    const [referencePlayer, setReferencePlayer] = useState(null);
    
    // Use React Query for similar players
    const { 
        data: similarPlayersData, 
        isLoading: loadingSimilar,
        isError: similarError 
    } = useSimilarPlayers(
        referencePlayer?.player_id,
        referencePlayer?.position,
        'season',
        50,
        parseInt(selectedSeason)
    );
    
    const similarPlayers = similarPlayersData?.data || [];

    // Load player list for search (lightweight - just names/IDs) using React Query
    const { data: playersResult, isLoading: loadingPlayers } = useQuery({
        queryKey: ['players'],
        queryFn: getPlayers,
        staleTime: 60 * 60 * 1000, // 1 hour - player list doesn't change often
        gcTime: 2 * 60 * 60 * 1000, // 2 hours
    });
    
    useEffect(() => {
        if (playersResult?.data) {
            const players = (playersResult.data || []).map(p => ({
                name: p.display_name || p.name || p.full_name || '',
                player_id: p.player_id || p.gsis_id,
                position: p.position
            })).filter(p => p.name);
            
            setAvailablePlayers(players.map(p => p.name).sort());
            
            // Handle URL params
            const playerId = searchParams.get('player');
            const urlPosition = searchParams.get('position');
            
            if (urlPosition && !initialPositionSet) {
                setPositionFilter(urlPosition);
                setInitialPositionSet(true);
            }
            
            if (playerId && !referencePlayer) {
                // Load full player profile for reference
                getPlayerProfile(playerId, [parseInt(selectedSeason)])
                    .then(profile => {
                        const playerData = {
                            ...profile.info,
                            ...profile.roster,
                            player_id: playerId,
                            position: profile.info?.position || profile.roster?.position
                        };
                        setReferencePlayer(playerData);
                        const playerName = playerData.display_name || playerData.name || '';
                        if (playerName && !selectedPlayers.includes(playerName)) {
                            setSelectedPlayers([playerName]);
                        }
                        if (!initialPositionSet && playerData.position) {
                            setPositionFilter(playerData.position);
                            setInitialPositionSet(true);
                        }
                    })
                    .catch(err => {
                        console.error('Failed to load player profile:', err);
                    });
            }
        }
    }, [playersResult, searchParams, selectedSeason, initialPositionSet, referencePlayer, selectedPlayers]);
    
    // Cache similar players data when loaded
    useEffect(() => {
        if (similarPlayers.length > 0) {
            const newDataMap = { ...playerDataMap };
            similarPlayers.forEach(p => {
                const name = p.player_display_name || p.player || '';
                if (name) {
                    newDataMap[name] = p;
                }
            });
            setPlayerDataMap(newDataMap);
        }
    }, [similarPlayers]);

    // Load full stats for selected players
    useEffect(() => {
        const loadSelectedPlayersData = async () => {
            if (selectedPlayers.length === 0) {
                setComparisonData([]);
                return;
            }
            
            try {
                // Get player IDs from selected names
                const playerIds = selectedPlayers
                    .map(name => {
                        // Try to find in similar players first
                        const similar = similarPlayers.find(p => 
                            (p.player_display_name || p.player) === name
                        );
                        if (similar?.player_id) return similar.player_id;
                        
                        // Try to find in playerDataMap
                        const cached = playerDataMap[name];
                        if (cached?.player_id) return cached.player_id;
                        
                        return null;
                    })
                    .filter(Boolean);
                
                if (playerIds.length === 0) return;
                
                // Load stats for selected players
                const statsResult = await getPlayerStats([parseInt(selectedSeason)], 100);
                const selectedData = statsResult.data.filter(p => 
                    playerIds.includes(p.player_id || p.gsis_id)
                );
                
                setComparisonData(selectedData);
                
                // Update cache
                const newDataMap = { ...playerDataMap };
                selectedData.forEach(p => {
                    const name = p.player_display_name || p.player || '';
                    if (name) {
                        newDataMap[name] = p;
                    }
                });
                setPlayerDataMap(newDataMap);
            } catch (err) {
                console.error('Failed to load selected players data:', err);
            }
        };
        
        loadSelectedPlayersData();
    }, [selectedPlayers, selectedSeason, similarPlayers]);

    const togglePlayer = (player) => {
        if (selectedPlayers.includes(player)) {
            setSelectedPlayers(selectedPlayers.filter(p => p !== player));
            // Remove from reference if it was the reference
            if (referencePlayer && (referencePlayer.player_display_name || referencePlayer.player) === player) {
                setReferencePlayer(null);
            }
        } else if (selectedPlayers.length < 5) {
            setSelectedPlayers([...selectedPlayers, player]);
            // Set as reference if first selection
            if (!referencePlayer && playerDataMap[player]) {
                setReferencePlayer(playerDataMap[player]);
            }
        }
    };

    const removePlayer = (player) => {
        setSelectedPlayers(selectedPlayers.filter(p => p !== player));
        if (referencePlayer && (referencePlayer.player_display_name || referencePlayer.player) === player) {
            setReferencePlayer(null);
        }
    };

    // Removed setReference - using inline logic instead

    // Filter players for display - use similar players if reference is set, otherwise use search
    const filteredPlayers = useMemo(() => {
        if (referencePlayer && similarPlayers.length > 0) {
            // Show similar players with their similarity scores
            return similarPlayers
                .filter(p => {
                    const name = p.player_display_name || p.player || '';
                    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesPosition = positionFilter === 'all' || p.position === positionFilter;
                    return matchesSearch && matchesPosition;
                })
                .map(p => ({
                    name: p.player_display_name || p.player || '',
                    data: p,
                    similarity: p.similarity || 0
                }))
                .sort((a, b) => {
                    if (sortBy === 'similarity') {
                        return b.similarity - a.similarity;
                    } else if (sortBy === 'fantasy') {
                        return (b.data?.fantasy_points_ppr || 0) - (a.data?.fantasy_points_ppr || 0);
                    }
                    return a.name.localeCompare(b.name);
                });
        } else {
            // Show all players from search (limited)
            return availablePlayers
                .filter(name => {
                    const matchesSearch = name.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
                    // Note: We don't have position data for all players in the list
                    return matchesSearch;
                })
                .slice(0, 100) // Limit to 100 for performance
                .map(name => ({
                    name,
                    data: playerDataMap[name] || null,
                    similarity: 0
                }))
                .sort((a, b) => {
                    if (sortBy === 'fantasy') {
                        return (b.data?.fantasy_points_ppr || 0) - (a.data?.fantasy_points_ppr || 0);
                    }
                    return a.name.localeCompare(b.name);
                });
        }
    }, [referencePlayer, similarPlayers, debouncedSearchTerm, positionFilter, sortBy, availablePlayers, playerDataMap]);

    const referencePlayerName = referencePlayer?.player_display_name || referencePlayer?.player || referencePlayer?.display_name || null;

    // Prepare chart data
    const chartData = comparisonData.map(p => ({
        name: p.player_display_name?.split(' ').pop() || p.player,
        'Fantasy Pts': p.fantasy_points_ppr || 0,
        'Rush Yds': (p.rushing_yards || 0) / 10,
        'Rec Yds': (p.receiving_yards || 0) / 10,
        'Total TDs': ((p.passing_tds || 0) + (p.rushing_tds || 0) + (p.receiving_tds || 0)) * 10,
    }));

    const loading = loadingPlayers;
    
    if (loading) {
        return (
            <Container size="xl" py="xl">
                <Skeleton height={50} mb="xl" />
                <Grid>
                    <Grid.Col span={3}>
                        <Stack>
                            <Skeleton height={40} />
                            <Skeleton height={40} />
                            <Skeleton height={300} />
                        </Stack>
                    </Grid.Col>
                    <Grid.Col span={9}>
                        <Skeleton height={400} />
                    </Grid.Col>
                </Grid>
            </Container>
        );
    }

    return (
        <Container size="xl" py="xl">
            {/* Header */}
            <Group justify="space-between" mb="xl">
                <Box>
                    <Title order={1}>⚔️ Player Comparison</Title>
                    <Text c="dimmed">Compare up to 5 players side-by-side</Text>
                </Box>
                {referencePlayerName && (
                    <Paper p="sm" radius="md" withBorder bg="green.0">
                        <Group gap="xs">
                            <IconFlame size={16} color="#16a34a" />
                            <Text size="sm">
                                Comparing to: <Text span fw={600}>{referencePlayerName}</Text>
                            </Text>
                        </Group>
                    </Paper>
                )}
            </Group>

            <Grid gutter="lg">
                {/* Sidebar - Player Selection */}
                <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                    <Paper shadow="sm" p="md" radius="md" withBorder>
                        <Stack gap="md">
                            {/* Filters */}
                            <Select
                                label="Season"
                                value={selectedSeason}
                                onChange={setSelectedSeason}
                                data={['2025', '2024', '2023', '2022', '2021', '2020']}
                            />
                            
                            <Select
                                label="Position"
                                value={positionFilter}
                                onChange={setPositionFilter}
                                data={[
                                    { value: 'all', label: 'All Positions' },
                                    { value: 'QB', label: 'QB - Quarterbacks' },
                                    { value: 'RB', label: 'RB - Running Backs' },
                                    { value: 'WR', label: 'WR - Wide Receivers' },
                                    { value: 'TE', label: 'TE - Tight Ends' },
                                ]}
                            />

                            <Select
                                label="Sort By"
                                value={sortBy}
                                onChange={setSortBy}
                                data={[
                                    { value: 'similarity', label: '📊 Most Similar' },
                                    { value: 'fantasy', label: '💰 Fantasy Points' },
                                    { value: 'alphabetical', label: '🔤 Alphabetical' },
                                ]}
                            />

                            <TextInput
                                placeholder="Search players..."
                                leftSection={<IconSearch size={16} />}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />

                            {/* Reference player info */}
                            {referencePlayer && (
                                <Paper p="sm" radius="md" withBorder bg="green.0" mb="xs">
                                    <Group justify="space-between" gap="xs">
                                        <Text size="xs" fw={500} truncate>
                                            Ref: {referencePlayerName}
                                        </Text>
                                        <ActionIcon 
                                            size="xs" 
                                            variant="subtle" 
                                            color="red"
                                            onClick={() => {
                                                setReferencePlayer(null);
                                            }}
                                        >
                                            <IconX size={12} />
                                        </ActionIcon>
                                    </Group>
                                </Paper>
                            )}
                            
                            {!referencePlayer && (
                                <Paper p="xs" radius="md" withBorder bg="blue.0" mb="xs">
                                    <Text size="xs" c="dimmed" ta="center">
                                        💡 Select a player to see similar players
                                    </Text>
                                </Paper>
                            )}

                            {/* Player count */}
                            <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                    {loadingSimilar ? 'Loading...' : referencePlayer 
                                        ? `${filteredPlayers.length} similar players`
                                        : `${filteredPlayers.length} players`}
                                </Text>
                                <Text size="sm" c="dimmed">
                                    {selectedPlayers.length}/5 selected
                                </Text>
                            </Group>

                            {/* Player list */}
                            <ScrollArea h={400} offsetScrollbars>
                                {loadingSimilar && referencePlayer ? (
                                    <Stack gap="xs">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <Skeleton key={i} height={60} radius="md" />
                                        ))}
                                    </Stack>
                                ) : filteredPlayers.length === 0 ? (
                                    <Paper p="md" radius="md" withBorder>
                                        <Text size="sm" c="dimmed" ta="center">
                                            {referencePlayer 
                                                ? 'No similar players found'
                                                : 'No players found. Try a different search.'}
                                        </Text>
                                    </Paper>
                                ) : (
                                    <Stack gap="xs">
                                        {filteredPlayers.map(({ name, data: playerData, similarity }) => (
                                            <PlayerListItem
                                                key={name}
                                                name={name}
                                                playerData={playerData}
                                                similarity={similarity}
                                                isSelected={selectedPlayers.includes(name)}
                                                isReference={referencePlayerName === name}
                                                sortBy={sortBy}
                                                referencePlayer={referencePlayer}
                                                onClick={() => {
                                                    if (!referencePlayer && playerData) {
                                                        // Set as reference if no reference exists
                                                        setReferencePlayer(playerData);
                                                        if (!selectedPlayers.includes(name)) {
                                                            setSelectedPlayers([name]);
                                                        }
                                                    } else {
                                                        togglePlayer(name);
                                                    }
                                                }}
                                            />
                                        ))}
                                    </Stack>
                                )}
                            </ScrollArea>
                        </Stack>
                    </Paper>
                </Grid.Col>

                {/* Main Content */}
                <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                    {selectedPlayers.length === 0 ? (
                        <Paper shadow="sm" p={60} radius="md" withBorder ta="center">
                            <ThemeIcon size={60} radius="xl" color="gray" variant="light" mx="auto" mb="md">
                                <IconUsers size={30} />
                            </ThemeIcon>
                            <Title order={3} mb="xs">No Players Selected</Title>
                            <Text c="dimmed" maw={400} mx="auto">
                                Select players from the sidebar to compare their stats. 
                                You can compare up to 5 players at once.
                            </Text>
                        </Paper>
                    ) : (
                        <Stack gap="lg">
                            {/* Selected Player Cards */}
                            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }}>
                                {comparisonData.map(player => (
                                    <PlayerCompareCard
                                        key={player.player_id}
                                        player={player}
                                        onRemove={() => removePlayer(player.player_display_name || player.player)}
                                    />
                                ))}
                            </SimpleGrid>

                            {/* Chart */}
                            <Paper shadow="sm" p="lg" radius="md" withBorder>
                                <Group justify="space-between" mb="md">
                                    <Group gap="xs">
                                        <IconChartBar size={20} />
                                        <Title order={4}>Stats Comparison</Title>
                                    </Group>
                                </Group>
                                <Box h={300}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Legend />
                                            <Bar dataKey="Fantasy Pts" fill="#8b5cf6" />
                                            <Bar dataKey="Rush Yds" fill="#3b82f6" name="Rush Yds (÷10)" />
                                            <Bar dataKey="Rec Yds" fill="#22c55e" name="Rec Yds (÷10)" />
                                            <Bar dataKey="Total TDs" fill="#f59e0b" name="TDs (×10)" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            </Paper>

                            {/* Detailed Stats Table */}
                            <Paper shadow="sm" p="lg" radius="md" withBorder>
                                <Title order={4} mb="md">Detailed Comparison</Title>
                                <ScrollArea>
                                    <Table striped highlightOnHover withTableBorder>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Player</Table.Th>
                                                <Table.Th>Pos</Table.Th>
                                                <Table.Th>Team</Table.Th>
                                                <Table.Th ta="right">G</Table.Th>
                                                <Table.Th ta="right">Fpts</Table.Th>
                                                <Table.Th ta="right">Fpts/G</Table.Th>
                                                <Table.Th ta="right">Pass</Table.Th>
                                                <Table.Th ta="right">Rush</Table.Th>
                                                <Table.Th ta="right">Rec</Table.Th>
                                                <Table.Th ta="right">TDs</Table.Th>
                                                <Table.Th ta="right">EPA</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {comparisonData.map(p => {
                                                const colors = POSITION_COLORS[p.position] || POSITION_COLORS.QB;
                                                return (
                                                    <Table.Tr key={p.player_id}>
                                                        <Table.Td>
                                                            <Text fw={500}>{p.player_display_name}</Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Badge color={colors.mantine} size="sm">{p.position}</Badge>
                                                        </Table.Td>
                                                        <Table.Td>{p.recent_team || p.team}</Table.Td>
                                                        <Table.Td ta="right">{p.games || '-'}</Table.Td>
                                                        <Table.Td ta="right" fw={700} c="violet">
                                                            {p.fantasy_points_ppr?.toFixed(1)}
                                                        </Table.Td>
                                                        <Table.Td ta="right">
                                                            {p.games ? (p.fantasy_points_ppr / p.games).toFixed(1) : '-'}
                                                        </Table.Td>
                                                        <Table.Td ta="right">{p.passing_yards || 0}</Table.Td>
                                                        <Table.Td ta="right">{p.rushing_yards || 0}</Table.Td>
                                                        <Table.Td ta="right">{p.receiving_yards || 0}</Table.Td>
                                                        <Table.Td ta="right">
                                                            {(p.passing_tds || 0) + (p.rushing_tds || 0) + (p.receiving_tds || 0)}
                                                        </Table.Td>
                                                        <Table.Td ta="right">
                                                            {((p.passing_epa || 0) + (p.rushing_epa || 0) + (p.receiving_epa || 0)).toFixed(1)}
                                                        </Table.Td>
                                                    </Table.Tr>
                                                );
                                            })}
                                        </Table.Tbody>
                                    </Table>
                                </ScrollArea>
                            </Paper>
                        </Stack>
                    )}
                </Grid.Col>
            </Grid>
        </Container>
    );
}

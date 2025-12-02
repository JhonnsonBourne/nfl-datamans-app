import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Container, Title, Text, Group, Paper, Badge, Grid, SimpleGrid,
    Card, Box, Stack, ThemeIcon, Button, Skeleton, Avatar, SegmentedControl
} from '@mantine/core';
import { 
    IconChartBar, IconUsers, IconTrophy, IconShield, IconCalendar,
    IconArrowRight, IconFlame, IconStarFilled, IconPlayerPlay
} from '@tabler/icons-react';
import { getArticles, getTopPlayersBatch } from '../services/api';
import { useTopPlayers } from '../hooks/useTopPlayers';
import { useSchedule } from '../hooks/useSchedule';
import { useQuery } from '@tanstack/react-query';

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

// Team logo URL helper
const getTeamLogo = (team) => 
    `https://a.espncdn.com/i/teamlogos/nfl/500/${team?.toLowerCase()}.png`;

// Player photo URL helper - use player_id/gsis_id to construct ESPN URL
// ESPN uses numeric IDs, typically 6-7 digits
const getPlayerPhoto = (playerId, gsisId) => {
    // Try gsis_id first (format: "00-0031234" -> extract numeric part "0031234")
    if (gsisId) {
        const numericId = gsisId.toString().replace(/[^0-9]/g, '');
        // ESPN IDs are typically 6-7 digits
        if (numericId && numericId.length >= 6) {
            return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${numericId}.png&w=350&h=254`;
        }
    }
    // Fallback: try player_id (might already be numeric or in format like "00-0031234")
    if (playerId) {
        const numericId = playerId.toString().replace(/[^0-9]/g, '');
        if (numericId && numericId.length >= 6) {
            return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${numericId}.png&w=350&h=254`;
        }
    }
    return null;
};

// Feature card component
function FeatureCard({ icon: Icon, title, description, to, color, badge }) {
    return (
        <Card
            component={Link}
            to={to}
            shadow="md"
            padding="xl"
            radius="lg"
            withBorder
            style={{ 
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
            }}
            className="hover-lift"
        >
            <Group justify="space-between" mb="md">
                <ThemeIcon size={50} radius="md" color={color} variant="light">
                    <Icon size={28} />
                </ThemeIcon>
                {badge && (
                    <Badge color={color} variant="light" size="sm">{badge}</Badge>
                )}
            </Group>
            <Title order={3} mb="xs">{title}</Title>
            <Text size="sm" c="dimmed" mb="md">{description}</Text>
            <Group gap="xs" c={color}>
                <Text size="sm" fw={500}>Explore</Text>
                <IconArrowRight size={16} />
            </Group>
        </Card>
    );
}

// Player performance card with photo and link
function PlayerPerformanceCard({ player, rank, position, playerId, team, stats, statType = 'fantasy' }) {
    const positionColors = {
        QB: 'red', RB: 'blue', WR: 'green', TE: 'orange'
    };
    
    const color = positionColors[position] || 'gray';
    // Try to get photo - use gsis_id or player_id
    const gsisId = stats?.gsis_id || stats?.player_id;
    const photoUrl = getPlayerPhoto(playerId, gsisId);
    
    // Get stat display based on type
    let statValue, statLabel, secondaryStat;
    
    if (statType === 'fantasy') {
        statValue = stats?.fantasy_points_ppr?.toFixed(1);
        statLabel = 'FPts';
        // Calculate fantasy points per game
        const games = stats?.games || 1;
        const fantasyPoints = stats?.fantasy_points_ppr || 0;
        const fantasyPerGame = games > 0 ? (fantasyPoints / games).toFixed(1) : '0.0';
        secondaryStat = `${fantasyPerGame} FPts/G`;
    } else if (statType === 'real') {
        if (position === 'QB') {
            statValue = stats?.passing_yards || 0;
            statLabel = 'Pass Yds';
            secondaryStat = `${stats?.passing_tds || 0} TD`;
        } else if (position === 'RB') {
            statValue = stats?.rushing_yards || 0;
            statLabel = 'Rush Yds';
            secondaryStat = `${stats?.rushing_tds || 0} TD`;
        } else {
            statValue = stats?.receiving_yards || 0;
            statLabel = 'Rec Yds';
            secondaryStat = `${stats?.receiving_tds || 0} TD`;
        }
    } else if (statType === 'advanced') {
        if (position === 'QB') {
            statValue = stats?.epa_per_dropback?.toFixed(2);
            statLabel = 'EPA/DB';
            // Show total EPA as secondary stat
            const totalEPA = stats?.passing_epa || 0;
            secondaryStat = `${totalEPA > 0 ? '+' : ''}${totalEPA.toFixed(1)} EPA`;
        } else if (position === 'RB') {
            // For RBs, show RYOE as primary stat (sorted by RYOE in backend)
            const ryoe = stats?.ngs_rush_yards_over_expected || stats?.rush_yards_over_expected || null;
            if (ryoe !== null && ryoe !== undefined) {
                statValue = `${ryoe > 0 ? '+' : ''}${ryoe.toFixed(1)}`;
                statLabel = 'RYOE';
                // Show YPC as secondary stat
                secondaryStat = `${stats?.yards_per_carry?.toFixed(1) || 0} YPC`;
            } else {
                // Fallback if RYOE not available (shouldn't happen due to filtering)
                statValue = stats?.yards_per_carry?.toFixed(1);
                statLabel = 'YPC';
                secondaryStat = `${stats?.rushing_epa_per_carry?.toFixed(2) || 0} EPA/C`;
            }
        } else if (position === 'WR') {
            statValue = stats?.yprr?.toFixed(1);
            statLabel = 'YPRR';
            // Show Air Yards Share as secondary stat
            const airYardsShare = stats?.air_yards_share || 0;
            secondaryStat = `${(airYardsShare * 100).toFixed(1)}% Air Yds`;
        } else if (position === 'TE') {
            statValue = stats?.yprr?.toFixed(1);
            statLabel = 'YPRR';
            // Show Air Yards Share as secondary stat
            const airYardsShare = stats?.air_yards_share || 0;
            secondaryStat = `${(airYardsShare * 100).toFixed(1)}% Air Yds`;
        }
    }
    
    const playerName = player || 'Unknown';
    
    return (
        <Paper 
            shadow="sm" 
            p="md" 
            radius="md" 
            withBorder
            component={Link}
            to={`/player/${playerId}`}
            style={{ 
                textDecoration: 'none', 
                color: 'inherit',
                transition: 'all 0.2s ease',
            }}
            styles={{
                root: {
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                    }
                }
            }}
        >
            <Group gap="md" wrap="nowrap" align="flex-start">
                <Avatar 
                    size={64} 
                    radius="md"
                    src={photoUrl}
                    color={color}
                    style={{ 
                        border: `3px solid var(--mantine-color-${color}-6)`,
                        flexShrink: 0
                    }}
                >
                    <Text size="lg" fw={700}>{rank}</Text>
                </Avatar>
                <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" wrap="nowrap" mb={4} justify="space-between">
                        <Text size="md" fw={600} truncate style={{ flex: 1 }}>
                            {playerName}
                        </Text>
                        {team && (
                            <img 
                                src={getTeamLogo(team)} 
                                alt={team}
                                loading="lazy"
                                style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        )}
                    </Group>
                    <Group gap="xs" wrap="nowrap" mb={secondaryStat ? 4 : 0}>
                        <Badge size="sm" color={color} variant="light" radius="sm">
                            {position}
                        </Badge>
                        <Text size="sm" fw={600} c="dimmed">
                            {statValue} <Text component="span" size="xs" c="dimmed" fw={400}>{statLabel}</Text>
                        </Text>
                    </Group>
                    {secondaryStat && (
                        <Text size="xs" c="dimmed" fw={500}>
                            {secondaryStat}
                        </Text>
                    )}
                </Box>
            </Group>
        </Paper>
    );
}

// Game card component with team logos
function GameCard({ game }) {
    const isFinal = game.away_score !== null && game.home_score !== null;
    const winner = isFinal ? (game.away_score > game.home_score ? game.away_team : game.home_team) : null;
    
    return (
        <Paper 
            shadow="sm" 
            p="md" 
            radius="md" 
            withBorder
            component={Link}
            to={`/game/${game.season}_${game.week}_${game.away_team}_${game.home_team}`}
            style={{ 
                textDecoration: 'none', 
                color: 'inherit',
                transition: 'all 0.2s ease',
            }}
            styles={{
                root: {
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                    }
                }
            }}
        >
            <Group justify="space-between" gap="md">
                <Stack gap={6} align="center" style={{ flex: 1 }}>
                    <img 
                        src={getTeamLogo(game.away_team)} 
                        alt={game.away_team}
                        loading="lazy"
                        style={{ width: 40, height: 40, objectFit: 'contain' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <Text 
                        size="sm" 
                        fw={winner === game.away_team ? 700 : 500}
                        c={winner === game.away_team ? 'green' : undefined}
                    >
                        {game.away_team}
                    </Text>
                    <Text size="xl" fw={700}>{isFinal ? game.away_score : '-'}</Text>
                </Stack>
                <Text size="sm" c="dimmed" fw={600}>@</Text>
                <Stack gap={6} align="center" style={{ flex: 1 }}>
                    <img 
                        src={getTeamLogo(game.home_team)} 
                        alt={game.home_team}
                        loading="lazy"
                        style={{ width: 40, height: 40, objectFit: 'contain' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <Text 
                        size="sm" 
                        fw={winner === game.home_team ? 700 : 500}
                        c={winner === game.home_team ? 'green' : undefined}
                    >
                        {game.home_team}
                    </Text>
                    <Text size="xl" fw={700}>{isFinal ? game.home_score : '-'}</Text>
                </Stack>
            </Group>
            {isFinal && (
                <Badge size="sm" color="gray" variant="light" fullWidth mt="md" radius="sm">
                    FINAL
                </Badge>
            )}
        </Paper>
    );
}

// Metric constants (outside component to avoid recreation on each render)
const FANTASY_METRIC = 'fantasy_points_ppr';
const REAL_METRIC = {
    QB: 'passing_yards',
    RB: 'rushing_yards',
    WR: 'receiving_yards',
    TE: 'receiving_yards'
};
const ADVANCED_METRIC = {
    QB: 'epa_per_dropback', // Primary: EPA/DB, Secondary: EPA
    RB: 'yards_per_carry', // Backend converts to RYOE for sorting, Primary: RYOE, Secondary: YPC
    WR: 'yprr', // Primary: YPRR, Secondary: Air Yards %
    TE: 'yprr' // Primary: YPRR, Secondary: Air Yards %
};

export default function Home() {
    const [featuredArticles, setFeaturedArticles] = useState([]);
    const [statType, setStatType] = useState('real'); // 'fantasy', 'real', 'advanced'
    
    // Use React Query hooks for cached data - fetch different metrics based on statType
    
    // Use batch endpoint for advanced stats (more efficient - calculates routes once)
    // Use individual endpoints for fantasy/real stats (faster, no routes needed)
    const useBatch = statType === 'advanced';
    
    const batchMetrics = useMemo(() => ({
        QB: statType === 'fantasy' ? FANTASY_METRIC : statType === 'real' ? REAL_METRIC.QB : ADVANCED_METRIC.QB,
        RB: statType === 'fantasy' ? FANTASY_METRIC : statType === 'real' ? REAL_METRIC.RB : ADVANCED_METRIC.RB,
        WR: statType === 'fantasy' ? FANTASY_METRIC : statType === 'real' ? REAL_METRIC.WR : ADVANCED_METRIC.WR,
        TE: statType === 'fantasy' ? FANTASY_METRIC : statType === 'real' ? REAL_METRIC.TE : ADVANCED_METRIC.TE,
    }), [statType]);
    
    const { data: batchResult, isLoading: loadingBatch, error: batchError } = useQuery({
        queryKey: ['topPlayersBatch', 2025, batchMetrics, 5],
        queryFn: () => getTopPlayersBatch(2025, batchMetrics, 5, {}),
        enabled: useBatch,
        staleTime: 15 * 60 * 1000, // 15 minutes for advanced stats
        gcTime: 30 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    });
    
    const { data: qbResult, isLoading: loadingQB, error: qbError } = useTopPlayers(
        2025, 
        'QB', 
        batchMetrics.QB, 
        5,
        {}
    );
    const { data: rbResult, isLoading: loadingRB, error: rbError } = useTopPlayers(
        2025, 
        'RB', 
        batchMetrics.RB, 
        5,
        {}
    );
    const { data: wrResult, isLoading: loadingWR, error: wrError } = useTopPlayers(
        2025, 
        'WR', 
        batchMetrics.WR, 
        5,
        {}
    );
    const { data: teResult, isLoading: loadingTE, error: teError } = useTopPlayers(
        2025, 
        'TE', 
        batchMetrics.TE, 
        5,
        {}
    );
    
    // Use batch results if available, otherwise use individual results
    const finalQBResult = useBatch ? batchResult?.data?.qb : qbResult;
    const finalRBResult = useBatch ? batchResult?.data?.rb : rbResult;
    const finalWRResult = useBatch ? batchResult?.data?.wr : wrResult;
    const finalTEResult = useBatch ? batchResult?.data?.te : teResult;
    const isLoading = useBatch ? loadingBatch : (loadingQB || loadingRB || loadingWR || loadingTE);
    const hasError = useBatch ? batchError : (qbError || rbError || wrError || teError);
    
    // Debug logging
    useEffect(() => {
        if (useBatch) {
            if (batchResult) console.log('Batch Result:', batchResult);
            if (batchError) console.error('Batch Error:', batchError);
        } else {
            if (qbResult) console.log('QB Result:', qbResult);
            if (rbResult) console.log('RB Result:', rbResult);
            if (wrResult) console.log('WR Result:', wrResult);
            if (qbError) console.error('QB Error:', qbError);
            if (rbError) console.error('RB Error:', rbError);
            if (wrError) console.error('WR Error:', wrError);
        }
    }, [useBatch, batchResult, batchError, qbResult, rbResult, wrResult, qbError, rbError, wrError]);
    const { data: scheduleResult, isLoading: loadingSchedule } = useSchedule(2025, 13, false);
    
    const topPlayers = useMemo(() => {
        if (useBatch) {
            // Batch endpoint returns { data: { qb: [...], rb: [...], wr: [...], te: [...] } }
            return {
                qb: finalQBResult || [],
                rb: finalRBResult || [],
                wr: finalWRResult || [],
                te: finalTEResult || []
            };
        } else {
            // Individual endpoints return { data: [...] }
            return {
                qb: finalQBResult?.data || [],
                rb: finalRBResult?.data || [],
                wr: finalWRResult?.data || [],
                te: finalTEResult?.data || []
            };
        }
    }, [useBatch, finalQBResult, finalRBResult, finalWRResult, finalTEResult]);
    
    const recentGames = useMemo(() => {
        return (scheduleResult?.data || []).slice(0, 6);
    }, [scheduleResult]);
    
    const loading = loadingQB || loadingRB || loadingWR || loadingSchedule;

    useEffect(() => {
        // Fetch featured articles
        const fetchArticles = async () => {
            try {
                const articles = await getArticles(true, 3, 0);
                setFeaturedArticles(articles.data || []);
            } catch (err) {
                console.error('Failed to fetch articles:', err);
            }
        };
        
        fetchArticles();
    }, []);

    return (
        <Box style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)' }}>
            {/* Hero Section */}
            <Box py={60} style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Decorative elements */}
                <Box 
                    style={{ 
                        position: 'absolute', 
                        top: -100, 
                        right: -100, 
                        width: 400, 
                        height: 400, 
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.03)',
                    }} 
                />
                <Box 
                    style={{ 
                        position: 'absolute', 
                        bottom: -50, 
                        left: -50, 
                        width: 300, 
                        height: 300, 
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.02)',
                    }} 
                />
                
                <Container size="lg" style={{ position: 'relative', zIndex: 1 }}>
                    <Stack align="center" gap="lg">
                        <Badge size="lg" variant="light" color="cyan" radius="sm">
                            2025 Season
                        </Badge>
                        <Title 
                            order={1} 
                            ta="center" 
                            c="white"
                            style={{ fontSize: '3.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}
                        >
                            🏈 NFL Data Hub
                        </Title>
                        <Text 
                            size="xl" 
                            c="rgba(255,255,255,0.8)" 
                            ta="center" 
                            maw={600}
                            style={{ lineHeight: 1.6 }}
                        >
                            Your comprehensive platform for NFL statistics, player analysis, 
                            and fantasy football insights powered by nflverse data.
                        </Text>
                        <Group mt="md">
                            <Button 
                                component={Link} 
                        to="/player-stats"
                                size="lg" 
                                radius="md"
                                variant="white"
                                color="blue"
                                leftSection={<IconChartBar size={20} />}
                            >
                                Explore Stats
                            </Button>
                            <Button 
                                component={Link} 
                                to="/games" 
                                size="lg" 
                                radius="md"
                                variant="outline"
                                color="white"
                                leftSection={<IconPlayerPlay size={20} />}
                            >
                                View Scores
                            </Button>
                        </Group>
                    </Stack>
                </Container>
            </Box>

            {/* Main Content */}
            <Box bg="gray.0" style={{ borderTopLeftRadius: 40, borderTopRightRadius: 40 }}>
                <Container size="lg" py="xl">
                    {/* Quick Links */}
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb={50}>
                        <FeatureCard
                            icon={IconCalendar}
                            title="Scores"
                            description="Live scores, game details, and box scores for every NFL game."
                            to="/games"
                            color="violet"
                            badge="Live"
                        />
                        <FeatureCard
                            icon={IconChartBar}
                            title="Player Stats"
                            description="Deep dive into player performance with advanced filtering and NextGen Stats."
                            to="/player-stats"
                            color="blue"
                        />
                        <FeatureCard
                            icon={IconUsers}
                            title="Compare"
                            description="Compare players side-by-side with similarity scores and visualizations."
                        to="/comparison"
                            color="teal"
                            badge="New"
                        />
                        <FeatureCard
                            icon={IconShield}
                            title="Teams"
                            description="Team-level trends, standings, and offensive/defensive analysis."
                            to="/teams"
                            color="orange"
                        />
                    </SimpleGrid>

                    {/* Featured Articles */}
                    {featuredArticles.length > 0 && (
                        <Box mb={50}>
                            <Group justify="space-between" mb="md">
                                <Group gap="xs">
                                    <IconFlame size={24} color="#f59e0b" />
                                    <Title order={2}>Featured Articles</Title>
                                </Group>
                                <Button 
                                    component={Link} 
                                    to="/articles" 
                                    variant="subtle" 
                                    size="sm"
                                    rightSection={<IconArrowRight size={14} />}
                                >
                                    View All
                                </Button>
                            </Group>
                            <Grid>
                                {featuredArticles.map((article) => (
                                    <Grid.Col key={article.id} span={{ base: 12, sm: 6, md: 4 }}>
                                        <Card
                                            component={Link}
                                            to={`/articles/${article.id}`}
                                            shadow="sm"
                                            padding="lg"
                                            radius="md"
                                            withBorder
                                            style={{ 
                                                textDecoration: 'none',
                                                color: 'inherit',
                                                height: '100%',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                transition: 'transform 0.2s',
                                                cursor: 'pointer'
                                            }}
                                            styles={{
                                                root: {
                                                    '&:hover': {
                                                        transform: 'translateY(-4px)',
                                                        boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                                                    }
                                                }
                                            }}
                                        >
                                            {article.featured_image && (
                                                <Card.Section>
                                                    <img
                                                        src={article.featured_image}
                                                        alt={article.title}
                                                        loading="lazy"
                                                        style={{
                                                            width: '100%',
                                                            height: 180,
                                                            objectFit: 'cover'
                                                        }}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                </Card.Section>
                                            )}
                                            <Stack gap="xs" mt="md" style={{ flex: 1 }}>
                                                <Group gap="xs" justify="space-between">
                                                    <Badge color="blue" variant="light" size="sm">
                                                        {article.category || 'General'}
                                                    </Badge>
                                                    <Text size="xs" c="dimmed">
                                                        {new Date(article.created_at).toLocaleDateString()}
                                                    </Text>
                                                </Group>
                                                <Title order={4} lineClamp={2} style={{ minHeight: 56 }}>
                                                    {article.title}
                                                </Title>
                                                <Text size="sm" c="dimmed" lineClamp={2} style={{ flex: 1 }}>
                                                    {article.excerpt || 'Read more...'}
                                                </Text>
                                            </Stack>
                                        </Card>
                                    </Grid.Col>
                                ))}
                            </Grid>
                        </Box>
                    )}

                    {/* Two Column Layout */}
                    <Grid gutter="xl">
                        {/* Recent Games */}
                        <Grid.Col span={{ base: 12, md: 4 }}>
                            <Paper shadow="sm" p="xl" radius="lg" withBorder h="100%">
                                <Group justify="space-between" mb="lg">
                                    <Group gap="xs">
                                        <IconPlayerPlay size={22} color="#7c3aed" />
                                        <Title order={3}>Recent Games</Title>
                                    </Group>
                                    <Button 
                                        component={Link} 
                                        to="/games" 
                                        variant="subtle" 
                                        size="sm"
                                        rightSection={<IconArrowRight size={16} />}
                                    >
                                        All Scores
                                    </Button>
                                </Group>
                                
                                {loading ? (
                                    <Stack gap="md">
                                        {[1,2,3,4].map(i => <Skeleton key={i} height={80} radius="md" />)}
                                    </Stack>
                                ) : recentGames.length > 0 ? (
                                    <SimpleGrid cols={1} spacing="md">
                                        {recentGames.map((game, i) => (
                                            <GameCard key={i} game={game} />
                                        ))}
                                    </SimpleGrid>
                                ) : (
                                    <Text c="dimmed" ta="center" py="xl">No recent games</Text>
                                )}
                            </Paper>
                        </Grid.Col>

                        {/* Top Performers */}
                        <Grid.Col span={{ base: 12, md: 8 }}>
                            <Paper shadow="sm" p="xl" radius="lg" withBorder>
                                <Group justify="space-between" mb="xl">
                                    <Group gap="xs">
                                        <IconFlame size={22} color="#ef4444" />
                                        <Title order={3}>Top Performers</Title>
                                    </Group>
                                    <SegmentedControl
                                        value={statType}
                                        onChange={setStatType}
                                        data={[
                                            { label: 'Fantasy', value: 'fantasy' },
                                            { label: 'Real Stats', value: 'real' },
                                            { label: 'Advanced', value: 'advanced' },
                                        ]}
                                        size="sm"
                                    />
                                </Group>

                                {hasError && (
                                    <Text c="red" ta="center" py="xl" size="sm">
                                        Error loading data. Check console for details.
                                    </Text>
                                )}
                                {isLoading ? (
                                    <SimpleGrid cols={2} spacing="lg">
                                        {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} height={100} radius="md" />)}
                                    </SimpleGrid>
                                ) : topPlayers.qb.length === 0 && topPlayers.rb.length === 0 && topPlayers.wr.length === 0 && topPlayers.te.length === 0 ? (
                                    <Text c="dimmed" ta="center" py="xl">
                                        No data available. Try selecting a different stat type.
                                        <br />
                                        <Text size="xs" c="dimmed" mt="xs">
                                            QB: {topPlayers.qb.length}, RB: {topPlayers.rb.length}, WR: {topPlayers.wr.length}, TE: {topPlayers.te.length}
                                        </Text>
                                    </Text>
                                ) : (
                                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                                        {/* QBs */}
                                        <Box>
                                            <Text size="sm" fw={700} c="red" mb="md" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
                                                Quarterbacks
                                            </Text>
                                            <Stack gap="md">
                                                {topPlayers.qb.length === 0 ? (
                                                    <Text size="sm" c="dimmed" ta="center" py="md">No QBs found</Text>
                                                ) : (
                                                    topPlayers.qb.map((p, i) => (
                                                    <PlayerPerformanceCard
                                                        key={p.player_id || p.gsis_id || i}
                                                        player={p.player_display_name || p.player || 'Unknown'}
                                                        playerId={p.player_id || p.gsis_id}
                                                        rank={i + 1}
                                                        position="QB"
                                                        team={p.recent_team || p.team}
                                                        stats={{ ...p, gsis_id: p.gsis_id || p.player_id }}
                                                        statType={statType}
                                                    />
                                                    ))
                                                )}
                                            </Stack>
                                        </Box>

                                        {/* RBs */}
                                        <Box>
                                            <Text size="sm" fw={700} c="blue" mb="md" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
                                                Running Backs
                                            </Text>
                                            <Stack gap="md">
                                                {topPlayers.rb.length === 0 ? (
                                                    <Text size="sm" c="dimmed" ta="center" py="md">No RBs found</Text>
                                                ) : (
                                                    topPlayers.rb.map((p, i) => (
                                                    <PlayerPerformanceCard
                                                        key={p.player_id || p.gsis_id || i}
                                                        player={p.player_display_name || p.player || 'Unknown'}
                                                        playerId={p.player_id || p.gsis_id}
                                                        rank={i + 1}
                                                        position="RB"
                                                        team={p.recent_team || p.team}
                                                        stats={{ ...p, gsis_id: p.gsis_id || p.player_id }}
                                                        statType={statType}
                                                    />
                                                    ))
                                                )}
                                            </Stack>
                                        </Box>

                                        {/* WRs */}
                                        <Box>
                                            <Text size="sm" fw={700} c="green" mb="md" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
                                                Wide Receivers
                                            </Text>
                                            <Stack gap="md">
                                                {topPlayers.wr.length === 0 ? (
                                                    <Text size="sm" c="dimmed" ta="center" py="md">No WRs found</Text>
                                                ) : (
                                                    topPlayers.wr.map((p, i) => (
                                                    <PlayerPerformanceCard
                                                        key={p.player_id || p.gsis_id || i}
                                                        player={p.player_display_name || p.player || 'Unknown'}
                                                        playerId={p.player_id || p.gsis_id}
                                                        rank={i + 1}
                                                        position="WR"
                                                        team={p.recent_team || p.team}
                                                        stats={{ ...p, gsis_id: p.gsis_id || p.player_id }}
                                                        statType={statType}
                                                    />
                                                    ))
                                                )}
                                            </Stack>
                                        </Box>

                                        {/* TEs */}
                                        <Box>
                                            <Text size="sm" fw={700} c="orange" mb="md" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
                                                Tight Ends
                                            </Text>
                                            <Stack gap="md">
                                                {topPlayers.te.length === 0 ? (
                                                    <Text size="sm" c="dimmed" ta="center" py="md">No TEs found</Text>
                                                ) : (
                                                    topPlayers.te.map((p, i) => (
                                                    <PlayerPerformanceCard
                                                        key={p.player_id || p.gsis_id || i}
                                                        player={p.player_display_name || p.player || 'Unknown'}
                                                        playerId={p.player_id || p.gsis_id}
                                                        rank={i + 1}
                                                        position="TE"
                                                        team={p.recent_team || p.team}
                                                        stats={{ ...p, gsis_id: p.gsis_id || p.player_id }}
                                                        statType={statType}
                                                    />
                                                    ))
                                                )}
                                            </Stack>
                                        </Box>
                                    </SimpleGrid>
                                )}
                            </Paper>
                        </Grid.Col>
                    </Grid>

                    {/* Features Section */}
                    <Box mt={50}>
                        <Title order={3} ta="center" mb="md">Powered by Advanced Analytics</Title>
                        <Text c="dimmed" ta="center" mb="xl" maw={600} mx="auto">
                            Comprehensive NFL data including NextGen Stats, EPA metrics, and more.
                        </Text>
                        
                        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                            <Paper shadow="xs" p="lg" radius="md" withBorder ta="center">
                                <ThemeIcon size={50} radius="xl" color="cyan" variant="light" mx="auto" mb="md">
                                    <IconStarFilled size={24} />
                                </ThemeIcon>
                                <Title order={5} mb="xs">NextGen Stats</Title>
                                <Text size="sm" c="dimmed">
                                    Separation, cushion, time to throw, expected yards, and more advanced tracking data.
                                </Text>
                            </Paper>

                            <Paper shadow="xs" p="lg" radius="md" withBorder ta="center">
                                <ThemeIcon size={50} radius="xl" color="violet" variant="light" mx="auto" mb="md">
                                    <IconChartBar size={24} />
                                </ThemeIcon>
                                <Title order={5} mb="xs">EPA & Advanced Metrics</Title>
                                <Text size="sm" c="dimmed">
                                    Expected Points Added, CPOE, target share, air yards, WOPR, and efficiency metrics.
                                </Text>
                            </Paper>

                            <Paper shadow="xs" p="lg" radius="md" withBorder ta="center">
                                <ThemeIcon size={50} radius="xl" color="teal" variant="light" mx="auto" mb="md">
                                    <IconUsers size={24} />
                                </ThemeIcon>
                                <Title order={5} mb="xs">Player Similarity</Title>
                                <Text size="sm" c="dimmed">
                                    Find players with similar statistical profiles for comparison and analysis.
                                </Text>
                            </Paper>
                        </SimpleGrid>
                    </Box>
                </Container>

            {/* Footer */}
                <Box bg="gray.8" py="xl" mt={50}>
                    <Container size="lg">
                        <Group justify="space-between" align="center">
                            <Box>
                                <Text size="lg" fw={600} c="white" mb={4}>🏈 NFL Data Hub</Text>
                                <Text size="sm" c="gray.5">
                        Data sourced from{' '}
                                    <Text 
                                        component="a" 
                            href="https://nflverse.nflverse.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                                        c="blue.4"
                                        style={{ textDecoration: 'none' }}
                        >
                            nflverse
                                    </Text>
                        , an open-source collection of NFL data packages.
                                </Text>
                            </Box>
                            <Group gap="lg">
                                <Button component={Link} to="/player-stats" variant="subtle" color="gray" size="sm">
                                    Players
                                </Button>
                                <Button component={Link} to="/games" variant="subtle" color="gray" size="sm">
                                    Scores
                                </Button>
                                <Button component={Link} to="/teams" variant="subtle" color="gray" size="sm">
                                    Teams
                                </Button>
                            </Group>
                        </Group>
                    </Container>
                </Box>
            </Box>

            {/* CSS for hover effect */}
            <style>{`
                .hover-lift:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.1);
                }
            `}</style>
        </Box>
    );
}

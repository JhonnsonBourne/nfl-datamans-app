import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Container, Title, Text, Group, Paper, Badge, Grid, Stack, Box,
    Card, Image, Avatar, Skeleton, Pagination, Select, Input
} from '@mantine/core';
import { IconCalendar, IconUser, IconTag, IconSearch } from '@tabler/icons-react';
import { getArticles } from '../services/api';

export default function Articles() {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 12;

    useEffect(() => {
        loadArticles();
    }, [currentPage]);

    const loadArticles = async () => {
        try {
            setLoading(true);
            setError(null);
            const offset = (currentPage - 1) * itemsPerPage;
            const result = await getArticles(true, itemsPerPage, offset);
            setArticles(result.data || []);
            setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
        } catch (err) {
            console.error('Failed to load articles:', err);
            setError('Failed to load articles. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    // Filter articles by search and category
    const filteredArticles = articles.filter(article => {
        const matchesSearch = !searchQuery || 
            article.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.content?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = selectedCategory === 'all' || 
            article.category?.toLowerCase() === selectedCategory.toLowerCase();
        
        return matchesSearch && matchesCategory;
    });

    // Get unique categories
    const categories = ['all', ...new Set(articles.map(a => a.category).filter(Boolean))];

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    };

    return (
        <Container size="xl" py="xl">
            <Group justify="space-between" align="center" mb="xl">
                <Title order={1}>📝 Articles & Blog Posts</Title>
            </Group>

            {error && (
                <Paper p="md" mb="md" withBorder style={{ backgroundColor: '#fee' }}>
                    <Text c="red">{error}</Text>
                </Paper>
            )}

            {/* Search and Filter */}
            <Paper shadow="sm" p="md" mb="xl" withBorder>
                <Grid>
                    <Grid.Col span={{ base: 12, sm: 8 }}>
                        <Input
                            placeholder="Search articles..."
                            leftSection={<IconSearch size={16} />}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                        <Select
                            placeholder="All Categories"
                            data={categories.map(cat => ({ value: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) }))}
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                        />
                    </Grid.Col>
                </Grid>
            </Paper>

            {/* Articles Grid */}
            {loading ? (
                <Grid>
                    {[...Array(6)].map((_, i) => (
                        <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}>
                            <Card shadow="sm" padding="lg" radius="md" withBorder>
                                <Skeleton height={200} mb="md" />
                                <Skeleton height={20} mb="xs" />
                                <Skeleton height={16} mb="md" />
                                <Skeleton height={12} count={3} />
                            </Card>
                        </Grid.Col>
                    ))}
                </Grid>
            ) : filteredArticles.length === 0 ? (
                <Paper p="xl" withBorder ta="center">
                    <Text size="lg" c="dimmed">No articles found.</Text>
                    {searchQuery && (
                        <Text size="sm" c="dimmed" mt="xs">
                            Try adjusting your search or filters.
                        </Text>
                    )}
                </Paper>
            ) : (
                <>
                    <Grid>
                        {filteredArticles.map((article) => (
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
                                        transition: 'transform 0.2s, box-shadow 0.2s',
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
                                            <Image
                                                src={article.featured_image}
                                                height={200}
                                                alt={article.title}
                                                fallbackSrc="https://via.placeholder.com/400x200?text=NFL+Article"
                                            />
                                        </Card.Section>
                                    )}
                                    
                                    <Stack gap="xs" mt="md" style={{ flex: 1 }}>
                                        <Group gap="xs" justify="space-between">
                                            <Badge color="blue" variant="light">
                                                {article.category || 'General'}
                                            </Badge>
                                            <Group gap="xs">
                                                <IconCalendar size={14} />
                                                <Text size="xs" c="dimmed">
                                                    {formatDate(article.created_at)}
                                                </Text>
                                            </Group>
                                        </Group>
                                        
                                        <Title order={3} lineClamp={2} style={{ minHeight: 56 }}>
                                            {article.title}
                                        </Title>
                                        
                                        <Text size="sm" c="dimmed" lineClamp={3} style={{ flex: 1 }}>
                                            {article.excerpt || 'No excerpt available...'}
                                        </Text>
                                        
                                        <Group gap="xs" mt="auto">
                                            <Avatar size="sm" radius="xl">
                                                {article.author?.charAt(0) || 'A'}
                                            </Avatar>
                                            <Text size="xs" c="dimmed">
                                                {article.author || 'Admin'}
                                            </Text>
                                        </Group>
                                        
                                        {article.tags && article.tags.length > 0 && (
                                            <Group gap="xs" mt="xs">
                                                {article.tags.slice(0, 3).map((tag, idx) => (
                                                    <Badge key={idx} size="xs" variant="dot">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </Group>
                                        )}
                                    </Stack>
                                </Card>
                            </Grid.Col>
                        ))}
                    </Grid>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <Group justify="center" mt="xl">
                            <Pagination
                                value={currentPage}
                                onChange={setCurrentPage}
                                total={totalPages}
                                size="md"
                                radius="md"
                            />
                        </Group>
                    )}
                </>
            )}
        </Container>
    );
}




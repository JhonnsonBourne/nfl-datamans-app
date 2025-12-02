import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    Container, Title, Text, Group, Paper, Badge, Stack, Box,
    Avatar, Skeleton, Breadcrumbs, Divider, ActionIcon
} from '@mantine/core';
import { IconCalendar, IconUser, IconTag, IconArrowLeft, IconShare2 } from '@tabler/icons-react';
import { getArticle } from '../services/api';

export default function ArticleDetail() {
    const { articleId } = useParams();
    const navigate = useNavigate();
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (articleId) {
            loadArticle();
        }
    }, [articleId]);

    const loadArticle = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getArticle(articleId);
            setArticle(result.data);
        } catch (err) {
            console.error('Failed to load article:', err);
            setError('Article not found or failed to load.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: article?.title,
                text: article?.excerpt,
                url: window.location.href,
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    if (loading) {
        return (
            <Container size="lg" py="xl">
                <Skeleton height={400} mb="md" />
                <Skeleton height={40} mb="md" />
                <Skeleton height={20} mb="md" />
                <Skeleton height={16} count={10} />
            </Container>
        );
    }

    if (error || !article) {
        return (
            <Container size="lg" py="xl">
                <Paper p="xl" withBorder ta="center">
                    <Text size="lg" c="red" mb="md">{error || 'Article not found'}</Text>
                    <Link to="/articles" style={{ color: 'var(--mantine-color-blue-6)' }}>
                        ← Back to Articles
                    </Link>
                </Paper>
            </Container>
        );
    }

    return (
        <Container size="lg" py="xl">
            {/* Breadcrumbs */}
            <Breadcrumbs mb="md">
                <Link to="/" style={{ color: 'var(--mantine-color-blue-6)', textDecoration: 'none' }}>
                    Home
                </Link>
                <Link to="/articles" style={{ color: 'var(--mantine-color-blue-6)', textDecoration: 'none' }}>
                    Articles
                </Link>
                <Text c="dimmed">{article.title}</Text>
            </Breadcrumbs>

            {/* Back Button */}
            <Group mb="xl">
                <ActionIcon
                    variant="subtle"
                    onClick={() => navigate('/articles')}
                    size="lg"
                >
                    <IconArrowLeft size={20} />
                </ActionIcon>
                <Text c="dimmed">Back to Articles</Text>
            </Group>

            {/* Article Header */}
            <Paper shadow="sm" p="xl" mb="xl" radius="md" withBorder>
                <Stack gap="md">
                    <Group justify="space-between" wrap="wrap">
                        <Badge color="blue" size="lg" variant="light">
                            {article.category || 'General'}
                        </Badge>
                        <Group gap="md">
                            <Group gap="xs">
                                <IconCalendar size={16} />
                                <Text size="sm" c="dimmed">
                                    {formatDate(article.created_at)}
                                </Text>
                            </Group>
                            <ActionIcon variant="subtle" onClick={handleShare}>
                                <IconShare2 size={18} />
                            </ActionIcon>
                        </Group>
                    </Group>

                    <Title order={1} size="h1">
                        {article.title}
                    </Title>

                    {article.excerpt && (
                        <Text size="lg" c="dimmed" style={{ fontStyle: 'italic' }}>
                            {article.excerpt}
                        </Text>
                    )}

                    <Group gap="md">
                        <Avatar size="md" radius="xl">
                            {article.author?.charAt(0) || 'A'}
                        </Avatar>
                        <Box>
                            <Text size="sm" fw={500}>
                                {article.author || 'Admin'}
                            </Text>
                            <Text size="xs" c="dimmed">
                                Author
                            </Text>
                        </Box>
                    </Group>

                    {article.tags && article.tags.length > 0 && (
                        <Group gap="xs" mt="md">
                            <IconTag size={16} style={{ opacity: 0.6 }} />
                            {article.tags.map((tag, idx) => (
                                <Badge key={idx} variant="dot" size="sm">
                                    {tag}
                                </Badge>
                            ))}
                        </Group>
                    )}
                </Stack>
            </Paper>

            {/* Featured Image */}
            {article.featured_image && (
                <Box mb="xl">
                    <img
                        src={article.featured_image}
                        alt={article.title}
                        style={{
                            width: '100%',
                            maxHeight: '500px',
                            objectFit: 'cover',
                            borderRadius: '8px'
                        }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                </Box>
            )}

            {/* Article Content */}
            <Paper shadow="sm" p="xl" radius="md" withBorder>
                <Box
                    className="prose prose-lg max-w-none"
                    style={{
                        lineHeight: 1.8,
                        fontSize: '1.1rem',
                    }}
                    dangerouslySetInnerHTML={{ __html: article.content }}
                />
            </Paper>

            {/* Article Footer */}
            <Paper shadow="sm" p="md" mt="xl" radius="md" withBorder>
                <Group justify="space-between" wrap="wrap">
                    <Text size="sm" c="dimmed">
                        Last updated: {formatDate(article.updated_at)}
                    </Text>
                    <Group gap="xs">
                        <Text size="sm" c="dimmed">Share:</Text>
                        <ActionIcon variant="subtle" onClick={handleShare}>
                            <IconShare2 size={18} />
                        </ActionIcon>
                    </Group>
                </Group>
            </Paper>

            {/* Related Articles / Navigation */}
            <Paper shadow="sm" p="md" mt="xl" radius="md" withBorder>
                <Group justify="center">
                    <Link 
                        to="/articles" 
                        style={{ 
                            color: 'var(--mantine-color-blue-6)', 
                            textDecoration: 'none',
                            fontWeight: 500
                        }}
                    >
                        ← View All Articles
                    </Link>
                </Group>
            </Paper>
        </Container>
    );
}




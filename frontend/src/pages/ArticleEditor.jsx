import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Title, Paper, Button, Group, Textarea, Select, Switch, TagsInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import TipTapEditor from '../components/TipTapEditor';
import { createArticle, updateArticle, getArticle } from '../services/api';

/**
 * Article Editor Page - Demo of TipTap integration
 * This can be expanded to include article management, saving, etc.
 */
export default function ArticleEditor() {
    const { articleId } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState('<p>Start writing your article...</p>');
    const [title, setTitle] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [category, setCategory] = useState('General');
    const [tags, setTags] = useState([]);
    const [published, setPublished] = useState(false);
    const [featuredImage, setFeaturedImage] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    const categories = ['General', 'Analysis', 'News', 'Fantasy', 'Betting', 'Team Focus', 'Player Focus'];

    useEffect(() => {
        if (articleId) {
            loadArticle();
        }
    }, [articleId]);

    const loadArticle = async () => {
        try {
            setLoading(true);
            const result = await getArticle(articleId);
            const article = result.data;
            setTitle(article.title || '');
            setExcerpt(article.excerpt || '');
            setContent(article.content || '<p>Start writing your article...</p>');
            setCategory(article.category || 'General');
            setTags(article.tags || []);
            setPublished(article.published || false);
            setFeaturedImage(article.featured_image || '');
        } catch (err) {
            console.error('Failed to load article:', err);
            notifications.show({
                title: 'Error',
                message: 'Failed to load article',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (publish = false) => {
        if (!title.trim()) {
            notifications.show({
                title: 'Error',
                message: 'Please enter a title',
                color: 'red',
            });
            return;
        }

        try {
            setSaving(true);
            const articleData = {
                title: title.trim(),
                excerpt: excerpt.trim(),
                content: content,
                category: category,
                tags: tags,
                published: publish ? true : published,
                featured_image: featuredImage.trim(),
                author: 'Admin',
            };

            let result;
            if (articleId) {
                result = await updateArticle(articleId, articleData);
            } else {
                result = await createArticle(articleData);
            }

            notifications.show({
                title: publish ? 'Article Published' : 'Article Saved',
                message: publish 
                    ? 'Your article has been published successfully!' 
                    : 'Your article has been saved as draft.',
                color: 'green',
            });

            if (!articleId && result.data?.id) {
                navigate(`/articles/${result.data.id}`);
            }
        } catch (err) {
            console.error('Failed to save article:', err);
            notifications.show({
                title: 'Error',
                message: 'Failed to save article. Please try again.',
                color: 'red',
            });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = () => {
        handleSave(true);
    };

    if (loading) {
        return (
            <Container size="lg" py="xl">
                <Title order={1} mb="xl">Loading Article...</Title>
            </Container>
        );
    }

    return (
        <Container size="lg" py="xl">
            <Title order={1} mb="xl">{articleId ? 'Edit Article' : 'Create New Article'}</Title>
            
            <Paper shadow="sm" p="md" withBorder mb="md">
                <Textarea
                    label="Title"
                    placeholder="Enter article title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    mb="md"
                    required
                />
                <Textarea
                    label="Excerpt"
                    placeholder="Enter article excerpt (will be shown in previews)..."
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    rows={3}
                    mb="md"
                />
                <Group grow>
                    <Select
                        label="Category"
                        data={categories}
                        value={category}
                        onChange={setCategory}
                    />
                    <Textarea
                        label="Featured Image URL"
                        placeholder="https://example.com/image.jpg"
                        value={featuredImage}
                        onChange={(e) => setFeaturedImage(e.target.value)}
                        rows={1}
                    />
                </Group>
                <TagsInput
                    label="Tags"
                    placeholder="Add tags..."
                    value={tags}
                    onChange={setTags}
                    mt="md"
                />
                <Switch
                    label="Published"
                    checked={published}
                    onChange={(e) => setPublished(e.currentTarget.checked)}
                    mt="md"
                />
            </Paper>

            <Paper shadow="sm" p="md" withBorder mb="md">
                <TipTapEditor
                    content={content}
                    onChange={(newContent) => setContent(newContent)}
                    placeholder="Start writing your article..."
                />
            </Paper>

            <Group justify="flex-end" mt="md">
                <Button 
                    variant="outline" 
                    onClick={() => {
                        if (!articleId) {
                            setContent('<p>Start writing your article...</p>');
                            setTitle('');
                            setExcerpt('');
                            setTags([]);
                            setFeaturedImage('');
                            setPublished(false);
                        } else {
                            navigate(`/articles/${articleId}`);
                        }
                    }}
                >
                    {articleId ? 'Cancel' : 'Clear'}
                </Button>
                <Button 
                    variant="light" 
                    onClick={() => handleSave(false)}
                    loading={saving}
                >
                    Save Draft
                </Button>
                <Button 
                    onClick={handlePublish}
                    loading={saving}
                    disabled={!title.trim()}
                >
                    {published ? 'Update' : 'Publish'}
                </Button>
            </Group>

            {/* Preview (optional) */}
            {content && (
                <Paper shadow="sm" p="md" withBorder mt="xl">
                    <Title order={3} mb="md">Preview</Title>
                    <div 
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{ __html: content }}
                    />
                </Paper>
            )}
        </Container>
    );
}





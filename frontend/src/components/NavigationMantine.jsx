import { Link, useLocation } from 'react-router-dom';
import { Group, Button, Stack, Burger, Box, Container } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

export default function Navigation() {
    const location = useLocation();
    const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);

    const navItems = [
        { path: '/', label: 'Home', icon: '🏈' },
        { path: '/games', label: 'Scores', icon: '📺' },
        { path: '/player-stats', label: 'Players', icon: '📊' },
        { path: '/teams', label: 'Teams', icon: '🛡️' },
        { path: '/articles', label: 'Articles', icon: '📝' },
    ];

    return (
        <Box 
            component="nav"
            style={{ 
                backgroundColor: '#1e3a8a', 
                color: 'white', 
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                borderBottom: '1px solid #1e40af'
            }}
        >
            <Container size="xl" px="md">
                <Group h={64} justify="space-between" wrap="nowrap">
                    {/* Logo */}
                    <Link 
                        to="/" 
                        style={{ 
                            textDecoration: 'none', 
                            color: 'inherit',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexShrink: 0
                        }}
                    >
                        <span style={{ fontSize: '1.5rem' }}>🏈</span>
                        <span style={{ 
                            fontWeight: 600, 
                            fontSize: '1.25rem',
                            whiteSpace: 'nowrap'
                        }}>
                            NFL Data Hub
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <Group gap="xs" visibleFrom="sm" style={{ flex: 1, justifyContent: 'flex-end' }}>
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Button
                                    key={item.path}
                                    component={Link}
                                    to={item.path}
                                    variant={isActive ? 'filled' : 'subtle'}
                                    color={isActive ? 'white' : 'gray'}
                                    leftSection={<span>{item.icon}</span>}
                                    size="sm"
                                    styles={{
                                        root: {
                                            flexShrink: 0,
                                            color: 'white',
                                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                                        }
                                    }}
                                >
                                    {item.label}
                                </Button>
                            );
                        })}
                    </Group>

                    {/* Mobile menu button */}
                    <Burger 
                        opened={mobileOpened} 
                        onClick={toggleMobile} 
                        hiddenFrom="sm" 
                        size="sm"
                        color="white"
                    />
                </Group>

                {/* Mobile menu */}
                {mobileOpened && (
                    <Stack gap="xs" pb="md">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Button
                                    key={item.path}
                                    component={Link}
                                    to={item.path}
                                    variant={isActive ? 'filled' : 'subtle'}
                                    color={isActive ? 'blue' : 'gray'}
                                    leftSection={<span>{item.icon}</span>}
                                    fullWidth
                                    justify="flex-start"
                                    onClick={toggleMobile}
                                    styles={{ root: { color: 'white' } }}
                                >
                                    {item.label}
                                </Button>
                            );
                        })}
                    </Stack>
                )}
            </Container>
        </Box>
    );
}


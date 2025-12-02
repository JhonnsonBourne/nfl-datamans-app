/**
 * 🤖 AGENT NOTE: Before modifying this file, read AGENT_INSTRUCTIONS.md
 *    Update WORK_IN_PROGRESS.md with your changes using: python agent_sync.py --update "description"
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Navigation from './components/NavigationMantine';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorLogViewer from './components/ErrorLogViewer';
import { Skeleton, Box } from '@mantine/core';

// Code splitting: Lazy load route components
const Home = lazy(() => import('./pages/Home'));
const PlayerStats = lazy(() => import('./pages/PlayerStatsTanStack'));
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'));
const PlayerComparison = lazy(() => import('./pages/PlayerComparison'));
const Leaderboards = lazy(() => import('./pages/Leaderboards'));
const TeamStats = lazy(() => import('./pages/TeamStats'));
const Games = lazy(() => import('./pages/Games'));
const GameDetail = lazy(() => import('./pages/GameDetail'));
const Articles = lazy(() => import('./pages/Articles'));
const ArticleDetail = lazy(() => import('./pages/ArticleDetail'));
const ArticleEditor = lazy(() => import('./pages/ArticleEditor'));

// Loading fallback component
const LoadingFallback = () => (
  <Box p="xl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Skeleton height={50} width="100%" radius="md" />
  </Box>
);

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <ErrorBoundary>
            <Navigation />
          </ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
              <Route path="/player-stats" element={<ErrorBoundary><PlayerStats /></ErrorBoundary>} />
              <Route path="/player/:playerId" element={<ErrorBoundary><PlayerProfile /></ErrorBoundary>} />
              <Route path="/comparison" element={<ErrorBoundary><PlayerComparison /></ErrorBoundary>} />
              <Route path="/leaderboards" element={<ErrorBoundary><Leaderboards /></ErrorBoundary>} />
              <Route path="/teams" element={<ErrorBoundary><TeamStats /></ErrorBoundary>} />
              <Route path="/games" element={<ErrorBoundary><Games /></ErrorBoundary>} />
              <Route path="/game/:gameId" element={<ErrorBoundary><GameDetail /></ErrorBoundary>} />
              <Route path="/articles" element={<ErrorBoundary><Articles /></ErrorBoundary>} />
              <Route path="/articles/:articleId" element={<ErrorBoundary><ArticleDetail /></ErrorBoundary>} />
              <Route path="/articles/editor" element={<ErrorBoundary><ArticleEditor /></ErrorBoundary>} />
              <Route path="/articles/editor/:articleId" element={<ErrorBoundary><ArticleEditor /></ErrorBoundary>} />
            </Routes>
          </Suspense>
          <ErrorLogViewer />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

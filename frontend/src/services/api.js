import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Error reporting function
export const reportError = async (error, context = {}) => {
    try {
        const errorMessage = error?.message || String(error);
        const errorStack = error?.stack || '';
        
        await api.post('/debug/report-error', {
            error: errorMessage,
            traceback: errorStack,
            context: {
                ...context,
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
        });
    } catch (reportErr) {
        // Silently fail - don't break the app if error reporting fails
        console.error('Failed to report error:', reportErr);
    }
};

// Add axios interceptor to catch and report API errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Report API errors
        await reportError(error, {
            type: 'API_ERROR',
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            statusText: error.response?.statusText,
        });
        return Promise.reject(error);
    }
);

export const getDatasets = async () => {
    const response = await api.get('/v1/datasets');
    return response.data;
};

export const getPlayerStats = async (seasons = [2024], limit = 100, includeNgs = true, ngsStatType = 'receiving') => {
    const params = new URLSearchParams();
    seasons.forEach(s => params.append('seasons', s));
    if (limit) params.append('limit', limit);
    // Always include NextGen Stats (default is now True on backend)
    if (includeNgs) {
        params.append('include_ngs', 'true');
        params.append('ngs_stat_type', ngsStatType);
    }
    const response = await api.get(`/v1/data/player_stats?${params.toString()}`);
    return response.data;
};

export const getLeaderboards = async (season = 2025, position = null, metric = 'fantasy_points_ppr', limit = 20, sortBy = null) => {
    const params = new URLSearchParams();
    params.append('season', season);
    if (position) params.append('position', position);
    params.append('metric', metric);
    params.append('limit', limit);
    if (sortBy) params.append('sort_by', sortBy);
    const response = await api.get(`/v1/leaderboards?${params.toString()}`);
    return response.data;
};

export const getTopPlayers = async (season = 2025, position = null, metric = 'fantasy_points_ppr', limit = 5, volumeFilters = {}) => {
    const params = new URLSearchParams();
    params.append('season', season);
    if (position) params.append('position', position);
    params.append('metric', metric);
    params.append('limit', limit);
    if (volumeFilters.min_attempts) params.append('min_attempts', volumeFilters.min_attempts);
    if (volumeFilters.min_carries) params.append('min_carries', volumeFilters.min_carries);
    if (volumeFilters.min_routes) params.append('min_routes', volumeFilters.min_routes);
    if (volumeFilters.min_targets) params.append('min_targets', volumeFilters.min_targets);
    const response = await api.get(`/v1/leaderboards/top?${params.toString()}`);
    return response.data;
};

export const getTopPlayersBatch = async (season = 2025, metrics = {}, limit = 5, volumeFilters = {}) => {
    // metrics should be { QB: 'metric1', RB: 'metric2', WR: 'metric3', TE: 'metric4' }
    const metricsStr = `${metrics.QB || 'fantasy_points_ppr'},${metrics.RB || 'fantasy_points_ppr'},${metrics.WR || 'fantasy_points_ppr'},${metrics.TE || 'fantasy_points_ppr'}`;
    const params = new URLSearchParams();
    params.append('season', season);
    params.append('metrics', metricsStr);
    params.append('limit', limit);
    if (volumeFilters.min_attempts) params.append('min_attempts', volumeFilters.min_attempts);
    if (volumeFilters.min_carries) params.append('min_carries', volumeFilters.min_carries);
    if (volumeFilters.min_routes) params.append('min_routes', volumeFilters.min_routes);
    if (volumeFilters.min_targets) params.append('min_targets', volumeFilters.min_targets);
    const response = await api.get(`/v1/leaderboards/top/batch?${params.toString()}`);
    return response.data;
};

// Get all players (for search/autocomplete)
export const getPlayers = async () => {
    const response = await api.get('/v1/players');
    return response.data;
};

// Get detailed player profile
export const getPlayerProfile = async (playerId, seasons = null) => {
    const params = new URLSearchParams();
    if (seasons) {
        seasons.forEach(s => params.append('seasons', s));
    }
    const response = await api.get(`/v1/player/${playerId}?${params.toString()}`);
    return response.data;
};

// Get similar players (optimized backend calculation)
export const getSimilarPlayers = async (playerId, position, type = 'career', limit = 3, season = 2025) => {
    const params = new URLSearchParams();
    params.append('position', position);
    params.append('type', type);
    params.append('limit', limit);
    if (type === 'season') {
        params.append('season', season);
    }
    const response = await api.get(`/v1/player/${playerId}/similar?${params.toString()}`);
    return response.data;
};

// Search players by name
export const searchPlayers = async (query) => {
    try {
        const response = await api.get('/v1/players');
        const players = response.data.data || [];
        const lowerQuery = query.toLowerCase();
        return players.filter(p => {
            const name = p.display_name || p.name || p.full_name || '';
            return name.toLowerCase().includes(lowerQuery);
        }).slice(0, 20); // Limit to 20 results
    } catch (error) {
        console.error('Player search failed:', error);
        return [];
    }
};

// Get schedule data
export const getSchedule = async (season = 2025, week = 1, includeLeaders = false) => {
    const params = new URLSearchParams();
    params.append('season', season);
    params.append('week', week);
    if (includeLeaders) {
        params.append('include_leaders', 'true');
    }
    const response = await api.get(`/v1/schedule?${params.toString()}`);
    return response.data;
};

// Get game details
export const getGameDetail = async (season, week, awayTeam, homeTeam) => {
    const response = await api.get(`/v1/game/${season}/${week}/${awayTeam}/${homeTeam}`);
    return response.data;
};

// Get team stats (comprehensive stats including EPA from PBP)
// gameType: 'REG' (regular season), 'POST' (playoffs), 'ALL' (all games)
export const getTeamStats = async (season = 2025, gameType = 'REG') => {
    const response = await api.get(`/v1/team_stats?season=${season}&game_type=${gameType}`);
    return response.data;
};

// Get strength of schedule data
// gameType: 'REG' (regular season), 'POST' (playoffs), 'ALL' (all games)
export const getStrengthOfSchedule = async (season = 2025, gameType = 'REG') => {
    const response = await api.get(`/v1/strength_of_schedule?season=${season}&game_type=${gameType}`);
    return response.data;
};

// Articles/Blog Posts API
export const getArticles = async (publishedOnly = true, limit = 100, offset = 0) => {
    const response = await api.get(`/v1/articles?published_only=${publishedOnly}&limit=${limit}&offset=${offset}`);
    return response.data;
};

export const getArticle = async (articleId) => {
    const response = await api.get(`/v1/articles/${articleId}`);
    return response.data;
};

export const createArticle = async (articleData) => {
    const response = await api.post('/v1/articles', articleData);
    return response.data;
};

export const updateArticle = async (articleId, articleData) => {
    const response = await api.put(`/v1/articles/${articleId}`, articleData);
    return response.data;
};

export const deleteArticle = async (articleId) => {
    const response = await api.delete(`/v1/articles/${articleId}`);
    return response.data;
};

export default api;

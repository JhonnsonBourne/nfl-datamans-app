import { useQuery } from '@tanstack/react-query';
import { getLeaderboards } from '../services/api';

/**
 * React Query hook for fetching leaderboards with caching
 */
export const useLeaderboards = (season = 2025, position = null, metric = 'fantasy_points_ppr', limit = 20, sortBy = null) => {
  return useQuery({
    queryKey: ['leaderboards', season, position, metric, limit, sortBy],
    queryFn: () => getLeaderboards(season, position, metric, limit, sortBy),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};




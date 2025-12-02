import { useQuery } from '@tanstack/react-query';
import { getPlayerStats } from '../services/api';

/**
 * React Query hook for fetching player stats with caching
 */
export const usePlayerStats = (seasons = [2025], limit = 1000, includeNgs = false, ngsStatType = 'receiving') => {
  return useQuery({
    queryKey: ['playerStats', seasons, limit, includeNgs, ngsStatType],
    queryFn: () => getPlayerStats(seasons, limit, includeNgs, ngsStatType),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};




import { useQuery } from '@tanstack/react-query';
import { getTeamStats } from '../services/api';

/**
 * React Query hook for fetching team stats with caching
 */
export const useTeamStats = (season = 2025, gameType = 'REG') => {
  return useQuery({
    queryKey: ['teamStats', season, gameType],
    queryFn: () => getTeamStats(season, gameType),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};




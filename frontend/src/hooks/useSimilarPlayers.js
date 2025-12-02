import { useQuery } from '@tanstack/react-query';
import { getSimilarPlayers } from '../services/api';

/**
 * React Query hook for fetching similar players with caching
 */
export const useSimilarPlayers = (playerId, position, type = 'season', limit = 10, season = 2025) => {
  return useQuery({
    queryKey: ['similarPlayers', playerId, position, type, limit, season],
    queryFn: () => getSimilarPlayers(playerId, position, type, limit, season),
    enabled: !!playerId && !!position, // Only fetch if playerId and position exist
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};




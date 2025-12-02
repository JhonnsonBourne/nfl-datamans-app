import { useQuery } from '@tanstack/react-query';
import { getPlayerProfile } from '../services/api';

/**
 * React Query hook for fetching player profile with caching
 */
export const usePlayerProfile = (playerId, seasons = null) => {
  return useQuery({
    queryKey: ['playerProfile', playerId, seasons],
    queryFn: () => getPlayerProfile(playerId, seasons),
    enabled: !!playerId, // Only fetch if playerId exists
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};




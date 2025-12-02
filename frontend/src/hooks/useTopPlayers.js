import { useQuery } from '@tanstack/react-query';
import { getTopPlayers } from '../services/api';

/**
 * React Query hook for fetching top players with caching
 */
export const useTopPlayers = (season = 2025, position = null, metric = 'fantasy_points_ppr', limit = 5, volumeFilters = {}) => {
  // Longer cache time for advanced stats since routes calculation is expensive
  const isAdvancedMetric = ['epa_per_dropback', 'rushing_epa_per_carry', 'epa_per_route'].includes(metric);
  const staleTime = isAdvancedMetric ? 15 * 60 * 1000 : 5 * 60 * 1000; // 15 min for advanced, 5 min for others
  
  return useQuery({
    queryKey: ['topPlayers', season, position, metric, limit, volumeFilters],
    queryFn: () => getTopPlayers(season, position, metric, limit, volumeFilters),
    staleTime,
    gcTime: 30 * 60 * 1000, // 30 minutes
    // Keep previous data while fetching new data (better UX)
    placeholderData: (previousData) => previousData,
  });
};


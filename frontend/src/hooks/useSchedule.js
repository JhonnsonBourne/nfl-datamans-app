import { useQuery } from '@tanstack/react-query';
import { getSchedule } from '../services/api';

/**
 * React Query hook for fetching schedule with caching
 */
export const useSchedule = (season = 2025, week = null, includeLeaders = false) => {
  return useQuery({
    queryKey: ['schedule', season, week, includeLeaders],
    queryFn: () => getSchedule(season, week, includeLeaders),
    staleTime: 60 * 60 * 1000, // 1 hour - schedule doesn't change often
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
};




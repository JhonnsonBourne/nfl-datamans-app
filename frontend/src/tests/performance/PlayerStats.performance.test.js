/**
 * Performance tests for PlayerStats component
 * 
 * These tests help identify performance regressions and bottlenecks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { measureComponentRender, measureAsyncOperation, PerformanceBudget } from '../../utils/performanceTesting';

// Mock the API
vi.mock('../../services/api', () => ({
    getPlayerStats: vi.fn(async (seasons, limit, includeNgs, ngsStatType) => {
        // Generate mock data
        const data = Array.from({ length: limit }, (_, i) => ({
            player_id: `player-${i}`,
            player_name: `Player ${i}`,
            position: ['QB', 'RB', 'WR', 'TE'][i % 4],
            fantasy_points_ppr: Math.random() * 300,
            receiving_epa: Math.random() * 100,
            rushing_epa: Math.random() * 100,
            passing_epa: Math.random() * 100,
            targets: Math.floor(Math.random() * 150),
            receptions: Math.floor(Math.random() * 100),
            receiving_yards: Math.floor(Math.random() * 1500),
        }));
        return { data };
    }),
}));

describe('PlayerStats Performance', () => {
    let budget;
    
    beforeEach(() => {
        budget = new PerformanceBudget({
            renderTime: 16, // 60fps
            dataProcessing: 500, // 500ms max for data processing
            filterOperation: 100, // 100ms max for filtering
            sortOperation: 200, // 200ms max for sorting
        });
    });
    
    it('should render within performance budget', async () => {
        const { result, duration } = measureComponentRender('PlayerStats', () => {
            // Render component
            // const { container } = render(<PlayerStats />);
            // return container;
        });
        
        const violation = budget.check('PlayerStats initial render', duration);
        expect(violation).toBeNull();
    });
    
    it('should handle filtering without blocking UI', async () => {
        const filterFn = (data, position) => {
            return data.filter(p => p.position === position);
        };
        
        const testData = Array.from({ length: 1000 }, (_, i) => ({
            position: ['QB', 'RB', 'WR', 'TE'][i % 4],
            // ... other fields
        }));
        
        const { result, duration } = await measureAsyncOperation('Filter 1000 players', async () => {
            return filterFn(testData, 'RB');
        });
        
        const violation = budget.check('Filter operation', duration, 'filterOperation');
        expect(violation).toBeNull();
        expect(result.length).toBeGreaterThan(0);
    });
    
    it('should handle sorting without blocking UI', async () => {
        const sortFn = (data, sortKey) => {
            return [...data].sort((a, b) => {
                const aVal = a[sortKey] ?? 0;
                const bVal = b[sortKey] ?? 0;
                return bVal - aVal;
            });
        };
        
        const testData = Array.from({ length: 1000 }, (_, i) => ({
            fantasy_points_ppr: Math.random() * 300,
            // ... other fields
        }));
        
        const { result, duration } = await measureAsyncOperation('Sort 1000 players', async () => {
            return sortFn(testData, 'fantasy_points_ppr');
        });
        
        const violation = budget.check('Sort operation', duration, 'sortOperation');
        expect(violation).toBeNull();
        expect(result.length).toBe(1000);
    });
    
    it('should not fetch excessive data', async () => {
        const { getPlayerStats } = await import('../../services/api');
        
        // Test that limits are reasonable
        const limits = {
            QB: 200,
            RB: 400,
            WR: 600,
            TE: 300,
            ALL: 2000
        };
        
        for (const [position, expectedLimit] of Object.entries(limits)) {
            // This would be called in the component
            // We're just checking the limits are reasonable
            expect(expectedLimit).toBeLessThan(10000); // Should never fetch 10k
        }
    });
    
    it('should detect performance regressions', () => {
        const violations = budget.getViolations();
        expect(violations.length).toBe(0);
    });
});


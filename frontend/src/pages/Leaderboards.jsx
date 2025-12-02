import { useState, useMemo } from 'react';
import { useLeaderboards } from '../hooks/useLeaderboards';

export default function Leaderboards() {
    const [selectedSeason, setSelectedSeason] = useState(2025);
    const [activeTab, setActiveTab] = useState('fantasy');

    const metricMap = {
        'fantasy': 'fantasy_points_ppr',
        'passing': 'passing_yards',
        'rushing': 'rushing_yards',
        'receiving': 'receiving_yards'
    };
    const metric = metricMap[activeTab] || 'fantasy_points_ppr';
    
    const { data: result, isLoading: loading, error: queryError } = useLeaderboards(
        selectedSeason,
        null,
        metric,
        20
    );
    
    const data = result?.data || [];
    const error = queryError?.message || null;

    const getTopPlayers = (metric, count = 20) => {
        // Data is already sorted from backend, just return the slice
        return data.slice(0, count);
    };

    const tabs = [
        { id: 'fantasy', label: 'Fantasy Points', metric: 'fantasy_points_ppr', format: (v) => v?.toFixed(1) },
        { id: 'passing', label: 'Passing Yards', metric: 'passing_yards', format: (v) => v },
        { id: 'rushing', label: 'Rushing Yards', metric: 'rushing_yards', format: (v) => v },
        { id: 'receiving', label: 'Receiving Yards', metric: 'receiving_yards', format: (v) => v },
    ];

    const currentTab = tabs.find(t => t.id === activeTab);
    const leaderboardData = getTopPlayers(currentTab.metric);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-nfl-blue"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">🏆 Leaderboards</h1>
                <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-4 py-2"
                >
                    {[2025, 2024, 2023, 2022, 2021, 2020].map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 mb-6 overflow-x-auto pb-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-nfl-blue text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Leaderboard Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">Rank</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{currentTab.label}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {leaderboardData.map((player, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold">
                                    {idx + 1}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {player.player_display_name || player.player}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {player.recent_team || player.team}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {player.position}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                                    {currentTab.format(player[currentTab.metric])}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

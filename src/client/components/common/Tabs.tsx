import { useStrategyStore } from '../../stores/strategyStore';

interface TabsProps {
  activeTab: 'builder' | 'optimizer' | 'results' | 'library';
  onTabChange: (tab: 'builder' | 'optimizer' | 'results' | 'library') => void;
}

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
  const { currentScenarioId, savedStrategies } = useStrategyStore();

  const tabs = [
    { id: 'builder' as const, label: '📝 Strategy Builder', icon: '📝' },
    { id: 'optimizer' as const, label: '🎯 Optimizer', icon: '🎯' },
    { id: 'results' as const, label: '📊 Simulation Results', icon: '📊' },
    { id: 'library' as const, label: '📚 Strategy Library', icon: '📚' },
  ];

  // Get the current scenario info
  const currentScenario = savedStrategies.find(s => s?.scenarioId === currentScenarioId);
  const scenarioName = currentScenario?.name || 'Business Case (Day 51)';
  const scenarioDescription = currentScenario?.description || 'Default starting conditions';

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Scenario:</span>
            <span className="text-sm font-medium text-blue-600">{scenarioName}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">{scenarioDescription}</span>
          </div>
        </div>
        <nav className="flex space-x-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 font-medium text-sm transition-all rounded-t-lg ${
                activeTab === tab.id
                  ? 'bg-gray-50 text-gray-900 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

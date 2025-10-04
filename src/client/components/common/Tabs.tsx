interface TabsProps {
  activeTab: 'builder' | 'results' | 'library' | 'optimizer';
  onTabChange: (tab: 'builder' | 'results' | 'library' | 'optimizer') => void;
}

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
  const tabs = [
    { id: 'builder' as const, label: '📝 Strategy Builder', icon: '📝' },
    { id: 'optimizer' as const, label: '🎯 Advanced Optimizer', icon: '🎯' },
    { id: 'results' as const, label: '📊 Simulation Results', icon: '📊' },
    { id: 'library' as const, label: '📚 Strategy Library', icon: '📚' },
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-6">
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

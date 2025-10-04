interface TabsProps {
  activeTab: 'builder' | 'results' | 'library';
  onTabChange: (tab: 'builder' | 'results' | 'library') => void;
}

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
  const tabs = [
    { id: 'builder' as const, label: '📝 Strategy Builder', icon: '📝' },
    { id: 'results' as const, label: '📊 Simulation Results', icon: '📊' },
    { id: 'library' as const, label: '📚 Strategy Library', icon: '📚' },
  ];

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-6">
        <nav className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-6 py-3 font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white border-t-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
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

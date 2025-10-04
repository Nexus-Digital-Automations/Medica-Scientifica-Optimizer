import { useState } from 'react';
import Layout from './components/common/Layout';
import PolicyForm from './components/strategy/PolicyForm';
import TimelineEditor from './components/strategy/TimelineEditor';
import StrategyVisualization from './components/strategy/StrategyVisualization';
import SimulationRunner from './components/simulation/SimulationRunner';
import ResultsDashboard from './components/simulation/ResultsDashboard';
import SaveStrategyButton from './components/strategy/SaveStrategyButton';
import StrategyLibrary from './components/strategy/StrategyLibrary';
import BulkOptimizer from './components/strategy/BulkOptimizer';
import AdvancedOptimizer from './components/strategy/AdvancedOptimizer';

function App() {
  const [activeTab, setActiveTab] = useState<'builder' | 'results' | 'library' | 'optimizer'>('builder');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="p-6 max-w-7xl mx-auto">
        {activeTab === 'builder' && (
          <div>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Strategy Builder
                </h2>
                <p className="text-sm text-gray-400">
                  Configure your factory's operating policies and plan timed actions
                </p>
              </div>
              <SaveStrategyButton />
            </div>

            <div className="space-y-6">
              <PolicyForm />
              <TimelineEditor />
              <StrategyVisualization />
              <SimulationRunner />
              <BulkOptimizer />
            </div>
          </div>
        )}
        {activeTab === 'results' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Simulation Results
              </h2>
              <p className="text-sm text-gray-400">
                Detailed analysis of your factory's performance
              </p>
            </div>
            <ResultsDashboard onEditStrategy={() => setActiveTab('builder')} />
          </div>
        )}
        {activeTab === 'optimizer' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                🎯 Advanced Optimizer
              </h2>
              <p className="text-sm text-gray-400">
                Configure optimization constraints and save recommended strategies
              </p>
            </div>
            <AdvancedOptimizer />
          </div>
        )}
        {activeTab === 'library' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Strategy Library
              </h2>
              <p className="text-sm text-gray-400">
                Manage your saved strategies - load, rename, or delete them
              </p>
            </div>
            <StrategyLibrary onLoadStrategy={() => setActiveTab('builder')} />
          </div>
        )}
      </div>
    </Layout>
  );
}

export default App;

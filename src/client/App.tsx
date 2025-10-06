import { useState } from 'react';
import Layout from './components/common/Layout';
import PolicyForm from './components/strategy/PolicyForm';
import TimelineEditor from './components/strategy/TimelineEditor';
import StrategyVisualization from './components/strategy/StrategyVisualization';
import SimulationRunner from './components/simulation/SimulationRunner';
import ResultsDashboard from './components/simulation/ResultsDashboard';
import SaveStrategyButton from './components/strategy/SaveStrategyButton';
import StrategyLibrary from './components/strategy/StrategyLibrary';
import OptimizerPage from './components/optimizer/OptimizerPage';
import StrategyLibraryModal from './components/common/StrategyLibraryModal';
import { useStrategyStore, type SavedStrategy } from './stores/strategyStore';

function App() {
  const [activeTab, setActiveTab] = useState<'builder' | 'optimizer' | 'results' | 'library'>('builder');
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const { loadSavedStrategy } = useStrategyStore();

  const handleLoadStrategy = (strategy: SavedStrategy) => {
    loadSavedStrategy(strategy.id);
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="p-6 max-w-7xl mx-auto">
        {activeTab === 'builder' && (
          <div>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Strategy Builder
                </h2>
                <p className="text-sm text-gray-600">
                  Configure your factory's operating policies and plan timed actions
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStrategyModal(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  📚 Load Strategy
                </button>
                <SaveStrategyButton />
              </div>
            </div>

            <div className="space-y-6">
              <PolicyForm />
              <TimelineEditor />
              <StrategyVisualization />
              <SimulationRunner />
            </div>
          </div>
        )}
        {activeTab === 'optimizer' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Optimizer
              </h2>
              <p className="text-sm text-gray-600">
                Two-phase optimization: broad exploration followed by focused refinement
              </p>
            </div>
            <OptimizerPage />
          </div>
        )}
        {activeTab === 'results' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Simulation Results
              </h2>
              <p className="text-sm text-gray-600">
                Detailed analysis of your factory's performance
              </p>
            </div>
            <ResultsDashboard onEditStrategy={() => setActiveTab('builder')} />
          </div>
        )}
        {activeTab === 'library' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Strategy Library
              </h2>
              <p className="text-sm text-gray-600">
                Manage your saved strategies - load, rename, or delete them
              </p>
            </div>
            <StrategyLibrary onLoadStrategy={() => setActiveTab('builder')} />
          </div>
        )}

        {/* Strategy Library Modal */}
        {showStrategyModal && (
          <StrategyLibraryModal
            onSelect={handleLoadStrategy}
            onClose={() => setShowStrategyModal(false)}
            title="Load Strategy for Editing"
            description="Select a strategy to load into the builder"
            selectButtonText="Load into Builder"
          />
        )}
      </div>
    </Layout>
  );
}

export default App;

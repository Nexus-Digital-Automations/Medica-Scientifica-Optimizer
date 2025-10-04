import { useState } from 'react';
import Layout from './components/common/Layout';
import PolicyForm from './components/strategy/PolicyForm';
import TimelineEditor from './components/strategy/TimelineEditor';
import SimulationRunner from './components/simulation/SimulationRunner';
import ResultsDashboard from './components/simulation/ResultsDashboard';

function App() {
  const [activeTab, setActiveTab] = useState<'builder' | 'results' | 'library'>('builder');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="p-6 max-w-7xl mx-auto">
        {activeTab === 'builder' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Strategy Builder
              </h2>
              <p className="text-sm text-gray-400">
                Configure your factory's operating policies and plan timed actions
              </p>
            </div>

            <div className="space-y-6">
              <PolicyForm />
              <TimelineEditor />
              <SimulationRunner />
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
            <ResultsDashboard />
          </div>
        )}
        {activeTab === 'library' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Strategy Library
            </h2>
            <p className="text-sm text-gray-400">Saved strategies will go here in Phase 7...</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default App;

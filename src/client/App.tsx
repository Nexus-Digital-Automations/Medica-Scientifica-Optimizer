import { useState } from 'react';
import Layout from './components/common/Layout';
import PolicyForm from './components/strategy/PolicyForm';
import TimelineEditor from './components/strategy/TimelineEditor';

function App() {
  const [activeTab, setActiveTab] = useState<'builder' | 'results' | 'library'>('builder');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="p-6">
        {activeTab === 'builder' && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">Strategy Builder</h2>
              <p className="text-gray-400">
                Configure your factory's operating policies and plan timed actions
              </p>
            </div>

            <div className="space-y-6">
              <PolicyForm />
              <TimelineEditor />
            </div>
          </div>
        )}
        {activeTab === 'results' && (
          <div className="text-white">
            <h2 className="text-2xl font-bold mb-4">Simulation Results</h2>
            <p>Charts and metrics will go here...</p>
          </div>
        )}
        {activeTab === 'library' && (
          <div className="text-white">
            <h2 className="text-2xl font-bold mb-4">Strategy Library</h2>
            <p>Saved strategies will go here...</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default App;

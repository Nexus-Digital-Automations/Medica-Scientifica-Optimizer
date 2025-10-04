import { useState } from 'react';
import Layout from './components/common/Layout';
import PolicyForm from './components/strategy/PolicyForm';

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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PolicyForm />
              </div>
              <div className="lg:col-span-1">
                <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
                  <h3 className="text-xl font-semibold text-white mb-4">Timeline</h3>
                  <p className="text-gray-400 text-sm">Timeline editor coming next...</p>
                </div>
              </div>
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

import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { SavedStrategy } from '../../stores/strategyStore';

interface StrategyLibraryProps {
  onLoadStrategy: () => void;
}

export default function StrategyLibrary({ onLoadStrategy }: StrategyLibraryProps) {
  const { savedStrategies, loadSavedStrategy, deleteSavedStrategy, updateSavedStrategy } = useStrategyStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleLoad = (id: string) => {
    loadSavedStrategy(id);
    onLoadStrategy();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this strategy?')) {
      deleteSavedStrategy(id);
    }
  };

  const handleStartEdit = (strategy: SavedStrategy) => {
    setEditingId(strategy.id);
    setEditingName(strategy.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      updateSavedStrategy(editingId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (savedStrategies.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">No Saved Strategies</h3>
        <p className="text-sm text-gray-500">
          Use the "Save Strategy" button in the Builder tab to save your first strategy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Saved Strategies ({savedStrategies.length})
        </h3>
        <p className="text-sm text-gray-400">
          Load a saved strategy to edit it, or delete strategies you no longer need.
        </p>
      </div>

      <div className="grid gap-4">
        {savedStrategies.map((strategy) => (
          <div
            key={strategy.id}
            className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {editingId === strategy.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="w-full px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                ) : (
                  <h4 className="text-lg font-semibold text-white truncate">
                    {strategy.name}
                  </h4>
                )}
                <div className="mt-1 text-sm text-gray-400 space-y-1">
                  <div>
                    <span className="text-gray-500">Created:</span> {formatDate(strategy.createdAt)}
                  </div>
                  {strategy.updatedAt !== strategy.createdAt && (
                    <div>
                      <span className="text-gray-500">Updated:</span> {formatDate(strategy.updatedAt)}
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Actions:</span> {strategy.strategy.timedActions.length} scheduled
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {editingId === strategy.id ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                      title="Save name"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                      title="Cancel"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleLoad(strategy.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors flex items-center gap-1"
                      title="Load this strategy"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Load
                    </button>
                    <button
                      onClick={() => handleStartEdit(strategy)}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                      title="Rename this strategy"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(strategy.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                      title="Delete this strategy"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useStrategyStore, type SavedStrategy } from '../../stores/strategyStore';

interface StrategyLibraryModalProps {
  onSelect: (strategy: SavedStrategy) => void;
  onClose: () => void;
  title?: string;
  description?: string;
  selectButtonText?: string;
}

export default function StrategyLibraryModal({
  onSelect,
  onClose,
  title = 'Strategy Library',
  description = 'Select a strategy to load',
  selectButtonText = 'Load Strategy',
}: StrategyLibraryModalProps) {
  const { savedStrategies, deleteSavedStrategy, updateSavedStrategy } = useStrategyStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

  const handleSelect = () => {
    if (!selectedId) return;
    const strategy = savedStrategies.find(s => s.id === selectedId);
    if (strategy) {
      onSelect(strategy);
      onClose();
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this strategy?')) {
      deleteSavedStrategy(id);
      if (selectedId === id) {
        setSelectedId(null);
      }
    }
  };

  const handleStartEdit = (strategy: SavedStrategy, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(strategy.id);
    setEditingName(strategy.name);
  };

  const handleSaveEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    if (editingId && editingName.trim()) {
      updateSavedStrategy(editingId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleCancelEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-500 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 border-b-2 border-blue-500 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                📚 {title}
              </h2>
              <p className="text-gray-200">
                {description} • {savedStrategies.length} strateg{savedStrategies.length === 1 ? 'y' : 'ies'} available
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white text-4xl font-bold leading-none"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {savedStrategies.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-bold mb-2">No Saved Strategies</h3>
              <p>Use the "Save Strategy" button in the Builder tab to save your first strategy.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedStrategies.map((strategy) => (
                <div
                  key={strategy.id}
                  className={`bg-gray-800 border rounded-lg p-5 transition-all cursor-pointer ${
                    selectedId === strategy.id
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-gray-700 hover:border-blue-400 hover:bg-gray-750'
                  }`}
                  onClick={() => setSelectedId(strategy.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Radio Button */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input
                        type="radio"
                        checked={selectedId === strategy.id}
                        onChange={() => setSelectedId(strategy.id)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        {/* Strategy Name */}
                        {editingId === strategy.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') handleSaveEdit(e);
                              if (e.key === 'Escape') handleCancelEdit(e);
                            }}
                            className="w-full px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                          />
                        ) : (
                          <div className="text-white font-semibold text-lg mb-2 truncate">
                            {strategy.name}
                          </div>
                        )}

                        {/* Strategy Metadata */}
                        <div className="space-y-1">
                          {strategy.description && (
                            <div className="text-sm text-blue-400 font-medium">
                              📊 {strategy.description}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
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
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {editingId === strategy.id ? (
                        <>
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                            title="Save name"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => handleStartEdit(strategy, e)}
                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                            title="Rename this strategy"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDelete(strategy.id, e)}
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
          )}
        </div>

        {/* Footer */}
        {savedStrategies.length > 0 && (
          <div className="border-t border-gray-700 p-6 bg-gray-900">
            <div className="flex items-center justify-end gap-4">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSelect}
                disabled={!selectedId}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  selectedId
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {selectButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

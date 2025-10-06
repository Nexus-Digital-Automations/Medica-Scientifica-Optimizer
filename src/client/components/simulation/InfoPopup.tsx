import { useState } from 'react';
import { createPortal } from 'react-dom';

interface InfoPopupProps {
  title: string;
  content: React.ReactNode;
  buttonClassName?: string;
}

export default function InfoPopup({ title, content, buttonClassName = '' }: InfoPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Info Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-colors ${buttonClassName}`}
        title={`View details: ${title}`}
      >
        ℹ️
      </button>

      {/* Popup Modal - rendered via portal outside SVG */}
      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-500 rounded-2xl shadow-2xl max-w-2xl max-h-[80vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-900 to-purple-900 border-b-2 border-blue-500 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white">{title}</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-300 hover:text-white text-3xl font-bold leading-none"
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 text-gray-200">
              {content}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t-2 border-gray-700 p-4 rounded-b-2xl">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

import { useMemo, useState } from 'react';

interface AnimatedFlowArrowProps {
  fromStation: string;
  toStation: string;
  flowRate: number; // Actual flow rate (units/day)
  demandRate: number; // What the next station needs (units/day)
  color?: string;
  vertical?: boolean;
}

export default function AnimatedFlowArrow({
  fromStation,
  toStation,
  flowRate,
  demandRate,
  color = 'blue',
  vertical = true,
}: AnimatedFlowArrowProps) {
  const [showPopup, setShowPopup] = useState(false);

  // Calculate bottleneck severity
  const bottleneckRatio = demandRate > 0 ? flowRate / demandRate : 1;
  const isBottleneck = bottleneckRatio < 0.8; // Flow is less than 80% of demand
  const isCriticalBottleneck = bottleneckRatio < 0.5; // Flow is less than 50% of demand

  // Determine arrow color based on bottleneck status
  const arrowColor = useMemo(() => {
    if (isCriticalBottleneck) return 'red';
    if (isBottleneck) return 'orange';
    return color;
  }, [isCriticalBottleneck, isBottleneck, color]);

  const colorMap = {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#a855f7',
    teal: '#14b8a6',
    pink: '#ec4899',
    amber: '#f59e0b',
    gray: '#6b7280',
  };

  const arrowColorHex = colorMap[arrowColor as keyof typeof colorMap] || colorMap.blue;

  // Animation speed based on flow rate (higher flow = faster animation)
  const animationDuration = Math.max(1, 5 - (flowRate / 10)); // 1-5 seconds

  return (
    <div className="flex flex-col items-center my-2 relative">
      {/* Arrow with animation */}
      <div
        className={`relative ${vertical ? 'h-16 w-0.5' : 'w-16 h-0.5'} flex ${vertical ? 'flex-col' : 'flex-row'} items-center justify-center cursor-pointer group`}
        onClick={() => setShowPopup(!showPopup)}
      >
        {/* Background arrow line - very thin */}
        <div
          className={`absolute ${vertical ? 'w-0.5 h-full' : 'h-0.5 w-full'} transition-all group-hover:w-1 group-hover:h-1`}
          style={{ backgroundColor: arrowColorHex, opacity: 0.8 }}
        />

        {/* Animated flow particles - smaller */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`absolute ${vertical ? 'w-2 h-2 left-1/2 -translate-x-1/2' : 'h-2 w-2 top-1/2 -translate-y-1/2'} rounded-full`}
              style={{
                backgroundColor: arrowColorHex,
                animation: vertical
                  ? `flowDown ${animationDuration}s linear infinite`
                  : `flowRight ${animationDuration}s linear infinite`,
                animationDelay: `${i * (animationDuration / 3)}s`,
                opacity: flowRate > 0 ? 0.7 : 0,
              }}
            />
          ))}
        </div>

        {/* Arrow head - smaller and sharper */}
        <div
          className={`absolute ${vertical ? 'bottom-0 left-1/2 -translate-x-1/2' : 'right-0 top-1/2 -translate-y-1/2'} w-0 h-0`}
          style={{
            borderLeft: vertical ? '6px solid transparent' : '10px solid',
            borderRight: vertical ? '6px solid transparent' : 'none',
            borderTop: vertical ? '10px solid' : '6px solid transparent',
            borderBottom: vertical ? 'none' : '6px solid transparent',
            borderColor: arrowColorHex,
          }}
        />

        {/* Info icon - smaller */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10">
          ℹ️
        </div>
      </div>

      {/* Flow metrics popup */}
      {showPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
          onClick={() => setShowPopup(false)}
        >
          <div
            className={`bg-gradient-to-br from-gray-900 to-gray-800 border-2 rounded-xl shadow-2xl p-6 max-w-md`}
            style={{ borderColor: arrowColorHex }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">
                {fromStation} → {toStation}
              </h3>
              <button
                onClick={() => setShowPopup(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Flow Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Flow Rate:</span>
                    <span className={`font-bold ${flowRate < demandRate * 0.8 ? 'text-red-400' : 'text-green-400'}`}>
                      {flowRate.toFixed(1)} units/day
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Demand Rate:</span>
                    <span className="font-bold text-white">{demandRate.toFixed(1)} units/day</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                    <span className="text-gray-400">Gap:</span>
                    <span className={`font-bold ${flowRate - demandRate < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {(flowRate - demandRate).toFixed(1)} units/day
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Flow Efficiency:</span>
                    <span className="font-bold text-white">{(bottleneckRatio * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {isBottleneck && (
                <div
                  className="rounded-lg p-4 border-2"
                  style={{
                    backgroundColor: isCriticalBottleneck ? 'rgba(239, 68, 68, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                    borderColor: isCriticalBottleneck ? '#ef4444' : '#f97316'
                  }}
                >
                  <h4 className={`text-sm font-bold mb-2 ${isCriticalBottleneck ? 'text-red-300' : 'text-orange-300'}`}>
                    {isCriticalBottleneck ? '🚨 CRITICAL BOTTLENECK' : '⚠️ BOTTLENECK DETECTED'}
                  </h4>
                  <p className="text-gray-300 text-xs">
                    {isCriticalBottleneck
                      ? `Flow is only ${(bottleneckRatio * 100).toFixed(0)}% of demand. This critical bottleneck is severely limiting production.`
                      : `Flow is ${(bottleneckRatio * 100).toFixed(0)}% of demand. This bottleneck is constraining throughput.`
                    }
                  </p>
                </div>
              )}

              {!isBottleneck && (
                <div className="bg-green-900/30 border-2 border-green-600 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-green-300 mb-2">✅ HEALTHY FLOW</h4>
                  <p className="text-gray-300 text-xs">
                    Flow rate meets or exceeds demand. No bottleneck detected at this connection.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes flowDown {
          0% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          90% {
            opacity: 0.9;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }

        @keyframes flowRight {
          0% {
            left: 0%;
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          90% {
            opacity: 0.9;
          }
          100% {
            left: 100%;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

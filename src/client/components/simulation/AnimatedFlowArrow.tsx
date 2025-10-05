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

  // Determine flow characteristics
  const gap = flowRate - demandRate;
  const isShortage = gap < 0; // Not enough supply to meet demand
  const hasExcess = gap > 0; // Supply exceeds demand

  // Calculate tapering for visual metaphor
  // Shortage: thin top (little supply) → thick bottom (lots of demand)
  // Excess: thick top (lots of supply) → thin bottom (less demand)
  const topWidth = isShortage ? 8 : hasExcess ? 20 : 12;
  const bottomWidth = isShortage ? 20 : hasExcess ? 8 : 12;

  return (
    <div className="flex flex-col items-center my-4 relative">
      {/* Arrow with tapering effect */}
      <div
        className="relative cursor-pointer group"
        style={{
          width: vertical ? `${Math.max(topWidth, bottomWidth) + 8}px` : '80px',
          height: vertical ? '80px' : `${Math.max(topWidth, bottomWidth) + 8}px`
        }}
        onClick={() => setShowPopup(!showPopup)}
      >
        {/* SVG Arrow with Tapering */}
        <svg
          width="100%"
          height="100%"
          viewBox={vertical ? "0 0 32 80" : "0 0 80 32"}
          className="overflow-visible"
        >
          {vertical ? (
            <>
              {/* Tapered arrow body */}
              <polygon
                points={`${16 - topWidth/2},0 ${16 + topWidth/2},0 ${16 + bottomWidth/2},60 ${16 - bottomWidth/2},60`}
                fill={arrowColorHex}
                opacity="0.95"
                className="transition-all group-hover:opacity-100"
              />
              {/* Arrow head (triangle) */}
              <polygon
                points="16,80 4,60 28,60"
                fill={arrowColorHex}
                opacity="0.95"
                className="transition-all group-hover:opacity-100"
              />
            </>
          ) : (
            <>
              {/* Tapered arrow body (horizontal) */}
              <polygon
                points={`0,${16 - topWidth/2} 60,${16 - bottomWidth/2} 60,${16 + bottomWidth/2} 0,${16 + topWidth/2}`}
                fill={arrowColorHex}
                opacity="0.95"
                className="transition-all group-hover:opacity-100"
              />
              {/* Arrow head (triangle) */}
              <polygon
                points="80,16 60,4 60,28"
                fill={arrowColorHex}
                opacity="0.95"
                className="transition-all group-hover:opacity-100"
              />
            </>
          )}
        </svg>

        {/* Animated flow particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`absolute ${vertical ? 'w-3 h-3 left-1/2 -translate-x-1/2' : 'h-3 w-3 top-1/2 -translate-y-1/2'} rounded-full`}
              style={{
                backgroundColor: '#ffffff',
                animation: vertical
                  ? `flowDown ${animationDuration}s linear infinite`
                  : `flowRight ${animationDuration}s linear infinite`,
                animationDelay: `${i * (animationDuration / 3)}s`,
                opacity: flowRate > 0 ? 0.85 : 0,
              }}
            />
          ))}
        </div>

        {/* Shortage/Bottleneck label */}
        <div className={`absolute ${vertical ? 'left-full ml-3' : 'top-full mt-3'} flex items-center justify-center`}>
          {isShortage && (
            <div className="px-2 py-1 rounded bg-red-600 border border-red-400 shadow-md">
              <span className="text-white text-xs font-bold">SHORTAGE</span>
            </div>
          )}
          {isBottleneck && (
            <div className="px-2 py-1 rounded bg-orange-600 border border-orange-400 shadow-md">
              <span className="text-white text-xs font-bold">BOTTLENECK</span>
            </div>
          )}
        </div>

        {/* Info icon on hover */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10">
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

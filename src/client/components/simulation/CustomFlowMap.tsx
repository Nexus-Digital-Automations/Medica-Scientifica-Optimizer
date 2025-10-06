import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { SimulationResult } from '../../types/ui.types';
import { analyzeBottlenecks } from '../../utils/bottleneckAnalysis';
import { generateConstraintSuggestions } from '../../utils/constraintSuggestions';
import InfoPopup from './InfoPopup';
import ConstraintSuggestionsModal from './ConstraintSuggestionsModal';

interface CustomFlowMapProps {
  simulationResult: SimulationResult | null;
}

const NODE_W = 120;
const NODE_H = 100;

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  icon: string;
}

interface FlowMetrics {
  flowRate: number;
  demandRate: number;
}

interface Edge {
  from: string;
  to: string;
  isLoop?: boolean;
  isDotted?: boolean;
  getMetrics?: () => FlowMetrics;
}

// Custom line nodes (top section)
const customNodes: Node[] = [
  { id: 'custom-orders', label: 'Orders', x: 20, y: 40, color: '#ef4444', icon: '📋' },
  { id: 'custom-queue1', label: 'Queue 1', x: 170, y: 40, color: '#f97316', icon: '📦' },
  { id: 'custom-station1', label: 'Station 1', x: 320, y: 40, color: '#2563eb', icon: '⚙️' },
  { id: 'custom-queue2', label: 'Queue 2', x: 470, y: 40, color: '#f97316', icon: '📦' },
  { id: 'custom-station2', label: 'Station 2', x: 620, y: 40, color: '#2563eb', icon: '⚙️' },
  { id: 'custom-deliveries', label: 'Deliveries', x: 1070, y: 40, color: '#22c55e', icon: '📦' },
  { id: 'custom-station3', label: 'Station 3', x: 320, y: 200, color: '#2563eb', icon: '⚙️' },
  { id: 'custom-queue3', label: 'Queue 3', x: 470, y: 200, color: '#f97316', icon: '📦' },
  { id: 'shared', label: 'Shared\nResources', x: 20, y: 160, color: '#6b7280', icon: '📦' }
];

// Standard line nodes (bottom section)
const standardNodes: Node[] = [
  { id: 'std-orders', label: 'Orders', x: 50, y: 340, color: '#ef4444', icon: '📋' },
  { id: 'std-queue1', label: 'Queue 1', x: 180, y: 340, color: '#f97316', icon: '📦' },
  { id: 'std-station1', label: 'Station 1', x: 310, y: 340, color: '#2563eb', icon: '⚙️' },
  { id: 'std-queue2', label: 'Queue 2', x: 440, y: 340, color: '#f97316', icon: '📦' },
  { id: 'std-batch1', label: 'Initial\nBatching', x: 570, y: 340, color: '#a855f7', icon: '⏱️' },
  { id: 'std-queue3', label: 'Queue 3', x: 700, y: 340, color: '#f97316', icon: '📦' },
  { id: 'std-arcp', label: 'Manual\nProcessing', x: 830, y: 340, color: '#ec4899', icon: '👥' },
  { id: 'std-queue4', label: 'Queue 4', x: 960, y: 340, color: '#f97316', icon: '📦' },
  { id: 'std-batch2', label: 'Final\nBatching', x: 1090, y: 340, color: '#a855f7', icon: '⏱️' },
  { id: 'std-queue5', label: 'Queue 5', x: 1220, y: 340, color: '#f97316', icon: '📦' },
  { id: 'std-deliveries', label: 'Deliveries', x: 1350, y: 340, color: '#22c55e', icon: '📦' },
];

const nodes: Node[] = [...customNodes, ...standardNodes];

function findNode(id: string): Node | undefined {
  return nodes.find((n) => n.id === id);
}

function makeCurve(fromNode: Node, toNode: Node, extra = 0): string {
  const sx = fromNode.x + NODE_W;
  const sy = fromNode.y + NODE_H / 2;
  const ex = toNode.x;
  const ey = toNode.y + NODE_H / 2;
  const dx = ex - sx;

  if (Math.abs(ey - sy) > 50) {
    const cx1 = sx + Math.max(40, Math.abs(dx) * 0.3) + extra;
    const cy1 = sy + (ey - sy) * 0.3;
    const cx2 = ex - Math.max(40, Math.abs(dx) * 0.3) - extra;
    const cy2 = ey - (ey - sy) * 0.3;
    return `M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${ex} ${ey}`;
  }

  const cx1 = sx + Math.max(40, dx * 0.3) + extra;
  const cx2 = ex - Math.max(40, dx * 0.3) - extra;
  return `M ${sx} ${sy} C ${cx1} ${sy} ${cx2} ${ey} ${ex} ${ey}`;
}

function getFlowColor(flowRate: number, demandRate: number): string {
  const gap = flowRate - demandRate;
  if (gap < -0.5) return '#ef4444'; // Red - shortage
  if (gap > 0.5) return '#22c55e'; // Green - excess
  return '#3b82f6'; // Blue - balanced
}

function getArrowWidth(flowRate: number, demandRate: number): number {
  const gap = flowRate - demandRate;
  if (gap < -0.5) return 2; // Thin arrow - bottleneck/shortage
  if (gap > 0.5) return 6;   // Thick arrow - excess supply
  return 4;                   // Normal arrow - balanced
}

function Node({ node, info }: { node: Node; info?: React.ReactNode }) {
  return (
    <g transform={`translate(${node.x}, ${node.y})`} className="group">
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={12}
        fill={node.color}
        stroke="white"
        strokeWidth={3}
        className="drop-shadow-lg"
      />
      <rect x={10} y={10} width={50} height={50} rx={8} fill="rgba(255,255,255,0.25)" />
      <text x={35} y={45} textAnchor="middle" fontSize={28}>{node.icon}</text>
      <text x={NODE_W / 2} y={NODE_H - 15} textAnchor="middle" fontSize={13} fontWeight={700} fill="white">
        {node.label}
      </text>
      {info && (
        <foreignObject x={70} y={10} width={25} height={25} style={{ zIndex: 10 }}>
          {info}
        </foreignObject>
      )}
    </g>
  );
}

function Edge({ edge, index, metrics }: { edge: Edge; index: number; metrics?: FlowMetrics }) {
  const [showPopup, setShowPopup] = useState(false);
  const from = findNode(edge.from);
  const to = findNode(edge.to);

  if (!from || !to) return null;

  const flowMetrics = metrics || edge.getMetrics?.() || { flowRate: 0, demandRate: 0 };
  const d = makeCurve(from, to, edge.isLoop ? 30 : 0);
  const strokeColor = edge.isDotted ? '#9ca3af' : getFlowColor(flowMetrics.flowRate, flowMetrics.demandRate);
  const strokeWidth = edge.isDotted ? 2 : getArrowWidth(flowMetrics.flowRate, flowMetrics.demandRate);

  const gap = flowMetrics.flowRate - flowMetrics.demandRate;
  const isBottleneck = gap < -0.5;
  const bottleneckRatio = flowMetrics.demandRate > 0 ? flowMetrics.flowRate / flowMetrics.demandRate : 1;

  return (
    <>
      <motion.path
        key={`edge-${edge.from}-${edge.to}-${index}`}
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={edge.isDotted ? '8 4' : edge.isLoop ? '12 8' : '0'}
        markerEnd="url(#arrow)"
        animate={edge.isLoop ? { strokeDashoffset: [0, -40] } : {}}
        transition={edge.isLoop ? { repeat: Infinity, repeatType: 'loop', duration: 2, ease: 'linear' } : {}}
        className="cursor-pointer"
        style={{ transition: 'stroke-width 0.3s ease' }}
        onClick={() => setShowPopup(!showPopup)}
      />

      {!edge.isDotted && (
        <g className="pointer-events-none">
          <text>
            <textPath href={`#path-${edge.from}-${edge.to}`} startOffset="25%">
              <tspan className="text-xs font-bold" fill="#1e40af">
                Flow: {flowMetrics.flowRate.toFixed(1)}
              </tspan>
            </textPath>
          </text>
          <text>
            <textPath href={`#path-${edge.from}-${edge.to}`} startOffset="75%">
              <tspan className="text-xs font-bold" fill="#7c3aed">
                Demand: {flowMetrics.demandRate.toFixed(1)}
              </tspan>
            </textPath>
          </text>
        </g>
      )}

      <path id={`path-${edge.from}-${edge.to}`} d={d} fill="none" stroke="none" />

      {showPopup && (
        <foreignObject x={from.x + NODE_W + 50} y={from.y} width={300} height={250}>
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 rounded-xl shadow-2xl p-4"
            style={{ borderColor: strokeColor }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">
                {edge.from} → {edge.to}
              </h3>
              <button onClick={() => setShowPopup(false)} className="text-gray-400 hover:text-white">×</button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Flow Rate:</span>
                <span className="font-bold text-white">{flowMetrics.flowRate.toFixed(1)} units/day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Demand Rate:</span>
                <span className="font-bold text-white">{flowMetrics.demandRate.toFixed(1)} units/day</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-2">
                <span className="text-gray-400">Gap:</span>
                <span className={`font-bold ${gap < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {gap.toFixed(1)} units/day
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Flow Efficiency:</span>
                <span className="font-bold text-white">{(bottleneckRatio * 100).toFixed(1)}%</span>
              </div>
            </div>
            {isBottleneck && (
              <div className="mt-3 bg-red-900/30 border border-red-600 rounded p-2">
                <div className="text-xs font-bold text-red-300">⚠️ BOTTLENECK DETECTED</div>
                <div className="text-xs text-gray-300 mt-1">
                  Flow is {(bottleneckRatio * 100).toFixed(0)}% of demand
                </div>
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </>
  );
}

export default function CustomFlowMap({ simulationResult }: CustomFlowMapProps) {
  const [showConstraintSuggestions, setShowConstraintSuggestions] = useState(false);

  const bottleneckAnalysis = useMemo(
    () => simulationResult ? analyzeBottlenecks(simulationResult) : { metrics: [], problems: [], overallHealth: 'optimal' as const, summaryStats: { totalBottlenecks: 0, criticalBottlenecks: 0, averageUtilization: 0, mostCriticalStation: null } },
    [simulationResult]
  );

  const constraintSuggestions = useMemo(
    () => simulationResult && bottleneckAnalysis ? generateConstraintSuggestions(bottleneckAnalysis, simulationResult) : { suggestions: [], generatedFrom: 'bottleneck-analysis' as const, timestamp: Date.now() },
    [bottleneckAnalysis, simulationResult]
  );

  if (!simulationResult) {
    return (
      <div className="text-center py-12 text-gray-500">
        No simulation data available. Run a simulation to see the custom flow map.
      </div>
    );
  }

  const { state } = simulationResult;
  const finalDayIndex = state.history.dailyCash.length - 1;
  const recentDays = 50;
  const startIdx = Math.max(0, finalDayIndex - recentDays);

  const avgCustomProduction = state.history.dailyCustomProduction.slice(startIdx, finalDayIndex + 1).reduce((sum, d) => sum + d.value, 0) / (finalDayIndex - startIdx + 1);
  const finalCustomWIP = state.customLineWIP.orders.length;
  const finalExperts = state.history.dailyExperts[finalDayIndex]?.value || 0;
  const finalRookies = state.history.dailyRookies[finalDayIndex]?.value || 0;
  const arcpCapacity = (finalExperts * 3) + (finalRookies * 3 * 0.4);
  const mceAllocation = simulationResult?.strategy?.mceAllocationCustom ?? 0.5;

  // Calculate standard line metrics
  const avgStandardProduction = state.history.dailyStandardProduction.slice(startIdx, finalDayIndex + 1).reduce((sum, d) => sum + d.value, 0) / (finalDayIndex - startIdx + 1);
  const finalStandardWIP = state.history.dailyStandardWIP[finalDayIndex]?.value || 0;
  const standardBatchSize = simulationResult?.strategy?.standardBatchSize ?? 60;

  // Flow metrics for each edge
  const edgeMetrics: Record<string, FlowMetrics> = {
    // Custom line metrics
    'custom-orders-queue1': { flowRate: avgCustomProduction, demandRate: avgCustomProduction + 1 },
    'custom-queue1-station1': { flowRate: avgCustomProduction, demandRate: 6 },
    'custom-station1-queue2': { flowRate: avgCustomProduction, demandRate: avgCustomProduction + 2 },
    'custom-queue2-station2': { flowRate: avgCustomProduction, demandRate: 6 },
    'custom-station2-deliveries': { flowRate: avgCustomProduction, demandRate: avgCustomProduction + 1 },
    'custom-station1-station3': { flowRate: avgCustomProduction * 0.3, demandRate: 6 },
    'custom-station3-queue3': { flowRate: avgCustomProduction * 0.3, demandRate: avgCustomProduction * 0.3 },
    'custom-queue3-station2': { flowRate: avgCustomProduction * 0.3, demandRate: arcpCapacity * mceAllocation },

    // Standard line metrics
    'std-orders-queue1': { flowRate: avgStandardProduction, demandRate: avgStandardProduction + 2 },
    'std-queue1-station1': { flowRate: avgStandardProduction, demandRate: 6 },
    'std-station1-queue2': { flowRate: avgStandardProduction, demandRate: avgStandardProduction + 1 },
    'std-queue2-batch1': { flowRate: avgStandardProduction, demandRate: standardBatchSize / 4 },
    'std-batch1-queue3': { flowRate: avgStandardProduction, demandRate: avgStandardProduction },
    'std-queue3-arcp': { flowRate: avgStandardProduction, demandRate: arcpCapacity * (1 - mceAllocation) },
    'std-arcp-queue4': { flowRate: avgStandardProduction, demandRate: avgStandardProduction },
    'std-queue4-batch2': { flowRate: avgStandardProduction, demandRate: standardBatchSize },
    'std-batch2-queue5': { flowRate: avgStandardProduction, demandRate: avgStandardProduction },
    'std-queue5-deliveries': { flowRate: avgStandardProduction, demandRate: avgStandardProduction + 1 },
  };

  // Custom line edges
  const customEdges: Edge[] = [
    { from: 'custom-orders', to: 'custom-queue1', getMetrics: () => edgeMetrics['custom-orders-queue1'] },
    { from: 'custom-queue1', to: 'custom-station1', getMetrics: () => edgeMetrics['custom-queue1-station1'] },
    { from: 'custom-station1', to: 'custom-queue2', getMetrics: () => edgeMetrics['custom-station1-queue2'] },
    { from: 'custom-queue2', to: 'custom-station2', getMetrics: () => edgeMetrics['custom-queue2-station2'] },
    { from: 'custom-station2', to: 'custom-deliveries', getMetrics: () => edgeMetrics['custom-station2-deliveries'] },
    { from: 'custom-station1', to: 'custom-station3', isLoop: true, getMetrics: () => edgeMetrics['custom-station1-station3'] },
    { from: 'custom-station3', to: 'custom-queue3', isLoop: true, getMetrics: () => edgeMetrics['custom-station3-queue3'] },
    { from: 'custom-queue3', to: 'custom-station2', isLoop: true, getMetrics: () => edgeMetrics['custom-queue3-station2'] },
    { from: 'shared', to: 'custom-station1', isDotted: true },
  ];

  // Standard line edges
  const standardEdges: Edge[] = [
    { from: 'std-orders', to: 'std-queue1', getMetrics: () => edgeMetrics['std-orders-queue1'] },
    { from: 'std-queue1', to: 'std-station1', getMetrics: () => edgeMetrics['std-queue1-station1'] },
    { from: 'std-station1', to: 'std-queue2', getMetrics: () => edgeMetrics['std-station1-queue2'] },
    { from: 'std-queue2', to: 'std-batch1', getMetrics: () => edgeMetrics['std-queue2-batch1'] },
    { from: 'std-batch1', to: 'std-queue3', getMetrics: () => edgeMetrics['std-batch1-queue3'] },
    { from: 'std-queue3', to: 'std-arcp', getMetrics: () => edgeMetrics['std-queue3-arcp'] },
    { from: 'std-arcp', to: 'std-queue4', getMetrics: () => edgeMetrics['std-arcp-queue4'] },
    { from: 'std-queue4', to: 'std-batch2', getMetrics: () => edgeMetrics['std-queue4-batch2'] },
    { from: 'std-batch2', to: 'std-queue5', getMetrics: () => edgeMetrics['std-batch2-queue5'] },
    { from: 'std-queue5', to: 'std-deliveries', getMetrics: () => edgeMetrics['std-queue5-deliveries'] },
  ];

  const edges: Edge[] = [...customEdges, ...standardEdges];

  const isCustomBottleneck = finalCustomWIP > 50;
  const isStandardBottleneck = finalStandardWIP > 100;

  return (
    <div className="w-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border-2 border-gray-300">
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-600">Team: Bearkats</div>
          <div className="text-2xl font-bold text-gray-800">
            🏭 Dual-Line Production Flow
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-lg font-bold text-sm shadow-lg ${isCustomBottleneck ? 'bg-red-600 text-white animate-pulse' : 'bg-purple-600 text-white'}`}>
            {isCustomBottleneck ? '⚠️ BOTTLENECK' : 'CUSTOM'}
          </div>
          <div className={`px-4 py-2 rounded-lg font-bold text-sm shadow-lg ${isStandardBottleneck ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
            {isStandardBottleneck ? '⚠️ BOTTLENECK' : 'STANDARD'}
          </div>
          <button
            onClick={() => setShowConstraintSuggestions(true)}
            className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center text-white text-xl cursor-pointer hover:scale-110 transition-transform shadow-md"
          >
            💡
          </button>
        </div>
      </div>

      <svg viewBox="0 0 1500 480" className="w-full h-full">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1e293b" />
          </marker>
        </defs>

        <g>
          {edges.map((edge, i) => (
            <Edge key={`e-${i}`} edge={edge} index={i} metrics={edge.getMetrics?.()} />
          ))}
        </g>

        <g>
          {nodes.map((n) => {
            let info;
            // Custom line stations
            if (n.id === 'custom-station1' || n.id === 'custom-station2' || n.id === 'custom-station3') {
              info = (
                <InfoPopup
                  title={`${n.label} Details`}
                  buttonClassName="bg-purple-600 hover:bg-purple-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  content={
                    <div className="text-sm text-gray-300">
                      <p>Custom line processing station with shared capacity</p>
                      <div className="mt-2">
                        <div>Capacity: 6 units/day</div>
                        <div>Utilization: {((avgCustomProduction / 6) * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  }
                />
              );
            }
            // Standard line stations and batching
            else if (n.id === 'std-station1' || n.id === 'std-arcp' || n.id === 'std-batch1' || n.id === 'std-batch2') {
              const isStation = n.id === 'std-station1' || n.id === 'std-arcp';
              const isBatching = n.id === 'std-batch1' || n.id === 'std-batch2';
              info = (
                <InfoPopup
                  title={`${n.label} Details`}
                  buttonClassName="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  content={
                    <div className="text-sm text-gray-300">
                      <p>{isStation ? 'Standard line processing station with shared capacity' : 'Batching stage - accumulates units for efficient processing'}</p>
                      <div className="mt-2">
                        {isStation && (
                          <>
                            <div>Capacity: {n.id === 'std-station1' ? '6 units/day' : `${(arcpCapacity * (1 - mceAllocation)).toFixed(1)} units/day`}</div>
                            <div>Utilization: {((avgStandardProduction / (n.id === 'std-station1' ? 6 : arcpCapacity * (1 - mceAllocation))) * 100).toFixed(1)}%</div>
                          </>
                        )}
                        {isBatching && (
                          <>
                            <div>Wait Time: {n.id === 'std-batch1' ? '4 days' : '1 day'}</div>
                            <div>Batch Size: {standardBatchSize} units</div>
                          </>
                        )}
                      </div>
                    </div>
                  }
                />
              );
            }
            return <Node node={n} key={n.id} info={info} />;
          })}
        </g>
      </svg>

      <div className="mt-6 space-y-4">
        {/* Custom Line Stats */}
        <div>
          <div className="text-sm font-bold text-purple-700 mb-2">📊 CUSTOM LINE METRICS</div>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border-2 border-purple-300 rounded-lg p-4 shadow-md">
              <div className="text-sm text-purple-700 font-semibold mb-1">Custom WIP</div>
              <div className="text-2xl font-bold text-gray-800">{finalCustomWIP} orders</div>
            </div>
            <div className="bg-white border-2 border-purple-300 rounded-lg p-4 shadow-md">
              <div className="text-sm text-purple-700 font-semibold mb-1">Daily Output</div>
              <div className="text-2xl font-bold text-gray-800">{avgCustomProduction.toFixed(1)} units/day</div>
            </div>
            <div className="bg-white border-2 border-purple-300 rounded-lg p-4 shadow-md">
              <div className="text-sm text-purple-700 font-semibold mb-1">Total Delivered</div>
              <div className="text-2xl font-bold text-gray-800">
                {Math.round(state.history.dailyCustomProduction.reduce((sum, d) => sum + d.value, 0))} units
              </div>
            </div>
            <div className="bg-white border-2 border-purple-300 rounded-lg p-4 shadow-md">
              <div className="text-sm text-purple-700 font-semibold mb-1">ARCP Allocated</div>
              <div className="text-2xl font-bold text-gray-800">{(arcpCapacity * mceAllocation).toFixed(1)} units/day</div>
            </div>
          </div>
        </div>

        {/* Standard Line Stats */}
        <div>
          <div className="text-sm font-bold text-blue-700 mb-2">📊 STANDARD LINE METRICS</div>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-md">
              <div className="text-sm text-blue-700 font-semibold mb-1">Standard WIP</div>
              <div className="text-2xl font-bold text-gray-800">{Math.round(finalStandardWIP)} units</div>
            </div>
            <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-md">
              <div className="text-sm text-blue-700 font-semibold mb-1">Daily Output</div>
              <div className="text-2xl font-bold text-gray-800">{avgStandardProduction.toFixed(1)} units/day</div>
            </div>
            <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-md">
              <div className="text-sm text-blue-700 font-semibold mb-1">Total Delivered</div>
              <div className="text-2xl font-bold text-gray-800">
                {Math.round(state.history.dailyStandardProduction.reduce((sum, d) => sum + d.value, 0))} units
              </div>
            </div>
            <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-md">
              <div className="text-sm text-blue-700 font-semibold mb-1">ARCP Allocated</div>
              <div className="text-2xl font-bold text-gray-800">{(arcpCapacity * (1 - mceAllocation)).toFixed(1)} units/day</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <svg width="40" height="16" viewBox="0 0 40 16">
            <line x1="0" y1="8" x2="35" y2="8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            <polygon points="40,8 35,5 35,11" fill="#ef4444" />
          </svg>
          <span className="text-gray-700 font-medium">Bottleneck (Thin)</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="40" height="16" viewBox="0 0 40 16">
            <line x1="0" y1="8" x2="35" y2="8" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
            <polygon points="40,8 35,5 35,11" fill="#3b82f6" />
          </svg>
          <span className="text-gray-700 font-medium">Balanced (Normal)</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="40" height="16" viewBox="0 0 40 16">
            <line x1="0" y1="8" x2="35" y2="8" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" />
            <polygon points="40,8 35,5 35,11" fill="#22c55e" />
          </svg>
          <span className="text-gray-700 font-medium">Excess (Thick)</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="40" height="16" viewBox="0 0 40 16">
            <line x1="0" y1="8" x2="35" y2="8" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 4" />
            <polygon points="40,8 35,5 35,11" fill="#3b82f6" />
          </svg>
          <span className="text-gray-700 font-medium">Loop Path</span>
        </div>
      </div>

      {showConstraintSuggestions && (
        <ConstraintSuggestionsModal
          suggestions={constraintSuggestions}
          onClose={() => setShowConstraintSuggestions(false)}
        />
      )}
    </div>
  );
}

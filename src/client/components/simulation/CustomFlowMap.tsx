import { motion } from 'framer-motion';
import { useMemo, useState, useRef } from 'react';
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

// MCE Station (unified, shared between both lines) - tall box spanning both lines
// Positioned at y=180, height=500 to visually show it serves both custom (y=240-400) and standard (y=520-640) lines
// The horizontal separator at y=460 crosses through the middle of the MCE box
const mceNode: Node = { id: 'mce-station', label: 'MCE\nStation', x: 1200, y: 180, color: '#6b7280', icon: '⚙️' };

// Custom line nodes (single row, top section, 500px gaps)
const customNodes: Node[] = [
  { id: 'custom-orders', label: 'Orders', x: 50, y: 240, color: '#ef4444', icon: '📋' },
  { id: 'custom-queue1', label: 'Queue 1', x: 670, y: 240, color: '#f97316', icon: '📦' },
  { id: 'custom-station1', label: 'Station 1', x: 1290, y: 240, color: '#2563eb', icon: '⚙️' },
  { id: 'custom-queue2', label: 'Queue 2', x: 1910, y: 240, color: '#f97316', icon: '📦' },
  { id: 'custom-station2', label: 'Station 2', x: 2530, y: 240, color: '#2563eb', icon: '⚙️' },
  { id: 'custom-deliveries', label: 'Deliveries', x: 3150, y: 240, color: '#22c55e', icon: '📦' },
  { id: 'custom-station3', label: 'Station 3', x: 1290, y: 400, color: '#2563eb', icon: '⚙️' },
  { id: 'custom-queue3', label: 'Queue 3', x: 1910, y: 400, color: '#f97316', icon: '📦' },
];

// Standard line nodes (snake layout, 500px gaps)
// Row 1: Left-to-right (y: 520)
// Row 2: Right-to-left (y: 640)
const standardNodes: Node[] = [
  // Row 1 (left to right)
  { id: 'std-orders', label: 'Orders', x: 670, y: 520, color: '#ef4444', icon: '📋' },
  { id: 'std-queue1', label: 'Queue 1', x: 1290, y: 520, color: '#f97316', icon: '📦' },
  { id: 'std-station1', label: 'Station 1', x: 1910, y: 520, color: '#2563eb', icon: '⚙️' },
  { id: 'std-queue2', label: 'Queue 2', x: 2530, y: 520, color: '#f97316', icon: '📦' },
  { id: 'std-batch1', label: 'Initial\nBatching', x: 3150, y: 520, color: '#a855f7', icon: '⏱️' },
  // Row 2 (right to left)
  { id: 'std-queue3', label: 'Queue 3', x: 3150, y: 640, color: '#f97316', icon: '📦' },
  { id: 'std-arcp', label: 'Manual\nProcessing', x: 2530, y: 640, color: '#ec4899', icon: '👥' },
  { id: 'std-queue4', label: 'Queue 4', x: 1910, y: 640, color: '#f97316', icon: '📦' },
  { id: 'std-batch2', label: 'Final\nBatching', x: 1290, y: 640, color: '#a855f7', icon: '⏱️' },
  { id: 'std-queue5', label: 'Queue 5', x: 670, y: 640, color: '#f97316', icon: '📦' },
  { id: 'std-deliveries', label: 'Deliveries', x: 50, y: 640, color: '#22c55e', icon: '📦' },
];

const nodes: Node[] = [mceNode, ...customNodes, ...standardNodes];

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
  if (gap < -0.5) return 8;  // Thinner arrow - bottleneck/shortage (RED)
  if (gap > 0.5) return 16;  // Thickest arrow - excess supply (GREEN)
  return 12;                 // Medium arrow - balanced (BLUE)
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
        <foreignObject x={70} y={10} width={25} height={25} style={{ zIndex: 10 }} pointerEvents="all">
          {info}
        </foreignObject>
      )}
    </g>
  );
}

function MCEStation({ x, y, mceAllocation, info }: { x: number; y: number; mceAllocation: number; info?: React.ReactNode }) {
  const width = 500;
  const height = 500; // Tall enough to span both production lines

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Gradient background box */}
      <defs>
        <linearGradient id="mce-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="50%" stopColor="#6b7280" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      <rect
        width={width}
        height={height}
        rx={20}
        fill="url(#mce-gradient)"
        stroke="#9ca3af"
        strokeWidth={3}
        className="drop-shadow-2xl"
      />

      {/* Title */}
      <text x={width / 2} y={40} textAnchor="middle" fontSize={20} fontWeight={700} fill="white">
        ⚙️ STATION 3 - MCE
      </text>
      <text x={width / 2} y={65} textAnchor="middle" fontSize={16} fontWeight={600} fill="#e5e7eb">
        (SHARED RESOURCE)
      </text>
      <text x={width / 2} y={85} textAnchor="middle" fontSize={12} fill="#d1d5db">
        Material Consumption & Forming
      </text>

      {/* Line labels */}
      <text x={width / 2} y={135} textAnchor="middle" fontSize={14} fontWeight={600} fill="#a855f7">
        ↑ CUSTOM LINE
      </text>
      <text x={width / 2} y={370} textAnchor="middle" fontSize={14} fontWeight={600} fill="#3b82f6">
        ↓ STANDARD LINE
      </text>

      {/* Horizontal separator line indicator (shows where separator crosses through) */}
      <line x1={40} y1={280} x2={width - 40} y2={280} stroke="#9ca3af" strokeWidth={2} strokeDasharray="8 4" />
      <text x={width / 2} y={275} textAnchor="middle" fontSize={11} fontWeight={600} fill="#9ca3af">
        SEPARATOR
      </text>

      {/* Allocation bar - centered vertically */}
      <g transform="translate(60, 220)">
        <text x={190} y={-10} textAnchor="middle" fontSize={12} fontWeight={600} fill="#d1d5db">
          Capacity Allocation
        </text>
        <rect width={380} height={40} rx={20} fill="#374151" />
        <rect width={380 * mceAllocation} height={40} rx={20} fill="#a855f7" />
        <rect x={380 * mceAllocation} width={380 * (1 - mceAllocation)} height={40} rx={20} fill="#3b82f6" />

        <text x={190 * mceAllocation} y={26} textAnchor="middle" fontSize={14} fontWeight={700} fill="white">
          {(mceAllocation * 100).toFixed(0)}%
        </text>
        <text x={380 * mceAllocation + 190 * (1 - mceAllocation)} y={26} textAnchor="middle" fontSize={14} fontWeight={700} fill="white">
          {((1 - mceAllocation) * 100).toFixed(0)}%
        </text>
      </g>

      {/* Info popup */}
      {info && (
        <foreignObject x={width - 35} y={10} width={25} height={25} pointerEvents="all">
          {info}
        </foreignObject>
      )}
    </g>
  );
}

function Edge({ edge, index, metrics, activePopupId: _activePopupId, onPopupToggle }: { edge: Edge; index: number; metrics?: FlowMetrics; activePopupId: string | null; onPopupToggle: (id: string) => void }) {
  const from = findNode(edge.from);
  const to = findNode(edge.to);

  if (!from || !to) return null;

  const edgeId = `${edge.from}-${edge.to}-${index}`;
  const flowMetrics = metrics || edge.getMetrics?.() || { flowRate: 0, demandRate: 0 };
  const d = makeCurve(from, to, edge.isLoop ? 30 : 0);
  const strokeColor = edge.isDotted ? '#9ca3af' : getFlowColor(flowMetrics.flowRate, flowMetrics.demandRate);
  const strokeWidth = edge.isDotted ? 2 : getArrowWidth(flowMetrics.flowRate, flowMetrics.demandRate);

  return (
    <>
      <motion.path
        key={`edge-${edgeId}`}
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={edge.isDotted ? '8 4' : edge.isLoop ? '12 8' : '0'}
        markerEnd="url(#arrow)"
        filter={edge.isDotted ? undefined : "url(#arrow-shadow)"}
        animate={edge.isLoop ? { strokeDashoffset: [0, -40] } : {}}
        transition={edge.isLoop ? { repeat: Infinity, repeatType: 'loop', duration: 2, ease: 'linear' } : {}}
        className="cursor-pointer"
        style={{ transition: 'stroke-width 0.3s ease' }}
        onClick={() => onPopupToggle(edgeId)}
      />

      {/* Invisible path for future use (edge metrics moved to popup) */}
      <path id={`path-${edge.from}-${edge.to}`} d={d} fill="none" stroke="none" />
    </>
  );
}

function EdgePopup({ edge, index: _index, metrics, onClose }: { edge: Edge; index: number; metrics?: FlowMetrics; onClose: () => void }) {
  const from = findNode(edge.from);
  const to = findNode(edge.to);

  if (!from || !to) return null;

  const flowMetrics = metrics || edge.getMetrics?.() || { flowRate: 0, demandRate: 0 };
  const strokeColor = edge.isDotted ? '#9ca3af' : getFlowColor(flowMetrics.flowRate, flowMetrics.demandRate);
  const gap = flowMetrics.flowRate - flowMetrics.demandRate;
  const isBottleneck = gap < -0.5;
  const bottleneckRatio = flowMetrics.demandRate > 0 ? flowMetrics.flowRate / flowMetrics.demandRate : 1;

  return (
    <foreignObject x={from.x + NODE_W + 50} y={from.y} width={300} height={250} pointerEvents="all">
      <div
        className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 rounded-xl shadow-2xl p-4"
        style={{ borderColor: strokeColor }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">
            {edge.from} → {edge.to}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
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
  );
}

export default function CustomFlowMap({ simulationResult }: CustomFlowMapProps) {
  const [showConstraintSuggestions, setShowConstraintSuggestions] = useState(false);
  const [activePopupId, setActivePopupId] = useState<string | null>(null);

  // Zoom and pan state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom constraints
  const MIN_SCALE = 0.3;
  const MAX_SCALE = 3;

  // Zoom handler (mouse wheel)
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();

    const delta = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(transform.scale + delta, MIN_SCALE), MAX_SCALE);

    if (newScale !== transform.scale) {
      // Zoom towards cursor position
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate SVG coordinates
        const svgX = (mouseX - transform.x) / transform.scale;
        const svgY = (mouseY - transform.y) / transform.scale;

        // Adjust pan to keep mouse position fixed
        const newX = mouseX - svgX * newScale;
        const newY = mouseY - svgY * newScale;

        setTransform({ x: newX, y: newY, scale: newScale });
      }
    }
  };

  // Pan handlers (mouse drag)
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only start dragging on primary mouse button (left click)
    if (e.button === 0 && !e.target.closest('button, foreignObject')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setTransform({ ...transform, x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Zoom control functions
  const handleZoomIn = () => {
    const newScale = Math.min(transform.scale * 1.2, MAX_SCALE);
    setTransform({ ...transform, scale: newScale });
  };

  const handleZoomOut = () => {
    const newScale = Math.max(transform.scale / 1.2, MIN_SCALE);
    setTransform({ ...transform, scale: newScale });
  };

  const handleResetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

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

  // MCE station edges (feeds both lines)
  const mceEdges: Edge[] = [
    { from: 'mce-station', to: 'custom-orders', isDotted: true },
    { from: 'mce-station', to: 'std-orders', isDotted: true },
  ];

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
  ];

  // Standard line edges (snake pattern)
  const standardEdges: Edge[] = [
    { from: 'std-orders', to: 'std-queue1', getMetrics: () => edgeMetrics['std-orders-queue1'] },
    { from: 'std-queue1', to: 'std-station1', getMetrics: () => edgeMetrics['std-queue1-station1'] },
    { from: 'std-station1', to: 'std-queue2', getMetrics: () => edgeMetrics['std-station1-queue2'] },
    { from: 'std-queue2', to: 'std-batch1', getMetrics: () => edgeMetrics['std-queue2-batch1'] },
    { from: 'std-batch1', to: 'std-queue3', getMetrics: () => edgeMetrics['std-batch1-queue3'] }, // Vertical drop
    { from: 'std-queue3', to: 'std-arcp', getMetrics: () => edgeMetrics['std-queue3-arcp'] },
    { from: 'std-arcp', to: 'std-queue4', getMetrics: () => edgeMetrics['std-arcp-queue4'] },
    { from: 'std-queue4', to: 'std-batch2', getMetrics: () => edgeMetrics['std-queue4-batch2'] },
    { from: 'std-batch2', to: 'std-queue5', getMetrics: () => edgeMetrics['std-batch2-queue5'] },
    { from: 'std-queue5', to: 'std-deliveries', getMetrics: () => edgeMetrics['std-queue5-deliveries'] },
  ];

  const edges: Edge[] = [...mceEdges, ...customEdges, ...standardEdges];

  const isCustomBottleneck = finalCustomWIP > 50;
  const isStandardBottleneck = finalStandardWIP > 100;

  return (
    <div className="relative w-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border-2 border-gray-300">
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

      <svg
        ref={svgRef}
        viewBox="0 0 3300 750"
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ userSelect: 'none' }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1e293b" />
          </marker>
          <filter id="arrow-shadow">
            <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.3"/>
          </filter>
        </defs>

        {/* Apply zoom and pan transform to all content */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Horizontal separator line between custom and standard production lines */}
          <g>
          <line x1={0} y1={460} x2={3300} y2={460} stroke="#d1d5db" strokeWidth={3} strokeDasharray="12 6" />
          <text x={100} y={455} fontSize={14} fontWeight={600} fill="#6b7280">CUSTOM LINE ↑</text>
          <text x={100} y={478} fontSize={14} fontWeight={600} fill="#6b7280">STANDARD LINE ↓</text>
        </g>

        <g>
          {edges.map((edge, i) => (
            <Edge
              key={`e-${i}`}
              edge={edge}
              index={i}
              metrics={edge.getMetrics?.()}
              activePopupId={activePopupId}
              onPopupToggle={(id) => setActivePopupId(activePopupId === id ? null : id)}
            />
          ))}
        </g>

        <g>
          {nodes.map((n) => {
            let info;

            // MCE Station - special rendering
            if (n.id === 'mce-station') {
              const mceInfo = (
                <InfoPopup
                  title="⚙️ Station 3 - MCE (Material Consumption & Forming)"
                  buttonClassName="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  content={
                    <div className="text-sm text-gray-300 space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Overview</h4>
                        <p>
                          The MCE (Material Consumption & Forming) station is the shared entry point for both production lines.
                          It consumes raw material parts and begins the forming process.
                        </p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <h4 className="text-md font-semibold text-purple-300 mb-2">Allocation Details</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Custom Line Allocation:</span>
                            <span className="text-purple-300 font-bold">{(mceAllocation * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Standard Line Allocation:</span>
                            <span className="text-blue-300 font-bold">{((1 - mceAllocation) * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                            <span className="text-gray-400">Priority:</span>
                            <span className="text-white font-bold">Custom → Standard</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-blue-900 border border-blue-600 rounded-lg p-3">
                        <h4 className="text-md font-semibold text-blue-300 mb-2">💡 Strategic Importance</h4>
                        <p className="text-xs">
                          The MCE allocation percentage determines how machine capacity is divided between custom and standard production.
                          Custom line has first priority on allocated capacity, while standard line uses remaining capacity.
                        </p>
                      </div>
                    </div>
                  }
                />
              );
              return <MCEStation key={n.id} x={n.x} y={n.y} mceAllocation={mceAllocation} info={mceInfo} />;
            }

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

        {/* Popup layer - renders on top of everything */}
        <g>
          {activePopupId && edges.map((edge, i) => {
            const edgeId = `${edge.from}-${edge.to}-${i}`;
            if (edgeId === activePopupId) {
              return (
                <EdgePopup
                  key={`popup-${i}`}
                  edge={edge}
                  index={i}
                  metrics={edge.getMetrics?.()}
                  onClose={() => setActivePopupId(null)}
                />
              );
            }
            return null;
          })}
        </g>
        </g>
        {/* End transform group */}
      </svg>

      {/* Zoom control toolbar */}
      <div className="absolute top-4 right-4 bg-gray-800 border-2 border-gray-600 rounded-xl shadow-2xl p-2 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          disabled={transform.scale >= MAX_SCALE}
          className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xl transition-all duration-200 hover:scale-110 disabled:hover:scale-100 shadow-md"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          disabled={transform.scale <= MIN_SCALE}
          className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xl transition-all duration-200 hover:scale-110 disabled:hover:scale-100 shadow-md"
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleResetView}
          className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-bold text-sm transition-all duration-200 hover:scale-110 shadow-md"
          title="Reset View"
        >
          ⟲
        </button>
        <div className="text-center text-xs font-bold text-gray-300 mt-1 px-1">
          {Math.round(transform.scale * 100)}%
        </div>
      </div>

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

      {/* Comprehensive Legend */}
      <div className="mt-6 bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-400 rounded-xl p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">📖 Production Flow Map Guide</h3>

        {/* Dual-Line Architecture */}
        <div className="mb-6 bg-white rounded-lg p-4 border-2 border-gray-300">
          <h4 className="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
            🏭 Dual-Line Architecture
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-purple-50 rounded-lg p-3 border-2 border-purple-300">
              <div className="font-bold text-purple-700 mb-1">Custom Line (Purple)</div>
              <div className="text-gray-700 text-xs space-y-1">
                <div>• Make-to-order production</div>
                <div>• First priority on MCE</div>
                <div>• Flows left → right</div>
                <div>• Individual order tracking</div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-300">
              <div className="font-bold text-blue-700 mb-1">Standard Line (Blue)</div>
              <div className="text-gray-700 text-xs space-y-1">
                <div>• Make-to-stock production</div>
                <div>• Second priority on MCE</div>
                <div>• Snake pattern (2 rows)</div>
                <div>• Batch processing (60 units)</div>
              </div>
            </div>
          </div>
        </div>

        {/* MCE Station Info */}
        <div className="mb-6 bg-gradient-to-r from-purple-50 via-gray-50 to-blue-50 rounded-lg p-4 border-2 border-gray-400">
          <h4 className="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
            ⚙️ MCE Station (Shared Resource)
          </h4>
          <div className="text-sm text-gray-700 space-y-2">
            <div className="flex items-start gap-2">
              <span className="font-bold text-gray-800">Purpose:</span>
              <span>Material Consumption & Forming - shared entry point for both production lines</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-gray-800">Allocation:</span>
              <span>
                <span className="text-purple-600 font-bold">{(mceAllocation * 100).toFixed(0)}% Custom</span>
                {' / '}
                <span className="text-blue-600 font-bold">{((1 - mceAllocation) * 100).toFixed(0)}% Standard</span>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-gray-800">Priority:</span>
              <span>Custom line has first priority, Standard line uses remaining capacity</span>
            </div>
          </div>
        </div>

        {/* Flow Arrow Legend */}
        <div className="bg-white rounded-lg p-4 border-2 border-gray-300">
          <h4 className="text-md font-bold text-gray-800 mb-3 text-center">🎯 Flow Arrow Guide</h4>
          <div className="flex justify-center gap-8 text-sm">
            <div className="flex flex-col items-center gap-2">
              <svg width="60" height="24" viewBox="0 0 60 24">
                <line x1="0" y1="12" x2="48" y2="12" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
                <polygon points="60,12 48,6 48,18" fill="#ef4444" />
              </svg>
              <div className="text-center">
                <div className="text-red-600 font-bold text-base">🔴 Supply Shortage</div>
                <div className="text-gray-600 text-xs">Flow &lt; Demand</div>
                <div className="text-gray-500 text-xs font-semibold">⚠️ Bottleneck</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <svg width="60" height="24" viewBox="0 0 60 24">
                <line x1="0" y1="12" x2="48" y2="12" stroke="#3b82f6" strokeWidth="12" strokeLinecap="round" />
                <polygon points="60,12 48,6 48,18" fill="#3b82f6" />
              </svg>
              <div className="text-center">
                <div className="text-blue-600 font-bold text-base">🔵 Balanced Flow</div>
                <div className="text-gray-600 text-xs">Flow ≈ Demand</div>
                <div className="text-gray-500 text-xs font-semibold">✓ Healthy</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <svg width="60" height="24" viewBox="0 0 60 24">
                <line x1="0" y1="12" x2="48" y2="12" stroke="#22c55e" strokeWidth="16" strokeLinecap="round" />
                <polygon points="60,12 48,6 48,18" fill="#22c55e" />
              </svg>
              <div className="text-center">
                <div className="text-green-600 font-bold text-base">🟢 Excess Supply</div>
                <div className="text-gray-600 text-xs">Flow &gt; Demand</div>
                <div className="text-gray-500 text-xs font-semibold">↑ Overcapacity</div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center text-gray-600 text-sm font-semibold">
            💡 Click any arrow or node for detailed metrics • Arrow thickness indicates flow capacity
          </div>
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

import { useMemo, useState, useRef, useEffect } from 'react';
import { Settings, FileText, Package, Clock, Users } from 'lucide-react';
import type { SimulationResult } from '../../types/ui.types';
import { analyzeBottlenecks } from '../../utils/bottleneckAnalysis';
import { generateConstraintSuggestions } from '../../utils/constraintSuggestions';
import InfoPopup from './InfoPopup';
import ConstraintSuggestionsModal from './ConstraintSuggestionsModal';

interface CustomFlowMapProps {
  simulationResult: SimulationResult | null;
}

const NODE_W = 156;
const NODE_H = 130;

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
  fromSide?: 'left' | 'right' | 'top' | 'bottom';
  toSide?: 'left' | 'right' | 'top' | 'bottom';
}

// Shared Raw Materials Inventory (unified, shared between both lines) - LEFTMOST
// Positioned at x=50 (leftmost), y=200, height=600 spans both lines
const rawMaterialsNode: Node = { id: 'raw-materials', label: 'Raw Materials', x: 50, y: 200, color: '#f97316', icon: '📦' };

// MCE Station (unified, shared between both lines) - spans vertically between custom and standard
// Positioned at x=850, y=200, height=600 spans both lines with horizontal color split
const mceNode: Node = { id: 'mce-station', label: 'MCE\nStation', x: 850, y: 200, color: '#6b7280', icon: '⚙️' };

// Custom line nodes with vertical loop pattern
// Main flow: Raw Materials → Queue 1 → MCE/Station 1 → Queue 2 → Station 2 → Deliveries
// Loop flow: Queue 2 → Station 3 (below Queue 2) → Queue 3 (right) → Station 2 (above Queue 3)
const customNodes: Node[] = [
  { id: 'custom-queue1', label: 'Queue 1', x: 470, y: 200, color: '#f97316', icon: '📦' },
  { id: 'custom-queue2', label: 'Queue 2', x: 1220, y: 200, color: '#f97316', icon: '📦' },
  { id: 'custom-station2', label: 'Station 2', x: 1590, y: 200, color: '#3b82f6', icon: '⚙️' },
  { id: 'custom-deliveries', label: 'Deliveries', x: 1960, y: 200, color: '#22c55e', icon: '📦' },
  // Loop nodes: Station 3 below Queue 2, Queue 3 below Station 2 - aligned with main line
  { id: 'custom-station3', label: 'Station 3', x: 1220, y: 360, color: '#3b82f6', icon: '⚙️' },
  { id: 'custom-queue3', label: 'Queue 3', x: 1590, y: 360, color: '#f97316', icon: '📦' },
];

// Standard line nodes (continuous single row, bottom section, 250px gaps)
// Flow: Raw Materials → Queue 1 → MCE → Queue 2 → Initial Batching → Queue 3 → Manual Processing → Queue 4 → Final Batching → Queue 5 → Deliveries
const standardNodes: Node[] = [
  { id: 'std-queue1', label: 'Queue 1', x: 470, y: 700, color: '#f97316', icon: '📦' },
  { id: 'std-queue2', label: 'Queue 2', x: 1220, y: 700, color: '#f97316', icon: '📦' },
  { id: 'std-batch1', label: 'Initial\nBatching', x: 1590, y: 700, color: '#a855f7', icon: '⏱️' },
  { id: 'std-queue3', label: 'Queue 3', x: 1960, y: 700, color: '#f97316', icon: '📦' },
  { id: 'std-arcp', label: 'Manual\nProcessing', x: 2330, y: 700, color: '#ec4899', icon: '👥' },
  { id: 'std-queue4', label: 'Queue 4', x: 2700, y: 700, color: '#f97316', icon: '📦' },
  { id: 'std-batch2', label: 'Final\nBatching', x: 3070, y: 700, color: '#a855f7', icon: '⏱️' },
  { id: 'std-queue5', label: 'Queue 5', x: 3440, y: 700, color: '#f97316', icon: '📦' },
  { id: 'std-deliveries', label: 'Deliveries', x: 3810, y: 700, color: '#22c55e', icon: '📦' },
];

const nodes: Node[] = [rawMaterialsNode, mceNode, ...customNodes, ...standardNodes];

function findNode(id: string): Node | undefined {
  return nodes.find((n) => n.id === id);
}

// Icon mapping utility - maps emoji strings to lucide-react components
function getIconComponent(icon: string) {
  switch (icon) {
    case '⚙️':
      return Settings;
    case '📋':
      return FileText;
    case '📦':
      return Package;
    case '⏱️':
      return Clock;
    case '👥':
      return Users;
    default:
      return Settings; // Default fallback
  }
}

function makeCurve(fromNode: Node, toNode: Node, extra = 0, fromSide: 'left' | 'right' | 'top' | 'bottom' = 'right', toSide: 'left' | 'right' | 'top' | 'bottom' = 'left'): string {
  // Special handling for tall shared resource nodes (raw materials, MCE station)
  const TALL_NODE_HEIGHT = 600;
  const fromHeight = (fromNode.id === 'raw-materials' || fromNode.id === 'mce-station') ? TALL_NODE_HEIGHT : NODE_H;
  const toHeight = (toNode.id === 'raw-materials' || toNode.id === 'mce-station') ? TALL_NODE_HEIGHT : NODE_H;

  // Calculate connection points based on specified sides
  let sx: number, sy: number, ex: number, ey: number;

  // From point
  switch (fromSide) {
    case 'left':
      sx = fromNode.x;
      sy = fromNode.y + fromHeight / 2;
      break;
    case 'right':
      sx = fromNode.x + NODE_W;
      sy = fromNode.y + fromHeight / 2;
      break;
    case 'top':
      sx = fromNode.x + NODE_W / 2;
      sy = fromNode.y;
      break;
    case 'bottom':
      sx = fromNode.x + NODE_W / 2;
      sy = fromNode.y + fromHeight;
      break;
  }

  // To point
  switch (toSide) {
    case 'left':
      ex = toNode.x;
      ey = toNode.y + toHeight / 2;
      break;
    case 'right':
      ex = toNode.x + NODE_W;
      ey = toNode.y + toHeight / 2;
      break;
    case 'top':
      ex = toNode.x + NODE_W / 2;
      ey = toNode.y;
      break;
    case 'bottom':
      ex = toNode.x + NODE_W / 2;
      ey = toNode.y + toHeight;
      break;
  }

  const dx = ex - sx;
  const dy = ey - sy;

  // Handle special connection patterns for the loop
  let cx1: number, cy1: number, cx2: number, cy2: number;

  // Left-to-right horizontal (backwards arrow like Queue 3 → Station 3)
  if (fromSide === 'left' && toSide === 'right' && Math.abs(dy) < 50) {
    const offset = 100;
    cx1 = sx - offset;
    cy1 = sy;
    cx2 = ex + offset;
    cy2 = ey;
    return `M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${ex} ${ey}`;
  }

  // Left-to-left vertical (wrap around like Station 3 → Queue 2)
  if (fromSide === 'left' && toSide === 'left' && Math.abs(dx) < 50) {
    const offset = 120;
    cx1 = sx - offset;
    cy1 = sy;
    cx2 = ex - offset;
    cy2 = ey;
    return `M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${ex} ${ey}`;
  }

  // Right-to-right vertical (wrap around like Station 2 → Queue 3)
  if (fromSide === 'right' && toSide === 'right' && Math.abs(dx) < 50) {
    const offset = 120;
    cx1 = sx + offset;
    cy1 = sy;
    cx2 = ex + offset;
    cy2 = ey;
    return `M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${ex} ${ey}`;
  }

  // Bottom-to-right (downward then right like Station 2 → Queue 3)
  if (fromSide === 'bottom' && toSide === 'right') {
    const xOffset = 50;
    const yOffset = Math.abs(dy) * 0.5;
    cx1 = sx;
    cy1 = sy + yOffset;
    cx2 = ex + xOffset;
    cy2 = ey;
    return `M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${ex} ${ey}`;
  }

  // Default logic for other vertical/diagonal cases
  if (Math.abs(dy) > 50 || fromSide === 'bottom' || fromSide === 'top' || toSide === 'bottom' || toSide === 'top') {
    cx1 = sx + (fromSide === 'left' ? -Math.abs(dx) * 0.3 : fromSide === 'right' ? Math.abs(dx) * 0.3 : 0);
    cy1 = sy + (fromSide === 'bottom' ? Math.abs(dy) * 0.3 : fromSide === 'top' ? -Math.abs(dy) * 0.3 : dy * 0.3);
    cx2 = ex + (toSide === 'left' ? -Math.abs(dx) * 0.3 : toSide === 'right' ? Math.abs(dx) * 0.3 : 0);
    cy2 = ey + (toSide === 'bottom' ? Math.abs(dy) * 0.3 : toSide === 'top' ? -Math.abs(dy) * 0.3 : -dy * 0.3);
    return `M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${ex} ${ey}`;
  }

  // Default horizontal flow (left to right)
  cx1 = sx + Math.max(40, dx * 0.3) + extra;
  cx2 = ex - Math.max(40, dx * 0.3) - extra;
  return `M ${sx} ${sy} C ${cx1} ${sy} ${cx2} ${ey} ${ex} ${ey}`;
}

// Flow color and width functions - dynamic arrow styling based on balance/bottleneck/surplus
function getFlowColor(flowRate: number, demandRate: number): string {
  const gap = flowRate - demandRate;
  if (gap < -0.5) return '#ef4444'; // Red - shortage/bottleneck
  if (gap > 0.5) return '#22c55e'; // Green - excess/surplus
  return '#3b82f6'; // Blue - balanced
}

function getArrowWidth(flowRate: number, demandRate: number): number {
  const gap = flowRate - demandRate;
  if (gap < -0.5) return 3;  // Thinner arrow - bottleneck/shortage (RED)
  if (gap > 0.5) return 5;   // Thicker arrow - excess supply (GREEN)
  return 4;                  // Medium arrow - balanced (BLUE)
}

function getArrowMarker(flowRate: number, demandRate: number): string {
  const gap = flowRate - demandRate;
  if (gap < -0.5) return 'url(#arrow-red)';    // Red arrow marker
  if (gap > 0.5) return 'url(#arrow-green)';   // Green arrow marker
  return 'url(#arrow-blue)';                   // Blue arrow marker
}

function Node({ node, info, efficiency, queueCount }: { node: Node; info?: React.ReactNode; efficiency?: number; queueCount?: number }) {
  const IconComponent = getIconComponent(node.icon);

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
      {/* Lucide-react icon rendered via foreignObject */}
      <foreignObject x={10} y={10} width={50} height={50}>
        <div className="w-full h-full flex items-center justify-center">
          <IconComponent className="w-7 h-7 text-white" strokeWidth={2.5} />
        </div>
      </foreignObject>
      {/* Node label moved higher */}
      <text x={NODE_W / 2} y={78} textAnchor="middle" fontSize={13} fontWeight={700} fill="white">
        {node.label}
      </text>
      {/* Queue count badge - displayed below label */}
      {queueCount !== undefined && (
        <g>
          <rect
            x={NODE_W / 2 - 35}
            y={90}
            width={70}
            height={24}
            rx={8}
            fill="rgba(251, 146, 60, 0.9)"
            stroke="#f97316"
            strokeWidth={1.5}
          />
          <text
            x={NODE_W / 2}
            y={106}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill="white"
          >
            {queueCount}
          </text>
        </g>
      )}
      {/* Efficiency badge - larger size */}
      {efficiency !== undefined && (
        <g>
          <rect
            x={NODE_W / 2 - 45}
            y={NODE_H - 32}
            width={90}
            height={28}
            rx={10}
            fill="rgba(255,255,255,0.3)"
            stroke="white"
            strokeWidth={1.5}
          />
          <text
            x={NODE_W / 2}
            y={NODE_H - 14}
            textAnchor="middle"
            fontSize={18}
            fontWeight={700}
            fill="white"
          >
            {efficiency.toFixed(0)}%
          </text>
        </g>
      )}
      {/* Info button moved to top-right */}
      {info && (
        <foreignObject x={NODE_W - 35} y={10} width={25} height={25} style={{ zIndex: 10 }} pointerEvents="all">
          {info}
        </foreignObject>
      )}
    </g>
  );
}

function RawMaterialsInventory({ x, y, info }: { x: number; y: number; info?: React.ReactNode }) {
  const width = 156;
  const height = 600; // Spans from y=200 (custom line) to y=800 (standard line)

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Gradient for raw materials */}
      <defs>
        <linearGradient id="raw-materials-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>

      {/* Border/outline */}
      <rect
        width={width}
        height={height}
        rx={12}
        fill="url(#raw-materials-gradient)"
        stroke="white"
        strokeWidth={3}
        className="drop-shadow-lg"
      />

      {/* Icon in center */}
      <foreignObject x={10} y={height / 2 - 30} width={100} height={60}>
        <div className="w-full h-full flex items-center justify-center">
          <Package className="w-12 h-12 text-white" strokeWidth={2.5} />
        </div>
      </foreignObject>

      {/* Labels showing consumption */}
      <text
        x={width / 2}
        y={150}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="white"
      >
        Custom: 1 part
      </text>
      <text
        x={width / 2}
        y={height - 150}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="white"
      >
        Standard: 2 parts
      </text>

      {/* Info popup */}
      {info && (
        <foreignObject x={width - 30} y={5} width={25} height={25} pointerEvents="all">
          {info}
        </foreignObject>
      )}
    </g>
  );
}

function MCEStation({ x, y, mceAllocation, info }: { x: number; y: number; mceAllocation: number; info?: React.ReactNode }) {
  const width = 156;
  const height = 600; // Spans from y=200 (custom line) to y=800 (standard line)

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Gradients for each section */}
      <defs>
        <linearGradient id="mce-purple-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="mce-blue-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>

      {/* Border/outline */}
      <rect
        width={width}
        height={height}
        rx={12}
        fill="none"
        stroke="white"
        strokeWidth={3}
        className="drop-shadow-lg"
      />

      {/* Top section - Custom line (purple) - horizontal split based on allocation */}
      <rect
        width={width}
        height={height * mceAllocation}
        rx={12}
        fill="url(#mce-purple-gradient)"
        className="drop-shadow-lg"
      />

      {/* Bottom section - Standard line (blue) */}
      <rect
        y={height * mceAllocation}
        width={width}
        height={height * (1 - mceAllocation)}
        rx={12}
        fill="url(#mce-blue-gradient)"
        className="drop-shadow-lg"
      />

      {/* Percentage text in custom section */}
      <text
        x={width / 2}
        y={height * mceAllocation / 2 + 5}
        textAnchor="middle"
        fontSize={18}
        fontWeight={700}
        fill="white"
      >
        {(mceAllocation * 100).toFixed(0)}%
      </text>

      {/* Percentage text in standard section */}
      <text
        x={width / 2}
        y={height * mceAllocation + (height * (1 - mceAllocation) / 2) + 5}
        textAnchor="middle"
        fontSize={18}
        fontWeight={700}
        fill="white"
      >
        {((1 - mceAllocation) * 100).toFixed(0)}%
      </text>

      {/* Station label in center */}
      <text
        x={width / 2}
        y={height / 2 - 10}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill="white"
      >
        MCE
      </text>
      <text
        x={width / 2}
        y={height / 2 + 10}
        textAnchor="middle"
        fontSize={14}
        fontWeight={600}
        fill="white"
      >
        Station 1
      </text>

      {/* Info popup */}
      {info && (
        <foreignObject x={width - 30} y={5} width={25} height={25} pointerEvents="all">
          {info}
        </foreignObject>
      )}
    </g>
  );
}

function Edge({ edge, index, onPopupToggle, metrics }: { edge: Edge; index: number; metrics?: FlowMetrics; activePopupId: string | null; onPopupToggle: (id: string) => void }) {
  const from = findNode(edge.from);
  const to = findNode(edge.to);

  if (!from || !to) return null;

  const edgeId = `${edge.from}-${edge.to}-${index}`;
  const d = makeCurve(from, to, 0, edge.fromSide || 'right', edge.toSide || 'left'); // Use edge-specific connection points

  // Get flow metrics first
  const flowMetrics = metrics || edge.getMetrics?.() || { flowRate: 0, demandRate: 0 };

  // Dynamic styling based on flow conditions (balance/bottleneck/surplus)
  const strokeColor = getFlowColor(flowMetrics.flowRate, flowMetrics.demandRate);
  const strokeWidth = getArrowWidth(flowMetrics.flowRate, flowMetrics.demandRate);
  const arrowMarker = getArrowMarker(flowMetrics.flowRate, flowMetrics.demandRate);

  // Calculate midpoint for label positioning
  const fromSide = edge.fromSide || 'right';
  const toSide = edge.toSide || 'left';

  // Get connection points
  const fromHeight = (from.id === 'raw-materials' || from.id === 'mce-station') ? 600 : NODE_H;
  const toHeight = (to.id === 'raw-materials' || to.id === 'mce-station') ? 600 : NODE_H;

  let sx: number, sy: number, ex: number, ey: number;

  switch (fromSide) {
    case 'left': sx = from.x; sy = from.y + fromHeight / 2; break;
    case 'right': sx = from.x + NODE_W; sy = from.y + fromHeight / 2; break;
    case 'top': sx = from.x + NODE_W / 2; sy = from.y; break;
    case 'bottom': sx = from.x + NODE_W / 2; sy = from.y + fromHeight; break;
  }

  switch (toSide) {
    case 'left': ex = to.x; ey = to.y + toHeight / 2; break;
    case 'right': ex = to.x + NODE_W; ey = to.y + toHeight / 2; break;
    case 'top': ex = to.x + NODE_W / 2; ey = to.y; break;
    case 'bottom': ex = to.x + NODE_W / 2; ey = to.y + toHeight; break;
  }

  const midX = (sx + ex) / 2;
  const midY = (sy + ey) / 2;

  // Format flow rate for display
  const flowRate = flowMetrics.flowRate.toFixed(1);

  return (
    <>
      <path
        key={`edge-${edgeId}`}
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd={arrowMarker}
        className="cursor-pointer"
        onClick={() => onPopupToggle(edgeId)}
      />

      {/* Flow rate label */}
      <g transform={`translate(${midX}, ${midY})`}>
        {/* Background rectangle for readability */}
        <rect
          x="-25"
          y="-10"
          width="50"
          height="20"
          fill="white"
          stroke={strokeColor}
          strokeWidth="1"
          rx="4"
          opacity="0.95"
        />
        {/* Flow rate text */}
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fontWeight="600"
          fill={strokeColor}
        >
          {flowRate}/d
        </text>
      </g>

      {/* Invisible path for future use (edge metrics moved to popup) */}
      <path id={`path-${edge.from}-${edge.to}`} d={d} fill="none" stroke="none" />
    </>
  );
}

function EdgePopup({ edge, metrics, onClose }: { edge: Edge; index: number; metrics?: FlowMetrics; onClose: () => void }) {
  const from = findNode(edge.from);
  const to = findNode(edge.to);

  if (!from || !to) return null;

  const flowMetrics = metrics || edge.getMetrics?.() || { flowRate: 0, demandRate: 0 };
  const gap = flowMetrics.flowRate - flowMetrics.demandRate;
  const isBottleneck = gap < -0.5;
  const bottleneckRatio = flowMetrics.demandRate > 0 ? flowMetrics.flowRate / flowMetrics.demandRate : 1;

  return (
    <foreignObject x={from.x + NODE_W + 50} y={from.y} width={300} height={250} pointerEvents="all">
      <div
        className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-500 rounded-xl shadow-2xl p-4"
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

  // Timeline state
  const finalDayIndex = simulationResult?.state.history.dailyCash.length ? simulationResult.state.history.dailyCash.length - 1 : 0;
  const [timelineDay, setTimelineDay] = useState(finalDayIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Zoom and pan state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const initialTransformRef = useRef({ x: 0, y: 0 });

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
    const target = e.target as Element;
    if (e.button === 0 && !target.closest('button, foreignObject')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      initialTransformRef.current = { x: transform.x, y: transform.y };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      const DRAG_SENSITIVITY = 1.5;
      const deltaX = (e.clientX - dragStart.x) * DRAG_SENSITIVITY;
      const deltaY = (e.clientY - dragStart.y) * DRAG_SENSITIVITY;
      setTransform({
        ...transform,
        x: initialTransformRef.current.x + deltaX,
        y: initialTransformRef.current.y + deltaY
      });
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

  // Timeline playback effect
  useEffect(() => {
    if (!isPlaying || !simulationResult) return;

    const interval = setInterval(() => {
      setTimelineDay(prevDay => {
        const maxDay = simulationResult.state.history.dailyCash.length - 1;
        if (prevDay >= maxDay) {
          setIsPlaying(false);
          return maxDay;
        }
        return prevDay + 1;
      });
    }, 1000 / playbackSpeed); // Adjust speed based on playbackSpeed

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, simulationResult]);

  // Update timeline day when simulation result changes
  useEffect(() => {
    if (simulationResult) {
      const maxDay = simulationResult.state.history.dailyCash.length - 1;
      setTimelineDay(maxDay);
    }
  }, [simulationResult]);

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
  const maxDayIndex = state.history.dailyCash.length - 1;
  const recentDays = 50;

  // Function to get metrics for a specific day
  const getMetricsForDay = (dayIndex: number) => {
    const startIdx = Math.max(0, dayIndex - recentDays);

    // Calculate production metrics
    const customProductionData = state.history.dailyCustomProduction.slice(startIdx, dayIndex + 1);
    const avgCustomProduction = customProductionData.reduce((sum, d) => sum + d.value, 0) / (dayIndex - startIdx + 1);

    const customWIP = state.history.dailyCustomWIP[dayIndex]?.value || 0;
    const experts = state.history.dailyExperts[dayIndex]?.value || 0;
    const rookies = state.history.dailyRookies[dayIndex]?.value || 0;
    const arcpCapacity = (experts * 3) + (rookies * 3 * 0.4);
    const mceAllocation = simulationResult?.strategy?.mceAllocationCustom ?? 0.5;

    // Calculate standard line metrics
    const standardProductionData = state.history.dailyStandardProduction.slice(startIdx, dayIndex + 1);
    const avgStandardProduction = standardProductionData.reduce((sum, d) => sum + d.value, 0) / (dayIndex - startIdx + 1);
    const standardWIP = state.history.dailyStandardWIP[dayIndex]?.value || 0;
    const standardBatchSize = simulationResult?.strategy?.standardBatchSize ?? 60;
    const finishedStandard = state.history.dailyFinishedStandard[dayIndex]?.value || 0;

    // Calculate queue counts for display (estimate based on WIP and history)
    const queueCounts: Record<string, number> = {
      // Custom line queues - distribute WIP across queues
      'custom-queue1': Math.round(customWIP * 0.3),
      'custom-queue2': Math.round(customWIP * 0.4),
      'custom-queue3': Math.round(customWIP * 0.3),

      // Standard line queues - distribute WIP across queues
      'std-queue1': Math.round(standardWIP * 0.2),
      'std-queue2': Math.round(standardWIP * 0.2),
      'std-queue3': Math.round(standardWIP * 0.3),
      'std-queue4': Math.round(standardWIP * 0.2),
      'std-queue5': finishedStandard,
    };

    return {
      avgCustomProduction,
      avgStandardProduction,
      customWIP,
      standardWIP,
      arcpCapacity,
      mceAllocation,
      standardBatchSize,
      queueCounts,
      experts,
      rookies,
    };
  };

  // Use timeline day for current metrics
  const dayIndex = Math.min(timelineDay, maxDayIndex);
  const metrics = getMetricsForDay(dayIndex);
  const { avgCustomProduction, avgStandardProduction, customWIP: finalCustomWIP, standardWIP: finalStandardWIP,
    arcpCapacity, mceAllocation, standardBatchSize, queueCounts } = metrics;

  // Flow metrics for each edge
  const edgeMetrics: Record<string, FlowMetrics> = {
    // Custom line metrics
    'custom-orders-queue1': { flowRate: avgCustomProduction, demandRate: avgCustomProduction + 1 },
    'custom-queue1-station1': { flowRate: avgCustomProduction, demandRate: 6 },
    'custom-station1-queue2': { flowRate: avgCustomProduction, demandRate: avgCustomProduction + 2 },
    'custom-queue2-station2': { flowRate: avgCustomProduction, demandRate: 6 },
    'custom-station2-queue3': { flowRate: avgCustomProduction * 0.3, demandRate: avgCustomProduction * 0.3 },
    'custom-queue3-station3': { flowRate: avgCustomProduction * 0.3, demandRate: 6 },
    'custom-station3-queue2': { flowRate: avgCustomProduction * 0.3, demandRate: arcpCapacity * mceAllocation },
    'custom-station2-deliveries': { flowRate: avgCustomProduction, demandRate: avgCustomProduction + 1 },

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

  // Custom line edges with clockwise loop pattern
  // Main flow: Raw Materials → Queue 1 → MCE/Station 1 → Queue 2
  // Loop: Queue 2 → Station 2 (right) → Queue 3 (down from Station 2, enter right) → Station 3 (left to right) → Queue 2 (left to left, up)
  // Exit: Station 2 → Deliveries
  const customEdges: Edge[] = [
    // Main flow to loop entry
    { from: 'raw-materials', to: 'custom-queue1', getMetrics: () => edgeMetrics['custom-orders-queue1'] },
    { from: 'custom-queue1', to: 'mce-station', getMetrics: () => edgeMetrics['custom-queue1-station1'] },
    { from: 'mce-station', to: 'custom-queue2', getMetrics: () => edgeMetrics['custom-station1-queue2'] },

    // Clockwise loop: Queue 2 → Station 2 → Queue 3 → Station 3 → Queue 2
    { from: 'custom-queue2', to: 'custom-station2', getMetrics: () => edgeMetrics['custom-queue2-station2'] },
    { from: 'custom-station2', to: 'custom-queue3', fromSide: 'right', toSide: 'right', getMetrics: () => edgeMetrics['custom-station2-queue3'] },
    { from: 'custom-queue3', to: 'custom-station3', fromSide: 'left', toSide: 'right', getMetrics: () => edgeMetrics['custom-queue3-station3'] },
    { from: 'custom-station3', to: 'custom-queue2', fromSide: 'left', toSide: 'left', getMetrics: () => edgeMetrics['custom-station3-queue2'] },

    // Exit from loop
    { from: 'custom-station2', to: 'custom-deliveries', getMetrics: () => edgeMetrics['custom-station2-deliveries'] },
  ];

  // Standard line edges - continuous flow: Raw Materials → Queue 1 → MCE → Queue 2 → Initial Batching → Queue 3 → Manual Processing → Queue 4 → Final Batching → Queue 5 → Deliveries
  const standardEdges: Edge[] = [
    { from: 'raw-materials', to: 'std-queue1', getMetrics: () => edgeMetrics['std-orders-queue1'] },
    { from: 'std-queue1', to: 'mce-station', getMetrics: () => edgeMetrics['std-queue1-station1'] },
    { from: 'mce-station', to: 'std-queue2', getMetrics: () => edgeMetrics['std-station1-queue2'] },
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
    <div className="relative w-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border-2 border-gray-300">
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-600">Team: Bearkats</div>
          <div className="text-2xl font-bold text-gray-800">
            🏭 Dual-Line Production Flow
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Custom Line Metrics Button */}
          <div className="relative">
            <InfoPopup
              title="📊 Custom Line Metrics"
              buttonClassName={`px-4 py-2 rounded-lg font-bold text-sm shadow-lg cursor-pointer hover:scale-105 transition-transform ${isCustomBottleneck ? 'bg-red-600 text-white animate-pulse' : 'bg-purple-600 text-white'}`}
              content={
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-purple-300 font-semibold mb-1">Custom WIP</div>
                      <div className="text-2xl font-bold text-white">{finalCustomWIP} orders</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-purple-300 font-semibold mb-1">Daily Output</div>
                      <div className="text-2xl font-bold text-white">{avgCustomProduction.toFixed(1)} units/day</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-purple-300 font-semibold mb-1">Total Delivered</div>
                      <div className="text-2xl font-bold text-white">
                        {Math.round(state.history.dailyCustomProduction.reduce((sum, d) => sum + d.value, 0))} units
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-purple-300 font-semibold mb-1">ARCP Allocated</div>
                      <div className="text-2xl font-bold text-white">{(arcpCapacity * mceAllocation).toFixed(1)} units/day</div>
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${isCustomBottleneck ? 'bg-red-900/30 border border-red-600' : 'bg-purple-900/30 border border-purple-600'}`}>
                    <div className="text-sm font-semibold text-white mb-1">Status</div>
                    <div className="text-gray-300 text-sm">
                      {isCustomBottleneck ? '⚠️ Bottleneck detected - WIP exceeds 50 orders' : '✅ Operating normally'}
                    </div>
                  </div>
                </div>
              }
            >
              <span>{isCustomBottleneck ? '⚠️ BOTTLENECK' : 'CUSTOM'}</span>
            </InfoPopup>
          </div>

          {/* Standard Line Metrics Button */}
          <div className="relative">
            <InfoPopup
              title="📊 Standard Line Metrics"
              buttonClassName={`px-4 py-2 rounded-lg font-bold text-sm shadow-lg cursor-pointer hover:scale-105 transition-transform ${isStandardBottleneck ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white'}`}
              content={
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-blue-300 font-semibold mb-1">Standard WIP</div>
                      <div className="text-2xl font-bold text-white">{Math.round(finalStandardWIP)} units</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-blue-300 font-semibold mb-1">Daily Output</div>
                      <div className="text-2xl font-bold text-white">{avgStandardProduction.toFixed(1)} units/day</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-blue-300 font-semibold mb-1">Total Delivered</div>
                      <div className="text-2xl font-bold text-white">
                        {Math.round(state.history.dailyStandardProduction.reduce((sum, d) => sum + d.value, 0))} units
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-blue-300 font-semibold mb-1">ARCP Allocated</div>
                      <div className="text-2xl font-bold text-white">{(arcpCapacity * (1 - mceAllocation)).toFixed(1)} units/day</div>
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${isStandardBottleneck ? 'bg-red-900/30 border border-red-600' : 'bg-blue-900/30 border border-blue-600'}`}>
                    <div className="text-sm font-semibold text-white mb-1">Status</div>
                    <div className="text-gray-300 text-sm">
                      {isStandardBottleneck ? '⚠️ Bottleneck detected - WIP exceeds 100 units' : '✅ Operating normally'}
                    </div>
                  </div>
                </div>
              }
            >
              <span>{isStandardBottleneck ? '⚠️ BOTTLENECK' : 'STANDARD'}</span>
            </InfoPopup>
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
        viewBox="0 0 4000 1000"
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ minHeight: '700px', userSelect: 'none' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          {/* Small, subtle arrow markers for clean flowing appearance */}
          <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
          </marker>
          <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
          <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
          </marker>
          <marker id="arrow-gray" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
          </marker>
          <filter id="arrow-shadow">
            <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.3"/>
          </filter>
        </defs>

        {/* Apply zoom and pan transform to all content */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>

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

            // Raw Materials Inventory - special rendering
            if (n.id === 'raw-materials') {
              const rawMaterialsInfo = (
                <InfoPopup
                  title="Raw Materials Inventory (Shared Resource)"
                  buttonClassName="bg-orange-600 hover:bg-orange-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  content={
                    <div className="text-sm text-gray-300 space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">Overview</h4>
                        <p>
                          Shared raw materials warehouse storing generic parts assigned to both production lines as needed.
                        </p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <h4 className="text-md font-semibold text-orange-300 mb-2">Consumption Details</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Custom Line Usage:</span>
                            <span className="text-purple-300 font-bold">1 part per unit</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Standard Line Usage:</span>
                            <span className="text-blue-300 font-bold">2 parts per unit</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                            <span className="text-gray-400">Material Type:</span>
                            <span className="text-white font-bold">Identical generic parts</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-orange-900 border border-orange-600 rounded-lg p-3">
                        <h4 className="text-md font-semibold text-orange-300 mb-2">💡 Note</h4>
                        <p className="text-xs">
                          Both custom and standard devices use identical raw materials. The difference is in quantity consumed and processing method.
                        </p>
                      </div>
                    </div>
                  }
                />
              );
              return <RawMaterialsInventory key={n.id} x={n.x} y={n.y} info={rawMaterialsInfo} />;
            }

            // MCE Station - special rendering
            if (n.id === 'mce-station') {
              const mceInfo = (
                <InfoPopup
                  title="Station 1 - MCE (Material Consumption & Forming)"
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
                        <h4 className="text-md font-semibold text-purple-300 mb-2">MCE Allocation</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">MCE Capacity:</span>
                            <span className="text-white font-bold">6 units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Custom Line:</span>
                            <span className="text-purple-300 font-bold">{(mceAllocation * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Standard Line:</span>
                            <span className="text-blue-300 font-bold">{((1 - mceAllocation) * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <h4 className="text-md font-semibold text-pink-300 mb-2">ARCP Capacity (Bottleneck)</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total ARCP:</span>
                            <span className="text-white font-bold">{arcpCapacity.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Custom ARCP:</span>
                            <span className="text-purple-300 font-bold">{(arcpCapacity * mceAllocation).toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Standard ARCP:</span>
                            <span className="text-blue-300 font-bold">{(arcpCapacity * (1 - mceAllocation)).toFixed(1)} units/day</span>
                          </div>
                        </div>
                      </div>
                      {arcpCapacity < 6 && (
                        <div className="bg-red-900/30 border border-red-600 rounded-lg p-3">
                          <h4 className="text-md font-semibold text-red-300 mb-2">⚠️ Labor Shortage</h4>
                          <p className="text-xs">
                            ARCP capacity ({arcpCapacity.toFixed(1)} units/day) is below MCE capacity (6 units/day). Consider hiring more workers to eliminate bottleneck.
                          </p>
                        </div>
                      )}
                    </div>
                  }
                />
              );
              return <MCEStation key={n.id} x={n.x} y={n.y} mceAllocation={mceAllocation} info={mceInfo} />;
            }

            // Custom line stations (Station 2 and 3 - manual processing)
            if (n.id === 'custom-station2' || n.id === 'custom-station3') {
              // These stations have 6 units/day capacity but are bottlenecked upstream at ARCP
              const stationCapacity = 6;
              const customEfficiency = (avgCustomProduction / stationCapacity) * 100;
              info = (
                <InfoPopup
                  title={`${n.label} Details`}
                  buttonClassName="bg-purple-600 hover:bg-purple-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  content={
                    <div className="text-sm text-gray-300">
                      <p>Custom line manual processing station</p>
                      <div className="mt-2">
                        <div>Capacity: {stationCapacity} units/day</div>
                        <div>Current Throughput: {avgCustomProduction.toFixed(1)} units/day</div>
                        <div>Utilization: {customEfficiency.toFixed(1)}%</div>
                      </div>
                      {avgCustomProduction === 0 && finalCustomWIP > 0 && (
                        <div className="mt-3 bg-red-900/30 border border-red-600 rounded p-2 text-xs">
                          <div className="font-bold text-red-300">⚠️ Bottlenecked upstream</div>
                          <div className="text-gray-300">{finalCustomWIP} orders stuck in system</div>
                        </div>
                      )}
                    </div>
                  }
                />
              );
              return <Node node={n} key={n.id} info={info} efficiency={customEfficiency} />;
            }
            // Standard line stations and batching
            else if (n.id === 'std-arcp' || n.id === 'std-batch1' || n.id === 'std-batch2') {
              const isStation = n.id === 'std-arcp';
              const isBatching = n.id === 'std-batch1' || n.id === 'std-batch2';
              const standardEfficiency = isStation ? (avgStandardProduction / (arcpCapacity * (1 - mceAllocation))) * 100 : undefined;
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
                            <div>Capacity: {`${(arcpCapacity * (1 - mceAllocation)).toFixed(1)} units/day`}</div>
                            <div>Utilization: {standardEfficiency?.toFixed(1)}%</div>
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
              return <Node node={n} key={n.id} info={info} efficiency={standardEfficiency} />;
            }
            // All other nodes (including queues)
            const queueCount = queueCounts[n.id];
            return <Node node={n} key={n.id} info={info} queueCount={queueCount} />;
          })}
        </g>

        {/* External line labels - positioned far left, clear of raw materials */}
        <g>
          <text x={5} y={250} fontSize={18} fontWeight={700} fill="#9333ea" textAnchor="start">CUSTOM</text>
          <text x={5} y={750} fontSize={18} fontWeight={700} fill="#2563eb" textAnchor="start">STANDARD</text>
        </g>

        {/* Horizontal separator line - aligned with MCE 50/50 split at y=500 */}
        <g>
          <line x1={0} y1={500} x2={4000} y2={500} stroke="#d1d5db" strokeWidth={4} strokeDasharray="12 6" opacity={0.5} />
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

      {/* Timeline Controls */}
      <div className="mt-6 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-blue-500 rounded-xl p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-4 text-center">🎬 Timeline Playback</h3>

        {/* Day Counter */}
        <div className="text-center mb-4">
          <span className="text-3xl font-bold text-blue-400">Day {dayIndex}</span>
          <span className="text-xl text-gray-400"> / {maxDayIndex}</span>
        </div>

        {/* Timeline Slider */}
        <div className="mb-4">
          <input
            type="range"
            min="0"
            max={maxDayIndex}
            value={dayIndex}
            onChange={(e) => setTimelineDay(Number(e.target.value))}
            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(dayIndex / maxDayIndex) * 100}%, #4b5563 ${(dayIndex / maxDayIndex) * 100}%, #4b5563 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Day 0</span>
            <span>Day {maxDayIndex}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4">
          {/* Skip to Start */}
          <button
            onClick={() => setTimelineDay(0)}
            className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center text-white transition-all duration-200"
            title="Skip to Start"
          >
            ⏮
          </button>

          {/* Step Backward */}
          <button
            onClick={() => setTimelineDay(Math.max(0, dayIndex - 1))}
            disabled={dayIndex === 0}
            className="w-10 h-10 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg flex items-center justify-center text-white transition-all duration-200"
            title="Step Backward"
          >
            ◀
          </button>

          {/* Play/Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all duration-200 shadow-lg"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Step Forward */}
          <button
            onClick={() => setTimelineDay(Math.min(maxDayIndex, dayIndex + 1))}
            disabled={dayIndex === maxDayIndex}
            className="w-10 h-10 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg flex items-center justify-center text-white transition-all duration-200"
            title="Step Forward"
          >
            ▶
          </button>

          {/* Skip to End */}
          <button
            onClick={() => setTimelineDay(maxDayIndex)}
            className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center text-white transition-all duration-200"
            title="Skip to End"
          >
            ⏭
          </button>

          {/* Speed Selector */}
          <div className="ml-4 flex items-center gap-2">
            <span className="text-sm text-gray-400">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer hover:bg-gray-600 transition-all duration-200"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>
        </div>

        {/* Progress Information */}
        <div className="mt-4 text-center text-sm text-gray-400">
          {isPlaying ? (
            <span className="text-green-400 font-semibold">▶ Playing at {playbackSpeed}x speed...</span>
          ) : (
            <span>Paused - Use controls to navigate timeline</span>
          )}
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

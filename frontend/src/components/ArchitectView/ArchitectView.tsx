import { useEffect, useState, useCallback, memo, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { CustomMachine } from '../../types';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface MetricCfg {
  key: string;
  label: string;
  unit: string;
  normal_min: number | null;
  normal_max: number | null;
  warning_max: number | null;
  critical_max: number | null;
}

export interface MachineCfg {
  id: string;
  name: string;
  type: string;
  location: string;
  description: string;
  position: { x: number; y: number };
  metrics: MetricCfg[];
  dependencies_downstream: { machine_id: string; impact_weight: number }[];
}

// ─── Type colors + mapping ───────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  thermal_control: { bg: '#0d2137', border: '#3b82f6', icon: '❄️' },
  filling:         { bg: '#0d2137', border: '#8b5cf6', icon: '🫙' },
  capping:         { bg: '#0d2137', border: '#06b6d4', icon: '🔩' },
  conveyor:        { bg: '#0d2137', border: '#f59e0b', icon: '📦' },
  storage:         { bg: '#0d2137', border: '#22c55e', icon: '🏭' },
};
const DEFAULT_COLOR = { bg: '#0d2137', border: '#64748b', icon: '⚙️' };

const MACHINE_TYPE_MAP: Record<string, string> = {
  'Cooling Unit':    'thermal_control',
  'Filling Machine': 'filling',
  'Capping System':  'capping',
  'Conveyor':        'conveyor',
  'Storage Unit':    'storage',
  'Compressor':      'thermal_control',
  'Pump Station':    'filling',
  'Heat Exchanger':  'thermal_control',
  'Reactor':         'storage',
  'Custom':          'storage',
};

export function customToMachineCfg(m: CustomMachine): MachineCfg {
  return {
    id: m.id,
    name: m.name,
    type: MACHINE_TYPE_MAP[m.type] ?? m.type.toLowerCase().replace(/\s+/g, '_'),
    location: m.location || 'Custom Area',
    description: m.description || 'Custom machine added by System Architect.',
    position: m.position,
    metrics: (m.sensors ?? []).map((sensor, i) => ({
      key: `sensor_${i}`,
      label: sensor,
      unit: '',
      normal_min: null,
      normal_max: null,
      warning_max: null,
      critical_max: null,
    })),
    dependencies_downstream: (m.dependsOn ?? []).map((id) => ({ machine_id: id, impact_weight: 0.5 })),
  };
}

// ─── ArchNodeData ────────────────────────────────────────────────────────────────

interface ArchNodeData {
  cfg: MachineCfg;
  selected: boolean;
  liveHealth: string;
  isCustom: boolean;
  dataSourceName: string;
}

// ─── ArchitectNode ───────────────────────────────────────────────────────────────

const ArchitectNode = memo(({ data }: NodeProps) => {
  const { cfg, selected: isSel, liveHealth, isCustom, dataSourceName } = data as unknown as ArchNodeData;
  const col = TYPE_COLORS[cfg.type] ?? DEFAULT_COLOR;
  const [hovered, setHovered] = useState(false);
  const [aiHovered, setAiHovered] = useState(false);

  const healthColors: Record<string, string> = {
    healthy: '#22c55e',
    warning: '#f59e0b',
    critical: '#ef4444',
  };
  const healthDot = healthColors[liveHealth] ?? '#64748b';

  const handleStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    background: col.border,
    border: '2px solid #0d1120',
    cursor: 'crosshair',
  };

  return (
    <>
      <Handle type="target" position={Position.Left}   style={handleStyle} />
      <Handle type="target" position={Position.Top}    style={handleStyle} />
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setAiHovered(false); }}
        style={{
          background: col.bg,
          border: `2px solid ${isSel ? '#a78bfa' : col.border}`,
          boxShadow: isSel
            ? '0 0 0 3px #a78bfa30, 0 4px 24px #a78bfa20'
            : '0 2px 12px rgba(0,0,0,0.4)',
          borderRadius: 14,
          padding: '10px 14px',
          width: 180,
          cursor: 'pointer',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          position: 'relative',
        }}
      >
        {/* NEW badge for custom machines */}
        {isCustom && (
          <div style={{
            position: 'absolute', top: -7, left: -6,
            background: '#f472b6', color: 'white', borderRadius: 5,
            fontSize: 8, fontWeight: 800, padding: '1px 5px',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            NEW
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>{col.icon}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: healthDot, display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: healthDot, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              {liveHealth}
            </span>
          </div>
        </div>

        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 3 }}>
          {cfg.name}
        </div>
        <div style={{ color: '#64748b', fontSize: 11 }}>{cfg.location}</div>

        {cfg.metrics.length > 0 ? (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {cfg.metrics.slice(0, 3).map((m) => (
              <span key={m.key} style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 99,
                background: `${col.border}18`, border: `1px solid ${col.border}40`,
                color: col.border, fontWeight: 600,
              }}>
                {m.label}
              </span>
            ))}
            {cfg.metrics.length > 3 && (
              <span style={{ fontSize: 9, color: '#64748b' }}>+{cfg.metrics.length - 3}</span>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 10, color: '#475569', fontStyle: 'italic' }}>
            No sensors defined
          </div>
        )}

        {/* 🤖 AI Robot Badge */}
        <div
          style={{ position: 'absolute', bottom: 7, right: 7, zIndex: 10 }}
          onMouseEnter={(e) => { e.stopPropagation(); setAiHovered(true); setHovered(false); }}
          onMouseLeave={() => { setAiHovered(false); setHovered(true); }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: aiHovered ? 'linear-gradient(135deg, #6d28d9, #a855f7)' : 'linear-gradient(135deg, #4c1d95, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, cursor: 'help',
            boxShadow: aiHovered ? '0 0 14px #a855f780' : '0 2px 6px rgba(0,0,0,0.4)',
            transition: 'all 0.2s',
            border: '1.5px solid #a855f740',
          }}>
            🤖
          </div>
          {/* AI Context Tooltip */}
          {aiHovered && (
            <div style={{
              position: 'absolute',
              left: 24,
              bottom: -4,
              zIndex: 9999,
              width: 256,
              background: 'linear-gradient(135deg, #1a0a2e 0%, #16032a 100%)',
              border: '1px solid #a855f740',
              borderRadius: 12,
              padding: '12px 14px',
              pointerEvents: 'none',
              boxShadow: '0 8px 32px rgba(168,85,247,0.2)',
            }}>
              <p style={{ color: '#a855f7', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>
                🤖 AI Layer Context
              </p>
              <p style={{ color: '#c4b5fd', fontSize: 9, marginBottom: 8, opacity: 0.7 }}>
                What the AI knows about this machine
              </p>
              <p style={{ color: '#e2e8f0', fontSize: 11, lineHeight: 1.55, marginBottom: 8 }}>
                {cfg.description || 'No AI context configured. Add a description to help the AI layer with root-cause analysis.'}
              </p>

              {cfg.metrics.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ color: '#7c3aed', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
                    Monitored Signals ({cfg.metrics.length})
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {cfg.metrics.map((m) => (
                      <span key={m.key} style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 99,
                        background: '#7c3aed20', border: '1px solid #a855f740',
                        color: '#c4b5fd', fontWeight: 600,
                      }}>
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {cfg.dependencies_downstream.length > 0 && (
                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10 }}>⚡</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>
                    Downstream impact: {cfg.dependencies_downstream.length} {cfg.dependencies_downstream.length === 1 ? 'machine' : 'machines'}
                  </span>
                </div>
              )}

              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10 }}>🔌</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>
                  {dataSourceName || (isCustom ? 'No data source linked' : 'Backend simulation')}
                </span>
              </div>

              <p style={{ marginTop: 8, fontSize: 9, color: '#7c3aed', opacity: 0.6, fontStyle: 'italic', borderTop: '1px solid #7c3aed20', paddingTop: 6 }}>
                AI uses this context for failure prediction &amp; root-cause analysis
              </p>
            </div>
          )}
        </div>

        {/* Hover tooltip */}
        {hovered && !aiHovered && (
          <div style={{
            position: 'absolute',
            left: 192,
            top: 0,
            zIndex: 9999,
            width: 250,
            background: 'linear-gradient(135deg, #0d1425 0%, #0f1932 100%)',
            border: `1px solid ${col.border}50`,
            borderRadius: 12,
            padding: '12px 14px',
            pointerEvents: 'none',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          }}>
            <p style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Machine Context
            </p>
            <p style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.55, marginBottom: 8 }}>
              {cfg.description || 'No description configured.'}
            </p>

            {cfg.metrics.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
                  Sensors / Metrics ({cfg.metrics.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {cfg.metrics.map((m) => (
                    <span key={m.key} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 99,
                      background: `${col.border}20`, border: `1px solid ${col.border}40`,
                      color: col.border,
                    }}>
                      {m.label}{m.unit ? ` (${m.unit})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11 }}>🔌</span>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                {dataSourceName || (isCustom ? 'No data source' : 'Backend simulation')}
              </span>
            </div>

            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11 }}>📍</span>
              <span style={{ fontSize: 10, color: '#64748b' }}>{cfg.location}</span>
            </div>

            {cfg.dependencies_downstream.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11 }}>🔗</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>
                  {cfg.dependencies_downstream.length} downstream {cfg.dependencies_downstream.length === 1 ? 'dependency' : 'dependencies'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right}  style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </>
  );
});

ArchitectNode.displayName = 'ArchitectNode';
const nodeTypes = { architect: ArchitectNode };

// ─── ConfigPanel ─────────────────────────────────────────────────────────────────

function ConfigPanel({
  cfg, isCustom, onClose, onDeleteMachine,
}: {
  cfg: MachineCfg;
  isCustom: boolean;
  onClose: () => void;
  onDeleteMachine: () => void;
}) {
  const col = TYPE_COLORS[cfg.type] ?? DEFAULT_COLOR;
  const [editing, setEditing] = useState(false);

  const updateCustomMachine = useAuthStore((s) => s.updateCustomMachine);
  const dataSources = useAuthStore((s) => s.dataSources);
  const customMachines = useAuthStore((s) => s.customMachines);
  const currentMachine = customMachines.find((m) => m.id === cfg.id);

  const [editName, setEditName] = useState(cfg.name);
  const [editDesc, setEditDesc] = useState(cfg.description);
  const [editLoc, setEditLoc] = useState(cfg.location);
  const [editSensors, setEditSensors] = useState<string[]>(currentMachine?.sensors ?? []);
  const [editDsId, setEditDsId] = useState<string>(currentMachine?.dataSourceId ?? '');
  const [sensorInput, setSensorInput] = useState('');

  const addSensor = () => {
    const v = sensorInput.trim();
    if (v && !editSensors.includes(v)) setEditSensors((p) => [...p, v]);
    setSensorInput('');
  };

  const handleSave = () => {
    updateCustomMachine(cfg.id, {
      name: editName.trim() || cfg.name,
      description: editDesc,
      location: editLoc,
      sensors: editSensors,
      dataSourceId: editDsId || null,
    });
    setEditing(false);
  };

  const connectedDs = dataSources.find((d) => d.id === currentMachine?.dataSourceId);

  return (
    <motion.div
      key={cfg.id}
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="absolute top-0 right-0 h-full w-80 bg-[#0d1120] border-l border-border-dark flex flex-col z-10 overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border-dark flex-shrink-0"
        style={{ borderBottomColor: `${col.border}40` }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{col.icon}</span>
          <div>
            <h3 className="text-text-primary font-bold text-sm leading-tight">{cfg.name}</h3>
            <p className="text-text-secondary text-xs">{cfg.location}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {isCustom && !editing && (
            <button
              onClick={() => setEditing(true)}
              title="Edit machine"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-accent-blue hover:bg-accent-blue/15 transition-all text-sm"
            >
              ✏️
            </button>
          )}
          {isCustom && (
            <button
              onClick={onDeleteMachine}
              title="Remove this machine"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-critical hover:bg-critical/15 transition-all text-sm"
            >
              🗑️
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/10 transition-all"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {editing ? (
          /* ── Edit mode ── */
          <div className="px-4 py-3 space-y-3">
            <div>
              <label className="block text-xs text-text-secondary font-semibold uppercase tracking-wide mb-1">Name</label>
              <input
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary font-semibold uppercase tracking-wide mb-1">Location / Zone</label>
              <input
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                value={editLoc}
                onChange={(e) => setEditLoc(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary font-semibold uppercase tracking-wide mb-1">Description</label>
              <textarea
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-accent-blue resize-none h-16"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary font-semibold uppercase tracking-wide mb-1">Data Source</label>
              <select
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                value={editDsId}
                onChange={(e) => setEditDsId(e.target.value)}
              >
                <option value="">None (manual)</option>
                {dataSources.map((ds) => (
                  <option key={ds.id} value={ds.id}>{ds.name} ({ds.protocol})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary font-semibold uppercase tracking-wide mb-1">Sensors / Metrics</label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-bg-dark border border-border-dark rounded-xl mb-1.5 min-h-[34px]">
                {editSensors.map((s, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs bg-accent-blue/15 border border-accent-blue/30 text-accent-blue rounded-full px-2 py-0.5">
                    {s}
                    <button
                      onClick={() => setEditSensors((p) => p.filter((_, j) => j !== i))}
                      className="text-accent-blue/60 hover:text-critical ml-0.5"
                    >×</button>
                  </span>
                ))}
                <input
                  className="flex-1 min-w-[100px] bg-transparent text-text-primary text-xs outline-none placeholder:text-text-secondary/40"
                  placeholder={editSensors.length === 0 ? 'Type sensor, press Enter…' : 'Add sensor…'}
                  value={sensorInput}
                  onChange={(e) => setSensorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && sensorInput.trim()) {
                      e.preventDefault();
                      addSensor();
                    }
                  }}
                />
              </div>
              <p className="text-[10px] text-text-secondary/50">Press Enter or comma to add each sensor</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 text-xs text-text-secondary border border-border-dark rounded-xl py-1.5 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 text-xs text-white bg-accent-blue hover:bg-blue-400 rounded-xl py-1.5 font-semibold transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <>
            {/* Data source */}
            {isCustom && (
              <div className="px-4 py-3 border-b border-border-dark">
                <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold mb-1.5">Data Source</p>
                <div className="flex items-center gap-2 text-xs">
                  <span>🔌</span>
                  {connectedDs ? (
                    <span className="text-healthy font-semibold">{connectedDs.name}</span>
                  ) : (
                    <span className="text-warning italic">Not connected — click ✏️ to configure</span>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="px-4 py-3 border-b border-border-dark">
              <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold mb-2">Purpose</p>
              <p className="text-text-primary text-xs leading-relaxed">{cfg.description}</p>
            </div>

            {/* Sensors / Metrics */}
            {cfg.metrics.length > 0 ? (
              <div className="px-4 py-3 border-b border-border-dark">
                <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold mb-3">
                  Sensors / Metrics · {cfg.metrics.length}
                </p>
                <div className="space-y-2">
                  {cfg.metrics.map((m) => (
                    <div key={m.key} className="bg-bg-dark rounded-xl p-2.5 border border-border-dark">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-text-primary text-xs font-semibold">{m.label}</span>
                        {m.unit && (
                          <span className="text-text-secondary text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">
                            {m.unit}
                          </span>
                        )}
                      </div>
                      {(m.normal_min != null || m.normal_max != null) && (
                        <div className="flex gap-3 text-[10px]">
                          <span className="text-healthy">✓ {m.normal_min ?? '—'}–{m.normal_max ?? '—'}</span>
                          {m.warning_max != null && <span className="text-warning">⚠ &gt;{m.warning_max}</span>}
                          {m.critical_max != null && <span className="text-critical">✕ &gt;{m.critical_max}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 border-b border-border-dark">
                <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold mb-2">Sensors / Metrics</p>
                <p className="text-xs text-text-secondary italic">
                  {isCustom ? 'No sensors defined — click ✏️ to add sensors.' : 'No metrics in schema.'}
                </p>
              </div>
            )}

            {/* Downstream deps */}
            {cfg.dependencies_downstream.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold mb-3">
                  Downstream Dependencies
                </p>
                {cfg.dependencies_downstream.map((dep) => (
                  <div key={dep.machine_id} className="flex items-center gap-3 bg-bg-dark rounded-xl p-2.5 border border-border-dark mb-2">
                    <span className="text-accent-blue text-sm">→</span>
                    <div className="flex-1">
                      <p className="text-text-primary text-xs font-semibold capitalize">
                        {dep.machine_id.replace(/_/g, ' ')}
                      </p>
                      <div className="mt-1 h-1 bg-border-dark rounded-full overflow-hidden">
                        <div className="h-full bg-accent-blue rounded-full" style={{ width: `${dep.impact_weight * 100}%` }} />
                      </div>
                      <p className="text-text-secondary text-[10px] mt-0.5">
                        Impact: {(dep.impact_weight * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── EdgePanel ───────────────────────────────────────────────────────────────────

function EdgePanel({
  edgeId, sourceName, sourceDesc, targetName, targetDesc,
  weight, isCustomConn, context,
  onClose, onDelete, onWeightChange, onContextChange,
}: {
  edgeId: string;
  sourceName: string;
  sourceDesc: string;
  targetName: string;
  targetDesc: string;
  weight: number;
  isCustomConn: boolean;
  context?: string;
  onClose: () => void;
  onDelete: () => void;
  onWeightChange: (w: number) => void;
  onContextChange?: (ctx: string) => void;
}) {
  const [localWeight, setLocalWeight] = useState(weight);
  const [localContext, setLocalContext] = useState(context ?? '');
  const [tab, setTab] = useState<'details' | 'context' | 'actions'>('details');

  useEffect(() => { setLocalWeight(weight); }, [weight]);
  useEffect(() => { setLocalContext(context ?? ''); }, [context]);

  return (
    <motion.div
      key={edgeId}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-14 left-3 z-20 bg-[#0d1120] border border-border-dark rounded-2xl shadow-2xl overflow-hidden"
      style={{ width: 320 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark">
        <span className="text-text-primary font-bold text-sm">
          🔗 {isCustomConn ? 'Custom Dependency' : 'Backend Dependency'}
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/10 transition-all text-xs"
        >✕</button>
      </div>

      {/* Route pill — always visible */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0a0f1e] border-b border-border-dark text-xs">
        <span className="text-text-primary font-semibold truncate">{sourceName}</span>
        <span className="text-accent-blue flex-shrink-0 font-bold">→</span>
        <span className="text-text-primary font-semibold truncate">{targetName}</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border-dark">
        {(['details', 'context', 'actions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-[11px] font-semibold py-2 transition-all ${
              tab === t
                ? 'text-accent-blue border-b-2 border-accent-blue bg-accent-blue/5'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'details' ? '⚙️ Details' : t === 'context' ? '🤖 Context' : '🛠️ Actions'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === 'details' && (
          <div>
            {(sourceDesc || targetDesc) && (
              <div className="bg-bg-dark border border-border-dark rounded-xl p-3 mb-3 space-y-1">
                {sourceDesc && (
                  <p className="text-text-secondary text-[10px] leading-relaxed">
                    <span className="text-accent-blue font-semibold">Source: </span>{sourceDesc}
                  </p>
                )}
                {targetDesc && (
                  <p className="text-text-secondary text-[10px] leading-relaxed">
                    <span className="text-accent-blue font-semibold">Target: </span>{targetDesc}
                  </p>
                )}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-secondary font-semibold uppercase tracking-wide">Impact Weight</span>
                <span className="text-accent-blue text-xs font-bold">{(localWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.05} value={localWeight}
                disabled={!isCustomConn}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLocalWeight(v);
                  onWeightChange(v);
                }}
                className="w-full accent-blue-500"
                style={{ opacity: isCustomConn ? 1 : 0.5 }}
              />
              <div className="flex justify-between text-[10px] text-text-secondary mt-0.5">
                <span>Low impact</span>
                <span>High impact</span>
              </div>
            </div>
            {!isCustomConn && (
              <p className="text-[10px] text-text-secondary/60 mt-3 italic">
                Backend-defined dependency — read-only here.
              </p>
            )}
          </div>
        )}

        {tab === 'context' && (
          <div>
            <p className="text-[10px] text-text-secondary mb-2 leading-relaxed">
              {isCustomConn
                ? 'Describe how a fault in the source propagates to the target. AI uses this for root-cause analysis and failure prediction.'
                : 'Backend-defined dependency — context is read-only.'}
            </p>
            <textarea
              className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2.5 text-text-primary text-xs focus:outline-none focus:border-accent-blue resize-none h-28"
              placeholder="e.g. When the filling machine pressure spikes, downstream capping speed must compensate…"
              value={localContext}
              readOnly={!isCustomConn}
              onChange={(e) => { if (isCustomConn) setLocalContext(e.target.value); }}
              style={{ opacity: isCustomConn ? 1 : 0.6 }}
            />
            {isCustomConn && (
              <button
                onClick={() => { if (onContextChange) onContextChange(localContext); }}
                className="mt-2 text-xs font-bold px-4 py-1.5 rounded-xl w-full transition-all"
                style={{ background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640' }}
              >
                Save Context
              </button>
            )}
            {localContext && !isCustomConn && (
              <p className="mt-3 text-[11px] text-text-secondary/70 italic">🤖 {localContext}</p>
            )}
          </div>
        )}

        {tab === 'actions' && (
          <div className="space-y-2">
            {isCustomConn ? (
              <>
                <button
                  onClick={() => setTab('context')}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl transition-all text-left"
                  style={{ background: '#7c3aed20', color: '#a855f7', border: '1px solid #7c3aed40' }}
                >
                  🤖 Edit AI Context…
                </button>
                <button
                  onClick={onDelete}
                  className="w-full text-xs font-bold text-critical border border-critical/40 bg-critical/10 hover:bg-critical/20 px-3 py-2 rounded-xl transition-all"
                >
                  🗑️ Remove Connection
                </button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-[11px] text-text-secondary/70 mb-1">Backend-defined connection</p>
                <p className="text-[10px] text-text-secondary/50">Modify in backend machine config to change this dependency</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── ArchitectViewInner ───────────────────────────────────────────────────────────

function ArchitectViewInner() {
  const [configs, setConfigs] = useState<MachineCfg[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [pendingContext, setPendingContext] = useState('');
  const fetchedRef = useRef(false);

  const machines               = useAppStore((s) => s.machines);
  const customMachines         = useAuthStore((s) => s.customMachines);
  const dataSources            = useAuthStore((s) => s.dataSources);
  const removeCustomMachine    = useAuthStore((s) => s.removeCustomMachine);
  const setCustomMachinePosition = useAuthStore((s) => s.setCustomMachinePosition);
  const setSavedMachinePosition  = useAuthStore((s) => s.setSavedMachinePosition);
  const architectConnections   = useAuthStore((s) => s.architectConnections);
  const addArchitectConnection = useAuthStore((s) => s.addArchitectConnection);
  const removeArchitectConnection = useAuthStore((s) => s.removeArchitectConnection);
  const updateArchitectConnectionWeight = useAuthStore((s) => s.updateArchitectConnectionWeight);
  const updateArchitectConnectionContext = useAuthStore((s) => s.updateArchitectConnectionContext);
  const setApiDependencies     = useAuthStore((s) => s.setApiDependencies);

  // All machine cfgs (API + custom) for name/desc lookups
  const allConfigs = useMemo(
    () => [...configs, ...customMachines.map(customToMachineCfg)],
    [configs, customMachines]
  );

  // ── Fetch API machine configs ────────────────────────────────────────────────
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    const _apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || '';
    if (!_apiUrl) { setLoading(false); return; } // No backend in offline/Vercel mode
    fetch(`${_apiUrl}/api/config/machines`)
      .then((r) => r.json())
      .then((data: { machines: MachineCfg[] }) => {
        const cfgs = data.machines ?? [];
        setConfigs(cfgs);
        setLoading(false);
        // Share API deps with the rest of the shell
        const deps = cfgs.flatMap((m) =>
          m.dependencies_downstream.map((dep) => ({
            source: m.id,
            sourceName: m.name,
            target: dep.machine_id,
            targetName: cfgs.find((x) => x.id === dep.machine_id)?.name ?? dep.machine_id,
            weight: dep.impact_weight,
          }))
        );
        setApiDependencies(deps);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  }, [setApiDependencies]);

  // ── Edge builders ────────────────────────────────────────────────────────────
  const buildApiEdges = useCallback((cfgs: MachineCfg[]): Edge[] =>
    cfgs.flatMap((cfg) =>
      cfg.dependencies_downstream.map((dep) => ({
        id: `api-${cfg.id}->${dep.machine_id}`,
        source: cfg.id,
        target: dep.machine_id,
        animated: false,
        style: { stroke: '#334155', strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed' as const, color: '#334155' },
        label: `${(dep.impact_weight * 100).toFixed(0)}%`,
        labelStyle: { fill: '#64748b', fontSize: 10 },
        labelBgStyle: { fill: '#0d1120', fillOpacity: 0.9 },
        data: { isCustomConn: false },
      }))
    ), []);

  const buildCustomEdges = useCallback(
    (conns: typeof architectConnections): Edge[] =>
      conns.map((conn) => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2.5 },
        markerEnd: { type: 'arrowclosed' as const, color: '#3b82f6' },
        label: `${(conn.weight * 100).toFixed(0)}%`,
        labelStyle: { fill: '#60a5fa', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#0d1120', fillOpacity: 0.9 },
        data: { isCustomConn: true },
      })),
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ── Helper to build custom node ──────────────────────────────────────────────
  const buildCustomNode = useCallback((m: CustomMachine): Node => {
    const ds = dataSources.find((d) => d.id === m.dataSourceId);
    const savedPos = useAuthStore.getState().savedMachinePositions;
    return {
      id: m.id,
      type: 'architect',
      position: savedPos[m.id] ?? m.position,
      draggable: true,
      data: {
        cfg: customToMachineCfg(m),
        isCustom: true,
        selected: false,
        liveHealth: 'healthy',
        dataSourceName: ds?.name ?? '',
      },
    };
  }, [dataSources]);

  // ── Initial node + edge build when API configs load ──────────────────────────
  useEffect(() => {
    if (configs.length === 0) return;
    // Read saved positions at effect-run time (no need to add to deps —
    // this only runs once when configs arrive; onNodeDragStop keeps positions fresh)
    const savedPos = useAuthStore.getState().savedMachinePositions;
    const apiNodes: Node[] = configs.map((cfg, i) => ({
      id: cfg.id,
      type: 'architect',
      position: savedPos[cfg.id] ?? cfg.position ?? { x: (i % 3) * 260, y: Math.floor(i / 3) * 200 },
      draggable: true,
      data: {
        cfg,
        isCustom: false,
        selected: false,
        liveHealth: machines[cfg.id]?.health ?? 'healthy',
        dataSourceName: 'Backend simulation',
      },
    }));
    setNodes((prev) => {
      const existingCustom = prev.filter((n) => (n.data as unknown as ArchNodeData).isCustom);
      return [...apiNodes, ...existingCustom];
    });
    setEdges([...buildApiEdges(configs), ...buildCustomEdges(architectConnections)]);

    // Seed savedMachinePositions for backend machines that haven't been
    // manually positioned yet — this ensures all roles see the same layout
    // from day one, even before the architect drags any node.
    const currentSaved = useAuthStore.getState().savedMachinePositions;
    configs.forEach((cfg) => {
      if (!currentSaved[cfg.id] && cfg.position) {
        setSavedMachinePosition(cfg.id, cfg.position);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs]);

  // ── Sync custom machine nodes — add, remove, AND update ─────────────────────
  useEffect(() => {
    setNodes((prev) => {
      const customIds = new Set(customMachines.map((m) => m.id));
      const customMap = new Map(customMachines.map((m) => [m.id, m]));

      // Remove deleted custom nodes; update existing ones with latest data
      const filtered = prev
        .filter((n) => !(n.data as unknown as ArchNodeData).isCustom || customIds.has(n.id))
        .map((n) => {
          if (!(n.data as unknown as ArchNodeData).isCustom) return n;
          const m = customMap.get(n.id);
          if (!m) return n;
          const ds = dataSources.find((d) => d.id === m.dataSourceId);
          return {
            ...n,
            data: {
              ...(n.data as object),
              cfg: customToMachineCfg(m),
              dataSourceName: ds?.name ?? '',
            },
          };
        });

      // Add newly-added custom machines
      const existingIds = new Set(filtered.map((n) => n.id));
      const toAdd = customMachines
        .filter((m) => !existingIds.has(m.id))
        .map((m) => buildCustomNode(m));

      return [...filtered, ...toAdd];
    });
  }, [customMachines, dataSources, buildCustomNode]);

  // ── Sync custom edges when architectConnections changes ──────────────────────
  useEffect(() => {
    setEdges((prev) => {
      const apiEdges = prev.filter((e) => !(e.data as { isCustomConn?: boolean } | undefined)?.isCustomConn);
      return [...apiEdges, ...buildCustomEdges(architectConnections)];
    });
  }, [architectConnections, buildCustomEdges]);

  // ── Live health updates ──────────────────────────────────────────────────────
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...(n.data as object), liveHealth: machines[n.id]?.health ?? 'healthy' },
      }))
    );
  }, [machines, setNodes]);

  // ── Selection highlight ──────────────────────────────────────────────────────
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...(n.data as object), selected: n.id === selectedNodeId },
      }))
    );
  }, [selectedNodeId, setNodes]);

  // ── Callbacks ────────────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id));
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const exists = architectConnections.some(
        (c) => c.source === connection.source && c.target === connection.target
      );
      if (exists) return;
      // Show context dialog before saving
      setPendingConnection({ source: connection.source, target: connection.target });
      setPendingContext('');
    },
    [architectConnections]
  );

  const confirmPendingConnection = useCallback((skipContext = false) => {
    if (!pendingConnection) return;
    const id = `custom-${pendingConnection.source}-${pendingConnection.target}-${Date.now()}`;
    addArchitectConnection({
      id,
      source: pendingConnection.source,
      target: pendingConnection.target,
      weight: 0.5,
      context: (!skipContext && pendingContext.trim()) ? pendingContext.trim() : undefined,
    });
    setPendingConnection(null);
    setPendingContext('');
  }, [pendingConnection, pendingContext, addArchitectConnection]);

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((n) => {
        if ((n.data as unknown as ArchNodeData).isCustom) removeCustomMachine(n.id);
      });
    },
    [removeCustomMachine]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((e) => {
        if ((e.data as { isCustomConn?: boolean })?.isCustomConn) removeArchitectConnection(e.id);
      });
    },
    [removeArchitectConnection]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Persist layout for ALL nodes so operator sees the same arrangement
      setSavedMachinePosition(node.id, node.position);
      // Also update custom machine's own position record
      if ((node.data as unknown as ArchNodeData).isCustom) {
        setCustomMachinePosition(node.id, node.position);
      }
    },
    [setCustomMachinePosition, setSavedMachinePosition]
  );

  // ── Derived for panels ───────────────────────────────────────────────────────
  const selectedNodeCfg     = allConfigs.find((c) => c.id === selectedNodeId) ?? null;
  const selectedNodeIsCustom = customMachines.some((m) => m.id === selectedNodeId);

  const selectedEdge         = edges.find((e) => e.id === selectedEdgeId);
  const selectedEdgeIsCustom = !!(selectedEdge?.data as { isCustomConn?: boolean } | undefined)?.isCustomConn;
  const selectedArchConn     = architectConnections.find((c) => c.id === selectedEdgeId);

  const handleDeleteSelectedNode = useCallback(() => {
    if (selectedNodeId && selectedNodeIsCustom) {
      removeCustomMachine(selectedNodeId);
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, selectedNodeIsCustom, removeCustomMachine]);

  const handleDeleteSelectedEdge = useCallback(() => {
    if (selectedEdgeId && selectedEdgeIsCustom) {
      removeArchitectConnection(selectedEdgeId);
      setSelectedEdgeId(null);
    }
  }, [selectedEdgeId, selectedEdgeIsCustom, removeArchitectConnection]);

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
          <p style={{ color: '#64748b', fontSize: 14 }}>Loading architecture…</p>
        </div>
      </div>
    );
  }

  if (fetchError && configs.length === 0 && customMachines.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏗️</div>
          <p style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Architecture Configured</p>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
            Start the backend or add machines via Machine Config tab.
          </p>
          <button
            onClick={() => { fetchedRef.current = false; setFetchError(false); setLoading(true); }}
            style={{ background: '#3b82f620', border: '1px solid #3b82f640', color: '#3b82f6', borderRadius: 8, padding: '6px 16px', fontSize: 12, cursor: 'pointer' }}
          >
            Retry Backend
          </button>
        </div>
      </div>
    );
  }

  // Show canvas even if backend is down (custom machines still work)
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0f1117' }}>
      {/* Hint bar */}
      <div className="absolute top-3 left-3 z-10 bg-[#0d1120]/90 border border-border-dark rounded-xl px-3 py-1.5 text-xs text-text-secondary flex items-center gap-2 backdrop-blur-sm pointer-events-none">
        <span>🏗️</span>
        <span>Hover for context · Drag handles to connect · Click to inspect · Del to remove</span>
      </div>

      {/* Toolbar for selected custom node */}
      {selectedNodeId && selectedNodeIsCustom && !selectedEdgeId && (
        <div className="absolute top-3 z-20 flex gap-2" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          <button
            onClick={handleDeleteSelectedNode}
            className="flex items-center gap-1.5 text-xs text-critical border border-critical/40 bg-critical/10 hover:bg-critical/20 px-3 py-1.5 rounded-xl transition-all font-semibold"
          >
            🗑️ Remove Machine
          </button>
        </div>
      )}

      {fetchError && (
        <div className="absolute top-3 right-3 z-10 bg-warning/10 border border-warning/30 rounded-xl px-3 py-1.5 text-xs text-warning pointer-events-none">
          ⚠ Backend offline — showing custom machines only
        </div>
      )}

      {/* Pending connection context modal */}
      {pendingConnection && (() => {
        const srcName = allConfigs.find((c) => c.id === pendingConnection.source)?.name ?? pendingConnection.source;
        const tgtName = allConfigs.find((c) => c.id === pendingConnection.target)?.name ?? pendingConnection.target;
        const srcSensors = customMachines.find((m) => m.id === pendingConnection.source)?.sensors ?? [];
        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0d1120] border border-border-dark rounded-2xl shadow-2xl overflow-hidden"
              style={{ width: 380 }}
            >
              <div className="px-5 py-4 border-b border-border-dark">
                <p className="text-text-primary font-bold text-sm mb-0.5">🔗 New Dependency Connection</p>
                <div className="flex items-center gap-2 text-xs mt-2">
                  <span className="text-accent-blue font-semibold truncate">{srcName}</span>
                  <span className="text-text-secondary flex-shrink-0">→</span>
                  <span className="text-accent-blue font-semibold truncate">{tgtName}</span>
                </div>
              </div>
              <div className="p-5">
                <label className="block text-xs text-text-secondary font-semibold uppercase tracking-wide mb-2">
                  Dependency Context <span className="text-text-secondary/50 font-normal normal-case">(optional — AI will use this)</span>
                </label>
                {/* Sensor pills */}
                {srcSensors.length > 0 && (
                  <div className="mb-3 p-2.5 bg-[#0a0f1e] border border-accent-blue/15 rounded-xl">
                    <p className="text-[10px] text-accent-blue/70 font-semibold uppercase tracking-wide mb-2">
                      🤖 Sensors on {srcName} — click to insert context
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {srcSensors.map((sensor) => (
                        <button
                          key={sensor}
                          type="button"
                          onClick={() => setPendingContext((c) =>
                            c ? `${c} When ${sensor} exceeds threshold, it affects ${tgtName}.` : `When ${sensor} exceeds threshold, it affects ${tgtName}.`
                          )}
                          className="text-[10px] px-2 py-0.5 rounded-full border border-accent-blue/30 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-all"
                        >
                          + {sensor}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <textarea
                  autoFocus
                  className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2.5 text-text-primary text-xs focus:outline-none focus:border-accent-blue resize-none h-20"
                  placeholder={`How does a fault in ${srcName} affect ${tgtName}? What signals indicate this dependency?`}
                  value={pendingContext}
                  onChange={(e) => setPendingContext(e.target.value)}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => confirmPendingConnection(false)}
                    className="flex-1 text-xs font-bold py-2 rounded-xl transition-all"
                    style={{ background: '#3b82f6', color: 'white' }}
                  >
                    Save Connection
                  </button>
                  <button
                    onClick={() => confirmPendingConnection(true)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl transition-all text-text-secondary hover:text-text-primary border border-border-dark hover:bg-white/5"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => { setPendingConnection(null); setPendingContext(''); }}
                    className="text-xs font-semibold px-4 py-2 rounded-xl transition-all text-critical hover:bg-critical/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2.5}
        panOnDrag
        zoomOnScroll
        zoomOnDoubleClick
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a2035" gap={28} size={1} />
        <Controls style={{ background: '#1a1f2e', border: '1px solid #2a3040' }} showInteractive={false} />
        <MiniMap
          style={{ background: '#0d1120', border: '1px solid #2a3040' }}
          nodeColor={(n) => {
            const d = n.data as unknown as ArchNodeData;
            return TYPE_COLORS[d.cfg?.type]?.border ?? '#64748b';
          }}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      {/* Side panels */}
      <AnimatePresence>
        {selectedNodeCfg && !selectedEdgeId && (
          <ConfigPanel
            cfg={selectedNodeCfg}
            isCustom={selectedNodeIsCustom}
            onClose={() => setSelectedNodeId(null)}
            onDeleteMachine={handleDeleteSelectedNode}
          />
        )}
        {selectedEdgeId && selectedEdge && (
          <EdgePanel
            edgeId={selectedEdgeId}
            sourceName={allConfigs.find((c) => c.id === selectedEdge.source)?.name ?? selectedEdge.source}
            sourceDesc={allConfigs.find((c) => c.id === selectedEdge.source)?.description ?? ''}
            targetName={allConfigs.find((c) => c.id === selectedEdge.target)?.name ?? selectedEdge.target}
            targetDesc={allConfigs.find((c) => c.id === selectedEdge.target)?.description ?? ''}
            weight={selectedArchConn?.weight ?? 0.5}
            isCustomConn={selectedEdgeIsCustom}
            context={selectedArchConn?.context}
            onClose={() => setSelectedEdgeId(null)}
            onDelete={handleDeleteSelectedEdge}
            onWeightChange={(w) => {
              if (selectedEdgeId) updateArchitectConnectionWeight(selectedEdgeId, w);
            }}
            onContextChange={(ctx) => {
              if (selectedEdgeId) updateArchitectConnectionContext(selectedEdgeId, ctx);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────────

export function ArchitectView() {
  return (
    <ReactFlowProvider>
      <ArchitectViewInner />
    </ReactFlowProvider>
  );
}

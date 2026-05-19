import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import type { MachineState } from '../../types';

// ─── Type-based colors (identical to ArchitectView) ──────────────────────────
const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  thermal_control: { bg: '#0d2137', border: '#3b82f6' },
  filling:         { bg: '#1a0d2e', border: '#8b5cf6' },
  capping:         { bg: '#0d1e28', border: '#06b6d4' },
  conveyor:        { bg: '#1e1a0d', border: '#f59e0b' },
  storage:         { bg: '#0d1e14', border: '#22c55e' },
};
const DEFAULT_TYPE_COLOR = { bg: '#0d1120', border: '#64748b' };

const MACHINE_ICONS: Record<string, string> = {
  thermal_control: '❄️',
  filling: '🫙',
  capping: '🔩',
  conveyor: '📦',
  storage: '🏭',
  'Cooling Unit': '❄️',
  'Filling Machine': '🫙',
  'Capping System': '🔩',
  'Conveyor': '📦',
  'Storage Unit': '🏭',
  'Compressor': '🌀',
  'Pump Station': '💧',
  'Heat Exchanger': '🔥',
  'Reactor': '⚗️',
  'Custom': '🔧',
};

const HEALTH_COLOR: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  unconfigured: '#64748b',
};

interface MachineNodeData {
  machine: MachineState;
  isCustom?: boolean;
}

export const MachineNode = memo(({ data }: NodeProps) => {
  const { machine, isCustom } = data as unknown as MachineNodeData;
  if (!machine) return null;

  const { health } = machine;
  const typeColor = TYPE_COLORS[machine.type] ?? DEFAULT_TYPE_COLOR;
  const healthColor = HEALTH_COLOR[health] ?? HEALTH_COLOR.unconfigured;

  // During an incident, override the type border with the health color so
  // the cascade immediately reads visually in the topology.
  const borderColor = health === 'healthy' ? typeColor.border : healthColor;

  const glowShadow =
    health === 'critical'
      ? `0 0 0 3px ${healthColor}30, 0 0 20px ${healthColor}40, 0 4px 16px rgba(0,0,0,0.5)`
      : health === 'warning'
      ? `0 0 0 2px ${healthColor}25, 0 0 12px ${healthColor}30, 0 4px 16px rgba(0,0,0,0.5)`
      : '0 2px 12px rgba(0,0,0,0.4)';

  const icon = MACHINE_ICONS[machine.type] ?? '⚙️';

  // Show up to 3 metrics as pills (like ArchitectNode's sensor pills)
  const topMetrics = machine.metrics.slice(0, 3);
  const extraCount = machine.metrics.length - 3;

  return (
    <>
      <Handle type="target" position={Position.Left}   style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} />

      <motion.div
        animate={{ boxShadow: glowShadow }}
        transition={{ duration: health === 'critical' ? 0.8 : 1.2, repeat: health !== 'healthy' ? Infinity : 0, repeatType: 'reverse' }}
        style={{
          background: typeColor.bg,
          border: `2px solid ${borderColor}`,
          borderRadius: 14,
          padding: '10px 14px',
          width: 180,
          cursor: 'pointer',
          position: 'relative',
          transition: 'border-color 0.3s',
        }}
      >
        {/* CUSTOM badge (pink, identical to ArchitectNode "NEW" badge) */}
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

        {/* Header: type icon + health dot + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <motion.span
              animate={health !== 'healthy' ? { opacity: [1, 0.2, 1] } : {}}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: healthColor, display: 'inline-block' }}
            />
            <span style={{ fontSize: 10, color: healthColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              {health}
            </span>
          </div>
        </div>

        {/* Machine name */}
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 2 }}>
          {machine.name}
        </div>

        {/* Location */}
        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>{machine.location}</div>

        {/* Metric pills — match ArchitectNode sensor pills exactly */}
        {topMetrics.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {topMetrics.map((m) => {
              const mc = HEALTH_COLOR[m.status] ?? typeColor.border;
              const hasLive = typeof m.value === 'number' && (m.value !== 0 || m.unit);
              const valDisplay = hasLive
                ? `${m.value % 1 === 0 ? m.value : m.value.toFixed(1)}${m.unit ? ' ' + m.unit : ''}`
                : null;
              return (
                <span
                  key={m.key ?? m.label}
                  title={m.label}
                  style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 99,
                    background: `${mc}18`, border: `1px solid ${mc}40`,
                    color: mc, fontWeight: 600, display: 'inline-flex',
                    alignItems: 'baseline', gap: 4, maxWidth: 156,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.label}
                  </span>
                  {valDisplay && (
                    <span style={{ color: '#cbd5e1', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {valDisplay}
                    </span>
                  )}
                </span>
              );
            })}
            {extraCount > 0 && (
              <span style={{ fontSize: 9, color: '#64748b', padding: '2px 4px' }}>+{extraCount}</span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>No sensors defined</div>
        )}

        {/* Degradation bar — only shown when actively degraded */}
        {machine.degradation_factor > 0.05 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ height: 3, background: '#1e293b', borderRadius: 9999, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${machine.degradation_factor * 100}%` }}
                transition={{ duration: 0.5 }}
                style={{ height: '100%', background: healthColor, borderRadius: 9999 }}
              />
            </div>
            <div style={{ fontSize: 9, color: healthColor, marginTop: 2, fontWeight: 700 }}>
              Impact: {(machine.degradation_factor * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </motion.div>

      <Handle type="source" position={Position.Right}  style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </>
  );
});

MachineNode.displayName = 'MachineNode';


/**
 * OperatorShell — Real-time operations command center for AXION Operators.
 * Layout: Machine Status Board (left) | Topology Map (center) | Incident Command Center (right)
 * Distinct from Engineer (technical charts) and Manager (business KPIs).
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TopologyMap } from '../TopologyMap/TopologyMap';
import type { Incident, MachineState } from '../../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const HEALTH_COLOR: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  unconfigured: '#64748b',
};

const HEALTH_BG: Record<string, string> = {
  healthy: 'bg-healthy/8 border-healthy/20',
  warning: 'bg-warning/10 border-warning/30',
  critical: 'bg-critical/10 border-critical/40',
  unconfigured: 'bg-white/4 border-white/10',
};

type ActionType = 'acknowledged' | 'escalated' | 'stop_requested' | 'backup_activated';

const ACTION_CONFIG: Record<ActionType, { icon: string; label: string; desc: string; color: string; bgClass: string; confirmFirst?: boolean }> = {
  acknowledged: {
    icon: '✓',
    label: 'Acknowledge',
    desc: 'Confirm you are aware and responding',
    color: '#f59e0b',
    bgClass: 'border-warning/40 text-warning hover:bg-warning/15',
  },
  escalated: {
    icon: '↑',
    label: 'Escalate to Engineering',
    desc: 'Notify process engineers immediately',
    color: '#3b82f6',
    bgClass: 'border-accent-blue/40 text-accent-blue hover:bg-accent-blue/15',
  },
  stop_requested: {
    icon: '⏹',
    label: 'Emergency Stop',
    desc: 'Halt production on affected line',
    color: '#ef4444',
    bgClass: 'border-critical/40 text-critical hover:bg-critical/15',
    confirmFirst: true,
  },
  backup_activated: {
    icon: '⟳',
    label: 'Activate Backup',
    desc: 'Switch to redundant backup system',
    color: '#22c55e',
    bgClass: 'border-healthy/40 text-healthy hover:bg-healthy/15',
  },
};

// ─── Elapsed timer hook ────────────────────────────────────────────────────────
function useElapsed(startedAt: string): string {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const calc = () => Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
    setElapsed(calc());
    const id = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Single machine status card (compact, scan-optimized) ─────────────────────
function MachineStatusCard({ machine, isAffected }: { machine: MachineState; isAffected: boolean }) {
  const setSelectedMachineId = useAppStore((s) => s.setSelectedMachineId);
  const selectedId = useAppStore((s) => s.selectedMachineId);
  const isSelected = selectedId === machine.id;

  // Primary metric: first gauge, or first line, or nothing
  const primary = machine.metrics.find((m) => m.type === 'gauge') ?? machine.metrics[0] ?? null;
  const secondary = machine.metrics.find((m) => m.type === 'line' && m !== primary) ?? null;

  const hColor = HEALTH_COLOR[machine.health] ?? '#64748b';

  return (
    <button
      onClick={() => setSelectedMachineId(isSelected ? null : machine.id)}
      className={`w-full text-left rounded-2xl border p-3 transition-all ${
        isSelected
          ? 'border-accent-blue/60 bg-accent-blue/8 ring-1 ring-accent-blue/20'
          : isAffected
          ? HEALTH_BG[machine.health]
          : 'border-border-dark bg-bg-card/60 hover:border-border-dark/80 hover:bg-bg-card'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Health indicator */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${machine.health !== 'healthy' ? 'animate-pulse' : ''}`}
            style={{ background: hColor, boxShadow: machine.health !== 'healthy' ? `0 0 6px ${hColor}80` : 'none' }}
          />
        </div>

        {/* Machine info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <p className="text-text-primary text-xs font-bold truncate leading-tight">{machine.name}</p>
            {isAffected && (
              <span className="text-[9px] font-bold uppercase flex-shrink-0 px-1 py-0.5 rounded"
                style={{ background: `${hColor}20`, color: hColor, border: `1px solid ${hColor}40` }}>
                {machine.health}
              </span>
            )}
          </div>
          <p className="text-text-secondary/60 text-[10px] truncate">{machine.location}</p>

          {/* Primary metric — large number */}
          {primary && (
            <div className="mt-2 flex items-end gap-2">
              <span
                className="text-xl font-black leading-none tabular-nums"
                style={{ color: HEALTH_COLOR[primary.status] }}
              >
                {primary.value.toFixed(primary.value < 10 ? 1 : 0)}
              </span>
              <span className="text-text-secondary/60 text-xs mb-0.5">{primary.unit}</span>
              <span className="text-text-secondary/50 text-[10px] mb-0.5 truncate">{primary.label}</span>
            </div>
          )}

          {/* Secondary metric — small */}
          {secondary && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] text-text-secondary/50">{secondary.label}:</span>
              <span className="text-[10px] font-semibold" style={{ color: HEALTH_COLOR[secondary.status] }}>
                {secondary.value.toFixed(1)}{secondary.unit}
              </span>
            </div>
          )}

          {!primary && (
            <p className="text-text-secondary/40 text-[10px] mt-1.5">No live metrics</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Incident command center ───────────────────────────────────────────────────
function IncidentCommandCenter({
  incident,
  actionState,
  onAction,
  confirmingStop,
  onConfirmStop,
  onCancelStop,
}: {
  incident: Incident;
  actionState: Record<string, string>;
  onAction: (incidentId: string, action: ActionType) => void;
  confirmingStop: string | null;
  onConfirmStop: (incidentId: string) => void;
  onCancelStop: () => void;
}) {
  const elapsed = useElapsed(incident.started_at);

  const isDone = (action: ActionType) => actionState[`${incident.id}_${action}`] === 'done';
  const isLoading = (action: ActionType) => actionState[`${incident.id}_${action}`] === 'loading';
  const actionsLog = Object.entries(actionState)
    .filter(([k, v]) => k.startsWith(incident.id + '_') && v === 'done')
    .map(([k]) => k.replace(incident.id + '_', '') as ActionType);

  const isCrit = incident.severity === 'critical';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className={`flex-shrink-0 px-4 py-3 border-b border-border-dark ${isCrit ? 'bg-critical/5' : 'bg-warning/5'}`}>
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0 ${isCrit ? 'bg-critical' : 'bg-warning'}`} />
          <span className={`text-xs font-black uppercase tracking-widest ${isCrit ? 'text-critical' : 'text-warning'}`}>
            {isCrit ? 'Critical Incident' : 'Warning'}
          </span>
          <span className={`ml-auto text-xs font-mono font-bold tabular-nums ${isCrit ? 'text-critical' : 'text-warning'}`}>
            ⏱ {elapsed}
          </span>
        </div>
        <h2 className="text-text-primary font-bold text-sm leading-snug">{incident.title}</h2>
        {actionsLog.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {actionsLog.map((a) => (
              <span key={a} className="text-[9px] px-1.5 py-0.5 bg-healthy/15 border border-healthy/30 text-healthy rounded-full font-bold">
                ✓ {ACTION_CONFIG[a]?.label ?? a}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Root cause callout */}
        <div className={`rounded-2xl p-3 border ${isCrit ? 'bg-critical/8 border-critical/30' : 'bg-warning/8 border-warning/30'}`}>
          <p className="text-[10px] uppercase tracking-wider text-text-secondary/60 mb-1">Root Cause</p>
          <p className="text-text-primary font-bold text-sm">{incident.root_cause_machine_name}</p>
          <p className={`text-xs mt-0.5 font-semibold ${isCrit ? 'text-critical' : 'text-warning'}`}>
            {incident.root_cause_metric}
          </p>
          <p className="text-text-secondary text-xs mt-1 leading-relaxed">{incident.root_cause_description}</p>
        </div>

        {/* AI Summary */}
        {(incident.ai_summary || incident.rule_summary) && (
          <div className="rounded-2xl bg-[#0f1a30] border border-accent-blue/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px]">🤖</span>
              <span className="text-[10px] uppercase tracking-wider text-accent-blue/70 font-bold">AI Analysis</span>
            </div>
            <p className="text-text-primary text-xs leading-relaxed">{incident.ai_summary ?? incident.rule_summary}</p>
          </div>
        )}

        {/* Production impact */}
        {incident.throughput_impact_pct > 0 && (
          <div className="flex items-center gap-3 bg-critical/5 border border-critical/20 rounded-xl px-3 py-2">
            <span className="text-lg">📉</span>
            <div>
              <p className="text-text-secondary text-[10px] uppercase tracking-wide">Production Impact</p>
              <p className="text-critical font-black text-lg tabular-nums leading-tight">
                ▼ {incident.throughput_impact_pct.toFixed(1)}%
              </p>
            </div>
            <p className="text-text-secondary/60 text-[10px] ml-auto text-right">throughput<br/>reduction</p>
          </div>
        )}

        {/* Affected machines */}
        {incident.affected_machines.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-secondary/60 mb-2">
              Affected Systems ({incident.affected_machines.length})
            </p>
            <div className="space-y-1.5">
              {incident.affected_machines.map((am) => {
                const hc = HEALTH_COLOR[am.health] ?? HEALTH_COLOR.unconfigured;
                return (
                  <div key={am.machine_id} className="flex items-start gap-2 rounded-xl bg-bg-dark/60 border border-border-dark px-3 py-2">
                    <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0 animate-pulse" style={{ background: hc }} />
                    <div>
                      <p className="text-text-primary text-xs font-semibold">{am.machine_name}</p>
                      <p className="text-text-secondary/70 text-[10px] leading-relaxed">{am.description}</p>
                    </div>
                    <span className="ml-auto flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                      style={{ background: `${hc}18`, color: hc, border: `1px solid ${hc}35` }}>
                      {am.health}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommended steps */}
        {incident.recommended_actions.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-secondary/60 mb-2">Recommended Steps</p>
            <ol className="space-y-1.5">
              {incident.recommended_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-accent-blue/20 border border-accent-blue/30 text-accent-blue text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-text-secondary text-xs leading-relaxed">{action}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── ONE-CLICK ACTION BUTTONS ── */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-secondary/60 mb-2.5">Corrective Actions</p>
          <div className="space-y-2">
            {(Object.keys(ACTION_CONFIG) as ActionType[]).map((actionType) => {
              const cfg = ACTION_CONFIG[actionType];
              const done = isDone(actionType);
              const loading = isLoading(actionType);
              const isStopPending = actionType === 'stop_requested' && confirmingStop === incident.id;

              return (
                <div key={actionType}>
                  {/* Confirmation dialog for Emergency Stop */}
                  {isStopPending && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-critical/10 border border-critical/40 rounded-xl p-3 mb-2"
                    >
                      <p className="text-critical text-xs font-bold mb-1">⚠ Confirm Emergency Stop</p>
                      <p className="text-text-secondary text-[10px] mb-3">This will halt production on all affected lines. Are you sure?</p>
                      <div className="flex gap-2">
                        <button onClick={() => onCancelStop()} className="flex-1 text-xs py-1.5 rounded-lg border border-border-dark text-text-secondary hover:bg-white/5 transition-all">Cancel</button>
                        <button onClick={() => onConfirmStop(incident.id)} className="flex-1 text-xs py-1.5 rounded-lg bg-critical text-white font-bold hover:bg-red-400 transition-all">
                          Confirm Stop
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <button
                    disabled={done || loading}
                    onClick={() => {
                      if (cfg.confirmFirst && !isStopPending) {
                        onAction(incident.id, actionType);
                        return;
                      }
                      if (!cfg.confirmFirst) onAction(incident.id, actionType);
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all text-xs font-semibold ${
                      done
                        ? 'border-healthy/30 bg-healthy/8 text-healthy cursor-default'
                        : loading
                        ? 'border-border-dark bg-bg-dark text-text-secondary cursor-wait'
                        : `bg-bg-dark ${cfg.bgClass} cursor-pointer`
                    }`}
                  >
                    <span className="text-base w-5 text-center flex-shrink-0">
                      {done ? '✓' : loading ? (
                        <span className="inline-block w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : cfg.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold">{done ? `${cfg.label} — Done` : cfg.label}</p>
                      {!done && <p className="text-[10px] text-text-secondary/70 mt-0.5">{cfg.desc}</p>}
                    </div>
                    {!done && !loading && (
                      <span className="text-[10px] border border-current/30 rounded-full px-1.5 py-0.5 flex-shrink-0">1-click</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Normal-mode right panel (all-clear) ──────────────────────────────────────
function AllClearPanel({ machines }: { machines: Record<string, MachineState> }) {
  const machineList = Object.values(machines);
  const healthy = machineList.filter((m) => m.health === 'healthy').length;
  const warning = machineList.filter((m) => m.health === 'warning').length;
  const critical = machineList.filter((m) => m.health === 'critical').length;
  const historyLog = useAppStore((s) => s.historyLog);
  const lastEvents = historyLog.slice(-4).reverse();

  return (
    <div className="h-full flex flex-col overflow-y-auto px-4 py-4 space-y-5">
      {/* Status badge */}
      <div className="text-center py-5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-healthy/10 border-2 border-healthy/30 mb-3">
          <span className="text-2xl">✅</span>
        </div>
        <p className="text-healthy font-black text-sm uppercase tracking-widest">All Systems Operational</p>
        <p className="text-text-secondary/60 text-xs mt-1">No active incidents</p>
      </div>

      {/* Machine health summary */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-text-secondary/60 mb-2.5">Fleet Status</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Healthy', count: healthy, color: '#22c55e', bg: 'bg-healthy/10 border-healthy/20' },
            { label: 'Warning', count: warning, color: '#f59e0b', bg: 'bg-warning/10 border-warning/20' },
            { label: 'Critical', count: critical, color: '#ef4444', bg: 'bg-critical/10 border-critical/20' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} border rounded-xl p-2.5 text-center`}>
              <p className="font-black text-xl" style={{ color: s.color }}>{s.count}</p>
              <p className="text-[10px] text-text-secondary/70">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monitoring indicators */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-text-secondary/60 mb-2.5">Active Monitoring</p>
        <div className="space-y-2">
          {[
            { icon: '📡', label: 'Live telemetry', detail: `${machineList.length} machines`, ok: true },
            { icon: '🤖', label: 'AI analysis', detail: 'Running', ok: true },
            { icon: '🔔', label: 'Alert thresholds', detail: 'All configured', ok: true },
            { icon: '📊', label: 'Data stream', detail: 'Connected · 500ms', ok: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-bg-dark/60 border border-border-dark">
              <span className="text-sm">{item.icon}</span>
              <div className="flex-1">
                <p className="text-text-primary text-xs font-semibold">{item.label}</p>
                <p className="text-text-secondary/60 text-[10px]">{item.detail}</p>
              </div>
              <div className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-healthy animate-pulse' : 'bg-critical'}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Recent event log */}
      {lastEvents.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-secondary/60 mb-2.5">Recent Events</p>
          <div className="space-y-1.5">
            {lastEvents.map((ev) => {
              const isStart = ev.type === 'incident_start';
              const isResolve = ev.type === 'incident_resolve';
              return (
                <div key={ev.id} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-bg-dark/40 border border-border-dark">
                  <span className="text-xs mt-0.5 flex-shrink-0">{isStart ? '🔴' : isResolve ? '🟢' : '⚡'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-secondary text-[10px] leading-relaxed truncate">{ev.description}</p>
                    <p className="text-text-secondary/40 text-[9px] mt-0.5">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Demo trigger shortcut */}
      <div className="mt-auto pt-4">
        <button
          onClick={() => fetch(`${BASE_URL}/api/demo/trigger`, { method: 'POST' })}
          className="w-full text-xs text-text-secondary/50 border border-border-dark hover:border-critical/30 hover:text-critical/70 rounded-xl py-2.5 transition-all"
        >
          🔴 Simulate Incident
        </button>
      </div>
    </div>
  );
}

// ─── Mobile tab bar ────────────────────────────────────────────────────────────
type OpTab = 'status' | 'map' | 'command';

// ─── Main OperatorShell ────────────────────────────────────────────────────────
export function OperatorShell() {
  const machines = useAppStore((s) => s.machines);
  const incidents = useAppStore((s) => s.incidents);
  const systemMode = useAppStore((s) => s.systemMode);
  const historyLog = useAppStore((s) => s.historyLog);
  void historyLog;
  const customMachines = useAuthStore((s) => s.customMachines);

  const [mobileTab, setMobileTab] = useState<OpTab>('map');
  const [actionState, setActionState] = useState<Record<string, string>>({});
  const [confirmingStop, setConfirmingStop] = useState<string | null>(null);

  const isIncident = systemMode === 'incident' || systemMode === 'warning';
  const activeIncident = incidents[0] ?? null;

  const affectedIds = new Set(
    incidents.flatMap((i) => [
      i.root_cause_machine_id,
      ...i.affected_machines.map((am) => am.machine_id),
    ])
  );

  // Merge backend machines + custom machines into one list for the status board
  const customAsMachineState: MachineState[] = customMachines.map((cm) => ({
    id: cm.id,
    name: cm.name,
    type: cm.type,
    location: cm.location || 'Custom Area',
    description: cm.description || '',
    health: 'healthy' as const,
    metrics: [],
    dependencies_downstream: [],
    position: cm.position,
    degradation_factor: 0,
  }));

  const allMachines: MachineState[] = [
    ...Object.values(machines),
    ...customAsMachineState,
  ];

  // Sort: affected machines first, then by health severity
  const sortedMachines = allMachines.sort((a, b) => {
    const aAff = affectedIds.has(a.id) ? 0 : 1;
    const bAff = affectedIds.has(b.id) ? 0 : 1;
    if (aAff !== bAff) return aAff - bAff;
    const healthOrder = { critical: 0, warning: 1, healthy: 2, unconfigured: 3 };
    return (healthOrder[a.health] ?? 3) - (healthOrder[b.health] ?? 3);
  });

  // Auto-switch mobile to "command" when incident starts
  const prevIncident = useRef<string | null>(null);
  useEffect(() => {
    if (activeIncident && activeIncident.id !== prevIncident.current) {
      setMobileTab('command');
      prevIncident.current = activeIncident.id;
    }
    if (!activeIncident) prevIncident.current = null;
  }, [activeIncident]);

  const handleAction = (incidentId: string, action: ActionType) => {
    const cfg = ACTION_CONFIG[action];
    if (cfg.confirmFirst && confirmingStop !== incidentId) {
      setConfirmingStop(incidentId);
      return;
    }
    setConfirmingStop(null);
    const key = `${incidentId}_${action}`;
    setActionState((prev) => ({ ...prev, [key]: 'loading' }));
    setTimeout(() => {
      setActionState((prev) => ({ ...prev, [key]: 'done' }));
    }, 1500);
  };

  const handleConfirmStop = (incidentId: string) => {
    setConfirmingStop(null);
    const key = `${incidentId}_stop_requested`;
    setActionState((prev) => ({ ...prev, [key]: 'loading' }));
    setTimeout(() => {
      setActionState((prev) => ({ ...prev, [key]: 'done' }));
    }, 1500);
  };

  // ── DESKTOP layout ──────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="h-full flex flex-col overflow-hidden border-r border-border-dark">
      {/* Board header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border-dark">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isIncident ? 'bg-critical animate-pulse' : 'bg-healthy animate-pulse'}`} />
          <p className="text-text-primary text-xs font-black uppercase tracking-widest">Machine Status</p>
          <span className="ml-auto text-[10px] text-text-secondary/50 font-mono">{allMachines.length} units</span>
        </div>
      </div>

      {/* Machine cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedMachines.map((m) => (
          <MachineStatusCard key={m.id} machine={m} isAffected={affectedIds.has(m.id)} />
        ))}
        {sortedMachines.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-text-secondary/40">
            <span className="text-2xl mb-2">🏭</span>
            <p className="text-xs">No machines connected</p>
          </div>
        )}
      </div>
    </div>
  );

  const centerPanel = (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Incident banner (thin) */}
      <AnimatePresence>
        {isIncident && activeIncident && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className={`px-4 py-2 flex items-center gap-3 text-xs border-b ${
              activeIncident.severity === 'critical'
                ? 'bg-critical/8 border-critical/30 text-critical'
                : 'bg-warning/8 border-warning/30 text-warning'
            }`}>
              <span className="animate-pulse font-bold">
                {activeIncident.severity === 'critical' ? '🔴' : '🟡'}
              </span>
              <span className="font-bold truncate flex-1">{activeIncident.title}</span>
              <span className="flex-shrink-0 text-[10px] opacity-70">
                See command panel →
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topology map */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TopologyMap />
      </div>

      {/* Compact event ticker at bottom */}
      <div className="flex-shrink-0 border-t border-border-dark bg-bg-panel/80 px-4 py-1.5 flex items-center gap-3">
        <span className="text-[10px] text-text-secondary/40 uppercase tracking-widest flex-shrink-0">Live</span>
        <div className="flex-1 overflow-hidden">
          <TickerScroll machines={machines} incidents={incidents} />
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-healthy rounded-full animate-pulse" />
          <span className="text-[10px] text-healthy/70 font-mono">WebSocket</span>
        </div>
      </div>
    </div>
  );

  const rightPanel = (
    <div className="h-full border-l border-border-dark overflow-hidden">
      <AnimatePresence mode="wait">
        {isIncident && activeIncident ? (
          <motion.div
            key="incident"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full"
          >
            <IncidentCommandCenter
              incident={activeIncident}
              actionState={actionState}
              onAction={handleAction}
              confirmingStop={confirmingStop}
              onConfirmStop={handleConfirmStop}
              onCancelStop={() => setConfirmingStop(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="allclear"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full"
          >
            <AllClearPanel machines={machines} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {/* ── DESKTOP ───────────────────────────────────────────────── */}
      <div className="hidden md:flex h-full overflow-hidden">
        {/* Left: Machine Status Board */}
        <motion.div
          animate={{ width: isIncident ? '240px' : '260px' }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex-shrink-0 overflow-hidden"
        >
          {leftPanel}
        </motion.div>

        {/* Center: Topology map + ticker */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {centerPanel}
        </div>

        {/* Right: Command Center */}
        <motion.div
          animate={{ width: isIncident ? '400px' : '260px' }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex-shrink-0 overflow-hidden"
        >
          {rightPanel}
        </motion.div>
      </div>

      {/* ── MOBILE ────────────────────────────────────────────────── */}
      <div className="flex md:hidden h-full flex-col overflow-hidden">
        {/* Active panel */}
        <div className="flex-1 overflow-hidden min-h-0">
          {mobileTab === 'status' && (
            <div className="h-full">
              {leftPanel}
            </div>
          )}
          {mobileTab === 'map' && (
            <div className="h-full">
              {centerPanel}
            </div>
          )}
          {mobileTab === 'command' && (
            <div className="h-full">
              {rightPanel}
            </div>
          )}
        </div>

        {/* Mobile tab bar */}
        <nav className="flex-shrink-0 flex border-t border-border-dark bg-bg-panel">
          {([
            { id: 'status', icon: '🏭', label: 'Status' },
            { id: 'map',    icon: '🗺️', label: 'Map' },
            { id: 'command', icon: '⚡', label: 'Command' },
          ] as { id: OpTab; icon: string; label: string }[]).map((tab) => {
            const isCmdAlert = tab.id === 'command' && isIncident;
            const isActive = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors ${
                  isActive ? 'text-accent-blue' : 'text-text-secondary'
                }`}
              >
                <span className="text-lg relative">
                  {tab.icon}
                  {isCmdAlert && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-critical rounded-full animate-pulse" />
                  )}
                </span>
                <span className="text-[10px] font-semibold">{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-accent-blue rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

// ─── Ticker scroll (live event feed) ─────────────────────────────────────────
function TickerScroll({
  machines,
  incidents,
}: {
  machines: Record<string, MachineState>;
  incidents: Incident[];
}) {
  const machineList = Object.values(machines);
  const healthy = machineList.filter((m) => m.health === 'healthy').length;
  const issues = machineList.filter((m) => m.health !== 'healthy').length;

  const items: string[] = [];
  if (incidents.length === 0) {
    items.push(`${healthy}/${machineList.length} machines operational`);
    machineList.forEach((m) => {
      const pm = m.metrics.find((mx) => mx.type === 'gauge');
      if (pm) items.push(`${m.name}: ${pm.label} ${pm.value.toFixed(1)}${pm.unit}`);
    });
  } else {
    items.push(`⚠ ${incidents.length} active incident${incidents.length > 1 ? 's' : ''} · ${issues} machines affected`);
    incidents.forEach((i) => items.push(`${i.root_cause_machine_name}: ${i.root_cause_metric}`));
  }

  const text = items.join('   ·   ');

  return (
    <div className="overflow-hidden whitespace-nowrap">
      <motion.p
        key={text.slice(0, 30)}
        animate={{ x: [0, -600] }}
        transition={{ duration: 18, ease: 'linear', repeat: Infinity, repeatType: 'loop' }}
        className="text-[10px] text-text-secondary/50 inline-block"
      >
        {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
      </motion.p>
    </div>
  );
}

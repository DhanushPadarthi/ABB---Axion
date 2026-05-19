import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { MachineBuilder } from './MachineBuilder';
import { UITemplateEditor } from './UITemplateEditor';
import { DataSourcePanel } from './DataSourcePanel';
import { ArchitectView } from '../ArchitectView/ArchitectView';
import { useAppStore } from '../../store/useAppStore';

type ArchitectTab = 'topology' | 'machines' | 'dependencies' | 'datasources' | 'templates' | 'playbooks';

const TABS: { id: ArchitectTab; label: string; icon: string }[] = [
  { id: 'topology',      label: 'Topology',      icon: '🏗️' },
  { id: 'machines',      label: 'Machine Config', icon: '⚙️' },
  { id: 'dependencies',  label: 'Dependencies',   icon: '🔗' },
  { id: 'datasources',   label: 'Data Sources',   icon: '🔌' },
  { id: 'templates',     label: 'UI Templates',   icon: '🎨' },
  { id: 'playbooks',     label: 'Playbooks',      icon: '📋' },
];

const ACCENT = '#f472b6';

const SAMPLE_PLAYBOOKS = [
  {
    id: 'pb1',
    name: 'Thermal Overload Response',
    trigger: 'Cooling Temp > 90°C for 30s',
    actions: ['Activate Incident Focus Mode', 'Notify Operators', 'Reduce Conveyor Speed by 40%'],
    status: 'active' as const,
    severity: 'critical' as const,
  },
  {
    id: 'pb2',
    name: 'Low Fill Pressure Warning',
    trigger: 'Fill Pressure < 2.8 bar',
    actions: ['Alert Engineering Team', 'Expand Metric Detail Panel'],
    status: 'active' as const,
    severity: 'warning' as const,
  },
  {
    id: 'pb3',
    name: 'Conveyor Speed Anomaly',
    trigger: 'Conveyor Speed deviation > 15% from baseline',
    actions: ['Flag for Root Cause Analysis', 'Notify Manager', 'Log Incident'],
    status: 'draft' as const,
    severity: 'warning' as const,
  },
  {
    id: 'pb4',
    name: 'Production Throughput Drop',
    trigger: 'Throughput < 70% efficiency for 5 min',
    actions: ['Send Manager KPI Alert', 'Capture Snapshot to Incident Log'],
    status: 'active' as const,
    severity: 'warning' as const,
  },
];

export function ArchitectShell() {
  const [activeTab, setActiveTab] = useState<ArchitectTab>('topology');
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const dataSources = useAuthStore((s) => s.dataSources);
  const customMachines = useAuthStore((s) => s.customMachines);
  const architectConnections = useAuthStore((s) => s.architectConnections);
  const removeArchitectConnection = useAuthStore((s) => s.removeArchitectConnection);
  const updateArchitectConnectionWeight = useAuthStore((s) => s.updateArchitectConnectionWeight);
  const updateArchitectConnectionContext = useAuthStore((s) => s.updateArchitectConnectionContext);
  const addArchitectConnection = useAuthStore((s) => s.addArchitectConnection);
  const setApiDependencies = useAuthStore((s) => s.setApiDependencies);
  const apiDependencies = useAuthStore((s) => s.apiDependencies);
  const machines = useAppStore((s) => s.machines);
  const incidents = useAppStore((s) => s.incidents);
  const connectionStatus = useAppStore((s) => s.connectionStatus);

  const [lastAddedMachineId, setLastAddedMachineId] = useState<string | null>(null);

  // Fetch backend machine configs on mount so Dependencies tab has API deps
  useEffect(() => {
    interface MinimalMachine { id: string; name: string; dependencies_downstream: { machine_id: string; impact_weight: number }[] }
    const _apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
    fetch(`${_apiUrl}/api/config/machines`)
      .then((r) => r.json())
      .then((data: { machines: MinimalMachine[] }) => {
        const cfgs = data.machines ?? [];
        const deps = cfgs.flatMap((m) =>
          m.dependencies_downstream.map((dep) => ({
            source: m.id, sourceName: m.name,
            target: dep.machine_id,
            targetName: cfgs.find((x) => x.id === dep.machine_id)?.name ?? dep.machine_id,
            weight: dep.impact_weight,
          }))
        );
        setApiDependencies(deps);
      })
      .catch(() => {});
  }, [setApiDependencies]);

  const handleNavigate = (tab: string, machineId?: string) => {
    setActiveTab(tab as ArchitectTab);
    if (machineId) setLastAddedMachineId(machineId);
  };

  // Pre-fill dep source when navigating from MachineBuilder
  useEffect(() => {
    if (activeTab === 'dependencies' && lastAddedMachineId) {
      setDepSource(lastAddedMachineId);
      setLastAddedMachineId(null);
    }
  }, [activeTab, lastAddedMachineId]);

  const machineCount = Object.keys(machines).length + customMachines.length;
  const incidentCount = incidents.filter((i) => !i.resolved_at).length;
  void dataSources; void machineCount; void incidentCount;

  // Build a unified machine name lookup (API machines + custom machines)
  const allMachineNames: Record<string, string> = {
    ...Object.fromEntries(Object.values(machines).map((m) => [m.id, m.name])),
    ...Object.fromEntries(customMachines.map((m) => [m.id, m.name])),
  };
  const allMachineIds = Object.keys(allMachineNames);

  // New dependency form state
  const [depSource, setDepSource] = useState('');
  const [depTarget, setDepTarget] = useState('');
  const [depWeight, setDepWeight] = useState(0.5);
  const [depContext, setDepContext] = useState('');

  // Selection state for the connections list
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [editingConnContext, setEditingConnContext] = useState('');

  // Look up sensors for the selected source machine (custom machines have sensors[])
  const depSourceSensors = customMachines.find((m) => m.id === depSource)?.sensors ?? [];

  const isTopology = activeTab === 'topology';

  return (
    <div style={{ height: '100vh', background: '#080c14', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top Bar ── */}
      <div
        className="flex-shrink-0 px-4 py-2.5 flex items-center gap-3"
        style={{ background: '#0d1120e6', borderBottom: `1px solid ${ACCENT}22` }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #ec4899)`, boxShadow: `0 4px 14px ${ACCENT}30` }}
          >
            AX
          </div>
          <div>
            <span className="text-white font-black text-sm tracking-tight">AXION</span>
            <span
              className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-md"
              style={{ color: ACCENT, background: `${ACCENT}18` }}
            >
              ARCHITECT
            </span>
            <span className="hidden lg:inline-block ml-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-red-500/15 to-orange-500/15 border border-red-500/25 text-orange-300">
              ABB Accelerator · 2025
            </span>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-0.5 bg-bg-dark rounded-xl p-1 flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 justify-center"
              style={
                activeTab === tab.id
                  ? { background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30` }
                  : { color: '#94a3b8' }
              }
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* User + Logout */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs mr-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-healthy animate-pulse' : 'bg-warning animate-pulse'}`} />
            <span className="text-text-secondary">{connectionStatus === 'connected' ? 'Live' : 'Connecting...'}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary">
            <span>{currentUser?.avatar}</span>
            <span>{currentUser?.name}</span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-text-secondary hover:text-critical px-2 py-1.5 rounded-lg hover:bg-critical/10 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div
        className="flex-1 min-h-0"
        style={{ overflow: isTopology ? 'hidden' : 'auto', position: 'relative' }}
      >
        {/* Topology tab — needs full explicit dimensions for ReactFlow */}
        {isTopology && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ArchitectView />
          </div>
        )}

        {!isTopology && (
          <AnimatePresence mode="wait">
            {activeTab === 'machines' && (
              <motion.div key="machines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MachineBuilder onNavigate={handleNavigate} />
              </motion.div>
            )}

            {activeTab === 'dependencies' && (
              <motion.div key="dependencies" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-6 max-w-4xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-text-primary text-xl font-black">Machine Dependencies</h2>
                  <p className="text-text-secondary text-sm mt-0.5">
                    Define impact relationships between machines. Grey = backend-defined (read-only). Blue = architect-defined (editable).
                  </p>
                </div>

                {/* Backend / API dependencies */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-[#334155]" />
                    <h3 className="text-xs text-text-secondary uppercase font-semibold tracking-wide">
                      Backend-Defined Dependencies ({apiDependencies.length})
                    </h3>
                  </div>
                  {apiDependencies.length === 0 ? (
                    <div className="text-center py-6 text-text-secondary text-xs border border-dashed border-border-dark rounded-xl">
                      <p>No backend dependencies loaded.</p>
                      <p className="mt-1">Visit the Topology tab to load machine configuration, or start the backend.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {apiDependencies.map((dep, i) => (
                        <div key={i} className="bg-[#0f1420] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[#334155]/60 text-text-secondary/60 font-bold flex-shrink-0">BE</span>
                          <span className="text-text-primary text-sm font-semibold truncate">{dep.sourceName}</span>
                          <span className="text-[#475569] flex-shrink-0">→</span>
                          <span className="text-text-primary text-sm font-semibold truncate">{dep.targetName}</span>
                          <span className="ml-auto text-xs text-text-secondary flex-shrink-0">{(dep.weight * 100).toFixed(0)}% impact</span>
                          <span className="text-[10px] text-text-secondary/50 border border-border-dark px-1.5 py-0.5 rounded flex-shrink-0">read-only</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add dependency form */}
                <div className="bg-[#0f1420] border border-white/8 rounded-2xl p-5 mb-6">
                  <p className="text-text-primary font-bold text-sm mb-4">➕ Add Architect Dependency</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1.5 font-semibold uppercase tracking-wide">Source Machine</label>
                      <select
                        value={depSource}
                        onChange={(e) => { setDepSource(e.target.value); setDepContext(''); }}
                        className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                      >
                        <option value="">Select source…</option>
                        {allMachineIds.map((id) => (
                          <option key={id} value={id}>{allMachineNames[id]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1.5 font-semibold uppercase tracking-wide">Target Machine</label>
                      <select
                        value={depTarget}
                        onChange={(e) => setDepTarget(e.target.value)}
                        className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                      >
                        <option value="">Select target…</option>
                        {allMachineIds.filter((id) => id !== depSource).map((id) => (
                          <option key={id} value={id}>{allMachineNames[id]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1.5 font-semibold uppercase tracking-wide">
                        Impact Weight — <span className="text-accent-blue font-bold">{(depWeight * 100).toFixed(0)}%</span>
                      </label>
                      <input
                        type="range" min={0} max={1} step={0.05} value={depWeight}
                        onChange={(e) => setDepWeight(Number(e.target.value))}
                        className="w-full accent-blue-500 mt-2"
                      />
                    </div>
                  </div>

                  {/* Sensor-aware context */}
                  <div className="mb-4">
                    <label className="block text-xs text-text-secondary mb-1.5 font-semibold uppercase tracking-wide">
                      Dependency Context <span className="text-text-secondary/50 font-normal normal-case">— what triggers this dependency?</span>
                    </label>
                    {/* Sensor hint pills — only shown when source has sensors */}
                    {depSourceSensors.length > 0 && (
                      <div className="mb-2 p-2.5 bg-[#0a0f1e] border border-accent-blue/15 rounded-xl">
                        <p className="text-[10px] text-accent-blue/70 font-semibold uppercase tracking-wide mb-2">
                          🤖 Sensors on {allMachineNames[depSource] ?? depSource} — click to insert context
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {depSourceSensors.map((sensor) => (
                            <button
                              key={sensor}
                              type="button"
                              onClick={() => setDepContext((c) =>
                                c ? `${c} When ${sensor} exceeds threshold, it affects ${allMachineNames[depTarget] ?? 'the target'}.` : `When ${sensor} exceeds threshold, it affects ${allMachineNames[depTarget] ?? 'the target'}.`
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
                      className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2.5 text-text-primary text-xs focus:outline-none focus:border-accent-blue resize-none h-16"
                      placeholder={
                        depSourceSensors.length > 0
                          ? `e.g. "When ${depSourceSensors[0]} spikes above normal, ${allMachineNames[depTarget] || 'the target machine'} load increases — click sensor pills above to auto-fill."`
                          : 'Describe how a fault or change in the source machine affects the target. The AI layer uses this for root-cause analysis.'
                      }
                      value={depContext}
                      onChange={(e) => setDepContext(e.target.value)}
                    />
                  </div>

                  <button
                    disabled={!depSource || !depTarget}
                    onClick={() => {
                      if (!depSource || !depTarget) return;
                      const exists = architectConnections.some(
                        (c) => c.source === depSource && c.target === depTarget
                      );
                      if (!exists) {
                        addArchitectConnection({
                          id: `custom-${depSource}-${depTarget}-${Date.now()}`,
                          source: depSource, target: depTarget, weight: depWeight,
                          context: depContext.trim() || undefined,
                        });
                      }
                      setDepSource(''); setDepTarget(''); setDepWeight(0.5); setDepContext('');
                    }}
                    className="text-xs font-bold px-5 py-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640' }}
                  >
                    Add Dependency
                  </button>
                </div>

                {/* Architect-defined connections */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-accent-blue" />
                    <h3 className="text-xs text-text-secondary uppercase font-semibold tracking-wide">
                      Architect-Defined Connections ({architectConnections.length})
                    </h3>
                  </div>
                  {architectConnections.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary border border-dashed border-border-dark rounded-xl">
                      <div className="text-3xl mb-2">🔗</div>
                      <p className="text-sm">No architect-defined dependencies yet.</p>
                      <p className="text-xs mt-1">Draw connections on the Topology canvas or use the form above.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {architectConnections.map((conn) => {
                        const isSel = selectedConnId === conn.id;
                        return (
                          <div key={conn.id}>
                            <button
                              onClick={() => {
                                if (isSel) { setSelectedConnId(null); return; }
                                setSelectedConnId(conn.id);
                                setEditingConnContext(conn.context ?? '');
                              }}
                              className={`w-full flex items-center gap-4 rounded-2xl p-4 transition-all text-left ${
                                isSel
                                  ? 'bg-accent-blue/10 border border-accent-blue/40'
                                  : 'bg-[#0f1420] border border-accent-blue/15 hover:border-accent-blue/30'
                              }`}
                            >
                              <div className="flex-1 flex items-center gap-3 text-sm min-w-0">
                                <span className="text-text-primary font-semibold truncate">{allMachineNames[conn.source] ?? conn.source}</span>
                                <span className="text-accent-blue flex-shrink-0">→</span>
                                <span className="text-text-primary font-semibold truncate">{allMachineNames[conn.target] ?? conn.target}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-accent-blue font-bold">{(conn.weight * 100).toFixed(0)}%</span>
                                {conn.context && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7c3aed20] border border-[#7c3aed40] text-[#a855f7]">🤖 ctx</span>}
                                <span className="text-text-secondary/40 text-xs">{isSel ? '▲' : '▼'}</span>
                              </div>
                            </button>
                            {isSel && (
                              <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[#080e1c] border border-accent-blue/20 border-t-0 rounded-b-2xl p-4 space-y-3"
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs text-text-secondary font-semibold uppercase tracking-wide">Impact Weight</label>
                                    <span className="text-accent-blue text-xs font-bold">{(conn.weight * 100).toFixed(0)}%</span>
                                  </div>
                                  <input
                                    type="range" min={0} max={1} step={0.05} value={conn.weight}
                                    onChange={(e) => updateArchitectConnectionWeight(conn.id, Number(e.target.value))}
                                    className="w-full accent-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-text-secondary font-semibold uppercase tracking-wide block mb-1.5">🤖 AI Context</label>
                                  <textarea
                                    className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2.5 text-text-primary text-xs focus:outline-none focus:border-accent-blue resize-none h-16"
                                    placeholder="Describe how a fault in the source propagates to the target…"
                                    value={editingConnContext}
                                    onChange={(e) => setEditingConnContext(e.target.value)}
                                  />
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                  <button
                                    onClick={() => { removeArchitectConnection(conn.id); setSelectedConnId(null); }}
                                    className="text-xs text-critical border border-critical/30 px-3 py-1.5 rounded-xl hover:bg-critical/10 transition-all"
                                  >
                                    🗑️ Remove
                                  </button>
                                  <div className="flex gap-2">
                                    <button onClick={() => setSelectedConnId(null)} className="text-xs text-text-secondary px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all">Cancel</button>
                                    <button
                                      onClick={() => { updateArchitectConnectionContext(conn.id, editingConnContext.trim()); setSelectedConnId(null); }}
                                      className="text-xs font-bold text-white bg-accent-blue px-4 py-1.5 rounded-xl hover:bg-blue-400 transition-all"
                                    >
                                      Save ✓
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'datasources' && (
              <motion.div key="datasources" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DataSourcePanel />
              </motion.div>
            )}

            {activeTab === 'templates' && (
              <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <UITemplateEditor />
              </motion.div>
            )}

            {activeTab === 'playbooks' && (
              <motion.div
                key="playbooks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-6 max-w-4xl mx-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-text-primary text-xl font-black">Incident Playbooks</h2>
                    <p className="text-text-secondary text-sm mt-0.5">
                      Conditional workflows that execute automatically when anomalies are detected
                    </p>
                  </div>
                  <button
                    className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all"
                    style={{ background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
                  >
                    <span>+</span>
                    <span>New Playbook</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {SAMPLE_PLAYBOOKS.map((pb) => {
                    const sColor = pb.severity === 'critical' ? '#ef4444' : '#f59e0b';
                    return (
                      <div
                        key={pb.id}
                        className="bg-[#0f1420]/80 border border-white/6 hover:border-white/12 rounded-2xl p-4 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-text-primary font-bold text-sm">{pb.name}</span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-bold uppercase"
                                style={{ color: sColor, background: `${sColor}15` }}
                              >
                                {pb.severity}
                              </span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-bold uppercase"
                                style={
                                  pb.status === 'active'
                                    ? { color: '#22c55e', background: '#22c55e15' }
                                    : { color: '#94a3b8', background: '#94a3b815' }
                                }
                              >
                                {pb.status}
                              </span>
                            </div>
                            <p className="text-text-secondary text-xs mb-2">
                              <span className="text-text-secondary/60">Trigger: </span>
                              <span className="font-mono">{pb.trigger}</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {pb.actions.map((action, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded-lg border"
                                  style={{ color: ACCENT, background: `${ACCENT}08`, borderColor: `${ACCENT}20` }}
                                >
                                  {action}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button className="text-xs text-text-secondary hover:text-text-primary px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-all border border-white/6">
                              Edit
                            </button>
                            <button
                              className="text-xs px-2.5 py-1.5 rounded-lg transition-all border"
                              style={
                                pb.status === 'active'
                                  ? { color: '#f59e0b', background: '#f59e0b10', borderColor: '#f59e0b25' }
                                  : { color: '#22c55e', background: '#22c55e10', borderColor: '#22c55e25' }
                              }
                            >
                              {pb.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="mt-6 rounded-2xl p-4 border text-xs text-text-secondary"
                  style={{ background: `${ACCENT}08`, borderColor: `${ACCENT}18` }}
                >
                  <p className="font-semibold mb-1" style={{ color: ACCENT }}>📋 Playbook Engine</p>
                  <p>
                    Playbooks are evaluated continuously against live telemetry. When a trigger condition is
                    met, the defined actions execute automatically — adapting the UI, sending notifications,
                    and logging incidents without operator intervention.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}


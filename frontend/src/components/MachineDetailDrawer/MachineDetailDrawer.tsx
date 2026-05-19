import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { MachineState, MetricValue } from '../../types';

const STATUS_COLOR: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  unconfigured: '#64748b',
};

// Re-use history from MetricCards module (simple approach)
const metricHistories: Record<string, Record<string, number[]>> = {};

function getHistory(machineId: string, metricKey: string, value: number): number[] {
  if (!metricHistories[machineId]) metricHistories[machineId] = {};
  if (!metricHistories[machineId][metricKey]) metricHistories[machineId][metricKey] = [];
  const hist = metricHistories[machineId][metricKey];
  hist.push(value);
  if (hist.length > 60) hist.shift();
  return [...hist];
}

function DetailMetricChart({ metric, machineId }: { metric: MetricValue; machineId: string }) {
  const history = getHistory(machineId, metric.key, metric.value);
  const data = history.map((v, i) => ({ i, v }));
  const color = STATUS_COLOR[metric.status];

  return (
    <div className="bg-bg-dark rounded-lg p-3 mb-3">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-text-primary text-sm font-medium">{metric.label}</span>
          <span
            className={`ml-2 text-xs px-1.5 py-0.5 rounded-full uppercase font-bold`}
            style={{ color, background: `${color}20` }}
          >
            {metric.status}
          </span>
        </div>
        <span className="text-lg font-bold font-mono" style={{ color }}>
          {metric.value.toFixed(2)}
          <span className="text-sm font-normal text-text-secondary ml-1">{metric.unit}</span>
        </span>
      </div>

      {/* Threshold badges */}
      <div className="flex gap-3 text-xs text-text-secondary mb-2">
        {metric.warning_max != null && (
          <span>⚠️ Warn &gt;{metric.warning_max}{metric.unit}</span>
        )}
        {metric.critical_max != null && (
          <span>🔴 Critical &gt;{metric.critical_max}{metric.unit}</span>
        )}
        {metric.warning_min != null && (
          <span>⚠️ Warn &lt;{metric.warning_min}{metric.unit}</span>
        )}
        {metric.critical_min != null && (
          <span>🔴 Critical &lt;{metric.critical_min}{metric.unit}</span>
        )}
      </div>

      <div className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="i" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip
              contentStyle={{ background: '#1a1f2e', border: '1px solid #2a3040', borderRadius: 8 }}
              labelFormatter={() => ''}
              formatter={(v: number) => [`${v.toFixed(2)} ${metric.unit}`, metric.label]}
            />
            {metric.warning_max != null && (
              <ReferenceLine y={metric.warning_max} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
            )}
            {metric.critical_max != null && (
              <ReferenceLine y={metric.critical_max} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
            )}
            {metric.warning_min != null && (
              <ReferenceLine y={metric.warning_min} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
            )}
            {metric.critical_min != null && (
              <ReferenceLine y={metric.critical_min} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
            )}
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MachineDetailDrawer() {
  const selectedId = useAppStore((s) => s.selectedMachineId);
  const setSelectedId = useAppStore((s) => s.setSelectedMachineId);
  const machines = useAppStore((s) => s.machines);
  const customMachines = useAuthStore((s) => s.customMachines);
  const customMachineMetrics = useAuthStore((s) => s.customMachineMetrics);
  const customMachineProfiles = useAuthStore((s) => s.customMachineProfiles);

  // Try backend machine first; fall back to architect-configured custom machine
  const backendMachine = selectedId ? (machines[selectedId] ?? null) : null;
  const foundCustom = selectedId ? customMachines.find((cm) => cm.id === selectedId) ?? null : null;
  const isCustom = !backendMachine && !!foundCustom;

  const customMachineState: MachineState | null = foundCustom
    ? (() => {
        const live = customMachineMetrics[foundCustom.id] ?? {};
        const profs = customMachineProfiles[foundCustom.id] ?? {};
        const statuses: Array<'healthy' | 'warning' | 'critical'> = [];
        const metrics = (foundCustom.sensors ?? []).map((sensor, i) => {
          const lv = live[sensor];
          const pr = profs[sensor];
          if (lv) statuses.push(lv.status);
          return {
            key: `sensor_${i}`,
            label: sensor,
            unit: pr?.unit ?? '',
            type: (pr?.kind === 'status' ? 'status' : pr?.kind === 'gauge' ? 'gauge' : pr?.kind === 'bar' ? 'bar' : 'line') as MachineState['metrics'][number]['type'],
            value: lv?.value ?? pr?.base ?? 0,
            status: (lv?.status ?? 'healthy') as MachineState['metrics'][number]['status'],
            normal_min: pr?.min ?? null,
            normal_max: pr?.warn ?? null,
            warning_min: null,
            warning_max: pr?.warn ?? null,
            critical_min: null,
            critical_max: pr?.crit ?? null,
          };
        });
        const overall: 'healthy' | 'warning' | 'critical' = statuses.includes('critical')
          ? 'critical'
          : statuses.includes('warning')
          ? 'warning'
          : 'healthy';
        return {
          id: foundCustom.id,
          name: foundCustom.name,
          type: foundCustom.type,
          location: foundCustom.location,
          description: foundCustom.description || 'Custom machine configured by architect.',
          health: overall,
          metrics,
          dependencies_downstream: (foundCustom.dependsOn ?? []).map((id) => ({
            machine_id: id,
            impact_weight: 0.5,
          })),
          position: foundCustom.position,
          degradation_factor: 0,
        };
      })()
    : null;

  const machine = backendMachine ?? customMachineState;

  return (
    <AnimatePresence>
      {machine && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedId(null)}
          />

          {/* Drawer — full-width sliding up on mobile, side panel on desktop */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-96 bg-bg-panel border-l border-border-dark z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-dark">
              <div>
                <h2 className="text-text-primary font-bold text-base">{machine.name}</h2>
                <p className="text-text-secondary text-xs">{machine.location}</p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-text-secondary hover:text-text-primary text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Description */}
              <div className="bg-bg-dark rounded-lg p-3 mb-4">
                <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">
                  Operational Purpose
                </div>
                <p className="text-text-primary text-sm leading-relaxed">{machine.description}</p>
              </div>

              {/* Health Status */}
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="text-sm font-bold px-3 py-1 rounded-full uppercase"
                  style={{
                    color: STATUS_COLOR[machine.health],
                    background: `${STATUS_COLOR[machine.health]}20`,
                    border: `1px solid ${STATUS_COLOR[machine.health]}`,
                  }}
                >
                  {machine.health}
                </span>
                {machine.degradation_factor > 0.05 && (
                  <span className="text-critical text-sm">
                    {(machine.degradation_factor * 100).toFixed(0)}% degraded by upstream failure
                  </span>
                )}
              </div>

              {/* Downstream Dependencies */}
              {machine.dependencies_downstream.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">
                    Downstream Dependencies
                  </div>
                  {machine.dependencies_downstream.map((dep) => {
                    const depMachine = machines[dep.machine_id];
                    return (
                      <div key={dep.machine_id} className="flex items-center gap-2 text-sm mb-1">
                        <span className="text-accent-blue">→</span>
                        <span className="text-text-primary">{depMachine?.name ?? dep.machine_id}</span>
                        <span className="text-text-secondary text-xs">
                          (impact: {(dep.impact_weight * 100).toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Metrics */}
              {isCustom ? (
                // AI-simulated custom machine — show live values per sensor
                <div>
                  <div className="text-xs text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
                    <span>AI-Simulated Telemetry ({machine.metrics.length})</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-blue/15 border border-accent-blue/30 text-accent-blue font-bold">
                      AI
                    </span>
                  </div>
                  {machine.metrics.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {machine.metrics.map((m) => {
                        const color = STATUS_COLOR[m.status] ?? '#60a5fa';
                        return (
                          <div
                            key={m.key}
                            className="rounded-lg px-3 py-2"
                            style={{
                              background: `${color}10`,
                              border: `1px solid ${color}30`,
                            }}
                          >
                            <div className="text-[10px] text-text-secondary uppercase tracking-wider truncate" title={m.label}>
                              {m.label}
                            </div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span
                                className="text-base font-black tabular-nums"
                                style={{ color }}
                              >
                                {Number.isFinite(m.value) ? (m.value % 1 === 0 ? m.value : m.value.toFixed(1)) : '—'}
                              </span>
                              {m.unit && (
                                <span className="text-[10px] text-text-secondary">{m.unit}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-text-secondary text-sm italic mb-3">No sensors configured.</p>
                  )}
                  <p className="text-text-secondary text-xs italic">
                    No real datasource connected — values are generated by the on-board AI
                    simulator using industry-realistic ranges.
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-xs text-text-secondary uppercase tracking-wide mb-3">
                    Live Telemetry ({machine.metrics.length} metrics)
                  </div>
                  {machine.metrics.map((metric) => (
                    <DetailMetricChart key={metric.key} metric={metric} machineId={machine.id} />
                  ))}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import {
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
  Cell,
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

function MetricGauge({ metric }: { metric: MetricValue }) {
  const max = metric.critical_max ?? metric.normal_max ?? 100;
  const pct = Math.min(100, (metric.value / max) * 100);
  const color = STATUS_COLOR[metric.status];

  const data = [{ value: pct, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="80%"
            innerRadius="60%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
          >
            <RadialBar dataKey="value" background={{ fill: '#2a3040' }} cornerRadius={4}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </RadialBar>
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute bottom-0 left-0 right-0 text-center">
          <span className="text-xs font-bold" style={{ color }}>
            {metric.value.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="text-xs text-text-secondary mt-1 text-center">{metric.label}</div>
    </div>
  );
}

function MetricLine({ metric, history }: { metric: MetricValue; history: number[] }) {
  const color = STATUS_COLOR[metric.status];
  const data = history.map((v, i) => ({ i, v }));

  return (
    <div className="bg-bg-dark rounded-lg p-3">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-text-secondary">{metric.label}</span>
        <span className="text-sm font-bold font-mono" style={{ color }}>
          {metric.value.toFixed(2)}
          <span className="text-xs font-normal text-text-secondary ml-1">{metric.unit}</span>
        </span>
      </div>
      <div className="h-10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Simple metric history buffer (last 30 ticks)
const metricHistories: Record<string, Record<string, number[]>> = {};

function getOrUpdateHistory(machineId: string, metricKey: string, value: number): number[] {
  if (!metricHistories[machineId]) metricHistories[machineId] = {};
  if (!metricHistories[machineId][metricKey]) metricHistories[machineId][metricKey] = [];
  const hist = metricHistories[machineId][metricKey];
  hist.push(value);
  if (hist.length > 30) hist.shift();
  return [...hist];
}

function MachineCard({ machine }: { machine: MachineState }) {
  const setSelectedMachineId = useAppStore((s) => s.setSelectedMachineId);
  const activeRole = useAppStore((s) => s.activeRole);
  const { health } = machine;
  const borderColor = STATUS_COLOR[health];

  const gaugeMetrics = machine.metrics.filter((m) => m.type === 'gauge');
  const lineMetrics = machine.metrics.filter((m) => m.type === 'line');

  return (
    <div
      className="bg-bg-card border rounded-xl p-4 cursor-pointer hover:border-accent-blue/50 transition-colors"
      style={{ borderColor: health !== 'healthy' ? borderColor : '#2a3040' }}
      onClick={() => setSelectedMachineId(machine.id)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-text-primary font-semibold text-sm">{machine.name}</h3>
          <p className="text-text-secondary text-xs">{machine.location}</p>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase`}
          style={{
            color: borderColor,
            background: `${borderColor}20`,
            border: `1px solid ${borderColor}`,
          }}
        >
          {health}
        </span>
      </div>

      {/* Gauges */}
      {gaugeMetrics.length > 0 && (
        <div className="flex gap-4 justify-around mb-3">
          {gaugeMetrics.map((m) => (
            <MetricGauge key={m.key} metric={m} />
          ))}
        </div>
      )}

      {/* Line metrics (engineer view shows all, operator shows top 2) */}
      <div className="grid grid-cols-2 gap-2">
        {(activeRole === 'engineer' ? lineMetrics : lineMetrics.slice(0, 2)).map((m) => (
          <MetricLine
            key={m.key}
            metric={m}
            history={getOrUpdateHistory(machine.id, m.key, m.value)}
          />
        ))}
      </div>
    </div>
  );
}

export function MetricCards() {
  const machines = useAppStore((s) => s.machines);
  const systemMode = useAppStore((s) => s.systemMode);
  const incidents = useAppStore((s) => s.incidents);
  const customMachines = useAuthStore((s) => s.customMachines);
  const customMachineMetrics = useAuthStore((s) => s.customMachineMetrics);
  const customMachineProfiles = useAuthStore((s) => s.customMachineProfiles);

  const affectedIds = new Set(
    incidents.flatMap((i) => [
      i.root_cause_machine_id,
      ...i.affected_machines.map((am) => am.machine_id),
    ])
  );

  // Build MachineState-compatible objects for architect-added custom machines.
  // Live values come from the AI-driven simulator hook (useCustomMachineSimulator).
  const customMachineStates: MachineState[] = customMachines.map((cm) => {
    const live = customMachineMetrics[cm.id] ?? {};
    const profs = customMachineProfiles[cm.id] ?? {};
    const statuses: Array<'healthy' | 'warning' | 'critical'> = [];
    const metrics = (cm.sensors ?? []).map((sensor, i) => {
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
      id: cm.id,
      name: cm.name,
      type: cm.type,
      location: cm.location,
      description: cm.description || 'Custom machine configured by architect.',
      health: overall,
      metrics,
      dependencies_downstream: (cm.dependsOn ?? []).map((id) => ({ machine_id: id, impact_weight: 0.5 })),
      position: cm.position,
      degradation_factor: 0,
    };
  });

  // In incident mode, show affected machines first; custom machines always come after backend
  const sortedMachines = Object.values(machines).sort((a, b) => {
    if (systemMode === 'incident' || systemMode === 'warning') {
      const aAff = affectedIds.has(a.id) ? 0 : 1;
      const bAff = affectedIds.has(b.id) ? 0 : 1;
      if (aAff !== bAff) return aAff - bAff;
    }
    const order = ['cooling_unit', 'filling_machine', 'capping_system', 'packaging_conveyor', 'storage_unit'];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });

  const allMachines = [...sortedMachines, ...customMachineStates];

  return (
    <div className="grid grid-cols-1 gap-4">
      {allMachines.map((machine) => (
        <MachineCard key={machine.id} machine={machine} />
      ))}
    </div>
  );
}

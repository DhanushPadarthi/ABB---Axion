import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';

export function KPIDashboard() {
  const machines = useAppStore((s) => s.machines);
  const incidents = useAppStore((s) => s.incidents);
  const systemMode = useAppStore((s) => s.systemMode);
  const customMachines = useAuthStore((s) => s.customMachines);

  // Compute plant-wide KPIs
  const fillingMachine = machines['filling_machine'];
  const storageMachine = machines['storage_unit'];

  const throughput = fillingMachine
    ? fillingMachine.metrics.find((m) => m.key === 'throughput')?.value ?? 0
    : 0;
  const baseThroughput = 300;
  const efficiencyPct = Math.max(0, Math.min(100, (throughput / baseThroughput) * 100));

  const intakeRate = storageMachine
    ? storageMachine.metrics.find((m) => m.key === 'intake_rate')?.value ?? 0
    : 0;

  const activeIncidents = incidents.length;
  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;
  const throughputImpact = incidents.reduce(
    (sum, i) => Math.max(sum, i.throughput_impact_pct),
    0
  );

  // Include architect-configured custom machines in the fleet count
  const healthyCount = Object.values(machines).filter((m) => m.health === 'healthy').length + customMachines.length;
  const totalMachines = Object.values(machines).length + customMachines.length;

  const kpis = [
    {
      label: 'Line Throughput',
      value: `${throughput.toFixed(0)}`,
      unit: 'btl/min',
      status: throughput < 220 ? 'critical' : throughput < 280 ? 'warning' : 'healthy',
      icon: '🏭',
    },
    {
      label: 'Production Efficiency',
      value: `${efficiencyPct.toFixed(1)}`,
      unit: '%',
      status: efficiencyPct < 70 ? 'critical' : efficiencyPct < 90 ? 'warning' : 'healthy',
      icon: '📈',
    },
    {
      label: 'Storage Intake',
      value: `${intakeRate.toFixed(0)}`,
      unit: 'units/min',
      status: intakeRate < 190 ? 'critical' : intakeRate < 250 ? 'warning' : 'healthy',
      icon: '📦',
    },
    {
      label: 'Machines Online',
      value: `${healthyCount}/${totalMachines}`,
      unit: '',
      status: healthyCount < 3 ? 'critical' : healthyCount < 5 ? 'warning' : 'healthy',
      icon: '🔧',
    },
    {
      label: 'Active Incidents',
      value: `${activeIncidents}`,
      unit: criticalCount > 0 ? `(${criticalCount} critical)` : '',
      status: activeIncidents === 0 ? 'healthy' : criticalCount > 0 ? 'critical' : 'warning',
      icon: '🚨',
    },
  ];

  const statusColors: Record<string, string> = {
    healthy: '#22c55e',
    warning: '#f59e0b',
    critical: '#ef4444',
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="text-text-primary font-bold text-sm uppercase tracking-wide mb-4">
        📊 Plant Operations Overview
      </h2>

      <div className="grid grid-cols-1 gap-3 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-bg-dark rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{kpi.icon}</span>
                <span className="text-text-secondary text-sm">{kpi.label}</span>
              </div>
              <div className="text-right">
                <span
                  className="text-2xl font-bold font-mono"
                  style={{ color: statusColors[kpi.status] }}
                >
                  {kpi.value}
                </span>
                {kpi.unit && (
                  <span className="text-text-secondary text-xs ml-1">{kpi.unit}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Business Impact Summary */}
      {systemMode !== 'normal' && throughputImpact > 0 && (
        <div className="bg-critical/10 border border-critical/40 rounded-xl p-4">
          <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">
            🔴 Business Impact Summary
          </div>
          <p className="text-text-primary text-sm leading-relaxed">
            Production throughput is reduced by{' '}
            <span className="text-critical font-bold">{throughputImpact.toFixed(1)}%</span>.
            Estimated output loss:{' '}
            <span className="text-critical font-bold">
              {Math.round((throughputImpact / 100) * baseThroughput * 8)} bottles
            </span>{' '}
            in the last 8 minutes. Immediate corrective action recommended.
          </p>
        </div>
      )}
    </div>
  );
}

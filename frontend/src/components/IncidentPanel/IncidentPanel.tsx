import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import type { Incident } from '../../types';

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-critical/10 border-critical',
    badge: 'bg-critical text-white',
    icon: '🔴',
    title: 'text-critical',
  },
  warning: {
    bg: 'bg-warning/10 border-warning',
    badge: 'bg-warning text-gray-900',
    icon: '🟡',
    title: 'text-warning',
  },
};

function IncidentCard({ incident }: { incident: Incident }) {
  const styles = SEVERITY_STYLES[incident.severity];
  const elapsed = Math.round(
    (Date.now() - new Date(incident.started_at).getTime()) / 1000
  );
  const elapsedStr =
    elapsed < 60 ? `${elapsed}s ago` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s ago`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ duration: 0.3 }}
      className={`border rounded-xl p-4 mb-3 ${styles.bg}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${styles.badge}`}>
              {incident.severity}
            </span>
            <span className="text-text-secondary text-xs">{elapsedStr}</span>
          </div>
          <h3 className={`font-bold text-sm leading-tight ${styles.title}`}>
            {incident.title}
          </h3>
        </div>
      </div>

      {/* Root Cause */}
      <div className="bg-bg-dark/50 rounded-lg p-3 mb-3">
        <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">Root Cause</div>
        <div className="text-text-primary text-sm font-medium">
          {incident.root_cause_machine_name}
        </div>
        <div className="text-critical text-xs mt-0.5">{incident.root_cause_metric}</div>
      </div>

      {/* AI / Rule Summary */}
      <div className="mb-3">
        <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">
          {incident.ai_summary ? '🤖 AI Analysis' : '⚡ Analysis'}
        </div>
        <p className="text-text-primary text-sm leading-relaxed">
          {incident.ai_summary ?? incident.rule_summary}
        </p>
      </div>

      {/* Throughput Impact */}
      {incident.throughput_impact_pct > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-text-secondary">Production impact:</span>
          <span className="text-critical font-bold text-sm">
            ▼ {incident.throughput_impact_pct.toFixed(1)}% throughput
          </span>
        </div>
      )}

      {/* Affected Machines */}
      {incident.affected_machines.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">
            Affected Systems ({incident.affected_machines.length})
          </div>
          <div className="space-y-1.5">
            {incident.affected_machines.map((am) => (
              <div key={am.machine_id} className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  am.health === 'critical' ? 'bg-critical' : 'bg-warning'
                }`} />
                <span className="text-text-secondary text-xs leading-relaxed">
                  {am.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions */}
      <div>
        <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">
          Recommended Actions
        </div>
        <ol className="space-y-1.5">
          {incident.recommended_actions.slice(0, 3).map((action, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-accent-blue font-bold text-xs flex-shrink-0 mt-0.5">
                {i + 1}.
              </span>
              <span className="text-text-primary text-xs leading-relaxed">{action}</span>
            </li>
          ))}
        </ol>
      </div>
    </motion.div>
  );
}

export function IncidentPanel() {
  const incidents = useAppStore((s) => s.incidents);
  const systemMode = useAppStore((s) => s.systemMode);

  if (systemMode === 'normal' || incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-secondary p-8 text-center">
        <span className="text-4xl mb-3">✅</span>
        <div className="font-semibold text-text-primary mb-1">All Systems Normal</div>
        <div className="text-sm">No active incidents. Monitoring all machines.</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-critical animate-pulse text-lg">🚨</span>
        <h2 className="text-text-primary font-bold text-sm uppercase tracking-wide">
          Active Incidents ({incidents.length})
        </h2>
      </div>
      <AnimatePresence mode="popLayout">
        {incidents.map((incident: Incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </AnimatePresence>
    </div>
  );
}

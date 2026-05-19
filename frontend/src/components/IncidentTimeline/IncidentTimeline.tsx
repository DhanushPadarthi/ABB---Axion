import { useAppStore } from '../../store/useAppStore';
import type { HistoryEntry } from '../../types';

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  incident_start: { icon: '🚨', color: 'text-critical' },
  incident_resolve: { icon: '✅', color: 'text-healthy' },
  state_change: { icon: '⚠️', color: 'text-warning' },
  action: { icon: '⚡', color: 'text-accent-blue' },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

export function IncidentTimeline() {
  const historyLog = useAppStore((s) => s.historyLog);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-2 pb-1 flex-shrink-0 border-b border-border-dark">
        <span className="text-text-secondary text-xs uppercase tracking-wide font-semibold">
          Event Timeline
        </span>
        {historyLog.length > 0 && (
          <span className="text-xs bg-bg-dark text-text-secondary px-1.5 py-0.5 rounded-full">
            {historyLog.length}
          </span>
        )}
      </div>

      {historyLog.length === 0 ? (
        /* Empty state — compact */
        <div className="flex-1 flex items-center justify-center gap-3 text-text-secondary">
          <span className="text-xl opacity-30">📋</span>
          <p className="text-xs">Events appear here when incidents occur — trigger a cascade to see it live.</p>
        </div>
      ) : (
        /* Event list */
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-border-dark" />
            <div className="space-y-2">
              {historyLog.map((entry: HistoryEntry) => {
                const cfg = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.action;
                return (
                  <div key={entry.id} className="relative pl-8 flex items-start gap-3">
                    <span className="absolute left-1 top-0.5 text-xs">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-text-secondary text-xs font-mono">
                          {formatTime(entry.timestamp)}
                        </span>
                        {entry.machine_name && (
                          <span className="text-xs bg-bg-dark px-1.5 py-0.5 rounded text-text-secondary">
                            {entry.machine_name}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs leading-relaxed ${cfg.color}`}>{entry.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useAppStore } from '../../store/useAppStore';
import type { ConnectionStatus } from '../../types';

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; label: string; dot: string }> = {
  connecting: { color: 'text-warning', label: 'Connecting...', dot: 'bg-warning animate-pulse' },
  connected: { color: 'text-healthy', label: 'Connected', dot: 'bg-healthy' },
  disconnected: { color: 'text-warning', label: 'Reconnecting...', dot: 'bg-warning animate-pulse' },
  error: { color: 'text-critical', label: 'Connection Lost', dot: 'bg-critical animate-pulse' },
};

export function ConnectionBanner() {
  const status = useAppStore((s) => s.connectionStatus);

  if (status === 'connected') return null;

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 bg-bg-card border-b border-border-dark">
      <span className={`flex items-center gap-2 text-sm font-medium ${cfg.color}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        {cfg.label} — Backend WebSocket at ws://localhost:8000/ws
      </span>
    </div>
  );
}

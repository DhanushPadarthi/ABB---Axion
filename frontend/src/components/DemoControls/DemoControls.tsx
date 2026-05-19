import { useAppStore } from '../../store/useAppStore';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function triggerCascade() {
  await fetch(`${BASE_URL}/api/demo/trigger`, { method: 'POST' });
}

async function resetDemo() {
  await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
}

export function DemoControls() {
  const cascadeActive = useAppStore((s) => s.cascadeActive);
  const factoryState = useAppStore((s) => s.factoryState);
  const elapsed = factoryState?.cascade_status.elapsed_seconds ?? 0;

  return (
    <div className="flex items-center gap-2">
      {/* Desktop: full label button */}
      <button
        onClick={triggerCascade}
        disabled={cascadeActive}
        title="Trigger Cascade Failure"
        className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${
          cascadeActive
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-critical/80 hover:bg-critical text-white shadow-md hover:shadow-critical/30'
        }`}
      >
        {cascadeActive ? `🔴 Active (${elapsed.toFixed(0)}s)` : '🔴 Trigger Cascade'}
      </button>

      {/* Mobile: icon-only trigger */}
      <button
        onClick={triggerCascade}
        disabled={cascadeActive}
        title={cascadeActive ? `Cascade active (${elapsed.toFixed(0)}s)` : 'Trigger Cascade'}
        className={`sm:hidden w-8 h-8 flex items-center justify-center rounded-md text-sm font-bold transition-all ${
          cascadeActive
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-critical/80 hover:bg-critical text-white'
        }`}
      >
        🔴
      </button>

      {/* Reset button */}
      <button
        onClick={resetDemo}
        title="Reset Simulation"
        className="w-8 h-8 flex items-center justify-center rounded-md text-sm font-bold bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue border border-accent-blue/30 transition-all"
      >
        ↺
      </button>
    </div>
  );
}

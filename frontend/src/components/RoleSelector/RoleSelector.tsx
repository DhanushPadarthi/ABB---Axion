import { useAppStore } from '../../store/useAppStore';
import type { UserRole } from '../../types';

const ROLES: { id: UserRole; label: string; icon: string; desc: string }[] = [
  { id: 'operator', label: 'Operator', icon: '👷', desc: 'Monitor & respond' },
  { id: 'engineer', label: 'Engineer', icon: '🔧', desc: 'Deep analysis' },
  { id: 'manager', label: 'Manager', icon: '📊', desc: 'KPI overview' },
  { id: 'architect', label: 'Architect', icon: '🏗️', desc: 'System config' },
];

interface RoleSelectorProps {
  /** When true, renders as a compact horizontal strip for mobile */
  mobile?: boolean;
}

export function RoleSelector({ mobile = false }: RoleSelectorProps) {
  const activeRole = useAppStore((s) => s.activeRole);
  const setActiveRole = useAppStore((s) => s.setActiveRole);

  if (mobile) {
    return (
      <div className="flex items-center px-2 py-1.5 gap-1 overflow-x-auto">
        {ROLES.map((role) => (
          <button
            key={role.id}
            onClick={() => setActiveRole(role.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              activeRole === role.id
                ? 'bg-accent-blue text-white'
                : 'text-text-secondary bg-bg-dark border border-border-dark'
            }`}
          >
            <span>{role.icon}</span>
            <span>{role.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-bg-card border border-border-dark rounded-lg p-1">
      {ROLES.map((role) => (
        <button
          key={role.id}
          onClick={() => setActiveRole(role.id)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
            ${activeRole === role.id
              ? 'bg-accent-blue text-white shadow-lg'
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }
          `}
          title={role.desc}
        >
          <span>{role.icon}</span>
          <span>{role.label}</span>
        </button>
      ))}
    </div>
  );
}

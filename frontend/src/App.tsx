import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from './store/useAppStore';
import { useAuthStore } from './store/useAuthStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useCustomMachineSimulator } from './hooks/useCustomMachineSimulator';
import { LoginPage } from './components/Login/LoginPage';
import { ArchitectShell } from './components/Admin/AdminShell';
import { TopologyMap } from './components/TopologyMap/TopologyMap';
import { IncidentPanel } from './components/IncidentPanel/IncidentPanel';
import { MetricCards } from './components/MetricCards/MetricCards';
import { MachineDetailDrawer } from './components/MachineDetailDrawer/MachineDetailDrawer';
import { KPIDashboard } from './components/KPIDashboard/KPIDashboard';
import { IncidentTimeline } from './components/IncidentTimeline/IncidentTimeline';
import { DemoControls } from './components/DemoControls/DemoControls';
import { ConnectionBanner } from './components/ConnectionBanner/ConnectionBanner';
import { ArchitectView } from './components/ArchitectView/ArchitectView';
import { OperatorShell } from './components/Operator/OperatorShell';
import type { AppRole, UserRole } from './types';

type MobileTab = 'map' | 'metrics' | 'alerts' | 'events';

const MOBILE_TABS_BY_ROLE: Record<UserRole, { id: MobileTab; icon: string; label: string }[]> = {
  operator: [
    { id: 'map',     icon: '🗺️', label: 'Map' },
    { id: 'metrics', icon: '📊', label: 'Metrics' },
    { id: 'alerts',  icon: '🚨', label: 'Alerts' },
    { id: 'events',  icon: '📋', label: 'Events' },
  ],
  engineer: [
    { id: 'map',     icon: '🗺️', label: 'Topology' },
    { id: 'metrics', icon: '📊', label: 'Telemetry' },
    { id: 'alerts',  icon: '🚨', label: 'Incidents' },
    { id: 'events',  icon: '📋', label: 'Timeline' },
  ],
  manager: [
    { id: 'metrics', icon: '📊', label: 'KPIs' },
    { id: 'alerts',  icon: '🚨', label: 'Incidents' },
  ],
  architect: [
    { id: 'map', icon: '🏗️', label: 'Topology' },
  ],
};

const ROLE_LABELS: Record<AppRole, string> = {
  operator: 'Operator',
  engineer: 'Engineer',
  manager: 'Manager',
  architect: 'Architect',
};

const ROLE_COLORS: Record<AppRole, string> = {
  operator: '#60a5fa',
  engineer: '#34d399',
  manager: '#fb923c',
  architect: '#f472b6',
};

function LoadingSkeleton() {
  return (
    <div className="h-screen bg-[#080c14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-accent-blue to-blue-400 rounded-3xl flex items-center justify-center font-black text-white text-2xl mx-auto mb-5 shadow-2xl shadow-accent-blue/30 animate-pulse">
          AX
        </div>
        <div className="text-text-primary font-black text-xl mb-2 tracking-tight">AXION</div>
        <div className="text-text-secondary text-sm">Connecting to simulation engine...</div>
        <div className="flex justify-center gap-1.5 mt-4">
          {[0, 0.15, 0.3].map((d) => (
            <div key={d} className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard (authenticated non-admin or impersonated role) ─────────────

function Dashboard() {
  const factoryState = useAppStore((s) => s.factoryState);
  const systemMode = useAppStore((s) => s.systemMode);
  const incidents = useAppStore((s) => s.incidents);
  const setActiveRole = useAppStore((s) => s.setActiveRole);

  const currentUser = useAuthStore((s) => s.currentUser);
  const effectiveRole = useAuthStore((s) => s.effectiveRole);
  const logout = useAuthStore((s) => s.logout);

  // Sync effective role → app store
  useEffect(() => {
    setActiveRole(effectiveRole as UserRole);
  }, [effectiveRole, setActiveRole]);

  const [mobileTab, setMobileTab] = useState<MobileTab>('map');

  if (!factoryState) return <LoadingSkeleton />;

  const activeRole: UserRole = effectiveRole as UserRole;
  const isIncidentMode = systemMode === 'incident' || systemMode === 'warning';
  const roleColor = ROLE_COLORS[effectiveRole] ?? '#60a5fa';

  const leftPanelContent =
    activeRole === 'manager' ? (
      <KPIDashboard />
    ) : (
      <div className="h-full overflow-y-auto p-4">
        <MetricCards />
      </div>
    );

  const centerContent = (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden min-h-0">
        <TopologyMap />
      </div>
      {activeRole !== 'manager' && (
        <div className="h-44 border-t border-border-dark overflow-hidden flex-shrink-0">
          <IncidentTimeline />
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen bg-bg-dark flex flex-col overflow-hidden text-text-primary">
      <ConnectionBanner />

      {/* ═══════════════════════════════════════════════════════════════
          HEADER — desktop: full row / mobile: compact row
      ════════════════════════════════════════════════════════════════ */}
      <header className="flex-shrink-0 bg-bg-panel border-b border-border-dark z-20">
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Logo + incident badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-accent-blue via-blue-500 to-blue-700 rounded-lg flex items-center justify-center font-black text-white text-xs flex-shrink-0 shadow-md shadow-accent-blue/30 ring-1 ring-white/10">
              AX
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-text-primary text-sm tracking-tight">AXION</span>
              <span className="hidden md:inline text-[9px] uppercase tracking-[0.15em] text-text-secondary mt-0.5">
                Industrial Intelligence
              </span>
            </div>
            <span className="hidden lg:inline-block ml-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-red-500/15 to-orange-500/15 border border-red-500/25 text-orange-300">
              ABB Accelerator · 2025
            </span>
            <AnimatePresence>
              {isIncidentMode && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase animate-pulse ${
                    systemMode === 'incident'
                      ? 'bg-critical/20 text-critical border border-critical/40'
                      : 'bg-warning/20 text-warning border border-warning/40'
                  }`}
                >
                  {systemMode === 'incident' ? '🔴 Incident' : '🟡 Warning'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Right: demo controls + role badge + user */}
          <div className="flex items-center gap-2">
            <DemoControls />
            {/* Role badge — replaces RoleSelector */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
              style={{ color: roleColor, background: `${roleColor}12`, borderColor: `${roleColor}30` }}
            >
              <span>{currentUser?.avatar}</span>
              <span className="uppercase tracking-wide">{ROLE_LABELS[effectiveRole]}</span>
            </div>
            {/* User info + sign out */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-border-dark">
              <div className="hidden md:block text-right">
                <p className="text-text-primary text-xs font-semibold leading-tight">{currentUser?.name}</p>
                <p className="text-text-secondary text-[10px] leading-tight">{currentUser?.department}</p>
              </div>
              <button
                onClick={logout}
                className="text-xs text-text-secondary hover:text-critical px-2 py-1 rounded-lg hover:bg-critical/10 transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-hidden flex min-h-0">

        {/* ── DESKTOP layout (md+) ────────────────────────────────── */}
        {activeRole === 'architect' ? (
          <div className="hidden md:flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <div className="flex-1 h-full min-w-0 overflow-hidden">
              <ArchitectView />
            </div>
          </div>
        ) : activeRole === 'operator' ? (
          <div className="hidden md:flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <OperatorShell />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 overflow-hidden">
            {/* Left panel */}
            <motion.div
              animate={{ width: isIncidentMode ? '280px' : '300px' }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="flex-shrink-0 border-r border-border-dark flex flex-col overflow-hidden"
            >
              {leftPanelContent}
            </motion.div>

            {/* Center */}
            <motion.div
              className="flex-1 overflow-hidden flex flex-col"
              animate={{ flexGrow: isIncidentMode ? 2 : 3 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              {centerContent}
            </motion.div>

            {/* Right incident panel */}
            <AnimatePresence>
              {isIncidentMode && (
                <motion.div
                  key="incident-panel"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '380px', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="flex-shrink-0 border-l border-border-dark overflow-hidden"
                >
                  <div className="w-96 h-full">
                    <IncidentPanel />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── MOBILE layout (< md) ────────────────────────────────── */}
        {activeRole === 'operator' ? (
          /* Operator gets its own mobile shell (tabs built into OperatorShell) */
          <div className="flex md:hidden flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <OperatorShell />
          </div>
        ) : (
        <div className="flex md:hidden flex-1 overflow-hidden flex-col">
          {/* Active tab panel */}
          <div className="flex-1 overflow-hidden min-h-0">
            {mobileTab === 'map' && (
              activeRole === 'architect' ? <ArchitectView /> : centerContent
            )}
            {mobileTab === 'metrics' && (
              activeRole === 'manager' ? (
                <KPIDashboard />
              ) : (
                <div className="h-full overflow-y-auto p-3">
                  <MetricCards />
                </div>
              )
            )}
            {mobileTab === 'alerts' && (
              <div className="h-full overflow-y-auto">
                <IncidentPanel />
              </div>
            )}
            {mobileTab === 'events' && (
              <div className="h-full">
                <IncidentTimeline />
              </div>
            )}
          </div>

          {/* Bottom tab bar — role-specific tabs */}
          <nav className="safe-bottom flex-shrink-0 flex border-t border-border-dark bg-bg-panel">
            {(MOBILE_TABS_BY_ROLE[activeRole] ?? MOBILE_TABS_BY_ROLE.operator).map((tab) => {
              const hasAlert = tab.id === 'alerts' && incidents.length > 0;
              const isActive = mobileTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMobileTab(tab.id as MobileTab)}
                  className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors ${
                    isActive
                      ? 'text-accent-blue'
                      : 'text-text-secondary active:text-text-primary'
                  }`}
                >
                  {isActive && (
                    <span className="absolute top-0 left-3 right-3 h-0.5 bg-accent-blue rounded-full" />
                  )}
                  <span className="text-base leading-none">{tab.icon}</span>
                  <span className="text-xs font-medium">{tab.label}</span>
                  {hasAlert && (
                    <span className="absolute top-1.5 right-5 w-2 h-2 bg-critical rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        )}
      </main>

      {/* Machine Detail Drawer (global overlay) */}
      <MachineDetailDrawer />
    </div>
  );
}

// ─── Root: auth guard ────────────────────────────────────────────────────────

export default function App() {
  // Connect WebSocket at root level
  useWebSocket();
  // AI-driven live values for architect-added custom machines (no real datasource)
  useCustomMachineSimulator();

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const currentUser = useAuthStore((s) => s.currentUser);

  if (!isLoggedIn) return <LoginPage />;

  // System Architect gets their own full configuration shell
  if (currentUser?.role === 'architect') return <ArchitectShell />;

  return <Dashboard />;
}

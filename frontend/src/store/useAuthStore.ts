import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AppRole, UITemplate, UITemplateId, CustomMachine, DataSource } from '../types';

// ─── Demo Users ────────────────────────────────────────────────────────────────

export const DEMO_USERS: User[] = [
  {
    id: 'operator1',
    username: 'operator',
    name: 'John Reeves',
    role: 'operator',
    avatar: '👷',
    department: 'Production Floor',
    email: 'j.reeves@axion.plant',
  },
  {
    id: 'engineer1',
    username: 'engineer',
    name: 'Sarah Müller',
    role: 'engineer',
    avatar: '🔧',
    department: 'Process Engineering',
    email: 's.muller@axion.plant',
  },
  {
    id: 'manager1',
    username: 'manager',
    name: 'Michael Torres',
    role: 'manager',
    avatar: '📊',
    department: 'Plant Management',
    email: 'm.torres@axion.plant',
  },
  {
    id: 'architect1',
    username: 'architect',
    name: 'Alex Patel',
    role: 'architect',
    avatar: '🏗️',
    department: 'Systems Architecture',
    email: 'a.patel@axion.plant',
  },
];

const DEMO_PASSWORDS: Record<string, string> = {
  operator: 'op123',
  engineer: 'eng123',
  manager: 'mgr123',
  architect: 'arch123',
};

// ─── Default UI Templates ──────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: UITemplate[] = [
  {
    id: 'operations',
    name: 'Operations Focus',
    description: 'Topology map is primary. Metrics in sidebar. Alert panel activates on incident.',
    icon: '🗺️',
    forRoles: ['operator'],
    autoActivateOn: 'normal',
    aiGuidance: 'Prioritize real-time status, alert urgency, and recommended actions. Keep language simple and direct.',
    layout: {
      showTopology: true,
      showMetrics: true,
      showIncidentPanel: true,
      showTimeline: true,
      topologyPriority: 'primary',
      metricDetail: 'compact',
      autoFocusIncidents: true,
    },
  },
  {
    id: 'analytics',
    name: 'Analytics Deep Dive',
    description: 'Full metric detail, extended timeline history, all threshold lines shown.',
    icon: '📈',
    forRoles: ['engineer'],
    autoActivateOn: 'always',
    aiGuidance: 'Include technical root cause analysis, metric thresholds, degradation formulas, and dependency impact weights.',
    layout: {
      showTopology: true,
      showMetrics: true,
      showIncidentPanel: true,
      showTimeline: true,
      topologyPriority: 'secondary',
      metricDetail: 'detailed',
      autoFocusIncidents: false,
    },
  },
  {
    id: 'incident_response',
    name: 'Incident Response',
    description: 'Auto-activates during incidents. Incident panel expands, topology shows impact path.',
    icon: '🚨',
    forRoles: ['operator', 'engineer'],
    autoActivateOn: 'incident',
    aiGuidance: 'Focus on immediate containment steps, affected systems list, estimated downtime, and escalation contacts.',
    layout: {
      showTopology: true,
      showMetrics: true,
      showIncidentPanel: true,
      showTimeline: true,
      topologyPriority: 'secondary',
      metricDetail: 'normal',
      autoFocusIncidents: true,
    },
  },
  {
    id: 'executive',
    name: 'Executive View',
    description: 'KPIs and business impact only. No technical metrics. Clean summary language.',
    icon: '📊',
    forRoles: ['manager'],
    autoActivateOn: 'always',
    aiGuidance: 'Use business language: production output, efficiency %, estimated revenue impact, and recovery timeline. Avoid technical jargon.',
    layout: {
      showTopology: false,
      showMetrics: true,
      showIncidentPanel: true,
      showTimeline: false,
      topologyPriority: 'hidden',
      metricDetail: 'compact',
      autoFocusIncidents: true,
    },
  },
  {
    id: 'architect_view',
    name: 'Architect View',
    description: 'System configuration, dependencies, data schema. Read-only structural view.',
    icon: '🏗️',
    forRoles: ['architect'],
    autoActivateOn: 'always',
    aiGuidance: 'Describe system architecture, data flow, integration points, and configuration schema. Include dependency graph details.',
    layout: {
      showTopology: true,
      showMetrics: false,
      showIncidentPanel: false,
      showTimeline: false,
      topologyPriority: 'primary',
      metricDetail: 'compact',
      autoFocusIncidents: false,
    },
  },
];

// ─── Store ─────────────────────────────────────────────────────────────────────

interface AuthStore {
  // Session
  currentUser: User | null;
  isLoggedIn: boolean;
  loginError: string | null;

  // Effective role (equals currentUser.role)
  effectiveRole: AppRole;

  // UI Templates
  templates: UITemplate[];
  activeTemplateId: UITemplateId;

  // Custom machines (architect-added)
  customMachines: CustomMachine[];

  // Data sources
  dataSources: DataSource[];

  // Architect-defined dependency connections between machines
  architectConnections: { id: string; source: string; target: string; weight: number; context?: string }[];

  // Architect-saved node positions for ALL machines (persisted so operator sees the same layout)
  savedMachinePositions: Record<string, { x: number; y: number }>;

  // Non-persisted: backend API dependencies (loaded when topology fetches)
  apiDependencies: { source: string; sourceName: string; target: string; targetName: string; weight: number }[];

  // Non-persisted: AI-suggested sensor profiles per custom machine
  // Shape: { [machineId]: { [sensorLabel]: { min, max, warn, crit, base, unit, kind } } }
  customMachineProfiles: Record<string, Record<string, CustomSensorProfile>>;

  // Non-persisted: live simulated values for each custom machine's sensors
  // Shape: { [machineId]: { [sensorLabel]: { value, status } } }
  customMachineMetrics: Record<string, Record<string, { value: number; status: 'healthy' | 'warning' | 'critical' }>>;

  // Actions
  login: (username: string, password: string) => boolean;
  logout: () => void;
  updateTemplate: (id: UITemplateId, patch: Partial<UITemplate>) => void;
  setActiveTemplate: (id: UITemplateId) => void;
  addCustomMachine: (machine: CustomMachine) => void;
  removeCustomMachine: (id: string) => void;
  updateCustomMachine: (id: string, patch: Partial<CustomMachine>) => void;
  setCustomMachinePosition: (id: string, position: { x: number; y: number }) => void;
  addDataSource: (ds: DataSource) => void;
  updateDataSource: (id: string, patch: Partial<DataSource>) => void;
  removeDataSource: (id: string) => void;
  addArchitectConnection: (conn: { id: string; source: string; target: string; weight: number; context?: string }) => void;
  removeArchitectConnection: (id: string) => void;
  updateArchitectConnectionWeight: (id: string, weight: number) => void;
  updateArchitectConnectionContext: (id: string, context: string) => void;
  setApiDependencies: (deps: { source: string; sourceName: string; target: string; targetName: string; weight: number }[]) => void;
  setSavedMachinePosition: (id: string, position: { x: number; y: number }) => void;
  setCustomMachineProfile: (machineId: string, profiles: Record<string, CustomSensorProfile>) => void;
  setCustomMachineMetrics: (machineId: string, metrics: Record<string, { value: number; status: 'healthy' | 'warning' | 'critical' }>) => void;
}

export interface CustomSensorProfile {
  min: number;
  max: number;
  warn: number | null;
  crit: number | null;
  base: number;
  unit: string;
  kind: 'line' | 'gauge' | 'bar' | 'status';
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isLoggedIn: false,
      loginError: null,
      effectiveRole: 'operator',
      templates: DEFAULT_TEMPLATES,
      activeTemplateId: 'operations',
      customMachines: [],
      architectConnections: [],
      savedMachinePositions: {},
      apiDependencies: [],
      customMachineProfiles: {},
      customMachineMetrics: {},
      dataSources: [
        {
          id: 'sim-1',
          name: 'Built-in Simulation Engine',
          protocol: 'simulation',
          connectionString: 'ws://localhost:8000/ws',
          status: 'connected',
        },
      ],

      login: (username, password) => {
        const user = DEMO_USERS.find((u) => u.username === username);
        if (!user || DEMO_PASSWORDS[username] !== password) {
          set({ loginError: 'Invalid username or password' });
          return false;
        }
        const templateId = user.role === 'manager'
          ? 'executive'
          : user.role === 'architect'
          ? 'architect_view'
          : user.role === 'engineer'
          ? 'analytics'
          : 'operations';
        set({
          currentUser: user,
          isLoggedIn: true,
          loginError: null,
          effectiveRole: user.role,
          activeTemplateId: templateId as UITemplateId,
        });
        return true;
      },

      logout: () =>
        set({
          currentUser: null,
          isLoggedIn: false,
          effectiveRole: 'operator',
        }),

      updateTemplate: (id, patch) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      setActiveTemplate: (id) => set({ activeTemplateId: id }),

      addCustomMachine: (machine) =>
        set((s) => ({ customMachines: [...s.customMachines, machine] })),

      removeCustomMachine: (id) =>
        set((s) => ({ customMachines: s.customMachines.filter((m) => m.id !== id) })),

      updateCustomMachine: (id, patch) =>
        set((s) => ({ customMachines: s.customMachines.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

      setCustomMachinePosition: (id, position) =>
        set((s) => ({
          customMachines: s.customMachines.map((m) => (m.id === id ? { ...m, position } : m)),
        })),

      addDataSource: (ds) =>
        set((s) => ({ dataSources: [...s.dataSources, ds] })),

      updateDataSource: (id, patch) =>
        set((s) => ({
          dataSources: s.dataSources.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),

      removeDataSource: (id) =>
        set((s) => ({ dataSources: s.dataSources.filter((d) => d.id !== id) })),

      addArchitectConnection: (conn) =>
        set((s) => ({ architectConnections: [...s.architectConnections, conn] })),

      removeArchitectConnection: (id) =>
        set((s) => ({ architectConnections: s.architectConnections.filter((c) => c.id !== id) })),

      updateArchitectConnectionWeight: (id, weight) =>
        set((s) => ({
          architectConnections: s.architectConnections.map((c) => (c.id === id ? { ...c, weight } : c)),
        })),

      updateArchitectConnectionContext: (id, context) =>
        set((s) => ({
          architectConnections: s.architectConnections.map((c) => (c.id === id ? { ...c, context } : c)),
        })),

      setApiDependencies: (deps) => set({ apiDependencies: deps }),

      setSavedMachinePosition: (id, position) =>
        set((s) => ({
          savedMachinePositions: { ...s.savedMachinePositions, [id]: position },
        })),

      setCustomMachineProfile: (machineId, profiles) =>
        set((s) => ({
          customMachineProfiles: { ...s.customMachineProfiles, [machineId]: profiles },
        })),

      setCustomMachineMetrics: (machineId, metrics) =>
        set((s) => ({
          customMachineMetrics: { ...s.customMachineMetrics, [machineId]: metrics },
        })),
    }),
    {
      name: 'axion-auth',
      partialize: (s) => ({
        currentUser: s.currentUser,
        isLoggedIn: s.isLoggedIn,
        templates: s.templates,
        customMachines: s.customMachines,
        dataSources: s.dataSources,
        activeTemplateId: s.activeTemplateId,
        architectConnections: s.architectConnections,
        savedMachinePositions: s.savedMachinePositions,
      }),
      // After page reload: restore effectiveRole from currentUser
      onRehydrateStorage: () => (state) => {
        if (state?.currentUser) {
          state.effectiveRole = state.currentUser.role;
        }
      },
    }
  )
);

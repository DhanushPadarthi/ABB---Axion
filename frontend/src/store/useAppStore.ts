import { create } from 'zustand';
import type {
  FactoryState,
  MachineState,
  Incident,
  SystemMode,
  UserRole,
  ConnectionStatus,
  HistoryEntry,
} from '../types';

interface AppStore {
  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;

  // Factory state (updated every 500ms from WebSocket)
  factoryState: FactoryState | null;
  setFactoryState: (state: FactoryState) => void;

  // Derived accessors
  machines: Record<string, MachineState>;
  incidents: Incident[];
  systemMode: SystemMode;

  // Role
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;

  // Selected machine (for detail drawer)
  selectedMachineId: string | null;
  setSelectedMachineId: (id: string | null) => void;

  // Incident history log
  historyLog: HistoryEntry[];
  addHistoryEntry: (entry: HistoryEntry) => void;

  // Cascade / demo controls
  cascadeActive: boolean;
}

export const useAppStore = create<AppStore>((set, get) => ({
  connectionStatus: 'disconnected',
  setConnectionStatus: (s) => set({ connectionStatus: s }),

  factoryState: null,
  machines: {},
  incidents: [],
  systemMode: 'normal',
  cascadeActive: false,

  setFactoryState: (incoming: FactoryState) => {
    const prev = get().factoryState;

    // Detect new incidents for history log
    const prevIncidentIds = new Set((prev?.incidents ?? []).map((i) => i.id));
    const newIncidents = incoming.incidents.filter((i) => !prevIncidentIds.has(i.id));
    const resolvedIncidents = (prev?.incidents ?? []).filter(
      (i) => !incoming.incidents.find((ni) => ni.id === i.id)
    );

    const newEntries: HistoryEntry[] = [];
    for (const inc of newIncidents) {
      newEntries.push({
        id: `${inc.id}-start`,
        timestamp: inc.started_at,
        type: 'incident_start',
        machine_id: inc.root_cause_machine_id,
        machine_name: inc.root_cause_machine_name,
        description: `Incident detected: ${inc.title}`,
        severity: inc.severity,
      });
    }
    for (const inc of resolvedIncidents) {
      newEntries.push({
        id: `${inc.id}-resolve`,
        timestamp: new Date().toISOString(),
        type: 'incident_resolve',
        machine_id: inc.root_cause_machine_id,
        machine_name: inc.root_cause_machine_name,
        description: `Incident resolved: ${inc.title}`,
        severity: inc.severity,
      });
    }

    set((state) => ({
      factoryState: incoming,
      machines: incoming.machines,
      incidents: incoming.incidents,
      systemMode: incoming.system_mode,
      cascadeActive: incoming.cascade_status.active,
      historyLog:
        newEntries.length > 0
          ? [...newEntries, ...state.historyLog].slice(0, 200)
          : state.historyLog,
    }));
  },

  activeRole: 'operator',
  setActiveRole: (role) => set({ activeRole: role }),

  selectedMachineId: null,
  setSelectedMachineId: (id) => set({ selectedMachineId: id }),

  historyLog: [],
  addHistoryEntry: (entry) =>
    set((state) => ({ historyLog: [entry, ...state.historyLog].slice(0, 200) })),
}));

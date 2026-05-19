// ─── Core Enums & Status ─────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unconfigured';
export type SystemMode = 'normal' | 'warning' | 'incident';
export type UserRole = 'operator' | 'engineer' | 'manager' | 'architect';
export type AppRole = UserRole;
export type MetricType = 'line' | 'gauge' | 'bar' | 'status';
export type IncidentSeverity = 'warning' | 'critical';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  name: string;
  role: AppRole;
  avatar: string;
  department: string;
  email: string;
}

// ─── UI Templates ─────────────────────────────────────────────────────────────

export type UITemplateId = 'operations' | 'analytics' | 'incident_response' | 'executive' | 'architect_view';

export interface UITemplate {
  id: UITemplateId;
  name: string;
  description: string;
  icon: string;
  forRoles: AppRole[];
  autoActivateOn: SystemMode | 'always';
  aiGuidance: string;
  layout: {
    showTopology: boolean;
    showMetrics: boolean;
    showIncidentPanel: boolean;
    showTimeline: boolean;
    topologyPriority: 'primary' | 'secondary' | 'hidden';
    metricDetail: 'compact' | 'normal' | 'detailed';
    autoFocusIncidents: boolean;
  };
}

// ─── Custom Machine (admin-defined) ────────────────────────────────────────────

export type DataSourceProtocol = 'simulation' | 'opcua' | 'mqtt' | 'rest' | 'modbus';

export interface DataSource {
  id: string;
  name: string;
  protocol: DataSourceProtocol;
  connectionString: string;
  status: 'connected' | 'disconnected' | 'error';
}

export interface CustomMachine {
  id: string;
  name: string;
  type: string;
  location: string;
  description: string;
  position: { x: number; y: number };
  dataSourceId: string | null;
  dependsOn: string[];
  sensors: string[];
  addedAt: string;
}


// ─── Machine & Metrics ────────────────────────────────────────────────────────

export interface MetricValue {
  key: string;
  label: string;
  unit: string;
  type: MetricType;
  value: number;
  status: HealthStatus;
  normal_min: number | null;
  normal_max: number | null;
  warning_min: number | null;
  warning_max: number | null;
  critical_min: number | null;
  critical_max: number | null;
}

export interface DependencyLink {
  machine_id: string;
  impact_weight: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface MachineState {
  id: string;
  name: string;
  type: string;
  location: string;
  description: string;
  position: Position;
  health: HealthStatus;
  metrics: MetricValue[];
  dependencies_downstream: DependencyLink[];
  degradation_factor: number;
}

// ─── Incidents ────────────────────────────────────────────────────────────────

export interface AffectedMachine {
  machine_id: string;
  machine_name: string;
  description: string;
  health: HealthStatus;
}

export interface Incident {
  id: string;
  title: string;
  root_cause_machine_id: string;
  root_cause_machine_name: string;
  root_cause_metric: string;
  root_cause_description: string;
  affected_machines: AffectedMachine[];
  severity: IncidentSeverity;
  started_at: string;
  rule_summary: string;
  ai_summary: string | null;
  recommended_actions: string[];
  throughput_impact_pct: number;
  resolved_at?: string;
}

// ─── Factory State (WebSocket Payload) ────────────────────────────────────────

export interface CascadeStatus {
  active: boolean;
  elapsed_seconds: number;
}

export interface FactoryState {
  machines: Record<string, MachineState>;
  incidents: Incident[];
  system_mode: SystemMode;
  tick: number;
  timestamp: string;
  cascade_status: CascadeStatus;
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  timestamp: string;
  type: 'incident_start' | 'incident_resolve' | 'state_change' | 'action';
  machine_id?: string;
  machine_name?: string;
  description: string;
  severity?: IncidentSeverity;
}

// ─── WebSocket Connection ─────────────────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

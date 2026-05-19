/**
 * useOfflineSimulator — provides live-drifting factory state when no backend
 * WebSocket is available. Seeds all 5 real machines immediately on mount and
 * ticks every 1.5 s. Automatically yields to live WS data when connected.
 */
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { FactoryState, MachineState, MetricValue } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function drift(prev: number, base: number, normalMin: number | null, normalMax: number | null): number {
  const span = Math.max((normalMax ?? base * 1.5) - (normalMin ?? 0), 1);
  const gravity = 0.05 * (base - prev);
  const noise = (Math.random() - 0.5) * 2 * 0.012 * span;
  return prev + gravity + noise;
}

function statusOf(v: number, m: MetricValue): MetricValue['status'] {
  if (m.critical_max !== null && v > m.critical_max) return 'critical';
  if (m.critical_min !== null && v < m.critical_min) return 'critical';
  if (m.warning_max !== null && v > m.warning_max) return 'warning';
  if (m.warning_min !== null && v < m.warning_min) return 'warning';
  return 'healthy';
}

// ─── Seed State (mirrors backend/config/machines.json base values) ─────────────

const SEED: FactoryState = {
  system_mode: 'normal',
  tick: 0,
  timestamp: new Date().toISOString(),
  cascade_status: { active: false, elapsed_seconds: 0 },
  incidents: [],
  machines: {
    cooling_unit: {
      id: 'cooling_unit', name: 'Cooling Unit', type: 'thermal_control',
      location: 'Zone A - Utility Room',
      description: 'Maintains beverage liquid at precise temperature stability for consistent fill quality.',
      position: { x: 80, y: 300 }, health: 'healthy', degradation_factor: 0,
      dependencies_downstream: [{ machine_id: 'filling_machine', impact_weight: 0.8 }],
      metrics: [
        { key: 'coolant_temperature', label: 'Coolant Temp', unit: '°C', type: 'line', value: 12, status: 'healthy', normal_min: 8, normal_max: 18, warning_min: null, warning_max: 60, critical_min: null, critical_max: 90 },
        { key: 'cooling_efficiency', label: 'Cooling Efficiency', unit: '%', type: 'gauge', value: 96, status: 'healthy', normal_min: 85, normal_max: 100, warning_min: 60, warning_max: null, critical_min: 40, critical_max: null },
        { key: 'power_draw', label: 'Power Draw', unit: 'kW', type: 'line', value: 20, status: 'healthy', normal_min: 15, normal_max: 25, warning_min: null, warning_max: 35, critical_min: null, critical_max: 45 },
        { key: 'coolant_flow_rate', label: 'Coolant Flow', unit: 'L/min', type: 'line', value: 16, status: 'healthy', normal_min: 12, normal_max: 20, warning_min: 8, warning_max: null, critical_min: 4, critical_max: null },
      ],
    },
    filling_machine: {
      id: 'filling_machine', name: 'Liquid Filling Machine', type: 'filling',
      location: 'Zone B - Production Line',
      description: 'Controls high-precision filling of bottles with cooled liquid.',
      position: { x: 320, y: 300 }, health: 'healthy', degradation_factor: 0,
      dependencies_downstream: [{ machine_id: 'capping_system', impact_weight: 0.65 }],
      metrics: [
        { key: 'fill_accuracy', label: 'Fill Accuracy', unit: '%', type: 'gauge', value: 98.5, status: 'healthy', normal_min: 95, normal_max: 100, warning_min: 88, warning_max: null, critical_min: 80, critical_max: null },
        { key: 'liquid_pressure', label: 'Liquid Pressure', unit: 'bar', type: 'line', value: 4.2, status: 'healthy', normal_min: 3, normal_max: 5.5, warning_min: 2, warning_max: 6.5, critical_min: 1.5, critical_max: 7.5 },
        { key: 'throughput', label: 'Throughput', unit: 'btl/min', type: 'line', value: 300, status: 'healthy', normal_min: 280, normal_max: 320, warning_min: 220, warning_max: null, critical_min: 160, critical_max: null },
        { key: 'fill_volume_variance', label: 'Volume Variance', unit: 'mL', type: 'line', value: 0.8, status: 'healthy', normal_min: 0, normal_max: 2, warning_min: null, warning_max: 5, critical_min: null, critical_max: 10 },
      ],
    },
    capping_system: {
      id: 'capping_system', name: 'Bottle Capping System', type: 'capping',
      location: 'Zone C - Production Line',
      description: 'Seals each filled bottle with a cap.',
      position: { x: 560, y: 300 }, health: 'healthy', degradation_factor: 0,
      dependencies_downstream: [{ machine_id: 'packaging_conveyor', impact_weight: 0.5 }],
      metrics: [
        { key: 'motor_speed', label: 'Motor Speed', unit: 'RPM', type: 'line', value: 1500, status: 'healthy', normal_min: 1400, normal_max: 1600, warning_min: 1100, warning_max: 1800, critical_min: 800, critical_max: 2100 },
        { key: 'vibration_level', label: 'Vibration', unit: 'mm/s', type: 'line', value: 1.8, status: 'healthy', normal_min: 0, normal_max: 3.5, warning_min: null, warning_max: 6, critical_min: null, critical_max: 9 },
        { key: 'cap_accuracy', label: 'Cap Accuracy', unit: '%', type: 'gauge', value: 98.8, status: 'healthy', normal_min: 96, normal_max: 100, warning_min: 90, warning_max: null, critical_min: 83, critical_max: null },
        { key: 'motor_temperature', label: 'Motor Temp', unit: '°C', type: 'line', value: 55, status: 'healthy', normal_min: 40, normal_max: 70, warning_min: null, warning_max: 85, critical_min: null, critical_max: 100 },
      ],
    },
    packaging_conveyor: {
      id: 'packaging_conveyor', name: 'Packaging Conveyor', type: 'conveyor',
      location: 'Zone D - Transfer Line',
      description: 'Moves capped bottles from the production area to the packaging station.',
      position: { x: 800, y: 300 }, health: 'healthy', degradation_factor: 0,
      dependencies_downstream: [{ machine_id: 'storage_unit', impact_weight: 0.4 }],
      metrics: [
        { key: 'belt_speed', label: 'Belt Speed', unit: 'm/min', type: 'line', value: 21, status: 'healthy', normal_min: 18, normal_max: 24, warning_min: 12, warning_max: null, critical_min: 8, critical_max: null },
        { key: 'motor_temperature', label: 'Motor Temp', unit: '°C', type: 'line', value: 48, status: 'healthy', normal_min: 35, normal_max: 65, warning_min: null, warning_max: 78, critical_min: null, critical_max: 95 },
        { key: 'load', label: 'Load', unit: 'kg', type: 'line', value: 38, status: 'healthy', normal_min: 20, normal_max: 60, warning_min: 10, warning_max: 75, critical_min: 5, critical_max: 90 },
        { key: 'conveyor_throughput', label: 'Throughput', unit: 'btl/min', type: 'line', value: 295, status: 'healthy', normal_min: 260, normal_max: 320, warning_min: 200, warning_max: null, critical_min: 140, critical_max: null },
      ],
    },
    storage_unit: {
      id: 'storage_unit', name: 'Storage Unit', type: 'storage',
      location: 'Zone E - Warehouse',
      description: 'Receives packaged products and manages inventory intake.',
      position: { x: 1040, y: 300 }, health: 'healthy', degradation_factor: 0,
      dependencies_downstream: [],
      metrics: [
        { key: 'capacity_used', label: 'Capacity Used', unit: '%', type: 'gauge', value: 42, status: 'healthy', normal_min: 0, normal_max: 80, warning_min: null, warning_max: 90, critical_min: null, critical_max: 98 },
        { key: 'intake_rate', label: 'Intake Rate', unit: 'units/min', type: 'line', value: 285, status: 'healthy', normal_min: 250, normal_max: 320, warning_min: 190, warning_max: null, critical_min: 130, critical_max: null },
        { key: 'storage_temperature', label: 'Storage Temp', unit: '°C', type: 'line', value: 5, status: 'healthy', normal_min: 2, normal_max: 8, warning_min: null, warning_max: 12, critical_min: null, critical_max: 16 },
        { key: 'inventory_queue', label: 'Queue Depth', unit: 'units', type: 'line', value: 120, status: 'healthy', normal_min: 0, normal_max: 500, warning_min: null, warning_max: 800, critical_min: null, critical_max: 1200 },
      ],
    },
  },
};

// Base values for drift gravity
const BASE_VALUES: Record<string, Record<string, number>> = Object.fromEntries(
  Object.entries(SEED.machines).map(([id, m]) => [
    id,
    Object.fromEntries(m.metrics.map((metric) => [metric.key, metric.value])),
  ])
);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOfflineSimulator() {
  const setFactoryState = useAppStore((s) => s.setFactoryState);
  const stateRef = useRef<FactoryState>(JSON.parse(JSON.stringify(SEED)) as FactoryState);

  useEffect(() => {
    // Seed data immediately so the UI is populated on first render
    setFactoryState(stateRef.current);

    const interval = setInterval(() => {
      // Yield to live WebSocket data when the backend is connected
      if (useAppStore.getState().connectionStatus === 'connected') return;

      const curr = stateRef.current;
      const newMachines: Record<string, MachineState> = {};

      for (const [id, machine] of Object.entries(curr.machines)) {
        const bases = BASE_VALUES[id] ?? {};
        const newMetrics: MetricValue[] = machine.metrics.map((m) => {
          const base = bases[m.key] ?? m.value;
          const newVal = drift(m.value, base, m.normal_min, m.normal_max);
          const status = statusOf(newVal, m);
          return { ...m, value: newVal, status };
        });

        const statuses = newMetrics.map((m) => m.status);
        const health: MachineState['health'] = statuses.includes('critical')
          ? 'critical'
          : statuses.includes('warning')
          ? 'warning'
          : 'healthy';

        newMachines[id] = { ...machine, metrics: newMetrics, health };
      }

      const next: FactoryState = {
        ...curr,
        machines: newMachines,
        tick: curr.tick + 1,
        timestamp: new Date().toISOString(),
      };

      stateRef.current = next;
      setFactoryState(next);
    }, 1500);

    return () => clearInterval(interval);
  }, [setFactoryState]);
}

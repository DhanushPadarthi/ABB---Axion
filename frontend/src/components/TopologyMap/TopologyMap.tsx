import React, { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { MachineNode } from './MachineNode';
import type { MachineState } from '../../types';

const nodeTypes: NodeTypes = {
  machine: MachineNode,
};

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  unconfigured: '#64748b',
};

function buildNodes(
  machines: Record<string, MachineState>,
  customMachines: ReturnType<typeof useAuthStore.getState>['customMachines'],
  savedPositions: Record<string, { x: number; y: number }>,
  customMetrics: Record<string, Record<string, { value: number; status: 'healthy' | 'warning' | 'critical' }>>,
  customProfiles: ReturnType<typeof useAuthStore.getState>['customMachineProfiles']
): Node[] {
  const sim = Object.values(machines).map((m) => ({
    id: m.id,
    type: 'machine',
    // Use architect-saved position if available, otherwise fall back to backend default
    position: savedPositions[m.id] ?? m.position,
    data: { machine: m, isCustom: false },
    draggable: false,
  }));

  const custom = customMachines.map((cm) => {
    const live = customMetrics[cm.id] ?? {};
    const profiles = customProfiles[cm.id] ?? {};
    const statuses: Array<'healthy' | 'warning' | 'critical'> = [];
    const metrics = (cm.sensors ?? []).map((sensor, i) => {
      const lv = live[sensor];
      const pr = profiles[sensor];
      if (lv) statuses.push(lv.status);
      return {
        key: `sensor_${i}`,
        label: sensor,
        unit: pr?.unit ?? '',
        type: (pr?.kind === 'status' ? 'status' : pr?.kind === 'gauge' ? 'gauge' : pr?.kind === 'bar' ? 'bar' : 'line') as MachineState['metrics'][number]['type'],
        value: lv?.value ?? pr?.base ?? 0,
        status: (lv?.status ?? 'healthy') as MachineState['metrics'][number]['status'],
        normal_min: pr?.min ?? null,
        normal_max: pr?.warn ?? null,
        warning_min: null,
        warning_max: pr?.warn ?? null,
        critical_min: null,
        critical_max: pr?.crit ?? null,
      };
    });
    const overall: 'healthy' | 'warning' | 'critical' = statuses.includes('critical')
      ? 'critical'
      : statuses.includes('warning')
      ? 'warning'
      : 'healthy';
    return {
      id: cm.id,
      type: 'machine',
      position: savedPositions[cm.id] ?? cm.position,
      data: {
        isCustom: true,
        machine: {
          id: cm.id,
          name: cm.name,
          type: cm.type,
          location: cm.location,
          description: cm.description,
          health: overall,
          metrics,
          dependencies_downstream: [],
          position: savedPositions[cm.id] ?? cm.position,
          degradation_factor: 0,
        } as MachineState,
      },
      draggable: false,
    };
  });

  return [...sim, ...custom];
}

function buildEdges(
  machines: Record<string, MachineState>,
  incidents: ReturnType<typeof useAppStore.getState>['incidents'],
  architectConnections: { id: string; source: string; target: string; weight: number; context?: string }[],
  customMachines: ReturnType<typeof useAuthStore.getState>['customMachines']
): Edge[] {
  const activeRootIds = new Set(incidents.map((i) => i.root_cause_machine_id));
  const affectedIds = new Set(
    incidents.flatMap((i) => i.affected_machines.map((am) => am.machine_id))
  );
  // Cascade propagation set: includes root cause + directly affected machines.
  // Architect/custom edges touching these nodes animate too.
  const cascadeSet = new Set([...activeRootIds, ...affectedIds]);

  const edges: Edge[] = [];
  const seenPairs = new Set<string>(); // deduplicate by source→target pair

  // ── 1. Backend API dependency edges ──────────────────────────────────────
  for (const machine of Object.values(machines)) {
    for (const dep of machine.dependencies_downstream) {
      const pairKey = `${machine.id}→${dep.machine_id}`;
      seenPairs.add(pairKey);

      const isAffected =
        (activeRootIds.has(machine.id) || affectedIds.has(machine.id)) &&
        affectedIds.has(dep.machine_id);

      const targetHealth = machines[dep.machine_id]?.health ?? 'healthy';
      const edgeColor = isAffected ? STATUS_COLORS[targetHealth] ?? STATUS_COLORS.healthy : '#334155';

      edges.push({
        id: `${machine.id}->${dep.machine_id}`,
        source: machine.id,
        target: dep.machine_id,
        animated: isAffected,
        style: { stroke: edgeColor, strokeWidth: isAffected ? 3 : 2 },
        markerEnd: { type: 'arrowclosed' as const, color: edgeColor },
      });
    }
  }

  // ── 2. Custom machine dependsOn edges ────────────────────────────────────
  // Style matches ArchitectView custom edges: solid bright blue, animated.
  for (const cm of customMachines) {
    for (const depId of cm.dependsOn) {
      const pairKey = `${cm.id}→${depId}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const isAffected = cascadeSet.has(cm.id) || cascadeSet.has(depId);
      const targetHealth = machines[depId]?.health ?? 'healthy';
      const edgeColor = isAffected ? STATUS_COLORS[targetHealth] ?? '#3b82f6' : '#3b82f6';

      edges.push({
        id: `custom_dep_${cm.id}_${depId}`,
        source: cm.id,
        target: depId,
        animated: true,
        style: {
          stroke: edgeColor,
          strokeWidth: isAffected ? 3 : 2.5,
        },
        markerEnd: { type: 'arrowclosed' as const, color: edgeColor },
      });
    }
  }

  // ── 3. Architect connection edges (canvas-drawn) ─────────────────────────
  // Identical styling to ArchitectView buildCustomEdges so operator/engineer/manager
  // see the same lines the architect drew.
  for (const conn of architectConnections) {
    const pairKey = `${conn.source}→${conn.target}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const isAffected = cascadeSet.has(conn.source) || cascadeSet.has(conn.target);
    const targetHealth = machines[conn.target]?.health ?? 'healthy';
    const edgeColor = isAffected ? STATUS_COLORS[targetHealth] ?? '#3b82f6' : '#3b82f6';

    edges.push({
      id: `arch_${conn.id}`,
      source: conn.source,
      target: conn.target,
      animated: true,
      style: {
        stroke: edgeColor,
        strokeWidth: isAffected ? 3 : 2.5,
      },
      markerEnd: { type: 'arrowclosed' as const, color: edgeColor },
      label: `${(conn.weight * 100).toFixed(0)}%`,
      labelStyle: { fill: '#60a5fa', fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: '#0d1120', fillOpacity: 0.9 },
    });
  }

  return edges;
}

export function TopologyMap() {
  return (
    <ReactFlowProvider>
      <TopologyMapInner />
    </ReactFlowProvider>
  );
}

function TopologyMapInner() {
  const machines = useAppStore((s) => s.machines);
  const incidents = useAppStore((s) => s.incidents);
  const setSelectedMachineId = useAppStore((s) => s.setSelectedMachineId);
  const customMachines = useAuthStore((s) => s.customMachines);
  const architectConnections = useAuthStore((s) => s.architectConnections);
  const savedMachinePositions = useAuthStore((s) => s.savedMachinePositions);
  const customMachineMetrics = useAuthStore((s) => s.customMachineMetrics);
  const customMachineProfiles = useAuthStore((s) => s.customMachineProfiles);
  const activeTemplate = useAuthStore((s) => {
    const id = s.activeTemplateId;
    return s.templates.find((t) => t.id === id);
  });

  const { fitView } = useReactFlow();
  const prevIncidentCount = useRef(0);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    buildNodes(machines, customMachines, savedMachinePositions, customMachineMetrics, customMachineProfiles)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    buildEdges(machines, incidents, architectConnections, customMachines)
  );

  // Sync nodes when machines, custom machines, or saved positions change
  React.useEffect(() => {
    setNodes(buildNodes(machines, customMachines, savedMachinePositions, customMachineMetrics, customMachineProfiles));
  }, [machines, customMachines, savedMachinePositions, customMachineMetrics, customMachineProfiles, setNodes]);

  // Sync edges when any dependency source changes
  React.useEffect(() => {
    setEdges(buildEdges(machines, incidents, architectConnections, customMachines));
  }, [machines, incidents, architectConnections, customMachines, setEdges]);

  // Auto-focus on new incident (zoom to affected area only — no auto-select/drawer)
  useEffect(() => {
    const activeIncidents = incidents.filter((i) => !i.resolved_at);
    const autoFocus = activeTemplate?.layout.autoFocusIncidents ?? true;
    if (autoFocus && activeIncidents.length > prevIncidentCount.current) {
      // New incident detected — zoom to affected machines
      const affectedIds = new Set(
        activeIncidents.flatMap((i) => [
          i.root_cause_machine_id,
          ...i.affected_machines.map((am) => am.machine_id),
        ])
      );
      const affectedNodeIds = [...affectedIds].filter((id) =>
        nodes.some((n) => n.id === id)
      );
      if (affectedNodeIds.length > 0) {
        setTimeout(() => {
          fitView({
            nodes: affectedNodeIds.map((id) => ({ id })),
            padding: 0.35,
            duration: 800,
          });
          // Do NOT auto-select root cause — operator handles incidents via command panel
        }, 200);
      }
    }
    prevIncidentCount.current = activeIncidents.length;
  }, [incidents, fitView, nodes, activeTemplate]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedMachineId(node.id);
    },
    [setSelectedMachineId]
  );

  return (
    <div className="w-full h-full bg-bg-dark rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e2736" gap={24} size={1} />
        <Controls
          style={{ background: '#1a1f2e', border: '1px solid #2a3040' }}
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(node) => {
            const m = node.data?.machine as MachineState | undefined;
            return STATUS_COLORS[m?.health ?? 'healthy'];
          }}
          style={{ background: '#1a1f2e', border: '1px solid #2a3040' }}
          maskColor="rgba(0,0,0,0.6)"
        />
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-bg-card border border-border-dark rounded-lg px-3 py-2 flex flex-wrap gap-4 text-xs text-text-secondary z-10">
          {[
            { color: '#22c55e', label: 'Healthy' },
            { color: '#f59e0b', label: 'Warning' },
            { color: '#ef4444', label: 'Critical' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5" style={{ background: '#3b82f6' }} />
            <span className="text-text-secondary/70">Custom link</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-critical opacity-70" />
            <span className="text-text-secondary/70">Cascade</span>
          </span>
        </div>
      </ReactFlow>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import type { CustomMachine, DataSourceProtocol } from '../../types';

const MACHINE_TYPES = ['Cooling Unit', 'Filling Machine', 'Capping System', 'Conveyor', 'Storage Unit', 'Compressor', 'Pump Station', 'Heat Exchanger', 'Reactor', 'Custom'];

const PROTOCOL_LABELS: Record<DataSourceProtocol, string> = {
  simulation: '🔵 Simulation Engine',
  opcua: '🟢 OPC-UA',
  mqtt: '🟡 MQTT Broker',
  rest: '🟠 REST API',
  modbus: '🔴 Modbus TCP',
};

interface MachineBuilderProps {
  onNavigate?: (tab: string, machineId?: string) => void;
}

export function MachineBuilder({ onNavigate }: MachineBuilderProps = {}) {
  const customMachines = useAuthStore((s) => s.customMachines);
  const addCustomMachine = useAuthStore((s) => s.addCustomMachine);
  const removeCustomMachine = useAuthStore((s) => s.removeCustomMachine);
  const addDataSource = useAuthStore((s) => s.addDataSource);
  const dataSources = useAuthStore((s) => s.dataSources);
  const updateCustomMachine = useAuthStore((s) => s.updateCustomMachine);
  const updateDataSource = useAuthStore((s) => s.updateDataSource);
  const machines = useAppStore((s) => s.machines);

  const existingMachineIds = Object.keys(machines);
  const allMachineIds = [...existingMachineIds, ...customMachines.map((m) => m.id)];

  const [form, setForm] = useState({
    name: '',
    type: MACHINE_TYPES[0],
    location: '',
    description: '',
    dataSourceProtocol: 'simulation' as DataSourceProtocol,
    dataSourceUrl: '',
    dependsOn: [] as string[],
    posX: 200,
    posY: 300,
    sensors: [] as string[],
  });
  const [sensorInput, setSensorInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [justAdded, setJustAdded] = useState<CustomMachine | null>(null);

  // Selection + edit state for the machine list
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [editSensorInput, setEditSensorInput] = useState('');
  type EditForm = { name: string; type: string; location: string; description: string; dataSourceProtocol: DataSourceProtocol; dataSourceUrl: string; sensors: string[]; dependsOn: string[] };
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  // Populate editForm when a custom machine is selected
  useEffect(() => {
    if (!selectedMachineId) { setEditForm(null); return; }
    const custom = customMachines.find((m) => m.id === selectedMachineId);
    if (custom) {
      const ds = dataSources.find((d) => d.id === custom.dataSourceId);
      setEditForm({
        name: custom.name, type: custom.type, location: custom.location,
        description: custom.description,
        dataSourceProtocol: ds?.protocol ?? 'simulation',
        dataSourceUrl: (ds && ds.protocol !== 'simulation') ? ds.connectionString : '',
        sensors: [...custom.sensors], dependsOn: [...custom.dependsOn],
      });
      setEditSensorInput('');
    } else {
      setEditForm(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachineId]);

  const handleSaveEdit = () => {
    if (!selectedMachineId || !editForm) return;
    const custom = customMachines.find((m) => m.id === selectedMachineId);
    if (!custom) return;
    let dsId = custom.dataSourceId;
    if (editForm.dataSourceProtocol === 'simulation') {
      dsId = 'sim-1';
    } else if (editForm.dataSourceUrl.trim()) {
      const existingDs = dataSources.find((d) => d.id === custom.dataSourceId && d.protocol !== 'simulation');
      if (existingDs) {
        updateDataSource(existingDs.id, { protocol: editForm.dataSourceProtocol, connectionString: editForm.dataSourceUrl.trim() });
        dsId = existingDs.id;
      } else {
        const newId = `ds_${Date.now()}`;
        addDataSource({ id: newId, name: `${editForm.name} — ${editForm.dataSourceProtocol.toUpperCase()}`, protocol: editForm.dataSourceProtocol, connectionString: editForm.dataSourceUrl.trim(), status: 'disconnected' });
        dsId = newId;
      }
    }
    updateCustomMachine(selectedMachineId, {
      name: editForm.name.trim() || custom.name, type: editForm.type,
      location: editForm.location, description: editForm.description,
      sensors: editForm.sensors, dependsOn: editForm.dependsOn, dataSourceId: dsId,
    });
  };

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const id = `custom_${Date.now()}`;
    // Resolve or create a data source
    let dsId: string | null = null;
    if (form.dataSourceProtocol === 'simulation') {
      dsId = 'sim-1';
    } else if (form.dataSourceUrl.trim()) {
      dsId = `ds_${Date.now()}`;
      addDataSource({
        id: dsId,
        name: `${form.name.trim()} — ${form.dataSourceProtocol.toUpperCase()}`,
        protocol: form.dataSourceProtocol,
        connectionString: form.dataSourceUrl.trim(),
        status: 'disconnected',
      });
    }
    const machine: CustomMachine = {
      id,
      name: form.name.trim(),
      type: form.type,
      location: form.location,
      description: form.description,
      position: { x: form.posX, y: form.posY },
      dataSourceId: dsId,
      dependsOn: form.dependsOn,
      sensors: form.sensors,
      addedAt: new Date().toISOString(),
    };
    addCustomMachine(machine);
    setJustAdded(machine);
    setShowForm(false);
    setForm({ name: '', type: MACHINE_TYPES[0], location: '', description: '', dataSourceProtocol: 'simulation', dataSourceUrl: '', dependsOn: [], posX: 200, posY: 300, sensors: [] });
    setSensorInput('');
  };

  const toggleDepend = (id: string) => {
    setForm((f) => ({
      ...f,
      dependsOn: f.dependsOn.includes(id)
        ? f.dependsOn.filter((x) => x !== id)
        : [...f.dependsOn, id],
    }));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-text-primary text-xl font-black">Machine Builder</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-accent-blue/20 border border-accent-blue/40 hover:bg-accent-blue/30 text-accent-blue font-semibold text-sm px-4 py-2 rounded-xl transition-all"
        >
          {showForm ? '✕ Cancel' : '+ Add Machine'}
        </button>
      </div>
      <p className="text-text-secondary text-sm mb-6">
        Add custom machines to the topology map. Connect data sources and define dependencies.
      </p>

      {/* What's Next panel after adding a machine */}
      <AnimatePresence>
        {justAdded && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-[#0f1420] border border-accent-blue/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-healthy font-bold text-sm">✓ {justAdded.name} added to topology!</p>
                <p className="text-text-secondary text-xs mt-0.5">Complete the setup — what would you like to do next?</p>
              </div>
              <button onClick={() => setJustAdded(null)} className="text-text-secondary text-xs hover:text-text-primary">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => onNavigate?.('dependencies', justAdded.id)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-accent-blue/20 bg-accent-blue/8 hover:bg-accent-blue/15 transition-all text-center">
                <span className="text-lg">🔗</span>
                <span className="text-accent-blue text-xs font-bold">Set Dependencies</span>
                <span className="text-text-secondary text-[10px]">Define machine connections &amp; impact</span>
              </button>
              <button onClick={() => onNavigate?.('datasources')}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border-dark hover:border-white/20 bg-bg-dark hover:bg-white/5 transition-all text-center">
                <span className="text-lg">🔌</span>
                <span className="text-text-primary text-xs font-bold">Connect Data Source</span>
                <span className="text-text-secondary text-[10px]">Link telemetry or simulation</span>
              </button>
              <button onClick={() => { setJustAdded(null); onNavigate?.('topology'); }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border-dark hover:border-white/20 bg-bg-dark hover:bg-white/5 transition-all text-center">
                <span className="text-lg">🏗️</span>
                <span className="text-text-primary text-xs font-bold">View in Topology</span>
                <span className="text-text-secondary text-[10px]">See machine on the canvas</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="bg-[#0f1420]/80 border border-accent-blue/20 rounded-2xl p-5 mb-6"
          >
            <h3 className="text-text-primary font-bold mb-4 flex items-center gap-2">
              <span className="text-accent-blue">⚙️</span> New Machine Configuration
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="label-xs">Machine Name *</label>
                <input
                  className="axion-input"
                  placeholder="e.g. Pump Station A"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Type */}
              <div>
                <label className="label-xs">Machine Type</label>
                <select
                  className="axion-input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {MACHINE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="label-xs">Location / Zone</label>
                <input
                  className="axion-input"
                  placeholder="e.g. Hall B, Line 3"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              {/* Data Source Protocol */}
              <div>
                <label className="label-xs">Data Source Protocol</label>
                <select
                  className="axion-input"
                  value={form.dataSourceProtocol}
                  onChange={(e) => setForm({ ...form, dataSourceProtocol: e.target.value as DataSourceProtocol, dataSourceUrl: '' })}
                >
                  {(Object.keys(PROTOCOL_LABELS) as DataSourceProtocol[]).map((p) => (
                    <option key={p} value={p}>{PROTOCOL_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              {/* Connection String — hidden for simulation */}
              {form.dataSourceProtocol !== 'simulation' && (
                <div>
                  <label className="label-xs">Endpoint / Connection String</label>
                  <input
                    className="axion-input"
                    placeholder={
                      form.dataSourceProtocol === 'opcua' ? 'opc.tcp://192.168.1.100:4840' :
                      form.dataSourceProtocol === 'mqtt' ? 'mqtt://broker.local:1883/factory/line1' :
                      form.dataSourceProtocol === 'rest' ? 'https://api.plant.io/machines/pump-a/telemetry' :
                      'TCP:192.168.1.50:502'
                    }
                    value={form.dataSourceUrl}
                    onChange={(e) => setForm({ ...form, dataSourceUrl: e.target.value })}
                  />
                </div>
              )}

              {/* Topology position */}
              <div>
                <label className="label-xs">Topology X Position</label>
                <input
                  type="number"
                  className="axion-input"
                  value={form.posX}
                  onChange={(e) => setForm({ ...form, posX: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-xs">Topology Y Position</label>
                <input
                  type="number"
                  className="axion-input"
                  value={form.posY}
                  onChange={(e) => setForm({ ...form, posY: Number(e.target.value) })}
                />
              </div>

              {/* Sensors */}
              <div className="sm:col-span-2">
                <label className="label-xs">Sensors / Metrics <span className="text-text-secondary/50 font-normal">(press Enter to add)</span></label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-bg-dark border border-border-dark rounded-xl min-h-[36px]">
                  {form.sensors.map((s, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs bg-accent-blue/15 border border-accent-blue/30 text-accent-blue rounded-full px-2 py-0.5">
                      {s}
                      <button type="button" onClick={() => setForm(f => ({ ...f, sensors: f.sensors.filter((_, j) => j !== i) }))} className="hover:text-critical">×</button>
                    </span>
                  ))}
                  <input
                    className="flex-1 min-w-[120px] bg-transparent text-text-primary text-xs outline-none placeholder:text-text-secondary/40"
                    placeholder={form.sensors.length === 0 ? 'e.g. Temperature Sensor, Pressure Gauge…' : 'Add more…'}
                    value={sensorInput}
                    onChange={(e) => setSensorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && sensorInput.trim()) {
                        e.preventDefault();
                        setForm(f => ({ ...f, sensors: [...f.sensors, sensorInput.trim()] }));
                        setSensorInput('');
                      }
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="label-xs">Description / Context</label>
                <textarea
                  className="axion-input resize-none h-16"
                  placeholder="What does this machine do? AI will use this context for summaries..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Dependencies */}
              {allMachineIds.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="label-xs">Depends On (upstream machines)</label>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {allMachineIds.map((id) => {
                      const label = machines[id]?.name ?? customMachines.find((m) => m.id === id)?.name ?? id;
                      const active = form.dependsOn.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleDepend(id)}
                          className={`text-xs px-3 py-1 rounded-full border transition-all font-semibold ${
                            active
                              ? 'bg-accent-blue/20 border-accent-blue/50 text-accent-blue'
                              : 'bg-bg-dark border-border-dark text-text-secondary hover:border-white/30'
                          }`}
                        >
                          {active ? '✓ ' : ''}{label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-text-secondary hover:text-text-primary px-4 py-2 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim()}
                className="bg-accent-blue hover:bg-blue-400 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold text-sm px-5 py-2 rounded-xl transition-all"
              >
                Add to Topology →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Backend machines list ── */}
      {existingMachineIds.length > 0 && (
        <div className="mb-5">
          <h3 className="text-text-secondary text-xs uppercase tracking-wide font-semibold mb-3">
            Backend Machines ({existingMachineIds.length}) <span className="text-text-secondary/40 font-normal normal-case ml-1">— click to inspect</span>
          </h3>
          <div className="space-y-1.5">
            {existingMachineIds.map((id) => {
              const m = machines[id];
              const isSel = selectedMachineId === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedMachineId(isSel ? null : id)}
                  className={`w-full flex items-center gap-3 rounded-xl p-3 transition-all text-left ${
                    isSel
                      ? 'bg-accent-blue/10 border border-accent-blue/40'
                      : 'bg-[#0f1420]/50 border border-white/5 hover:border-white/15 hover:bg-white/3'
                  }`}
                >
                  <div className="w-2 h-2 bg-healthy rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-text-primary text-sm font-semibold">{m?.name ?? id}</span>
                    {m?.type && <span className="ml-2 text-text-secondary text-xs">{m.type}</span>}
                    {m?.location && <span className="ml-1.5 text-text-secondary/50 text-xs">· {m.location}</span>}
                  </div>
                  <span className="text-xs text-text-secondary/40 border border-border-dark px-1.5 py-0.5 rounded-full flex-shrink-0">backend</span>
                  <span className="text-text-secondary/40 text-xs">{isSel ? '▲' : '▼'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Custom machines list ── */}
      {customMachines.length > 0 && (
        <div className="mb-5">
          <h3 className="text-text-secondary text-xs uppercase tracking-wide font-semibold mb-3">
            Custom Machines ({customMachines.length}) <span className="text-text-secondary/40 font-normal normal-case ml-1">— click to edit</span>
          </h3>
          <div className="space-y-1.5">
            {customMachines.map((m) => {
              const ds = dataSources.find((d) => d.id === m.dataSourceId);
              const isSel = selectedMachineId === m.id;
              return (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedMachineId(isSel ? null : m.id)}
                  className={`w-full flex items-center gap-3 rounded-xl p-3 transition-all text-left ${
                    isSel
                      ? 'bg-accent-blue/10 border border-accent-blue/40'
                      : 'bg-[#0f1420]/80 border border-accent-blue/15 hover:border-accent-blue/35'
                  }`}
                >
                  <div className="w-2 h-2 bg-accent-blue rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary text-sm font-semibold">{m.name}</div>
                    <div className="text-text-secondary text-xs truncate">
                      {m.type} · {m.location || 'No location'} · {ds ? PROTOCOL_LABELS[ds.protocol] : '—'}
                    </div>
                  </div>
                  {m.sensors.length > 0 && (
                    <span className="text-xs text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full flex-shrink-0">{m.sensors.length} sensors</span>
                  )}
                  <span className="text-text-secondary/40 text-xs">{isSel ? '▲' : '▼'}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected machine: inline edit / view panel ── */}
      <AnimatePresence>
        {selectedMachineId && (() => {
          const custom = customMachines.find((m) => m.id === selectedMachineId);
          const backend = machines[selectedMachineId];
          return (
            <motion.div
              key={`panel-${selectedMachineId}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-[#080e1c] border border-accent-blue/25 rounded-2xl mb-5 overflow-hidden"
            >
              {custom ? (
                /* ── CUSTOM MACHINE EDIT ── */
                <div>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border-dark">
                    <div>
                      <p className="text-text-primary font-bold text-sm">✏️ Edit: {custom.name}</p>
                      <p className="text-text-secondary text-xs">Custom machine — all fields editable</p>
                    </div>
                    <button onClick={() => setSelectedMachineId(null)} className="text-text-secondary hover:text-text-primary text-xs px-2 py-1">✕</button>
                  </div>
                  {editForm && (
                    <div className="p-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label-xs">Machine Name</label>
                          <input className="axion-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        </div>
                        <div>
                          <label className="label-xs">Machine Type</label>
                          <select className="axion-input" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                            {MACHINE_TYPES.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label-xs">Location / Zone</label>
                          <input className="axion-input" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
                        </div>
                        <div>
                          <label className="label-xs">Data Source Protocol</label>
                          <select className="axion-input" value={editForm.dataSourceProtocol} onChange={(e) => setEditForm({ ...editForm, dataSourceProtocol: e.target.value as DataSourceProtocol, dataSourceUrl: '' })}>
                            {(Object.keys(PROTOCOL_LABELS) as DataSourceProtocol[]).map((p) => (
                              <option key={p} value={p}>{PROTOCOL_LABELS[p]}</option>
                            ))}
                          </select>
                        </div>
                        {editForm.dataSourceProtocol !== 'simulation' && (
                          <div className="sm:col-span-2">
                            <label className="label-xs">Endpoint / Connection String</label>
                            <input className="axion-input font-mono text-xs" placeholder="opc.tcp://… or mqtt://… or https://…" value={editForm.dataSourceUrl} onChange={(e) => setEditForm({ ...editForm, dataSourceUrl: e.target.value })} />
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <label className="label-xs">Sensors / Metrics <span className="text-text-secondary/50 font-normal">(Enter to add)</span></label>
                          <div className="flex flex-wrap gap-1.5 p-2 bg-bg-dark border border-border-dark rounded-xl min-h-[36px]">
                            {editForm.sensors.map((s, i) => (
                              <span key={i} className="flex items-center gap-1 text-xs bg-accent-blue/15 border border-accent-blue/30 text-accent-blue rounded-full px-2 py-0.5">
                                {s}
                                <button type="button" onClick={() => setEditForm((f) => f ? { ...f, sensors: f.sensors.filter((_, j) => j !== i) } : f)} className="hover:text-critical">×</button>
                              </span>
                            ))}
                            <input
                              className="flex-1 min-w-[120px] bg-transparent text-text-primary text-xs outline-none placeholder:text-text-secondary/40"
                              placeholder={editForm.sensors.length === 0 ? 'e.g. Temperature Sensor…' : 'Add more…'}
                              value={editSensorInput}
                              onChange={(e) => setEditSensorInput(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ',') && editSensorInput.trim()) {
                                  e.preventDefault();
                                  setEditForm((f) => f ? { ...f, sensors: [...f.sensors, editSensorInput.trim()] } : f);
                                  setEditSensorInput('');
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="label-xs">Description / AI Context</label>
                          <textarea className="axion-input resize-none h-16" placeholder="What does this machine do? AI uses this for root-cause analysis…" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                        </div>
                        {allMachineIds.filter((id) => id !== selectedMachineId).length > 0 && (
                          <div className="sm:col-span-2">
                            <label className="label-xs">Depends On (upstream machines)</label>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {allMachineIds.filter((id) => id !== selectedMachineId).map((id) => {
                                const label = machines[id]?.name ?? customMachines.find((cm) => cm.id === id)?.name ?? id;
                                const active = editForm.dependsOn.includes(id);
                                return (
                                  <button key={id} type="button"
                                    onClick={() => setEditForm((f) => f ? { ...f, dependsOn: active ? f.dependsOn.filter((x) => x !== id) : [...f.dependsOn, id] } : f)}
                                    className={`text-xs px-3 py-1 rounded-full border transition-all font-semibold ${active ? 'bg-accent-blue/20 border-accent-blue/50 text-accent-blue' : 'bg-bg-dark border-border-dark text-text-secondary hover:border-white/30'}`}
                                  >
                                    {active ? '✓ ' : ''}{label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border-dark">
                        <button
                          onClick={() => { removeCustomMachine(selectedMachineId); setSelectedMachineId(null); }}
                          className="text-xs text-critical border border-critical/30 px-3 py-1.5 rounded-xl hover:bg-critical/10 transition-all"
                        >
                          🗑️ Delete Machine
                        </button>
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedMachineId(null)} className="text-xs text-text-secondary px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all">Cancel</button>
                          <button onClick={handleSaveEdit} className="text-xs font-bold bg-accent-blue text-white px-4 py-1.5 rounded-xl hover:bg-blue-400 transition-all">Save Changes ✓</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : backend ? (
                /* ── BACKEND MACHINE VIEW (read-only) ── */
                <div>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border-dark">
                    <div>
                      <p className="text-text-primary font-bold text-sm">🏭 {backend.name}</p>
                      <p className="text-text-secondary text-xs">Backend-managed machine — read-only</p>
                    </div>
                    <button onClick={() => setSelectedMachineId(null)} className="text-text-secondary hover:text-text-primary text-xs px-2 py-1">✕</button>
                  </div>
                  <div className="p-5 grid sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-text-secondary/50 uppercase tracking-wide text-[10px]">Type</span>
                      <p className="text-text-primary mt-0.5 font-semibold">{backend.type || '—'}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary/50 uppercase tracking-wide text-[10px]">Location</span>
                      <p className="text-text-primary mt-0.5 font-semibold">{backend.location || '—'}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary/50 uppercase tracking-wide text-[10px]">Health Status</span>
                      <p className={`mt-0.5 font-bold uppercase ${backend.health === 'healthy' ? 'text-healthy' : backend.health === 'warning' ? 'text-warning' : 'text-critical'}`}>{backend.health}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary/50 uppercase tracking-wide text-[10px]">Degradation</span>
                      <p className="text-text-primary mt-0.5">{(backend.degradation_factor * 100).toFixed(0)}%</p>
                    </div>
                    {backend.description && (
                      <div className="sm:col-span-2">
                        <span className="text-text-secondary/50 uppercase tracking-wide text-[10px]">Description</span>
                        <p className="text-text-primary mt-0.5 leading-relaxed">{backend.description}</p>
                      </div>
                    )}
                    {backend.metrics.length > 0 && (
                      <div className="sm:col-span-2">
                        <span className="text-text-secondary/50 uppercase tracking-wide text-[10px]">Live Metrics ({backend.metrics.length})</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {backend.metrics.map((metric) => (
                            <span key={metric.key} className="text-[10px] px-2 py-1 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue">
                              <span className="font-semibold">{metric.label}</span>
                              {metric.value != null && <span className="text-accent-blue/70 ml-1">{metric.value.toFixed(1)}{metric.unit}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {backend.dependencies_downstream.length > 0 && (
                      <div className="sm:col-span-2">
                        <span className="text-text-secondary/50 uppercase tracking-wide text-[10px]">Downstream Impact</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {backend.dependencies_downstream.map((dep) => (
                            <span key={dep.machine_id} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-border-dark text-text-secondary">
                              {dep.machine_id} · {(dep.impact_weight * 100).toFixed(0)}% impact
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {customMachines.length === 0 && existingMachineIds.length === 0 && !showForm && (
        <div className="mt-4 text-center py-12 border border-dashed border-border-dark rounded-2xl text-text-secondary/50">
          <p className="text-2xl mb-2">⚙️</p>
          <p className="text-sm">No custom machines added yet</p>
          <p className="text-xs mt-1">Click "Add Machine" to define custom topology nodes</p>
        </div>
      )}
    </div>
  );
}

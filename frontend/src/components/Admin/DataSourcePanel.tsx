import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import type { DataSource, DataSourceProtocol } from '../../types';

const PROTOCOLS: { value: DataSourceProtocol; label: string; port: string; desc: string }[] = [
  { value: 'simulation', label: 'Simulation Engine', port: '8000', desc: 'Built-in WebSocket simulation' },
  { value: 'opcua', label: 'OPC-UA', port: '4840', desc: 'IEC 62541 industrial standard' },
  { value: 'mqtt', label: 'MQTT Broker', port: '1883', desc: 'Lightweight IoT messaging' },
  { value: 'rest', label: 'REST API', port: '80', desc: 'HTTP/HTTPS data polling' },
  { value: 'modbus', label: 'Modbus TCP', port: '502', desc: 'Legacy PLC communication' },
];

const STATUS_COLORS = {
  connected: { bg: 'bg-healthy/10', border: 'border-healthy/30', text: 'text-healthy', dot: 'bg-healthy' },
  disconnected: { bg: 'bg-white/5', border: 'border-border-dark', text: 'text-text-secondary', dot: 'bg-gray-500' },
  error: { bg: 'bg-critical/10', border: 'border-critical/30', text: 'text-critical', dot: 'bg-critical' },
};

export function DataSourcePanel() {
  const dataSources = useAuthStore((s) => s.dataSources);
  const addDataSource = useAuthStore((s) => s.addDataSource);
  const updateDataSource = useAuthStore((s) => s.updateDataSource);
  const removeDataSource = useAuthStore((s) => s.removeDataSource);

  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [selectedDsId, setSelectedDsId] = useState<string | null>(null);
  const [editingDs, setEditingDs] = useState<{ name: string; protocol: DataSourceProtocol; connectionString: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    protocol: 'opcua' as DataSourceProtocol,
    connectionString: '',
  });

  const handleAdd = () => {
    if (!form.name.trim() || !form.connectionString.trim()) return;
    const id = `ds-${Date.now()}`;
    const ds: DataSource = {
      id,
      name: form.name.trim(),
      protocol: form.protocol,
      connectionString: form.connectionString.trim(),
      status: 'disconnected',
    };
    addDataSource(ds);
    setForm({ name: '', protocol: 'opcua', connectionString: '' });
    setShowForm(false);
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    updateDataSource(id, { status: 'disconnected' });
    await new Promise((r) => setTimeout(r, 1200));
    // Simulation always connects; others randomly succeed for demo
    const ds = dataSources.find((d) => d.id === id);
    const success = ds?.protocol === 'simulation' || Math.random() > 0.3;
    updateDataSource(id, { status: success ? 'connected' : 'error' });
    setTesting(null);
  };

  const placeholders: Record<DataSourceProtocol, string> = {
    simulation: 'ws://localhost:8000/ws',
    opcua: 'opc.tcp://192.168.1.10:4840',
    mqtt: 'mqtt://broker.example.com:1883',
    rest: 'https://api.example.com/metrics',
    modbus: '192.168.1.20:502',
  };

  const selectedProto = PROTOCOLS.find((p) => p.value === form.protocol);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-text-primary text-xl font-black">Data Sources</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-healthy/15 border border-healthy/30 hover:bg-healthy/25 text-healthy font-semibold text-sm px-4 py-2 rounded-xl transition-all"
        >
          {showForm ? '✕ Cancel' : '+ Connect Source'}
        </button>
      </div>
      <p className="text-text-secondary text-sm mb-6">
        Define connections to industrial protocols. Test connectivity before assigning to machines.
      </p>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="bg-[#0f1420]/80 border border-healthy/20 rounded-2xl p-5 mb-6"
          >
            <h3 className="text-text-primary font-bold mb-4">New Connection</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-xs">Source Name</label>
                <input
                  className="axion-input"
                  placeholder="e.g. Line 3 OPC-UA Server"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="label-xs">Protocol</label>
                <select
                  className="axion-input"
                  value={form.protocol}
                  onChange={(e) => setForm({ ...form, protocol: e.target.value as DataSourceProtocol })}
                >
                  {PROTOCOLS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} ({p.port})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label-xs">Connection String</label>
                <input
                  className="axion-input font-mono"
                  placeholder={placeholders[form.protocol]}
                  value={form.connectionString}
                  onChange={(e) => setForm({ ...form, connectionString: e.target.value })}
                />
                {selectedProto && (
                  <p className="text-xs text-text-secondary mt-1">
                    {selectedProto.desc} · Default port: {selectedProto.port}
                  </p>
                )}
              </div>
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
                disabled={!form.name.trim() || !form.connectionString.trim()}
                className="bg-healthy/80 hover:bg-healthy disabled:bg-gray-700 disabled:cursor-not-allowed text-bg-dark font-bold text-sm px-5 py-2 rounded-xl transition-all"
              >
                Add Connection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data source list */}
      <div className="space-y-3">
        {dataSources.map((ds) => {
          const col = STATUS_COLORS[ds.status];
          const proto = PROTOCOLS.find((p) => p.value === ds.protocol);
          const isTesting = testing === ds.id;

          return (
            <div key={ds.id}>
              {/* Clickable summary row */}
              <button
                onClick={() => {
                  if (selectedDsId === ds.id) { setSelectedDsId(null); return; }
                  setSelectedDsId(ds.id);
                  setEditingDs({ name: ds.name, protocol: ds.protocol, connectionString: ds.connectionString });
                }}
                className={`w-full text-left ${col.bg} border ${selectedDsId === ds.id ? 'border-accent-blue/50' : col.border} rounded-2xl p-4 transition-all hover:border-accent-blue/30`}
              >
              <div className="flex items-start gap-3">
                <div className={`w-2.5 h-2.5 ${col.dot} rounded-full mt-1.5 flex-shrink-0 ${ds.status === 'connected' ? 'animate-pulse' : ''}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-text-primary font-bold text-sm">{ds.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${col.text} ${col.bg} border ${col.border}`}>
                      {ds.status}
                    </span>
                    <span className="text-xs bg-bg-dark border border-border-dark text-text-secondary px-2 py-0.5 rounded-full">
                      {proto?.label ?? ds.protocol}
                    </span>
                  </div>
                  <p className="text-text-secondary text-xs font-mono mt-1 truncate">{ds.connectionString}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleTest(ds.id)}
                    disabled={!!isTesting}
                    className="text-xs bg-bg-dark border border-border-dark hover:border-white/20 text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                  >
                    {isTesting ? (
                      <span className="w-3 h-3 border border-text-secondary/30 border-t-text-secondary rounded-full animate-spin" />
                    ) : '▶'}
                    Test
                  </button>
                  <span className="text-text-secondary/40 text-xs self-center">{selectedDsId === ds.id ? '▲' : '▼'}</span>
                </div>
              </div>
              </button>

              {/* Inline edit panel */}
              {selectedDsId === ds.id && editingDs && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#080e1c] border border-accent-blue/20 border-t-0 rounded-b-2xl p-4 space-y-3"
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label-xs">Display Name</label>
                      <input
                        className="axion-input"
                        value={editingDs.name}
                        onChange={(e) => setEditingDs({ ...editingDs, name: e.target.value })}
                        disabled={ds.protocol === 'simulation'}
                        style={{ opacity: ds.protocol === 'simulation' ? 0.5 : 1 }}
                      />
                    </div>
                    <div>
                      <label className="label-xs">Protocol</label>
                      <select
                        className="axion-input"
                        value={editingDs.protocol}
                        onChange={(e) => setEditingDs({ ...editingDs, protocol: e.target.value as DataSourceProtocol })}
                        disabled={ds.protocol === 'simulation'}
                        style={{ opacity: ds.protocol === 'simulation' ? 0.5 : 1 }}
                      >
                        {PROTOCOLS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label-xs">Connection String</label>
                      <input
                        className="axion-input font-mono text-xs"
                        value={editingDs.connectionString}
                        onChange={(e) => setEditingDs({ ...editingDs, connectionString: e.target.value })}
                        disabled={ds.protocol === 'simulation'}
                        style={{ opacity: ds.protocol === 'simulation' ? 0.5 : 1 }}
                      />
                    </div>
                  </div>
                  {ds.protocol === 'simulation' && (
                    <p className="text-[10px] text-text-secondary/50 italic">Built-in simulation engine — connection string is read-only.</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    {ds.protocol !== 'simulation' ? (
                      <button
                        onClick={() => { removeDataSource(ds.id); setSelectedDsId(null); }}
                        className="text-xs text-critical border border-critical/30 px-3 py-1.5 rounded-xl hover:bg-critical/10 transition-all"
                      >
                        🗑️ Remove
                      </button>
                    ) : <div />}
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedDsId(null)} className="text-xs text-text-secondary px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all">Cancel</button>
                      {ds.protocol !== 'simulation' && (
                        <button
                          onClick={() => {
                            updateDataSource(ds.id, { name: editingDs.name.trim() || ds.name, protocol: editingDs.protocol, connectionString: editingDs.connectionString.trim() || ds.connectionString });
                            setSelectedDsId(null);
                          }}
                          className="text-xs font-bold text-white bg-healthy/80 hover:bg-healthy px-4 py-1.5 rounded-xl transition-all"
                        >
                          Save ✓
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {dataSources.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border-dark rounded-2xl text-text-secondary/50">
          <p className="text-2xl mb-2">🔌</p>
          <p className="text-sm">No data sources configured</p>
        </div>
      )}

      {/* Protocol info grid */}
      <div className="mt-8">
        <h3 className="text-text-secondary text-xs uppercase tracking-wide font-semibold mb-3">
          Supported Protocols
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROTOCOLS.map((p) => (
            <div key={p.value} className="bg-[#0f1420]/40 border border-white/5 rounded-xl p-3">
              <p className="text-text-primary text-xs font-bold">{p.label}</p>
              <p className="text-text-secondary text-xs mt-0.5">{p.desc}</p>
              <p className="text-accent-blue text-xs mt-1 font-mono">Port {p.port}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

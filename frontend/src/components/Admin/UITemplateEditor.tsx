import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore, DEFAULT_TEMPLATES } from '../../store/useAuthStore';
import type { UITemplateId } from '../../types';

export function UITemplateEditor() {
  const templates = useAuthStore((s) => s.templates);
  const activeTemplateId = useAuthStore((s) => s.activeTemplateId);
  const updateTemplate = useAuthStore((s) => s.updateTemplate);
  const setActiveTemplate = useAuthStore((s) => s.setActiveTemplate);
  const [editingId, setEditingId] = useState<UITemplateId | null>(null);
  const [localGuide, setLocalGuide] = useState('');

  const startEdit = (id: UITemplateId) => {
    const t = templates.find((t) => t.id === id);
    if (t) {
      setLocalGuide(t.aiGuidance);
      setEditingId(id);
    }
  };

  const saveEdit = () => {
    if (editingId) {
      updateTemplate(editingId, { aiGuidance: localGuide });
      setEditingId(null);
    }
  };

  const resetTemplate = (id: UITemplateId) => {
    const def = DEFAULT_TEMPLATES.find((t) => t.id === id);
    if (def) updateTemplate(id, { aiGuidance: def.aiGuidance, layout: def.layout });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-text-primary text-xl font-black mb-1">UI Templates</h2>
      <p className="text-text-secondary text-sm mb-2">
        Define display layouts and AI guidance per role. Templates auto-activate based on system mode.
      </p>
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2.5 text-xs text-purple-300 mb-6 flex items-center gap-2">
        <span>🤖</span>
        <span>The AI Incident Summarizer reads the active template's guidance to tailor its language and focus.</span>
      </div>

      <div className="space-y-4">
        {templates.map((template) => {
          const isActive = template.id === activeTemplateId;
          const isEditing = editingId === template.id;

          return (
            <motion.div
              key={template.id}
              layout
              className={`bg-[#0f1420]/80 border rounded-2xl p-5 transition-all ${
                isActive ? 'border-accent-blue/40 shadow-lg shadow-accent-blue/5' : 'border-white/6'
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-3xl">{template.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-text-primary font-bold">{template.name}</span>
                    {isActive && (
                      <span className="text-xs bg-accent-blue/20 text-accent-blue border border-accent-blue/30 px-2 py-0.5 rounded-full font-bold">
                        ACTIVE
                      </span>
                    )}
                    <span className="text-xs text-text-secondary bg-bg-dark px-2 py-0.5 rounded-full">
                      Auto: {template.autoActivateOn}
                    </span>
                  </div>
                  <p className="text-text-secondary text-xs mt-1">{template.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {template.forRoles.map((r) => (
                      <span key={r} className="text-xs bg-bg-dark border border-border-dark text-text-secondary px-2 py-0.5 rounded-full">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {!isActive && (
                    <button
                      onClick={() => setActiveTemplate(template.id)}
                      className="text-xs bg-accent-blue/15 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/25 px-3 py-1.5 rounded-lg transition-all font-semibold"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => (isEditing ? setEditingId(null) : startEdit(template.id))}
                    className="text-xs bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg transition-all"
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              </div>

              {/* Layout flags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(template.layout).map(([key, val]) => {
                  if (key === 'topologyPriority' || key === 'metricDetail') {
                    return (
                      <span key={key} className="text-xs bg-bg-dark border border-border-dark text-text-secondary px-2 py-0.5 rounded-full">
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}: <strong>{val as string}</strong>
                      </span>
                    );
                  }
                  return (
                    <span
                      key={key}
                      className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                        val
                          ? 'bg-healthy/10 border-healthy/30 text-healthy'
                          : 'bg-white/5 border-border-dark text-text-secondary line-through'
                      }`}
                    >
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </span>
                  );
                })}
              </div>

              {/* AI Guidance - view or edit */}
              {isEditing ? (
                <div className="space-y-3">
                  <label className="text-xs text-purple-400 font-semibold uppercase tracking-wide block">
                    🤖 AI Guidance Prompt
                  </label>
                  <textarea
                    className="w-full bg-bg-dark border border-purple-500/30 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 text-text-primary text-xs rounded-xl px-3 py-2.5 resize-none h-24 outline-none transition-all"
                    value={localGuide}
                    onChange={(e) => setLocalGuide(e.target.value)}
                    placeholder="Tell the AI how to frame its summaries for this template..."
                  />
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => resetTemplate(template.id)}
                      className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      ↺ Reset to default
                    </button>
                    <button
                      onClick={saveEdit}
                      className="text-xs bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 text-purple-300 font-semibold px-4 py-1.5 rounded-lg transition-all"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-bg-dark/60 border border-border-dark rounded-xl px-3 py-2.5">
                  <p className="text-xs text-text-secondary/60 mb-1 font-semibold">AI GUIDANCE</p>
                  <p className="text-xs text-text-secondary italic">"{template.aiGuidance}"</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

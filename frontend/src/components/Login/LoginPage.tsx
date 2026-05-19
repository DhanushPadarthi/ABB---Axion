import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, DEMO_USERS } from '../../store/useAuthStore';
import type { AppRole } from '../../types';

const ROLE_COLORS: Record<AppRole, string> = {
  operator: '#60a5fa',
  engineer: '#34d399',
  manager: '#fb923c',
  architect: '#f472b6',
};

const ROLE_LABELS: Record<AppRole, string> = {
  operator: 'Plant Operator',
  engineer: 'Process Engineer',
  manager: 'Plant Manager',
  architect: 'Systems Architect',
};

const ROLE_TAGLINES: Record<AppRole, string> = {
  operator: 'Live monitoring & rapid incident response',
  engineer: 'Deep telemetry analysis & root-cause diagnostics',
  manager: 'KPI dashboards & business-impact reporting',
  architect: 'Topology design, dependencies & playbooks',
};

const FEATURES = [
  {
    icon: '🧠',
    title: 'Self-explaining systems',
    body: 'Incidents are clustered, traced and explained automatically — not just alarmed.',
  },
  {
    icon: '🕸️',
    title: 'Dependency-aware topology',
    body: 'Cascading failures are mapped across the production line in real time.',
  },
  {
    icon: '⚡',
    title: 'Adaptive role interface',
    body: 'One platform reshapes itself for operators, engineers, managers and architects.',
  },
  {
    icon: '🤖',
    title: 'AI-enriched intelligence',
    body: 'Gemini-powered summaries turn raw telemetry into plain-English actions.',
  },
];

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const loginError = useAuthStore((s) => s.loginError);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const detectedUser = useMemo(() => {
    const u = username.trim().toLowerCase();
    if (!u) return null;
    return DEMO_USERS.find((d) => d.username.toLowerCase() === u) ?? null;
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 450));
    login(username, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-white flex flex-col relative overflow-hidden">
      {/* Background: gradient grid + glow blobs */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #3b82f6 1px, transparent 1px),
            linear-gradient(to bottom, #3b82f6 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 40%, transparent 80%)',
        }}
      />
      <div className="absolute -top-32 -left-32 w-[36rem] h-[36rem] bg-accent-blue/12 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[40rem] h-[40rem] bg-pink-500/8 rounded-full blur-[160px] pointer-events-none" />

      {/* Top brand bar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between px-6 md:px-8 py-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-accent-blue via-blue-500 to-blue-700 rounded-xl flex items-center justify-center font-black text-white text-base shadow-lg shadow-accent-blue/30 ring-1 ring-white/10">
            AX
          </div>
          <div>
            <div className="text-xl font-black tracking-tight leading-none">AXION</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-secondary/80 mt-0.5">
              Industrial Intelligence Platform
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] text-text-secondary bg-white/[0.03] border border-white/8 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-healthy animate-pulse" />
          Simulation Engine Online · 5 machines streaming
        </div>

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-secondary">
          <span className="hidden md:inline">Built for</span>
          <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-red-500/15 to-orange-500/15 border border-red-500/25 text-orange-300 font-bold">
            ABB Accelerator · 2025
          </span>
        </div>
      </motion.header>

      {/* Main split */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 px-6 md:px-8 pb-8 max-w-7xl w-full mx-auto items-center">
        {/* LEFT — Branding & vision */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden lg:block"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/25 text-accent-blue text-[11px] font-semibold uppercase tracking-wider mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
            The operating layer for smart factories
          </div>

          <h1 className="text-5xl xl:text-6xl font-black tracking-tight leading-[1.05] mb-5">
            Industrial systems that{' '}
            <span className="bg-gradient-to-r from-accent-blue via-blue-300 to-cyan-300 text-transparent bg-clip-text">
              explain themselves.
            </span>
          </h1>

          <p className="text-text-secondary text-base leading-relaxed mb-8 max-w-xl">
            AXION turns plant-floor telemetry into clear, actionable intelligence — replacing alarm
            walls with a single adaptive interface that traces root cause, predicts impact, and
            recommends action.
          </p>

          <div className="grid grid-cols-2 gap-3 max-w-xl">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="bg-white/[0.025] border border-white/8 rounded-xl p-3 hover:border-white/16 hover:bg-white/[0.04] transition-all"
              >
                <div className="text-xl mb-1.5">{f.icon}</div>
                <div className="text-[13px] font-bold text-text-primary mb-1">{f.title}</div>
                <p className="text-[11px] text-text-secondary leading-snug">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* RIGHT — Sign in card */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto"
        >
          <div className="relative">
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-accent-blue/30 via-transparent to-pink-500/20 blur-md opacity-60 pointer-events-none" />

            <div className="relative bg-[#0d1220]/85 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl shadow-black/40">
              <div className="mb-6">
                <h2 className="text-2xl font-black tracking-tight">Sign in</h2>
                <p className="text-text-secondary text-sm mt-1">
                  Access your AXION operational workspace.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username */}
                <div>
                  <label className="text-[11px] text-text-secondary uppercase tracking-wider mb-1.5 block font-semibold">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your username"
                    autoComplete="username"
                    autoFocus
                    className="w-full bg-bg-dark/80 border border-border-dark rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-secondary/40 focus:outline-none focus:border-accent-blue/60 focus:ring-2 focus:ring-accent-blue/20 transition-all"
                  />

                  <AnimatePresence>
                    {detectedUser && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 border"
                          style={{
                            background: `${ROLE_COLORS[detectedUser.role]}10`,
                            borderColor: `${ROLE_COLORS[detectedUser.role]}35`,
                          }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                            style={{
                              background: `${ROLE_COLORS[detectedUser.role]}20`,
                              border: `1px solid ${ROLE_COLORS[detectedUser.role]}40`,
                            }}
                          >
                            {detectedUser.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-text-primary text-sm font-bold truncate">
                                {detectedUser.name}
                              </span>
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider"
                                style={{
                                  color: ROLE_COLORS[detectedUser.role],
                                  background: `${ROLE_COLORS[detectedUser.role]}22`,
                                }}
                              >
                                {ROLE_LABELS[detectedUser.role]}
                              </span>
                            </div>
                            <div className="text-[11px] text-text-secondary truncate mt-0.5">
                              {ROLE_TAGLINES[detectedUser.role]}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Password */}
                <div>
                  <label className="text-[11px] text-text-secondary uppercase tracking-wider mb-1.5 block font-semibold">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="w-full bg-bg-dark/80 border border-border-dark rounded-xl px-4 py-3 pr-11 text-text-primary text-sm placeholder:text-text-secondary/40 focus:outline-none focus:border-accent-blue/60 focus:ring-2 focus:ring-accent-blue/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary text-sm transition-colors"
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {loginError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-critical/12 border border-critical/30 text-critical text-xs rounded-lg px-3 py-2 flex items-center gap-2"
                    >
                      <span>⚠️</span>
                      <span>{loginError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading || !username || !password}
                  className="w-full bg-gradient-to-r from-accent-blue via-blue-500 to-blue-600 hover:from-blue-400 hover:via-blue-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-accent-blue/25 ring-1 ring-white/10"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="text-sm">Signing in…</span>
                    </>
                  ) : (
                    <>
                      <span>{detectedUser ? `Sign in as ${ROLE_LABELS[detectedUser.role]}` : 'Sign in'}</span>
                      <span className="text-base leading-none">→</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/8 flex items-center justify-between gap-3">
                <p className="text-[11px] text-text-secondary leading-snug">
                  Secured session · SSO ready
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-text-secondary uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-healthy animate-pulse" />
                  Backend live
                </div>
              </div>
            </div>
          </div>

          <p className="lg:hidden text-center text-text-secondary text-xs mt-6 max-w-sm mx-auto">
            Industrial systems that explain themselves — AXION turns telemetry into clear,
            actionable intelligence.
          </p>
        </motion.div>
      </main>

      <footer className="relative z-10 px-6 md:px-8 py-4 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-text-secondary/60">
        <span>AXION v1.0 · © 2025 ABB Accelerator Hackathon</span>
        <span>Confidential — Demo Environment</span>
      </footer>
    </div>
  );
}

/**
 * useCustomMachineSimulator
 *
 * For each architect-added custom machine that lives only in the Zustand store
 * (i.e. not part of the backend FactoryState), this hook:
 *   1. On first sight, fetches AI-suggested sensor profiles from the backend
 *      (`/api/ai/suggest-profile`). The backend uses Gemini if configured,
 *      otherwise a deterministic heuristic — so this always returns something.
 *   2. Ticks every ~1.5s and produces plausible drifting values for each
 *      sensor against its profile, writing them into
 *      `useAuthStore.customMachineMetrics[machineId][sensorLabel]`.
 *
 * Consumers (MachineNode, MetricCards, MachineDetailDrawer) read those
 * live values to show the custom machine just like real backend machines.
 */
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { CustomSensorProfile } from '../store/useAuthStore';

const TICK_MS = 1500;
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000';

type Profile = CustomSensorProfile;
type Status = 'healthy' | 'warning' | 'critical';

function statusFor(value: number, p: Profile): Status {
  // For ascending-bad metrics (warn < crit), high values are bad.
  // For descending-bad metrics (warn > crit, e.g. efficiency), low values are bad.
  const warn = p.warn;
  const crit = p.crit;
  if (warn == null || crit == null) return 'healthy';
  if (warn < crit) {
    if (value >= crit) return 'critical';
    if (value >= warn) return 'warning';
  } else {
    if (value <= crit) return 'critical';
    if (value <= warn) return 'warning';
  }
  return 'healthy';
}

function nextValue(prev: number, p: Profile): number {
  if (p.kind === 'status') {
    // Status: flip with ~5% chance
    if (Math.random() < 0.05) return prev > 0.5 ? 0 : 1;
    return prev;
  }
  // Gentle drift toward base with gaussian noise + occasional excursion
  const span = Math.max(1e-6, p.max - p.min);
  const noiseAmp = span * 0.015;
  const noise = (Math.random() + Math.random() + Math.random() - 1.5) * noiseAmp;
  const gravity = (p.base - prev) * 0.06;

  // 3% chance of a small excursion toward warn boundary (keeps demo interesting)
  let excursion = 0;
  if (Math.random() < 0.03 && p.warn != null) {
    excursion = (p.warn - prev) * 0.25;
  }

  let v = prev + gravity + noise + excursion;
  v = Math.max(p.min, Math.min(p.max, v));
  return v;
}

function roundFor(value: number, p: Profile): number {
  const span = p.max - p.min;
  if (p.kind === 'status') return Math.round(value);
  if (span >= 200) return Math.round(value);
  if (span >= 20) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

export function useCustomMachineSimulator() {
  const customMachines = useAuthStore((s) => s.customMachines);
  const profiles = useAuthStore((s) => s.customMachineProfiles);
  const setProfile = useAuthStore((s) => s.setCustomMachineProfile);
  const setMetrics = useAuthStore((s) => s.setCustomMachineMetrics);

  // Track in-flight profile fetches to avoid duplicate calls
  const fetchingRef = useRef<Set<string>>(new Set());

  // 1) Ensure each custom machine has an AI-suggested profile
  useEffect(() => {
    customMachines.forEach((m) => {
      if (profiles[m.id]) return;
      if (fetchingRef.current.has(m.id)) return;
      if (!m.sensors || m.sensors.length === 0) {
        // No sensors — store an empty profile so we don't keep checking
        setProfile(m.id, {});
        return;
      }
      fetchingRef.current.add(m.id);

      if (!API_BASE) {
        // No backend in offline/Vercel mode — store empty profile
        setProfile(m.id, {});
        fetchingRef.current.delete(m.id);
        return;
      }

      fetch(`${API_BASE}/api/ai/suggest-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: m.sensors }),
      })
        .then((r) => r.json())
        .then((data) => {
          const arr: Array<{ label: string } & Profile> = data?.profiles ?? [];
          const map: Record<string, Profile> = {};
          arr.forEach((entry) => {
            if (!entry?.label) return;
            map[entry.label] = {
              min: Number(entry.min ?? 0),
              max: Number(entry.max ?? 100),
              warn: entry.warn == null ? null : Number(entry.warn),
              crit: entry.crit == null ? null : Number(entry.crit),
              base: Number(entry.base ?? 0),
              unit: String(entry.unit ?? ''),
              kind: (entry.kind ?? 'line') as Profile['kind'],
            };
          });
          // Backfill heuristic locally for any missing labels
          m.sensors.forEach((label) => {
            if (!map[label]) {
              map[label] = {
                min: 0, max: 100, warn: 80, crit: 90, base: 50, unit: '', kind: 'line',
              };
            }
          });
          setProfile(m.id, map);
        })
        .catch(() => {
          // Backend unreachable — fall back to pure local heuristic
          const map: Record<string, Profile> = {};
          m.sensors.forEach((label) => {
            map[label] = { min: 0, max: 100, warn: 80, crit: 90, base: 50, unit: '', kind: 'line' };
          });
          setProfile(m.id, map);
        })
        .finally(() => {
          fetchingRef.current.delete(m.id);
        });
    });
  }, [customMachines, profiles, setProfile]);

  // 2) Tick — generate fresh values for every machine that has a profile
  useEffect(() => {
    if (customMachines.length === 0) return;
    const tick = () => {
      const state = useAuthStore.getState();
      state.customMachines.forEach((m) => {
        const p = state.customMachineProfiles[m.id];
        if (!p) return;
        const prev = state.customMachineMetrics[m.id] ?? {};
        const next: Record<string, { value: number; status: Status }> = {};
        m.sensors.forEach((label) => {
          const profile = p[label];
          if (!profile) return;
          const prevVal = prev[label]?.value ?? profile.base;
          const raw = nextValue(prevVal, profile);
          const rounded = roundFor(raw, profile);
          next[label] = { value: rounded, status: statusFor(raw, profile) };
        });
        if (Object.keys(next).length > 0) {
          state.setCustomMachineMetrics(m.id, next);
        }
      });
    };
    // Run an immediate tick so values appear without delay
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [customMachines.length, setMetrics]);
}

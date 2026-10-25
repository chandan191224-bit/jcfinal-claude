import { useCallback, useState } from "react";

type Hist<T> = { present: T; past: T[]; future: T[]; tag: string; at: number };

/**
 * Project state with undo/redo. Updates that share a `tag` within a short time (one drag, one
 * slider move) merge into a single undo step.
 */
export function useHistory<T>(initial: () => T) {
  const [h, setH] = useState<Hist<T>>(() => ({ present: initial(), past: [], future: [], tag: "", at: 0 }));
  const update = useCallback((fn: (p: T) => T, tag = "") => {
    setH((s) => {
      const next = fn(s.present);
      if (next === s.present) return s;
      const now = Date.now();
      const merge = tag !== "" && tag === s.tag && now - s.at < 1200;
      return { present: next, past: merge ? s.past : [...s.past.slice(-150), s.present], future: [], tag, at: now };
    });
  }, []);
  const undo = useCallback(() => {
    setH((s) => (s.past.length ? { present: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.present, ...s.future], tag: "", at: 0 } : s));
  }, []);
  const redo = useCallback(() => {
    setH((s) => (s.future.length ? { present: s.future[0], past: [...s.past, s.present], future: s.future.slice(1), tag: "", at: 0 } : s));
  }, []);
  const reset = useCallback((p: T) => setH({ present: p, past: [], future: [], tag: "", at: 0 }), []);
  return { value: h.present, update, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}

export const storage = {
  get<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the project still lives in memory and on the server.
    }
  },
};

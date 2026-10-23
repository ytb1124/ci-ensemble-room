import { useSyncExternalStore } from 'react';
import type { ProbeResponse, Reflection } from '../types';
import { KEYS, createStore, readJSON, writeJSON } from './storage';

export interface ProbeState {
  responses: ProbeResponse[];
  reflections: Reflection[];
  /** 끝낸 세트 */
  completedSets: (1 | 2)[];
  /** 연습 문항을 해 봤는지(첫 회 학습 효과, 6.3절) */
  practiced: boolean;
}

const EMPTY: ProbeState = { responses: [], reflections: [], completedSets: [], practiced: false };

export const probeStore = createStore<ProbeState>(
  { ...EMPTY, ...readJSON<Partial<ProbeState>>(KEYS.probe, {}) },
  (v) => writeJSON(KEYS.probe, v),
);

export function useProbeState(): ProbeState {
  return useSyncExternalStore(probeStore.subscribe, probeStore.get);
}

export function addProbeResponse(r: ProbeResponse) {
  // 같은 세트·문항을 다시 하면 덮어쓴다(다시 들어 보기)
  probeStore.set((s) => ({
    ...s,
    responses: [...s.responses.filter((x) => !(x.set === r.set && x.itemId === r.itemId)), r],
  }));
}

export function addReflection(r: Reflection) {
  probeStore.set((s) => ({ ...s, reflections: [...s.reflections.filter((x) => x.set !== r.set), r] }));
}

export function reviseReflection(set: 1 | 2, revised: string | null) {
  probeStore.set((s) => ({
    ...s,
    reflections: s.reflections.map((x) => (x.set === set ? { ...x, revised } : x)),
  }));
}

export function completeSet(set: 1 | 2) {
  probeStore.set((s) => ({
    ...s,
    completedSets: s.completedSets.includes(set) ? s.completedSets : [...s.completedSets, set],
  }));
}

export function markPracticed() {
  probeStore.set((s) => ({ ...s, practiced: true }));
}

export function clearProbe() {
  probeStore.set({ ...EMPTY });
}

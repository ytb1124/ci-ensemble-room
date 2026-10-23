import { useSyncExternalStore } from 'react';
import type { InstrumentId, Profile, SongId } from '../types';
import { KEYS, createStore, readJSON, writeJSON } from './storage';

export const DEFAULT_PROFILE: Profile = {
  schema: 1,
  calibVersion: 0,
  updatedAt: null,
  config: null,
  route: null,
  maker: null,
  masterGainDb: 0,
  stereo: false,
  balance: 0,
  spread: false,
  eqLowDb: 0,
  eqMidDb: 0,
  eqMidHz: 1700,
  instGainDb: { cajon: 0, bass: 0, trumpet: 0 },
  allowPlus12: false,
  bassAssist: 'none',
  bassVizEmphasis: false,
  soloLoudnessMatch: true,
  songOverrides: {},
  viz: { defaultView: 'lanes', pitchLines: true, motion: 'calm', listenFirst: true, theme: 'system' },
  sync: { userOffsetMs: 0, method: 'auto', calibratedAt: null },
  history: [],
  audioUnlocked: false,
  calibrated: false,
  calibStepsDone: [],
  placeholderShape: 'rhythm',
};

function load(): Profile {
  const saved = readJSON<Partial<Profile>>(KEYS.profile, {});
  return {
    ...DEFAULT_PROFILE,
    ...saved,
    instGainDb: { ...DEFAULT_PROFILE.instGainDb, ...(saved.instGainDb ?? {}) },
    viz: { ...DEFAULT_PROFILE.viz, ...(saved.viz ?? {}) },
    sync: { ...DEFAULT_PROFILE.sync, ...(saved.sync ?? {}) },
    // audioUnlocked는 페이지를 새로 열면 항상 다시 잠긴다
    audioUnlocked: false,
  };
}

export const profileStore = createStore<Profile>(load(), (p) => writeJSON(KEYS.profile, p));

export function useProfile(): Profile {
  return useSyncExternalStore(profileStore.subscribe, profileStore.get);
}

/** 일반 갱신(updatedAt 기록) */
export function updateProfile(patch: Partial<Profile> | ((p: Profile) => Partial<Profile>)) {
  profileStore.set((p) => {
    const delta = typeof patch === 'function' ? patch(p) : patch;
    return { ...p, ...delta, updatedAt: new Date().toISOString() };
  });
}

/**
 * 보정 값을 바꿀 때 쓴다. 바뀐 키를 history에 남기고 calibVersion을 올린다(4.3절).
 * 리포트에서 "설정을 이렇게 바꿨어요"로 보여 준다(평가하지 않음).
 */
export function commitCalibration(patch: Partial<Profile>) {
  profileStore.set((p) => {
    const changed = Object.keys(patch).filter(
      (k) => JSON.stringify((p as unknown as Record<string, unknown>)[k]) !== JSON.stringify((patch as Record<string, unknown>)[k]),
    );
    const now = new Date().toISOString();
    const next = { ...p, ...patch, updatedAt: now };
    if (changed.length) {
      next.calibVersion = p.calibVersion + 1;
      next.history = [...p.history, { calibVersion: next.calibVersion, at: now, changed }].slice(-50);
    }
    return next;
  });
}

export function markCalibStep(step: number) {
  profileStore.set((p) =>
    p.calibStepsDone.includes(step) ? p : { ...p, calibStepsDone: [...p.calibStepsDone, step].sort() },
  );
}

/** 곡별 믹스가 있으면 그것을, 없으면 프로필 값(4.4절) */
export function effectiveInstGain(p: Profile, song: SongId | null): Record<InstrumentId, number> {
  if (song && p.songOverrides[song]) return p.songOverrides[song]!.instGainDb;
  return p.instGainDb;
}

export function resetProfile() {
  profileStore.set({ ...DEFAULT_PROFILE });
}

/** 악기 크기 허용 범위 (4.2절): 기본 −12 ~ +6, 설정 시 +12 */
export function gainRange(p: Profile): { min: number; max: number; step: number } {
  return { min: -12, max: p.allowPlus12 ? 12 : 6, step: 2 };
}

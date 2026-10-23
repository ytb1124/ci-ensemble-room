import { useSyncExternalStore } from 'react';
import type { CardAnswer, InstrumentId, LogEvent, SongId } from '../types';
import { INSTRUMENTS } from '../types';
import { KEYS, createStore, readJSON, writeJSON } from './storage';

// 이벤트 로그(구성안 5.4절). 기기 안에만 저장한다. 최근 N개만 보관.
const MAX_EVENTS = 3000;

export const logStore = createStore<LogEvent[]>(readJSON<LogEvent[]>(KEYS.log, []), (v) =>
  writeJSON(KEYS.log, v.slice(-MAX_EVENTS)),
);

// 거리가 없는 객체 리터럴에도 type을 좁히기 위한 분배 Omit
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export function logEvent(e: DistributiveOmit<LogEvent, 't'>) {
  logStore.set((prev) => [...prev, { ...e, t: Date.now() } as LogEvent].slice(-MAX_EVENTS));
}

export function useLog(): LogEvent[] {
  return useSyncExternalStore(logStore.subscribe, logStore.get);
}

export function clearLog() {
  logStore.set([]);
}

export interface LogSummary {
  /** 악기별 솔로 누적 시간(초) */
  soloSeconds: Record<InstrumentId, number>;
  /** 악기별 순 볼륨 변화(dB) */
  netGainDb: Record<InstrumentId, number>;
  alternateCount: Record<InstrumentId, number>;
  /** 재생 중 시각화를 켠 시간 비율(0–1). 재생이 없으면 null */
  vizOnRatio: number | null;
  cardAnswers: Record<string, CardAnswer[]>;
  playCount: number;
}

/**
 * 리포트용 집계(5.4절). 솔로 시간은 solo 이벤트부터 다음 solo/unsolo/pause/toggle까지,
 * 그리고 같은 곡 위치가 아닌 벽시계 기준으로 센다(추론: 일시정지 중은 제외).
 */
export function summarizeLog(events: LogEvent[], song?: SongId): LogSummary {
  const soloSeconds = Object.fromEntries(INSTRUMENTS.map((i) => [i, 0])) as Record<InstrumentId, number>;
  const netGainDb = Object.fromEntries(INSTRUMENTS.map((i) => [i, 0])) as Record<InstrumentId, number>;
  const alternateCount = Object.fromEntries(INSTRUMENTS.map((i) => [i, 0])) as Record<InstrumentId, number>;
  const cardAnswers: Record<string, CardAnswer[]> = {};
  let playCount = 0;

  let playing = false;
  let soloInst: InstrumentId | null = null;
  let soloSince = 0;
  let view = 'off';
  let lastT = 0;
  let playMs = 0;
  let vizMs = 0;

  const flushSolo = (t: number) => {
    if (soloInst && playing) soloSeconds[soloInst] += (t - soloSince) / 1000;
    soloSince = t;
  };
  const tick = (t: number) => {
    if (playing && lastT) {
      playMs += t - lastT;
      if (view !== 'off') vizMs += t - lastT;
    }
    lastT = t;
  };

  for (const e of events) {
    if (song && 'song' in e && e.song !== song) continue;
    tick(e.t);
    switch (e.type) {
      case 'play':
        playCount++;
        flushSolo(e.t);
        playing = true;
        break;
      case 'pause':
        flushSolo(e.t);
        playing = false;
        break;
      case 'solo':
        flushSolo(e.t);
        soloInst = e.instrument;
        break;
      case 'unsolo':
      case 'toggle':
        flushSolo(e.t);
        soloInst = null;
        break;
      case 'gain':
        netGainDb[e.instrument] += e.toDb - e.fromDb;
        break;
      case 'alternate':
        alternateCount[e.instrument]++;
        break;
      case 'view':
        view = e.value;
        break;
      case 'card':
        (cardAnswers[e.cardId] ??= []).push(e.answer);
        break;
    }
  }
  return {
    soloSeconds,
    netGainDb,
    alternateCount,
    vizOnRatio: playMs > 0 ? vizMs / playMs : null,
    cardAnswers,
    playCount,
  };
}

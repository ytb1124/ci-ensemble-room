// 스템 타임라인: RMS(10 ms 간격)와 온셋. 구성안 7.4절의 "미리 분석한 타임라인".
// 실제 녹음은 오프라인 JSON(timelineUrl)을 쓰는 것이 원칙이고, 없으면 여기서 버퍼를 직접 분석한다.

import type { OnsetKind } from './placeholder';

export interface Onset {
  t: number; // 초
  strength: number; // 0–1
  kind?: OnsetKind;
  /** 음 길이(초, 알 때만) */
  dur?: number;
}

export interface Timeline {
  hop: number; // 초
  rms: Float32Array; // 0–1로 정규화된 RMS
  rmsDb: Float32Array; // 원래 dBFS
  onsets: Onset[];
  /** 상대 음높이(0–1). 자리표시에는 음높이가 없으므로 null */
  pitch: Float32Array | null;
  peakDb: number;
  loudnessDb: number; // 전체 RMS dBFS (LUFS 대용 근사)
}

export const HOP = 0.01;

export function analyzeBuffer(data: Float32Array, sampleRate: number, knownOnsets?: Onset[]): Timeline {
  const hopN = Math.max(1, Math.round(HOP * sampleRate));
  const frames = Math.ceil(data.length / hopN);
  const rmsDb = new Float32Array(frames);
  const raw = new Float32Array(frames);
  let peak = 0;
  let sumSq = 0;
  let active = 0;
  for (let f = 0; f < frames; f++) {
    let s = 0;
    const i0 = f * hopN;
    const i1 = Math.min(data.length, i0 + hopN);
    for (let i = i0; i < i1; i++) {
      const v = data[i];
      s += v * v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    const r = Math.sqrt(s / Math.max(1, i1 - i0));
    raw[f] = r;
    rmsDb[f] = 20 * Math.log10(r + 1e-9);
    if (rmsDb[f] > -60) {
      sumSq += s;
      active += i1 - i0;
    }
  }
  let maxR = 0;
  for (let f = 0; f < frames; f++) if (raw[f] > maxR) maxR = raw[f];
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) rms[f] = maxR > 0 ? raw[f] / maxR : 0;

  const onsets = knownOnsets ?? detectOnsets(rmsDb);
  return {
    hop: HOP,
    rms,
    rmsDb,
    onsets,
    pitch: null,
    peakDb: 20 * Math.log10(peak + 1e-9),
    loudnessDb: 10 * Math.log10(sumSq / Math.max(1, active) + 1e-12),
  };
}

/** 단순 에너지 증가 온셋 검출(실제 녹음 + JSON 없음일 때의 대체 수단) */
function detectOnsets(rmsDb: Float32Array): Onset[] {
  const out: Onset[] = [];
  let last = -1;
  for (let f = 2; f < rmsDb.length; f++) {
    const rise = rmsDb[f] - rmsDb[f - 2];
    if (rise > 9 && rmsDb[f] > -45 && f - last > 8) {
      out.push({ t: f * HOP, strength: Math.min(1, (rmsDb[f] + 45) / 40) });
      last = f;
    }
  }
  return out;
}

export function rmsAt(tl: Timeline | undefined, t: number): number {
  if (!tl || t < 0) return 0;
  const f = Math.floor(t / tl.hop);
  if (f >= tl.rms.length) return 0;
  return tl.rms[f];
}

/** 외부 JSON 타임라인(구성안 8.2절 tl_*.json)을 읽는다. 형식: { hop, rms:number[], onsets:[{t,strength,kind?}], pitch?:number[] } */
export async function fetchTimeline(url: string): Promise<Partial<Timeline> | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    return {
      hop: j.hop ?? HOP,
      rms: j.rms ? Float32Array.from(j.rms) : undefined,
      onsets: j.onsets ?? undefined,
      pitch: j.pitch ? Float32Array.from(j.pitch) : null,
    };
  } catch {
    return null;
  }
}

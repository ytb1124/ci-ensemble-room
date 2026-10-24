// 핑크노이즈 자리표시 스템.
// 실제 사운드 샘플이나 합성 멜로디는 만들지 않는다. 악기마다 독립된 핑크노이즈를 쓰고,
// (기본값 rhythm) 편곡안의 박 패턴(구성안 5.3절)에 맞춰 크기만 끊어 준다. 음높이는 없다.
// steady를 고르면 박 없이 계속 나는 핑크노이즈가 된다.

import type { SongConfig } from '../config/songs';
import type { PlaceholderShape, StemId } from '../types';

export type OnsetKind = 'bassTone' | 'slap' | 'pluck' | 'note' | 'chord';

export interface ScoreNote {
  beat: number;
  dur: number; // 박
  vel: number; // 0–1
  kind: OnsetKind;
}

/** 편곡 시작점(구성안 5.3절)을 박 단위 리듬으로만 옮긴 것. 음높이 정보는 없다 */
export function placeholderScore(song: SongConfig): Record<StemId, ScoreNote[]> {
  return song.meter === 3 ? scoreHbd() : score44(song);
}

function scoreHbd(): Record<StemId, ScoreNote[]> {
  // 3/4. 마디 b는 박 3b에서 시작. 마디 0 = 카혼 예비박, 그 3박째에 선율 여린박.
  const cajon: ScoreNote[] = [];
  const bass: ScoreNote[] = [];
  const trumpet: ScoreNote[] = [];
  const piano: ScoreNote[] = [];
  const BARS = 17; // 예비박 1 + 선율 8마디 × 2회
  for (let b = 0; b < BARS; b++) {
    cajon.push({ beat: 3 * b, dur: 1, vel: 1, kind: 'bassTone' }); // 1박 베이스 톤
    cajon.push({ beat: 3 * b + 1, dur: 1, vel: 0.8, kind: 'slap' }); // 2·3박 슬랩 톤
    cajon.push({ beat: 3 * b + 2, dur: 1, vel: 0.8, kind: 'slap' });
    if (b > 0) {
      bass.push({ beat: 3 * b, dur: 2, vel: 1, kind: 'pluck' }); // 첫 박 근음
      bass.push({ beat: 3 * b + 2, dur: 1, vel: 0.65, kind: 'pluck' }); // 3박 5음(선택)
      piano.push({ beat: 3 * b + 1, dur: 1, vel: 0.75, kind: 'chord' }); // 2·3박 화음(쿵-짝-짝의 짝짝)
      piano.push({ beat: 3 * b + 2, dur: 1, vel: 0.75, kind: 'chord' });
    }
  }
  // 선율 리듬(한 회). 마디 기준 상대 박, 길이
  const pickup: [number, number][] = [
    [2, 0.75],
    [2.75, 0.25],
  ];
  const pass: [number, number][][] = [
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], ...pickup],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], ...pickup],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 1], [1, 1], ...pickup],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 3]],
  ];
  const addPass = (firstBar: number, last: boolean) => {
    pass.forEach((bar, i) => {
      let notes = bar;
      if (i === 7 && !last) notes = [[0, 2], ...pickup]; // 2회차 여린박으로 이어짐
      notes.forEach(([o, d]) => trumpet.push({ beat: 3 * (firstBar + i) + o, dur: d, vel: 1, kind: 'note' }));
    });
  };
  pickup.forEach(([o, d]) => trumpet.push({ beat: o, dur: d, vel: 1, kind: 'note' }));
  addPass(1, false);
  addPass(9, true);
  return { piano, cajon, bass, trumpet, bassOct: bass.map((n) => ({ ...n })) };
}

function score44(song: SongConfig): Record<StemId, ScoreNote[]> {
  // 곡 2는 미정. 구성안의 4/4 카혼·베이스 패턴만 쓰고, 트럼펫은 줄마다 고른 4분음표 자리표시(임시)다.
  const cajon: ScoreNote[] = [];
  const bass: ScoreNote[] = [];
  const trumpet: ScoreNote[] = [];
  const piano: ScoreNote[] = [];
  const lastBeat = song.lines[song.lines.length - 1].endBeat;
  const BARS = Math.ceil(lastBeat / 4);
  for (let b = 0; b < BARS; b++) {
    const s = 4 * b;
    cajon.push({ beat: s, dur: 1, vel: 1, kind: 'bassTone' });
    cajon.push({ beat: s + 1, dur: 1, vel: 0.8, kind: 'slap' });
    cajon.push({ beat: s + 2, dur: 1, vel: 1, kind: 'bassTone' });
    cajon.push({ beat: s + 3, dur: 1, vel: 0.8, kind: 'slap' });
    if (b > 0) {
      bass.push({ beat: s, dur: 2, vel: 1, kind: 'pluck' });
      bass.push({ beat: s + 2, dur: 2, vel: 0.8, kind: 'pluck' });
      piano.push({ beat: s + 1, dur: 1, vel: 0.75, kind: 'chord' }); // 2·4박 화음
      piano.push({ beat: s + 3, dur: 1, vel: 0.75, kind: 'chord' });
    }
  }
  for (const line of song.lines) {
    for (let beat = line.startBeat; beat < line.endBeat; beat++) {
      const lineEnd = beat >= line.endBeat - 2;
      if (lineEnd && beat === line.endBeat - 1) continue; // 줄 끝 2박 길게
      trumpet.push({ beat, dur: lineEnd ? 2 : 1, vel: 1, kind: 'note' });
    }
  }
  return { piano, cajon, bass, trumpet, bassOct: bass.map((n) => ({ ...n })) };
}

// ───────── 핑크노이즈 ─────────

/** 결정적 의사난수(악기마다 다른 씨앗) */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** Paul Kellet 정밀 핑크 필터(−3 dB/oct) */
export function fillPinkNoise(out: Float32Array, seed: number) {
  const rand = rng(seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rand();
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
}

export interface EnvelopeOpts {
  /** 단서 질문 '시작 소리' 편집본: 온셋을 부드럽게(구성안 6.2절) */
  softAttack?: boolean;
  /** 단서 질문 '시작 소리 강조' 편집본 */
  sharpAttack?: boolean;
}

/** 한 음의 크기 곡선(0–1). t = 음 시작부터의 초, durSec = 음 길이 */
function noteEnv(kind: OnsetKind, t: number, durSec: number, o: EnvelopeOpts): number {
  if (t < 0) return 0;
  const atk =
    kind === 'slap' ? 0.001 : kind === 'bassTone' ? 0.003 : kind === 'pluck' || kind === 'chord' ? 0.004 : 0.012;
  const attack = o.softAttack ? (kind === 'slap' || kind === 'bassTone' ? 0.025 : 0.05) : o.sharpAttack ? atk * 0.5 : atk;
  const rise = t < attack ? t / attack : 1;
  switch (kind) {
    case 'bassTone':
      return rise * Math.exp(-(t - Math.min(t, attack)) / (o.sharpAttack ? 0.07 : 0.09));
    case 'slap':
      return rise * Math.exp(-(t - Math.min(t, attack)) / (o.sharpAttack ? 0.035 : 0.045));
    case 'pluck': {
      if (t > durSec) return 0;
      const tail = durSec - t < 0.02 ? (durSec - t) / 0.02 : 1;
      return rise * Math.exp(-(t - Math.min(t, attack)) / 0.25) * tail;
    }
    case 'chord': {
      // 건반: 빠른 시작, 천천히 줄어듦, 다음 박 전에 뗌
      if (t > durSec) return 0;
      const tail = durSec - t < 0.03 ? (durSec - t) / 0.03 : 1;
      return rise * Math.exp(-(t - Math.min(t, attack)) / 0.35) * tail;
    }
    case 'note': {
      const end = durSec * 0.88;
      if (t > end + 0.03) return 0;
      // 텅잉: 시작에 짧은 강조, 그다음 유지
      const tongue = o.softAttack ? 0 : (o.sharpAttack ? 0.6 : 0.3) * Math.exp(-t / 0.03);
      const sustain = 0.75 + tongue;
      const rel = t > end ? 1 - (t - end) / 0.03 : 1;
      return rise * sustain * rel;
    }
  }
}

export interface RenderStemOpts extends EnvelopeOpts {
  shape: PlaceholderShape;
  /** 리듬 편집본: 부점 여린박(0.75+0.25)을 고른 8분음표(0.5+0.5)로(구성안 6.2절) */
  evenRhythm?: boolean;
}

const SEEDS: Record<StemId, number> = { piano: 0x3c6e, cajon: 0x1234, bass: 0x9e37, trumpet: 0x5a5a, bassOct: 0x7f4a };

/** 스템 하나를 렌더링한다(모노). 박 패턴이 없는 steady면 처음부터 끝까지 핑크노이즈 */
export function renderStem(
  stem: StemId,
  song: SongConfig,
  sampleRate: number,
  opts: RenderStemOpts,
): Float32Array<ArrayBuffer> {
  const n = Math.round(song.placeholderDurationSec * sampleRate);
  const out = new Float32Array(n);
  fillPinkNoise(out, SEEDS[stem] + song.id.length * 31);
  if (opts.shape === 'steady') {
    // 앞뒤 10 ms 페이드만(8.2절의 끝 페이드아웃 규칙)
    const f = Math.round(0.01 * sampleRate);
    for (let i = 0; i < f; i++) {
      out[i] *= i / f;
      out[n - 1 - i] *= i / f;
    }
    return out;
  }
  let notes = placeholderScore(song)[stem];
  if (opts.evenRhythm) notes = evenDotted(notes);
  const env = new Float32Array(n);
  const bs = 60 / song.bpm;
  for (const note of notes) {
    const start = song.startOffsetSec + note.beat * bs;
    const durSec = note.dur * bs;
    const maxLen = note.kind === 'note' || note.kind === 'pluck' || note.kind === 'chord' ? durSec + 0.05 : 0.6;
    const i0 = Math.max(0, Math.round(start * sampleRate));
    const i1 = Math.min(n, Math.round((start + maxLen) * sampleRate));
    for (let i = i0; i < i1; i++) {
      const v = note.vel * noteEnv(note.kind, i / sampleRate - start, durSec, opts);
      if (v > env[i]) env[i] = v;
    }
  }
  for (let i = 0; i < n; i++) out[i] *= env[i];
  return out;
}

function evenDotted(notes: ScoreNote[]): ScoreNote[] {
  const res: ScoreNote[] = [];
  for (let i = 0; i < notes.length; i++) {
    const a = notes[i];
    const b = notes[i + 1];
    if (a.dur === 0.75 && b && b.dur === 0.25) {
      res.push({ ...a, dur: 0.5 }, { ...b, beat: a.beat + 0.5, dur: 0.5 });
      i++;
    } else res.push(a);
  }
  return res;
}

/** 자리표시 온셋 목록(초). 레인·애니메이션이 소리와 같은 시점을 쓰게 한다 */
export function placeholderOnsets(stem: StemId, song: SongConfig, shape: PlaceholderShape) {
  if (shape === 'steady') return [];
  const bs = 60 / song.bpm;
  return placeholderScore(song)[stem].map((nn) => ({
    t: song.startOffsetSec + nn.beat * bs,
    strength: nn.vel,
    kind: nn.kind,
    dur: nn.dur * bs,
  }));
}

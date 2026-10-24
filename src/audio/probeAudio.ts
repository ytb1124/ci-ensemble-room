// 단서 질문 편집본(구성안 6.2절)을 핑크노이즈 자리표시로 만든다.
// 재료: 곡 1의 3–4줄 구간(옥타브 도약 포함). 모든 편집본은 단서 하나만 바꾸고 같은 크기로 맞춘다(로빙 없음).
// 실제 편집본이 준비되면 PROBE_FILES에 경로를 넣으면 그 파일을 쓴다.

import { SONGS, beatToSec } from '../config/songs';
import type { CueId, EmphId, StemId } from '../types';
import { normalizeTo } from './engine';
import { renderStem, type RenderStemOpts } from './placeholder';

export type ClipId = 'orig' | CueId | `emph_${EmphId}`;

/** 실제 파일 경로(구성안 8.2절 파일명). null이면 자리표시 */
export const PROBE_FILES: Record<ClipId, string | null> = {
  orig: null, // '/audio/p_hbd_orig.wav'
  attack: null,
  bright: null,
  contour: null,
  rhythm: null,
  emph_melody: null,
  emph_rhythm: null,
  emph_bass: null,
  emph_attack: null,
  emph_clarity: null,
};

/** 공개 표에 쓰는 "바꾼 것" 설명(리포트·내보내기, probe_manifest 역할) */
export const PROBE_MANIFEST: Record<ClipId, { label: string; change: string; placeholderNote?: string }> = {
  orig: { label: '원본', change: '바꾸지 않았어요(같은 소리를 두 번)' },
  attack: { label: '시작 소리', change: '시작 소리를 부드럽게 했어요(소리가 커지는 데 트럼펫·베이스 약 50 ms, 카혼 약 25 ms)' },
  bright: { label: '밝기', change: '높은 소리를 줄여 어둡게 했어요(약 1.5 kHz 위를 줄임)' },
  contour: {
    label: '높낮이',
    change: '멜로디의 큰 도약을 작은 음정으로 바꿨어요',
    placeholderNote: '임시 소리: 지금 잡음에는 음높이가 없어서 트럼펫 소리를 조금 낮게만 바꿨어요. 실제로는 트럼펫을 따로 녹음한 소리를 써요.',
  },
  rhythm: { label: '리듬', change: '"따-단" 하고 튀는 리듬을 고르게 바꿨어요(박자는 그대로)' },
  emph_melody: { label: '멜로디 강조', change: '트럼펫 +6 dB' },
  emph_rhythm: { label: '박 강조', change: '카혼 +6 dB' },
  emph_bass: { label: '저음 강조', change: '베이스 +6 dB, 한 옥타브 위 소리를 작게 겹침' },
  emph_attack: { label: '시작 소리 강조', change: '모든 악기의 시작 소리를 더 또렷하게' },
  emph_clarity: { label: '또렷함 강조', change: '1–3 kHz 대역 +6 dB(소리 맞추기 ④의 "또렷하게"와 같은 처리)' },
};

// 모든 편집본을 같은 RMS로 맞춘다. 가장 뾰족한 편집본(박 강조)도 피크가 약 −5 dBFS에 머무는 값(실측).
const CLIP_LOUDNESS_DB = -28;

interface Recipe {
  opts?: Partial<RenderStemOpts>;
  stemOpts?: Partial<Record<StemId, Partial<RenderStemOpts>>>;
  gainDb?: Partial<Record<StemId, number>>;
  /** 전체에 거는 필터 */
  filter?: BiquadFilterOptions;
  /** 트럼펫에만 거는 필터(높낮이 자리표시) */
  trumpetFilter?: BiquadFilterOptions;
}

const RECIPES: Record<ClipId, Recipe> = {
  orig: {},
  attack: { opts: { softAttack: true } },
  bright: { filter: { type: 'lowpass', frequency: 1500, Q: 0.707 } },
  contour: { trumpetFilter: { type: 'lowpass', frequency: 900, Q: 0.707 } },
  rhythm: { stemOpts: { trumpet: { evenRhythm: true } } },
  emph_melody: { gainDb: { trumpet: 6 } },
  emph_rhythm: { gainDb: { cajon: 6 } },
  emph_bass: { gainDb: { bass: 6, bassOct: 0 } },
  emph_attack: { opts: { sharpAttack: true } },
  emph_clarity: { filter: { type: 'peaking', frequency: 1700, Q: 0.9, gain: 6 } },
};

const cache = new Map<string, AudioBuffer>();

/** 곡 1의 3–4줄 구간(초) */
function region() {
  const s = SONGS.hbd;
  const l3 = s.lines.find((l) => l.id === 'line3')!;
  const l4 = s.lines.find((l) => l.id === 'line4')!;
  return { start: beatToSec(s, l3.startBeat), end: beatToSec(s, l4.endBeat) };
}

export async function getProbeClip(ctx: BaseAudioContext, id: ClipId): Promise<AudioBuffer> {
  const key = `${id}:${ctx.sampleRate}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let buf: AudioBuffer;
  const url = PROBE_FILES[id];
  if (url) {
    const res = await fetch(url);
    buf = await ctx.decodeAudioData(await res.arrayBuffer());
  } else {
    buf = await renderPlaceholderClip(ctx.sampleRate, id);
  }
  cache.set(key, buf);
  return buf;
}

async function renderPlaceholderClip(sampleRate: number, id: ClipId): Promise<AudioBuffer> {
  const r = RECIPES[id];
  const song = SONGS.hbd;
  const { start, end } = region();
  const i0 = Math.round(start * sampleRate);
  const len = Math.round((end - start + 0.4) * sampleRate);
  const off = new OfflineAudioContext(1, len, sampleRate);
  const bus = off.createGain();
  let tail: AudioNode = bus;
  if (r.filter) {
    const f = new BiquadFilterNode(off, r.filter);
    bus.connect(f);
    tail = f;
  }
  tail.connect(off.destination);
  const stems: StemId[] = id === 'emph_bass' ? ['piano', 'cajon', 'bass', 'trumpet', 'bassOct'] : ['piano', 'cajon', 'bass', 'trumpet'];
  for (const sid of stems) {
    const data = renderStem(sid, song, sampleRate, { shape: 'rhythm', ...r.opts, ...r.stemOpts?.[sid] });
    normalizeTo(data, -24);
    const slice = data.slice(i0, i0 + len);
    // 시작 10 ms 페이드인, 끝 10 ms 페이드아웃(클립 경계 잡음 방지)
    const f = Math.round(0.01 * sampleRate);
    for (let i = 0; i < f && i < slice.length; i++) {
      slice[i] *= i / f;
      slice[slice.length - 1 - i] *= i / f;
    }
    const b = off.createBuffer(1, slice.length, sampleRate);
    b.copyToChannel(slice, 0);
    const src = new AudioBufferSourceNode(off, { buffer: b });
    const g = new GainNode(off, { gain: Math.pow(10, ((r.gainDb?.[sid] ?? 0) + (sid === 'bassOct' ? -6 : 0)) / 20) });
    let node: AudioNode = src.connect(g);
    if (sid === 'trumpet' && r.trumpetFilter) node = node.connect(new BiquadFilterNode(off, r.trumpetFilter));
    node.connect(bus);
    src.start();
  }
  const rendered = await off.startRendering();
  const d = rendered.getChannelData(0);
  normalizeTo(d, CLIP_LOUDNESS_DB); // 같은 크기로 재정규화("더 큰 쪽이 이기는" 일 방지)
  return rendered;
}

export const CUE_CLIPS: CueId[] = ['attack', 'bright', 'contour', 'rhythm'];
export const emphClip = (e: EmphId): ClipId => `emph_${e}` as ClipId;

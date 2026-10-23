// 단서 질문 세트 구성(구성안 6.3절)과 칩·단서 대응표(6.4절).
import type { ChipId, CueId, EmphId, ProbeItem } from '../types';

export const CUES: CueId[] = ['attack', 'bright', 'contour', 'rhythm'];

export const SET_B_PAIRS: Record<1 | 2, [EmphId, EmphId][]> = {
  1: [
    ['melody', 'rhythm'],
    ['attack', 'clarity'],
  ],
  2: [
    ['melody', 'bass'],
    ['rhythm', 'bass'],
  ],
};

function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 세트 문항 만들기: A 5문항(단서 4 + 기준 쌍 1) + A 반복 1문항(떨어진 위치) + B 2쌍 = 8문항.
 * 세트 2의 반복 단서는 세트 1과 다르게 고른다.
 */
export function buildSet(set: 1 | 2, avoidRepeatCue?: CueId): ProbeItem[] {
  const aItems: ProbeItem[] = shuffle<CueId | 'ref'>([...CUES, 'ref']).map((cue) => ({
    kind: 'A' as const,
    id: `s${set}_a_${cue}`,
    cue,
  }));
  const repeatCue = shuffle(CUES.filter((c) => c !== avoidRepeatCue))[0];
  const bItems: ProbeItem[] = SET_B_PAIRS[set].map((pair) => ({ kind: 'B' as const, id: `s${set}_b_${pair.join('_')}`, pair }));
  // A 5개 + B 2개를 섞되, 반복 문항은 원래 문항에서 최소 3칸 떨어진 뒤쪽에 둔다
  const items = shuffle([...aItems, ...bItems]);
  const origIdx = items.findIndex((x) => x.kind === 'A' && x.cue === repeatCue);
  const repeat: ProbeItem = { kind: 'A', id: `s${set}_a_${repeatCue}_rep`, cue: repeatCue, repeatOf: `s${set}_a_${repeatCue}` };
  const minPos = Math.min(items.length, origIdx + 3);
  const pos = minPos + Math.floor(Math.random() * (items.length - minPos + 1));
  items.splice(pos, 0, repeat);
  return items;
}

export const CHIPS: { id: ChipId; label: string }[] = [
  { id: 'attack', label: '시작 소리 (탁/부드럽게)' },
  { id: 'bright', label: '밝기 (쨍함/둥글함)' },
  { id: 'pitch', label: '높낮이' },
  { id: 'rhythm', label: '리듬·박자' },
  { id: 'loudness', label: '크기' },
  { id: 'unsure', label: '잘 모르겠어요' },
  { id: 'other', label: '기타' },
];

/** 끝 성찰 칩(6.3절) */
export const REFLECTION_CHIPS: { id: ChipId; label: string }[] = [
  { id: 'attack', label: '시작 소리' },
  { id: 'bright', label: '밝기' },
  { id: 'pitch', label: '높낮이' },
  { id: 'rhythm', label: '리듬·박자' },
  { id: 'loudness', label: '크기' },
  { id: 'visual', label: '악기 그림·화면' },
  { id: 'unsure', label: '잘 모르겠어요' },
];

export const EMPH_LABEL: Record<EmphId, string> = {
  melody: '멜로디',
  rhythm: '박·리듬',
  bass: '저음',
  attack: '시작 소리',
  clarity: '또렷함',
};

/** 리포트 단서 ↔ 소스 대응표(6.4절) */
export type ReportCue = 'attack' | 'bright' | 'pitch' | 'rhythm';
export const REPORT_CUES: {
  id: ReportCue;
  label: string;
  aCue: CueId;
  bEmph: EmphId;
  chip: ChipId;
  instrument: string | null;
}[] = [
  { id: 'attack', label: '시작 소리', aCue: 'attack', bEmph: 'attack', chip: 'attack', instrument: null },
  { id: 'bright', label: '밝기·또렷함', aCue: 'bright', bEmph: 'clarity', chip: 'bright', instrument: null },
  { id: 'pitch', label: '높낮이·멜로디', aCue: 'contour', bEmph: 'melody', chip: 'pitch', instrument: '트럼펫' },
  { id: 'rhythm', label: '리듬·박', aCue: 'rhythm', bEmph: 'rhythm', chip: 'rhythm', instrument: '카혼' },
];

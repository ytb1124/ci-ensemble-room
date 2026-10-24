// "나의 청취 단서" 요약 규칙(구성안 6.4절)을 그대로 구현한 순수 함수 모음.
// 화면과 분리했고, 기준값은 RULES로 export해 화면의 "이 결과는 어떻게 만들었나요?"에 그대로 보여 준다.
// 아래 기준값은 모두 설계값(추론)이며 근거가 없다.

import { emphClip, PROBE_MANIFEST, type ClipId } from '../audio/probeAudio';
import { REFLECTION_CHIPS, REPORT_CUES, type ReportCue } from '../config/probes';
import type { ProbeState } from './probe';
import { summarizeLog } from './log';
import type {
  CueId,
  InstrumentId,
  LogEvent,
  Profile,
  ProbeResponse,
  ProbeResponseA,
  ProbeResponseB,
  Reflection,
} from '../types';
import { INSTRUMENTS, INSTRUMENT_LABEL } from '../types';

// ───────── 기준값 ─────────
export const RULES = {
  /** 단서값 ≥ 30 → 크게 느낌 */
  feelBig: 30,
  /** 10–29 → 조금 느낌, 10 미만 → 거의 못 느낌 */
  feelSome: 10,
  /** 같은 단서 두 평정의 차이가 이 값 이상이면 "아직 흔들려요" */
  shaky: 40,
  /** 기준값이 이 값 이상이면 주의문 */
  refCaution: 40,
  /** 반복차 < 15 → 비슷하게 */
  consistSame: 15,
  /** 반복차 ≥ 40 → 꽤 달랐어요 (15–39는 조금 달랐어요) */
  consistDiff: 40,
  /** 칩 2회 이상이면 "칩에서 두드러진 단서"로 센다 */
  chipMany: 2,
  /** B에서 "더 또렷해요"로 1회 이상 고르면 "선택에서 두드러진 단서"로 센다 */
  pickMin: 1,
  /** 로그에서 "가장 오래 솔로"로 말하려면 최소 이 초수 */
  soloMinSec: 3,
  maxSentences: 3,
} as const;

/** 화면에 그대로 보여 줄 규칙 문장 */
export const RULE_TEXT: string[] = [
  `느낀 차이: 원본끼리 비교한 기준 쌍에 표시한 값의 평균이 "기준값"이에요. 단서값 = 그 단서를 바꾼 소리에 표시한 값의 평균 − 기준값 (0보다 작으면 0). 단서값이 ${RULES.feelBig} 이상이면 "크게 느낌", ${RULES.feelSome}–${RULES.feelBig - 1}이면 "조금 느낌", ${RULES.feelSome} 미만이면 "거의 못 느낌"이라고 말해요. 건너뛴 문항은 빼요.`,
  `흔들림: 같은 단서에 표시한 두 값이 ${RULES.shaky} 이상 차이 나면 "아직 흔들려요"라고 적어요. 한 번만 들은 단서는 "한 번만 들었어요"라고 적어요.`,
  `주의문: 기준값이 ${RULES.refCaution} 이상이면 "차이가 없을 때도 다르다고 느끼는 편이에요. 값을 조심해서 보세요."를 보여 줘요.`,
  `다시 들었을 때: 같은 두 소리를 다시 들었을 때 표시한 두 값의 차이가 ${RULES.consistSame} 미만이면 "비슷하게", ${RULES.consistSame}–${RULES.consistDiff - 1}이면 "조금 달랐어요", ${RULES.consistDiff} 이상이면 "꽤 달랐어요"라고 적어요. 좋고 나쁨을 말하지 않아요.`,
  '고른 것: 단서마다 그 단서를 강조한 소리를 "더 또렷해요"로 고른 횟수를, 그 단서가 나온 쌍의 수와 함께 보여 줘요. 확신도는 확실해요(진하게)·조금·잘 모르겠어요(연하게)로 따로 적어요. "더 좋은 쪽"이 "더 또렷한 쪽"과 다르면 "더 또렷한 쪽과 더 좋은 쪽이 달랐어요"라고 따로 적어요.',
  '말한 것: 질문마다 고른 칩과 마지막 질문에서 고른 칩을 단서별로 합쳐 센 횟수예요. 한 줄로 적은 내용은 그대로 옮겨요.',
  '한 것: 합주실 기록에서 악기 이름으로만 말해요. 기록을 단서로 바꾸지 않아요(타악을 키운 것이 리듬 때문인지 멜로디가 안 들려서인지 알 수 없어요).',
  `일치·엇갈림 문장: ①크게 느낌 ②선택 ${RULES.pickMin}회 이상 ③칩 ${RULES.chipMany}회 이상, 이 세 가지 중 2개 이상이 같은 단서를 가리키면 "같은 방향", 크게 느꼈는데 칩·선택에 한 번도 없으면 "흥미로운 차이", 칩은 많은데 거의 못 느꼈으면 "다른 단서가 섞였을 수 있어요"라고 적어요. 최대 ${RULES.maxSentences}개예요.`,
  '다음에 해 볼 것: "아직 흔들려요" 단서가 있으면 그 질문 다시 듣기, 없으면 엇갈린 단서의 안내 카드, 둘 다 없으면 세트 2 해 보기 순으로 하나만 골라요.',
];

/** 6.5절 한계 요약 */
export const LIMIT_TEXT: string[] = [
  '연구에서는 단서를 가늠하려고 수백 쌍을 들었어요. 여기서는 단서당 두세 번만 들었어요. 이 정도로 개인의 단서를 믿을 만하게 알 수 있는지는 확인된 적이 없어요.',
  '내가 말한 것과 실제로 쓴 단서가 얼마나 일치하는지도 인공와우 음악에서는 연구된 적이 없어요.',
  '"같은 소리를 다시 들었을 때"는 표시가 얼마나 비슷했는지 보여 줄 뿐이에요. 단서 결과가 믿을 만하다는 보증은 아니에요.',
  '바꾼 소리의 처리 강도에 따라 결과가 달라져요. 너무 약하게 바꾼 단서는 "거의 못 느낌"으로 나올 수 있고, 그건 내 귀 때문이 아닐 수 있어요. 무엇을 얼마나 바꿨는지는 아래 표와 내보내기 파일에 적어 두었어요.',
];

// ───────── 우리말 보조 ─────────
/** 받침이 있으면 a, 없으면 b를 붙인다. josa('카혼','을','를') → '카혼을' */
export function josa(word: string, withBatchim: string, without: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return word + without;
  return word + ((c - 0xac00) % 28 === 0 ? without : withBatchim);
}

const SHORT_NAME: Record<ReportCue, string> = {
  attack: '시작 소리',
  bright: '밝기',
  pitch: '높낮이',
  rhythm: '리듬',
};

// ───────── 타입 ─────────
export type FeelLevel = 'big' | 'some' | 'none';
export const FEEL_WORD: Record<FeelLevel, string> = {
  big: '크게 느꼈어요',
  some: '조금 느꼈어요',
  none: '거의 못 느꼈어요',
};

export interface CueSummary {
  id: ReportCue;
  label: string;
  shortName: string;
  instrument: string | null;
  aCue: CueId;
  feel: { level: FeelLevel | null; n: number; shaky: boolean; once: boolean };
  pick: {
    /** 그 단서 강조가 나온 쌍 수(응답한 것만) */
    appeared: number;
    chosen: number;
    sure: number;
    some: number;
    unsure: number;
    /** "더 좋은 쪽"이 "더 또렷한 쪽"과 달랐다고 답한 횟수 */
    differentGood: number;
  };
  say: { chipCount: number; notes: string[] };
  /** 일치 판단에 쓰는 세 소스 */
  sources: { feelBig: boolean; picked: boolean; chips: boolean };
  hasData: boolean;
}

export interface ConsistencyItem {
  kind: 'within' | 'between';
  label: string;
  level: 'same' | 'little' | 'quite';
  text: string;
}

export interface ReportSentence {
  kind: 'agree' | 'differ' | 'log';
  cue?: ReportCue;
  /** 굵게 보일 앞부분 */
  lead: string;
  rest: string;
}

export interface LogFacts {
  lines: string[];
  /** 문장을 악기 이름(굵게)과 나머지로 나눈 것 */
  parts: { lead: string; rest: string }[];
  any: boolean;
}

export interface NextStep {
  kind: 'shaky' | 'differ' | 'set2';
  text: string;
  cue?: ReportCue;
  href?: string;
}

export interface ReportData {
  hasResponses: boolean;
  counts: { total: number; a: number; b: number; skipped: number };
  ref: { mean: number | null; n: number; caution: boolean };
  cues: CueSummary[];
  bass: { appeared: number; chosen: number };
  consistency: ConsistencyItem[];
  sentences: ReportSentence[];
  log: LogFacts;
  next: NextStep;
}

const isA = (r: ProbeResponse): r is ProbeResponseA => r.kind === 'A';
const isB = (r: ProbeResponse): r is ProbeResponseB => r.kind === 'B';
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const rated = (r: ProbeResponseA): r is ProbeResponseA & { rating: number } => r.rating !== null;

// ───────── 본체 ─────────
export function buildReport(state: ProbeState, events: LogEvent[]): ReportData {
  const A = state.responses.filter(isA);
  const B = state.responses.filter(isB);

  // (1) 느낀 차이
  const refRatings = A.filter((r) => r.cue === 'ref' && rated(r)).map((r) => r.rating as number);
  const refMean = refRatings.length ? mean(refRatings) : null;
  const refBase = refMean ?? 0;

  const cues: CueSummary[] = REPORT_CUES.map((c) => {
    const items = A.filter((r) => r.cue === c.aCue);
    const ratings = items.filter(rated).map((r) => r.rating as number);
    let level: FeelLevel | null = null;
    if (ratings.length) {
      const delta = Math.max(0, mean(ratings) - refBase);
      level = delta >= RULES.feelBig ? 'big' : delta >= RULES.feelSome ? 'some' : 'none';
    }
    const shaky = ratings.length >= 2 && Math.max(...ratings) - Math.min(...ratings) >= RULES.shaky;

    // (2) 고른 것
    const bs = B.filter((r) => (r.a === c.bEmph || r.b === c.bEmph) && r.clearer !== null);
    let chosen = 0;
    let sure = 0;
    let some = 0;
    let unsure = 0;
    let differentGood = 0;
    for (const r of bs) {
      const picked = (r.clearer === 'A' && r.a === c.bEmph) || (r.clearer === 'B' && r.b === c.bEmph);
      if (picked) {
        chosen++;
        if (r.confidence === 'sure') sure++;
        else if (r.confidence === 'some') some++;
        else if (r.confidence === 'unsure') unsure++;
      }
      if (r.preferSame === 'no' && r.clearer !== 'same') differentGood++;
    }

    // (3) 말한 것
    const chipFromA = items.reduce((n, r) => n + (r.chips.includes(c.chip) ? 1 : 0), 0);
    const chipFromRefl = state.reflections.reduce((n, r) => n + (r.chips.includes(c.chip) ? 1 : 0), 0);
    const chipCount = chipFromA + chipFromRefl;
    const notes = items.map((r) => r.note.trim()).filter(Boolean);

    return {
      id: c.id,
      label: c.label,
      shortName: SHORT_NAME[c.id],
      instrument: c.instrument,
      aCue: c.aCue,
      feel: { level, n: ratings.length, shaky, once: ratings.length === 1 },
      pick: { appeared: bs.length, chosen, sure, some, unsure, differentGood },
      say: { chipCount, notes },
      sources: {
        feelBig: level === 'big',
        picked: chosen >= RULES.pickMin,
        chips: chipCount >= RULES.chipMany,
      },
      hasData: ratings.length > 0 || bs.length > 0 || chipCount > 0,
    };
  });

  // (저음)
  const bassPairs = B.filter((r) => (r.a === 'bass' || r.b === 'bass') && r.clearer !== null);
  const bass = {
    appeared: bassPairs.length,
    chosen: bassPairs.filter((r) => (r.clearer === 'A' && r.a === 'bass') || (r.clearer === 'B' && r.b === 'bass')).length,
  };

  const consistency = buildConsistency(A);
  const log = buildLogFacts(events);
  const sentences = buildSentences(cues, log);
  const next = buildNext(cues);

  return {
    hasResponses: state.responses.length > 0,
    counts: {
      total: state.responses.length,
      a: A.length,
      b: B.length,
      skipped: A.filter((r) => r.rating === null).length,
    },
    ref: { mean: refMean, n: refRatings.length, caution: refMean !== null && refMean >= RULES.refCaution },
    cues,
    bass,
    consistency,
    sentences,
    log,
    next,
  };
}

// (1-1) 나의 일관성
function consistencyLevel(diff: number): ConsistencyItem['level'] {
  return diff < RULES.consistSame ? 'same' : diff < RULES.consistDiff ? 'little' : 'quite';
}
const CONSIST_TEXT: Record<ConsistencyItem['level'], string> = {
  same: '두 번 모두 비슷하게 표시했어요',
  little: '두 번의 표시가 조금 달랐어요',
  quite: '두 번의 표시가 꽤 달랐어요. 그날 컨디션이나 듣는 순서에 따라 달라질 수 있어요',
};
function cueName(c: CueId | 'ref'): string {
  if (c === 'ref') return '원본끼리 비교';
  return REPORT_CUES.find((x) => x.aCue === c)?.label ?? c;
}

function buildConsistency(A: ProbeResponseA[]): ConsistencyItem[] {
  const out: ConsistencyItem[] = [];
  // 세트 안: 반복 문항과 원 문항
  for (const r of A) {
    if (!r.isRepeat || r.rating === null) continue;
    const origId = r.itemId.replace(/_rep$/, '');
    const orig = A.find((x) => x.set === r.set && x.itemId === origId);
    if (!orig || orig.rating === null) continue;
    const level = consistencyLevel(Math.abs(orig.rating - r.rating));
    out.push({ kind: 'within', label: `세트 ${r.set} · ${cueName(r.cue)}`, level, text: CONSIST_TEXT[level] });
  }
  // 세트 간: 세트 1·2의 같은 단서(반복 문항 제외)
  const cueList: (CueId | 'ref')[] = ['ref', 'attack', 'bright', 'contour', 'rhythm'];
  for (const c of cueList) {
    const a1 = A.find((x) => x.set === 1 && x.cue === c && !x.isRepeat);
    const a2 = A.find((x) => x.set === 2 && x.cue === c && !x.isRepeat);
    if (!a1 || !a2 || a1.rating === null || a2.rating === null) continue;
    const level = consistencyLevel(Math.abs(a1.rating - a2.rating));
    out.push({ kind: 'between', label: `세트 1·2 · ${cueName(c)}`, level, text: CONSIST_TEXT[level] });
  }
  return out;
}

// (4) 한 것
function buildLogFacts(events: LogEvent[]): LogFacts {
  const s = summarizeLog(events);
  const parts: { lead: string; rest: string }[] = [];
  const topBy = (rec: Record<InstrumentId, number>, sign: 1 | -1): InstrumentId | null => {
    let best: InstrumentId | null = null;
    for (const i of INSTRUMENTS) {
      if (rec[i] * sign > 0 && (best === null || rec[i] * sign > rec[best] * sign)) best = i;
    }
    return best;
  };
  const add = (id: InstrumentId, tail: string) => {
    const name = INSTRUMENT_LABEL[id];
    parts.push({ lead: name, rest: `${josa(name, '을', '를').slice(name.length)} ${tail}` });
  };
  const solo = topBy(s.soloSeconds, 1);
  if (solo && s.soloSeconds[solo] >= RULES.soloMinSec) add(solo, '가장 오래 혼자 들었어요.');
  const up = topBy(s.netGainDb, 1);
  if (up) add(up, '가장 많이 키웠어요.');
  const down = topBy(s.netGainDb, -1);
  if (down) add(down, '가장 많이 줄였어요.');
  const alt = topBy(s.alternateCount, 1);
  if (alt) add(alt, '가장 많이 켰다 껐다 하며 들었어요.');
  return { lines: parts.map((p) => p.lead + p.rest), parts, any: parts.length > 0 };
}

// 일치·엇갈림 문장
function buildSentences(cues: CueSummary[], log: LogFacts): ReportSentence[] {
  const agree: ReportSentence[] = [];
  const differBig: ReportSentence[] = [];
  const differChip: ReportSentence[] = [];
  for (const c of cues) {
    const n = Number(c.sources.feelBig) + Number(c.sources.picked) + Number(c.sources.chips);
    if (n >= 2) {
      agree.push({
        kind: 'agree',
        cue: c.id,
        lead: c.shortName,
        rest: `${josa(c.shortName, '은', '는').slice(c.shortName.length)} 여러 방법에서 같은 방향으로 나왔어요. 이번에는 나에게 두드러진 단서였던 것 같아요.`,
      });
    } else if (c.sources.feelBig && c.say.chipCount === 0 && c.pick.chosen === 0) {
      differBig.push({
        kind: 'differ',
        cue: c.id,
        lead: c.shortName,
        rest: ' 변화는 크게 느꼈는데, 구별할 때 쓴 단서로는 고르지 않았어요. 흥미로운 차이예요. 다시 들어 볼까요?',
      });
    }
    if (c.say.chipCount >= RULES.chipMany && c.feel.level === 'none') {
      differChip.push({
        kind: 'differ',
        cue: c.id,
        lead: c.shortName,
        rest: `${josa(c.shortName, '을', '를').slice(c.shortName.length)} 자주 골랐지만, ${c.shortName}만 바꾼 소리는 원본과 거의 같다고 느꼈어요. 다른 단서가 ${c.shortName}처럼 느껴졌을 수도 있어요.`,
      });
    }
  }
  const logSentence: ReportSentence[] = log.parts.length ? [{ kind: 'log', ...log.parts[0] }] : [];
  return [...agree, ...differBig, ...differChip, ...logSentence].slice(0, RULES.maxSentences);
}

function buildNext(cues: CueSummary[]): NextStep {
  const shaky = cues.find((c) => c.feel.shaky);
  if (shaky) {
    return { kind: 'shaky', cue: shaky.id, text: `"${shaky.label}" 질문만 다시 들어 보기` };
  }
  const differ = cues.find(
    (c) =>
      (c.sources.feelBig && c.say.chipCount === 0 && c.pick.chosen === 0) ||
      (c.say.chipCount >= RULES.chipMany && c.feel.level === 'none'),
  );
  if (differ) {
    return { kind: 'differ', cue: differ.id, text: `합주실에서 "${differ.label}"${withParticle(differ.label)} 관련된 안내 카드 열기`, href: '/room/hbd' };
  }
  return { kind: 'set2', text: '곡 2로 같은 질문 해 보기(세트 2)', href: '/probe/set2' };
}

// ───────── 공개 표 ─────────
export interface RevealRow {
  set: 1 | 2;
  n: number;
  itemId: string;
  text: string;
  note?: string;
}

/** 응답이 만든 소리 A/B에서 무엇이 바뀌었는지(공개 표·내보내기 공용) */
export function describeChange(r: ProbeResponse): { text: string; note?: string } {
  if (isA(r)) {
    if (r.cue === 'ref') return { text: '두 소리 모두 원본이에요(바꾸지 않았어요)' };
    const m = PROBE_MANIFEST[r.cue as ClipId];
    const text = r.origIsA ? `A는 원본, B는 ${m.change}` : `A는 ${m.change}, B는 원본`;
    return { text, note: m.placeholderNote };
  }
  const ca = PROBE_MANIFEST[emphClip(r.a)];
  const cb = PROBE_MANIFEST[emphClip(r.b)];
  return { text: `A는 ${ca.label}(${ca.change}), B는 ${cb.label}(${cb.change})` };
}

/** 끝낸 세트의 문항을 풀어 쓴 순서(응답한 시각순)로 번호를 매긴다 */
export function buildRevealRows(state: ProbeState): RevealRow[] {
  const rows: RevealRow[] = [];
  for (const set of [1, 2] as const) {
    if (!state.completedSets.includes(set)) continue;
    const rs = state.responses.filter((r) => r.set === set).sort((x, y) => x.at.localeCompare(y.at));
    rs.forEach((r, i) => {
      const d = describeChange(r);
      rows.push({ set, n: i + 1, itemId: r.itemId, text: d.text, note: d.note });
    });
  }
  return rows;
}

// ───────── 설명 고쳐 쓰기: 바뀐 단서 단어 굵게 ─────────
type WordKey = ReportCue | 'loudness' | 'visual';
const CUE_WORDS: Record<WordKey, string[]> = {
  attack: ['시작 소리', '시작소리', '어택', '부드럽', '부드러', '탁'],
  bright: ['밝기', '밝', '쨍', '둥글', '어둡', '선명', '또렷', '맑'],
  pitch: ['높낮이', '음높이', '음정', '멜로디', '선율', '높은', '낮은', '높', '낮'],
  rhythm: ['리듬', '박자', '비트', '장단', '박'],
  loudness: ['크기', '볼륨', '세기', '큰 소리', '작은 소리'],
  visual: ['그림', '화면', '시각', '눈으로', '보이'],
};

function cuesIn(text: string): Set<WordKey> {
  const s = new Set<WordKey>();
  (Object.keys(CUE_WORDS) as WordKey[]).forEach((k) => {
    if (CUE_WORDS[k].some((w) => text.includes(w))) s.add(k);
  });
  return s;
}

export interface TextSeg {
  text: string;
  bold: boolean;
}

function segment(text: string, keys: WordKey[]): TextSeg[] {
  const words = keys.flatMap((k) => CUE_WORDS[k]).sort((a, b) => b.length - a.length);
  if (!words.length) return [{ text, bold: false }];
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text
    .split(re)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, bold: words.includes(t) }));
}

/** 처음 설명과 고친 설명 중 한쪽에만 나온 단서의 단어를 굵게 */
export function diffRevision(original: string, revised: string): { orig: TextSeg[]; rev: TextSeg[] } {
  const a = cuesIn(original);
  const b = cuesIn(revised);
  const changed = ([...a, ...b] as WordKey[]).filter((k, i, arr) => arr.indexOf(k) === i && a.has(k) !== b.has(k));
  return { orig: segment(original, changed), rev: segment(revised, changed) };
}

const CHIP_TEXT: Record<string, string> = Object.fromEntries(REFLECTION_CHIPS.map((c) => [c.id, c.label]));

/** 성찰이 한 줄 설명 없이 칩만 있을 때 보여 줄 글 */
export function reflectionAsText(r: Reflection): string {
  if (r.text.trim()) return r.text.trim();
  return r.chips.map((c) => CHIP_TEXT[c] ?? c).join(', ');
}

// ───────── 내 소리 설정 요약 ─────────
const CONFIG_LABEL: Record<string, string> = {
  bilateral: '양쪽 인공와우',
  unilateral: '한쪽 인공와우',
  bimodal: '인공와우 + 반대쪽 보청기',
  ssd: '인공와우 + 반대쪽은 잘 들림',
  unknown: '잘 모르겠어요',
};
const ROUTE_LABEL: Record<string, string> = {
  direct: '프로세서에 직접 연결',
  speaker: '스피커',
  headphones: '이어폰·헤드폰',
};
const ASSIST_LABEL: Record<string, string> = { none: '원래 소리', boost: '저음 키우기', octaveUp: '베이스를 높게 겹쳐 듣기' };
const SIGNED = (v: number) => `${v > 0 ? '+' : ''}${v} dB`;

export function profileLines(p: Profile): { label: string; value: string }[] {
  const none = '아직 정하지 않았어요';
  const bal = p.balance === -1 ? '왼쪽' : p.balance === 1 ? '오른쪽' : '가운데';
  return [
    { label: '듣기 환경', value: p.config ? CONFIG_LABEL[p.config] ?? p.config : none },
    { label: '듣는 방법', value: p.route ? ROUTE_LABEL[p.route] ?? p.route : none },
    { label: '앱 음량', value: SIGNED(p.masterGainDb) },
    { label: '좌우', value: p.stereo ? `스테레오(${bal}${p.spread ? ', 넓게 펼침' : ''})` : '양쪽에 같은 소리(모노)' },
    { label: '저음', value: p.eqLowDb ? `${SIGNED(p.eqLowDb)} 더` : '원래 소리' },
    { label: '또렷함', value: p.eqMidDb ? `${SIGNED(p.eqMidDb)} 더(${p.eqMidHz} Hz 근처)` : '원래 소리' },
    { label: '악기 섞기', value: INSTRUMENTS.map((i) => `${INSTRUMENT_LABEL[i]} ${SIGNED(p.instGainDb[i])}`).join(' · ') },
    { label: '저음 도움', value: ASSIST_LABEL[p.bassAssist] ?? p.bassAssist },
  ];
}

const HISTORY_KEY_LABEL: Record<string, string> = {
  config: '듣기 환경',
  route: '듣는 방법',
  maker: '인공와우 회사',
  masterGainDb: '앱 음량',
  stereo: '모노/스테레오',
  balance: '좌우',
  spread: '넓게 펼침',
  eqLowDb: '저음',
  eqMidDb: '또렷함',
  eqMidHz: '또렷함 대역',
  instGainDb: '악기 섞기',
  allowPlus12: '더 크게 키울 수 있게(+12 dB)',
  bassAssist: '저음 도움',
  bassVizEmphasis: '그림에서 베이스 박자 강조',
  soloLoudnessMatch: '혼자 들어도 같은 크기로',
  songOverrides: '곡별 섞기',
};

/** "설정을 이렇게 바꿨어요" 이력. 평가하지 않는다 */
export function historyLines(p: Profile): string[] {
  return [...p.history]
    .reverse()
    .slice(0, 8)
    .map((h) => {
      let d = '';
      try {
        d = new Date(h.at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
      } catch {
        /* 무시 */
      }
      const what = h.changed.map((k) => HISTORY_KEY_LABEL[k] ?? k).join(', ');
      return `${d ? d + ' · ' : ''}${josa(what, '을', '를')} 바꿨어요`;
    });
}

/** 받침이 있으면 '과', 없으면 '와' */
function withParticle(word: string): '과' | '와' {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return '와';
  return code % 28 ? '과' : '와';
}

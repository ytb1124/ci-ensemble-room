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
import { getLang, locale, tx } from '../i18n';

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

/** 언어가 바뀌어도 읽을 때마다 새로 고르는 문자열 배열(호출부는 그대로 .map 등을 쓴다) */
function liveList(items: (() => string)[]): string[] {
  const arr: string[] = [];
  items.forEach((get, i) => Object.defineProperty(arr, i, { get, enumerable: true }));
  return arr;
}

/** 화면에 그대로 보여 줄 규칙 문장 */
export const RULE_TEXT: string[] = liveList([
  () => tx(
    `느낀 차이: 원본끼리 비교한 기준 쌍에 표시한 값의 평균이 "기준값"이에요. 단서값 = 그 단서를 바꾼 소리에 표시한 값의 평균 − 기준값 (0보다 작으면 0). 단서값이 ${RULES.feelBig} 이상이면 "크게 느낌", ${RULES.feelSome}–${RULES.feelBig - 1}이면 "조금 느낌", ${RULES.feelSome} 미만이면 "거의 못 느낌"이라고 말해요. 건너뛴 문항은 빼요.`,
    `Felt difference: the "baseline" is the average of your ratings for the pairs where both sounds were the original. Cue value = the average of your ratings for the sound with that cue changed − the baseline (0 if below 0). A cue value of ${RULES.feelBig} or more is "Felt a big difference", ${RULES.feelSome}–${RULES.feelBig - 1} is "Felt some difference", and under ${RULES.feelSome} is "Barely felt a difference". Skipped questions are left out.`,
  ),
  () => tx(
    `흔들림: 같은 단서에 표시한 두 값이 ${RULES.shaky} 이상 차이 나면 "아직 흔들려요"라고 적어요. 한 번만 들은 단서는 "한 번만 들었어요"라고 적어요.`,
    `Varies: if your two ratings for the same cue differ by ${RULES.shaky} or more, we write "Still varies". If you heard a cue only once, we write "Heard only once".`,
  ),
  () => tx(
    `주의문: 기준값이 ${RULES.refCaution} 이상이면 "차이가 없을 때도 다르다고 느끼는 편이에요. 값을 조심해서 보세요."를 보여 줘요.`,
    `Note: if the baseline is ${RULES.refCaution} or more, we show "You tend to hear a difference even when there is none. Read the values with care."`,
  ),
  () => tx(
    `다시 들었을 때: 같은 두 소리를 다시 들었을 때 표시한 두 값의 차이가 ${RULES.consistSame} 미만이면 "비슷하게", ${RULES.consistSame}–${RULES.consistDiff - 1}이면 "조금 달랐어요", ${RULES.consistDiff} 이상이면 "꽤 달랐어요"라고 적어요. 좋고 나쁨을 말하지 않아요.`,
    `Hearing it again: when you heard the same two sounds again, if your two ratings differ by less than ${RULES.consistSame}, we write "about the same"; ${RULES.consistSame}–${RULES.consistDiff - 1}, "a little different"; ${RULES.consistDiff} or more, "quite different". This says nothing about good or bad.`,
  ),
  () => tx(
    '고른 것: 단서마다 그 단서를 강조한 소리를 "더 또렷해요"로 고른 횟수를, 그 단서가 나온 쌍의 수와 함께 보여 줘요. 확신도는 확실해요(진하게)·조금·잘 모르겠어요(연하게)로 따로 적어요. "더 좋은 쪽"이 "더 또렷한 쪽"과 다르면 "더 또렷한 쪽과 더 좋은 쪽이 달랐어요"라고 따로 적어요.',
    'What you picked: for each cue, how many times you picked the sound that brings out that cue as "clearer", shown with the number of pairs that had that cue. How sure you were is shown separately: Sure (darker), Somewhat, Not sure (lighter). If the "better" side was not the "clearer" side, we note "The clearer side and the better side were different".',
  ),
  () => tx(
    '말한 것: 질문마다 고른 칩과 마지막 질문에서 고른 칩을 단서별로 합쳐 센 횟수예요. 한 줄로 적은 내용은 그대로 옮겨요.',
    'What you said: the chips you picked in each question and in the last question, counted together for each cue. Anything you wrote is shown as you wrote it.',
  ),
  () => tx(
    '한 것: 합주실 기록에서 악기 이름으로만 말해요. 기록을 단서로 바꾸지 않아요(타악을 키운 것이 리듬 때문인지 멜로디가 안 들려서인지 알 수 없어요).',
    'What you did: from your Ensemble Room record, we only name instruments. We do not turn the record into cues (turning up the drum could be for the rhythm, or because the melody was hard to hear).',
  ),
  () => tx(
    `일치·엇갈림 문장: ①크게 느낌 ②선택 ${RULES.pickMin}회 이상 ③칩 ${RULES.chipMany}회 이상, 이 세 가지 중 2개 이상이 같은 단서를 가리키면 "같은 방향", 크게 느꼈는데 칩·선택에 한 번도 없으면 "흥미로운 차이", 칩은 많은데 거의 못 느꼈으면 "다른 단서가 섞였을 수 있어요"라고 적어요. 최대 ${RULES.maxSentences}개예요.`,
    `Agree/differ sentences: ① felt a big difference ② picked ${RULES.pickMin} or more times ③ chips ${RULES.chipMany} or more times. If 2 or more of these point to the same cue, we say it "pointed the same way". If you felt a big difference but never picked it in chips or choices, we call it "an interesting difference". If you picked the chip often but barely felt a difference, we say "another cue may have mixed in". At most ${RULES.maxSentences} sentences.`,
  ),
  () => tx(
    '다음에 해 볼 것: "아직 흔들려요" 단서가 있으면 그 질문 다시 듣기, 없으면 엇갈린 단서의 안내 카드, 둘 다 없으면 세트 2 해 보기 순으로 하나만 골라요.',
    'Try next: we pick just one, in this order: listen again to a question that "Still varies"; if none, open the guide card for a cue that differed; if neither, try Set 2.',
  ),
]);

/** 6.5절 한계 요약 */
export const LIMIT_TEXT: string[] = liveList([
  () => tx(
    '연구에서는 단서를 가늠하려고 수백 쌍을 들었어요. 여기서는 단서당 두세 번만 들었어요. 이 정도로 개인의 단서를 믿을 만하게 알 수 있는지는 확인된 적이 없어요.',
    'In research, people listened to hundreds of pairs to estimate their cues. Here you listened only two or three times per cue. No one has checked whether this is enough to know a person\'s cues reliably.',
  ),
  () => tx(
    '내가 말한 것과 실제로 쓴 단서가 얼마나 일치하는지도 인공와우 음악에서는 연구된 적이 없어요.',
    'How well what you say matches the cues you actually use has not been studied for music with cochlear implants (CI).',
  ),
  () => tx(
    '"같은 소리를 다시 들었을 때"는 표시가 얼마나 비슷했는지 보여 줄 뿐이에요. 단서 결과가 믿을 만하다는 보증은 아니에요.',
    '"Hearing the same sound again" only shows how similar your ratings were. It does not prove that the cue results are reliable.',
  ),
  () => tx(
    '바꾼 소리의 처리 강도에 따라 결과가 달라져요. 너무 약하게 바꾼 단서는 "거의 못 느낌"으로 나올 수 있고, 그건 내 귀 때문이 아닐 수 있어요. 무엇을 얼마나 바꿨는지는 아래 표와 내보내기 파일에 적어 두었어요.',
    'Results depend on how strongly each sound was changed. A cue changed too little may show as "Barely felt a difference", and that may not be because of your hearing. What we changed and by how much is written in the table below and in the export file.',
  ),
]);

// ───────── 우리말 보조 ─────────
/** 받침이 있으면 a, 없으면 b를 붙인다. josa('카혼','을','를') → '카혼을' */
export function josa(word: string, withBatchim: string, without: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return word + without;
  return word + ((c - 0xac00) % 28 === 0 ? without : withBatchim);
}

const SHORT_NAME: Record<ReportCue, string> = {
  get attack() { return tx('시작 소리', 'Note start'); },
  get bright() { return tx('밝기', 'Brightness'); },
  get pitch() { return tx('높낮이', 'Pitch'); },
  get rhythm() { return tx('리듬', 'Rhythm'); },
};

// ───────── 타입 ─────────
export type FeelLevel = 'big' | 'some' | 'none';
export const FEEL_WORD: Record<FeelLevel, string> = {
  get big() { return tx('크게 느꼈어요', 'Felt a big difference'); },
  get some() { return tx('조금 느꼈어요', 'Felt some difference'); },
  get none() { return tx('거의 못 느꼈어요', 'Barely felt a difference'); },
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
  get same() { return tx('두 번 모두 비슷하게 표시했어요', 'You rated it about the same both times'); },
  get little() { return tx('두 번의 표시가 조금 달랐어요', 'Your two ratings were a little different'); },
  get quite() {
    return tx(
      '두 번의 표시가 꽤 달랐어요. 그날 컨디션이나 듣는 순서에 따라 달라질 수 있어요',
      'Your two ratings were quite different. This can change with how you feel that day or the order you listen in',
    );
  },
};
function cueName(c: CueId | 'ref'): string {
  if (c === 'ref') return tx('원본끼리 비교', 'Original vs. original');
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
    out.push({ kind: 'within', label: `${tx('세트', 'Set')} ${r.set} · ${cueName(r.cue)}`, level, text: CONSIST_TEXT[level] });
  }
  // 세트 간: 세트 1·2의 같은 단서(반복 문항 제외)
  const cueList: (CueId | 'ref')[] = ['ref', 'attack', 'bright', 'contour', 'rhythm'];
  for (const c of cueList) {
    const a1 = A.find((x) => x.set === 1 && x.cue === c && !x.isRepeat);
    const a2 = A.find((x) => x.set === 2 && x.cue === c && !x.isRepeat);
    if (!a1 || !a2 || a1.rating === null || a2.rating === null) continue;
    const level = consistencyLevel(Math.abs(a1.rating - a2.rating));
    out.push({ kind: 'between', label: `${tx('세트 1·2', 'Sets 1 & 2')} · ${cueName(c)}`, level, text: CONSIST_TEXT[level] });
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
  const add = (id: InstrumentId, tail: string, enTail: string) => {
    const name = INSTRUMENT_LABEL[id];
    if (getLang() === 'en') parts.push({ lead: name, rest: ` — ${enTail}` });
    else parts.push({ lead: name, rest: `${josa(name, '을', '를').slice(name.length)} ${tail}` });
  };
  const solo = topBy(s.soloSeconds, 1);
  if (solo && s.soloSeconds[solo] >= RULES.soloMinSec) add(solo, '가장 오래 혼자 들었어요.', 'you listened to it alone the longest.');
  const up = topBy(s.netGainDb, 1);
  if (up) add(up, '가장 많이 키웠어요.', 'you turned it up the most.');
  const down = topBy(s.netGainDb, -1);
  if (down) add(down, '가장 많이 줄였어요.', 'you turned it down the most.');
  const alt = topBy(s.alternateCount, 1);
  if (alt) add(alt, '가장 많이 켰다 껐다 하며 들었어요.', 'you switched it on and off the most while listening.');
  return { lines: parts.map((p) => p.lead + p.rest), parts, any: parts.length > 0 };
}

// 일치·엇갈림 문장
function buildSentences(cues: CueSummary[], log: LogFacts): ReportSentence[] {
  const agree: ReportSentence[] = [];
  const differBig: ReportSentence[] = [];
  const differChip: ReportSentence[] = [];
  const en = getLang() === 'en';
  for (const c of cues) {
    const low = c.shortName.toLowerCase();
    const n = Number(c.sources.feelBig) + Number(c.sources.picked) + Number(c.sources.chips);
    if (n >= 2) {
      agree.push({
        kind: 'agree',
        cue: c.id,
        lead: c.shortName,
        rest: en
          ? ' pointed the same way in several parts. This time it seems to be a cue that stood out for you.'
          : `${josa(c.shortName, '은', '는').slice(c.shortName.length)} 여러 방법에서 같은 방향으로 나왔어요. 이번에는 나에게 두드러진 단서였던 것 같아요.`,
      });
    } else if (c.sources.feelBig && c.say.chipCount === 0 && c.pick.chosen === 0) {
      differBig.push({
        kind: 'differ',
        cue: c.id,
        lead: c.shortName,
        rest: tx(
          ' 변화는 크게 느꼈는데, 구별할 때 쓴 단서로는 고르지 않았어요. 흥미로운 차이예요. 다시 들어 볼까요?',
          " — you felt a big change, but you didn't pick it as a cue you used to tell the sounds apart. That's an interesting difference. Want to listen again?",
        ),
      });
    }
    if (c.say.chipCount >= RULES.chipMany && c.feel.level === 'none') {
      differChip.push({
        kind: 'differ',
        cue: c.id,
        lead: c.shortName,
        rest: en
          ? ` — you picked it often, but the sound with only ${low} changed felt almost the same as the original. Maybe another cue felt like ${low} to you.`
          : `${josa(c.shortName, '을', '를').slice(c.shortName.length)} 자주 골랐지만, ${c.shortName}만 바꾼 소리는 원본과 거의 같다고 느꼈어요. 다른 단서가 ${c.shortName}처럼 느껴졌을 수도 있어요.`,
      });
    }
  }
  const logSentence: ReportSentence[] = log.parts.length ? [{ kind: 'log', ...log.parts[0] }] : [];
  return [...agree, ...differBig, ...differChip, ...logSentence].slice(0, RULES.maxSentences);
}

function buildNext(cues: CueSummary[]): NextStep {
  const shaky = cues.find((c) => c.feel.shaky);
  if (shaky) {
    return { kind: 'shaky', cue: shaky.id, text: tx(`"${shaky.label}" 질문만 다시 들어 보기`, `Listen again to just the "${shaky.label}" question`) };
  }
  const differ = cues.find(
    (c) =>
      (c.sources.feelBig && c.say.chipCount === 0 && c.pick.chosen === 0) ||
      (c.say.chipCount >= RULES.chipMany && c.feel.level === 'none'),
  );
  if (differ) {
    const text =
      getLang() === 'en'
        ? `Open the guide card about "${differ.label}" in the Ensemble Room`
        : `합주실에서 "${differ.label}"${withParticle(differ.label)} 관련된 안내 카드 열기`;
    return { kind: 'differ', cue: differ.id, text, href: '/room/hbd' };
  }
  return { kind: 'set2', text: tx('곡 2로 같은 질문 해 보기(세트 2)', 'Try the same questions with Song 2 (Set 2)'), href: '/probe/set2' };
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
    if (r.cue === 'ref') return { text: tx('두 소리 모두 원본이에요(바꾸지 않았어요)', 'Both sounds are the original (nothing changed)') };
    const m = PROBE_MANIFEST[r.cue as ClipId];
    const text =
      getLang() === 'en'
        ? r.origIsA
          ? `A: original. B: ${m.change}`
          : `A: ${m.change}. B: original`
        : r.origIsA
          ? `A는 원본, B는 ${m.change}`
          : `A는 ${m.change}, B는 원본`;
    return { text, note: m.placeholderNote };
  }
  const ca = PROBE_MANIFEST[emphClip(r.a)];
  const cb = PROBE_MANIFEST[emphClip(r.b)];
  return {
    text:
      getLang() === 'en'
        ? `A: ${ca.label} (${ca.change}). B: ${cb.label} (${cb.change})`
        : `A는 ${ca.label}(${ca.change}), B는 ${cb.label}(${cb.change})`,
  };
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
// 영어 단어는 소문자로 두고, 대소문자 없이 단어 첫머리에서만 맞춘다('low'가 'slow'에 걸리지 않게)
const CUE_WORDS: Record<WordKey, string[]> = {
  attack: ['시작 소리', '시작소리', '어택', '부드럽', '부드러', '탁', 'attack', 'onset', 'start', 'soft', 'smooth', 'punch'],
  bright: ['밝기', '밝', '쨍', '둥글', '어둡', '선명', '또렷', '맑', 'bright', 'dark', 'sharp', 'dull', 'clear', 'clarity', 'crisp', 'mellow', 'round'],
  pitch: ['높낮이', '음높이', '음정', '멜로디', '선율', '높은', '낮은', '높', '낮', 'pitch', 'melody', 'tune', 'high', 'low'],
  rhythm: ['리듬', '박자', '비트', '장단', '박', 'rhythm', 'beat', 'tempo', 'timing', 'groove'],
  loudness: ['크기', '볼륨', '세기', '큰 소리', '작은 소리', 'loud', 'volume', 'quiet'],
  visual: ['그림', '화면', '시각', '눈으로', '보이', 'picture', 'screen', 'visual', 'image', 'watch'],
};

const isAscii = (w: string) => /^[\x00-\x7f]+$/.test(w);
const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 한국어는 그대로 부분 일치, 영어는 단어 첫머리에서 대소문자 없이 일치 */
const wordPattern = (w: string) => (isAscii(w) ? `\\b${escapeRe(w)}` : escapeRe(w));

function cuesIn(text: string): Set<WordKey> {
  const s = new Set<WordKey>();
  (Object.keys(CUE_WORDS) as WordKey[]).forEach((k) => {
    if (CUE_WORDS[k].some((w) => new RegExp(wordPattern(w), 'i').test(text))) s.add(k);
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
  const re = new RegExp(`(${words.map(wordPattern).join('|')})`, 'gi');
  return text
    .split(re)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, bold: words.includes(t.toLowerCase()) }));
}

/** 처음 설명과 고친 설명 중 한쪽에만 나온 단서의 단어를 굵게 */
export function diffRevision(original: string, revised: string): { orig: TextSeg[]; rev: TextSeg[] } {
  const a = cuesIn(original);
  const b = cuesIn(revised);
  const changed = ([...a, ...b] as WordKey[]).filter((k, i, arr) => arr.indexOf(k) === i && a.has(k) !== b.has(k));
  return { orig: segment(original, changed), rev: segment(revised, changed) };
}

// 칩 이름은 읽을 때마다 찾는다(언어가 바뀌어도 맞게)
const chipText = (id: string): string | undefined => REFLECTION_CHIPS.find((c) => c.id === id)?.label;

/** 성찰이 한 줄 설명 없이 칩만 있을 때 보여 줄 글 */
export function reflectionAsText(r: Reflection): string {
  if (r.text.trim()) return r.text.trim();
  return r.chips.map((c) => chipText(c) ?? c).join(', ');
}

// ───────── 내 소리 설정 요약 ─────────
const CONFIG_LABEL: Record<string, string> = {
  get bilateral() { return tx('양쪽 인공와우', 'CIs in both ears'); },
  get unilateral() { return tx('한쪽 인공와우', 'CI in one ear'); },
  get bimodal() { return tx('인공와우 + 반대쪽 보청기', 'CI + hearing aid in the other ear'); },
  get ssd() { return tx('인공와우 + 반대쪽은 잘 들림', 'CI + typical hearing in the other ear'); },
  get unknown() { return tx('잘 모르겠어요', 'Not sure'); },
};
const ROUTE_LABEL: Record<string, string> = {
  get direct() { return tx('프로세서에 직접 연결', 'Streamed to your processor'); },
  get speaker() { return tx('스피커', 'Speakers'); },
  get headphones() { return tx('이어폰·헤드폰', 'Earphones or headphones'); },
};
const ASSIST_LABEL: Record<string, string> = {
  get none() { return tx('원래 소리', 'Original sound'); },
  get boost() { return tx('저음 키우기', 'Boost bass'); },
  get octaveUp() { return tx('베이스를 높게 겹쳐 듣기', 'Add bass an octave up'); },
};
const SIGNED = (v: number) => `${v > 0 ? '+' : ''}${v} dB`;

export function profileLines(p: Profile): { label: string; value: string }[] {
  const none = tx('아직 정하지 않았어요', 'Not set yet');
  const orig = tx('원래 소리', 'Original sound');
  const bal = p.balance === -1 ? tx('왼쪽', 'left') : p.balance === 1 ? tx('오른쪽', 'right') : tx('가운데', 'center');
  const en = getLang() === 'en';
  return [
    { label: tx('듣기 환경', 'Your setup'), value: p.config ? CONFIG_LABEL[p.config] ?? p.config : none },
    { label: tx('듣는 방법', 'How you listen'), value: p.route ? ROUTE_LABEL[p.route] ?? p.route : none },
    { label: tx('앱 음량', 'App volume'), value: SIGNED(p.masterGainDb) },
    {
      label: tx('좌우', 'Left/right'),
      value: p.stereo
        ? en
          ? `Stereo (${bal}${p.spread ? ', spread wide' : ''})`
          : `스테레오(${bal}${p.spread ? ', 넓게 펼침' : ''})`
        : tx('양쪽에 같은 소리(모노)', 'Same sound in both ears (mono)'),
    },
    { label: tx('저음', 'Bass (low sounds)'), value: p.eqLowDb ? `${SIGNED(p.eqLowDb)} ${tx('더', 'more')}` : orig },
    {
      label: tx('또렷함', 'Clarity'),
      value: p.eqMidDb
        ? en
          ? `${SIGNED(p.eqMidDb)} more (around ${p.eqMidHz} Hz)`
          : `${SIGNED(p.eqMidDb)} 더(${p.eqMidHz} Hz 근처)`
        : orig,
    },
    { label: tx('악기 섞기', 'Instrument mix'), value: INSTRUMENTS.map((i) => `${INSTRUMENT_LABEL[i]} ${SIGNED(p.instGainDb[i])}`).join(' · ') },
    { label: tx('저음 도움', 'Bass help'), value: ASSIST_LABEL[p.bassAssist] ?? p.bassAssist },
  ];
}

const HISTORY_KEY_LABEL: Record<string, string> = {
  get config() { return tx('듣기 환경', 'Your setup'); },
  get route() { return tx('듣는 방법', 'How you listen'); },
  get maker() { return tx('인공와우 회사', 'CI manufacturer'); },
  get masterGainDb() { return tx('앱 음량', 'App volume'); },
  get stereo() { return tx('모노/스테레오', 'Mono/stereo'); },
  get balance() { return tx('좌우', 'Left/right'); },
  get spread() { return tx('넓게 펼침', 'Spread wide'); },
  get eqLowDb() { return tx('저음', 'Bass (low sounds)'); },
  get eqMidDb() { return tx('또렷함', 'Clarity'); },
  get eqMidHz() { return tx('또렷함 대역', 'Clarity range'); },
  get instGainDb() { return tx('악기 섞기', 'Instrument mix'); },
  get allowPlus12() { return tx('더 크게 키울 수 있게(+12 dB)', 'Allow louder (+12 dB)'); },
  get bassAssist() { return tx('저음 도움', 'Bass help'); },
  get bassVizEmphasis() { return tx('그림에서 베이스 박자 강조', 'Show the bass beat in the picture'); },
  get soloLoudnessMatch() { return tx('혼자 들어도 같은 크기로', 'Same loudness in Solo'); },
  get songOverrides() { return tx('곡별 섞기', 'Mix for each song'); },
};

/** "설정을 이렇게 바꿨어요" 이력. 평가하지 않는다 */
export function historyLines(p: Profile): string[] {
  return [...p.history]
    .reverse()
    .slice(0, 8)
    .map((h) => {
      let d = '';
      try {
        d = new Date(h.at).toLocaleDateString(locale(), { month: 'long', day: 'numeric' });
      } catch {
        /* 무시 */
      }
      const what = h.changed.map((k) => HISTORY_KEY_LABEL[k] ?? k).join(', ');
      if (getLang() === 'en') return `${d ? d + ' · ' : ''}Changed: ${what}`;
      return `${d ? d + ' · ' : ''}${josa(what, '을', '를')} 바꿨어요`;
    });
}

/** 받침이 있으면 '과', 없으면 '와' */
function withParticle(word: string): '과' | '와' {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return '와';
  return code % 28 ? '과' : '와';
}

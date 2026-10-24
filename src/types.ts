// 공용 타입. 저장 스키마는 구성안 4.3절(cihall.profile.v1)을 따른다.

export type InstrumentId = 'piano' | 'cajon' | 'trumpet' | 'bass';
/** 카드·목록 순서(팀 합의: 피아노 · 카혼 · 트럼펫 · 베이스) */
export const INSTRUMENTS: InstrumentId[] = ['piano', 'cajon', 'trumpet', 'bass'];
export const INSTRUMENT_LABEL: Record<InstrumentId, string> = {
  piano: '피아노',
  cajon: '카혼',
  bass: '베이스',
  trumpet: '트럼펫',
};
/** 짧은 라벨(좁은 화면용) */
export const INSTRUMENT_SHORT: Record<InstrumentId, string> = {
  piano: '피아노',
  cajon: '카혼',
  bass: '베이스',
  trumpet: '트럼펫',
};

/** 엔진이 다루는 스템. bassOct = 저음 도움 보조 스템(한 옥타브 위 테이크) */
export type StemId = InstrumentId | 'bassOct';

export type SongId = 'hbd' | 'song2';

export type DeviceConfig = 'bilateral' | 'unilateral' | 'bimodal' | 'ssd' | 'unknown';
export type Route = 'direct' | 'speaker' | 'headphones';
export type Maker = 'cochlear' | 'medel' | 'ab' | 'oticon' | 'unknown' | null;
export type BassAssist = 'none' | 'boost' | 'octaveUp';
export type ViewMode = 'off' | 'lanes' | 'explore';
export type MotionLevel = 'off' | 'calm' | 'normal' | 'vivid';
export type SyncMethod = 'auto' | 'tap' | 'preset-bt';
export type Theme = 'system' | 'light' | 'dark';
/** 자리표시 소리 모양: rhythm = 박자에 맞춰 끊기는 핑크노이즈, steady = 계속 나는 핑크노이즈 */
export type PlaceholderShape = 'rhythm' | 'steady';

export interface Profile {
  schema: 1;
  calibVersion: number;
  updatedAt: string | null;
  config: DeviceConfig | null;
  route: Route | null;
  maker: Maker;
  masterGainDb: number;
  stereo: boolean;
  balance: -1 | 0 | 1;
  spread: boolean;
  eqLowDb: 0 | 3 | 6;
  eqMidDb: 0 | 3 | 6;
  eqMidHz: 1700 | 3000;
  instGainDb: Record<InstrumentId, number>;
  allowPlus12: boolean;
  bassAssist: BassAssist;
  bassVizEmphasis: boolean;
  soloLoudnessMatch: boolean;
  songOverrides: Partial<Record<SongId, { instGainDb: Record<InstrumentId, number> }>>;
  viz: {
    defaultView: ViewMode;
    pitchLines: boolean;
    motion: MotionLevel;
    listenFirst: boolean;
    theme: Theme;
  };
  sync: { userOffsetMs: number; method: SyncMethod; calibratedAt: string | null };
  history: { calibVersion: number; at: string; changed: string[] }[];
  /** 프로토타입 전용 */
  audioUnlocked: boolean;
  calibrated: boolean;
  /** 보정에서 끝낸 단계(0–6). 이어 하기에 쓴다 */
  calibStepsDone: number[];
  placeholderShape: PlaceholderShape;
}

// ───────── 이벤트 로그 (구성안 5.4절) ─────────
export type LogEvent =
  | { type: 'play' | 'pause' | 'seek'; t: number; songPos: number; song: SongId }
  | { type: 'solo' | 'unsolo' | 'toggle'; t: number; instrument: InstrumentId | null; mode: RoomMode; songPos: number; song: SongId; on?: boolean }
  | { type: 'gain'; t: number; instrument: InstrumentId; fromDb: number; toDb: number; song: SongId }
  | { type: 'loop'; t: number; section: string; song: SongId }
  | { type: 'alternate'; t: number; instrument: InstrumentId; song: SongId }
  | { type: 'view' | 'motion' | 'blind'; t: number; value: string }
  | { type: 'card'; t: number; cardId: string; answer: CardAnswer };

export type RoomMode = 'solo' | 'toggle';
export type CardAnswer = 'heard' | 'some' | 'unsure' | 'close';

// ───────── 단서 질문 (구성안 6절) ─────────
export type CueId = 'attack' | 'bright' | 'contour' | 'rhythm';
export type EmphId = 'melody' | 'rhythm' | 'bass' | 'attack' | 'clarity';
export type ChipId = 'attack' | 'bright' | 'pitch' | 'rhythm' | 'loudness' | 'visual' | 'unsure' | 'other';

export type ProbeItem =
  | { kind: 'A'; id: string; cue: CueId | 'ref'; repeatOf?: string }
  | { kind: 'B'; id: string; pair: [EmphId, EmphId] };

export interface ProbeResponseA {
  kind: 'A';
  set: 1 | 2;
  itemId: string;
  cue: CueId | 'ref';
  isRepeat: boolean;
  /** 원본이 A 쪽이었는지 */
  origIsA: boolean;
  sliderStart: number;
  rating: number | null; // 0–100, null = 넘어가기
  chips: ChipId[];
  otherText: string;
  note: string;
  listensA: number;
  listensB: number;
  at: string;
}

export interface ProbeResponseB {
  kind: 'B';
  set: 1 | 2;
  itemId: string;
  /** 화면의 A, B에 놓인 강조 버전 */
  a: EmphId;
  b: EmphId;
  clearer: 'A' | 'B' | 'same' | null;
  confidence: 'sure' | 'some' | 'unsure' | null;
  preferSame: 'yes' | 'no' | 'unsure' | null;
  listensA: number;
  listensB: number;
  at: string;
}

export type ProbeResponse = ProbeResponseA | ProbeResponseB;

export interface Reflection {
  set: 1 | 2;
  chips: ChipId[];
  text: string;
  revised: string | null;
  at: string;
}

export interface SectionDef {
  id: string; // 'line1' … 'line4' | 'all'
  label: string;
  start: number; // 초
  end: number;
}

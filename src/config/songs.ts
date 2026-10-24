// 곡 설정. 실제 녹음이 준비되면 이 파일의 `url`만 채우면 된다(README "핑크노이즈를 실제 음원으로 바꾸기").
//
// - url이 null이면 그 스템은 핑크노이즈 자리표시로 만든다(src/audio/placeholder.ts).
// - url을 넣으면 그 파일을 decodeAudioData로 읽는다. 파일은 prototype/public/audio/ 에 두고
//   '/audio/hbd_stem_trumpet.flac' 처럼 적는다(파일명 규칙은 구성안 8.2절).
// - 모든 스템은 길이와 시작 샘플이 같아야 한다(구성안 8.3절).
// - timelineUrl(선택): 오프라인 분석 JSON(구성안 7.4절). 없으면 불러올 때 버퍼에서 직접 계산한다.
// - 구간(줄)은 박 단위로 적는다. 녹음을 클릭 트랙에 맞추면(8.2절) bpm과 startOffsetSec만 맞추면 그대로 쓸 수 있다.

import { tx } from '../i18n';
import type { SongId, StemId } from '../types';

export interface StemSource {
  url: string | null;
  timelineUrl?: string | null;
}

export interface SongConfig {
  id: SongId;
  /** 화면 제목. 곡 2는 미정이므로 제목을 정하지 않는다 */
  title: string;
  /** 정해지지 않은 곡이면 true. 화면에 "미정" 꼬리표를 붙인다 */
  undecided: boolean;
  meter: 3 | 4;
  bpm: number;
  /** 첫 박(카혼 예비박 시작)이 파일의 몇 초에 있는지 */
  startOffsetSec: number;
  /** 자리표시 소리의 곡 길이(초, 임시값). 실제 파일이 있으면 파일 길이를 쓴다 */
  placeholderDurationSec: number;
  stems: Record<StemId, StemSource>;
  /** 구간 반복용 줄 구분(박 단위, 0 = 예비박 첫 박) */
  lines: { id: string; label: string; startBeat: number; endBeat: number; note?: string }[];
  /** 보정 ②에서 쓰는 합주 4마디 루프(박 단위) */
  calibLoopBeats: [number, number];
  /** 보정 ⑥에서 쓰는 베이스 2마디(박 단위) */
  bassLoopBeats: [number, number];
}

export const SONGS: Record<SongId, SongConfig> = {
  hbd: {
    id: 'hbd',
    get title() {
      return tx('생일 축하합니다', 'Happy Birthday to You');
    },
    undecided: false,
    meter: 3,
    bpm: 90, // 임시값
    startOffsetSec: 0,
    placeholderDurationSec: 35, // 임시값(구성안은 60–90초)
    stems: {
      piano: { url: null },
      cajon: { url: null },
      bass: { url: null },
      trumpet: { url: null },
      bassOct: { url: null },
    },
    // 줄 = 못갖춘마디 시작(여린박)부터 다음 줄 여린박 전까지. 1회차 선율 기준.
    lines: [
      { id: 'line1', get label() { return tx('1줄', 'Line 1'); }, startBeat: 2, endBeat: 8 },
      { id: 'line2', get label() { return tx('2줄', 'Line 2'); }, startBeat: 8, endBeat: 14 },
      {
        id: 'line3',
        get label() { return tx('3줄', 'Line 3'); },
        startBeat: 14,
        endBeat: 20,
        get note() { return tx('멜로디가 크게 뛰어오르는 곳(한 옥타브)', 'Where the melody makes a big jump up (one octave)'); },
      },
      { id: 'line4', get label() { return tx('4줄', 'Line 4'); }, startBeat: 20, endBeat: 26 },
    ],
    calibLoopBeats: [3, 15],
    bassLoopBeats: [3, 9],
  },
  song2: {
    id: 'song2',
    get title() {
      return tx('곡 2 (미정)', 'Song 2 (TBD)');
    },
    undecided: true,
    meter: 4,
    bpm: 100, // 임시값
    startOffsetSec: 0,
    placeholderDurationSec: 42, // 임시값
    stems: {
      piano: { url: null },
      cajon: { url: null },
      bass: { url: null },
      trumpet: { url: null },
      bassOct: { url: null },
    },
    lines: [
      { id: 'line1', get label() { return tx('1줄', 'Line 1'); }, startBeat: 4, endBeat: 20 },
      { id: 'line2', get label() { return tx('2줄', 'Line 2'); }, startBeat: 20, endBeat: 36 },
      { id: 'line3', get label() { return tx('3줄', 'Line 3'); }, startBeat: 36, endBeat: 52 },
      { id: 'line4', get label() { return tx('4줄', 'Line 4'); }, startBeat: 52, endBeat: 68 },
    ],
    calibLoopBeats: [4, 20],
    bassLoopBeats: [4, 12],
  },
};

export const SONG_IDS: SongId[] = ['hbd', 'song2'];

export const beatSec = (song: SongConfig) => 60 / song.bpm;
export const beatToSec = (song: SongConfig, beat: number) => song.startOffsetSec + beat * beatSec(song);

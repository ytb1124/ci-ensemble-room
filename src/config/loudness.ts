// 0–10 크기 척도. 인공와우 매핑(맵핑) 때 청능사가 보여 주는 크기 차트의 단계 이름을 그대로 쓴다
// (Advanced Bionics 매핑용 0–10 라우드니스 차트 기준. 6 = 가장 편안함, 8 = 참을 수 있는 가장 큰 소리).
// 피드백(10/28): "작게·크게·조금 작게" 대신 실제 임상에서 쓰는 표현으로.
import { tx } from '../i18n';

export interface LoudnessStep {
  n: number;
  word: string;
}

export function loudnessScale(): LoudnessStep[] {
  return [
    { n: 0, word: tx('안 들림', 'Nothing') },
    { n: 1, word: tx('겨우 들림', 'Just noticeable') },
    { n: 2, word: tx('아주 작음', 'Very soft') },
    { n: 3, word: tx('작음', 'Soft') },
    { n: 4, word: tx('편하지만 너무 작음', 'Comfortable but too soft') },
    { n: 5, word: tx('편하지만 조금 작음', 'Comfortable but slightly soft') },
    { n: 6, word: tx('가장 편안함', 'Most comfortable') },
    { n: 7, word: tx('크지만 편안함', 'Loud but comfortable') },
    { n: 8, word: tx('참을 수 있는 가장 큰 소리', 'Upper loudness limit') },
    { n: 9, word: tx('너무 큼', 'Too loud') },
    { n: 10, word: tx('아플 만큼 큼', 'Painfully loud') },
  ];
}

export const loudnessWord = (n: number) => loudnessScale()[Math.max(0, Math.min(10, Math.round(n)))].word;

/** 단계별 색 구간: 작음(0–4) · 편안함(5–7) · 큼(8–10) */
export const loudnessZone = (n: number): 'soft' | 'comfy' | 'loud' => (n <= 4 ? 'soft' : n <= 7 ? 'comfy' : 'loud');

/**
 * 악기 크기(dB, 처음 맞춘 편안한 크기 = 0 dB)를 0–10 단계로 옮긴다.
 * 0 dB = 6(가장 편안함), 2 dB마다 한 단계. 가장 작은 −10 dB가 1(겨우 들림)이고, 0(안 들림)은 꺼짐에만 쓴다.
 */
export function dbToLevel(db: number): number {
  return Math.max(1, Math.min(10, Math.round(6 + db / 2)));
}

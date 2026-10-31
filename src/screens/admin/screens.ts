// 문구가 나오는 화면. 소스 위치(파일·감싼 함수)로 화면 이름과 미리보기에서 열 주소를 정한다.
// 화면 파일을 새로 만들거나 옮기면 여기에도 넣는다.
import type catalog from 'virtual:ko-catalog';

export type Place = (typeof catalog)[number]['where'][number];
export interface Screen {
  name: string;
  /** 해시 주소('/room/hbd') */
  route: string;
}

const STEP_NAMES = ['기기와 듣는 방법', '전체 크기', '좌우 균형', '음색(저음·또렷함)', '악기별 크기', '저음 도움'];

// 위에서부터 처음 맞는 것. 순서가 곧 관리자 화면의 묶음 순서다
const RULES: [RegExp, Screen][] = [
  [/^(App|i18n)\.tsx?$/, { name: '모든 화면 · 맨 위 메뉴', route: '/' }],
  [/^screens\/Start\.tsx$/, { name: '시작 화면', route: '/' }],
  [/^components\/SoundGate\.tsx$/, { name: '소리 켜기 안내', route: '/room/hbd' }],
  [/^screens\/calibrate\/Calibrate\.tsx$/, { name: '처음 설정 · 공통', route: '/calibrate/1' }],
  [/^screens\/calibrate\//, { name: '처음 설정 · 공통', route: '/calibrate/1' }],
  [/^screens\/room\/|^components\/(instruments|viz)\/|^config\/songs\.ts$|^audio\/engine\.ts$|^types\.ts$/, { name: '합주실', route: '/room/hbd' }],
  [/^screens\/probe\/|^config\/probes\.ts$/, { name: '단서 질문', route: '/probe/set1' }],
  [/^screens\/report\/|^store\/reportRules\.ts$|^audio\/probeAudio\.ts$/, { name: '나의 청취 단서', route: '/report' }],
  [/^screens\/(Settings|ResearchSection)\.tsx$/, { name: '설정', route: '/settings' }],
  [/^screens\/Join\.tsx$|^store\/research\.ts$/, { name: '연구 참여', route: '/join' }],
  [/^screens\/About\.tsx$/, { name: '이 프로그램에 대해', route: '/about' }],
  [/^components\/ui\//, { name: '여러 화면 공용 부품', route: '/calibrate/1' }],
];
const OTHER: Screen = { name: '그 밖의 문구', route: '/' };

export function screenOf(p: Place): Screen {
  // 처음 설정은 단계마다 따로 연다(steps.tsx의 Step1–Step6)
  const step = p.file === 'screens/calibrate/steps.tsx' ? /^Step(\d)$/.exec(p.fn)?.[1] : undefined;
  if (step) return { name: `처음 설정 ${step}단계 · ${STEP_NAMES[+step - 1]}`, route: `/calibrate/${step}` };
  return RULES.find(([r]) => r.test(p.file))?.[1] ?? OTHER;
}

/** 묶음 순서 */
export const SCREEN_ORDER: string[] = [
  ...new Set([
    ...RULES.slice(0, 4).map(([, s]) => s.name),
    ...STEP_NAMES.map((n, i) => `처음 설정 ${i + 1}단계 · ${n}`),
    ...RULES.slice(4).map(([, s]) => s.name),
    OTHER.name,
  ]),
];

/** 눈에 보이지 않는 문구 설명 */
export function hiddenLabel(kind: string | undefined): string | null {
  if (!kind) return null;
  if (kind === 'live') return '화면 낭독기가 읽어 주는 알림이라 눈에는 안 보여요';
  if (kind === 'title') return '마우스를 올렸을 때 나오는 설명이에요';
  if (kind === 'placeholder') return '입력칸 안에 흐리게 보이는 안내예요';
  return '화면 낭독기만 읽는 문구라 눈에는 안 보여요';
}

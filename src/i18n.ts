// 화면 언어(한국어/영어). 문구는 각 화면에 tx('한국어', 'English') 쌍으로 둔다.
// tx()는 부르는 순간의 언어를 읽으므로, 모듈 최상단 상수에 넣을 때는 getter나 함수로 감싼다.
import { useSyncExternalStore } from 'react';
import { createStore, readJSON, writeJSON } from './store/storage';

export type Lang = 'ko' | 'en';

const LANG_KEY = 'cihall.lang.v1';

function initialLang(): Lang {
  const saved = readJSON<Lang | null>(LANG_KEY, null);
  // 주 사용자가 한국어 사용자라 처음에는 한국어로 연다
  return saved === 'en' ? 'en' : 'ko';
}

export const langStore = createStore<Lang>(initialLang(), (l) => writeJSON(LANG_KEY, l));

// 화면 언어와 상관없이 잠깐 한 언어로 문구를 만들 때(연구용 내보내기) 쓴다
let forced: Lang | null = null;

export const getLang = (): Lang => forced ?? langStore.get();
export const setLang = (l: Lang) => langStore.set(l);

export function useLang(): Lang {
  return useSyncExternalStore(langStore.subscribe, langStore.get);
}

/** 지금 언어의 문구를 고른다 */
export function tx(ko: string, en: string): string {
  return getLang() === 'en' ? en : ko;
}

/** 날짜·숫자 표기용 로캘 */
export const locale = (): string => (getLang() === 'en' ? 'en-US' : 'ko-KR');

/** fn 안에서만 언어를 고정한다 */
export function inLang<T>(lang: Lang, fn: () => T): T {
  const prev = forced;
  forced = lang;
  try {
    return fn();
  } finally {
    forced = prev;
  }
}

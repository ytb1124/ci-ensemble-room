// 관리자가 고친 한국어 문구(#/admin). 키는 코드에 적힌 원래 한국어 문구, 값은 바꾼 문구.
// 서버(Supabase text_overrides 표)에서 누구나 읽고, 관리자만 쓴다(supabase/schema.sql).
// 마지막으로 받은 값을 이 기기에 남겨 두어 다음에 열 때 바로 보이고, 서버가 없거나 끊겨도 그 값으로 보인다.
import { useSyncExternalStore } from 'react';
import { createStore, readJSON, writeJSON } from './storage';

export type Overrides = Record<string, string>;

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const overridesEnabled = !!(SB_URL && SB_KEY);

const CACHE_KEY = 'cihall.textOverrides.v1';

export const overridesStore = createStore<Overrides>(readJSON<Overrides>(CACHE_KEY, {}), (v) => writeJSON(CACHE_KEY, v));

export function useOverrides(): Overrides {
  return useSyncExternalStore(overridesStore.subscribe, overridesStore.get);
}

/** 서버에서 최신 문구를 받아 온다. 실패하면 가지고 있던 값을 그대로 쓴다 */
export async function loadOverrides(): Promise<boolean> {
  if (!overridesEnabled) return false;
  try {
    // 읽기만 하므로 supabase-js 대신 REST로 바로 부른다(참여자 익명 로그인과 상관없이 동작)
    const res = await fetch(`${SB_URL}/rest/v1/text_overrides?select=key,value`, {
      headers: { apikey: SB_KEY!, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as { key: string; value: string }[];
    overridesStore.set(Object.fromEntries(rows.map((r) => [r.key, r.value])));
    return true;
  } catch {
    return false;
  }
}
